// Address autocomplete. Production uses Amazon Location Service Places (v2) with the site's API key;
// without a key (demo mode, local dev) it falls back to OpenStreetMap Nominatim, whose fair-use
// policy rules out commercial search-as-you-type traffic.
import { AWS_LOCATION_KEY, AWS_LOCATION_REGION } from '@/config/env'

export interface GeoResult {
  label: string
  street: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number
}

/** A suggestion shown while typing; `resolve` returns the full address with coordinates. */
export interface AddressSuggestion {
  id: string
  label: string
  resolve: () => Promise<GeoResult>
}

// Results are limited to the Dallas–Fort Worth Metroplex (roughly 120 km around Dallas).
const DFW_CENTER: [number, number] = [-96.95, 32.85]
const DFW_RADIUS_M = 120_000

export async function suggestAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  if (query.trim().length < 4) return []
  return AWS_LOCATION_KEY ? awsSuggest(query, signal) : nominatimSuggest(query, signal)
}

// ---------------------------------------------------------------- Amazon Location Places v2

const placesUrl = (path: string, params: Record<string, string> = {}) =>
  `https://places.geo.${AWS_LOCATION_REGION}.amazonaws.com/v2/${path}?${new URLSearchParams({ key: AWS_LOCATION_KEY, ...params })}`

interface AwsAddress {
  Label?: string
  AddressNumber?: string
  Street?: string
  Locality?: string
  Region?: { Code?: string; Name?: string }
  PostalCode?: string
}

/** "2201 Preston Rd, Plano, TX 75093-2335, United States" → "2201 Preston Rd, Plano, TX 75093" */
const shortLabel = (a: AwsAddress | undefined, fallback: string) =>
  (a?.Label ?? fallback).replace(/,\s*United States$/, '').replace(/\b(\d{5})-\d{4}\b/, '$1')

async function awsSuggest(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const res = await fetch(placesUrl('autocomplete'), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      QueryText: query,
      MaxResults: 5,
      Language: 'en',
      Filter: {
        IncludeCountries: ['USA'],
        IncludePlaceTypes: ['PointAddress', 'InterpolatedAddress'],
        Circle: { Center: DFW_CENTER, Radius: DFW_RADIUS_M },
      },
    }),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { ResultItems?: { PlaceId: string; Title: string; Address?: AwsAddress }[] }
  return (data.ResultItems ?? []).map((item) => ({
    id: item.PlaceId,
    label: shortLabel(item.Address, item.Title),
    resolve: () => awsGetPlace(item.PlaceId),
  }))
}

async function awsGetPlace(placeId: string): Promise<GeoResult> {
  // The chosen address and position are saved with the lead, so AWS terms require intended-use=Storage.
  const res = await fetch(placesUrl(`place/${encodeURIComponent(placeId)}`, { 'intended-use': 'Storage', language: 'en' }))
  if (!res.ok) throw new Error('We couldn’t look up that address. Please try again.')
  const place = (await res.json()) as { Title: string; Position: [number, number]; Address?: AwsAddress }
  const a = place.Address
  return {
    label: shortLabel(a, place.Title),
    street: [a?.AddressNumber, a?.Street].filter(Boolean).join(' '),
    city: a?.Locality ?? '',
    state: a?.Region?.Code ?? 'TX',
    zip: (a?.PostalCode ?? '').slice(0, 5),
    lng: place.Position[0],
    lat: place.Position[1],
  }
}

// ---------------------------------------------------------------- Nominatim (development fallback)

// Bias results toward the Dallas–Fort Worth Metroplex.
const DFW_VIEWBOX = '-97.75,33.45,-96.25,32.35'

interface NominatimItem {
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

const STATE_ABBR: Record<string, string> = { Texas: 'TX', Oklahoma: 'OK', Louisiana: 'LA', Arkansas: 'AR', 'New Mexico': 'NM' }

async function nominatimSuggest(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'us',
    limit: '5',
    viewbox: DFW_VIEWBOX,
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const items = (await res.json()) as NominatimItem[]
  return items.map((i) => {
    const a = i.address
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.suburb || a.hamlet || ''
    const state = STATE_ABBR[a.state] ?? a.state ?? ''
    const result: GeoResult = {
      label: [street, city, state, a.postcode].filter(Boolean).join(', ') || i.display_name,
      street,
      city,
      state,
      zip: (a.postcode ?? '').slice(0, 5),
      lat: parseFloat(i.lat),
      lng: parseFloat(i.lon),
    }
    return { id: `${i.lat},${i.lon}`, label: result.label, resolve: async () => result }
  })
}

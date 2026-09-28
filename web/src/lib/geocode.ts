// Address autocomplete via OpenStreetMap Nominatim (free, no key; ~1 req/sec fair-use limit).
// For production volume, swap this module for Amazon Location Service or Google Places.

export interface GeoResult {
  label: string
  street: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number
}

// Bias results toward the Dallas–Fort Worth Metroplex.
const DFW_VIEWBOX = '-97.75,33.45,-96.25,32.35'

interface NominatimItem {
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

const STATE_ABBR: Record<string, string> = { Texas: 'TX', Oklahoma: 'OK', Louisiana: 'LA', Arkansas: 'AR', 'New Mexico': 'NM' }

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  if (query.trim().length < 4) return []
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
    return {
      label: [street, city, state, a.postcode].filter(Boolean).join(', ') || i.display_name,
      street,
      city,
      state,
      zip: (a.postcode ?? '').slice(0, 5),
      lat: parseFloat(i.lat),
      lng: parseFloat(i.lon),
    }
  })
}

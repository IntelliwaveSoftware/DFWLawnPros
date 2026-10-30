// Satellite imagery for the lawn map, best available first:
// - Google Map Tiles API (VITE_GOOGLE_MAPS_KEY): Google's own aerial photography, the sharpest in DFW. Its
//   terms require the Google Maps logo and the viewport's copyright text on the map (GoogleAttribution).
// - Amazon Location (VITE_AWS_LOCATION_KEY): tile size, detail limit and attribution are read from AWS's own
//   "Satellite" map style, so they follow whatever AWS serves.
// - Without either key (demo mode, local dev), Esri World Imagery, which is not licensed here for
//   commercial traffic.
import { useEffect, useState } from 'react'
import { AWS_LOCATION_KEY, AWS_LOCATION_REGION, GOOGLE_MAPS_KEY } from '@/config/env'

export interface SatelliteSource {
  url: string
  attribution: string
  tileSize: number
  /** Highest zoom the imagery exists at; Leaflet scales those tiles up beyond it. */
  maxNativeZoom: number
  /** Google only: the session token its viewport requests (copyright text, zoom limit) need. */
  googleSession?: string
}

const ESRI: SatelliteSource = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  tileSize: 256,
  maxNativeZoom: 19,
}

// ---------------------------------------------------------------- Google Map Tiles API

const GOOGLE_TILES = 'https://tile.googleapis.com'
// On high-density screens, ask for tiles with twice the pixels (the same area, and the same billed tile count).
const HIGH_DPI = typeof window !== 'undefined' && window.devicePixelRatio > 1
const SESSION_STORAGE_KEY = `google-satellite-session${HIGH_DPI ? '-2x' : ''}`
const DAY_MS = 24 * 60 * 60 * 1000

/** A session token lasts about two weeks, so one is kept per browser rather than created on every visit. */
async function googleSession(): Promise<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as { session: string; expiry: number } | null
    if (saved && saved.expiry * 1000 > Date.now() + DAY_MS) return saved.session
  } catch {
    // storage unavailable: create a session for this page view
  }
  const res = await fetch(`${GOOGLE_TILES}/v1/createSession?key=${GOOGLE_MAPS_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mapType: 'satellite',
      language: 'en-US',
      region: 'US',
      ...(HIGH_DPI ? { scale: 'scaleFactor2x', highDpi: true } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Google createSession failed (${res.status})`)
  const { session, expiry } = (await res.json()) as { session: string; expiry: string }
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ session, expiry: Number(expiry) }))
  } catch {
    // not remembered; harmless
  }
  return session
}

async function loadGoogleSource(): Promise<SatelliteSource> {
  const session = await googleSession()
  return {
    url: `${GOOGLE_TILES}/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${GOOGLE_MAPS_KEY}`,
    // GoogleAttribution adds the copyright text for the imagery in view.
    attribution: '',
    // High-DPI tiles carry more pixels but cover a standard 256px tile's area.
    tileSize: 256,
    // Raised per area once the viewport request says how far the imagery goes there.
    maxNativeZoom: 19,
    googleSession: session,
  }
}

export interface GoogleViewport {
  /** Must be shown on the map while these tiles are in view. */
  copyright: string
  /** Highest zoom with imagery at the view's center (0 if unknown). */
  maxZoom: number
}

export async function googleViewport(
  session: string,
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number,
  [lat, lng]: [number, number],
  signal?: AbortSignal,
): Promise<GoogleViewport> {
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v))
  const params = new URLSearchParams({
    session,
    key: GOOGLE_MAPS_KEY,
    zoom: String(zoom),
    north: String(clamp(bounds.north, 89.9)),
    south: String(clamp(bounds.south, 89.9)),
    east: String(clamp(bounds.east, 179.9)),
    west: String(clamp(bounds.west, 179.9)),
  })
  const res = await fetch(`${GOOGLE_TILES}/tile/v1/viewport?${params}`, { signal })
  if (!res.ok) throw new Error(`Google viewport request failed (${res.status})`)
  const body = (await res.json()) as {
    copyright?: string
    maxZoomRects?: { maxZoom: number; north: number; south: number; east: number; west: number }[]
  }
  const here = (body.maxZoomRects ?? []).filter((r) => lat <= r.north && lat >= r.south && lng <= r.east && lng >= r.west)
  return { copyright: body.copyright ?? '', maxZoom: Math.max(0, ...here.map((r) => r.maxZoom)) }
}

// ---------------------------------------------------------------- Amazon Location

const withKey = (url: string) => (url.includes('key=') ? url : `${url}${url.includes('?') ? '&' : '?'}key=${AWS_LOCATION_KEY}`)

interface RasterSource {
  type: string
  tiles?: string[]
  url?: string
  tileSize?: number
  maxzoom?: number
  attribution?: string
}

async function loadAwsSource(): Promise<SatelliteSource> {
  const base = `https://maps.geo.${AWS_LOCATION_REGION}.amazonaws.com/v2`
  const style = (await (await fetch(`${base}/styles/Satellite/descriptor?key=${AWS_LOCATION_KEY}`)).json()) as {
    sources: Record<string, RasterSource>
  }
  let source = Object.values(style.sources).find((s) => s.type === 'raster')
  if (!source) throw new Error('No raster source in the Satellite style')
  if (!source.tiles && source.url) source = { ...source, ...((await (await fetch(withKey(source.url))).json()) as RasterSource) }
  const tile = source.tiles?.[0] ?? `${base}/tiles/raster.satellite/{z}/{x}/{y}`
  return {
    url: withKey(tile),
    attribution: source.attribution ?? '© AWS',
    tileSize: source.tileSize ?? 256,
    maxNativeZoom: source.maxzoom ?? 18,
  }
}

// ----------------------------------------------------------------

let googleAbandoned = false

async function loadSource(): Promise<SatelliteSource> {
  if (GOOGLE_MAPS_KEY && !googleAbandoned) {
    try {
      return await loadGoogleSource()
    } catch (err) {
      console.error('Google satellite tiles failed to load; falling back', err)
    }
  }
  if (AWS_LOCATION_KEY) {
    try {
      return await loadAwsSource()
    } catch (err) {
      console.error('Amazon Location satellite style failed to load; using Esri imagery', err)
    }
  }
  return ESRI
}

const HAS_KEY = Boolean(GOOGLE_MAPS_KEY || AWS_LOCATION_KEY)
let cached: Promise<SatelliteSource> | null = null
const listeners = new Set<(s: SatelliteSource) => void>()

/**
 * Google tiles stopped loading (API switched off, free trial over, daily quota used up): every map on the
 * page moves to the next source for the rest of the visit. The saved session is dropped too, so the next
 * visit asks Google afresh and falls back straight away if it's still unavailable.
 */
export function abandonGoogle() {
  if (googleAbandoned) return
  googleAbandoned = true
  console.error('Google satellite tiles are failing; switching imagery source')
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // storage unavailable
  }
  cached = loadSource()
  void cached.then((s) => listeners.forEach((notify) => notify(s)))
}

export function useSatelliteSource(): SatelliteSource | null {
  const [source, setSource] = useState<SatelliteSource | null>(HAS_KEY ? null : ESRI)
  useEffect(() => {
    if (!HAS_KEY) return
    cached ??= loadSource()
    let live = true
    void cached.then((s) => live && setSource(s))
    listeners.add(setSource)
    return () => {
      live = false
      listeners.delete(setSource)
    }
  }, [])
  return source
}

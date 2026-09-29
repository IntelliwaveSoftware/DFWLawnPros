// Satellite imagery for the lawn map. With an Amazon Location key, tile size, detail limit and
// attribution are read from AWS's own "Satellite" map style, so they follow whatever AWS serves.
// Without a key (demo mode, local dev) it uses Esri World Imagery, which is not licensed here for
// commercial traffic.
import { useEffect, useState } from 'react'
import { AWS_LOCATION_KEY, AWS_LOCATION_REGION } from '@/config/env'

export interface SatelliteSource {
  url: string
  attribution: string
  tileSize: number
  /** Highest zoom the imagery exists at; Leaflet scales those tiles up beyond it. */
  maxNativeZoom: number
}

const ESRI: SatelliteSource = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  tileSize: 256,
  maxNativeZoom: 19,
}

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

let cached: Promise<SatelliteSource> | null = null

export function useSatelliteSource(): SatelliteSource | null {
  const [source, setSource] = useState<SatelliteSource | null>(AWS_LOCATION_KEY ? null : ESRI)
  useEffect(() => {
    if (!AWS_LOCATION_KEY) return
    cached ??= loadAwsSource().catch((err) => {
      console.error('Amazon Location satellite style failed to load; using Esri imagery', err)
      return ESRI
    })
    let live = true
    void cached.then((s) => live && setSource(s))
    return () => {
      live = false
    }
  }, [])
  return source
}

/**
 * A static satellite image (Amazon Location GetStaticMap) for decorative use, e.g. the landing hero.
 * Returns null without a key so callers can fall back to a photo.
 */
export function staticSatelliteUrl([lat, lng]: [number, number], zoom: number, width: number, height: number): string | null {
  if (!AWS_LOCATION_KEY) return null
  const params = new URLSearchParams({
    style: 'Satellite',
    center: `${lng},${lat}`,
    zoom: String(zoom),
    width: String(Math.min(width, 1400)),
    height: String(Math.min(height, 1400)),
    key: AWS_LOCATION_KEY,
  })
  return `https://maps.geo.${AWS_LOCATION_REGION}.amazonaws.com/v2/static/map?${params}`
}

// Google Map Tiles terms: while Google imagery is on screen, show the Google Maps logo and the copyright
// text for the imagery in view. The same viewport request says how far the imagery zooms in there, so the
// layer scales the last real level up instead of requesting tiles that don't exist.
import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import logoUrl from '@/assets/google-maps-logo.svg'
import { googleViewport } from './satellite'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function GoogleAttribution({ session, layer }: { session: string; layer: L.TileLayer }) {
  const map = useMap()

  useEffect(() => {
    const logo = new L.Control({ position: 'bottomleft' })
    logo.onAdd = () => {
      const img = L.DomUtil.create('img', 'google-maps-logo')
      img.src = logoUrl
      img.alt = 'Google Maps'
      return img
    }
    logo.addTo(map)
    return () => {
      logo.remove()
    }
  }, [map])

  useEffect(() => {
    let shown = ''
    let request: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      request?.abort()
      request = new AbortController()
      const b = map.getBounds()
      const c = map.getCenter()
      const zoom = Math.round(map.getZoom())
      try {
        const view = await googleViewport(
          session,
          { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          zoom,
          [c.lat, c.lng],
          request.signal,
        )
        const text = escapeHtml(view.copyright)
        if (text !== shown) {
          if (shown) map.attributionControl?.removeAttribution(shown)
          if (text) map.attributionControl?.addAttribution(text)
          shown = text
        }
        const current = layer.options.maxNativeZoom
        if (view.maxZoom && view.maxZoom !== current) {
          layer.options.maxNativeZoom = view.maxZoom
          // Only reload tiles when the level shown at this zoom actually changes.
          if (Math.min(zoom, current ?? zoom) !== Math.min(zoom, view.maxZoom)) layer.redraw()
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) console.error(err)
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 250)
    }

    schedule()
    map.on('moveend', schedule)
    return () => {
      map.off('moveend', schedule)
      clearTimeout(timer)
      request?.abort()
      if (shown) map.attributionControl?.removeAttribution(shown)
    }
  }, [map, session, layer])

  return null
}

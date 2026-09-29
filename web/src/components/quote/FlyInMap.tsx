// Landing-page transition: a non-interactive live map that opens at exactly the backdrop's framing,
// reports when its tiles are on screen (so the page can cross-fade the backdrop away), then flies to
// the customer's home and hands over to the quote map.
import { useEffect, useRef } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import { HOME_ZOOM, type LatLng } from './geometry'
import { SatelliteLayer } from './LawnMap'

const TILE_TIMEOUT_MS = 3500 // don't keep anyone waiting on slow tiles
const FADE_MS = 600 // matches the backdrop's CSS transition

function Flight({ to, ready, onTilesReady, onArrive }: { to: LatLng; ready: boolean; onTilesReady: () => void; onArrive: () => void }) {
  const map = useMap()
  const started = useRef(false)
  useEffect(() => {
    const timer = setTimeout(onTilesReady, TILE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [onTilesReady])
  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => {
      if (reduceMotion) {
        map.setView(to, HOME_ZOOM, { animate: false })
        onArrive()
        return
      }
      map.once('moveend', onArrive)
      map.flyTo(to, HOME_ZOOM, { duration: 2.6, easeLinearity: 0.2 })
    }, FADE_MS)
    return () => clearTimeout(timer)
  }, [ready, map, to, onArrive])
  return null
}

export function FlyInMap({
  center,
  zoom,
  to,
  ready,
  onTilesReady,
  onArrive,
}: {
  /** Opening view; must match the backdrop image's framing. */
  center: LatLng
  zoom: number
  to: LatLng
  /** True once the page has started fading out the backdrop. */
  ready: boolean
  onTilesReady: () => void
  onArrive: () => void
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={21}
      className="size-full"
      zoomControl={false}
      dragging={false}
      touchZoom={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl
    >
      <SatelliteLayer onLoad={onTilesReady} />
      <Flight to={to} ready={ready} onTilesReady={onTilesReady} onArrive={onArrive} />
    </MapContainer>
  )
}

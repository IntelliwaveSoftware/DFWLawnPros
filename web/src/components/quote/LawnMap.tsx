import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { HOME_ZOOM, type LatLng } from './geometry'
import { useSatelliteSource } from './satellite'

const handle = (size: number, fill: string, border: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};border:3px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
// Phones: bigger corners to grab, plus translucent midpoints that become a new corner when dragged.
const touchVertexIcon = handle(26, '#fff', '#c7a54a')
const midpointIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:rgba(255,255,255,.55);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const vertexIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid #c7a54a;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})
const firstVertexIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#c7a54a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})
const homeIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#1f3d2b;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

/** Satellite imagery (AWS or the development fallback). `onLoad` fires once the visible tiles have loaded. */
export function SatelliteLayer({ onLoad }: { onLoad?: () => void }) {
  const source = useSatelliteSource()
  if (!source) return null
  // 512px tiles cover a 256px tile's area one zoom level up; zoomOffset keeps Leaflet's zoom levels aligned.
  const large = source.tileSize === 512
  return (
    <TileLayer
      key={source.url}
      url={source.url}
      attribution={source.attribution}
      tileSize={source.tileSize}
      zoomOffset={large ? -1 : 0}
      maxNativeZoom={large ? source.maxNativeZoom + 1 : source.maxNativeZoom}
      maxZoom={21}
      eventHandlers={onLoad ? { load: onLoad } : undefined}
    />
  )
}

function ClickCapture({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, HOME_ZOOM)
  }, [center, map])
  return null
}

export function LawnMap({
  center,
  areas,
  drawing,
  onAddPoint,
  onClose,
  onMoveVertex,
  touch = false,
  onInsertVertex,
}: {
  /** Keep this reference stable (e.g. from state); changing it recenters the map. */
  center: LatLng
  /** Completed polygons. */
  areas: LatLng[][]
  /** Polygon currently being drawn. */
  drawing: LatLng[]
  onAddPoint: (p: LatLng) => void
  onClose: () => void
  onMoveVertex: (area: number | 'drawing', index: number, p: LatLng) => void
  /** Phone mode: larger handles and draggable edge midpoints. */
  touch?: boolean
  /** Phone mode: a midpoint was dragged, adding a corner at `index` of that area. */
  onInsertVertex?: (area: number, index: number, p: LatLng) => void
}) {
  return (
    <MapContainer
      center={center}
      zoom={HOME_ZOOM}
      maxZoom={21}
      className="size-full"
      zoomControl
      doubleClickZoom={false}
      attributionControl
    >
      <SatelliteLayer />
      <Recenter center={center} />
      <ClickCapture onClick={onAddPoint} />
      <Marker position={center} icon={homeIcon} interactive={false} />

      {areas.map((poly, ai) => (
        <Polygon key={ai} positions={poly} pathOptions={{ color: '#c7a54a', weight: 3, fillColor: '#8fd16a', fillOpacity: 0.35 }} />
      ))}
      {touch &&
        onInsertVertex &&
        areas.map((poly, ai) =>
          poly.map((p, vi) => {
            const next = poly[(vi + 1) % poly.length]
            const mid: LatLng = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2]
            return (
              <Marker
                // Keyed by position so the handle snaps back to the new midpoint after each insert.
                key={`m-${ai}-${vi}-${mid.join(',')}`}
                position={mid}
                icon={midpointIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng()
                    onInsertVertex(ai, vi + 1, [ll.lat, ll.lng])
                  },
                }}
              />
            )
          }),
        )}
      {areas.map((poly, ai) =>
        poly.map((p, vi) => (
          <Marker
            key={`${ai}-${vi}`}
            position={p}
            icon={touch ? touchVertexIcon : vertexIcon}
            draggable
            eventHandlers={{
              drag: (e) => {
                const ll = (e.target as L.Marker).getLatLng()
                onMoveVertex(ai, vi, [ll.lat, ll.lng])
              },
            }}
          />
        )),
      )}

      {drawing.length > 0 && (
        <>
          {drawing.length >= 3 ? (
            <Polygon positions={drawing} pathOptions={{ color: '#ffffff', weight: 2, dashArray: '6 6', fillColor: '#8fd16a', fillOpacity: 0.25 }} />
          ) : (
            <Polyline positions={drawing} pathOptions={{ color: '#ffffff', weight: 2, dashArray: '6 6' }} />
          )}
          {drawing.map((p, vi) => (
            <Marker
              key={`d-${vi}`}
              position={p}
              icon={vi === 0 ? firstVertexIcon : vertexIcon}
              draggable
              eventHandlers={{
                click: () => vi === 0 && drawing.length >= 3 && onClose(),
                drag: (e) => {
                  const ll = (e.target as L.Marker).getLatLng()
                  onMoveVertex('drawing', vi, [ll.lat, ll.lng])
                },
              }}
            />
          ))}
        </>
      )}
    </MapContainer>
  )
}

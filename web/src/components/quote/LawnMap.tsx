import turfArea from '@turf/area'
import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'

export type LatLng = [number, number]

// Satellite imagery. Esri World Imagery works for development; for commercial production use,
// configure a licensed provider (ArcGIS Location Platform key, Mapbox, Google Map Tiles) via env.
const TILE_URL =
  import.meta.env.VITE_SATELLITE_TILE_URL ||
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = import.meta.env.VITE_SATELLITE_TILE_ATTRIBUTION || 'Imagery © Esri, Maxar, Earthstar Geographics'

const SQFT_PER_M2 = 10.7639

export function polygonSqft(points: LatLng[]): number {
  if (points.length < 3) return 0
  const ring = [...points, points[0]].map(([lat, lng]) => [lng, lat])
  return turfArea({ type: 'Polygon', coordinates: [ring] }) * SQFT_PER_M2
}

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

function ClickCapture({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 20)
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
}) {
  return (
    <MapContainer
      center={center}
      zoom={20}
      maxZoom={21}
      className="size-full"
      zoomControl
      doubleClickZoom={false}
      attributionControl
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxNativeZoom={19} maxZoom={21} />
      <Recenter center={center} />
      <ClickCapture onClick={onAddPoint} />
      <Marker position={center} icon={homeIcon} interactive={false} />

      {areas.map((poly, ai) => (
        <Polygon key={ai} positions={poly} pathOptions={{ color: '#c7a54a', weight: 3, fillColor: '#8fd16a', fillOpacity: 0.35 }} />
      ))}
      {areas.map((poly, ai) =>
        poly.map((p, vi) => (
          <Marker
            key={`${ai}-${vi}`}
            position={p}
            icon={vertexIcon}
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

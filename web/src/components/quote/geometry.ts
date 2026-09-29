// Lawn outline geometry for the quote map.
import turfArea from '@turf/area'

export type LatLng = [number, number]

/** Zoom the quote map opens at on a home. The landing fly-in lands on the same zoom so its tiles are reused. */
export const HOME_ZOOM = 20

const SQFT_PER_M2 = 10.7639

export function polygonSqft(points: LatLng[]): number {
  if (points.length < 3) return 0
  const ring = [...points, points[0]].map(([lat, lng]) => [lng, lat])
  return turfArea({ type: 'Polygon', coordinates: [ring] }) * SQFT_PER_M2
}

/**
 * A starting outline for phones, where tapping out corners is fiddly: a rectangle around the address
 * (80 × 55 ft, about a typical DFW lawn) that the customer drags to fit, offset by `shiftFt` for extra areas.
 */
export function starterOutline([lat, lng]: LatLng, shiftFt = 0, widthFt = 80, depthFt = 55): LatLng[] {
  const ftToLat = 0.3048 / 111_320
  const ftToLng = ftToLat / Math.cos((lat * Math.PI) / 180)
  const dLat = (depthFt / 2) * ftToLat
  const dLng = (widthFt / 2) * ftToLng
  const cLat = lat - shiftFt * ftToLat
  return [
    [cLat + dLat, lng - dLng],
    [cLat + dLat, lng + dLng],
    [cLat - dLat, lng + dLng],
    [cLat - dLat, lng - dLng],
  ]
}

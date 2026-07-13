import type { GeoPoint } from './types'

const EARTH_RADIUS_KM = 6371.0088

export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const dLat = lat2 - lat1
  const dLon = toRadians(b.lon - a.lon)
  const haversine = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

export function bearingDegrees(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const dLon = toRadians(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

export function destinationPoint(origin: GeoPoint, bearingDeg: number, distance: number): GeoPoint {
  if (distance === 0) return { ...origin }
  const angularDistance = distance / EARTH_RADIUS_KM
  const bearing = toRadians(bearingDeg)
  const lat1 = toRadians(origin.lat)
  const lon1 = toRadians(origin.lon)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  )
  return { lat: toDegrees(lat2), lon: ((toDegrees(lon2) + 540) % 360) - 180 }
}

export function localOffsetPoint(origin: GeoPoint, eastKm: number, northKm: number) {
  const distance = Math.hypot(eastKm, northKm)
  if (distance === 0) return { ...origin }
  const bearing = (toDegrees(Math.atan2(eastKm, northKm)) + 360) % 360
  return destinationPoint(origin, bearing, distance)
}

export function projectToLocalKm(origin: GeoPoint, point: GeoPoint) {
  const distance = distanceKm(origin, point)
  const bearing = toRadians(bearingDegrees(origin, point))
  return {
    x: Math.sin(bearing) * distance,
    y: Math.cos(bearing) * distance,
  }
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function toDegrees(value: number) {
  return value * 180 / Math.PI
}

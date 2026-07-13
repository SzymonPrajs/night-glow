import type { Location } from '../types'

const EARTH_KM = 6371

export function distanceKm(a: Location, b: { lat: number; lon: number }) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h))
}

export function bearingDegrees(a: Location, b: { lat: number; lon: number }) {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function geometryCentroid(points: Array<{ lat: number; lon: number }>) {
  if (!points.length) return { lat: 0, lon: 0 }
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
  }
}

export function lineLengthKm(points: Array<{ lat: number; lon: number }>) {
  let length = 0
  for (let i = 1; i < points.length; i += 1) {
    length += distanceKm({ ...points[i - 1], label: '' }, points[i])
  }
  return length
}

export function polygonAreaKm2(points: Array<{ lat: number; lon: number }>) {
  if (points.length < 3) return 0
  const origin = geometryCentroid(points)
  const cosLat = Math.cos(toRad(origin.lat))
  const xy = points.map((point) => ({
    x: toRad(point.lon - origin.lon) * EARTH_KM * cosLat,
    y: toRad(point.lat - origin.lat) * EARTH_KM,
  }))
  let area = 0
  for (let i = 0; i < xy.length; i += 1) {
    const next = xy[(i + 1) % xy.length]
    area += xy[i].x * next.y - next.x * xy[i].y
  }
  return Math.abs(area) / 2
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function toDeg(value: number) {
  return (value * 180) / Math.PI
}

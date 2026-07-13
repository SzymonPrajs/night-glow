import { EARTH_RADIUS_KM } from './constants'
import { clamp } from './atmosphere'
import type { Vector3 } from './types'

export type CurvedEarthGeometry = {
  observer: Vector3
  source: Vector3
  sourceUp: Vector3
  viewDirection: Vector3
  viewElevationRadians: number
  atmosphereExitKm: number
}

export function makeCurvedEarthGeometry(
  sourceDistanceKm: number,
  relativeAzimuthDeg: number,
  viewElevationDeg: number,
  observerAltitudeKm: number,
  sourceAltitudeKm: number,
  atmosphereTopKm: number,
): CurvedEarthGeometry {
  const distance = clamp(sourceDistanceKm, 0, Math.PI * EARTH_RADIUS_KM)
  const centralAngle = distance / EARTH_RADIUS_KM
  const observerRadius = EARTH_RADIUS_KM + observerAltitudeKm
  const sourceRadius = EARTH_RADIUS_KM + sourceAltitudeKm
  const elevation = degreesToRadians(clamp(viewElevationDeg, 0, 90))
  const azimuth = degreesToRadians(angularDistanceDegrees(relativeAzimuthDeg, 0))
  const observer: Vector3 = [observerRadius, 0, 0]
  const source: Vector3 = [
    sourceRadius * Math.cos(centralAngle),
    sourceRadius * Math.sin(centralAngle),
    0,
  ]
  const sourceUp = normalize(source)
  const viewDirection: Vector3 = normalize([
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
  ])
  return {
    observer,
    source,
    sourceUp,
    viewDirection,
    viewElevationRadians: elevation,
    atmosphereExitKm: distanceAlongRayToAltitude(observerAltitudeKm, elevation, atmosphereTopKm),
  }
}

/** Distance along an outward observer ray to a spherical altitude shell. */
export function distanceAlongRayToAltitude(observerAltitudeKm: number, elevationRadians: number, altitudeKm: number) {
  const observerRadius = EARTH_RADIUS_KM + observerAltitudeKm
  const targetRadius = EARTH_RADIUS_KM + Math.max(altitudeKm, observerAltitudeKm)
  const sine = Math.sin(elevationRadians)
  const cosine = Math.cos(elevationRadians)
  return Math.max(
    0,
    -observerRadius * sine +
      Math.sqrt(Math.max(0, targetRadius * targetRadius - observerRadius * observerRadius * cosine * cosine)),
  )
}

export function altitudeKm(point: Vector3) {
  return magnitude(point) - EARTH_RADIUS_KM
}

export function pointAlongRay(origin: Vector3, direction: Vector3, distanceKm: number): Vector3 {
  return [
    origin[0] + direction[0] * distanceKm,
    origin[1] + direction[1] * distanceKm,
    origin[2] + direction[2] * distanceKm,
  ]
}

export function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}

export function dot(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function magnitude(vector: Vector3) {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function normalize(vector: Vector3): Vector3 {
  const length = magnitude(vector)
  return length > 0 ? scale(vector, 1 / length) : [0, 0, 0]
}

export function angularDistanceDegrees(a: number, b: number) {
  const difference = ((a - b + 540) % 360) - 180
  return Math.abs(difference)
}

export function degreesToRadians(value: number) {
  return value * Math.PI / 180
}

/**
 * Fraction along a monotonically outward segment at which it crosses a radius.
 * The exact quadratic intersection keeps cloud-shell path lengths deterministic.
 */
export function outwardSegmentFractionAtRadius(start: Vector3, end: Vector3, radiusKm: number) {
  const startRadius = magnitude(start)
  const endRadius = magnitude(end)
  if (radiusKm <= startRadius) return 0
  if (radiusKm >= endRadius) return 1
  const direction = subtract(end, start)
  const a = dot(direction, direction)
  const b = 2 * dot(start, direction)
  const c = dot(start, start) - radiusKm * radiusKm
  const discriminant = Math.max(0, b * b - 4 * a * c)
  const root = (-b + Math.sqrt(discriminant)) / (2 * a)
  return clamp(root, 0, 1)
}

export function outwardSegmentLengthInAltitudeLayer(
  start: Vector3,
  end: Vector3,
  baseAltitudeKm: number,
  topAltitudeKm: number,
) {
  const length = magnitude(subtract(end, start))
  if (length <= 0 || topAltitudeKm <= baseAltitudeKm) return 0
  const startAltitude = altitudeKm(start)
  const endAltitude = altitudeKm(end)
  if (endAltitude <= baseAltitudeKm || startAltitude >= topAltitudeKm) return 0
  const startFraction = outwardSegmentFractionAtRadius(start, end, EARTH_RADIUS_KM + baseAltitudeKm)
  const endFraction = outwardSegmentFractionAtRadius(start, end, EARTH_RADIUS_KM + topAltitudeKm)
  return Math.max(0, endFraction - startFraction) * length
}

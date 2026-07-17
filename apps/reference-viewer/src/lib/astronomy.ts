import { Body, Equator, Horizon, Illumination, MoonPhase, Observer } from 'astronomy-engine'
import type { Location } from '../types'
import { angularDiameterDegrees } from './celestialLight'

export type HorizontalObject = {
  name: string
  azimuth: number
  altitude: number
  magnitude: number
  kind: 'planet' | 'moon' | 'sun'
  phase?: number
  phaseAngle?: number
  waxing?: boolean
  distanceAu?: number
  angularDiameter?: number
}

const PLANETS = [Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune]
const BODY_RADIUS_KM: Partial<Record<string, number>> = {
  [Body.Sun]: 695_700,
  [Body.Moon]: 1_737.4,
}

export function getSolarSystem(date: Date, location: Location): HorizontalObject[] {
  const observer = new Observer(location.lat, location.lon, 0)
  const bodies = [Body.Sun, Body.Moon, ...PLANETS]
  return bodies.map((body) => {
    const equatorial = Equator(body, date, observer, true, true)
    const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal')
    const illumination = Illumination(body, date)
    const radiusKm = BODY_RADIUS_KM[body]
    return {
      name: body,
      azimuth: horizontal.azimuth,
      altitude: horizontal.altitude,
      magnitude: illumination.mag,
      kind: body === Body.Sun ? 'sun' : body === Body.Moon ? 'moon' : 'planet',
      phase: illumination.phase_fraction,
      phaseAngle: illumination.phase_angle,
      waxing: body === Body.Moon ? MoonPhase(date) < 180 : undefined,
      distanceAu: equatorial.dist,
      angularDiameter: radiusKm ? angularDiameterDegrees(radiusKm, equatorial.dist) : undefined,
    }
  })
}

export function equatorialToHorizontal(raHours: number, decDegrees: number, date: Date, location: Location) {
  const horizontal = Horizon(date, new Observer(location.lat, location.lon, 0), raHours, decDegrees, 'normal')
  return { azimuth: horizontal.azimuth, altitude: horizontal.altitude }
}

export function horizontalVector(azimuth: number, altitude: number, radius = 100) {
  const az = (azimuth * Math.PI) / 180
  const alt = (altitude * Math.PI) / 180
  const horizontal = Math.cos(alt) * radius
  return {
    x: Math.sin(az) * horizontal,
    y: Math.sin(alt) * radius,
    z: Math.cos(az) * horizontal,
  }
}

export function galacticToEquatorial(longitude: number, latitude: number) {
  const l = (longitude * Math.PI) / 180
  const b = (latitude * Math.PI) / 180
  const gal = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]
  // Transpose of the standard IAU J2000 equatorial-to-galactic matrix.
  const matrix = [
    [-0.05487556, 0.49410943, -0.86766615],
    [-0.87343709, -0.44482963, -0.19807637],
    [-0.48383502, 0.74698224, 0.45598378],
  ]
  const x = matrix[0][0] * gal[0] + matrix[0][1] * gal[1] + matrix[0][2] * gal[2]
  const y = matrix[1][0] * gal[0] + matrix[1][1] * gal[1] + matrix[1][2] * gal[2]
  const z = matrix[2][0] * gal[0] + matrix[2][1] * gal[1] + matrix[2][2] * gal[2]
  const ra = ((Math.atan2(y, x) * 12) / Math.PI + 24) % 24
  const dec = (Math.asin(z) * 180) / Math.PI
  return { ra, dec }
}

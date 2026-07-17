import type { Atmosphere } from '../types'
import type { HorizontalObject } from './astronomy'
import { aerosolVerticalOpticalDepth, rayleighVerticalOpticalDepth } from './physics/atmosphere'

const FULL_MOON_REFERENCE_MAGNITUDE = -12.74
const KM_PER_AU = 149_597_870.7

// Clear-sky zenith luminance relative to a 21.92 mag/arcsec² natural night sky.
// The log-spaced anchors keep the civil/nautical/astronomical twilight transitions
// continuous while covering the roughly seven orders of magnitude into daylight.
const SOLAR_ZENITH_RATIO_ANCHORS = [
  [-18, 0],
  [-15, 0.25],
  [-12, 5],
  [-9, 45],
  [-6, 500],
  [-3, 5_000],
  [0, 40_000],
  [6, 400_000],
  [15, 2_000_000],
  [45, 8_000_000],
  [90, 12_000_000],
] as const

export function solarZenithLuminanceRatio(altitudeDeg: number) {
  const altitude = finiteClamp(altitudeDeg, -90, 90, -90)
  if (altitude <= SOLAR_ZENITH_RATIO_ANCHORS[0][0]) return 0
  for (let index = 1; index < SOLAR_ZENITH_RATIO_ANCHORS.length; index += 1) {
    const lower = SOLAR_ZENITH_RATIO_ANCHORS[index - 1]
    const upper = SOLAR_ZENITH_RATIO_ANCHORS[index]
    if (altitude > upper[0]) continue
    const mix = smoothstep((altitude - lower[0]) / (upper[0] - lower[0]))
    if (lower[1] === 0) return upper[1] * mix
    return Math.exp(Math.log(lower[1]) + (Math.log(upper[1]) - Math.log(lower[1])) * mix)
  }
  return SOLAR_ZENITH_RATIO_ANCHORS[SOLAR_ZENITH_RATIO_ANCHORS.length - 1][1]
}

/** Lunar illuminance relative to a mean high full Moon, including phase and distance. */
export function relativeMoonIlluminance(magnitude: number) {
  if (!Number.isFinite(magnitude)) return 0
  return finiteClamp(10 ** (-0.4 * (magnitude - FULL_MOON_REFERENCE_MAGNITUDE)), 0, 2, 0)
}

/**
 * Moonlight available to illuminate the sky, normalized to one for a high mean
 * full Moon. Astronomy Engine's magnitude supplies the nonlinear phase and
 * distance dependence; source altitude and clear-air extinction are applied here.
 */
export function moonSkyStrength(
  moon: Pick<HorizontalObject, 'magnitude' | 'altitude'> | undefined,
  atmosphere: Atmosphere,
) {
  if (!moon || moon.altitude <= -0.3) return 0
  const altitudeWeight = Math.max(0, Math.sin((Math.max(0, moon.altitude) * Math.PI) / 180)) ** 0.35
  const transmission = clearAirTransmissionRgb(moon.altitude, atmosphere)
  const zenithTransmission = clearAirTransmissionRgb(90, atmosphere)
  const relativeTransmission = visualLuminance(transmission) / Math.max(1e-6, visualLuminance(zenithTransmission))
  return relativeMoonIlluminance(moon.magnitude) * altitudeWeight * relativeTransmission
}

/** Approximate full-Moon contribution at zenith, relative to the natural sky. */
export function moonZenithLuminanceRatio(moonStrength: number) {
  return 30 * Math.max(0, Number.isFinite(moonStrength) ? moonStrength : 0)
}

export function clearAirTransmissionRgb(altitudeDeg: number, atmosphere: Atmosphere) {
  const airMass = relativeAirMass(altitudeDeg)
  const humidityGrowth = 1 + 2.4 * Math.max(0, atmosphere.humidity - 0.35) ** 2
  return [680, 550, 440].map((wavelengthNm) => {
    const rayleigh = rayleighVerticalOpticalDepth(wavelengthNm)
    const aerosol = aerosolVerticalOpticalDepth(
      wavelengthNm,
      Math.max(0, atmosphere.aerosol) * humidityGrowth,
      atmosphere.angstromExponent,
    )
    return Math.exp(-airMass * (rayleigh + aerosol))
  }) as [number, number, number]
}

/** World-space direction where x=east, y=up, z=north. */
export function horizontalUnitVector(azimuthDeg: number, altitudeDeg: number) {
  const azimuth = (azimuthDeg * Math.PI) / 180
  const altitude = (altitudeDeg * Math.PI) / 180
  const horizontal = Math.cos(altitude)
  return [
    Math.sin(azimuth) * horizontal,
    Math.sin(altitude),
    Math.cos(azimuth) * horizontal,
  ] as const
}

export function angularSeparationDegrees(
  first: Pick<HorizontalObject, 'azimuth' | 'altitude'>,
  second: Pick<HorizontalObject, 'azimuth' | 'altitude'>,
) {
  const a = horizontalUnitVector(first.azimuth, first.altitude)
  const b = horizontalUnitVector(second.azimuth, second.altitude)
  const cosine = finiteClamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1, 0)
  return (Math.acos(cosine) * 180) / Math.PI
}

/** Exact world-space sprite diameter for a requested apparent angular diameter. */
export function angularSpriteScale(angularDiameterDeg: number, radius: number) {
  const angle = finiteClamp(angularDiameterDeg, 0, 179, 0) * Math.PI / 180
  return 2 * Math.max(0, radius) * Math.tan(angle / 2)
}

/** Apparent full angular diameter of a spherical body at the supplied distance. */
export function angularDiameterDegrees(radiusKm: number, distanceAu: number) {
  if (!(radiusKm > 0) || !(distanceAu > 0)) return 0
  const angularRadius = Math.asin(Math.min(1, radiusKm / (distanceAu * KM_PER_AU)))
  return (2 * angularRadius * 180) / Math.PI
}

function relativeAirMass(altitude: number) {
  const safeAltitude = finiteClamp(altitude, 0.25, 90, 90)
  const sine = Math.sin((safeAltitude * Math.PI) / 180)
  return Math.min(20, Math.max(1, 1 / (sine + 0.50572 * (safeAltitude + 6.07995) ** -1.6364)))
}

function visualLuminance(rgb: readonly number[]) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

function smoothstep(value: number) {
  const mix = Math.max(0, Math.min(1, value))
  return mix * mix * (3 - 2 * mix)
}

function finiteClamp(value: number, minimum: number, maximum: number, fallback: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback))
}

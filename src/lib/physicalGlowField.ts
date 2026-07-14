import type { PhysicalGlowResult } from './physicalGlowProtocol'
import { STAR_CATALOG } from '../data/starCatalog'
import { equatorialToHorizontal } from './astronomy'
import { apparentStarMagnitude } from './starAppearance'
import { NATURAL_SKY_LUMINANCE } from './appearance'
import { solidAngleElevationWeights } from './physics'
import type { Atmosphere, Location, SkyMetrics } from '../types'

export type DirectionalGlowSample = {
  red: number
  green: number
  blue: number
  luminance: number
  limitingMagnitude: number
}

/** Bilinearly samples the worker's periodic azimuth / irregular elevation grid. */
export function samplePhysicalGlow(
  field: PhysicalGlowResult | undefined,
  azimuthDeg: number,
  elevationDeg: number,
): DirectionalGlowSample {
  if (!field || field.azimuthCount < 1 || field.elevationDeg.length < 1) return ZERO_SAMPLE
  const azimuth = normalizeDegrees(azimuthDeg - field.azimuthOffsetDeg) / 360 * field.azimuthCount
  const azimuth0 = Math.floor(azimuth) % field.azimuthCount
  const azimuth1 = (azimuth0 + 1) % field.azimuthCount
  const azimuthMix = azimuth - Math.floor(azimuth)
  const elevation = findElevationBracket(field.elevationDeg, elevationDeg)
  const rgb00 = rgbAt(field, elevation.lower, azimuth0)
  const rgb01 = rgbAt(field, elevation.lower, azimuth1)
  const rgb10 = rgbAt(field, elevation.upper, azimuth0)
  const rgb11 = rgbAt(field, elevation.upper, azimuth1)
  const red = bilinear(rgb00[0], rgb01[0], rgb10[0], rgb11[0], azimuthMix, elevation.mix)
  const green = bilinear(rgb00[1], rgb01[1], rgb10[1], rgb11[1], azimuthMix, elevation.mix)
  const blue = bilinear(rgb00[2], rgb01[2], rgb10[2], rgb11[2], azimuthMix, elevation.mix)
  const limit00 = scalarAt(field.directionalLimitingMagnitude, field.azimuthCount, elevation.lower, azimuth0)
  const limit01 = scalarAt(field.directionalLimitingMagnitude, field.azimuthCount, elevation.lower, azimuth1)
  const limit10 = scalarAt(field.directionalLimitingMagnitude, field.azimuthCount, elevation.upper, azimuth0)
  const limit11 = scalarAt(field.directionalLimitingMagnitude, field.azimuthCount, elevation.upper, azimuth1)
  return {
    red,
    green,
    blue,
    luminance: Math.max(0, red * 0.2126 + green * 0.7152 + blue * 0.0722),
    limitingMagnitude: bilinear(limit00, limit01, limit10, limit11, azimuthMix, elevation.mix),
  }
}

export function meanPhysicalGlow(field: PhysicalGlowResult | undefined) {
  if (!field?.rgbRadiance.length) return ZERO_SAMPLE
  let red = 0
  let green = 0
  let blue = 0
  let limitingMagnitude = 0
  const elevationWeights = solidAngleElevationWeights(field.elevationDeg)
  for (let elevation = 0; elevation < field.elevationDeg.length; elevation += 1) {
    const sampleWeight = elevationWeights[elevation] / field.azimuthCount
    for (let azimuth = 0; azimuth < field.azimuthCount; azimuth += 1) {
      const index = elevation * field.azimuthCount + azimuth
      red += finiteNonNegative(field.rgbRadiance[index * 3]) * sampleWeight
      green += finiteNonNegative(field.rgbRadiance[index * 3 + 1]) * sampleWeight
      blue += finiteNonNegative(field.rgbRadiance[index * 3 + 2]) * sampleWeight
      limitingMagnitude += finiteNonNegative(field.directionalLimitingMagnitude[index]) * sampleWeight
    }
  }
  return {
    red,
    green,
    blue,
    luminance: red * 0.2126 + green * 0.7152 + blue * 0.0722,
    limitingMagnitude,
  }
}

export function physicalZenithSample(field: PhysicalGlowResult | undefined) {
  if (!field || field.elevationDeg.length < 1) return ZERO_SAMPLE
  const elevationIndex = field.elevationDeg.length - 1
  let red = 0
  let green = 0
  let blue = 0
  let limitingMagnitude = 0
  for (let azimuth = 0; azimuth < field.azimuthCount; azimuth += 1) {
    const rgb = rgbAt(field, elevationIndex, azimuth)
    red += rgb[0]
    green += rgb[1]
    blue += rgb[2]
    limitingMagnitude += scalarAt(
      field.directionalLimitingMagnitude,
      field.azimuthCount,
      elevationIndex,
      azimuth,
    )
  }
  red /= field.azimuthCount
  green /= field.azimuthCount
  blue /= field.azimuthCount
  return {
    red,
    green,
    blue,
    luminance: red * 0.2126 + green * 0.7152 + blue * 0.0722,
    limitingMagnitude: limitingMagnitude / field.azimuthCount,
  }
}

export function calculatePhysicalSkyMetrics(
  field: PhysicalGlowResult | undefined,
  date: Date,
  location: Location,
  atmosphere: Atmosphere,
  sunAltitude = -30,
  moonLight = 0,
): SkyMetrics {
  const zenith = physicalZenithSample(field)
  const naturalLuminance = NATURAL_SKY_LUMINANCE
  const twilight = clamp((sunAltitude + 18) / 18, 0, 1)
  const brightnessRatio = 1 + zenith.luminance / naturalLuminance + twilight * 180 + moonLight * 8
  const zenithMag = clamp(21.92 - 2.5 * Math.log10(brightnessRatio), 14, 21.92)
  const lightPenalty = twilight * 5 + moonLight * 1.35
  const limitingMagnitude = clamp(zenith.limitingMagnitude - lightPenalty, 0, 7.15)
  let visibleStars = 0

  for (const star of STAR_CATALOG) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    if (horizontal.altitude <= 0) continue
    const localLimit = samplePhysicalGlow(field, horizontal.azimuth, horizontal.altitude).limitingMagnitude - lightPenalty
    if (apparentStarMagnitude(star, horizontal.altitude, atmosphere) <= localLimit) visibleStars += 1
  }

  return {
    zenithMag,
    limitingMagnitude,
    bortle: bortleFromSqm(zenithMag),
    glowIndex: clamp((21.92 - zenithMag) / 5.72 * 100, 0, 100),
    visibleStars,
  }
}

function rgbAt(field: PhysicalGlowResult, elevationIndex: number, azimuthIndex: number) {
  const start = (elevationIndex * field.azimuthCount + azimuthIndex) * 3
  return [
    finiteNonNegative(field.rgbRadiance[start]),
    finiteNonNegative(field.rgbRadiance[start + 1]),
    finiteNonNegative(field.rgbRadiance[start + 2]),
  ] as const
}

function scalarAt(values: Float32Array, width: number, row: number, column: number) {
  const value = values[row * width + column]
  return Number.isFinite(value) ? value : 0
}

function findElevationBracket(elevations: Float32Array, rawElevation: number) {
  const elevation = Number.isFinite(rawElevation) ? rawElevation : elevations[0]
  if (elevation <= elevations[0]) return { lower: 0, upper: 0, mix: 0 }
  const last = elevations.length - 1
  if (elevation >= elevations[last]) return { lower: last, upper: last, mix: 0 }
  let lower = 0
  let upper = last
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1
    if (elevations[middle] <= elevation) lower = middle
    else upper = middle
  }
  return {
    lower,
    upper,
    mix: (elevation - elevations[lower]) / (elevations[upper] - elevations[lower]),
  }
}

function bilinear(
  lower0: number,
  lower1: number,
  upper0: number,
  upper1: number,
  horizontal: number,
  vertical: number,
) {
  const lower = lower0 + (lower1 - lower0) * horizontal
  const upper = upper0 + (upper1 - upper0) * horizontal
  return lower + (upper - lower) * vertical
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

function bortleFromSqm(sqm: number) {
  if (sqm >= 21.76) return 1
  if (sqm >= 21.6) return 2
  if (sqm >= 21.3) return 3
  if (sqm >= 20.8) return 4
  if (sqm >= 20.3) return 5
  if (sqm >= 19.5) return 6
  if (sqm >= 18.7) return 7
  if (sqm >= 18) return 8
  return 9
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

const ZERO_SAMPLE: Readonly<DirectionalGlowSample> = Object.freeze({
  red: 0,
  green: 0,
  blue: 0,
  luminance: 0,
  limitingMagnitude: 7.15,
})

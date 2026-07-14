import type { PhysicalGlowResult } from './physicalGlowProtocol'
import type { AppearanceMode } from '../types'

export type AppearanceProfile = {
  rendererExposure: number
  milkyWayOpacity: number
  deepSkyOpacity: number
  planetOpacity: number
}

export const APPEARANCE_PROFILES: Record<AppearanceMode, AppearanceProfile> = {
  atlas: {
    rendererExposure: 1.1,
    milkyWayOpacity: 0.24,
    deepSkyOpacity: 1,
    planetOpacity: 1,
  },
  realistic: {
    rendererExposure: 0.82,
    milkyWayOpacity: 0.045,
    deepSkyOpacity: 0.16,
    planetOpacity: 0.62,
  },
}

/** Linear RGB used by the solver for a natural moonless sky. */
export const NATURAL_SKY_RGB = [0.0016, 0.002, 0.0032] as const
export const NATURAL_SKY_LUMINANCE = rgbLuminance(NATURAL_SKY_RGB)

/**
 * Relative visual response for an uncalibrated SDR display.
 *
 * The physical solver remains linear. Only the final presentation is compressed:
 * a natural sky maps to 0.0015 linear display luminance, and increasing sky
 * luminance follows a 0.42 power law that approximates dark/mesopic adaptation.
 */
export function realisticSkyDisplayLuminance(physicalLuminance: number) {
  const ratio = Math.max(1e-6, physicalLuminance / NATURAL_SKY_LUMINANCE)
  return Math.min(0.03, 0.0015 * ratio ** 0.42)
}

export function linearToSrgb(value: number) {
  const safe = Math.max(0, value)
  return safe <= 0.0031308 ? safe * 12.92 : 1.055 * safe ** (1 / 2.4) - 0.055
}

export function rgbLuminance(rgb: ArrayLike<number>) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/** Empirical visual threshold used only to fade realistic sprites near detection. */
export function realisticVisualLimit(zenithMag: number) {
  return Math.max(0, Math.min(7.15, 7.15 - 0.8 * (21.92 - zenithMag)))
}

/**
 * Convert the worker's spectral field to display-oriented linear RGB while
 * preserving its luminance. The worker RGB remains canonical for metrics and
 * Atlas mode; this cached conversion is presentation-only.
 */
export function realisticGlowRgb(field: PhysicalGlowResult) {
  const cached = realisticGlowCache.get(field)
  if (cached) return cached

  const sampleCount = field.rgbRadiance.length / 3
  const bandCount = field.wavelengthsNm.length
  const converted = new Float32Array(field.rgbRadiance.length)
  const matrix = Array.from(field.wavelengthsNm, cieLinearRgb)

  for (let sample = 0; sample < sampleCount; sample += 1) {
    let red = 0
    let green = 0
    let blue = 0
    for (let band = 0; band < bandCount; band += 1) {
      const radiance = finiteNonNegative(field.spectralRadiance[sample * bandCount + band])
      red += radiance * matrix[band][0]
      green += radiance * matrix[band][1]
      blue += radiance * matrix[band][2]
    }

    const destination = sample * 3
    const targetY = rgbLuminance([
      finiteNonNegative(field.rgbRadiance[destination]),
      finiteNonNegative(field.rgbRadiance[destination + 1]),
      finiteNonNegative(field.rgbRadiance[destination + 2]),
    ])
    const sourceY = rgbLuminance([red, green, blue])
    if (!(targetY > 0) || !(sourceY > 0)) continue

    red *= targetY / sourceY
    green *= targetY / sourceY
    blue *= targetY / sourceY
    const safeChroma = gamutSafeChroma([red, green, blue], targetY)
    converted[destination] = targetY + (red - targetY) * safeChroma
    converted[destination + 1] = targetY + (green - targetY) * safeChroma
    converted[destination + 2] = targetY + (blue - targetY) * safeChroma
  }

  realisticGlowCache.set(field, converted)
  return converted
}

const realisticGlowCache = new WeakMap<PhysicalGlowResult, Float32Array>()

// CIE 1931 2-degree colour-matching samples at the solver's eight wavelengths.
// Values between tabulated 5 nm rows are linearly interpolated.
function cieLinearRgb(wavelength: number) {
  const [x, y, z] = cieXyz(wavelength)
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ] as const
}

function cieXyz(wavelength: number) {
  const table = CIE_1931_SAMPLES
  if (wavelength <= table[0][0]) return table[0].slice(1) as [number, number, number]
  for (let index = 1; index < table.length; index += 1) {
    if (wavelength > table[index][0]) continue
    const lower = table[index - 1]
    const upper = table[index]
    const mix = (wavelength - lower[0]) / (upper[0] - lower[0])
    return [
      lower[1] + (upper[1] - lower[1]) * mix,
      lower[2] + (upper[2] - lower[2]) * mix,
      lower[3] + (upper[3] - lower[3]) * mix,
    ] as const
  }
  return table[table.length - 1].slice(1) as [number, number, number]
}

function gamutSafeChroma(rgb: readonly number[], luminance: number) {
  let chroma = 1
  for (const channel of rgb) {
    if (channel < 0) chroma = Math.min(chroma, luminance / Math.max(1e-9, luminance - channel))
  }
  return Math.max(0, Math.min(1, chroma * 0.98))
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

const CIE_1931_SAMPLES = [
  [420, 0.13438, 0.004, 0.6456],
  [450, 0.3362, 0.038, 0.77211],
  [480, 0.09564, 0.13902, 0.81295],
  [510, 0.0093, 0.503, 0.1582],
  [550, 0.43345, 0.99495, 0.00875],
  [585, 0.9786, 0.8163, 0.0014],
  [590, 1.0263, 0.757, 0.0011],
  [625, 0.7514, 0.321, 0.0001],
  [680, 0.04677, 0.017, 0],
] as const

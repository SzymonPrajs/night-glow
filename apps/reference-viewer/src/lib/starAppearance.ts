import * as THREE from 'three'
import type { CatalogStar } from '../data/starCatalog'
import type { Atmosphere, SeeingConditions } from '../types'
import { interpolateAppearanceValue, normalizeEnhancement } from './appearance'
import { DEFAULT_SEEING_CONDITIONS, seeingPsf, type SeeingPsf } from './seeing'
import { clamp } from './skyModel'

export type StarVisualEndpoint = {
  /** Linear-light display colour; unitless RGB components. */
  color: THREE.Color
  /** Diameter of the point sprite in CSS pixels. */
  spriteSizeCssPixels: number
  /** Presentation signal before the shared physical visibility fade. */
  signal: number
  /** Gaussian core sigma in CSS pixels. */
  coreSigmaCssPixels: number
  /** Gaussian halo sigma in CSS pixels. */
  haloSigmaCssPixels: number
  haloStrength: number
}

export type RealisticStarVisual = StarVisualEndpoint & {
  /** Chromatic displacement from green to either outer channel, in arcseconds. */
  dispersionArcseconds: number
}

export type EnhancedStarVisual = StarVisualEndpoint & {
  /** Chromatic displacement from green to either outer channel, in CSS pixels. */
  dispersionCssPixels: number
}

export type StarAppearance = {
  /** Extinguished apparent visual magnitude shared by every presentation value. */
  apparentMagnitude: number
  /** Integrated stellar signal; seeing redistributes it without changing it. */
  physicalFlux: number
  /** Angular atmospheric PSF shared by every presentation value. */
  psf: SeeingPsf
  /** Physical detection fade shared by every presentation value. */
  visibility: number
  realistic: RealisticStarVisual
  enhanced: EnhancedStarVisual
}

export type StarVisualCssPixels = StarVisualEndpoint & {
  dispersionCssPixels: number
}

export type StarAppearanceCssEndpoints = {
  realistic: StarVisualCssPixels
  enhanced: StarVisualCssPixels
}

export type InterpolatedStarAppearance = StarVisualCssPixels & {
  apparentMagnitude: number
  visibility: number
}

export function starAppearance(
  star: CatalogStar,
  altitude: number,
  limitingMagnitude: number,
  atmosphere: Atmosphere,
  seeing: SeeingConditions = DEFAULT_SEEING_CONDITIONS,
): StarAppearance {
  const apparentMagnitude = apparentStarMagnitude(star, altitude, atmosphere)
  const visibility = starVisibility(apparentMagnitude, limitingMagnitude)
  const airMass = relativeAirMass(altitude)
  const extraColumn = Math.max(0, airMass - 1)

  return {
    apparentMagnitude,
    physicalFlux: realisticStarPeak(apparentMagnitude),
    psf: seeingPsf(seeing, altitude),
    visibility,
    realistic: realisticStarAppearance(
      star,
      altitude,
      atmosphere,
      apparentMagnitude,
      extraColumn,
    ),
    enhanced: enhancedStarAppearance(
      star,
      atmosphere,
      apparentMagnitude,
      airMass,
      extraColumn,
    ),
  }
}

function enhancedStarAppearance(
  star: CatalogStar,
  atmosphere: Atmosphere,
  apparentMagnitude: number,
  airMass: number,
  extraColumn: number,
): EnhancedStarVisual {
  const flux = 10 ** (-0.4 * apparentMagnitude)
  const brightnessScale = clamp(flux ** 0.2, 0.22, 1.6)
  const seeing = 0.75 + atmosphere.aerosol * 0.65 + atmosphere.humidity * 0.35 + atmosphere.cloud * 0.55
  const coreDiameter = clamp(
    (1 + brightnessScale * 1.75) * Math.sqrt(seeing) * airMass ** 0.12,
    1.15,
    7.5,
  )
  const haloStrength = clamp(
    0.035 + atmosphere.aerosol * 0.18 + atmosphere.humidity * 0.1 + atmosphere.cloud * 0.26 + extraColumn * 0.008,
    0.03,
    0.55,
  )
  const spriteSizeCssPixels = clamp(
    coreDiameter * (2.2 + haloStrength * 5) + brightnessScale * 1.5,
    3.5,
    30,
  )
  const haloWidth = 0.27 + atmosphere.aerosol * 0.08 + atmosphere.humidity * 0.05 + atmosphere.cloud * 0.06
  const dispersionCssPixels = clamp(
    extraColumn * (0.035 + atmosphere.aerosol * 0.035 + atmosphere.humidity * 0.02),
    0,
    1.7,
  )

  return {
    color: enhancedObservedStarColor(star.bv, star.spectralType, extraColumn, atmosphere),
    spriteSizeCssPixels,
    signal: enhancedStarSignal(apparentMagnitude),
    coreSigmaCssPixels: 0.849 * coreDiameter / 2,
    haloSigmaCssPixels: haloWidth * spriteSizeCssPixels / 2,
    haloStrength,
    dispersionCssPixels,
  }
}

function realisticStarAppearance(
  star: CatalogStar,
  altitude: number,
  atmosphere: Atmosphere,
  apparentMagnitude: number,
  extraColumn: number,
): RealisticStarVisual {
  const peakIntensity = realisticStarPeak(apparentMagnitude)

  // At a wide naked-eye field the displayed core is sampling-limited. Seeing
  // redistributes a small fraction into a halo rather than making every star a disc.
  const coreFwhm = clamp(
    0.92 + atmosphere.aerosol * 0.04 + atmosphere.humidity * 0.025 + Math.sqrt(extraColumn) * 0.055,
    0.9,
    1.32,
  )
  const haloEnergy = clamp(
    0.015 + atmosphere.aerosol * 0.06 + atmosphere.humidity * 0.025 + atmosphere.cloud * 0.05,
    0.015,
    0.1,
  )
  const coreSigmaCssPixels = coreFwhm / 2.355
  const haloSigmaCssPixels = clamp(
    0.78 + atmosphere.aerosol * 0.22 + atmosphere.humidity * 0.12,
    0.78,
    1.15,
  )
  const spriteSizeCssPixels = clamp(
    2.85 + haloEnergy * 7 + Math.sqrt(extraColumn) * 0.045,
    2.85,
    4.2,
  )
  const haloStrength = haloEnergy / (1 - haloEnergy) *
    (coreSigmaCssPixels / haloSigmaCssPixels) ** 2
  const psfIntegral = 2 * Math.PI * coreSigmaCssPixels ** 2 / (1 - haloEnergy)

  return {
    color: realisticObservedStarColor(
      star.bv,
      star.spectralType,
      extraColumn,
      atmosphere,
      apparentMagnitude,
    ),
    spriteSizeCssPixels,
    signal: peakIntensity / psfIntegral,
    coreSigmaCssPixels,
    haloSigmaCssPixels,
    haloStrength,
    dispersionArcseconds: realisticDispersionArcsec(altitude),
  }
}

/**
 * Converts both endpoint dispersions to CSS pixels before interpolation. This
 * keeps angular Realistic dispersion camera-aware while Enhanced remains a
 * screen-space presentation effect.
 */
export function starAppearanceCssEndpoints(
  appearance: StarAppearance,
  cssPixelsPerArcsecond: number,
): StarAppearanceCssEndpoints {
  return {
    realistic: {
      ...sanitizeVisualEndpoint(appearance.realistic),
      dispersionCssPixels: dispersionArcsecondsToCssPixels(
        appearance.realistic.dispersionArcseconds,
        cssPixelsPerArcsecond,
      ),
    },
    enhanced: {
      ...sanitizeVisualEndpoint(appearance.enhanced),
      dispersionCssPixels: finiteClamp(appearance.enhanced.dispersionCssPixels, 0, 1.7, 0),
    },
  }
}

export function interpolateStarVisual(
  realistic: StarVisualCssPixels,
  enhanced: StarVisualCssPixels,
  enhancement: number,
): StarVisualCssPixels {
  const mix = normalizeEnhancement(enhancement)
  const realisticVisual = sanitizeCssVisual(realistic)
  const enhancedVisual = sanitizeCssVisual(enhanced, realisticVisual)

  return {
    color: new THREE.Color(
      interpolateAppearanceValue(realisticVisual.color.r, enhancedVisual.color.r, mix),
      interpolateAppearanceValue(realisticVisual.color.g, enhancedVisual.color.g, mix),
      interpolateAppearanceValue(realisticVisual.color.b, enhancedVisual.color.b, mix),
    ),
    spriteSizeCssPixels: interpolateAppearanceValue(
      realisticVisual.spriteSizeCssPixels,
      enhancedVisual.spriteSizeCssPixels,
      mix,
    ),
    signal: interpolateAppearanceValue(realisticVisual.signal, enhancedVisual.signal, mix),
    coreSigmaCssPixels: interpolateAppearanceValue(
      realisticVisual.coreSigmaCssPixels,
      enhancedVisual.coreSigmaCssPixels,
      mix,
    ),
    haloSigmaCssPixels: interpolateAppearanceValue(
      realisticVisual.haloSigmaCssPixels,
      enhancedVisual.haloSigmaCssPixels,
      mix,
    ),
    haloStrength: interpolateAppearanceValue(
      realisticVisual.haloStrength,
      enhancedVisual.haloStrength,
      mix,
    ),
    dispersionCssPixels: interpolateAppearanceValue(
      realisticVisual.dispersionCssPixels,
      enhancedVisual.dispersionCssPixels,
      mix,
    ),
  }
}

export function interpolateStarAppearance(
  appearance: StarAppearance,
  enhancement: number,
  cssPixelsPerArcsecond: number,
): InterpolatedStarAppearance {
  const endpoints = starAppearanceCssEndpoints(appearance, cssPixelsPerArcsecond)
  return {
    apparentMagnitude: finiteNumber(appearance.apparentMagnitude, 0),
    visibility: finiteClamp(appearance.visibility, 0, 1, 0),
    ...interpolateStarVisual(endpoints.realistic, endpoints.enhanced, enhancement),
  }
}

export function apparentStarMagnitude(star: Pick<CatalogStar, 'mag'>, altitude: number, atmosphere: Atmosphere) {
  const extraColumn = Math.max(0, relativeAirMass(altitude) - 1)
  const extinctionPerAirMass = 0.075 + atmosphere.aerosol * 0.24 + atmosphere.humidity * 0.1
  return star.mag
    + clamp(extraColumn * extinctionPerAirMass, 0, 3.5)
    + directCloudExtinction(altitude, atmosphere)
}

/**
 * Mean direct transmission through an unresolved, randomly covered cloud field.
 * Clear sightlines carry (1-C) of the flux while cloudy sightlines carry
 * C exp(-tau X). This attenuates celestial objects without modifying the
 * separately solved artificial-light glow field.
 */
export function directCloudTransmission(
  altitude: number,
  atmosphere: Pick<Atmosphere, 'cloud' | 'cloudOpticalDepth'>,
) {
  const coverage = finiteClamp(atmosphere.cloud, 0, 1, 0)
  const opticalDepth = finiteClamp(atmosphere.cloudOpticalDepth, 0, 100, 0)
  const cloudyTransmission = Math.exp(-opticalDepth * relativeAirMass(altitude))
  return clamp((1 - coverage) + coverage * cloudyTransmission, 0, 1)
}

export function directCloudExtinction(
  altitude: number,
  atmosphere: Pick<Atmosphere, 'cloud' | 'cloudOpticalDepth'>,
) {
  return -2.5 * Math.log10(Math.max(directCloudTransmission(altitude, atmosphere), 1e-12))
}

export function cloudAdjustedLimitingMagnitude(
  backgroundLimitingMagnitude: number,
  altitude: number,
  atmosphere: Pick<Atmosphere, 'cloud' | 'cloudOpticalDepth'>,
) {
  const backgroundLimit = Number.isFinite(backgroundLimitingMagnitude) ? backgroundLimitingMagnitude : 0
  return backgroundLimit - directCloudExtinction(altitude, atmosphere)
}

/** Shared physical selection/fade used by every presentation value. */
export function starVisibility(apparentMagnitude: number, limitingMagnitude: number) {
  return clamp((limitingMagnitude - apparentMagnitude + 0.32) / 0.68, 0, 1)
}

function observedStarBaseColor(
  bv: number | null,
  spectralType: string,
  extraAirMass: number,
  atmosphere: Atmosphere,
) {
  const intrinsicBv = bv ?? spectralTypeBv(spectralType)
  const color = blackbodyColor(bvTemperature(intrinsicBv))
  const column = clamp(
    extraAirMass * (0.025 + atmosphere.aerosol * 0.15 + atmosphere.humidity * 0.07),
    0,
    1.6,
  )
  const originalPeak = Math.max(color.r, color.g, color.b)
  color.r *= Math.exp(-0.45 * column)
  color.g *= Math.exp(-0.72 * column)
  color.b *= Math.exp(-1.35 * column)
  return { color, originalPeak }
}

function realisticObservedStarColor(
  bv: number | null,
  spectralType: string,
  extraAirMass: number,
  atmosphere: Atmosphere,
  apparentMagnitude: number,
) {
  const { color } = observedStarBaseColor(bv, spectralType, extraAirMass, atmosphere)
  const saturation = 0.04 + 0.3 * (1 - smoothstep(-1, 3, apparentMagnitude))
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  color.r = luminance + (color.r - luminance) * saturation
  color.g = luminance + (color.g - luminance) * saturation
  color.b = luminance + (color.b - luminance) * saturation
  const observedLuminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  if (observedLuminance > 0) color.multiplyScalar(1 / observedLuminance)
  return color
}

function enhancedObservedStarColor(
  bv: number | null,
  spectralType: string,
  extraAirMass: number,
  atmosphere: Atmosphere,
) {
  const { color, originalPeak } = observedStarBaseColor(bv, spectralType, extraAirMass, atmosphere)
  const observedPeak = Math.max(color.r, color.g, color.b)
  if (observedPeak > 0) color.multiplyScalar(originalPeak / observedPeak)
  return color
}

export function realisticStarPeak(apparentMagnitude: number) {
  return 0.35 * 10 ** (-0.4 * apparentMagnitude)
}

/** A monotonic, compressed version of stellar flux for the Enhanced endpoint. */
export function enhancedStarSignal(apparentMagnitude: number) {
  const magnitude = finiteNumber(apparentMagnitude, 0)
  const compressedFlux = clamp(10 ** (-0.08 * magnitude), 0.22, 1.6)
  const legacyOpacity = clamp(1.08 - magnitude * 0.025, 0.68, 1)
  return compressedFlux * legacyOpacity
}

export function realisticDispersionPixels(altitude: number) {
  return dispersionArcsecondsToCssPixels(realisticDispersionArcsec(altitude), 0.0036)
}

export function dispersionArcsecondsToCssPixels(
  dispersionArcseconds: number,
  cssPixelsPerArcsecond: number,
) {
  const arcseconds = Math.max(0, finiteNumber(dispersionArcseconds, 0))
  const scale = Math.max(0, finiteNumber(cssPixelsPerArcsecond, 0))
  return clamp(arcseconds * scale, 0, 0.35)
}

export function realisticDispersionArcsec(altitude: number) {
  const safeAltitude = clamp(finiteNumber(altitude, 90), 0.5, 90)
  return Math.max(0, 1.2 / Math.tan((safeAltitude * Math.PI) / 180))
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const mix = clamp((value - minimum) / (maximum - minimum), 0, 1)
  return mix * mix * (3 - 2 * mix)
}

export function relativeAirMass(altitude: number) {
  const safeAltitude = clamp(Number.isFinite(altitude) ? altitude : 90, 0.25, 90)
  const sine = Math.sin((safeAltitude * Math.PI) / 180)
  return clamp(1 / (sine + 0.50572 * (safeAltitude + 6.07995) ** -1.6364), 1, 20)
}

function sanitizeVisualEndpoint(
  visual: StarVisualEndpoint,
  fallback?: StarVisualEndpoint,
): StarVisualEndpoint {
  const fallbackColor = fallback?.color ?? new THREE.Color(0, 0, 0)
  return {
    color: new THREE.Color(
      finiteNumber(visual.color.r, fallbackColor.r),
      finiteNumber(visual.color.g, fallbackColor.g),
      finiteNumber(visual.color.b, fallbackColor.b),
    ),
    spriteSizeCssPixels: finiteNonNegative(
      visual.spriteSizeCssPixels,
      fallback?.spriteSizeCssPixels ?? 0,
    ),
    signal: finiteNonNegative(visual.signal, fallback?.signal ?? 0),
    coreSigmaCssPixels: finiteNonNegative(
      visual.coreSigmaCssPixels,
      fallback?.coreSigmaCssPixels ?? 0,
    ),
    haloSigmaCssPixels: finiteNonNegative(
      visual.haloSigmaCssPixels,
      fallback?.haloSigmaCssPixels ?? 0,
    ),
    haloStrength: finiteNonNegative(visual.haloStrength, fallback?.haloStrength ?? 0),
  }
}

function sanitizeCssVisual(
  visual: StarVisualCssPixels,
  fallback?: StarVisualCssPixels,
): StarVisualCssPixels {
  return {
    ...sanitizeVisualEndpoint(visual, fallback),
    dispersionCssPixels: finiteNonNegative(
      visual.dispersionCssPixels,
      fallback?.dispersionCssPixels ?? 0,
    ),
  }
}

function finiteClamp(value: number, minimum: number, maximum: number, fallback: number) {
  return clamp(Number.isFinite(value) ? value : fallback, minimum, maximum)
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback
}

function finiteNonNegative(value: number, fallback: number) {
  return Math.max(0, finiteNumber(value, fallback))
}

function spectralTypeBv(spectralType: string) {
  const type = spectralType.toUpperCase().match(/[OBAFGKM]/)?.[0]
  return ({ O: -0.32, B: -0.2, A: 0.13, F: 0.42, G: 0.65, K: 1.05, M: 1.55 } as Record<string, number>)[type ?? 'G']
}

function bvTemperature(bv: number) {
  const colorIndex = clamp(bv, -0.4, 2)
  return clamp(4600 * (1 / (0.92 * colorIndex + 1.7) + 1 / (0.92 * colorIndex + 0.62)), 2200, 30000)
}

function blackbodyColor(kelvin: number) {
  const temperature = kelvin / 100
  const red = temperature <= 66 ? 255 : 329.698727446 * (temperature - 60) ** -0.1332047592
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(temperature) - 161.1195681661
    : 288.1221695283 * (temperature - 60) ** -0.0755148492
  const blue = temperature >= 66
    ? 255
    : temperature <= 19
      ? 0
      : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  return new THREE.Color().setRGB(
    clamp(red, 0, 255) / 255,
    clamp(green, 0, 255) / 255,
    clamp(blue, 0, 255) / 255,
    THREE.SRGBColorSpace,
  )
}

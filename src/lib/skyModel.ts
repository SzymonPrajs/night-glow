import type { Atmosphere, LightSource, SkyMetrics } from '../types'

export function calculateSkyMetrics(
  sources: LightSource[],
  atmosphere: Atmosphere,
  sunAltitude = -30,
  moonLight = 0,
): SkyMetrics {
  const directGlow = sources.reduce((sum, source) => {
    const distanceFalloff = Math.pow(source.distanceKm + 1.8, 1.28)
    return sum + source.flux / distanceFalloff
  }, 0)
  const scattering = 0.5 + atmosphere.aerosol * 0.95 + atmosphere.humidity * 0.5
  const cloudBounce = 1 + atmosphere.cloud * (1.05 - atmosphere.cloudBase * 0.065) * 1.6
  const artificialGlow = Math.log1p(directGlow * 0.28) * 24 * scattering * cloudBounce
  const twilight = clamp((sunAltitude + 18) / 18, 0, 1)
  const glowIndex = clamp(artificialGlow + twilight * 100 + moonLight * 18, 0, 100)
  const zenithMag = clamp(21.92 - 5.05 * Math.pow(glowIndex / 100, 0.78), 16.2, 21.92)
  const limitingMagnitude = clamp(
    7.15 - glowIndex * 0.045 - atmosphere.cloud * 2.45 - atmosphere.humidity * 0.22 - twilight * 2.1,
    0.7,
    7.15,
  )
  const visibleStars = Math.round(clamp(11 * Math.pow(2, 1.05 * (limitingMagnitude + 1)), 18, 4700))
  return {
    zenithMag,
    limitingMagnitude,
    bortle: bortleFromSqm(zenithMag),
    glowIndex,
    visibleStars,
  }
}

export function sourceGlowStrength(source: LightSource, atmosphere: Atmosphere) {
  const spread = 0.6 + atmosphere.aerosol * 1.4 + atmosphere.humidity * 0.85
  const cloudBoost = 1 + atmosphere.cloud * (1.2 - atmosphere.cloudBase * 0.07) * 1.8
  return clamp((source.flux / Math.pow(source.distanceKm + 1.5, 1.15)) * spread * cloudBoost, 0, 80)
}

export type HorizonRadianceField = {
  values: number[]
  integratedRadiance: number
  peakRadiance: number
}

/**
 * Integrates every extended emitter into a continuous angular radiance field.
 * Each source is a uniform-width core convolved with an atmospheric edge halo;
 * normalizing the kernel preserves total light as the apparent width changes.
 */
export function buildHorizonRadiance(
  sources: LightSource[],
  atmosphere: Atmosphere,
  sampleCount = 180,
): HorizonRadianceField {
  const values = Array.from({ length: sampleCount }, () => 0)
  const binWidthRadians = (Math.PI * 2) / sampleCount
  const binWidthDegrees = 360 / sampleCount
  const atmosphericBlur = 1.2 + atmosphere.aerosol * 6 + atmosphere.humidity * 3 +
    atmosphere.cloud * Math.max(0.25, 1.05 - atmosphere.cloudBase * 0.065) * 6
  let integratedRadiance = 0

  for (const source of sources) {
    const strength = sourceGlowStrength(source, atmosphere)
    if (strength < 0.015) continue
    const halfWidth = sourceAngularHalfWidth(source)
    const weights = values.map((_, index) => {
      const bearing = (index / sampleCount) * 360
      const delta = angularDistance(bearing, source.bearing)
      if (halfWidth >= 179.9) return 1
      return 1 - smoothstep(
        Math.max(0, halfWidth - binWidthDegrees * 0.5),
        halfWidth + binWidthDegrees * 0.5,
        delta,
      )
    })
    const angularIntegral = weights.reduce((sum, weight) => sum + weight * binWidthRadians, 0)
    if (angularIntegral <= 0) continue
    weights.forEach((weight, index) => {
      values[index] += (strength * weight) / angularIntegral
    })
    integratedRadiance += strength
  }

  const smoothedValues = circularGaussianBlur(values, atmosphericBlur / binWidthDegrees)
  return {
    values: smoothedValues,
    integratedRadiance,
    peakRadiance: smoothedValues.reduce((peak, value) => Math.max(peak, value), 0),
  }
}

export function sourceAngularHalfWidth(source: LightSource) {
  const radiusKm = source.areaKm2
    ? Math.sqrt(source.areaKm2 / Math.PI)
    : source.lengthKm
      ? Math.max(0.08, source.lengthKm * 0.28)
      : 0.35 + Math.sqrt(source.flux) * 0.18
  const minimumWidth = source.category === 'place' ? 1.2 : source.category === 'built' ? 0.55 : 0.3
  if (source.distanceKm <= radiusKm) return 180
  const projected = (Math.asin(clamp(radiusKm / source.distanceKm, 0, 1)) * 180) / Math.PI
  return clamp(Math.max(projected, minimumWidth), minimumWidth, 180)
}

function bortleFromSqm(sqm: number) {
  if (sqm >= 21.76) return 1
  if (sqm >= 21.6) return 2
  if (sqm >= 21.3) return 3
  if (sqm >= 20.8) return 4
  if (sqm >= 20.3) return 5
  if (sqm >= 19.5) return 6
  if (sqm >= 18.7) return 7
  if (sqm >= 18.0) return 8
  return 9
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function angularDistance(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return x * x * (3 - 2 * x)
}

function circularGaussianBlur(values: number[], sigmaBins: number) {
  if (sigmaBins < 0.15) return values
  const radius = Math.max(1, Math.ceil(sigmaBins * 3))
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const offset = index - radius
    return Math.exp(-0.5 * Math.pow(offset / sigmaBins, 2))
  })
  const kernelSum = kernel.reduce((sum, value) => sum + value, 0)
  return values.map((_, index) => kernel.reduce((sum, weight, kernelIndex) => {
    const offset = kernelIndex - radius
    const wrappedIndex = (index + offset + values.length) % values.length
    return sum + values[wrappedIndex] * weight
  }, 0) / kernelSum)
}

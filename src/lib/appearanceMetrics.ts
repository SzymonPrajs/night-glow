import { STAR_CATALOG } from '../data/starCatalog'
import type { AppearanceMode, Atmosphere, Location, SkyMetrics } from '../types'
import { equatorialToHorizontal } from './astronomy'
import { realisticVisualLimit } from './appearance'
import { physicalZenithSample, samplePhysicalGlow } from './physicalGlowField'
import type { PhysicalGlowResult } from './physicalGlowProtocol'
import { apparentStarMagnitude } from './starAppearance'

/**
 * Metrics shown to the observer must describe the selected visual response.
 * This never feeds the worker: Atlas keeps the solver's legacy threshold,
 * while Realistic applies its empirically stricter low-light detection limit.
 */
export function appearanceMetrics(
  mode: AppearanceMode,
  metrics: SkyMetrics,
  field: PhysicalGlowResult | undefined,
  date: Date,
  location: Location,
  atmosphere: Atmosphere,
): SkyMetrics {
  if (mode === 'atlas') return metrics

  const limitingMagnitude = Math.min(metrics.limitingMagnitude, realisticVisualLimit(metrics.zenithMag))
  const physicalZenithLimit = physicalZenithSample(field).limitingMagnitude
  const globalPenalty = Math.max(0, physicalZenithLimit - metrics.limitingMagnitude)
  let visibleStars = 0

  for (const star of STAR_CATALOG) {
    const horizontal = equatorialToHorizontal(star.ra, star.dec, date, location)
    if (horizontal.altitude <= 0) continue
    const directionalLimit = field
      ? samplePhysicalGlow(field, horizontal.azimuth, horizontal.altitude).limitingMagnitude - globalPenalty
      : metrics.limitingMagnitude
    const effectiveLimit = Math.min(directionalLimit, limitingMagnitude)
    if (apparentStarMagnitude(star, horizontal.altitude, atmosphere) <= effectiveLimit) visibleStars += 1
  }

  return { ...metrics, limitingMagnitude, visibleStars }
}

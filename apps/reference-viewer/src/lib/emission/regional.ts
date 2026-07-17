import { REGIONAL_SETTLEMENT_FOOTPRINTS } from '../../data/regionalSettlementFootprints'
import { normalizedSpectralFlux } from './spectrum'
import type { EllipseEmissionSource } from './types'

/** A broad sodium/white-LED proxy. It is a fallback, not a measured lamp inventory. */
export const CENTRAL_EUROPE_MIXED_LIGHT_PROFILE = [0.055, 0.09, 0.115, 0.145, 0.17, 0.21, 0.13, 0.085] as const

export type SettlementProxyCalibration = {
  /** Relative contributions to the proxy's equivalent lit area; these must sum to one. */
  builtAreaFraction: number
  populationFraction: number
  /** Converts the population proxy into the same square-kilometre basis as built area. */
  referencePopulationDensityPerKm2: number
  /** Global upward-flux scale per equivalent lit km² at the reference settlement size. */
  fluxPerEquivalentLitKm2: number
  /** Super-linear settlement-size response fitted to central-Poland zenith SQM anchors. */
  urbanSizeExponent: number
  /** Equivalent lit area at which the global flux scale applies without a size correction. */
  referenceEquivalentLitAreaKm2: number
}

export const DEFAULT_SETTLEMENT_PROXY_CALIBRATION: SettlementProxyCalibration = {
  builtAreaFraction: 0.72,
  populationFraction: 0.28,
  referencePopulationDensityPerKm2: 3200,
  fluxPerEquivalentLitKm2: 11.5,
  urbanSizeExponent: 1.3,
  referenceEquivalentLitAreaKm2: 100,
}

export function createRegionalSettlementSources(
  calibration: SettlementProxyCalibration = DEFAULT_SETTLEMENT_PROXY_CALIBRATION,
): EllipseEmissionSource[] {
  validateCalibration(calibration)
  return REGIONAL_SETTLEMENT_FOOTPRINTS.map((settlement) => {
    const populationEquivalentArea = settlement.populationProxy /
      calibration.referencePopulationDensityPerKm2
    const equivalentLitArea =
      calibration.builtAreaFraction * settlement.builtAreaProxyKm2 +
      calibration.populationFraction * populationEquivalentArea
    const settlementSizeScale = (
      equivalentLitArea / calibration.referenceEquivalentLitAreaKm2
    ) ** (calibration.urbanSizeExponent - 1)
    const totalFlux = equivalentLitArea * settlementSizeScale *
      settlement.lightingIntensity * calibration.fluxPerEquivalentLitKm2
    return {
      id: `regional-${settlement.id}`,
      name: settlement.name,
      component: 'settlement-proxy',
      coverageId: `settlement:${settlement.id}`,
      evidence: 'built-population-proxy',
      spectralFlux: normalizedSpectralFlux(totalFlux, CENTRAL_EUROPE_MIXED_LIGHT_PROFILE),
      provenance: 'Bundled regional fallback footprint with a central-Poland SQM-calibrated size law; measured radiance should supersede this coverageId.',
      geometry: 'ellipse',
      center: settlement.center,
      semiMajorKm: settlement.semiMajorKm,
      semiMinorKm: settlement.semiMinorKm,
      rotationDeg: settlement.rotationDeg,
    }
  })
}

function validateCalibration(calibration: SettlementProxyCalibration) {
  const fractions = calibration.builtAreaFraction + calibration.populationFraction
  if (!Number.isFinite(fractions) || Math.abs(fractions - 1) > 1e-9) {
    throw new Error('Settlement built-area and population fractions must sum to one')
  }
  if (!Number.isFinite(calibration.builtAreaFraction) ||
      !Number.isFinite(calibration.populationFraction) ||
      calibration.builtAreaFraction < 0 || calibration.populationFraction < 0) {
    throw new Error('Settlement proxy fractions cannot be negative')
  }
  if (!Number.isFinite(calibration.referencePopulationDensityPerKm2) ||
      !(calibration.referencePopulationDensityPerKm2 > 0)) {
    throw new Error('Reference population density must be positive')
  }
  if (!Number.isFinite(calibration.fluxPerEquivalentLitKm2) ||
      !(calibration.fluxPerEquivalentLitKm2 >= 0)) {
    throw new Error('Flux calibration cannot be negative')
  }
  if (!Number.isFinite(calibration.urbanSizeExponent) ||
      !(calibration.urbanSizeExponent > 0)) {
    throw new Error('Urban size exponent must be positive')
  }
  if (!Number.isFinite(calibration.referenceEquivalentLitAreaKm2) ||
      !(calibration.referenceEquivalentLitAreaKm2 > 0)) {
    throw new Error('Reference equivalent lit area must be positive')
  }
}

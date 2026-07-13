import { REGIONAL_SETTLEMENT_FOOTPRINTS } from '../../data/regionalSettlementFootprints'
import { normalizedSpectralFlux } from './spectrum'
import type { EllipseEmissionSource } from './types'

/** A broad sodium/white-LED proxy. It is a fallback, not a measured lamp inventory. */
export const CENTRAL_EUROPE_MIXED_LIGHT_PROFILE = [0.055, 0.09, 0.115, 0.145, 0.17, 0.21, 0.13, 0.085] as const

export type SettlementProxyCalibration = {
  builtAreaFraction: number
  populationFraction: number
  referencePopulationDensityPerKm2: number
  fluxPerEquivalentLitKm2: number
}

export const DEFAULT_SETTLEMENT_PROXY_CALIBRATION: SettlementProxyCalibration = {
  builtAreaFraction: 0.72,
  populationFraction: 0.28,
  referencePopulationDensityPerKm2: 3200,
  fluxPerEquivalentLitKm2: 1,
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
    const totalFlux = equivalentLitArea * settlement.lightingIntensity *
      calibration.fluxPerEquivalentLitKm2
    return {
      id: `regional-${settlement.id}`,
      name: settlement.name,
      component: 'settlement-proxy',
      coverageId: `settlement:${settlement.id}`,
      evidence: 'built-population-proxy',
      spectralFlux: normalizedSpectralFlux(totalFlux, CENTRAL_EUROPE_MIXED_LIGHT_PROFILE),
      provenance: 'Bundled regional fallback footprint; measured radiance should supersede this coverageId.',
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
  if (Math.abs(fractions - 1) > 1e-9) {
    throw new Error('Settlement built-area and population fractions must sum to one')
  }
  if (calibration.builtAreaFraction < 0 || calibration.populationFraction < 0) {
    throw new Error('Settlement proxy fractions cannot be negative')
  }
  if (!(calibration.referencePopulationDensityPerKm2 > 0)) {
    throw new Error('Reference population density must be positive')
  }
  if (!(calibration.fluxPerEquivalentLitKm2 >= 0)) {
    throw new Error('Flux calibration cannot be negative')
  }
}

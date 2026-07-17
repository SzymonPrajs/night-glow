import type { SeeingConditions } from '../types'

export const SEEING_REFERENCE_WAVELENGTH_NM = 500
export const PSF_WAVELENGTHS_NM = [620, 540, 460] as const
export const GAUSSIAN_FWHM_TO_SIGMA = 1 / 2.354820045

export const DEFAULT_SEEING_CONDITIONS: SeeingConditions = {
  zenithFwhmArcsec: 1.4,
  effectiveWindMps: 18,
}

export type SeeingPsf = {
  altitudeDeg: number
  airMass: number
  fwhmArcsec: readonly [red: number, green: number, blue: number]
  sigmaArcsec: readonly [red: number, green: number, blue: number]
  referenceFwhmArcsec: number
  friedParameterCm: number
  coherenceTimeMs: number
}

/**
 * Long-exposure, seeing-limited Gaussian PSF.
 *
 * ESO's exposure-time model uses seeing * airmass^0.6 * wavelength^-0.2.
 * Fried's r0 and the frozen-flow coherence time are derived at 500 nm.
 */
export function seeingPsf(
  conditions: SeeingConditions,
  altitudeDeg: number,
): SeeingPsf {
  const altitude = finiteClamp(altitudeDeg, 0.25, 90, 45)
  const airMass = relativeAirMass(altitude)
  const zenithFwhm = finiteClamp(conditions.zenithFwhmArcsec, 0.2, 8, 1.4)
  const referenceFwhmArcsec = zenithFwhm * airMass ** 0.6
  const fwhmArcsec = PSF_WAVELENGTHS_NM.map((wavelengthNm) => (
    referenceFwhmArcsec * (wavelengthNm / SEEING_REFERENCE_WAVELENGTH_NM) ** -0.2
  )) as unknown as [number, number, number]
  const sigmaArcsec = fwhmArcsec.map((fwhm) => (
    fwhm * GAUSSIAN_FWHM_TO_SIGMA
  )) as unknown as [number, number, number]
  const seeingRadians = referenceFwhmArcsec / 206_264.806247
  const friedParameterM = 0.98 * (SEEING_REFERENCE_WAVELENGTH_NM * 1e-9) / seeingRadians
  const effectiveWindMps = finiteClamp(conditions.effectiveWindMps, 0.5, 100, 18)

  return {
    altitudeDeg: altitude,
    airMass,
    fwhmArcsec,
    sigmaArcsec,
    referenceFwhmArcsec,
    friedParameterCm: friedParameterM * 100,
    coherenceTimeMs: 0.31 * friedParameterM / effectiveWindMps * 1000,
  }
}

export function gaussianPsf(radiusArcsec: number, sigmaArcsec: number) {
  const sigma = Math.max(1e-6, sigmaArcsec)
  return Math.exp(-0.5 * (radiusArcsec / sigma) ** 2) / (2 * Math.PI * sigma ** 2)
}

/** Kasten-Young relative optical air mass, bounded near the horizon. */
export function relativeAirMass(altitudeDeg: number) {
  const altitude = finiteClamp(altitudeDeg, -5, 90, 45)
  return Math.min(40, Math.max(1, 1 / (
    Math.sin(altitude * Math.PI / 180) +
    0.50572 * (altitude + 6.07995) ** -1.6364
  )))
}

function finiteClamp(value: number, minimum: number, maximum: number, fallback: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback))
}

import {
  DEFAULT_ATMOSPHERE,
  DEFAULT_CLOUD,
  DEFAULT_EMISSION_PROFILE,
  DEFAULT_MULTIPLE_SCATTERING,
  DEFAULT_RADIATIVE_TRANSFER,
  DEFAULT_SPECTRAL_BANDS,
  INV_FOUR_PI,
} from './constants'
import type {
  AtmosphereInput,
  AtmosphericState,
  RadiativeTransferInput,
  RadiativeTransferOptions,
  SpectralBand,
} from './types'

export type OpticalBandProperties = {
  rayleighOpticalDepth: number
  aerosolOpticalDepth: number
  cloudOpticalDepth: number
}

export type PreparedAtmosphere = {
  state: AtmosphericState
  bands: readonly SpectralBand[]
  opticalBands: readonly OpticalBandProperties[]
  aerosolEffectiveAsymmetry: number
  cloudEffectiveAsymmetry: number
  cloudDiffuseFraction: number
}

export function normalizeAtmosphere(input: AtmosphereInput = {}): AtmosphericState {
  const cloudInput = input.cloud ?? {}
  const relativeHumidity = clampFinite(input.relativeHumidity, 0, 0.99, DEFAULT_ATMOSPHERE.relativeHumidity)
  const referenceHumidity = clampFinite(input.referenceHumidity, 0, 0.95, DEFAULT_ATMOSPHERE.referenceHumidity)
  return {
    aerosolOpticalDepth550: clampFinite(
      input.aerosolOpticalDepth550,
      0,
      3,
      DEFAULT_ATMOSPHERE.aerosolOpticalDepth550,
    ),
    angstromExponent: clampFinite(input.angstromExponent, 0, 3, DEFAULT_ATMOSPHERE.angstromExponent),
    aerosolScaleHeightKm: clampFinite(
      input.aerosolScaleHeightKm,
      0.1,
      8,
      DEFAULT_ATMOSPHERE.aerosolScaleHeightKm,
    ),
    aerosolSingleScatteringAlbedo: clampFinite(
      input.aerosolSingleScatteringAlbedo,
      0,
      1,
      DEFAULT_ATMOSPHERE.aerosolSingleScatteringAlbedo,
    ),
    aerosolAsymmetry: clampFinite(input.aerosolAsymmetry, -0.95, 0.95, DEFAULT_ATMOSPHERE.aerosolAsymmetry),
    aerosolBackscatterFraction: clampFinite(
      input.aerosolBackscatterFraction,
      0,
      0.5,
      DEFAULT_ATMOSPHERE.aerosolBackscatterFraction,
    ),
    aerosolBackscatterAsymmetry: clampFinite(
      input.aerosolBackscatterAsymmetry,
      -0.95,
      0.5,
      DEFAULT_ATMOSPHERE.aerosolBackscatterAsymmetry,
    ),
    relativeHumidity,
    referenceHumidity: Math.min(referenceHumidity, relativeHumidity),
    humidityGrowthExponent: clampFinite(
      input.humidityGrowthExponent,
      0,
      2,
      DEFAULT_ATMOSPHERE.humidityGrowthExponent,
    ),
    pressureRatio: clampFinite(input.pressureRatio, 0.45, 1.25, DEFAULT_ATMOSPHERE.pressureRatio),
    molecularScaleHeightKm: clampFinite(
      input.molecularScaleHeightKm,
      5,
      12,
      DEFAULT_ATMOSPHERE.molecularScaleHeightKm,
    ),
    groundAlbedo: clampFinite(input.groundAlbedo, 0, 0.95, DEFAULT_ATMOSPHERE.groundAlbedo),
    cloud: {
      coverage: clampFinite(cloudInput.coverage, 0, 1, DEFAULT_CLOUD.coverage),
      opticalDepth: clampFinite(cloudInput.opticalDepth, 0, 150, DEFAULT_CLOUD.opticalDepth),
      baseAltitudeKm: clampFinite(cloudInput.baseAltitudeKm, 0, 25, DEFAULT_CLOUD.baseAltitudeKm),
      thicknessKm: clampFinite(cloudInput.thicknessKm, 0.05, 15, DEFAULT_CLOUD.thicknessKm),
      singleScatteringAlbedo: clampFinite(
        cloudInput.singleScatteringAlbedo,
        0,
        1,
        DEFAULT_CLOUD.singleScatteringAlbedo,
      ),
      asymmetry: clampFinite(cloudInput.asymmetry, -0.95, 0.98, DEFAULT_CLOUD.asymmetry),
    },
  }
}

export function normalizeRadiativeTransferOptions(input: RadiativeTransferInput = {}): RadiativeTransferOptions {
  const emission = input.emissionProfile ?? {}
  const multiple = input.multipleScattering ?? {}
  return {
    atmosphereTopKm: clampFinite(
      input.atmosphereTopKm,
      20,
      120,
      DEFAULT_RADIATIVE_TRANSFER.atmosphereTopKm,
    ),
    observerAltitudeKm: clampFinite(
      input.observerAltitudeKm,
      0,
      10,
      DEFAULT_RADIATIVE_TRANSFER.observerAltitudeKm,
    ),
    sourceAltitudeKm: clampFinite(
      input.sourceAltitudeKm,
      0,
      10,
      DEFAULT_RADIATIVE_TRANSFER.sourceAltitudeKm,
    ),
    sourceRadiusKm: clampFinite(input.sourceRadiusKm, 0.02, 20, DEFAULT_RADIATIVE_TRANSFER.sourceRadiusKm),
    emissionProfile: {
      lambertianFraction: clampFinite(
        emission.lambertianFraction,
        0,
        1,
        DEFAULT_EMISSION_PROFILE.lambertianFraction,
      ),
      horizonExponent: clampFinite(
        emission.horizonExponent,
        0,
        32,
        DEFAULT_EMISSION_PROFILE.horizonExponent,
      ),
    },
    multipleScattering: {
      maxOrders: Math.round(clampFinite(multiple.maxOrders, 1, 32, DEFAULT_MULTIPLE_SCATTERING.maxOrders)),
      tolerance: clampFinite(multiple.tolerance, 1e-5, 0.25, DEFAULT_MULTIPLE_SCATTERING.tolerance),
      maxContinuationRatio: clampFinite(
        multiple.maxContinuationRatio,
        0,
        0.98,
        DEFAULT_MULTIPLE_SCATTERING.maxContinuationRatio,
      ),
      closeTruncatedTail: multiple.closeTruncatedTail ?? DEFAULT_MULTIPLE_SCATTERING.closeTruncatedTail,
    },
  }
}

export function prepareAtmosphere(
  input: AtmosphereInput = {},
  bands: readonly SpectralBand[] = DEFAULT_SPECTRAL_BANDS,
): PreparedAtmosphere {
  const state = normalizeAtmosphere(input)
  const safeBands = bands.map((band, index) => ({
    id: band.id || `band-${index}`,
    wavelengthNm: clampFinite(band.wavelengthNm, 280, 2500, 550),
    widthNm: clampFinite(band.widthNm, 0.1, 1000, 40),
  }))
  const humidityFactor = humidityGrowthFactor(
    state.relativeHumidity,
    state.referenceHumidity,
    state.humidityGrowthExponent,
  )
  const opticalBands = safeBands.map((band) => ({
    rayleighOpticalDepth: rayleighVerticalOpticalDepth(band.wavelengthNm, state.pressureRatio),
    aerosolOpticalDepth: aerosolVerticalOpticalDepth(
      band.wavelengthNm,
      state.aerosolOpticalDepth550 * humidityFactor,
      state.angstromExponent,
    ),
    cloudOpticalDepth: state.cloud.opticalDepth * state.cloud.coverage,
  }))
  const aerosolEffectiveAsymmetry =
    (1 - state.aerosolBackscatterFraction) * state.aerosolAsymmetry +
    state.aerosolBackscatterFraction * state.aerosolBackscatterAsymmetry
  const cloudDiffuseFraction = clamp(
    state.cloud.coverage * 0.7 * (1 - Math.exp(-state.cloud.opticalDepth / 2)),
    0,
    0.7,
  )
  return {
    state,
    bands: safeBands,
    opticalBands,
    aerosolEffectiveAsymmetry,
    cloudEffectiveAsymmetry: (1 - cloudDiffuseFraction) * state.cloud.asymmetry,
    cloudDiffuseFraction,
  }
}

/**
 * Rayleigh vertical optical depth at sea-level pressure.
 * tau_R = 0.008569 lambda^-4 (1 + 0.0113 lambda^-2 + 0.00013 lambda^-4),
 * with wavelength in micrometres. This fit includes the refractive-index correction.
 */
export function rayleighVerticalOpticalDepth(wavelengthNm: number, pressureRatio = 1) {
  const wavelengthUm = clampFinite(wavelengthNm, 280, 2500, 550) / 1000
  const inverseSquare = 1 / (wavelengthUm * wavelengthUm)
  return nonNegativeFinite(
    pressureRatio * 0.008569 * inverseSquare * inverseSquare *
      (1 + 0.0113 * inverseSquare + 0.00013 * inverseSquare * inverseSquare),
  )
}

export function aerosolVerticalOpticalDepth(
  wavelengthNm: number,
  opticalDepth550: number,
  angstromExponent: number,
) {
  return nonNegativeFinite(
    opticalDepth550 * Math.pow(clampFinite(wavelengthNm, 280, 2500, 550) / 550, -angstromExponent),
  )
}

/** Hanel gamma parameterisation, capped before saturation/fog physics takes over. */
export function humidityGrowthFactor(relativeHumidity: number, referenceHumidity: number, exponent: number) {
  const rh = clamp(relativeHumidity, 0, 0.99)
  const reference = clamp(referenceHumidity, 0, Math.min(rh, 0.95))
  if (rh <= reference || exponent <= 0) return 1
  return clamp(Math.pow((1 - reference) / (1 - rh), exponent), 1, 8)
}

/** Depolarisation-corrected Rayleigh phase function, normalized over 4 pi. */
export function rayleighPhase(cosine: number, depolarization = 0.0279) {
  const mu = clamp(cosine, -1, 1)
  const delta = clamp(depolarization, 0, 0.2)
  return nonNegativeFinite(
    (3 * ((1 + 3 * delta) + (1 - delta) * mu * mu)) /
      (16 * Math.PI * (1 + 2 * delta)),
  )
}

/** Henyey-Greenstein phase function, normalized over 4 pi. */
export function henyeyGreensteinPhase(cosine: number, asymmetry: number) {
  const mu = clamp(cosine, -1, 1)
  const g = clamp(asymmetry, -0.999, 0.999)
  const denominator = Math.pow(Math.max(1e-9, 1 + g * g - 2 * g * mu), 1.5)
  return nonNegativeFinite((1 - g * g) * INV_FOUR_PI / denominator)
}

export function aerosolPhase(cosine: number, atmosphere: PreparedAtmosphere) {
  const state = atmosphere.state
  return nonNegativeFinite(
    (1 - state.aerosolBackscatterFraction) * henyeyGreensteinPhase(cosine, state.aerosolAsymmetry) +
      state.aerosolBackscatterFraction *
        henyeyGreensteinPhase(cosine, state.aerosolBackscatterAsymmetry),
  )
}

/** Effective cloud phase: direct HG plus an isotropic component from unresolved internal scattering. */
export function cloudPhase(cosine: number, atmosphere: PreparedAtmosphere) {
  return nonNegativeFinite(
    (1 - atmosphere.cloudDiffuseFraction) *
      henyeyGreensteinPhase(cosine, atmosphere.state.cloud.asymmetry) +
      atmosphere.cloudDiffuseFraction * INV_FOUR_PI,
  )
}

/**
 * Normalized upward intensity U(mu): integral over the upward hemisphere is one.
 * Lambertian U_L = mu/pi; horizon lobe U_H = (n+1)(1-mu)^n/(2pi).
 */
export function upwardEmission(mu: number, profile = DEFAULT_EMISSION_PROFILE) {
  if (mu <= 0) return 0
  const cosine = clamp(mu, 0, 1)
  const fraction = clamp(profile.lambertianFraction, 0, 1)
  const exponent = clamp(profile.horizonExponent, 0, 32)
  const lambertian = cosine / Math.PI
  const horizon = ((exponent + 1) * Math.pow(1 - cosine, exponent)) / (2 * Math.PI)
  return nonNegativeFinite(fraction * lambertian + (1 - fraction) * horizon)
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function nonNegativeFinite(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clampFinite(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  return clamp(Number.isFinite(value) ? value as number : fallback, minimum, maximum)
}

import type {
  AtmosphericState,
  KernelGridSpec,
  MultipleScatteringOptions,
  RadiativeTransferOptions,
  SpectralBand,
  UpwardEmissionProfile,
} from './types'

/** IUGG mean Earth radius. Distances in this module are kilometres. */
export const EARTH_RADIUS_KM = 6371.0088

/** Default top is high enough to retain the visible molecular-scattering column. */
export const DEFAULT_ATMOSPHERE_TOP_KM = 60

/** Matches the emission model's eight bands while remaining independently usable. */
export const DEFAULT_SPECTRAL_BANDS: readonly SpectralBand[] = Object.freeze([
  { id: 'violet', wavelengthNm: 420, widthNm: 30 },
  { id: 'blue', wavelengthNm: 450, widthNm: 30 },
  { id: 'blueGreen', wavelengthNm: 480, widthNm: 30 },
  { id: 'cyan', wavelengthNm: 510, widthNm: 30 },
  { id: 'green', wavelengthNm: 550, widthNm: 40 },
  { id: 'sodium', wavelengthNm: 589, widthNm: 38 },
  { id: 'orangeRed', wavelengthNm: 625, widthNm: 35 },
  { id: 'red', wavelengthNm: 680, widthNm: 55 },
])

export const DEFAULT_CLOUD = Object.freeze({
  coverage: 0,
  opticalDepth: 0,
  baseAltitudeKm: 1.5,
  thicknessKm: 0.6,
  singleScatteringAlbedo: 0.999,
  asymmetry: 0.85,
})

export const DEFAULT_ATMOSPHERE: Readonly<AtmosphericState> = Object.freeze({
  aerosolOpticalDepth550: 0.12,
  angstromExponent: 1.3,
  aerosolScaleHeightKm: 1.4,
  aerosolSingleScatteringAlbedo: 0.94,
  aerosolAsymmetry: 0.72,
  aerosolBackscatterFraction: 0.08,
  aerosolBackscatterAsymmetry: -0.2,
  relativeHumidity: 0.55,
  referenceHumidity: 0.4,
  humidityGrowthExponent: 0.35,
  pressureRatio: 1,
  molecularScaleHeightKm: 8,
  groundAlbedo: 0.15,
  cloud: DEFAULT_CLOUD,
})

export const DEFAULT_EMISSION_PROFILE: Readonly<UpwardEmissionProfile> = Object.freeze({
  lambertianFraction: 0.75,
  horizonExponent: 4,
})

export const DEFAULT_MULTIPLE_SCATTERING: Readonly<MultipleScatteringOptions> = Object.freeze({
  maxOrders: 10,
  tolerance: 0.01,
  maxContinuationRatio: 0.92,
  closeTruncatedTail: true,
})

export const DEFAULT_RADIATIVE_TRANSFER: Readonly<RadiativeTransferOptions> = Object.freeze({
  atmosphereTopKm: DEFAULT_ATMOSPHERE_TOP_KM,
  observerAltitudeKm: 0.15,
  sourceAltitudeKm: 0.15,
  sourceRadiusKm: 0.3,
  emissionProfile: DEFAULT_EMISSION_PROFILE,
  multipleScattering: DEFAULT_MULTIPLE_SCATTERING,
})

export const DEFAULT_KERNEL_GRID: Readonly<KernelGridSpec> = Object.freeze({
  distancesKm: Object.freeze([0.125, 0.5, 1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1000]),
  relativeAzimuthsDeg: Object.freeze(Array.from({ length: 37 }, (_, index) => index * 5)),
  elevationsDeg: Object.freeze([0, 2, 5, 10, 15, 20, 30, 45, 60, 75, 90]),
})

export const TWO_PI = Math.PI * 2
export const INV_FOUR_PI = 1 / (4 * Math.PI)

export const GAUSS_4_NODES = Object.freeze([
  -0.8611363115940526,
  -0.3399810435848563,
  0.3399810435848563,
  0.8611363115940526,
])

export const GAUSS_4_WEIGHTS = Object.freeze([
  0.3478548451374538,
  0.6521451548625461,
  0.6521451548625461,
  0.3478548451374538,
])

export const GAUSS_10_NODES = Object.freeze([
  -0.9739065285171717,
  -0.8650633666889845,
  -0.6794095682990244,
  -0.4333953941292472,
  -0.1488743389816312,
  0.1488743389816312,
  0.4333953941292472,
  0.6794095682990244,
  0.8650633666889845,
  0.9739065285171717,
])

export const GAUSS_10_WEIGHTS = Object.freeze([
  0.0666713443086881,
  0.1494513491505806,
  0.219086362515982,
  0.2692667193099963,
  0.2955242247147529,
  0.2955242247147529,
  0.2692667193099963,
  0.219086362515982,
  0.1494513491505806,
  0.0666713443086881,
])

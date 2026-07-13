export type Vector3 = readonly [x: number, y: number, z: number]

export type SpectralBand = {
  id: string
  wavelengthNm: number
  widthNm: number
}

export type CloudLayer = {
  /** Fractional horizontal coverage, represented as an unresolved mean column. */
  coverage: number
  /** Normal-incidence extinction optical depth of a covered column. */
  opticalDepth: number
  baseAltitudeKm: number
  thicknessKm: number
  singleScatteringAlbedo: number
  asymmetry: number
}

export type AtmosphericState = {
  /** Dry aerosol optical depth at 550 nm and the reference humidity. */
  aerosolOpticalDepth550: number
  angstromExponent: number
  aerosolScaleHeightKm: number
  aerosolSingleScatteringAlbedo: number
  aerosolAsymmetry: number
  /** Small backward HG lobe used because a single HG lobe underestimates backscatter. */
  aerosolBackscatterFraction: number
  aerosolBackscatterAsymmetry: number
  relativeHumidity: number
  referenceHumidity: number
  humidityGrowthExponent: number
  pressureRatio: number
  molecularScaleHeightKm: number
  groundAlbedo: number
  cloud: CloudLayer
}

export type AtmosphereInput = Partial<Omit<AtmosphericState, 'cloud'>> & {
  cloud?: Partial<CloudLayer>
}

export type UpwardEmissionProfile = {
  /** Fraction of upward power in a Lambertian cos(zeta) / pi component. */
  lambertianFraction: number
  /** Shape exponent of the remaining normalized low-elevation lobe. */
  horizonExponent: number
}

export type MultipleScatteringOptions = {
  maxOrders: number
  tolerance: number
  /** Strictly below one, guaranteeing convergence of the reduced-order series. */
  maxContinuationRatio: number
  closeTruncatedTail: boolean
}

export type RadiativeTransferOptions = {
  atmosphereTopKm: number
  observerAltitudeKm: number
  sourceAltitudeKm: number
  /** Finite-area softening radius for a unit source cell. */
  sourceRadiusKm: number
  emissionProfile: UpwardEmissionProfile
  multipleScattering: MultipleScatteringOptions
}

export type RadiativeTransferInput = Partial<Omit<RadiativeTransferOptions, 'emissionProfile' | 'multipleScattering'>> & {
  emissionProfile?: Partial<UpwardEmissionProfile>
  multipleScattering?: Partial<MultipleScatteringOptions>
}

export type UnitSourceSpectrum = {
  radiance: Float64Array
  singleScattering: Float64Array
  continuationRatios: Float64Array
  ordersUsed: Uint8Array
}

export type KernelGridSpec = {
  distancesKm: readonly number[]
  relativeAzimuthsDeg: readonly number[]
  elevationsDeg: readonly number[]
}

export type AtmosphericKernel = {
  version: 1
  key: string
  bands: readonly SpectralBand[]
  grid: KernelGridSpec
  atmosphere: AtmosphericState
  options: RadiativeTransferOptions
  /** Layout: [distance][elevation][relative azimuth][spectral band]. */
  values: Float32Array
  units: 'relative-radiance-per-unit-upward-spectral-power'
  maxOrdersUsed: number
}

export type SerializedAtmosphericKernel = Omit<AtmosphericKernel, 'values'> & {
  values: number[]
}

export type KernelBuildOptions = RadiativeTransferInput & {
  bands?: readonly SpectralBand[]
  onProgress?: (completed: number, total: number) => void
}

export type AsyncKernelBuildOptions = KernelBuildOptions & {
  /** Number of unit-source cells between event-loop yields. */
  yieldEvery?: number
  /** Checked after every yield so a worker can supersede stale atmosphere work. */
  shouldCancel?: () => boolean
}

export type RingEmissionField = {
  ringDistancesKm: readonly number[]
  sectorCount: number
  azimuthOffsetDeg: number
  bandIds: readonly string[]
  /** Layout: [ring][azimuth sector][spectral band]. */
  spectralPower: Float64Array
}

export type SpectralSkyField = {
  azimuthsDeg: readonly number[]
  elevationsDeg: readonly number[]
  bandIds: readonly string[]
  /** Layout: [elevation][azimuth][spectral band]. */
  radiance: Float32Array
}

export type RingConvolutionPlan = {
  version: 1
  key: string
  kernelKey: string
  ringDistancesKm: readonly number[]
  elevationsDeg: readonly number[]
  sectorCount: number
  bandIds: readonly string[]
  harmonicCount: number
  /** Cosine-series transfer coefficients: [elevation][ring][band][harmonic]. */
  kernelHarmonics: Float64Array
  /** Reusable trigonometric tables: [harmonic][azimuth sector]. */
  cosineTable: Float64Array
  sineTable: Float64Array
}

export type ConvolutionPlanOptions = {
  maxHarmonics?: number
}

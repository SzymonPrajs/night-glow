/**
 * Serializable messages exchanged with the physical glow worker.
 *
 * Array layouts are documented explicitly because request buffers are intended
 * to be transferred, not cloned. Inputs may retain Float64 precision from the
 * emission/radiative-transfer model; all rendered result grids are Float32.
 */

export type PhysicalGlowRequestId = number
export type PhysicalGlowNumericArray = Float32Array | Float64Array
export type PhysicalGlowRgb = readonly [red: number, green: number, blue: number]

export type PhysicalGlowAtmosphere = {
  aod550: number
  angstromExponent: number
  aerosolScaleHeightKm: number
  aerosolAsymmetry: number
  singleScatteringAlbedo: number
  relativeHumidity: number
  cloudFraction: number
  cloudBaseKm: number
  cloudThicknessKm: number
  cloudOpticalDepth: number
  groundAlbedo: number
  maxScatteringOrder: number
}

export type PhysicalGlowObserver = {
  lat: number
  lon: number
  altitudeKm?: number
}

export type PhysicalGlowEmissionComponent = {
  id: string
  label?: string
  /** Layout: [ring][spectral band]. */
  ringSpectralFlux: PhysicalGlowNumericArray
}

export type PhysicalGlowEmissionGrid = {
  sectorCount: number
  /** Representative distance of every ring, in strictly increasing order. */
  ringRadiiKm: PhysicalGlowNumericArray
  wavelengthsNm: PhysicalGlowNumericArray
  /** Layout: [ring][azimuth sector][spectral band]. */
  upwardSpectralFlux: PhysicalGlowNumericArray
  /** Optional [ring][sector] source-data coverage in [0, 1]. */
  coverage?: PhysicalGlowNumericArray
  /** Optional [ring][sector] source-model confidence in [0, 1]. */
  confidence?: PhysicalGlowNumericArray
  /** Components need only carry ring totals; the directional total stays canonical. */
  components?: readonly PhysicalGlowEmissionComponent[]
  fluxUnit: string
}

export type PhysicalGlowEmissionInput =
  | {
      kind: 'inline'
      cacheKey: string
      grid: PhysicalGlowEmissionGrid
    }
  | {
      kind: 'cache'
      cacheKey: string
    }

export type PhysicalGlowKernelGrid = {
  /** Source-distance nodes, in strictly increasing order. */
  distanceKm: PhysicalGlowNumericArray
  /** Sorted samples from 0 to 180 degrees; symmetry supplies the other half. */
  relativeAzimuthDeg: PhysicalGlowNumericArray
  elevationDeg: PhysicalGlowNumericArray
  wavelengthsNm: PhysicalGlowNumericArray
  /** Layout: [distance][elevation][relative azimuth][spectral band]. */
  values: PhysicalGlowNumericArray
  radianceUnit: string
  confidence?: number
}

export type PhysicalGlowKernelInput =
  | {
      kind: 'inline'
      cacheKey: string
      kernel: PhysicalGlowKernelGrid
    }
  | {
      kind: 'cache'
      cacheKey: string
    }
  | {
      kind: 'auto'
      /** Omit to derive a stable cache key from the grid and atmosphere. */
      cacheKey?: string
      elevationDeg: PhysicalGlowNumericArray
    }

export type PhysicalGlowProgressComponent = 'emission' | 'kernel' | 'propagation' | 'diagnostics'

export type PhysicalGlowProgressBreakdown = Record<PhysicalGlowProgressComponent, number>
export type PhysicalGlowProgressWeights = Record<PhysicalGlowProgressComponent, number>

export type PhysicalGlowAnalysisOptions = {
  /** Allows rapid slider changes to supersede work before a heavy stage starts. */
  debounceMs?: number
  progressWeights?: Partial<PhysicalGlowProgressWeights>
  /** Spectral-band to linear RGB matrix, layout [spectral band][RGB channel]. */
  spectralToRgb?: PhysicalGlowNumericArray
  naturalSkyRadianceRgb?: PhysicalGlowRgb
  darkSkyLimitingMagnitude?: number
  limitingMagnitudeSlope?: number
  estimateOuterBoundary?: boolean
}

export type PhysicalGlowAnalyzeRequest = {
  type: 'analyze'
  requestId: PhysicalGlowRequestId
  observer: PhysicalGlowObserver
  atmosphere: PhysicalGlowAtmosphere
  emission: PhysicalGlowEmissionInput
  kernel: PhysicalGlowKernelInput
  options?: PhysicalGlowAnalysisOptions
}

export type PhysicalGlowCancelRequest = {
  type: 'cancel'
  requestId: PhysicalGlowRequestId
}

export type PhysicalGlowClearCacheRequest = {
  type: 'clear-cache'
  requestId: PhysicalGlowRequestId
  emissionCacheKey?: string
  kernelCacheKey?: string
}

export type PhysicalGlowWorkerRequest =
  | PhysicalGlowAnalyzeRequest
  | PhysicalGlowCancelRequest
  | PhysicalGlowClearCacheRequest

export type PhysicalGlowProgressMessage = {
  type: 'progress'
  requestId: PhysicalGlowRequestId
  stage: string
  overall: number
  components: PhysicalGlowProgressBreakdown
  weights: PhysicalGlowProgressWeights
  detail?: string
}

export type PhysicalGlowTimings = {
  debounceMs: number
  emissionMs: number
  kernelMs: number
  propagationMs: number
  diagnosticsMs: number
  totalMs: number
}

export type PhysicalGlowDiagnostics = {
  emissionCacheHit: boolean
  kernelCacheHit: boolean
  kernelMode: 'inline' | 'auto-analytic-scaffold'
  totalInputSpectralFlux: number[]
  meanOutputSpectralRadiance: number[]
  meanOutputRgbRadiance: PhysicalGlowRgb
  componentFluxResidual: number
  minimumRadiance: number
  maximumRadiance: number
  nonFiniteCount: number
  negativeCount: number
  /** Fraction of modeled mean radiance contributed by rings at 300 km and beyond. */
  distantContributionFraction: number
  /** Fraction contributed by the outermost 100 km; a boundary-sensitivity indicator, not an error bound. */
  outerBoundaryContributionFraction: number
}

export type PhysicalGlowComponentContribution = {
  id: string
  label?: string
  meanSpectralRadiance: Float32Array
  meanRgbRadiance: Float32Array
}

export type PhysicalGlowResult = {
  azimuthCount: number
  /** Bearing of azimuth sample zero; sectors represent half-degree cell centres. */
  azimuthOffsetDeg: number
  elevationDeg: Float32Array
  wavelengthsNm: Float32Array
  /** Layout: [elevation][azimuth][spectral band]. */
  spectralRadiance: Float32Array
  /** Layout: [elevation][azimuth][RGB channel]. */
  rgbRadiance: Float32Array
  /** Layout: [elevation][azimuth]. */
  directionalLimitingMagnitude: Float32Array
  /** Layout: [ring][spectral band], solid-angle averaged over the output hemisphere. */
  ringMeanSpectralRadiance: Float32Array
  /** Layout: [ring][RGB channel], solid-angle averaged over the output hemisphere. */
  ringMeanRgbRadiance: Float32Array
  componentContributions: PhysicalGlowComponentContribution[]
  diagnostics: PhysicalGlowDiagnostics
  timings: PhysicalGlowTimings
}

export type PhysicalGlowResultMessage = {
  type: 'result'
  requestId: PhysicalGlowRequestId
  result: PhysicalGlowResult
}

export type PhysicalGlowCancelledMessage = {
  type: 'cancelled'
  requestId: PhysicalGlowRequestId
  reason: 'cancelled' | 'superseded'
}

export type PhysicalGlowErrorMessage = {
  type: 'error'
  requestId: PhysicalGlowRequestId
  code: string
  message: string
}

export type PhysicalGlowCacheClearedMessage = {
  type: 'cache-cleared'
  requestId: PhysicalGlowRequestId
  emissionEntries: number
  kernelEntries: number
}

export type PhysicalGlowWorkerMessage =
  | PhysicalGlowProgressMessage
  | PhysicalGlowResultMessage
  | PhysicalGlowCancelledMessage
  | PhysicalGlowErrorMessage
  | PhysicalGlowCacheClearedMessage

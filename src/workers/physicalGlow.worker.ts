import type {
  PhysicalGlowAnalyzeRequest,
  PhysicalGlowAtmosphere,
  PhysicalGlowEmissionGrid,
  PhysicalGlowKernelGrid,
  PhysicalGlowProgressBreakdown,
  PhysicalGlowProgressWeights,
  PhysicalGlowResult,
  PhysicalGlowWorkerMessage,
  PhysicalGlowWorkerRequest,
} from '../lib/physicalGlowProtocol'
import {
  atmosphericKernelCacheKey,
  buildAtmosphericKernelAsync,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
  DEFAULT_RELATIVE_AZIMUTHS_DEG,
  normalizeAtmosphere,
  normalizeRadiativeTransferOptions,
  ringConvolutionPlanCacheKey,
  type AtmosphereInput,
  type AtmosphericKernel,
  type KernelGridSpec,
  type RingConvolutionPlan,
  type SpectralBand,
} from '../lib/physics'

type WorkerScope = {
  onmessage: ((event: MessageEvent<PhysicalGlowWorkerRequest>) => void) | null
  postMessage: (message: PhysicalGlowWorkerMessage, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope
const emissionCache = new Map<string, PhysicalGlowEmissionGrid>()
const kernelCache = new Map<string, AtmosphericKernel>()
const planCache = new Map<string, RingConvolutionPlan>()
const MAX_EMISSION_CACHE_ENTRIES = 3
const MAX_KERNEL_CACHE_ENTRIES = 4
// A full positive FFT plan is intentionally larger than the old truncated
// harmonic plan; retain only the active atmosphere to bound worker memory.
const MAX_PLAN_CACHE_ENTRIES = 1
const cancelled = new Set<number>()
let latestAnalyzeRequest = 0

scope.onmessage = (event) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.requestId)
    return
  }
  if (request.type === 'clear-cache') {
    if (request.emissionCacheKey) emissionCache.delete(request.emissionCacheKey)
    else emissionCache.clear()
    if (request.kernelCacheKey) {
      const kernel = kernelCache.get(request.kernelCacheKey)
      kernelCache.delete(request.kernelCacheKey)
      if (kernel) clearPlansForKernel(kernel.key)
    } else {
      kernelCache.clear()
      planCache.clear()
    }
    scope.postMessage({
      type: 'cache-cleared',
      requestId: request.requestId,
      emissionEntries: emissionCache.size,
      kernelEntries: kernelCache.size,
    })
    return
  }
  latestAnalyzeRequest = request.requestId
  void analyze(request)
}

async function analyze(request: PhysicalGlowAnalyzeRequest) {
  const totalStarted = performance.now()
  const weights = normalizeWeights(request.options?.progressWeights)
  const components: PhysicalGlowProgressBreakdown = {
    emission: 0,
    kernel: 0,
    propagation: 0,
    diagnostics: 0,
  }
  let debounceMs = 0
  let emissionMs = 0
  let kernelMs = 0
  let propagationMs = 0
  let diagnosticsMs = 0

  try {
    const requestedDebounce = clamp(request.options?.debounceMs ?? 60, 0, 500)
    if (requestedDebounce > 0) {
      const debounceStarted = performance.now()
      postProgress(request, weights, components, 'Coalescing atmosphere changes', 'Waiting for the slider state to settle')
      await delay(requestedDebounce)
      debounceMs = performance.now() - debounceStarted
    }
    if (finishIfStale(request)) return

    const emissionStarted = performance.now()
    postProgress(request, weights, components, 'Validating the polar emission field')
    const emissionCacheHit = request.emission.kind === 'cache'
    const emission = resolveEmission(request)
    components.emission = 1
    emissionMs = performance.now() - emissionStarted
    postProgress(
      request,
      weights,
      components,
      emissionCacheHit ? 'Reusing cached emission rings' : 'Emission rings ready',
      `${emission.ringRadiiKm.length} rings × ${emission.sectorCount} bearings × ${emission.wavelengthsNm.length} bands`,
    )
    await delay(0)
    if (finishIfStale(request)) return

    const bands = bandsFromWavelengths(emission.wavelengthsNm)
    const atmosphereInput = toAtmosphereInput(request.atmosphere)
    const transferOptions = {
      observerAltitudeKm: request.observer.altitudeKm ?? 0.15,
      atmosphereTopKm: 60,
      multipleScattering: {
        maxOrders: request.atmosphere.maxScatteringOrder,
        tolerance: 0.01,
        maxContinuationRatio: 0.92,
        closeTruncatedTail: true,
      },
    }
    const kernelGrid = makeKernelGrid(emission.ringRadiiKm, request)
    const kernelStarted = performance.now()
    let lastKernelProgressAt = Number.NEGATIVE_INFINITY
    const kernelResolution = await resolveKernel(
      request,
      bands,
      atmosphereInput,
      transferOptions,
      kernelGrid,
      (completed, total) => {
        const now = performance.now()
        if (completed < total && now - lastKernelProgressAt < 34) return
        lastKernelProgressAt = now
        components.kernel = 0.84 * completed / Math.max(1, total)
        postProgress(
          request,
          weights,
          components,
          'Integrating curved-Earth light paths',
          `${completed.toLocaleString()} / ${total.toLocaleString()} unit-source sky paths`,
        )
      },
    )
    await delay(0)
    if (finishIfStale(request)) return

    const ringDistances = Array.from(emission.ringRadiiKm)
    const bandIds = bands.map((band) => band.id)
    const ringField = createRingEmissionField(
      ringDistances,
      emission.sectorCount,
      bandIds,
      toFloat64(emission.upwardSpectralFlux),
      180 / emission.sectorCount,
    )
    components.kernel = 0.88
    postProgress(
      request,
      weights,
      components,
      'Preparing positive angular transfer plan',
      'Sampling the non-negative kernel onto every bearing and precomputing its FFT',
    )
    const planKey = ringConvolutionPlanCacheKey(
      kernelResolution.kernel,
      ringDistances,
      emission.sectorCount,
      kernelGrid.elevationsDeg,
    )
    let plan = lruGet(planCache, planKey)
    if (!plan) {
      // Drop the previous ~56 MiB half-spectrum before allocating its
      // replacement so atmosphere changes do not briefly retain two plans.
      lruMakeRoom(planCache, MAX_PLAN_CACHE_ENTRIES)
      plan = createRingConvolutionPlan(
        kernelResolution.kernel,
        ringDistances,
        emission.sectorCount,
        kernelGrid.elevationsDeg,
      )
      lruSet(planCache, planKey, plan, MAX_PLAN_CACHE_ENTRIES)
    }
    components.kernel = 1
    kernelMs = performance.now() - kernelStarted
    postProgress(
      request,
      weights,
      components,
      kernelResolution.cacheHit ? 'Cached atmosphere kernel ready' : 'Atmosphere kernel ready',
      `${plan.sectorCount} bearing bins · ${plan.fftSize}-point FFT · ${kernelMs.toFixed(0)} ms`,
    )
    await delay(0)
    if (finishIfStale(request)) return

    const propagationStarted = performance.now()
    components.propagation = 0.1
    postProgress(request, weights, components, 'Convolving every ring and bearing')
    const spectralSky = convolveRingEmissionField(
      kernelResolution.kernel,
      ringField,
      kernelGrid.elevationsDeg,
      plan,
    )
    components.propagation = 0.72
    postProgress(request, weights, components, 'Converting spectral radiance to the visible sky')
    const spectralToRgb = spectralMatrix(request, bands)
    const rgbRadiance = spectralFieldToRgb(spectralSky.radiance, bands.length, spectralToRgb)
    const directionalLimitingMagnitude = calculateDirectionalLimits(rgbRadiance, request)
    components.propagation = 1
    propagationMs = performance.now() - propagationStarted
    postProgress(
      request,
      weights,
      components,
      'Directional sky radiance ready',
      `${spectralSky.azimuthsDeg.length} × ${spectralSky.elevationsDeg.length} sky samples · ${propagationMs.toFixed(0)} ms`,
    )
    await delay(0)
    if (finishIfStale(request)) return

    const diagnosticsStarted = performance.now()
    components.diagnostics = 0.2
    postProgress(request, weights, components, 'Checking component balance and outer-domain sensitivity')
    const ringContribution = calculateRingContributions(
      emission,
      plan,
      bands.length,
      spectralToRgb,
    )
    const componentContributions = calculateComponentContributions(
      emission,
      plan,
      bands.length,
      spectralToRgb,
    )
    const statistics = fieldStatistics(spectralSky.radiance, rgbRadiance, bands.length)
    const totalInputSpectralFlux = sumInputSpectrum(emission)
    const componentFluxResidual = calculateComponentFluxResidual(emission, totalInputSpectralFlux)
    const distantContributionFraction = distantContributionFractionFromRings(
      ringContribution.ringMeanSpectralRadiance,
      emission.ringRadiiKm,
      bands.length,
    )
    const outerBoundaryContributionFraction = request.options?.estimateOuterBoundary === false
      ? 0
      : outerBoundaryFraction(
          ringContribution.ringMeanSpectralRadiance,
          emission.ringRadiiKm,
          bands.length,
        )
    components.diagnostics = 1
    diagnosticsMs = performance.now() - diagnosticsStarted
    const result: PhysicalGlowResult = {
      azimuthCount: emission.sectorCount,
      azimuthOffsetDeg: spectralSky.azimuthsDeg[0] ?? 0,
      elevationDeg: Float32Array.from(spectralSky.elevationsDeg),
      wavelengthsNm: Float32Array.from(emission.wavelengthsNm),
      spectralRadiance: spectralSky.radiance,
      rgbRadiance,
      directionalLimitingMagnitude,
      ringMeanSpectralRadiance: ringContribution.ringMeanSpectralRadiance,
      ringMeanRgbRadiance: ringContribution.ringMeanRgbRadiance,
      componentContributions,
      diagnostics: {
        emissionCacheHit,
        kernelCacheHit: kernelResolution.cacheHit,
        kernelMode: kernelResolution.mode,
        totalInputSpectralFlux,
        meanOutputSpectralRadiance: statistics.meanSpectral,
        meanOutputRgbRadiance: statistics.meanRgb,
        componentFluxResidual,
        minimumRadiance: statistics.minimum,
        maximumRadiance: statistics.maximum,
        nonFiniteCount: statistics.nonFinite,
        negativeCount: statistics.negative,
        distantContributionFraction,
        outerBoundaryContributionFraction,
      },
      timings: {
        debounceMs,
        emissionMs,
        kernelMs,
        propagationMs,
        diagnosticsMs,
        totalMs: performance.now() - totalStarted,
      },
    }
    postProgress(
      request,
      weights,
      components,
      'Finalizing the sky field',
      `Component accounting residual ${(componentFluxResidual * 100).toExponential(1)}%`,
    )
    await delay(0)
    if (finishIfStale(request)) return
    const transfer = resultTransferables(result)
    scope.postMessage({ type: 'result', requestId: request.requestId, result }, transfer)
  } catch (error) {
    if (finishIfStale(request)) return
    scope.postMessage({
      type: 'error',
      requestId: request.requestId,
      code: error instanceof RangeError ? 'INVALID_GRID' : 'ANALYSIS_FAILED',
      message: error instanceof Error ? error.message : 'Unknown physical analysis error.',
    })
  } finally {
    cancelled.delete(request.requestId)
  }
}

function resolveEmission(request: PhysicalGlowAnalyzeRequest) {
  if (request.emission.kind === 'cache') {
    const cached = lruGet(emissionCache, request.emission.cacheKey)
    if (!cached) throw new Error(`Emission cache miss for ${request.emission.cacheKey}`)
    return cached
  }
  validateEmission(request.emission.grid)
  lruSet(
    emissionCache,
    request.emission.cacheKey,
    request.emission.grid,
    MAX_EMISSION_CACHE_ENTRIES,
  )
  return request.emission.grid
}

async function resolveKernel(
  request: PhysicalGlowAnalyzeRequest,
  bands: readonly SpectralBand[],
  atmosphere: AtmosphereInput,
  transferOptions: Parameters<typeof atmosphericKernelCacheKey>[2],
  grid: ReturnType<typeof makeKernelGrid>,
  onProgress: (completed: number, total: number) => void,
) {
  if (request.kernel.kind === 'cache') {
    const cached = lruGet(kernelCache, request.kernel.cacheKey)
    if (!cached) throw new Error(`Atmosphere kernel cache miss for ${request.kernel.cacheKey}`)
    return { kernel: cached, cacheHit: true, mode: 'inline' as const }
  }
  if (request.kernel.kind === 'inline') {
    const cached = lruGet(kernelCache, request.kernel.cacheKey)
    if (cached) return { kernel: cached, cacheHit: true, mode: 'inline' as const }
    const kernel = inlineAtmosphericKernel(
      request.kernel.cacheKey,
      request.kernel.kernel,
      atmosphere,
      transferOptions,
      bands,
    )
    lruSet(kernelCache, request.kernel.cacheKey, kernel, MAX_KERNEL_CACHE_ENTRIES, evictKernelPlans)
    return { kernel, cacheHit: false, mode: 'inline' as const }
  }
  const key = request.kernel.cacheKey ?? atmosphericKernelCacheKey(
    atmosphere,
    grid,
    transferOptions,
    bands,
  )
  const cached = lruGet(kernelCache, key)
  if (cached) return { kernel: cached, cacheHit: true, mode: 'auto-analytic-scaffold' as const }
  const kernel = await buildAtmosphericKernelAsync(atmosphere, grid, {
    ...transferOptions,
    bands,
    onProgress,
    yieldEvery: 128,
    shouldCancel: () => isStale(request),
  })
  lruSet(kernelCache, key, kernel, MAX_KERNEL_CACHE_ENTRIES, evictKernelPlans)
  return { kernel, cacheHit: false, mode: 'auto-analytic-scaffold' as const }
}

function inlineAtmosphericKernel(
  key: string,
  input: PhysicalGlowKernelGrid,
  atmosphereInput: AtmosphereInput,
  transferOptions: Parameters<typeof normalizeRadiativeTransferOptions>[0],
  bands: readonly SpectralBand[],
): AtmosphericKernel {
  const grid = {
    distancesKm: Array.from(input.distanceKm),
    relativeAzimuthsDeg: Array.from(input.relativeAzimuthDeg),
    elevationsDeg: Array.from(input.elevationDeg),
  }
  const expected = grid.distancesKm.length * grid.relativeAzimuthsDeg.length *
    grid.elevationsDeg.length * bands.length
  if (input.values.length !== expected) throw new Error(`Inline kernel has ${input.values.length} values; expected ${expected}`)
  return {
    version: 1,
    key,
    bands,
    grid,
    atmosphere: normalizeAtmosphere(atmosphereInput),
    options: normalizeRadiativeTransferOptions(transferOptions),
    values: input.values instanceof Float32Array ? input.values : Float32Array.from(input.values),
    units: 'relative-radiance-per-unit-upward-spectral-power',
    maxOrdersUsed: 1,
  }
}

function makeKernelGrid(ringRadii: ArrayLike<number>, request: PhysicalGlowAnalyzeRequest): KernelGridSpec {
  const maximumDistance = Math.max(1, ...Array.from(ringRadii))
  const distanceCandidates = [0.125, 0.375, 0.75, 1.5, 3, 7.5, 15, 30, 45, 75, 150, 250, 400, 600, 800, maximumDistance]
  const requestedElevations = request.kernel.kind === 'auto'
    ? request.kernel.elevationDeg
    : request.kernel.kind === 'inline'
      ? request.kernel.kernel.elevationDeg
      : lruGet(kernelCache, request.kernel.cacheKey)?.grid.elevationsDeg ?? [0, 2, 5, 10, 15, 20, 30, 45, 60, 75, 90]
  return {
    distancesKm: [...new Set(distanceCandidates.filter((value) => value <= maximumDistance).concat(maximumDistance))].sort((a, b) => a - b),
    relativeAzimuthsDeg: DEFAULT_RELATIVE_AZIMUTHS_DEG,
    elevationsDeg: Array.from(requestedElevations, Number),
  }
}

function toAtmosphereInput(input: PhysicalGlowAtmosphere): AtmosphereInput {
  return {
    aerosolOpticalDepth550: input.aod550,
    angstromExponent: input.angstromExponent,
    aerosolScaleHeightKm: input.aerosolScaleHeightKm,
    aerosolSingleScatteringAlbedo: input.singleScatteringAlbedo,
    aerosolAsymmetry: input.aerosolAsymmetry,
    relativeHumidity: input.relativeHumidity,
    groundAlbedo: input.groundAlbedo,
    cloud: {
      coverage: input.cloudFraction,
      baseAltitudeKm: input.cloudBaseKm,
      thicknessKm: input.cloudThicknessKm,
      opticalDepth: input.cloudOpticalDepth,
    },
  }
}

function bandsFromWavelengths(wavelengths: ArrayLike<number>): SpectralBand[] {
  if (!wavelengths.length) throw new Error('Emission field has no spectral bands')
  return Array.from(wavelengths, (wavelengthNm, index) => {
    if (!Number.isFinite(wavelengthNm) || wavelengthNm < 350 || wavelengthNm > 800) {
      throw new Error(`Invalid visible wavelength at band ${index}`)
    }
    return { id: `band-${index}-${wavelengthNm}nm`, wavelengthNm, widthNm: 40 }
  })
}

function validateEmission(grid: PhysicalGlowEmissionGrid) {
  const ringCount = grid.ringRadiiKm.length
  const bandCount = grid.wavelengthsNm.length
  if (!Number.isInteger(grid.sectorCount) || grid.sectorCount < 3) throw new Error('Emission sector count must be at least three')
  if (!ringCount || !bandCount) throw new Error('Emission grid requires rings and spectral bands')
  const expected = ringCount * grid.sectorCount * bandCount
  if (grid.upwardSpectralFlux.length !== expected) {
    throw new Error(`Emission field has ${grid.upwardSpectralFlux.length} values; expected ${expected}`)
  }
  validateNonNegative(grid.ringRadiiKm, 'ring radius')
  validateNonNegative(grid.upwardSpectralFlux, 'upward spectral flux')
  for (const component of grid.components ?? []) {
    if (component.ringSpectralFlux.length !== ringCount * bandCount) {
      throw new Error(`Component ${component.id} has an invalid ring spectrum`)
    }
    validateNonNegative(component.ringSpectralFlux, `component ${component.id}`)
  }
}

function calculateRingContributions(
  emission: PhysicalGlowEmissionGrid,
  plan: RingConvolutionPlan,
  bandCount: number,
  spectralToRgb: Float64Array,
) {
  const ringCount = emission.ringRadiiKm.length
  const elevationCount = plan.elevationsDeg.length
  const ringMeanSpectralRadiance = new Float32Array(ringCount * bandCount)
  for (let ring = 0; ring < ringCount; ring += 1) {
    for (let band = 0; band < bandCount; band += 1) {
      let sourceFlux = 0
      for (let sector = 0; sector < emission.sectorCount; sector += 1) {
        sourceFlux += emission.upwardSpectralFlux[(ring * emission.sectorCount + sector) * bandCount + band]
      }
      let meanTransfer = 0
      for (let elevation = 0; elevation < elevationCount; elevation += 1) {
        const index = ((elevation * ringCount + ring) * bandCount + band)
        meanTransfer += plan.kernelMeanTransfer[index]
      }
      ringMeanSpectralRadiance[ring * bandCount + band] = Math.max(0, sourceFlux * meanTransfer / elevationCount)
    }
  }
  return {
    ringMeanSpectralRadiance,
    ringMeanRgbRadiance: spectralFieldToRgb(ringMeanSpectralRadiance, bandCount, spectralToRgb),
  }
}

function calculateComponentContributions(
  emission: PhysicalGlowEmissionGrid,
  plan: RingConvolutionPlan,
  bandCount: number,
  spectralToRgb: Float64Array,
) {
  const ringCount = emission.ringRadiiKm.length
  const elevationCount = plan.elevationsDeg.length
  return (emission.components ?? []).map((component) => {
    const meanSpectralRadiance = new Float32Array(bandCount)
    for (let band = 0; band < bandCount; band += 1) {
      let total = 0
      for (let ring = 0; ring < ringCount; ring += 1) {
        let meanTransfer = 0
        for (let elevation = 0; elevation < elevationCount; elevation += 1) {
          const index = ((elevation * ringCount + ring) * bandCount + band)
          meanTransfer += plan.kernelMeanTransfer[index]
        }
        total += component.ringSpectralFlux[ring * bandCount + band] * meanTransfer / elevationCount
      }
      meanSpectralRadiance[band] = Math.max(0, total)
    }
    return {
      id: component.id,
      label: component.label,
      meanSpectralRadiance,
      meanRgbRadiance: spectralFieldToRgb(meanSpectralRadiance, bandCount, spectralToRgb),
    }
  })
}

function calculateDirectionalLimits(rgb: Float32Array, request: PhysicalGlowAnalyzeRequest) {
  const natural = request.options?.naturalSkyRadianceRgb ?? [0.0016, 0.002, 0.0032]
  const naturalLuminance = Math.max(1e-9, luminance(natural[0], natural[1], natural[2]))
  const darkLimit = request.options?.darkSkyLimitingMagnitude ?? 7.15
  const slope = request.options?.limitingMagnitudeSlope ?? 1.18
  const output = new Float32Array(rgb.length / 3)
  for (let index = 0; index < output.length; index += 1) {
    const artificial = luminance(rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2])
    const ratio = 1 + Math.max(0, artificial) / naturalLuminance
    output[index] = clamp(darkLimit - slope * Math.log10(ratio), 0, darkLimit)
  }
  return output
}

function spectralMatrix(request: PhysicalGlowAnalyzeRequest, bands: readonly SpectralBand[]) {
  const provided = request.options?.spectralToRgb
  if (provided) {
    if (provided.length !== bands.length * 3) throw new Error('Spectral-to-RGB matrix has the wrong dimensions')
    return Float64Array.from(provided)
  }
  const matrix = new Float64Array(bands.length * 3)
  bands.forEach((band, index) => {
    const [red, green, blue] = wavelengthToLinearRgb(band.wavelengthNm)
    matrix[index * 3] = red
    matrix[index * 3 + 1] = green
    matrix[index * 3 + 2] = blue
  })
  return matrix
}

function spectralFieldToRgb(values: ArrayLike<number>, bandCount: number, matrix: Float64Array) {
  const sampleCount = values.length / bandCount
  const output = new Float32Array(sampleCount * 3)
  for (let sample = 0; sample < sampleCount; sample += 1) {
    for (let band = 0; band < bandCount; band += 1) {
      const value = Math.max(0, values[sample * bandCount + band])
      output[sample * 3] += value * matrix[band * 3]
      output[sample * 3 + 1] += value * matrix[band * 3 + 1]
      output[sample * 3 + 2] += value * matrix[band * 3 + 2]
    }
  }
  return output
}

function wavelengthToLinearRgb(wavelengthNm: number) {
  const red = gaussian(wavelengthNm, 610, 43) + 0.28 * gaussian(wavelengthNm, 430, 22)
  const green = gaussian(wavelengthNm, 545, 38)
  const blue = gaussian(wavelengthNm, 450, 31)
  const peak = Math.max(red, green, blue, 1e-9)
  return [red / peak, green / peak, blue / peak] as const
}

function gaussian(value: number, center: number, width: number) {
  return Math.exp(-0.5 * ((value - center) / width) ** 2)
}

function fieldStatistics(spectral: Float32Array, rgb: Float32Array, bandCount: number) {
  const meanSpectral = Array.from({ length: bandCount }, () => 0)
  const meanRgb: [number, number, number] = [0, 0, 0]
  let minimum = Number.POSITIVE_INFINITY
  let maximum = 0
  let nonFinite = 0
  let negative = 0
  const samples = spectral.length / bandCount
  spectral.forEach((value, index) => {
    if (!Number.isFinite(value)) nonFinite += 1
    if (value < 0) negative += 1
    const safe = Number.isFinite(value) && value > 0 ? value : 0
    minimum = Math.min(minimum, safe)
    maximum = Math.max(maximum, safe)
    meanSpectral[index % bandCount] += safe / samples
  })
  const rgbSamples = rgb.length / 3
  rgb.forEach((value, index) => {
    if (!Number.isFinite(value)) nonFinite += 1
    if (value < 0) negative += 1
    const safe = Number.isFinite(value) && value > 0 ? value : 0
    minimum = Math.min(minimum, safe)
    maximum = Math.max(maximum, safe)
    meanRgb[index % 3] += safe / rgbSamples
  })
  return { meanSpectral, meanRgb, minimum: Number.isFinite(minimum) ? minimum : 0, maximum, nonFinite, negative }
}

function sumInputSpectrum(emission: PhysicalGlowEmissionGrid) {
  const bandCount = emission.wavelengthsNm.length
  const output = Array.from({ length: bandCount }, () => 0)
  for (let index = 0; index < emission.upwardSpectralFlux.length; index += 1) {
    output[index % bandCount] += emission.upwardSpectralFlux[index]
  }
  return output
}

function calculateComponentFluxResidual(emission: PhysicalGlowEmissionGrid, total: readonly number[]) {
  if (!emission.components?.length) return 0
  const component = Array.from({ length: total.length }, () => 0)
  for (const entry of emission.components) {
    entry.ringSpectralFlux.forEach((value, index) => { component[index % total.length] += value })
  }
  let residual = 0
  let denominator = 0
  for (let band = 0; band < total.length; band += 1) {
    residual += Math.abs(total[band] - component[band])
    denominator += total[band]
  }
  return residual / Math.max(1e-12, denominator)
}

function distantContributionFractionFromRings(values: Float32Array, rings: ArrayLike<number>, bandCount: number) {
  let tail = 0
  let total = 0
  for (let ring = 0; ring < rings.length; ring += 1) {
    for (let band = 0; band < bandCount; band += 1) {
      const value = values[ring * bandCount + band]
      total += value
      if (rings[ring] >= 300) tail += value
    }
  }
  return tail / Math.max(1e-12, total)
}

function outerBoundaryFraction(values: Float32Array, rings: ArrayLike<number>, bandCount: number) {
  let outer = 0
  let total = 0
  const threshold = Math.max(300, rings[rings.length - 1] - 100)
  for (let ring = 0; ring < rings.length; ring += 1) {
    for (let band = 0; band < bandCount; band += 1) {
      const value = values[ring * bandCount + band]
      total += value
      if (rings[ring] >= threshold) outer += value
    }
  }
  return outer / Math.max(1e-12, total)
}

function resultTransferables(result: PhysicalGlowResult) {
  const transfer: Transferable[] = [
    result.elevationDeg.buffer,
    result.wavelengthsNm.buffer,
    result.spectralRadiance.buffer,
    result.rgbRadiance.buffer,
    result.directionalLimitingMagnitude.buffer,
    result.ringMeanSpectralRadiance.buffer,
    result.ringMeanRgbRadiance.buffer,
  ]
  for (const component of result.componentContributions) {
    transfer.push(component.meanSpectralRadiance.buffer, component.meanRgbRadiance.buffer)
  }
  return transfer
}

function postProgress(
  request: PhysicalGlowAnalyzeRequest,
  weights: PhysicalGlowProgressWeights,
  components: PhysicalGlowProgressBreakdown,
  stage: string,
  detail?: string,
) {
  if (isStale(request)) return
  const overall = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + weight * components[key as keyof PhysicalGlowProgressBreakdown],
    0,
  )
  scope.postMessage({
    type: 'progress',
    requestId: request.requestId,
    stage,
    overall: clamp(overall, 0, 1),
    components: { ...components },
    weights,
    detail,
  })
}

function normalizeWeights(input: Partial<PhysicalGlowProgressWeights> | undefined) {
  const raw = {
    emission: Math.max(0, input?.emission ?? 0.14),
    kernel: Math.max(0, input?.kernel ?? 0.48),
    propagation: Math.max(0, input?.propagation ?? 0.3),
    diagnostics: Math.max(0, input?.diagnostics ?? 0.08),
  }
  const sum = raw.emission + raw.kernel + raw.propagation + raw.diagnostics || 1
  return {
    emission: raw.emission / sum,
    kernel: raw.kernel / sum,
    propagation: raw.propagation / sum,
    diagnostics: raw.diagnostics / sum,
  }
}

function finishIfStale(request: PhysicalGlowAnalyzeRequest) {
  if (!isStale(request)) return false
  scope.postMessage({
    type: 'cancelled',
    requestId: request.requestId,
    reason: cancelled.has(request.requestId) ? 'cancelled' : 'superseded',
  })
  return true
}

function isStale(request: PhysicalGlowAnalyzeRequest) {
  return cancelled.has(request.requestId) || request.requestId !== latestAnalyzeRequest
}

function clearPlansForKernel(kernelKey: string) {
  for (const [key, plan] of planCache) if (plan.kernelKey === kernelKey) planCache.delete(key)
}

function evictKernelPlans(kernel: AtmosphericKernel) {
  clearPlansForKernel(kernel.key)
}

function lruGet<K, V>(cache: Map<K, V>, key: K) {
  const value = cache.get(key)
  if (value === undefined) return undefined
  cache.delete(key)
  cache.set(key, value)
  return value
}

function lruSet<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maximumEntries: number,
  onEvict?: (value: V) => void,
) {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > maximumEntries) {
    const oldestKey = cache.keys().next().value as K | undefined
    if (oldestKey === undefined) break
    const oldestValue = cache.get(oldestKey)
    cache.delete(oldestKey)
    if (oldestValue !== undefined) onEvict?.(oldestValue)
  }
}

function lruMakeRoom<K, V>(cache: Map<K, V>, maximumEntries: number) {
  while (cache.size >= maximumEntries) {
    const oldestKey = cache.keys().next().value as K | undefined
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

function validateNonNegative(values: ArrayLike<number>, label: string) {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index]) || values[index] < 0) throw new Error(`${label} ${index} must be finite and non-negative`)
  }
}

function toFloat64(values: ArrayLike<number>) {
  return values instanceof Float64Array ? values : Float64Array.from(values)
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

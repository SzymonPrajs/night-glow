import { useEffect, useRef, useState } from 'react'
import {
  buildEmissionGrid,
  createRegionalSettlementSources,
  type EmissionDiagnostics,
} from '../lib/emission'
import type {
  PhysicalGlowAnalyzeRequest,
  PhysicalGlowEmissionGrid,
  PhysicalGlowProgressBreakdown,
  PhysicalGlowProgressWeights,
  PhysicalGlowResult,
  PhysicalGlowWorkerMessage,
} from '../lib/physicalGlowProtocol'
import { loadPrecomputedWeatherKernel } from '../lib/precomputedWeatherKernels'
import { DEFAULT_SKY_ELEVATIONS_DEG } from '../lib/physics'
import type { Atmosphere, Location } from '../types'

const REGIONAL_SOURCES = createRegionalSettlementSources()
const MAX_EMISSION_CACHE_ENTRIES = 3

const EMPTY_COMPONENTS: PhysicalGlowProgressBreakdown = {
  emission: 0,
  kernel: 0,
  propagation: 0,
  diagnostics: 0,
}
const DEFAULT_WEIGHTS: PhysicalGlowProgressWeights = {
  emission: 0.08,
  kernel: 0.8,
  propagation: 0.08,
  diagnostics: 0.04,
}

export type PhysicalGlowAnalysisState = {
  status: 'idle' | 'loading' | 'live' | 'error'
  progress: number
  stage: string
  detail?: string
  components: PhysicalGlowProgressBreakdown
  weights: PhysicalGlowProgressWeights
  result?: PhysicalGlowResult
  error?: string
  emissionBuildMs?: number
  emissionDiagnostics?: EmissionDiagnostics
}

const INITIAL_STATE: PhysicalGlowAnalysisState = {
  status: 'idle',
  progress: 0,
  stage: 'Waiting for source data',
  components: EMPTY_COMPONENTS,
  weights: DEFAULT_WEIGHTS,
}

export function usePhysicalGlow(
  location: Location,
  atmosphere: Atmosphere,
) {
  const [state, setState] = useState<PhysicalGlowAnalysisState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const activeRequestRef = useRef<number | null>(null)
  const confirmedEmissionKeysRef = useRef(new Set<string>())
  const emissionMetadataRef = useRef(new Map<string, {
    buildMs: number
    diagnostics: EmissionDiagnostics
    ringCount: number
    sectorCount: number
  }>())
  const activeEmissionRef = useRef<{ requestId: number; cacheKey: string } | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/physicalGlow.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    confirmedEmissionKeysRef.current = new Set()
    emissionMetadataRef.current = new Map()
    activeEmissionRef.current = null
    worker.onmessage = (event: MessageEvent<PhysicalGlowWorkerMessage>) => {
      const message = event.data
      if (message.requestId !== activeRequestRef.current) return
      if (message.type === 'progress') {
        setState((current) => ({
          ...current,
          status: 'loading',
          progress: Math.max(current.progress, message.overall * 100),
          stage: message.stage,
          detail: message.detail,
          components: {
            emission: Math.max(current.components.emission, message.components.emission),
            kernel: Math.max(current.components.kernel, message.components.kernel),
            propagation: Math.max(current.components.propagation, message.components.propagation),
            diagnostics: Math.max(current.components.diagnostics, message.components.diagnostics),
          },
          weights: message.weights,
          error: undefined,
        }))
      } else if (message.type === 'result') {
        const activeEmission = activeEmissionRef.current
        if (activeEmission?.requestId === message.requestId) {
          const confirmed = confirmedEmissionKeysRef.current
          confirmed.delete(activeEmission.cacheKey)
          confirmed.add(activeEmission.cacheKey)
          while (confirmed.size > MAX_EMISSION_CACHE_ENTRIES) {
            const oldest = confirmed.values().next().value as string | undefined
            if (!oldest) break
            confirmed.delete(oldest)
            emissionMetadataRef.current.delete(oldest)
          }
        }
        const kernelStatus = message.result.diagnostics.kernelMode === 'inline'
          ? message.result.diagnostics.kernelCacheHit ? 'cached preset' : 'precomputed preset'
          : message.result.diagnostics.kernelCacheHit ? 'cached' : 'new'
        setState((current) => ({
          ...current,
          status: 'live',
          progress: 100,
          stage: 'Physical sky field ready',
          detail: `${message.result.timings.totalMs.toFixed(0)} ms · ${kernelStatus} kernel · ${message.result.diagnostics.nonFiniteCount + message.result.diagnostics.negativeCount} invalid`,
          components: { emission: 1, kernel: 1, propagation: 1, diagnostics: 1 },
          result: message.result,
          error: undefined,
        }))
        activeRequestRef.current = null
        activeEmissionRef.current = null
      } else if (message.type === 'error') {
        setState((current) => ({
          ...current,
          status: 'error',
          stage: 'Physical analysis failed',
          error: message.message,
        }))
        activeRequestRef.current = null
        activeEmissionRef.current = null
      } else if (message.type === 'cancelled') {
        activeRequestRef.current = null
        activeEmissionRef.current = null
      }
    }
    worker.onerror = (event) => {
      setState((current) => ({
        ...current,
        status: 'error',
        stage: 'Physical worker failed',
        error: event.message || 'The physical sky worker stopped unexpectedly.',
      }))
    }
    return () => {
      worker.terminate()
      workerRef.current = null
      activeRequestRef.current = null
      activeEmissionRef.current = null
    }
  }, [])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    const requestId = ++requestIdRef.current
    const abortController = new AbortController()
    const timer = window.setTimeout(async () => {
      const previousRequest = activeRequestRef.current
      if (previousRequest != null) worker.postMessage({ type: 'cancel', requestId: previousRequest })
      activeRequestRef.current = requestId
      const emissionCacheKey = makeEmissionCacheKey(location)
      const cached = confirmedEmissionKeysRef.current.has(emissionCacheKey)
      setState((current) => ({
        ...current,
        status: 'loading',
        progress: cached ? 8 : 2,
        stage: cached ? 'Reusing regional source footprints' : 'Integrating regional source footprints',
        detail: cached
          ? 'The observer is unchanged; reusing its confirmed directional source grid'
          : `Integrating ${REGIONAL_SOURCES.length.toLocaleString()} bundled settlement footprints`,
        components: { emission: cached ? 1 : 0.08, kernel: 0, propagation: 0, diagnostics: 0 },
        error: undefined,
      }))

      try {
        // A posted inline request may be cancelled during its debounce before
        // the worker has installed the field. Only a completed result confirms
        // that a cache-only follow-up is safe.
        let metadata = emissionMetadataRef.current.get(emissionCacheKey)
        let protocolGrid: PhysicalGlowEmissionGrid | undefined
        if (!cached) {
          const started = performance.now()
          const emission = buildEmissionGrid({
            observer: location,
            sources: REGIONAL_SOURCES,
            sampleSpacingKm: 0.5,
            maxSamplesPerSource: 4096,
          })
          metadata = {
            buildMs: performance.now() - started,
            diagnostics: emission.diagnostics,
            ringCount: emission.rings.length,
            sectorCount: emission.sectorCount,
          }
          emissionMetadataRef.current.set(emissionCacheKey, metadata)
          protocolGrid = toProtocolGrid(emission)
        }
        if (!metadata) throw new Error('Confirmed source grid is missing its diagnostics')
        let precomputedKernel: Awaited<ReturnType<typeof loadPrecomputedWeatherKernel>> = null
        try {
          precomputedKernel = await loadPrecomputedWeatherKernel(
            atmosphere,
            abortController.signal,
          )
        } catch (error) {
          if (abortController.signal.aborted) return
          setState((current) => ({
            ...current,
            stage: 'Computing atmosphere kernel',
            detail: `Preset cache unavailable; using the live solver (${error instanceof Error ? error.message : 'load failed'})`,
          }))
        }
        if (activeRequestRef.current !== requestId) return
        const request: PhysicalGlowAnalyzeRequest = {
          type: 'analyze',
          requestId,
          observer: { lat: location.lat, lon: location.lon, altitudeKm: 0.15 },
          atmosphere: toPhysicalAtmosphere(atmosphere),
          emission: cached
            ? { kind: 'cache', cacheKey: emissionCacheKey }
            : { kind: 'inline', cacheKey: emissionCacheKey, grid: protocolGrid! },
          kernel: precomputedKernel
            ? { kind: 'inline', ...precomputedKernel }
            : { kind: 'auto', elevationDeg: Float32Array.from(DEFAULT_SKY_ELEVATIONS_DEG) },
          options: {
            debounceMs: 80,
            progressWeights: DEFAULT_WEIGHTS,
            naturalSkyRadianceRgb: [0.0016, 0.002, 0.0032],
            darkSkyLimitingMagnitude: 7.15,
            limitingMagnitudeSlope: 1.18,
            estimateOuterBoundary: true,
          },
        }
        const transfer = protocolGrid ? transferableBuffers(protocolGrid) : []
        if (precomputedKernel) transfer.push(...transferableKernelBuffers(precomputedKernel.kernel))
        activeEmissionRef.current = { requestId, cacheKey: emissionCacheKey }
        worker.postMessage(request, transfer)
        setState((current) => ({
          ...current,
          emissionBuildMs: cached ? 0 : metadata.buildMs,
          emissionDiagnostics: metadata.diagnostics,
          components: { ...current.components, emission: cached ? 1 : 0.92 },
          detail: cached
            ? `${metadata.ringCount} rings × ${metadata.sectorCount} bearings · cached source grid`
            : `${metadata.ringCount} rings × ${metadata.sectorCount} bearings · ${metadata.buildMs.toFixed(0)} ms source integration`,
        }))
      } catch (error) {
        if (abortController.signal.aborted || activeRequestRef.current !== requestId) return
        setState((current) => ({
          ...current,
          status: 'error',
          stage: 'Source integration failed',
          error: error instanceof Error ? error.message : 'Unable to build the polar emission field.',
        }))
      }
    }, 120)

    return () => {
      window.clearTimeout(timer)
      abortController.abort()
      if (activeRequestRef.current === requestId) worker.postMessage({ type: 'cancel', requestId })
    }
  }, [location, atmosphere])

  return state
}

function toProtocolGrid(emission: ReturnType<typeof buildEmissionGrid>): PhysicalGlowEmissionGrid {
  return {
    sectorCount: emission.sectorCount,
    ringRadiiKm: Float64Array.from(emission.rings, (ring) => ring.midpointKm),
    wavelengthsNm: Float64Array.from(emission.bands, (band) => band.wavelengthNm),
    upwardSpectralFlux: emission.values,
    components: [...emission.componentRingValues].map(([id, ringSpectralFlux]) => ({
      id,
      label: componentLabel(id),
      ringSpectralFlux,
    })),
    fluxUnit: emission.fluxUnit,
  }
}

function toPhysicalAtmosphere(atmosphere: Atmosphere) {
  return {
    aod550: atmosphere.aerosol,
    angstromExponent: atmosphere.angstromExponent,
    aerosolScaleHeightKm: atmosphere.aerosolScaleHeightKm,
    aerosolAsymmetry: atmosphere.aerosolAsymmetry,
    singleScatteringAlbedo: atmosphere.aerosolSingleScatteringAlbedo,
    relativeHumidity: atmosphere.humidity,
    cloudFraction: atmosphere.cloud,
    cloudBaseKm: atmosphere.cloudBase,
    cloudThicknessKm: atmosphere.cloudThicknessKm,
    cloudOpticalDepth: atmosphere.cloudOpticalDepth,
    groundAlbedo: atmosphere.groundAlbedo,
    maxScatteringOrder: atmosphere.maxScatteringOrder,
  }
}

function transferableBuffers(grid: PhysicalGlowEmissionGrid) {
  const buffers: Transferable[] = [
    grid.ringRadiiKm.buffer,
    grid.wavelengthsNm.buffer,
    grid.upwardSpectralFlux.buffer,
  ]
  if (grid.coverage) buffers.push(grid.coverage.buffer)
  if (grid.confidence) buffers.push(grid.confidence.buffer)
  for (const component of grid.components ?? []) buffers.push(component.ringSpectralFlux.buffer)
  return buffers
}

function transferableKernelBuffers(kernel: NonNullable<
  Awaited<ReturnType<typeof loadPrecomputedWeatherKernel>>
>['kernel']) {
  return [
    kernel.distanceKm.buffer,
    kernel.relativeAzimuthDeg.buffer,
    kernel.elevationDeg.buffer,
    kernel.wavelengthsNm.buffer,
    kernel.values.buffer,
  ] as Transferable[]
}

function makeEmissionCacheKey(location: Location) {
  let hash = 0x811c9dc5
  const value = `regional-v1|${location.lat.toFixed(5)},${location.lon.toFixed(5)}`
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `emission-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function componentLabel(id: string) {
  return ({
    'settlement-proxy': 'Regional settlements',
  } as Record<string, string>)[id] ?? id
}

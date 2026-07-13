import { useEffect, useRef, useState } from 'react'
import {
  buildEmissionGrid,
  fuseOsmWithRegionalEmission,
  type EmissionDiagnostics,
  type OsmRegionalFusionDiagnostics,
} from '../lib/emission'
import type {
  PhysicalGlowAnalyzeRequest,
  PhysicalGlowEmissionGrid,
  PhysicalGlowProgressBreakdown,
  PhysicalGlowProgressWeights,
  PhysicalGlowResult,
  PhysicalGlowWorkerMessage,
} from '../lib/physicalGlowProtocol'
import type { Atmosphere, LightSource, Location } from '../types'

const ELEVATION_NODES = new Float32Array([0, 2, 5, 10, 15, 20, 30, 45, 60, 75, 90])
const EMPTY_COMPONENTS: PhysicalGlowProgressBreakdown = {
  emission: 0,
  kernel: 0,
  propagation: 0,
  diagnostics: 0,
}
const DEFAULT_WEIGHTS: PhysicalGlowProgressWeights = {
  emission: 0.14,
  kernel: 0.48,
  propagation: 0.3,
  diagnostics: 0.08,
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
  fusionDiagnostics?: OsmRegionalFusionDiagnostics
  dataMode: 'regional' | 'regional+osm'
}

const INITIAL_STATE: PhysicalGlowAnalysisState = {
  status: 'idle',
  progress: 0,
  stage: 'Waiting for source data',
  components: EMPTY_COMPONENTS,
  weights: DEFAULT_WEIGHTS,
  dataMode: 'regional',
}

export function usePhysicalGlow(
  location: Location,
  mappedSources: readonly LightSource[],
  atmosphere: Atmosphere,
) {
  const [state, setState] = useState<PhysicalGlowAnalysisState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const activeRequestRef = useRef<number | null>(null)
  const confirmedEmissionKeysRef = useRef(new Set<string>())
  const activeEmissionRef = useRef<{ requestId: number; cacheKey: string } | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/physicalGlow.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    confirmedEmissionKeysRef.current = new Set()
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
          confirmedEmissionKeysRef.current.add(activeEmission.cacheKey)
        }
        setState((current) => ({
          ...current,
          status: 'live',
          progress: 100,
          stage: 'Physical sky field ready',
          detail: `${message.result.timings.totalMs.toFixed(0)} ms · ${message.result.diagnostics.kernelCacheHit ? 'cached' : 'new'} kernel · ${message.result.diagnostics.nonFiniteCount + message.result.diagnostics.negativeCount} invalid`,
          components: { emission: 1, kernel: 1, propagation: 1, diagnostics: 1 },
          result: message.result,
          error: undefined,
        }))
      } else if (message.type === 'error') {
        setState((current) => ({
          ...current,
          status: 'error',
          stage: 'Physical analysis failed',
          error: message.message,
        }))
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
    const timer = window.setTimeout(() => {
      const previousRequest = activeRequestRef.current
      if (previousRequest != null) worker.postMessage({ type: 'cancel', requestId: previousRequest })
      activeRequestRef.current = requestId
      setState((current) => ({
        ...current,
        status: 'loading',
        progress: 2,
        stage: 'Integrating extended source footprints',
        detail: mappedSources.length
          ? `Fusing ${mappedSources.length.toLocaleString()} mapped features with the regional field`
          : 'Loading the bundled regional field while local map detail arrives',
        components: { emission: 0.08, kernel: 0, propagation: 0, diagnostics: 0 },
        error: undefined,
        dataMode: mappedSources.length ? 'regional+osm' : 'regional',
      }))

      try {
        const started = performance.now()
        const fusion = fuseOsmWithRegionalEmission(mappedSources)
        const emission = buildEmissionGrid({
          observer: location,
          sources: fusion.sources,
          sampleSpacingKm: 0.5,
          maxSamplesPerSource: 4096,
        })
        const emissionBuildMs = performance.now() - started
        const emissionCacheKey = makeEmissionCacheKey(location, mappedSources)
        // A posted inline request may be cancelled during its debounce before
        // the worker has installed the field. Only a completed result confirms
        // that a cache-only follow-up is safe.
        const cached = confirmedEmissionKeysRef.current.has(emissionCacheKey)
        const protocolGrid = cached ? undefined : toProtocolGrid(emission)
        const request: PhysicalGlowAnalyzeRequest = {
          type: 'analyze',
          requestId,
          observer: { lat: location.lat, lon: location.lon, altitudeKm: 0.15 },
          atmosphere: toPhysicalAtmosphere(atmosphere),
          emission: cached
            ? { kind: 'cache', cacheKey: emissionCacheKey }
            : { kind: 'inline', cacheKey: emissionCacheKey, grid: protocolGrid! },
          kernel: { kind: 'auto', elevationDeg: ELEVATION_NODES.slice() },
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
        activeEmissionRef.current = { requestId, cacheKey: emissionCacheKey }
        worker.postMessage(request, transfer)
        setState((current) => ({
          ...current,
          emissionBuildMs,
          emissionDiagnostics: emission.diagnostics,
          fusionDiagnostics: fusion.diagnostics,
          components: { ...current.components, emission: 0.92 },
          detail: `${emission.rings.length} rings × ${emission.sectorCount} bearings · ${emissionBuildMs.toFixed(0)} ms source integration`,
        }))
      } catch (error) {
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
      if (activeRequestRef.current === requestId) worker.postMessage({ type: 'cancel', requestId })
    }
  }, [location, mappedSources, atmosphere])

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

function makeEmissionCacheKey(location: Location, sources: readonly LightSource[]) {
  let hash = 0x811c9dc5
  const value = `${location.lat.toFixed(5)},${location.lon.toFixed(5)}|${sources.map((source) =>
    `${source.id}:${source.flux.toFixed(4)}:${source.geometry?.points.length ?? 0}`).join('|')}`
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `emission-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function componentLabel(id: string) {
  return ({
    'settlement-proxy': 'Regional settlements',
    'settlement-residual': 'Regional residual',
    'settlement-refined': 'Mapped built-up detail',
    'osm-built-proxy': 'Local built-up areas',
    'osm-road-proxy': 'Uncovered roads',
    'osm-place-proxy': 'Mapped settlements',
  } as Record<string, string>)[id] ?? id
}

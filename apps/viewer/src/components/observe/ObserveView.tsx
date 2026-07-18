'use client'

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppState } from '../shell/app-state.tsx'
import { EMPTY_STATUS, reduceRuntime, type RuntimeStatus } from '../../lib/status/model.ts'
import {
  loadAtmosphereRelease,
  loadEmissionRelease,
  loadEnvironmentDisplayProducts,
  loadObserverScenarioTemplate,
  loadRuntimeCompatibilityManifest,
  loadWasmModules,
  type AtmosphereRelease,
  type EmissionRelease,
} from '../../lib/fixtures/client.ts'
import { CoordinatorClient, CoordinatorFailure } from '../../lib/worker/coordinator-client.ts'
import { buildAtmospherePayload, buildEmissionPayload, buildScenario } from '../../lib/scenario/build-scenario.ts'
import {
  FIXTURE_DEFAULTS,
  buildGlobeQuery,
  buildObserveQuery,
  parseObserveState,
  type ObserveUrlState,
} from '../../lib/scenario/url-state.ts'
import type {
  CoordinatorCapabilities,
  EnvironmentDisplayProduct,
  FailureInfo,
  ObserverRenderProduct,
  ObserverScenario,
  ProgressStage,
} from '../../lib/contracts/types.ts'
import { buildCellFeatures, cellsToGeoJSON, rampForProduct } from '../globe/grid.ts'
import { formatLatLon } from '../../lib/format.ts'
import { SkyEngine, type SkyCamera } from './sky-engine.ts'
import TimeBar from './TimeBar.tsx'
import DisplayControl from './DisplayControl.tsx'
import ProgressStages from './ProgressStages.tsx'
import styles from './observe.module.css'

const MiniMap = lazy(() => import('./MiniMap.tsx'))

interface Session {
  client: CoordinatorClient
  capabilities: CoordinatorCapabilities
  template: ObserverScenario
  emission: EmissionRelease
  atmosphere: AtmosphereRelease
}

function compassDirection(azimuthDeg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8]
}

function supportsWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

function failureNote(failure: FailureInfo): string {
  if (failure.category === 'missing_asset') return failure.message
  if (failure.category === 'incompatible_semantics' || failure.category === 'insufficient_evidence') {
    return (
      'This fixture slice provides one atmosphere state (standard scenario, valid ' +
      `${FIXTURE_DEFAULTS.requestedTimeUtc}). Other times cannot be computed yet — the request ` +
      `failed closed (${failure.category}) instead of fabricating a sky.`
    )
  }
  return failure.message
}

// The Sky view: the physically rendered sky for one committed place and time.
// Physical controls (place, time) create new scenario revisions through the
// coordinator; display controls act on the retained HDR product only.
export default function ObserveView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const state = parseObserveState(searchParams)
  const stateRef = useRef(state)
  const statusRef = useRef<RuntimeStatus>(EMPTY_STATUS)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SkyEngine | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const revisionRef = useRef(0)
  const timingsRef = useRef<Partial<Record<ProgressStage, number>>>({})
  const lastStageRef = useRef<{ stage: ProgressStage; at: number } | null>(null)
  const productRef = useRef<ObserverRenderProduct | null>(null)
  const scenarioRef = useRef<ObserverScenario | null>(null)

  const [webgl2, setWebgl2] = useState(supportsWebGL2)
  const [engineReady, setEngineReady] = useState(false)
  const [status, setStatus] = useState<RuntimeStatus>(EMPTY_STATUS)
  const [camera, setCamera] = useState<SkyCamera>({ azimuthDeg: 180, altitudeDeg: 20, fovDeg: 60 })
  const [exposureStops, setExposureStops] = useState(0)
  const [enhance, setEnhance] = useState(0)
  const [miniMapOpen, setMiniMapOpen] = useState(false)
  const [contextCells, setContextCells] = useState<GeoJSON.FeatureCollection | null>(null)

  const { setRuntime, setScience, setInspectorData } = useAppState()

  const applyStatus = useCallback(
    (next: RuntimeStatus) => {
      statusRef.current = next
      setStatus(next)
      setRuntime(next)
    },
    [setRuntime],
  )

  // Commit a scenario revision through the coordinator for the given URL state.
  const publishInspector = useCallback(
    (session: Session, failure?: FailureInfo) => {
      setInspectorData({
        scenario: scenarioRef.current ?? undefined,
        product: productRef.current,
        capabilities: session.capabilities,
        stageTimings: timingsRef.current,
        failure: failure ?? null,
        resolutions: {
          environmentSource: `emission 2 × 2 cells · atmosphere 2 × 2 × 3`,
          physicsAngular: 'fixture first-slice scalar solve (no angular grid)',
          renderProduct: productRef.current
            ? `${productRef.current.shape[1]} azimuth × ${productRef.current.shape[0]} elevation × ${productRef.current.shape[2]} linear RGB`
            : '—',
          canvas: canvasRef.current
            ? `${canvasRef.current.width} × ${canvasRef.current.height} device px`
            : '—',
        },
      })
    },
    [setInspectorData],
  )

  const commit = useCallback(
    (committed: ObserveUrlState) => {
      const session = sessionRef.current
      if (!session) return
      applyStatus(reduceRuntime(statusRef.current, { type: 'begin' }))
      const revision = ++revisionRef.current
      const scenario = buildScenario(
        {
          latitudeDeg: committed.latitudeDeg,
          longitudeDeg: committed.longitudeDeg,
          heightM: committed.heightM,
          requestedTimeUtc: committed.requestedTimeUtc,
          scenarioRevision: revision,
        },
        session.template,
      )
      timingsRef.current = {}
      lastStageRef.current = null
      session.client
        .commitScenario(
          {
            scenario,
            emission: buildEmissionPayload(session.emission),
            atmosphere: buildAtmospherePayload(session.atmosphere),
          },
          (stage, completed) => {
            const now = performance.now()
            if (lastStageRef.current) {
              timingsRef.current[lastStageRef.current.stage] = now - lastStageRef.current.at
            }
            lastStageRef.current = { stage, at: now }
            applyStatus(reduceRuntime(statusRef.current, { type: 'progress', stage, completed }))
          },
        )
        .then((product) => {
          if (lastStageRef.current) {
            timingsRef.current[lastStageRef.current.stage] = performance.now() - lastStageRef.current.at
            lastStageRef.current = null
          }
          productRef.current = product
          scenarioRef.current = scenario
          engineRef.current?.upload(product)
          applyStatus(reduceRuntime(statusRef.current, { type: 'product' }))
          setScience({
            fidelity: product.fidelity === 'synthetic-contract-only' ? 'synthetic fixture' : product.fidelity,
            atmosphereLabel: `standard scenario · ${session.atmosphere.selection.standard_scenario_id}`,
          })
          publishInspector(session)
        })
        .catch((error: unknown) => {
          const failure: FailureInfo =
            error instanceof CoordinatorFailure
              ? { category: error.category, message: error.message }
              : { category: 'runtime_failure', message: error instanceof Error ? error.message : String(error) }
          if (failure.category === 'cancelled') return // superseded; newer request owns status
          applyStatus(reduceRuntime(statusRef.current, { type: 'failure', failure }))
          publishInspector(session, failure)
        })
    },
    [applyStatus, setScience, publishInspector],
  )

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Mount the engine and the coordinator session once.
  useEffect(() => {
    if (!webgl2) return
    let disposed = false
    let engine: SkyEngine | null = null
    let client: CoordinatorClient | null = null
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    ;(async () => {
      if (!canvasRef.current) return
      try {
        engine = new SkyEngine(canvasRef.current, {
          onCameraSettled: (nextCamera) => setCamera(nextCamera),
        })
      } catch {
        // supportsWebGL2() passed but context creation still failed: defer the
        // fallback so state settles after mount, then render the static note.
        fallbackTimer = setTimeout(() => {
          if (!disposed) setWebgl2(false)
        }, 0)
        return
      }
      if (disposed) {
        engine.dispose()
        return
      }
      engineRef.current = engine
      setEngineReady(true)
      applyStatus(reduceRuntime(statusRef.current, { type: 'begin' }))

      const [wasm, compatibilityManifest, template, emission, atmosphere, display] = await Promise.all([
        loadWasmModules(),
        loadRuntimeCompatibilityManifest(),
        loadObserverScenarioTemplate(),
        loadEmissionRelease(),
        loadAtmosphereRelease(),
        loadEnvironmentDisplayProducts(),
      ])
      if (disposed) return
      client = CoordinatorClient.create()
      const capabilities = await client.initialize({ ...wasm, compatibilityManifest })
      if (disposed) {
        void client.dispose()
        return
      }
      sessionRef.current = { client, capabilities, template, emission, atmosphere }
      // Faint emission-cell context for the mini-map.
      const emissionProduct = display.products.find(
        (product: EnvironmentDisplayProduct) => product.source_domain === 'emission',
      )
      if (emissionProduct) {
        const ramp = rampForProduct(emissionProduct)
        const longitudes = [...new Set(emission.cells.map((cell) => cell.center_wgs84_deg[0]))].sort((a, b) => a - b)
        const latitudes = [...new Set(emission.cells.map((cell) => cell.center_wgs84_deg[1]))].sort((a, b) => a - b)
        const coverageByIndex = latitudes.flatMap((lat) =>
          longitudes.map(
            (lon) =>
              emission.cells.find((cell) => cell.center_wgs84_deg[0] === lon && cell.center_wgs84_deg[1] === lat)
                ?.coverage_status ?? null,
          ),
        )
        setContextCells(
          cellsToGeoJSON(
            buildCellFeatures(emissionProduct, { longitudes, latitudes, coverageByIndex }, ramp),
          ),
        )
      }
      commit(stateRef.current)
    })().catch((error: unknown) => {
      if (disposed) return
      const failure: FailureInfo =
        error instanceof CoordinatorFailure
          ? { category: error.category, message: error.message }
          : {
              category: 'missing_asset',
              message: error instanceof Error ? error.message : String(error),
            }
      applyStatus({ kind: 'failed', failure })
      setInspectorData({ failure })
    })

    return () => {
      disposed = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
      sessionRef.current = null
      productRef.current = null
      scenarioRef.current = null
      const currentClient = client
      client = null
      if (currentClient) void currentClient.dispose()
      engine?.dispose()
      engineRef.current = null
      setEngineReady(false)
      applyStatus(EMPTY_STATUS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl2])

  // Recompute when the committed URL scenario changes (place, time).
  const committedKey = `${state.latitudeDeg}|${state.longitudeDeg}|${state.heightM}|${state.requestedTimeUtc}`
  const committedKeyRef = useRef(committedKey)
  useEffect(() => {
    if (committedKeyRef.current === committedKey) return
    committedKeyRef.current = committedKey
    if (sessionRef.current) commit(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedKey])

  // Resize observer for the canvas.
  useEffect(() => {
    if (!engineReady || !canvasRef.current) return
    const observer = new ResizeObserver(() => engineRef.current?.resize())
    observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [engineReady])

  const commitTime = (iso: string) => {
    router.push(`/observe?${buildObserveQuery({ ...stateRef.current, requestedTimeUtc: iso }).toString()}`)
  }

  const commitLocation = (latitudeDeg: number, longitudeDeg: number) => {
    router.push(`/observe?${buildObserveQuery({ ...stateRef.current, latitudeDeg, longitudeDeg }).toString()}`)
  }

  const backToGlobe = `/globe?${buildGlobeQuery({
    layer: FIXTURE_DEFAULTS.defaultLayerId,
    requestedTimeUtc: state.requestedTimeUtc,
    latitudeDeg: state.latitudeDeg,
    longitudeDeg: state.longitudeDeg,
    zoom: FIXTURE_DEFAULTS.globeZoom,
  }).toString()}`

  const busy = status.kind === 'computing' || status.kind === 'updating'
  const showStages = busy && 'stage' in status

  return (
    <main className={styles.view}>
      {webgl2 ? (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          aria-label={
            'Sky view. Drag to look around, scroll to zoom. Arrow keys look, plus and minus zoom, ' +
            'Home resets the view.'
          }
        />
      ) : (
        <div className={styles.unsupported}>
          <p role="note">WebGL2 is unavailable, so the sky cannot be rendered on this device.</p>
        </div>
      )}

      <div className={styles.locationChip}>
        <span className="mono">{formatLatLon(state.latitudeDeg, state.longitudeDeg)}</span>
        <span className={styles.locationMeta}>
          <span className="mono">{Math.round(state.heightM)} m</span> ·{' '}
          <a href={backToGlobe}>globe</a>
        </span>
      </div>

      {status.kind === 'updating' || status.kind === 'stale-error' ? (
        <div className={styles.retainedNote} role="note">
          {status.kind === 'updating' ? (
            'Updating from the previous scenario — the current sky stays until the new one is coherent.'
          ) : (
            <>
              {`Kept the previous sky: ${failureNote(status.failure)} `}
              {status.failure.category !== 'missing_asset' ? (
                <button
                  type="button"
                  className={styles.retainedAction}
                  onClick={() => commitTime(FIXTURE_DEFAULTS.requestedTimeUtc)}
                >
                  Use the fixture time
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {status.kind === 'failed' ? (
        <div className={styles.failedPanel} role="alert">
          <p className={styles.failedTitle}>The sky could not be computed for this request.</p>
          <p className={styles.failedMessage}>{failureNote(status.failure)}</p>
          {status.failure.category !== 'missing_asset' ? (
            <button
              type="button"
              className={styles.moveButton}
              onClick={() => commitTime(FIXTURE_DEFAULTS.requestedTimeUtc)}
            >
              Use the fixture time ({FIXTURE_DEFAULTS.requestedTimeUtc})
            </button>
          ) : null}
        </div>
      ) : null}

      {showStages ? (
        <div className={styles.progressAnchor}>
          <ProgressStages stage={status.stage} completed={status.completed} />
        </div>
      ) : null}

      {webgl2 ? (
        <>
          <div className={styles.readout} aria-live="off">
            <span className="mono">
              {compassDirection(camera.azimuthDeg)} {Math.round(camera.azimuthDeg)}° · alt{' '}
              {Math.round(camera.altitudeDeg)}° · {Math.round(camera.fovDeg)}° field
            </span>
          </div>
          <div className={styles.miniMapAnchor}>
            {miniMapOpen ? (
              <Suspense fallback={<div className={styles.miniMapLoading}>Loading map…</div>}>
                <MiniMap
                  latitudeDeg={state.latitudeDeg}
                  longitudeDeg={state.longitudeDeg}
                  camera={camera}
                  contextCells={contextCells}
                  onRelocate={(lat, lon) => {
                    commitLocation(lat, lon)
                    setMiniMapOpen(false)
                  }}
                />
              </Suspense>
            ) : null}
            <button
              type="button"
              className={styles.chromeButton}
              aria-expanded={miniMapOpen}
              onClick={() => setMiniMapOpen((open) => !open)}
            >
              Map
            </button>
          </div>
          <div className={styles.timeAnchor}>
            <TimeBar committedTimeUtc={state.requestedTimeUtc} onCommit={commitTime} />
          </div>
          <DisplayControl
            exposureStops={exposureStops}
            enhance={enhance}
            onExposureChange={(stops) => {
              setExposureStops(stops)
              engineRef.current?.setExposureStops(stops)
            }}
            onEnhanceChange={(value) => {
              setEnhance(value)
              engineRef.current?.setEnhance(value)
            }}
          />
        </>
      ) : null}
    </main>
  )
}

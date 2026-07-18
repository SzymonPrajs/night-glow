'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppState } from '../shell/app-state.tsx'
import { EMPTY_STATUS } from '../../lib/status/model.ts'
import {
  loadAtmosphereRelease,
  loadEmissionRelease,
  loadEnvironmentDisplayProducts,
  type AtmosphereRelease,
  type EmissionRelease,
} from '../../lib/fixtures/client.ts'
import type { EnvironmentDisplayProduct } from '../../lib/contracts/types.ts'
import {
  FIXTURE_DEFAULTS,
  buildGlobeQuery,
  buildObserveQuery,
  parseGlobeState,
} from '../../lib/scenario/url-state.ts'
import { formatLatLon, formatUtc, formatValue } from '../../lib/format.ts'
import { GlobeEngine } from './globe-engine.ts'
import { buildCellFeatures, rampForProduct, type ProductGeometry } from './grid.ts'
import LayerDock, { type LegendModel } from './LayerDock.tsx'
import PlaceCard, { type PlaceCardData } from './PlaceCard.tsx'
import styles from './globe.module.css'

interface GlobeData {
  products: EnvironmentDisplayProduct[]
  emission: EmissionRelease
  atmosphere: AtmosphereRelease
  schemaRevision: string
}

function supportsWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

function geometryFor(product: EnvironmentDisplayProduct, data: GlobeData): ProductGeometry {
  if (product.source_domain === 'emission') {
    const longitudes = [...new Set(data.emission.cells.map((cell) => cell.center_wgs84_deg[0]))].sort(
      (a, b) => a - b,
    )
    const latitudes = [...new Set(data.emission.cells.map((cell) => cell.center_wgs84_deg[1]))].sort(
      (a, b) => a - b,
    )
    const coverageByIndex = latitudes.flatMap((lat) =>
      longitudes.map(
        (lon) =>
          data.emission.cells.find(
            (cell) => cell.center_wgs84_deg[0] === lon && cell.center_wgs84_deg[1] === lat,
          )?.coverage_status ?? null,
      ),
    )
    return { longitudes, latitudes, coverageByIndex }
  }
  return {
    longitudes: data.atmosphere.axes.longitude_deg_east,
    latitudes: data.atmosphere.axes.latitude_deg_north,
  }
}

// The Globe view: a scientific thematic map of Environment display products
// and the geographic entry point into the Sky. A cell's colour is a typed
// quantity with validity and provenance, never a picture of the sky.
export default function GlobeView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const state = parseGlobeState(searchParams)
  const stateRef = useRef(state)

  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GlobeEngine | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [webgl2] = useState(supportsWebGL2)
  const [data, setData] = useState<GlobeData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pick, setPick] = useState<PlaceCardData | null>(null)
  const [inspection, setInspection] = useState(false)
  const [halo, setHalo] = useState(true)

  const { setRuntime, setScience, setInspectorData } = useAppState()

  const activeProduct =
    data?.products.find((product) => product.environment_display_product_id === state.layer) ??
    data?.products[0] ??
    null

  // Latest-value mirrors for engine callbacks (map events fire post-commit).
  const activeProductRef = useRef(activeProduct)
  useEffect(() => {
    stateRef.current = state
    activeProductRef.current = activeProduct
  })

  // Load the display products and their source releases once per mount.
  useEffect(() => {
    let cancelled = false
    setRuntime(EMPTY_STATUS)
    Promise.all([loadEnvironmentDisplayProducts(), loadEmissionRelease(), loadAtmosphereRelease()])
      .then(([display, emission, atmosphere]) => {
        if (cancelled) return
        setData({
          products: display.products,
          emission,
          atmosphere,
          schemaRevision: display.environment_display_schema_revision,
        })
        setScience({
          fidelity: 'synthetic fixture · display products',
          atmosphereLabel: `standard scenario · ${atmosphere.selection.standard_scenario_id}`,
        })
        setInspectorData({
          environmentDisplay: {
            schemaRevision: display.environment_display_schema_revision,
            products: display.products,
          },
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setLoadError(message)
        setRuntime({ kind: 'failed', failure: { category: 'missing_asset', message } })
      })
    return () => {
      cancelled = true
    }
  }, [setRuntime, setScience, setInspectorData])

  // Mount the MapLibre engine once; it owns the map lifecycle.
  useEffect(() => {
    if (!webgl2) return
    let disposed = false
    let engine: GlobeEngine | null = null
    ;(async () => {
      const maplibregl = (await import('maplibre-gl')).default
      if (disposed || !containerRef.current) return
      engine = new GlobeEngine(maplibregl, containerRef.current, {
        center: [stateRef.current.longitudeDeg, stateRef.current.latitudeDeg],
        zoom: stateRef.current.zoom,
        onMoveEnd: (center, zoom) => {
          const current = stateRef.current
          const changed =
            Math.abs(current.longitudeDeg - center[0]) > 1e-6 ||
            Math.abs(current.latitudeDeg - center[1]) > 1e-6 ||
            Math.abs(current.zoom - zoom) > 1e-3
          if (!changed) return
          router.replace(
            `/globe?${buildGlobeQuery({
              ...current,
              longitudeDeg: Math.round(center[0] * 1e4) / 1e4,
              latitudeDeg: Math.round(center[1] * 1e4) / 1e4,
              zoom: Math.round(zoom * 100) / 100,
            }).toString()}`,
          )
        },
        onPick: (props, lngLat, point) => {
          const product = activeProductRef.current
          if (!product) return
          const container = containerRef.current
          const maxX = (container?.clientWidth ?? point.x) - 356
          const maxY = (container?.clientHeight ?? point.y) - 380
          engineRef.current?.showPreviewPin(lngLat)
          setPick({
            latitudeDeg: lngLat[1],
            longitudeDeg: lngLat[0],
            point: {
              x: Math.max(8, Math.min(point.x, Math.max(8, maxX))),
              y: Math.max(8, Math.min(point.y, Math.max(8, maxY))),
            },
            quantityLabel: product.quantity,
            value: typeof props.value === 'number' ? props.value : null,
            unit: product.unit,
            validity: props.validity,
            coverageStatus: props.coverageStatus,
            releaseId: product.source_release_id,
          })
        },
        onBackgroundClick: () => {
          setPick(null)
          engineRef.current?.hidePreviewPin()
        },
      })
      engineRef.current = engine
      setEngineReady(true)
    })()
    return () => {
      disposed = true
      engine?.dispose()
      engineRef.current = null
      setEngineReady(false)
    }
  }, [webgl2, router])

  // Push the active product into the engine.
  useEffect(() => {
    if (!engineReady || !engineRef.current || !data || !activeProduct) return
    const ramp = rampForProduct(activeProduct)
    const cells = buildCellFeatures(activeProduct, geometryFor(activeProduct, data), ramp)
    engineRef.current.setProduct(cells, ramp, halo && activeProduct.source_domain === 'emission')
  }, [engineReady, data, activeProduct, halo])

  // Sync the camera from the URL (place field, mode switch, share links).
  useEffect(() => {
    if (engineReady) engineRef.current?.moveTo([state.longitudeDeg, state.latitudeDeg], state.zoom)
  }, [engineReady, state.longitudeDeg, state.latitudeDeg, state.zoom])

  useEffect(() => {
    if (engineReady) engineRef.current?.setInspectionVisible(inspection)
  }, [engineReady, inspection])

  useEffect(() => {
    if (!engineReady || !containerRef.current) return
    const observer = new ResizeObserver(() => engineRef.current?.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [engineReady])

  const selectLayer = (id: string) => {
    setPick(null)
    engineRef.current?.hidePreviewPin()
    router.replace(`/globe?${buildGlobeQuery({ ...state, layer: id }).toString()}`)
  }

  const enterSky = () => {
    if (!pick) return
    router.push(
      `/observe?${buildObserveQuery({
        latitudeDeg: pick.latitudeDeg,
        longitudeDeg: pick.longitudeDeg,
        heightM: FIXTURE_DEFAULTS.heightM,
        requestedTimeUtc: state.requestedTimeUtc,
        atmosphereMode: FIXTURE_DEFAULTS.atmosphereMode,
      }).toString()}`,
    )
  }

  const legend: LegendModel | null = activeProduct
    ? {
        product: activeProduct,
        ramp: rampForProduct(activeProduct),
        validTimeUtc:
          activeProduct.source_domain === 'atmosphere'
            ? data?.atmosphere.selection.valid_time_utc
            : undefined,
      }
    : null

  const timeNote =
    data && state.requestedTimeUtc !== data.atmosphere.selection.valid_time_utc
      ? `Requested time (${formatUtc(state.requestedTimeUtc)}) is outside this fixture's validity; ` +
        `atmosphere products show their valid time (${formatUtc(data.atmosphere.selection.valid_time_utc)}).`
      : null

  return (
    <main className={styles.view}>
      {webgl2 ? (
        <div ref={containerRef} className={styles.map} aria-label="Globe — environment display products" />
      ) : (
        <StaticTable data={data} activeProduct={activeProduct} />
      )}
      {loadError ? (
        <p className={styles.loadError} role="alert">
          Fixture products could not be loaded: {loadError}
        </p>
      ) : null}
      {webgl2 && data ? (
        <LayerDock
          products={data.products}
          activeId={activeProduct?.environment_display_product_id ?? ''}
          onSelect={selectLayer}
          legend={legend}
          haloSupported={activeProduct?.source_domain === 'emission'}
          halo={halo}
          onHaloChange={setHalo}
          inspection={inspection}
          onInspectionChange={setInspection}
          timeNote={timeNote}
        />
      ) : null}
      {pick ? (
        <PlaceCard
          data={pick}
          onEnterSky={enterSky}
          onClose={() => {
            setPick(null)
            engineRef.current?.hidePreviewPin()
          }}
        />
      ) : null}
    </main>
  )
}

// Unsupported-capability tier: no WebGL2 means no interactive globe, but the
// data stays reachable as a plain, accessible table — never a fake map.
function StaticTable({
  data,
  activeProduct,
}: {
  data: GlobeData | null
  activeProduct: EnvironmentDisplayProduct | null
}) {
  if (!data || !activeProduct) {
    return <p className={styles.staticNote}>Loading display products…</p>
  }
  const ramp = rampForProduct(activeProduct)
  const cells = buildCellFeatures(activeProduct, geometryFor(activeProduct, data), ramp)
  return (
    <div className={styles.staticWrap}>
      <p className={styles.staticNote} role="note">
        WebGL2 is unavailable, so this is the static data view of {activeProduct.environment_display_product_id}.
      </p>
      <table className={styles.staticTable}>
        <caption className="visually-hidden">{activeProduct.quantity} per source cell</caption>
        <thead>
          <tr>
            <th>Cell centre</th>
            <th>{activeProduct.unit}</th>
            <th>Validity</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={cell.index}>
              <td className="mono">{formatLatLon(cell.center[1], cell.center[0])}</td>
              <td className="mono">{formatValue(cell.value, activeProduct.unit)}</td>
              <td>{cell.validity.replace(/_/g, ' ')}</td>
              <td>{cell.coverageStatus?.replace(/_/g, ' ') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

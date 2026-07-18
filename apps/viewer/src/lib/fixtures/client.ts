// Browser-side loaders for the synced static fixture assets under /fixtures/v1/
// and the Wasm modules under /wasm/. Promises are cached in-module so repeated
// calls share one fetch.
import type {
  CoverageStatus,
  DataValidity,
  EnvironmentDisplayProduct,
  ObserverScenario,
  RuntimeCompatibilityManifest,
} from '../contracts/types.ts'

export interface EmissionCell {
  cell_id: string
  center_wgs84_deg: [number, number]
  support_area_m2: number
  j_dnb_nw_cm2_sr: number
  directional_intensity_w_sr: number
  coverage_status: CoverageStatus
  data_validity: DataValidity
}

export interface EmissionRelease {
  emission_schema_revision: string
  emission_model_revision: string
  emission_release_id: string
  content_license: string
  quantity: string
  unit: string
  cells: EmissionCell[]
  total_directional_intensity_w_sr: number
}

export interface AtmosphereVariable {
  unit: string
  wet_dry_basis: string
  evidence: string
  values: number[]
}

export interface AtmosphereRelease {
  atmosphere_schema_revision: string
  atmosphere_model_revision: string
  atmosphere_release_id: string
  source_run_id: string
  content_license: string
  selection: {
    mode: string
    requested_time_utc: string
    valid_time_utc: string
    standard_scenario_id: string
    interpolation_revision: string
    downscaling_revision: string
  }
  axes: {
    longitude_deg_east: number[]
    latitude_deg_north: number[]
    geometric_height_m_above_wgs84_ellipsoid: number[]
    axis_order: string[]
  }
  shape: [number, number, number]
  variables: Record<string, AtmosphereVariable>
  data_validity: DataValidity
  uncertainty_status: string
}

export interface DisplayProductsFile {
  environment_display_schema_revision: string
  products: EnvironmentDisplayProduct[]
}

export interface FixtureManifest {
  fixture_revision: string
  license: string
  created_utc: string
  hash_algorithm: string
  files: Record<string, string>
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

const cache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let entry = cache.get(key) as Promise<T> | undefined
  if (!entry) {
    entry = load()
    cache.set(key, entry)
  }
  return entry
}

export const loadFixtureManifest = (): Promise<FixtureManifest> =>
  cached('manifest', () => loadJson<FixtureManifest>('/fixtures/v1/manifest.json'))

export const loadEmissionRelease = (): Promise<EmissionRelease> =>
  cached('emission', () => loadJson<EmissionRelease>('/fixtures/v1/emission-release.json'))

export const loadAtmosphereRelease = (): Promise<AtmosphereRelease> =>
  cached('atmosphere', () => loadJson<AtmosphereRelease>('/fixtures/v1/atmosphere-release.json'))

export const loadObserverScenarioTemplate = (): Promise<ObserverScenario> =>
  cached('scenario', () => loadJson<ObserverScenario>('/fixtures/v1/observer-scenario.json'))

export const loadEnvironmentDisplayProducts = (): Promise<DisplayProductsFile> =>
  cached('display', () => loadJson<DisplayProductsFile>('/fixtures/v1/environment-display-products.json'))

export const loadRuntimeCompatibilityManifest = (): Promise<RuntimeCompatibilityManifest> =>
  cached('compat', () =>
    loadJson<RuntimeCompatibilityManifest>('/fixtures/v1/runtime-compatibility-manifest.json'),
  )

export interface WasmModules {
  environmentModuleBytes: ArrayBuffer
  physicsModuleBytes: ArrayBuffer
}

export class MissingWasmError extends Error {
  readonly category = 'missing_asset' as const
  constructor(url: string) {
    super(
      `Wasm module ${url} is not available. Build it with \`make rust-wasm\` at the repo root, ` +
        'then re-run the asset sync (npm run sync-assets).',
    )
    this.name = 'MissingWasmError'
  }
}

async function loadBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new MissingWasmError(url)
  }
  return response.arrayBuffer()
}

export const loadWasmModules = (): Promise<WasmModules> =>
  cached('wasm', async () => {
    const [environmentModuleBytes, physicsModuleBytes] = await Promise.all([
      loadBytes('/wasm/environment_wasm.wasm'),
      loadBytes('/wasm/nightglow_wasm.wasm'),
    ])
    return { environmentModuleBytes, physicsModuleBytes }
  })

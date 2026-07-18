// Canonical cross-package vocabulary, mirrored from packages/contracts/.
// The JSON schemas under packages/contracts/schemas/v1/ are authoritative;
// these types cover exactly the frozen fixture slice the Viewer consumes.

export type DataValidity = 'valid' | 'missing' | 'masked' | 'censored' | 'not_covered'

export type RuntimeAvailability = 'idle' | 'loading' | 'available' | 'unavailable' | 'failed'

export type CoverageStatus = 'supported_emission' | 'supported_dark_or_upper_bound' | 'no_evidence'

export type SourceEvidenceClass =
  | 'direct_observation'
  | 'assimilated_analysis'
  | 'forecast'
  | 'reanalysis'
  | 'regional_enrichment'
  | 'observation_correction'
  | 'seasonal_anomaly'
  | 'climatology'
  | 'inferred_prior'
  | 'explicit_standard'
  | 'missing'

export type AtmosphereSelectionMode =
  | 'observation_adjusted_analysis'
  | 'analysis'
  | 'forecast'
  | 'reanalysis'
  | 'climatology_sample'
  | 'standard_scenario'
  | 'insufficient'

export type FailureCategory =
  | 'incompatible_schema'
  | 'incompatible_semantics'
  | 'invalid_units_or_coordinates'
  | 'missing_asset'
  | 'insufficient_evidence'
  | 'unsupported_capability'
  | 'numerical_non_convergence'
  | 'cancelled'
  | 'resource_exhausted'
  | 'runtime_failure'

export type ProgressStage =
  | 'resolve_inputs'
  | 'load_environment'
  | 'build_geometry_astronomy'
  | 'build_optical_state'
  | 'solve_transfer'
  | 'apply_observation'
  | 'publish_products'
  | 'refine'

export interface FailureInfo {
  category: FailureCategory
  message: string
}

// --- Observer scenario (packages/contracts/schemas/v1/observer-scenario.schema.json) ---

export interface ObserverWgs84 {
  latitude_deg: number
  longitude_deg: number
  height: number
  height_datum: 'WGS84-ellipsoid'
}

export interface AtmosphereSelection {
  mode: AtmosphereSelectionMode
  valid_time_utc: string
  standard_scenario_id: string
  interpolation_revision: string
  downscaling_revision: string
  source_run_id?: string
  analysis_time_utc?: string
  lead_duration?: string
  ensemble_member_id?: string
  observation_correction_revision?: string
  climatology_model_revision?: string
  climatology_sample_id?: string
}

export interface ScenarioOutput {
  projection: 'azimuth-elevation-equirectangular'
  azimuth_samples: number
  elevation_samples: number
  spectral_response: string
  quality_tier: string
}

export interface ResourceBudget {
  wall_time_ms: number
  memory_bytes: number
}

export interface ObserverScenario {
  observer_scenario_schema_revision: 'observer-scenario-fixture-v1'
  scenario_revision: number
  observer_wgs84: ObserverWgs84
  requested_time_utc: string
  astronomy_time_data_ids: Record<string, string>
  emission_release_id: string
  emission_time_context: string
  emission_scenario_policy_id: string
  atmosphere_release_id: string
  atmosphere_selection: AtmosphereSelection
  physics_model_revision: string
  physics_data_manifest_id: string
  atmosphere_optics_model_revision: string
  surface_terrain_product_id: string
  output: ScenarioOutput
  resource_budget: ResourceBudget
}

// --- Observer render product (runtime shape posted by the coordinator worker) ---

export const RENDER_PRODUCT_AXIS_ORDER = ['elevation', 'azimuth', 'linear_rgb'] as const

export interface ObserverRenderProduct {
  observerRenderProductSchemaRevision: string
  physicsAbiRevision: string
  physicsModelRevision: string
  physicsDataManifestId: string
  scenarioRevision: number
  coherentBarrier: 'coarse_complete'
  projection: string
  shape: [number, number, number]
  componentType: 'float32'
  quantity: string
  unit: string
  fidelity: string
  convergence: { status: string; relativeResidual: number }
  memoryHighWaterBytes: number
  values: Float32Array
}

// --- Environment display products (packages/contracts/fixtures/v1/environment-display-products.json) ---

export interface EnvironmentDisplayProduct {
  environment_display_product_id: string
  environment_display_build_revision: string
  source_domain: 'emission' | 'atmosphere'
  source_release_id: string
  quantity: string
  unit: string
  shape: [number, number]
  axis_order: ['latitude', 'longitude']
  aggregation?: string
  vertical_selection?: { quantity: string; value: number; unit: string }
  values: number[]
  data_validity: DataValidity[]
}

// --- Coordinator worker protocol (runtime/browser-worker/src/coordinator.worker.js) ---

export interface CoordinatorCapabilities {
  protocolRevision: string
  environmentAbiRevision: number
  physicsAbiRevision: number
  compatibilityManifestRevision: string
  physicsModelRevision: string
  physicsDataManifestId: string
  transferableBuffers: boolean
  wasmThreads: boolean
  sharedArrayBuffer: boolean
}

export interface EmissionPayload {
  emission_release_id: string
  unit: string
  j_dnb_nw_cm2_sr: number[]
  support_area_m2: number[]
}

export interface AtmospherePayload {
  atmosphere_release_id: string
  valid_time_utc: string
  pressure_unit: string
  column_count: number
  geometric_height_m: number[]
  pressure_pa: number[]
}

export interface ScenarioRequest {
  requestId: string
  scenario: ObserverScenario
  emission: EmissionPayload
  atmosphere: AtmospherePayload
}

export interface ProgressMessage {
  type: 'progress'
  requestId: string
  scenarioRevision: number
  stage: ProgressStage
  completed: number
  fidelity: string
}

export interface ProductMessage extends ObserverRenderProduct {
  type: 'product'
  requestId: string
}

export interface FailureMessage {
  type: 'failure'
  requestId: string
  category: FailureCategory
  message: string
}

export interface InitializedMessage extends CoordinatorCapabilities {
  type: 'initialized'
}

export type WorkerOutbound =
  | InitializedMessage
  | ProgressMessage
  | ProductMessage
  | FailureMessage
  | { type: 'disposed' }

// --- Runtime compatibility manifest (runtime/browser-worker/fixtures/v1/) ---

export interface RuntimeCompatibilityManifest {
  manifest_revision: string
  content_license: string
  protocol_revision: string
  environment_abi_revision: number
  physics_abi_revision: number
  observer_scenario_schema_revision: string
  emission_release_id: string
  atmosphere_release_id: string
  atmosphere_valid_time_utc: string
  physics_model_revision: string
  physics_data_manifest_id: string
  atmosphere_optics_model_revision: string
  surface_terrain_product_id: string
  projection: string
  shape: [number, number, number]
}

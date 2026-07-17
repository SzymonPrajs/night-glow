export const PROTOCOL_REVISION = 'nightglow-browser-worker-v1'

const STAGES = [
  ['resolve_inputs', 0.1],
  ['load_environment', 0.4],
  ['solve_transfer', 0.8],
  ['publish_products', 1],
]

export class CoordinatorError extends Error {
  constructor(category, message) {
    super(message)
    this.name = 'CoordinatorError'
    this.category = category
  }
}

export class Coordinator {
  #environment
  #physics
  #compatibility
  #activeRequest
  #yieldControl

  constructor({ yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)) } = {}) {
    this.#yieldControl = yieldControl
  }

  async initialize({ environmentModuleBytes, physicsModuleBytes, compatibilityManifest }) {
    try {
      validateCompatibilityManifest(compatibilityManifest)
      const [environment, physics] = await Promise.all([
        WebAssembly.instantiate(environmentModuleBytes),
        WebAssembly.instantiate(physicsModuleBytes),
      ])
      this.#environment = environment.instance.exports
      this.#physics = physics.instance.exports
      requireExport(this.#environment, 'nightglow_environment_abi_revision')
      requireExport(this.#physics, 'nightglow_physics_abi_revision')
      requireExport(this.#environment, 'nightglow_environment_input_len')
      requireExport(this.#environment, 'nightglow_environment_summary_len')
      requireExport(this.#environment, 'nightglow_environment_release_buffers')
      requireExport(this.#physics, 'nightglow_first_slice_output_len')
      requireExport(this.#physics, 'nightglow_physics_release_output')
      if (this.#environment.nightglow_environment_abi_revision() !== 1
        || this.#physics.nightglow_physics_abi_revision() !== 1
        || this.#environment.nightglow_environment_abi_revision() !== compatibilityManifest.environment_abi_revision
        || this.#physics.nightglow_physics_abi_revision() !== compatibilityManifest.physics_abi_revision) {
        throw new CoordinatorError('incompatible_schema', 'Unsupported Environment or Physics ABI')
      }
      this.#compatibility = structuredClone(compatibilityManifest)
      return this.capabilities()
    } catch (error) {
      this.#environment = undefined
      this.#physics = undefined
      this.#compatibility = undefined
      if (error instanceof CoordinatorError) throw error
      throw new CoordinatorError('runtime_failure', `Unable to initialize Wasm modules: ${error}`)
    }
  }

  capabilities() {
    return {
      protocolRevision: PROTOCOL_REVISION,
      environmentAbiRevision: 1,
      physicsAbiRevision: 1,
      compatibilityManifestRevision: this.#compatibility?.manifest_revision,
      physicsModelRevision: this.#compatibility?.physics_model_revision,
      physicsDataManifestId: this.#compatibility?.physics_data_manifest_id,
      transferableBuffers: true,
      wasmThreads: false,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true,
    }
  }

  diagnostics() {
    if (!this.#environment || !this.#physics) {
      throw new CoordinatorError('runtime_failure', 'Coordinator is not initialized')
    }
    return {
      memoryBytes: this.#environment.memory.buffer.byteLength + this.#physics.memory.buffer.byteLength,
      retainedEnvironmentInputValues: this.#environment.nightglow_environment_input_len(),
      retainedEnvironmentSummaryValues: this.#environment.nightglow_environment_summary_len(),
      retainedPhysicsOutputValues: this.#physics.nightglow_first_slice_output_len(),
    }
  }

  cancel(requestId) {
    if (this.#activeRequest?.requestId === requestId) this.#activeRequest.cancelled = true
  }

  async commitScenario(request, onProgress = () => {}) {
    if (!this.#environment || !this.#physics) {
      throw new CoordinatorError('runtime_failure', 'Coordinator is not initialized')
    }
    if (this.#activeRequest) this.#activeRequest.cancelled = true
    const token = { requestId: request.requestId, cancelled: false }
    this.#activeRequest = token
    try {
      await this.#stage(token, request, STAGES[0], onProgress)
      validateRequest(request, this.#compatibility)
      const environmentSummary = this.#summarizeEnvironment(request)

      await this.#stage(token, request, STAGES[1], onProgress)
      const values = this.#solvePhysics(environmentSummary)

      await this.#stage(token, request, STAGES[2], onProgress)
      const memoryHighWaterBytes = this.#environment.memory.buffer.byteLength
        + this.#physics.memory.buffer.byteLength
      const product = {
        type: 'product',
        requestId: request.requestId,
        scenarioRevision: request.scenario.scenario_revision,
        observerRenderProductSchemaRevision: 'observer-render-fixture-v1',
        physicsAbiRevision: 'physics-abi-fixture-v1',
        physicsModelRevision: request.scenario.physics_model_revision,
        physicsDataManifestId: request.scenario.physics_data_manifest_id,
        coherentBarrier: 'coarse_complete',
        projection: request.scenario.output.projection,
        shape: [...this.#compatibility.shape],
        componentType: 'float32',
        quantity: 'spectral-response-integrated-radiance',
        unit: 'W m-2 sr-1',
        fidelity: 'synthetic-contract-only',
        convergence: { status: 'converged', relativeResidual: 0 },
        memoryHighWaterBytes,
        values,
      }
      await this.#stage(token, request, STAGES[3], onProgress)
      return product
    } finally {
      if (this.#activeRequest === token) this.#activeRequest = undefined
    }
  }

  async #stage(token, request, [stage, fraction], onProgress) {
    await this.#yieldControl()
    if (token.cancelled || this.#activeRequest !== token) {
      throw new CoordinatorError('cancelled', `Request ${token.requestId} was superseded`)
    }
    onProgress({
      type: 'progress',
      requestId: request.requestId,
      scenarioRevision: request.scenario.scenario_revision,
      stage,
      completed: fraction,
      fidelity: 'synthetic-contract-only',
    })
  }

  #summarizeEnvironment(request) {
    const { emission, atmosphere } = request
    const values = [
      ...emission.j_dnb_nw_cm2_sr,
      ...emission.support_area_m2,
      ...atmosphere.geometric_height_m,
      ...atmosphere.pressure_pa,
    ]
    const allocate = requireExport(this.#environment, 'nightglow_environment_input_allocate')
    const summarize = requireExport(this.#environment, 'nightglow_environment_summarize_fixture')
    const release = requireExport(this.#environment, 'nightglow_environment_release_buffers')
    try {
      const pointer = allocate(values.length)
      new Float64Array(this.#environment.memory.buffer, pointer, values.length).set(values)
      const summaryPointer = summarize(
        emission.j_dnb_nw_cm2_sr.length,
        atmosphere.column_count,
        atmosphere.geometric_height_m.length,
      )
      const summaryLength = this.#environment.nightglow_environment_summary_len()
      if (!summaryPointer || summaryLength !== 2) {
        throw new CoordinatorError('invalid_units_or_coordinates', 'Environment rejected the regional fixture buffer')
      }
      const summary = new Float64Array(this.#environment.memory.buffer, summaryPointer, summaryLength)
      return { totalDirectionalIntensity: summary[0], meanSurfacePressure: summary[1] }
    } finally {
      release()
    }
  }

  #solvePhysics({ totalDirectionalIntensity, meanSurfacePressure }) {
    const solve = requireExport(this.#physics, 'nightglow_first_slice_solve')
    const release = requireExport(this.#physics, 'nightglow_physics_release_output')
    try {
      const pointer = solve(totalDirectionalIntensity, meanSurfacePressure)
      const length = this.#physics.nightglow_first_slice_output_len()
      if (!pointer || length !== 24) {
        throw new CoordinatorError('numerical_non_convergence', 'Physics did not publish a coherent product')
      }
      return new Float32Array(this.#physics.memory.buffer, pointer, length).slice()
    } finally {
      release()
    }
  }
}

function requireExport(exports, name) {
  const value = exports?.[name]
  if (typeof value !== 'function') {
    throw new CoordinatorError('incompatible_schema', `Missing Wasm export: ${name}`)
  }
  return value
}

function validateRequest(request, compatibility) {
  const { scenario, emission, atmosphere } = request
  if (!request.requestId || !scenario || !emission || !atmosphere) {
    throw new CoordinatorError('invalid_units_or_coordinates', 'Incomplete coordinator request')
  }
  if (scenario.observer_scenario_schema_revision !== 'observer-scenario-fixture-v1'
    || !Number.isSafeInteger(scenario.scenario_revision)
    || scenario.scenario_revision < 1
    || scenario.emission_release_id !== emission.emission_release_id
    || scenario.atmosphere_release_id !== atmosphere.atmosphere_release_id
    || scenario.atmosphere_selection?.valid_time_utc !== atmosphere.valid_time_utc
    || scenario.observer_scenario_schema_revision !== compatibility.observer_scenario_schema_revision
    || scenario.emission_release_id !== compatibility.emission_release_id
    || scenario.atmosphere_release_id !== compatibility.atmosphere_release_id
    || scenario.requested_time_utc !== compatibility.atmosphere_valid_time_utc
    || scenario.atmosphere_selection?.valid_time_utc !== compatibility.atmosphere_valid_time_utc
    || scenario.physics_model_revision !== compatibility.physics_model_revision
    || scenario.physics_data_manifest_id !== compatibility.physics_data_manifest_id
    || scenario.atmosphere_optics_model_revision !== compatibility.atmosphere_optics_model_revision
    || scenario.surface_terrain_product_id !== compatibility.surface_terrain_product_id) {
    throw new CoordinatorError('incompatible_semantics', 'Scenario dependencies do not match Environment inputs')
  }
  if (emission.unit !== 'nW cm-2 sr-1'
    || atmosphere.pressure_unit !== 'Pa'
    || emission.j_dnb_nw_cm2_sr.length !== emission.support_area_m2.length
    || atmosphere.pressure_pa.length !== atmosphere.column_count * atmosphere.geometric_height_m.length) {
    throw new CoordinatorError('invalid_units_or_coordinates', 'Invalid Environment units or shapes')
  }
  if (scenario.output?.projection !== compatibility.projection
    || scenario.output?.azimuth_samples !== compatibility.shape[1]
    || scenario.output?.elevation_samples !== compatibility.shape[0]
    || scenario.resource_budget?.memory_bytes < productValueCount(compatibility) * Float32Array.BYTES_PER_ELEMENT) {
    throw new CoordinatorError('resource_exhausted', 'The fixture output shape or memory budget is unsupported')
  }
}

function validateCompatibilityManifest(manifest) {
  if (!manifest
    || manifest.manifest_revision !== 'nightglow-runtime-compatibility-fixture-v1'
    || manifest.content_license !== 'CC0-1.0'
    || manifest.protocol_revision !== PROTOCOL_REVISION
    || manifest.environment_abi_revision !== 1
    || manifest.physics_abi_revision !== 1
    || typeof manifest.observer_scenario_schema_revision !== 'string'
    || typeof manifest.emission_release_id !== 'string'
    || typeof manifest.atmosphere_release_id !== 'string'
    || typeof manifest.atmosphere_valid_time_utc !== 'string'
    || typeof manifest.physics_model_revision !== 'string'
    || typeof manifest.physics_data_manifest_id !== 'string'
    || typeof manifest.atmosphere_optics_model_revision !== 'string'
    || typeof manifest.surface_terrain_product_id !== 'string'
    || typeof manifest.projection !== 'string'
    || !Array.isArray(manifest.shape)
    || manifest.shape.length !== 3
    || manifest.shape.some((value) => !Number.isSafeInteger(value) || value < 1)
    || manifest.shape[2] !== 3
    || manifest.shape.reduce((count, value) => count * value, 1) !== 24) {
    throw new CoordinatorError('incompatible_schema', 'Invalid runtime compatibility manifest')
  }
}

function productValueCount(compatibility) {
  return compatibility.shape.reduce((count, value) => count * value, 1)
}

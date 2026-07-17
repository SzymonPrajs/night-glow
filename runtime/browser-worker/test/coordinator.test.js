import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Coordinator, CoordinatorError } from '../src/coordinator.js'

const root = new URL('../../../', import.meta.url)
const loadJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const moduleBytes = async (path) => readFile(new URL(path, root))

async function initializedCoordinator(coordinator = new Coordinator()) {
  await coordinator.initialize({
    environmentModuleBytes: await moduleBytes('packages/environment/target/wasm32-unknown-unknown/release/environment_wasm.wasm'),
    physicsModuleBytes: await moduleBytes('packages/physics/target/wasm32-unknown-unknown/release/nightglow_wasm.wasm'),
    compatibilityManifest: await loadJson('runtime/browser-worker/fixtures/v1/runtime-compatibility-manifest.json'),
  })
  return coordinator
}

async function fixtureRequest(scenarioRevision = 1) {
  const [emission, atmosphere, scenario] = await Promise.all([
    loadJson('packages/contracts/fixtures/v1/emission-release.json'),
    loadJson('packages/contracts/fixtures/v1/atmosphere-release.json'),
    loadJson('packages/contracts/fixtures/v1/observer-scenario.json'),
  ])
  return {
    requestId: `fixture-${scenarioRevision}`,
    scenario: { ...scenario, scenario_revision: scenarioRevision },
    emission: {
      emission_release_id: emission.emission_release_id,
      unit: emission.unit,
      j_dnb_nw_cm2_sr: emission.cells.map((cell) => cell.j_dnb_nw_cm2_sr),
      support_area_m2: emission.cells.map((cell) => cell.support_area_m2),
    },
    atmosphere: {
      atmosphere_release_id: atmosphere.atmosphere_release_id,
      valid_time_utc: atmosphere.selection.valid_time_utc,
      pressure_unit: atmosphere.variables.pressure_pa.unit,
      column_count: atmosphere.shape[0] * atmosphere.shape[1],
      geometric_height_m: atmosphere.axes.geometric_height_m_above_wgs84_ellipsoid,
      pressure_pa: atmosphere.variables.pressure_pa.values,
    },
  }
}

test('coordinates Environment and Physics Wasm into one coherent product', async () => {
  const coordinator = await initializedCoordinator()
  const progress = []
  const product = await coordinator.commitScenario(await fixtureRequest(), (event) => progress.push(event.stage))
  const expected = await loadJson('packages/contracts/fixtures/v1/observer-render-product.json')
  assert.deepEqual(progress, ['resolve_inputs', 'load_environment', 'solve_transfer', 'publish_products'])
  assert.equal(product.coherentBarrier, 'coarse_complete')
  assert.equal(product.scenarioRevision, 1)
  assert.equal(product.values.length, expected.values.length)
  const maximumError = Math.max(...product.values.map((value, index) => Math.abs(value - expected.values[index]) / expected.values[index]))
  assert.ok(maximumError < 1e-6)
  assert.ok(product.values.buffer.byteLength < 1_048_576)
  assert.ok(product.memoryHighWaterBytes <= 32 * 1_048_576)
})

test('cancels superseded work before it can publish', async () => {
  const coordinator = await initializedCoordinator()
  const request = await fixtureRequest()
  const started = performance.now()
  const pending = coordinator.commitScenario(request)
  coordinator.cancel(request.requestId)
  await assert.rejects(pending, (error) => error instanceof CoordinatorError && error.category === 'cancelled')
  assert.ok(performance.now() - started < 100)
})

test('new scenario revision rejects the stale result', async () => {
  const coordinator = await initializedCoordinator()
  const stale = coordinator.commitScenario(await fixtureRequest(1))
  const current = coordinator.commitScenario(await fixtureRequest(2))
  await assert.rejects(stale, (error) => error instanceof CoordinatorError && error.category === 'cancelled')
  assert.equal((await current).scenarioRevision, 2)
})

test('rejects unit drift as a structured boundary failure', async () => {
  const coordinator = await initializedCoordinator()
  const request = await fixtureRequest()
  request.atmosphere.pressure_unit = 'hPa'
  await assert.rejects(
    coordinator.commitScenario(request),
    (error) => error instanceof CoordinatorError && error.category === 'invalid_units_or_coordinates',
  )
})

test('rejects a budget that cannot hold the coherent product', async () => {
  const coordinator = await initializedCoordinator()
  const request = await fixtureRequest()
  request.scenario.resource_budget.memory_bytes = 16
  await assert.rejects(
    coordinator.commitScenario(request),
    (error) => error instanceof CoordinatorError && error.category === 'resource_exhausted',
  )
})

test('rejects Physics identity drift before executing the pinned module', async () => {
  const coordinator = await initializedCoordinator()
  const request = await fixtureRequest()
  request.scenario.physics_model_revision = 'unregistered-model-v2'
  await assert.rejects(
    coordinator.commitScenario(request),
    (error) => error instanceof CoordinatorError && error.category === 'incompatible_semantics',
  )
  assert.equal(coordinator.diagnostics().retainedEnvironmentInputValues, 0)
})

test('fails closed when the runtime compatibility manifest is absent', async () => {
  const coordinator = new Coordinator()
  await assert.rejects(
    coordinator.initialize({
      environmentModuleBytes: await moduleBytes('packages/environment/target/wasm32-unknown-unknown/release/environment_wasm.wasm'),
      physicsModuleBytes: await moduleBytes('packages/physics/target/wasm32-unknown-unknown/release/nightglow_wasm.wasm'),
    }),
    (error) => error instanceof CoordinatorError && error.category === 'incompatible_schema',
  )
})

test('releases Wasm request views after successful and rejected work', async () => {
  const coordinator = await initializedCoordinator()
  await coordinator.commitScenario(await fixtureRequest())
  const successful = coordinator.diagnostics()
  assert.ok(successful.memoryBytes <= 32 * 1_048_576)
  assert.equal(successful.retainedEnvironmentInputValues, 0)
  assert.equal(successful.retainedEnvironmentSummaryValues, 0)
  assert.equal(successful.retainedPhysicsOutputValues, 0)

  const invalid = await fixtureRequest(2)
  invalid.emission.j_dnb_nw_cm2_sr[0] = Number.NaN
  await assert.rejects(
    coordinator.commitScenario(invalid),
    (error) => error instanceof CoordinatorError && error.category === 'invalid_units_or_coordinates',
  )
  assert.equal(coordinator.diagnostics().retainedEnvironmentInputValues, 0)
  assert.equal(coordinator.diagnostics().retainedEnvironmentSummaryValues, 0)
  assert.equal(coordinator.diagnostics().retainedPhysicsOutputValues, 0)
})

test('repeated scenarios reuse bounded Wasm memory', async () => {
  const coordinator = await initializedCoordinator()
  await coordinator.commitScenario(await fixtureRequest())
  const settledMemory = coordinator.diagnostics().memoryBytes
  for (let revision = 2; revision <= 100; revision += 1) {
    await coordinator.commitScenario(await fixtureRequest(revision))
  }
  assert.equal(coordinator.diagnostics().memoryBytes, settledMemory)
})

test('dispose cancels pending work and makes the runtime unreachable', async () => {
  let resume
  const coordinator = await initializedCoordinator(new Coordinator({
    yieldControl: () => new Promise((resolve) => { resume = resolve }),
  }))
  const pending = coordinator.commitScenario(await fixtureRequest())
  coordinator.dispose()
  resume()
  await assert.rejects(
    pending,
    (error) => error instanceof CoordinatorError && error.category === 'cancelled',
  )
  assert.throws(
    () => coordinator.diagnostics(),
    (error) => error instanceof CoordinatorError && error.category === 'runtime_failure',
  )
})

test('module-worker adapter acknowledges runtime disposal', async () => {
  let messageHandler
  const posted = []
  globalThis.self = {
    addEventListener(type, handler) {
      assert.equal(type, 'message')
      messageHandler = handler
    },
    postMessage(message) {
      posted.push(message)
    },
  }
  try {
    await import(`../src/coordinator.worker.js?dispose-test=${Date.now()}`)
    await messageHandler({ data: { type: 'dispose' } })
    assert.deepEqual(posted, [{ type: 'disposed' }])
  } finally {
    delete globalThis.self
  }
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildAtmospherePayload,
  buildEmissionPayload,
  buildScenario,
} from '../src/lib/scenario/build-scenario.ts'
import type { ObserverScenario } from '../src/lib/contracts/types.ts'

const root = new URL('../../../', import.meta.url)
const loadJson = async (path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8'))

const template = (await loadJson('packages/contracts/fixtures/v1/observer-scenario.json')) as ObserverScenario
const emission = await loadJson('packages/contracts/fixtures/v1/emission-release.json')
const atmosphere = await loadJson('packages/contracts/fixtures/v1/atmosphere-release.json')

test('scenario builder overrides only observer position, time and revision', () => {
  const scenario = buildScenario(
    {
      latitudeDeg: 50.5,
      longitudeDeg: 19.25,
      heightM: 200,
      requestedTimeUtc: '2024-01-15T00:00:00Z',
      scenarioRevision: 7,
    },
    template,
  )
  assert.equal(scenario.scenario_revision, 7)
  assert.deepEqual(scenario.observer_wgs84, {
    latitude_deg: 50.5,
    longitude_deg: 19.25,
    height: 200,
    height_datum: 'WGS84-ellipsoid',
  })
  assert.equal(scenario.requested_time_utc, '2024-01-15T00:00:00Z')
  // Coordinator invariant: requested time equals selection valid time.
  assert.equal(scenario.atmosphere_selection.valid_time_utc, scenario.requested_time_utc)
  // Pinned identities are preserved untouched.
  assert.equal(scenario.emission_release_id, template.emission_release_id)
  assert.equal(scenario.atmosphere_release_id, template.atmosphere_release_id)
  assert.equal(scenario.physics_model_revision, template.physics_model_revision)
  assert.equal(scenario.surface_terrain_product_id, template.surface_terrain_product_id)
  assert.equal(scenario.atmosphere_selection.standard_scenario_id, 'clear-winter-layered-v1')
  assert.deepEqual(scenario.output, template.output)
  // The template itself is not mutated.
  assert.equal(template.scenario_revision, 1)
})

test('emission payload maps cells in release order', () => {
  const payload = buildEmissionPayload(emission)
  assert.equal(payload.emission_release_id, emission.emission_release_id)
  assert.equal(payload.unit, 'nW cm-2 sr-1')
  assert.deepEqual(payload.j_dnb_nw_cm2_sr, [1, 2, 0, 4])
  assert.deepEqual(payload.support_area_m2, [1000000, 1000000, 1000000, 1000000])
})

test('atmosphere payload maps the pinned pressure field and grid', () => {
  const payload = buildAtmospherePayload(atmosphere)
  assert.equal(payload.atmosphere_release_id, atmosphere.atmosphere_release_id)
  assert.equal(payload.valid_time_utc, '2024-01-15T00:00:00Z')
  assert.equal(payload.pressure_unit, 'Pa')
  assert.equal(payload.column_count, 4)
  assert.deepEqual(payload.geometric_height_m, [100, 1100, 3100])
  assert.equal(payload.pressure_pa.length, 12)
})

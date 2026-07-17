import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const fixtureRoot = fileURLToPath(new URL('../packages/contracts/fixtures/v1/', import.meta.url))
const schemaRoot = fileURLToPath(new URL('../packages/contracts/schemas/v1/', import.meta.url))
const load = async (name) => JSON.parse(await readFile(`${fixtureRoot}${name}`, 'utf8'))
const loadSchema = async (name) => JSON.parse(await readFile(`${schemaRoot}${name}.schema.json`, 'utf8'))
const manifest = await load('manifest.json')
for (const [name, expectedHash] of Object.entries(manifest.files)) {
  const bytes = await readFile(`${fixtureRoot}${name}`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash)
}

const [conventions, emission, atmosphere, display, scenario, render] = await Promise.all([
  load('conventions.json'),
  load('emission-release.json'),
  load('atmosphere-release.json'),
  load('environment-display-products.json'),
  load('observer-scenario.json'),
  load('observer-render-product.json'),
])
const terrain = JSON.parse(await readFile(new URL('../packages/physics/fixtures/v1/surface-terrain-product.json', import.meta.url), 'utf8'))
const physicsManifest = JSON.parse(await readFile(new URL('../packages/physics/fixtures/v1/physics-data-manifest.json', import.meta.url), 'utf8'))
const schemaFixtures = { emission, atmosphere, scenario, render, terrain, physicsManifest }
const schemaNames = {
  emission: 'emission-release',
  atmosphere: 'atmosphere-release',
  scenario: 'observer-scenario',
  render: 'observer-render-product',
  terrain: 'surface-terrain-product',
  physicsManifest: 'physics-data-manifest',
}
for (const [key, name] of Object.entries(schemaNames)) {
  const schema = await loadSchema(name)
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.equal(schema.type, 'object')
  for (const property of schema.required) assert.ok(property in schemaFixtures[key])
}

assert.equal(conventions.fixture_revision, 'nightglow-fixture-v1')
assert.equal(conventions.license, 'CC0-1.0')
assert.equal(conventions.spectral_basis.bands.length, 8)

const intensity = emission.cells.reduce((sum, cell) => {
  assert.ok(['valid', 'missing', 'masked', 'censored', 'not_covered'].includes(cell.data_validity))
  const expected = cell.j_dnb_nw_cm2_sr * 1e-5 * cell.support_area_m2
  assert.ok(Math.abs(expected - cell.directional_intensity_w_sr) <= Math.max(1, expected) * 1e-12)
  return sum + cell.directional_intensity_w_sr
}, 0)
assert.equal(intensity, emission.total_directional_intensity_w_sr)

const [latitudeCount, longitudeCount, heightCount] = atmosphere.shape
const valueCount = latitudeCount * longitudeCount * heightCount
const heights = atmosphere.axes.geometric_height_m_above_wgs84_ellipsoid
assert.equal(heights.length, heightCount)
assert.ok(heights.every((height, index) => index === 0 || height > heights[index - 1]))
for (const variable of Object.values(atmosphere.variables)) assert.equal(variable.values.length, valueCount)
for (let column = 0; column < latitudeCount * longitudeCount; column += 1) {
  const offset = column * heightCount
  const pressure = atmosphere.variables.pressure_pa.values.slice(offset, offset + heightCount)
  assert.ok(pressure.every((value, index) => index === 0 || value < pressure[index - 1]))
}

const emissionDisplay = display.products.find((product) => product.source_domain === 'emission')
const atmosphereDisplay = display.products.find((product) => product.source_domain === 'atmosphere')
assert.equal(emissionDisplay.source_release_id, emission.emission_release_id)
assert.equal(atmosphereDisplay.source_release_id, atmosphere.atmosphere_release_id)
assert.equal(emissionDisplay.values.length, emissionDisplay.shape.reduce((size, axis) => size * axis, 1))
assert.equal(atmosphereDisplay.values.length, atmosphereDisplay.shape.reduce((size, axis) => size * axis, 1))

assert.equal(scenario.emission_release_id, emission.emission_release_id)
assert.equal(scenario.atmosphere_release_id, atmosphere.atmosphere_release_id)
assert.equal(scenario.requested_time_utc, atmosphere.selection.requested_time_utc)
assert.equal(scenario.scenario_revision, render.scenario_revision)
assert.equal(scenario.surface_terrain_product_id, terrain.surface_terrain_product_id)
assert.equal(scenario.physics_data_manifest_id, physicsManifest.physics_data_manifest_id)
assert.equal(physicsManifest.surface_terrain_product_id, terrain.surface_terrain_product_id)
assert.equal(render.values.length, render.shape.reduce((size, axis) => size * axis, 1))
assert.equal(render.display_transform, null)
for (const value of render.values) assert.ok(Number.isFinite(value) && value >= 0)

console.log('Contract fixture v1: schemas, identities, quantities, conservation, axes and buffers are valid.')

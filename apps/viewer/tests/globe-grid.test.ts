import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCellFeatures,
  cellEdges,
  cellsToGeoJSON,
  graticuleFeatures,
  rampColor,
  rampForProduct,
} from '../src/components/globe/grid.ts'
import type { EnvironmentDisplayProduct } from '../src/lib/contracts/types.ts'

const emissionProduct: EnvironmentDisplayProduct = {
  environment_display_product_id: 'display:emission:fixture:2x2:v1',
  environment_display_build_revision: 'exact-cell-copy-v1',
  source_domain: 'emission',
  source_release_id: 'emission:fixture:central-poland-2x2:v1',
  quantity: 'corrected-reference-view-DNB-band-directional-radiance',
  unit: 'nW cm-2 sr-1',
  shape: [2, 2],
  axis_order: ['latitude', 'longitude'],
  aggregation: 'exact-source-cell',
  values: [1, 2, 0, 4],
  data_validity: ['valid', 'valid', 'censored', 'valid'],
}

const geometry = {
  longitudes: [21.0, 21.02],
  latitudes: [52.0, 52.02],
  coverageByIndex: [
    'supported_emission' as const,
    'supported_emission' as const,
    'supported_dark_or_upper_bound' as const,
    'supported_emission' as const,
  ],
}

const closeTo = (actual: number[], expected: number[]) => {
  assert.equal(actual.length, expected.length)
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9, `${value} ≉ ${expected[index]}`))
}

test('cellEdges derives midpoint edges around axis centres', () => {
  closeTo(cellEdges([21.0, 21.02]), [20.99, 21.01, 21.03])
  closeTo(cellEdges([52.0, 52.02, 52.04]), [51.99, 52.01, 52.03, 52.05])
})

test('emission cells map row-major in latitude-longitude order with states', () => {
  const ramp = rampForProduct(emissionProduct)
  const cells = buildCellFeatures(emissionProduct, geometry, ramp)
  assert.equal(cells.length, 4)
  // sw / se / nw / ne
  assert.deepEqual(cells.map((cell) => cell.value), [1, 2, 0, 4])
  assert.deepEqual(cells.map((cell) => cell.stateClass), ['valid', 'valid', 'dark', 'valid'])
  // The supported-dark cell outranks its censored validity for display class.
  assert.equal(cells[2].validity, 'censored')
  assert.equal(cells[2].coverageStatus, 'supported_dark_or_upper_bound')
  // sw cell polygon spans 20.99-21.01 E, 51.99-52.01 N.
  closeTo(cells[0].ring[0], [20.99, 51.99])
  closeTo(cells[0].ring[2], [21.01, 52.01])
  assert.deepEqual(cells[0].ring[4], cells[0].ring[0])
})

test('emission ramp is log-normalized and never lets zero hit -Infinity', () => {
  const ramp = rampForProduct(emissionProduct)
  assert.equal(ramp.normalizationLabel, 'log10')
  assert.equal(ramp.normalize(4), 1)
  assert.ok(ramp.normalize(0) >= 0)
  assert.ok(ramp.normalize(1) > ramp.normalize(0.1))
})

test('atmosphere ramp is linear over the value extent', () => {
  const pressureProduct: EnvironmentDisplayProduct = {
    ...emissionProduct,
    environment_display_product_id: 'display:atmosphere:fixture:surface-pressure-2x2:v1',
    source_domain: 'atmosphere',
    quantity: 'pressure-at-lowest-supported-geometric-level',
    unit: 'Pa',
    values: [100000, 99900, 99800, 99700],
    data_validity: ['valid', 'valid', 'valid', 'valid'],
  }
  const ramp = rampForProduct(pressureProduct)
  assert.equal(ramp.normalizationLabel, 'linear')
  assert.equal(ramp.normalize(99700), 0)
  assert.equal(ramp.normalize(100000), 1)
})

test('invalid cells take the neutral grey, valid cells take ramp colours', () => {
  const ramp = rampForProduct(emissionProduct)
  const cells = buildCellFeatures(emissionProduct, geometry, ramp)
  assert.equal(cells[2].color, 'rgba(11, 18, 32, 0.85)')
  assert.match(cells[0].color, /^rgb\(/)
  const geojson = cellsToGeoJSON(cells)
  assert.equal(geojson.features.length, 4)
  assert.equal(geojson.features[0].properties?.stateClass, 'valid')
})

test('rampColor interpolates between stops', () => {
  const color = rampColor(
    [
      [0, '#000000'],
      [1, '#ffffff'],
    ],
    0.5,
  )
  assert.equal(color, 'rgb(128, 128, 128)')
})

test('graticule spans the globe without poles clutter', () => {
  const graticule = graticuleFeatures(10)
  assert.ok(graticule.features.length > 50)
  const latitudes = graticule.features
    .map((feature) => (feature.geometry as GeoJSON.LineString).coordinates[0][1])
    .filter((lat) => Math.abs(lat) > 85)
  assert.equal(latitudes.length, 0)
})

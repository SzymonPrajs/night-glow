import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FIXTURE_DEFAULTS,
  buildGlobeQuery,
  buildObserveQuery,
  parseCoordinateInput,
  parseGlobeState,
  parseObserveState,
} from '../src/lib/scenario/url-state.ts'

const params = (entries: Record<string, string>) => new URLSearchParams(entries)

test('globe state falls back to fixture defaults when empty', () => {
  const state = parseGlobeState(params({}))
  assert.equal(state.latitudeDeg, FIXTURE_DEFAULTS.latitudeDeg)
  assert.equal(state.longitudeDeg, FIXTURE_DEFAULTS.longitudeDeg)
  assert.equal(state.requestedTimeUtc, FIXTURE_DEFAULTS.requestedTimeUtc)
  assert.equal(state.layer, FIXTURE_DEFAULTS.defaultLayerId)
  assert.equal(state.zoom, FIXTURE_DEFAULTS.globeZoom)
})

test('observe state parses lat/lon/height/time and writes them back losslessly', () => {
  const state = parseObserveState(
    params({ lat: '52.01', lon: '21.01', height: '120', requested_time_utc: '2024-01-15T00:00:00Z' }),
  )
  assert.equal(state.latitudeDeg, 52.01)
  assert.equal(state.longitudeDeg, 21.01)
  assert.equal(state.heightM, 120)
  const query = buildObserveQuery(state)
  assert.equal(query.get('lat'), '52.01')
  assert.equal(query.get('lon'), '21.01')
  assert.equal(query.get('height'), '120')
  assert.equal(query.get('height_datum'), 'ellipsoidal')
  assert.equal(query.get('requested_time_utc'), '2024-01-15T00:00:00Z')
  assert.equal(query.get('atmosphere_mode'), 'standard_scenario')
})

test('out-of-range coordinates clamp instead of producing invalid scenarios', () => {
  const state = parseObserveState(params({ lat: '123', lon: '-200', height: '99999' }))
  assert.equal(state.latitudeDeg, 90)
  assert.equal(state.longitudeDeg, -180)
  assert.equal(state.heightM, 9000)
})

test('invalid time input falls back to the fixture default', () => {
  const state = parseGlobeState(params({ requested_time_utc: 'not-a-time' }))
  assert.equal(state.requestedTimeUtc, FIXTURE_DEFAULTS.requestedTimeUtc)
})

test('globe query round-trips through the parser', () => {
  const original = parseGlobeState(
    params({ layer: 'display:atmosphere:fixture:surface-pressure-2x2:v1', lat: '51.5', lon: '20.5', zoom: '9' }),
  )
  const roundTripped = parseGlobeState(buildGlobeQuery(original))
  assert.deepEqual(roundTripped, original)
})

test('coordinate input accepts decimal degrees', () => {
  const result = parseCoordinateInput('52.01, 21.01')
  assert.deepEqual(result, { ok: true, latitudeDeg: 52.01, longitudeDeg: 21.01 })
})

test('coordinate input rejects malformed and out-of-range values', () => {
  assert.equal(parseCoordinateInput('warsaw').ok, false)
  assert.equal(parseCoordinateInput('91, 0').ok, false)
  assert.equal(parseCoordinateInput('52, 181').ok, false)
  assert.equal(parseCoordinateInput('52').ok, false)
})

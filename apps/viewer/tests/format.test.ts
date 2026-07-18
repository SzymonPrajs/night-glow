import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatLatLon,
  formatUtc,
  fromLocalInputValue,
  toLocalInputValue,
} from '../src/lib/format.ts'

test('coordinates carry hemisphere and fixed precision', () => {
  assert.equal(formatLatLon(52.01, 21.01), '52.0100° N, 21.0100° E')
  assert.equal(formatLatLon(-33.86, 151.2), '33.8600° S, 151.2000° E')
})

test('UTC formatting always states its basis', () => {
  assert.equal(formatUtc('2024-01-15T00:00:00Z'), '15 Jan 2024 · 00:00 UTC')
})

test('datetime-local conversion round-trips through the device zone', () => {
  const iso = '2024-06-15T12:30:00Z'
  const localValue = toLocalInputValue(iso)
  assert.match(localValue, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  // Whole-second instants come back in the canonical no-millis form.
  assert.equal(fromLocalInputValue(localValue), iso)
})

test('unparseable input converts to null instead of throwing', () => {
  assert.equal(fromLocalInputValue('not-a-date'), null)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { EMPTY_STATUS, reduceRuntime, runtimeLabel } from '../src/lib/status/model.ts'

const failure = { category: 'incompatible_semantics' as const, message: 'outside fixture validity' }

test('first compute runs Empty -> Computing -> Current', () => {
  let status = reduceRuntime(EMPTY_STATUS, { type: 'begin' })
  assert.equal(status.kind, 'computing')
  status = reduceRuntime(status, { type: 'progress', stage: 'solve_transfer', completed: 0.8 })
  assert.deepEqual(status, { kind: 'computing', stage: 'solve_transfer', completed: 0.8 })
  assert.equal(runtimeLabel(status), 'computing · solve_transfer')
  status = reduceRuntime(status, { type: 'product' })
  assert.equal(status.kind, 'current')
})

test('recompute with a retained result runs Updating and keeps the old label', () => {
  let status = reduceRuntime({ kind: 'current' }, { type: 'begin' })
  assert.equal(status.kind, 'updating')
  status = reduceRuntime(status, { type: 'progress', stage: 'load_environment', completed: 0.4 })
  assert.deepEqual(status, { kind: 'updating', stage: 'load_environment', completed: 0.4 })
  status = reduceRuntime(status, { type: 'product' })
  assert.equal(status.kind, 'current')
})

test('failure without a result is Failed; failure with a result is StaleError', () => {
  const failed = reduceRuntime({ kind: 'computing', stage: null, completed: 0 }, { type: 'failure', failure })
  assert.deepEqual(failed, { kind: 'failed', failure })
  const stale = reduceRuntime({ kind: 'updating', stage: null, completed: 0 }, { type: 'failure', failure })
  assert.deepEqual(stale, { kind: 'stale-error', failure })
  assert.equal(runtimeLabel(stale), 'kept previous · compute failed')
})

test('cancellation of superseded work never surfaces as an error', () => {
  const status = reduceRuntime(
    { kind: 'updating', stage: null, completed: 0 },
    { type: 'failure', failure: { category: 'cancelled', message: 'superseded' } },
  )
  assert.equal(status.kind, 'updating')
})

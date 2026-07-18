// Result state machine for the Sky view, per the architecture docs:
// Empty -> Computing -> Current, with Updating (old result retained, labelled)
// and StaleError (new scenario failed, old result retained) on recompute, and
// Failed when no usable result exists at all.
import type { FailureInfo, ProgressStage } from '../contracts/types.ts'

export type RuntimeStatus =
  | { kind: 'empty' }
  | { kind: 'computing'; stage: ProgressStage | null; completed: number }
  | { kind: 'current' }
  | { kind: 'updating'; stage: ProgressStage | null; completed: number }
  | { kind: 'stale-error'; failure: FailureInfo }
  | { kind: 'failed'; failure: FailureInfo }

export type RuntimeEvent =
  | { type: 'begin' }
  | { type: 'progress'; stage: ProgressStage; completed: number }
  | { type: 'product' }
  | { type: 'failure'; failure: FailureInfo }

function hasResult(status: RuntimeStatus): boolean {
  return status.kind === 'current' || status.kind === 'updating' || status.kind === 'stale-error'
}

export function reduceRuntime(status: RuntimeStatus, event: RuntimeEvent): RuntimeStatus {
  switch (event.type) {
    case 'begin':
      return hasResult(status)
        ? { kind: 'updating', stage: null, completed: 0 }
        : { kind: 'computing', stage: null, completed: 0 }
    case 'progress':
      if (status.kind === 'computing' || status.kind === 'updating') {
        return { kind: status.kind, stage: event.stage, completed: event.completed }
      }
      return status
    case 'product':
      return { kind: 'current' }
    case 'failure':
      if (event.failure.category === 'cancelled') {
        // Cancellation of superseded work is not an error surface; the newer
        // request owns the status already.
        return status
      }
      return hasResult(status)
        ? { kind: 'stale-error', failure: event.failure }
        : { kind: 'failed', failure: event.failure }
  }
}

export function runtimeLabel(status: RuntimeStatus): string {
  switch (status.kind) {
    case 'empty':
      return 'idle'
    case 'computing':
      return status.stage ? `computing · ${status.stage}` : 'computing…'
    case 'current':
      return 'current'
    case 'updating':
      return status.stage ? `updating · ${status.stage}` : 'updating…'
    case 'stale-error':
      return 'kept previous · compute failed'
    case 'failed':
      return 'failed'
  }
}

export const EMPTY_STATUS: RuntimeStatus = { kind: 'empty' }

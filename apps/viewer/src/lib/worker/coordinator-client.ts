// Typed main-thread client for the coordinator module worker served statically
// from /workers/coordinator.worker.js (synced from runtime/browser-worker/src/).
// The client owns request ids, progress routing, cancellation and disposal;
// it performs no scientific computation.
import type {
  CoordinatorCapabilities,
  FailureCategory,
  FailureInfo,
  ObserverRenderProduct,
  ProgressStage,
  RuntimeCompatibilityManifest,
  ScenarioRequest,
  WorkerOutbound,
} from '../contracts/types.ts'

export class CoordinatorFailure extends Error implements FailureInfo {
  readonly category: FailureCategory
  constructor(category: FailureCategory, message: string) {
    super(message)
    this.name = 'CoordinatorFailure'
    this.category = category
  }
}

interface PendingRequest {
  resolve: (product: ObserverRenderProduct) => void
  reject: (error: CoordinatorFailure) => void
  onProgress?: (stage: ProgressStage, completed: number) => void
}

export interface CoordinatorInit {
  environmentModuleBytes: ArrayBuffer
  physicsModuleBytes: ArrayBuffer
  compatibilityManifest: RuntimeCompatibilityManifest
}

export class CoordinatorClient {
  private worker: Worker
  private nextId = 0
  private activeRequestId: string | null = null
  private pending = new Map<string, PendingRequest>()
  private initWaiters: {
    resolve: (capabilities: CoordinatorCapabilities) => void
    reject: (error: CoordinatorFailure) => void
  }[] = []
  private disposeWaiters: { resolve: () => void; reject: (error: CoordinatorFailure) => void }[] = []
  private initialized: CoordinatorCapabilities | null = null
  private failed = false

  private constructor(worker: Worker) {
    this.worker = worker
    this.worker.addEventListener('message', (event: MessageEvent<WorkerOutbound>) =>
      this.onMessage(event.data),
    )
    this.worker.addEventListener('error', (event) => this.onWorkerError(event))
  }

  static create(): CoordinatorClient {
    return new CoordinatorClient(new Worker('/workers/coordinator.worker.js', { type: 'module' }))
  }

  capabilities(): CoordinatorCapabilities | null {
    return this.initialized
  }

  initialize(init: CoordinatorInit): Promise<CoordinatorCapabilities> {
    if (this.initialized) return Promise.resolve(this.initialized)
    return new Promise((resolve, reject) => {
      this.initWaiters.push({ resolve, reject })
      this.worker.postMessage({ type: 'initialize', ...init })
    })
  }

  commitScenario(
    request: Omit<ScenarioRequest, 'requestId'>,
    onProgress?: (stage: ProgressStage, completed: number) => void,
  ): Promise<ObserverRenderProduct> {
    if (this.failed) {
      return Promise.reject(new CoordinatorFailure('runtime_failure', 'Coordinator worker has failed.'))
    }
    if (this.activeRequestId) {
      // A new commit supersedes the previous one: cancel it first so the
      // worker drops stale work and the stale promise settles as cancelled.
      this.worker.postMessage({ type: 'cancel', requestId: this.activeRequestId })
    }
    const requestId = `viewer-${++this.nextId}`
    this.activeRequestId = requestId
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress })
      this.worker.postMessage({ type: 'commit-scenario', request: { ...request, requestId } })
    })
  }

  cancelActive(): void {
    if (this.activeRequestId) {
      this.worker.postMessage({ type: 'cancel', requestId: this.activeRequestId })
    }
  }

  dispose(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.failed) {
        this.worker.terminate()
        resolve()
        return
      }
      this.disposeWaiters.push({ resolve, reject })
      this.worker.postMessage({ type: 'dispose' })
      // The worker normally answers 'disposed'; guard against a wedged worker.
      setTimeout(() => {
        if (this.disposeWaiters.length > 0) {
          this.disposeWaiters.length = 0
          this.worker.terminate()
          resolve()
        }
      }, 2000)
    })
  }

  private onMessage(message: WorkerOutbound): void {
    switch (message.type) {
      case 'initialized': {
        const { type: _type, ...capabilities } = message
        this.initialized = capabilities
        this.initWaiters.splice(0).forEach((waiter) => waiter.resolve(capabilities))
        return
      }
      case 'progress': {
        this.pending.get(message.requestId)?.onProgress?.(message.stage, message.completed)
        return
      }
      case 'product': {
        const pending = this.pending.get(message.requestId)
        if (!pending) return // stale request already settled
        this.pending.delete(message.requestId)
        if (this.activeRequestId === message.requestId) this.activeRequestId = null
        const { type: _type, requestId: _requestId, ...product } = message
        pending.resolve(product)
        return
      }
      case 'failure': {
        const pending = this.pending.get(message.requestId)
        if (!pending) return
        this.pending.delete(message.requestId)
        if (this.activeRequestId === message.requestId) this.activeRequestId = null
        pending.reject(new CoordinatorFailure(message.category, message.message))
        return
      }
      case 'disposed': {
        this.disposeWaiters.splice(0).forEach((waiter) => waiter.resolve())
        this.worker.terminate()
        return
      }
    }
  }

  private onWorkerError(event: ErrorEvent): void {
    this.failed = true
    const failure = new CoordinatorFailure(
      'runtime_failure',
      `Coordinator worker error: ${event.message ?? 'unknown'}`,
    )
    this.initWaiters.splice(0).forEach((waiter) => waiter.reject(failure))
    this.pending.forEach((pending) => pending.reject(failure))
    this.pending.clear()
    this.activeRequestId = null
  }
}

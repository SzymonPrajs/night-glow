import { Coordinator, CoordinatorError } from './coordinator.js'

const coordinator = new Coordinator()

self.addEventListener('message', async (event) => {
  const message = event.data
  try {
    if (message.type === 'initialize') {
      const capabilities = await coordinator.initialize(message)
      self.postMessage({ type: 'initialized', ...capabilities })
    } else if (message.type === 'cancel') {
      coordinator.cancel(message.requestId)
    } else if (message.type === 'commit-scenario') {
      const product = await coordinator.commitScenario(message.request, (progress) => self.postMessage(progress))
      self.postMessage(product, [product.values.buffer])
    } else {
      throw new CoordinatorError('incompatible_schema', `Unknown coordinator message: ${message.type}`)
    }
  } catch (error) {
    self.postMessage({
      type: 'failure',
      requestId: message.request?.requestId ?? message.requestId,
      category: error instanceof CoordinatorError ? error.category : 'runtime_failure',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

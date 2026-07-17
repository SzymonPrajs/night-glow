const cancelled = new Set()

self.onmessage = ({ data }) => {
  if (data.type === 'cancel') {
    cancelled.add(data.scenarioRevision)
    return
  }
  if (data.type === 'solve') runChunk(data.scenarioRevision, data.remainingChunks)
}

function runChunk(scenarioRevision, remainingChunks) {
  if (cancelled.delete(scenarioRevision)) {
    self.postMessage({ type: 'cancelled', scenarioRevision })
    return
  }
  if (remainingChunks > 0) {
    setTimeout(() => runChunk(scenarioRevision, remainingChunks - 1), 0)
    return
  }

  const rgb = [
    1e-6, 8e-7, 5e-7, 1.2e-6, 9e-7, 5.5e-7,
    1.4e-6, 1e-6, 6e-7, 1.1e-6, 8.5e-7, 5.2e-7,
    3e-7, 3.5e-7, 4e-7, 3.2e-7, 3.7e-7, 4.2e-7,
    3.4e-7, 3.9e-7, 4.4e-7, 3.1e-7, 3.6e-7, 4.1e-7,
  ]
  const pixels = new Float32Array(2 * 4 * 4)
  let inputFlux = 0
  for (let pixel = 0; pixel < 8; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgb[pixel * 3 + channel]
      pixels[pixel * 4 + channel] = value
      inputFlux += value
    }
    pixels[pixel * 4 + 3] = 1
  }
  const buffer = pixels.buffer
  self.postMessage({
    type: 'product',
    scenarioRevision,
    coherentBarrier: 'coarse_complete',
    width: 4,
    height: 2,
    inputFlux,
    buffer,
  }, [buffer])
  self.postMessage({ type: 'transfer-state', scenarioRevision, detachedByteLength: buffer.byteLength })
}


import { expect, test } from '@playwright/test'

test('cancelled emission work cannot desynchronize the hook and worker LRU order', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/')

  const outcomes = await page.evaluate(async () => {
    type WorkerReply = {
      type: 'progress' | 'result' | 'cancelled' | 'error'
      requestId: number
      stage?: string
      message?: string
      result?: { diagnostics: { emissionCacheHit: boolean } }
    }

    const wavelengths = [420, 450, 480, 510, 550, 589, 625, 680]
    const atmosphere = {
      aod550: 0.14,
      angstromExponent: 1.3,
      aerosolScaleHeightKm: 1.4,
      aerosolAsymmetry: 0.68,
      singleScatteringAlbedo: 0.92,
      relativeHumidity: 0.5,
      cloudFraction: 0,
      cloudBaseKm: 6.5,
      cloudThicknessKm: 1.8,
      cloudOpticalDepth: 0,
      groundAlbedo: 0.15,
      maxScatteringOrder: 4,
    }
    const inlineKernel = {
      kind: 'inline' as const,
      cacheKey: 'emission-race-test-kernel',
      kernel: {
        distanceKm: Float32Array.of(0.125),
        relativeAzimuthDeg: Float32Array.of(0, 180),
        elevationDeg: Float32Array.of(0),
        wavelengthsNm: Float32Array.from(wavelengths),
        values: new Float32Array(16).fill(0.001),
        radianceUnit: 'relative-radiance-per-unit-upward-spectral-power',
      },
    }
    const cachedKernel = { kind: 'cache' as const, cacheKey: inlineKernel.cacheKey }
    const liveKernel = {
      kind: 'auto' as const,
      elevationDeg: Float32Array.from([
        0, 0.125, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 15, 20, 30, 45, 60, 75, 90,
      ]),
    }

    function inlineEmission(cacheKey: string) {
      return {
        kind: 'inline' as const,
        cacheKey,
        grid: {
          sectorCount: 4,
          ringRadiiKm: Float64Array.of(0.125),
          wavelengthsNm: Float64Array.from(wavelengths),
          upwardSpectralFlux: new Float64Array(4 * wavelengths.length).fill(1),
          fluxUnit: 'test-relative-flux',
        },
      }
    }

    function analyzeRequest(
      requestId: number,
      emission: ReturnType<typeof inlineEmission> | { kind: 'cache'; cacheKey: string },
    ) {
      return {
        type: 'analyze' as const,
        requestId,
        observer: { lat: 52.2297, lon: 21.0122, altitudeKm: 0.15 },
        atmosphere,
        emission,
        // Request four deliberately enters the yielding live builder, giving
        // the cancellation message a deterministic processing point after
        // emission resolution and before a result can commit its LRU change.
        kernel: requestId === 1 ? inlineKernel : requestId === 4 ? liveKernel : cachedKernel,
        options: { debounceMs: 0, estimateOuterBoundary: false },
      }
    }

    async function runScenario(cancelledRequest: 'inline' | 'cache') {
      return new Promise<{ finalCacheHit: boolean }>((resolve, reject) => {
        const worker = new Worker('/src/workers/physicalGlow.worker.ts', { type: 'module' })
        const seen: string[] = []
        const timeout = window.setTimeout(() => {
          worker.terminate()
          reject(new Error(`${cancelledRequest} cancellation scenario timed out: ${seen.join(' | ')}`))
        }, 15_000)
        let cancellationSent = false

        const finish = (value?: { finalCacheHit: boolean }, error?: Error) => {
          window.clearTimeout(timeout)
          worker.terminate()
          if (error) reject(error)
          else resolve(value!)
        }
        const send = (
          requestId: number,
          emission: ReturnType<typeof inlineEmission> | { kind: 'cache'; cacheKey: string },
        ) => worker.postMessage(analyzeRequest(requestId, emission))

        worker.onerror = (event) => finish(undefined, new Error(event.message))
        worker.onmessage = (event: MessageEvent<WorkerReply>) => {
          const message = event.data
          seen.push(`${message.requestId}:${message.type}:${message.stage ?? message.message ?? ''}`)
          if (message.type === 'error') {
            finish(undefined, new Error(message.message ?? `request ${message.requestId} failed`))
            return
          }
          if (message.type === 'progress' && message.requestId === 4 &&
              (message.stage === 'Emission rings ready' || message.stage === 'Reusing cached emission rings') &&
              !cancellationSent) {
            cancellationSent = true
            worker.postMessage({ type: 'cancel', requestId: 4 })
            return
          }
          if (message.type === 'cancelled' && message.requestId === 4) {
            if (cancelledRequest === 'inline') send(5, { kind: 'cache', cacheKey: 'A' })
            else send(5, inlineEmission('D'))
            return
          }
          if (message.type !== 'result') return
          if (message.requestId === 1) send(2, inlineEmission('B'))
          else if (message.requestId === 2) send(3, inlineEmission('C'))
          else if (message.requestId === 3) {
            send(4, cancelledRequest === 'inline'
              ? inlineEmission('D')
              : { kind: 'cache', cacheKey: 'A' })
          } else if (message.requestId === 5 && cancelledRequest === 'cache') {
            send(6, { kind: 'cache', cacheKey: 'B' })
          } else if (message.requestId === (cancelledRequest === 'inline' ? 5 : 6)) {
            finish({ finalCacheHit: message.result?.diagnostics.emissionCacheHit === true })
          }
        }

        send(1, inlineEmission('A'))
      })
    }

    return Promise.all([runScenario('inline'), runScenario('cache')])
  })

  expect(outcomes).toEqual([
    { finalCacheHit: true },
    { finalCacheHit: true },
  ])
})

import { expect, test } from '@playwright/test'

type ProbeReport = {
  webgl2: boolean
  floatColorBuffer: boolean
  cancelledRevision: number | null
  cancellationMs: number | null
  productRevision: number | null
  coherentBarrier: string | null
  transferredBytes: number | null
  detachedByteLength: number | null
  relativeFluxError: number | null
  disposed: boolean
}

test('transfers, uploads, atomically swaps and disposes a coherent HDR product', async ({ page }) => {
  await page.goto('/m1-probe/index.html')
  await expect(page.getByRole('status')).toHaveText('complete')
  const report = await page.evaluate(() => (window as Window & { __m1ProbeReport: ProbeReport }).__m1ProbeReport)

  expect(report.webgl2).toBe(true)
  expect(report.floatColorBuffer).toBe(true)
  expect(report.cancelledRevision).toBe(1)
  expect(report.cancellationMs).toBeLessThanOrEqual(100)
  expect(report.productRevision).toBe(2)
  expect(report.coherentBarrier).toBe('coarse_complete')
  expect(report.transferredBytes).toBe(128)
  expect(report.detachedByteLength).toBe(0)
  expect(report.relativeFluxError).toBeLessThanOrEqual(1e-6)
  expect(report.disposed).toBe(true)
})


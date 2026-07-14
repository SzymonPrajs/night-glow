import { expect, test } from '@playwright/test'

test('reports real solver progress and recomputes an atmosphere preset', async ({ page }, testInfo) => {
  test.setTimeout(45_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const sourceUrl = message.location().url
    const unavailableExternalResource = message.text().startsWith('Failed to load resource') &&
      (!sourceUrl || !sourceUrl.startsWith('http://127.0.0.1:5173'))
    if (!unavailableExternalResource) browserErrors.push(`${message.text()} ${sourceUrl}`.trim())
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Show Location map' }).hover()

  const progress = page.locator('.analysis-progress-track')
  await expect(page.getByRole('progressbar', { name: 'Physical sky analysis progress' })).toBeVisible()

  const observedProgress: number[] = []
  for (let sample = 0; sample < 240; sample += 1) {
    observedProgress.push(Number(await progress.getAttribute('aria-valuenow') ?? 0))
    if (await progress.getAttribute('aria-valuetext') === 'Physical sky field ready') break
    await page.waitForTimeout(50)
  }

  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  expect(observedProgress.some((value) => value > 0 && value < 90)).toBeTruthy()
  expect(isMonotonic(observedProgress)).toBeTruthy()
  const componentProgress = page.getByLabel('Analysis component progress')
  await expect(componentProgress.locator(':scope > div')).toHaveCount(4)
  await expect(componentProgress).not.toContainText('Local map detail')
  await expect(componentProgress).toContainText('Source grid100%')
  await expect(componentProgress).toContainText('Atmosphere kernel100%')
  await expect(componentProgress).toContainText('Sky convolution100%')
  await expect(componentProgress).toContainText('Numerical checks100%')

  await page.waitForTimeout(1_000)
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  await expect(progress).toHaveAttribute('aria-valuenow', '100')
  await expect(page.getByText('81', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('720', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.analysis-grid')).toContainText('22adaptive elevations')
  await expect(page.getByText('8', { exact: true }).first()).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('canvas').hover()
  await page.mouse.wheel(0, -600)
  await page.waitForTimeout(250)
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  await expect(progress).toHaveAttribute('aria-valuenow', '100')

  await page.getByRole('button', { name: 'Show Sky settings' }).hover()
  await page.getByRole('button', { name: 'Humid', exact: true }).click()
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow') ?? 100)).toBeLessThan(90)
  const recomputeProgress: number[] = []
  for (let sample = 0; sample < 240; sample += 1) {
    recomputeProgress.push(Number(await progress.getAttribute('aria-valuenow') ?? 0))
    if (await progress.getAttribute('aria-valuetext') === 'Physical sky field ready') break
    await page.waitForTimeout(50)
  }
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  expect(recomputeProgress.some((value) => value > 2 && value < 90)).toBeTruthy()
  expect(isMonotonic(recomputeProgress)).toBeTruthy()

  await page.getByRole('button', { name: 'Show Location map' }).hover()
  await page.waitForTimeout(350)
  await page.screenshot({ path: testInfo.outputPath('physical-sky-ready.png'), fullPage: true })
  expect(browserErrors).toEqual([])
})

function isMonotonic(values: readonly number[]) {
  return values.every((value, index) => index === 0 || value >= values[index - 1])
}

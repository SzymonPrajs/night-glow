import { expect, test } from '@playwright/test'

test('reports real solver progress and recomputes an atmosphere preset', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Show Location map' }).hover()

  const progress = page.locator('.analysis-progress-track')
  await expect(page.getByRole('progressbar', { name: 'Physical sky analysis progress' })).toBeVisible()

  const observedProgress: number[] = []
  for (let sample = 0; sample < 40; sample += 1) {
    observedProgress.push(Number(await progress.getAttribute('aria-valuenow') ?? 0))
    if (await progress.getAttribute('aria-valuetext') === 'Physical sky field ready') break
    await page.waitForTimeout(50)
  }

  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  expect(observedProgress.some((value) => value > 0 && value < 90)).toBeTruthy()
  await expect(page.getByLabel('Analysis component progress')).toContainText('Emission rings100%')
  await expect(page.getByLabel('Analysis component progress')).toContainText('Atmosphere kernel100%')
  await expect(page.getByLabel('Analysis component progress')).toContainText('Sky convolution100%')
  await expect(page.getByLabel('Analysis component progress')).toContainText('Numerical checks100%')
  await expect(page.getByText('81', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('720', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('8', { exact: true }).first()).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Show Atmosphere settings' }).hover()
  await page.getByRole('button', { name: 'Humid', exact: true }).click()
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow') ?? 100)).toBeLessThan(90)
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')

  await page.getByRole('button', { name: 'Show Location map' }).hover()
  await page.screenshot({ path: testInfo.outputPath('physical-sky-ready.png'), fullPage: true })
  expect(browserErrors).toEqual([])
})

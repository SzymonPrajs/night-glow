import { expect, test, type Page } from '@playwright/test'

const APPEARANCE_STORAGE_KEY = 'night-glow:appearance-mode'

test('changes only sky presentation without changing physical stars, metrics, or glow', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/')

  const shell = page.locator('.app-shell')
  const progress = page.locator('.analysis-progress-track')
  const summary = page.getByLabel('Sky visibility summary')
  const canvas = page.locator('canvas.sky-canvas')
  const solverTimings = page.getByLabel('Solver timing breakdown')
  await expect(shell).toHaveAttribute('data-appearance', 'realistic')
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')

  const summaryBefore = await summary.innerText()
  const solverTimingsBefore = await solverTimings.innerText()
  const progressTextBefore = await progress.getAttribute('aria-valuetext')
  const progressValueBefore = await progress.getAttribute('aria-valuenow')

  await page.getByRole('button', { name: 'Show Sky settings' }).hover()
  const appearanceGroup = page.getByRole('group', { name: 'Sky appearance' })
  const realistic = appearanceGroup.getByRole('radio', { name: /^Realistic/ })
  const atlas = appearanceGroup.getByRole('radio', { name: /^Atlas/ })
  await expect(appearanceGroup).toBeVisible()
  await expect(realistic).toBeChecked()
  await expect(atlas).not.toBeChecked()
  await settleRendering(page)
  const realisticFrame = await canvas.screenshot()

  await realistic.focus()
  await page.keyboard.press('ArrowRight')
  await expect(shell).toHaveAttribute('data-appearance', 'atlas')
  await expect(atlas).toBeChecked()
  await expect(realistic).not.toBeChecked()
  await settleRendering(page)
  const summaryAfter = await summary.innerText()
  const atlasFrame = await canvas.screenshot()
  expect(summaryAfter).toBe(summaryBefore)
  expect(await solverTimings.innerText()).toBe(solverTimingsBefore)
  expect(atlasFrame.equals(realisticFrame)).toBeFalsy()
  await expect(progress).toHaveAttribute('aria-valuetext', progressTextBefore!)
  await expect(progress).toHaveAttribute('aria-valuenow', progressValueBefore!)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBe('atlas')

  await page.keyboard.press('ArrowLeft')
  await expect(shell).toHaveAttribute('data-appearance', 'realistic')
  await expect(realistic).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(shell).toHaveAttribute('data-appearance', 'atlas')
  await expect(atlas).toBeChecked()

  await page.reload()
  await expect(shell).toHaveAttribute('data-appearance', 'atlas')
  await expect(page.getByRole('radio', { name: /^Atlas/ })).toBeChecked()
})

test('falls back to Realistic when persisted appearance data is malformed', async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, 'oversaturated-neon')
  }, { key: APPEARANCE_STORAGE_KEY })

  await page.goto('/')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-appearance', 'realistic')
  await page.getByRole('button', { name: 'Show Sky settings' }).hover()
  await expect(page.getByRole('radio', { name: /^Realistic/ })).toBeChecked()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBe('realistic')
})

async function settleRendering(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

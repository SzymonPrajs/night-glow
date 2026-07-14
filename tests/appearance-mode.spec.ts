import { expect, test } from '@playwright/test'

const APPEARANCE_STORAGE_KEY = 'night-glow:appearance-mode'

test('offers accessible appearance modes without recomputing the physical analysis', async ({ page }) => {
  await page.goto('/')

  const shell = page.locator('.app-shell')
  const progress = page.locator('.analysis-progress-track')
  const summary = page.getByLabel('Sky visibility summary')
  await expect(shell).toHaveAttribute('data-appearance', 'realistic')
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')

  const summaryBefore = await summary.innerText()
  const physicalSummaryBefore = await summary.locator('.summary-metric').nth(0).innerText() +
    await summary.locator('.summary-metric').nth(1).innerText()
  const progressTextBefore = await progress.getAttribute('aria-valuetext')
  const progressValueBefore = await progress.getAttribute('aria-valuenow')

  await page.getByRole('button', { name: 'Show Sky settings' }).hover()
  const appearanceGroup = page.getByRole('group', { name: 'Sky appearance' })
  const realistic = appearanceGroup.getByRole('radio', { name: /^Realistic/ })
  const atlas = appearanceGroup.getByRole('radio', { name: /^Atlas/ })
  await expect(appearanceGroup).toBeVisible()
  await expect(realistic).toBeChecked()
  await expect(atlas).not.toBeChecked()

  await realistic.focus()
  await page.keyboard.press('ArrowRight')
  await expect(shell).toHaveAttribute('data-appearance', 'atlas')
  await expect(atlas).toBeChecked()
  await expect(realistic).not.toBeChecked()
  const summaryAfter = await summary.innerText()
  const physicalSummaryAfter = await summary.locator('.summary-metric').nth(0).innerText() +
    await summary.locator('.summary-metric').nth(1).innerText()
  expect(physicalSummaryAfter).toBe(physicalSummaryBefore)
  expect(summaryAfter).not.toBe(summaryBefore)
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
  await page.getByRole('button', { name: 'Show Sky settings' }).hover()
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

import { expect, test, type Page } from '@playwright/test'

// Smoke coverage for the production Viewer over the synthetic fixture slice.
// Every test also asserts a clean console: a WebGL or worker failure must
// never pass silently.

const FIXTURE_TIME = '2024-01-15T00:00:00Z'

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

function runtimePill(page: Page) {
  return page.locator('span[role="status"][aria-label^="Runtime status"]')
}

async function waitForCurrent(page: Page) {
  await expect(runtimePill(page).filter({ hasText: 'current' }).first()).toBeVisible({ timeout: 30_000 })
}

test('globe pick leads to a current sky', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto(`/globe?requested_time_utc=${FIXTURE_TIME}`)
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()
  // The layer dock lists the fixture display products.
  await expect(page.getByRole('radio', { name: /Light emission/ })).toBeVisible()

  await page.waitForTimeout(2_000) // let the map finish its first render
  const box = await canvas.boundingBox()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  const placeCard = page.locator('section[aria-label="Picked location"]')
  await expect(placeCard).toBeVisible({ timeout: 10_000 })
  await expect(placeCard).toContainText('nW cm-2 sr-1')

  await placeCard.getByRole('button', { name: 'Enter sky here' }).click()
  await page.waitForURL('**/observe**')
  await waitForCurrent(page)
  await expect(page.locator('span[aria-label^="Scientific status"]')).toContainText('synthetic fixture')
  expect(errors).toEqual([])
})

test('first-load failure fails closed and recovers via the fixture time', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/observe?lat=50&lon=19&requested_time_utc=2025-06-01T00:00:00Z')
  const failedPanel = page.locator('[role="alert"]').filter({ hasText: 'could not be computed' })
  await expect(failedPanel).toBeVisible({ timeout: 30_000 })

  await failedPanel.getByRole('button', { name: /Use the fixture time/ }).click()
  await waitForCurrent(page)
  expect(errors).toEqual([])
})

test('failed commit keeps the previous sky and offers recovery', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/observe')
  await waitForCurrent(page)

  await page.getByRole('button', { name: 'One hour later' }).click()
  const retained = page.locator('[role="note"]').filter({ hasText: 'Kept the previous sky' })
  await expect(retained).toBeVisible({ timeout: 30_000 })

  await retained.getByRole('button', { name: 'Use the fixture time' }).click()
  await waitForCurrent(page)
  expect(errors).toEqual([])
})

test('display controls never rerun physics', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/observe')
  await waitForCurrent(page)

  await page.getByRole('button', { name: 'Display', exact: true }).click()
  const dialog = page.locator('[role="dialog"][aria-label="Display settings"]')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('display only', { ignoreCase: true })

  await dialog.getByRole('slider', { name: /^Exposure/ }).focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(500)

  await expect(page.locator('[aria-label="Computation progress"]')).toHaveCount(0)
  await expect(runtimePill(page).first()).toHaveText('current')
  expect(errors).toEqual([])
})

test('mini-map relocation commits a new scenario', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/observe')
  await waitForCurrent(page)

  await page.getByRole('button', { name: 'Map', exact: true }).click()
  const miniMap = page.locator('[aria-label="Relocation mini-map"]')
  await expect(miniMap).toBeVisible({ timeout: 15_000 })

  const box = await miniMap.boundingBox()
  // The map may still be initializing when the container becomes visible;
  // retry the preview click until MapLibre registers it.
  const moveButton = page.getByRole('button', { name: 'Move sky here' })
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.mouse.click(box!.x + box!.width * 0.25, box!.y + box!.height * 0.3)
    try {
      await moveButton.waitFor({ timeout: 2_000 })
      break
    } catch {
      if (attempt === 5) throw new Error('mini-map never registered a preview click')
    }
  }
  await moveButton.click()
  await waitForCurrent(page)
  await expect(page).toHaveURL(/[?&]lat=/) // relocation committed scenario state to the URL
  expect(errors).toEqual([])
})

test('inspector shows products, computation and fixture provenance', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/observe')
  await waitForCurrent(page)

  await page.getByRole('button', { name: 'Inspector', exact: true }).click()
  const sheet = page.locator('[role="dialog"][aria-label="Scientific inspector"]')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText('Observer render product')

  await sheet.getByRole('tab', { name: 'Computation' }).click()
  await expect(sheet).toContainText('Coordinator capabilities')

  await sheet.getByRole('tab', { name: 'Provenance' }).click()
  await expect(sheet).toContainText('Fixture provenance')
  await expect(sheet).toContainText('Fixture revision')
  expect(errors).toEqual([])
})

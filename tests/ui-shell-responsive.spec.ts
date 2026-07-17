import { expect, test, type Page } from '@playwright/test'

const SCENARIOS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'split screen', width: 960, height: 640 },
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'short landscape', width: 844, height: 390 },
] as const

test.describe('responsive UI shell', () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page)
  })

  test('keeps essential chrome visible and inside each viewport', async ({ page }) => {
    test.setTimeout(90_000)
    for (const scenario of SCENARIOS) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height })
      await page.goto('/')

      const summary = page.getByLabel('Sky visibility summary')
      await expect(summary, `${scenario.name} summary`).toBeVisible()
      await expect(summary).toContainText('Sky quality')
      await expect(summary).toContainText('Weather')
      await expect(summary).toContainText('Model')
      const presentationSlider = page.getByRole('slider', { name: 'Sky presentation, Realistic to Enhanced' })
      await expect(presentationSlider).toBeVisible()
      const presentationRange = page.locator('.presentation-range')
      await expect(presentationRange.getByText('Realistic', { exact: true })).toBeVisible()
      await expect(presentationRange.getByText('Enhanced', { exact: true })).toBeVisible()
      await expect(page.getByText('Warsaw, Poland')).toBeAttached()
      await expect(page.getByText(/Device time/)).toBeAttached()

      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth - window.innerWidth,
        height: document.documentElement.scrollHeight - window.innerHeight,
      }))
      expect(overflow.width, `${scenario.name} horizontal overflow`).toBe(0)
      expect(overflow.height, `${scenario.name} vertical overflow`).toBe(0)

      for (const selector of [
        '.topbar',
        '.sky-summary',
        '.presentation-control',
        '.time-dock',
        '.reset-view',
        '.side-drawer.left .drawer-tab',
        '.side-drawer.right .drawer-tab',
      ]) {
        await expectInsideViewport(page, selector, scenario.name)
      }
    }
  })

  test('coordinates compact drawers, restores focus, and supports panel scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const mapTrigger = page.locator('.side-drawer.left .drawer-tab')
    const settingsTrigger = page.locator('.side-drawer.right .drawer-tab')
    const mapPanel = page.locator('.side-drawer.left .drawer-panel')
    const settingsPanel = page.locator('.side-drawer.right .drawer-panel')

    await mapTrigger.click()
    await expectDrawerSettled(page, mapPanel)
    await expect(mapTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false')

    await settingsTrigger.click()
    await expectDrawerSettled(page, settingsPanel)
    await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(mapTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.side-drawer.is-open')).toHaveCount(1)

    const touchTargets = [
      settingsPanel.getByRole('button', { name: 'Close Atmosphere' }),
      settingsPanel.getByRole('button', { name: /Pin Atmosphere/ }),
      settingsPanel.getByRole('tab', { name: 'Presets' }),
      settingsPanel.getByRole('tab', { name: 'Custom' }),
      page.getByRole('slider', { name: 'Sky presentation, Realistic to Enhanced' }),
      settingsTrigger,
    ]
    for (const target of touchTargets) {
      const box = await target.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }

    const scrollState = await settingsPanel.evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight
      return {
        scrollTop: panel.scrollTop,
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
      }
    })
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight)
    expect(scrollState.scrollTop + scrollState.clientHeight).toBeGreaterThanOrEqual(scrollState.scrollHeight - 2)

    await settingsPanel.getByRole('button', { name: 'Close Atmosphere' }).click()
    await expect(settingsTrigger).toBeFocused()
    await expect(settingsTrigger).toHaveAttribute('aria-expanded', 'false')

    await mapTrigger.click()
    await expectDrawerSettled(page, mapPanel)
    await page.keyboard.press('Escape')
    await expect(mapTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(mapTrigger).toBeFocused()
  })

  test('reconciles persisted dual pins when the viewport becomes compact', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 640 })
    await page.addInitScript(() => {
      localStorage.setItem('night-glow:map-pinned', 'true')
      localStorage.setItem('night-glow:settings-pinned', 'true')
    })
    await page.goto('/')

    await expect.poll(() => page.locator('.side-drawer.is-pinned').count()).toBe(1)
    await expect(page.locator('.side-drawer.is-open')).toHaveCount(1)
    await expect(page.locator('.drawer-panel[aria-hidden="false"]')).toHaveCount(1)
  })
})

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    let nextFrameId = 1
    const timers = new Map<number, number>()
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      const timer = window.setTimeout(() => {
        timers.delete(id)
        callback(performance.now())
      }, 120)
      timers.set(id, timer)
      return id
    }
    window.cancelAnimationFrame = (id: number) => {
      const timer = timers.get(id)
      if (timer !== undefined) window.clearTimeout(timer)
      timers.delete(id)
    }
  })
}

async function expectInsideViewport(page: Page, selector: string, scenario: string) {
  const box = await page.locator(selector).boundingBox()
  expect(box, `${scenario}: ${selector} should have a box`).not.toBeNull()
  if (!box) return
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  if (!viewport) return
  expect(box.x, `${scenario}: ${selector} left`).toBeGreaterThanOrEqual(-1)
  expect(box.y, `${scenario}: ${selector} top`).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width, `${scenario}: ${selector} right`).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height, `${scenario}: ${selector} bottom`).toBeLessThanOrEqual(viewport.height + 1)
}

async function expectDrawerSettled(page: Page, panel: ReturnType<Page['locator']>) {
  await expect(panel).toHaveAttribute('aria-hidden', 'false')
  await expect.poll(async () => {
    const box = await panel.boundingBox()
    const viewport = page.viewportSize()
    return Boolean(box && viewport && box.x >= -1 && box.x + box.width <= viewport.width + 1)
  }).toBe(true)
  const box = await panel.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (!box || !viewport) return
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
}

import { expect, test, type Page } from '@playwright/test'

const SKY_ENHANCEMENT_STORAGE_KEY = 'night-glow:sky-enhancement'
const LEGACY_APPEARANCE_STORAGE_KEY = 'night-glow:appearance-mode'

test('continuously changes presentation without changing the physical sky', async ({ page }) => {
  test.setTimeout(60_000)
  await preparePage(page)
  await page.goto('/')

  const shell = page.locator('.app-shell')
  const slider = page.getByRole('slider', { name: 'Sky presentation, Realistic to Enhanced' })
  const progress = page.locator('.analysis-progress-track')
  const summary = page.getByLabel('Sky visibility summary')
  const canvas = page.locator('canvas.sky-canvas')
  const solverTimings = page.getByLabel('Solver timing breakdown')

  await expect(shell).toHaveAttribute('data-sky-enhancement', '0.00')
  await expect(slider).toHaveValue('0')
  await expect(slider).toHaveAttribute('aria-valuetext', /Realistic; presentation only/)
  await expect(page.getByRole('group', { name: 'Sky appearance' })).toHaveCount(0)
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready', { timeout: 45_000 })

  const invariants = {
    summary: await summary.innerText(),
    timings: await solverTimings.innerText(),
    progressText: await progress.getAttribute('aria-valuetext'),
    progressValue: await progress.getAttribute('aria-valuenow'),
    analysisRequests: await instrumentation(page, 'analysisRequests'),
    createdCanvases: await instrumentation(page, 'createdCanvases'),
  }

  await settleRendering(page)
  const realisticFrame = await canvas.screenshot()

  await slider.fill('50')
  await expect(shell).toHaveAttribute('data-sky-enhancement', '0.50')
  await expect(slider).toHaveAttribute('aria-valuetext', /50 percent enhanced/)
  await settleRendering(page)
  const midpointFrame = await canvas.screenshot()

  await slider.fill('100')
  await expect(shell).toHaveAttribute('data-sky-enhancement', '1.00')
  await expect(slider).toHaveAttribute('aria-valuetext', /Enhanced; presentation only/)
  await settleRendering(page)
  const enhancedFrame = await canvas.screenshot()

  expect(midpointFrame.equals(realisticFrame)).toBeFalsy()
  expect(midpointFrame.equals(enhancedFrame)).toBeFalsy()
  expect(enhancedFrame.equals(realisticFrame)).toBeFalsy()
  expect(await summary.innerText()).toBe(invariants.summary)
  expect(await solverTimings.innerText()).toBe(invariants.timings)
  await expect(progress).toHaveAttribute('aria-valuetext', invariants.progressText!)
  await expect(progress).toHaveAttribute('aria-valuenow', invariants.progressValue!)
  expect(await instrumentation(page, 'analysisRequests')).toBe(invariants.analysisRequests)
  expect(await instrumentation(page, 'createdCanvases')).toBe(invariants.createdCanvases)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SKY_ENHANCEMENT_STORAGE_KEY)).toBe('1')

  await page.reload()
  await expect(shell).toHaveAttribute('data-sky-enhancement', '1.00')
  await expect(slider).toHaveValue('100')
})

test('migrates legacy presentation values and rejects malformed storage', async ({ page }) => {
  await preparePage(page)
  await page.addInitScript(({ legacyKey }) => {
    localStorage.setItem(legacyKey, 'atlas')
  }, { legacyKey: LEGACY_APPEARANCE_STORAGE_KEY })
  await page.goto('/')

  await expect(page.locator('.app-shell')).toHaveAttribute('data-sky-enhancement', '1.00')
  await expect(page.getByRole('slider', { name: 'Sky presentation, Realistic to Enhanced' })).toHaveValue('100')
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LEGACY_APPEARANCE_STORAGE_KEY)).toBeNull()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SKY_ENHANCEMENT_STORAGE_KEY)).toBe('1')

  await page.evaluate(({ key }) => localStorage.setItem(key, 'oversaturated-neon'), { key: SKY_ENHANCEMENT_STORAGE_KEY })
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-sky-enhancement', '0.00')
  await expect(page.getByRole('slider', { name: 'Sky presentation, Realistic to Enhanced' })).toHaveValue('0')
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SKY_ENHANCEMENT_STORAGE_KEY)).toBe('0')
})

async function instrumentation(page: Page, key: 'analysisRequests' | 'createdCanvases') {
  return page.evaluate((name) => (window as Window & {
    __presentationAudit?: { analysisRequests: number; createdCanvases: number }
  }).__presentationAudit?.[name] ?? 0, key)
}

async function settleRendering(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function preparePage(page: Page) {
  await page.setViewportSize({ width: 960, height: 640 })
  await page.addInitScript(() => {
    const audit = { analysisRequests: 0, createdCanvases: 0 }
    ;(window as Window & { __presentationAudit?: typeof audit }).__presentationAudit = audit

    const createElement = document.createElement.bind(document)
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'canvas') audit.createdCanvases += 1
      return createElement(tagName, options)
    }) as typeof document.createElement

    const postMessage = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message: unknown, transfer?: Transferable[]) {
      if (message && typeof message === 'object' && 'type' in message && message.type === 'analyze') {
        audit.analysisRequests += 1
      }
      return transfer === undefined
        ? postMessage.call(this, message)
        : postMessage.call(this, message, transfer)
    }

    let nextFrameId = 1
    const timers = new Map<number, number>()
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      const timer = window.setTimeout(() => {
        timers.delete(id)
        callback(performance.now())
      }, 100)
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

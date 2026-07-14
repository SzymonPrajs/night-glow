import { expect, test, type Page } from '@playwright/test'

test('reports real solver progress and recomputes an atmosphere preset', async ({ page }, testInfo) => {
  test.setTimeout(45_000)
  await preparePage(page)
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

  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  // Shipped preset kernels may complete before the drawer is opened. The
  // atmosphere change below must still expose real intermediate progress.
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
  await beginProgressRecording(page)
  await page.getByRole('button', { name: 'Humid', exact: true }).click()
  await expect.poll(() => sawIncompleteProgress(page), {
    message: 'The Humid preset should expose observable solver progress',
    timeout: 10_000,
  }).toBe(true)
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')

  await page.getByRole('button', { name: 'Show Location map' }).hover()
  await page.waitForTimeout(350)
  await page.screenshot({ path: testInfo.outputPath('physical-sky-ready.png'), fullPage: true })
  expect(browserErrors).toEqual([])
})

async function preparePage(page: Page) {
  await page.setViewportSize({ width: 960, height: 640 })
  await page.addInitScript(() => {
    let nextFrameId = 1
    const timers = new Map<number, number>()
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      const timer = window.setTimeout(() => {
        timers.delete(id)
        callback(performance.now())
      }, 200)
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

async function beginProgressRecording(page: Page) {
  await page.evaluate(() => {
    type ProgressWindow = Window & {
      __physicalProgress?: Array<{ value: number; stage: string }>
      __physicalProgressObserver?: MutationObserver
    }
    const progressWindow = window as ProgressWindow
    progressWindow.__physicalProgressObserver?.disconnect()
    progressWindow.__physicalProgress = []
    const progress = document.querySelector<HTMLElement>('[aria-label="Physical sky analysis progress"]')
    if (!progress) throw new Error('Physical sky progress bar is missing')
    const record = () => progressWindow.__physicalProgress!.push({
      value: Number(progress.getAttribute('aria-valuenow')),
      stage: progress.getAttribute('aria-valuetext') ?? '',
    })
    record()
    progressWindow.__physicalProgressObserver = new MutationObserver(record)
    progressWindow.__physicalProgressObserver.observe(progress, {
      attributes: true,
      attributeFilter: ['aria-valuenow', 'aria-valuetext'],
    })
  })
}

async function sawIncompleteProgress(page: Page) {
  return page.evaluate(() => {
    const samples = (window as Window & {
      __physicalProgress?: Array<{ value: number; stage: string }>
    }).__physicalProgress ?? []
    return samples.some(({ value, stage }) => value < 100 && stage !== 'Physical sky field ready')
  })
}

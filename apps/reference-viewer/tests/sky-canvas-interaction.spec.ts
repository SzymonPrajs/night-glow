import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'

test.describe('sky canvas interaction and resolution', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await preparePage(page)
    await page.setViewportSize({ width: 960, height: 640 })
    await page.goto('/')
  })

  test('supports keyboard look, zoom, and reset', async ({ page }) => {
    const canvas = page.getByLabel('Interactive three-dimensional sky')
    await canvas.focus()
    await expect(canvas).toBeFocused()

    const initial = await readView(page)
    await page.keyboard.press('ArrowRight')
    const moved = await readView(page)
    expect(moved.azimuth).not.toBe(initial.azimuth)

    await page.keyboard.press('=')
    const zoomed = await readView(page)
    expect(zoomed.fov).toBeLessThan(moved.fov)

    await page.keyboard.press('Home')
    const reset = await readView(page)
    expect(reset.azimuth).toBe(180)
    expect(reset.altitude).toBe(17)
    expect(reset.fov).toBe(62)
  })

  test('supports pinch zoom and clears cancelled pointers', async ({ page }) => {
    const before = await readView(page)
    await page.locator('canvas.sky-canvas').evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement
      element.setPointerCapture = () => undefined
      const rect = element.getBoundingClientRect()
      const y = rect.top + rect.height / 2
      const fire = (type: string, pointerId: number, x: number) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        isPrimary: pointerId === 1,
      }))
      fire('pointerdown', 1, rect.left + rect.width / 2 - 45)
      fire('pointerdown', 2, rect.left + rect.width / 2 + 45)
      fire('pointermove', 2, rect.left + rect.width / 2 + 105)
      fire('pointerup', 1, rect.left + rect.width / 2 - 45)
      fire('pointerup', 2, rect.left + rect.width / 2 + 105)
    })
    const pinched = await readView(page)
    expect(pinched.fov).toBeLessThan(before.fov)

    await page.keyboard.press('Home')
    const reset = await readView(page)
    await page.locator('canvas.sky-canvas').evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement
      element.setPointerCapture = () => undefined
      const rect = element.getBoundingClientRect()
      const start = new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: rect.left + 100,
        clientY: rect.top + 100,
      })
      const cancel = new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: rect.left + 100,
        clientY: rect.top + 100,
      })
      const strayMove = new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: rect.left + 240,
        clientY: rect.top + 180,
      })
      element.dispatchEvent(start)
      element.dispatchEvent(cancel)
      element.dispatchEvent(strayMove)
    })
    expect(await readView(page)).toEqual(reset)
  })

  test('keeps the map heading arrow continuous across north', async ({ page }) => {
    await page.locator('.side-drawer.left .drawer-tab').click()
    const arrow = page.locator('.observer-direction')
    await expect(arrow).toBeAttached()
    await expect(arrow).toHaveAttribute('style', /rotate/)
    const canvas = page.getByLabel('Interactive three-dimensional sky')
    await canvas.focus()

    let previous = await arrowAngle(arrow)
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press('Shift+ArrowRight')
      const current = await arrowAngle(arrow)
      expect(Math.abs(current - previous)).toBeLessThanOrEqual(10.1)
      previous = current
    }
  })

  test('uses native DPR at 1x and caps high-density displays at 2x', async ({ browser }) => {
    expect(await canvasRatio(browser, 1)).toBeCloseTo(1, 1)
    expect(await canvasRatio(browser, 3)).toBeCloseTo(2, 1)
  })
})

async function preparePage(page: Page) {
  await page.addInitScript(() => {
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

async function readView(page: Page) {
  return page.locator('.view-readout').evaluate((readout) => {
    const heading = readout.querySelector('strong')?.textContent ?? ''
    const detail = readout.querySelector('span')?.textContent ?? ''
    const azimuth = Number(heading.match(/([0-9]+)°/)?.[1])
    const values = [...detail.matchAll(/([0-9]+)°/g)].map((match) => Number(match[1]))
    return { azimuth, altitude: values[0], fov: values[1] }
  })
}

async function arrowAngle(arrow: Locator) {
  const transform = await arrow.evaluate((element) => (element as HTMLElement).style.transform)
  const angle = Number(transform.match(/rotate\((-?[0-9.]+)deg\)/)?.[1])
  if (!Number.isFinite(angle)) throw new Error(`Expected a rotate() transform, received ${transform}`)
  return angle
}

async function canvasRatio(browser: Browser, deviceScaleFactor: number) {
  const context = await browser.newContext({
    viewport: { width: 480, height: 360 },
    deviceScaleFactor,
  })
  const page = await context.newPage()
  await preparePage(page)
  await page.goto('/')
  const expectedRatio = deviceScaleFactor > 2 ? 2 : deviceScaleFactor
  await expect.poll(async () => page.locator('canvas.sky-canvas').evaluate((canvas) => canvas.width / canvas.clientWidth)).toBeCloseTo(expectedRatio, 1)
  const ratio = await page.locator('canvas.sky-canvas').evaluate((canvas) => canvas.width / canvas.clientWidth)
  await context.close()
  return ratio
}

import { expect, test, type Page } from '@playwright/test'
import {
  DEFAULT_WEATHER_PRESET_ID,
  WEATHER_PRESETS,
  type WeatherPreset,
} from '../src/lib/weatherPresets'

const WARSAW_MOONLESS_NIGHT = '2026-09-11T01:00'
const defaultPreset = requiredPreset(DEFAULT_WEATHER_PRESET_ID)
const lowOvercastPreset = requiredPreset('low-overcast')

test('exposes preset-first controls and credible Warsaw clear/overcast output', async ({ page }) => {
  test.setTimeout(120_000)
  await preparePage(page)
  await page.goto('/')

  await expect(page.locator('.analysis-progress-track')).toHaveAttribute(
    'aria-valuetext',
    'Physical sky field ready',
    { timeout: 45_000 },
  )
  const observationTime = page.getByLabel('Observation date and time')
  const skyClassMetric = page.getByLabel('Sky visibility summary').locator('.summary-metric').first()
  await observationTime.fill('2026-07-14T12:00')
  await expect(skyClassMetric).toContainText('Sky state')
  await expect(skyClassMetric.locator('strong')).toHaveText('Daylight')
  await observationTime.fill(WARSAW_MOONLESS_NIGHT)
  await expect(skyClassMetric).toContainText('Bortle')
  await expect(skyClassMetric.locator('strong')).toHaveText(/^Class [1-9]$/)
  await page.getByRole('button', { name: 'Show Sky settings' }).click()
  const progress = page.getByRole('progressbar', { name: 'Weather analysis progress' })
  await expect(progress).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready')
  await expect(page.locator('.weather-analysis-label [role="status"]')).toHaveAttribute('aria-live', 'polite')

  const weatherTabs = page.getByRole('tablist', { name: 'Weather controls' })
  const presetsTab = weatherTabs.getByRole('tab', { name: 'Presets' })
  const customTab = weatherTabs.getByRole('tab', { name: 'Custom' })
  const presetsPanel = page.locator('#weather-presets-panel')
  const customPanel = page.locator('#weather-custom-panel')
  await expect(weatherTabs).toBeVisible()
  await expect(presetsTab).toHaveAttribute('aria-selected', 'true')
  await expect(customTab).toHaveAttribute('aria-selected', 'false')
  await expect(presetsTab).toHaveAttribute('tabindex', '0')
  await expect(customTab).toHaveAttribute('tabindex', '-1')
  await expect(presetsPanel).toBeVisible()
  await expect(customPanel).toBeHidden()
  await expect(page.locator('.sliders')).toBeHidden()
  await expect(presetButton(page, defaultPreset)).toHaveAttribute('aria-pressed', 'true')
  await expect(presetButton(page, defaultPreset)).toHaveAccessibleDescription(defaultPreset.summary)

  const clear = await readSkyOutput(page)

  await presetsTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(customTab).toHaveAttribute('aria-selected', 'true')
  await expect(customTab).toHaveAttribute('tabindex', '0')
  await expect(customTab).toBeFocused()
  await expect(presetsPanel).toBeHidden()
  await expect(customPanel).toBeVisible()
  await expect(page.locator('.sliders')).toBeVisible()
  await expect(page.getByRole('slider')).toHaveCount(12)

  await page.keyboard.press('Home')
  await expect(presetsTab).toBeFocused()
  await page.keyboard.press('End')
  await expect(customTab).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(presetsTab).toBeFocused()
  await expect(presetsTab).toHaveAttribute('aria-selected', 'true')
  await expect(customTab).toHaveAttribute('tabindex', '-1')
  await expect(presetsPanel).toBeVisible()
  await expect(customPanel).toBeHidden()
  await expect(page.locator('.sliders')).toBeHidden()
  await expect(presetButton(page, defaultPreset)).toHaveAttribute('aria-pressed', 'true')

  await selectPresetAndVerifyProgress(page, lowOvercastPreset)
  const overcast = await readSkyOutput(page)
  console.log('Warsaw moonless weather fixture', { clear, overcast })

  // The regional fallback is calibrated to a 17.55 mag/arcsec² Warsaw-centre
  // anchor under this clear-air state. These intentionally broad limits allow
  // numerical refinement while rejecting rural or physically dark-city output.
  expect(clear.bortle).toBeGreaterThanOrEqual(8)
  expect(clear.bortle).toBeLessThanOrEqual(9)
  expect(clear.sqm).toBeGreaterThanOrEqual(16.8)
  expect(clear.sqm).toBeLessThanOrEqual(18.4)
  expect(clear.limitingMagnitude).toBeGreaterThanOrEqual(3.8)
  expect(clear.limitingMagnitude).toBeLessThanOrEqual(5.8)
  expect(clear.visibleStars).toBeGreaterThanOrEqual(100)
  expect(clear.visibleStars).toBeLessThanOrEqual(1_800)

  // This is a Warsaw-specific expectation, not a universal cloud rule: an
  // optically thick 0.8 km deck over a luminous city brightens the background
  // through upward-light return while extinguishing direct celestial light.
  expect(overcast.bortle).toBe(9)
  expect(overcast.sqm).toBeGreaterThanOrEqual(14)
  expect(overcast.sqm).toBeLessThanOrEqual(18)
  expect(overcast.sqm).toBeLessThan(clear.sqm)
  expect(overcast.limitingMagnitude).toBeGreaterThanOrEqual(0)
  expect(overcast.limitingMagnitude).toBeLessThanOrEqual(0.2)
  expect(overcast.visibleStars).toBeGreaterThanOrEqual(0)
  expect(overcast.visibleStars).toBeLessThanOrEqual(5)
})

type SkyOutput = {
  bortle: number
  sqm: number
  limitingMagnitude: number
  visibleStars: number
}

async function preparePage(page: Page) {
  await page.setViewportSize({ width: 640, height: 480 })
  await page.addInitScript(() => {
    // This suite tests worker output and controls rather than animation cadence.
    // Throttling the continuous WebGL render loop keeps SwiftShader from
    // starving UI and worker tasks on headless/CI machines.
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

async function readSkyOutput(page: Page): Promise<SkyOutput> {
  const summary = page.getByLabel('Sky visibility summary')
  const value = async (label: string) => summary.locator('.summary-metric')
    .filter({ hasText: label })
    .locator('strong')
    .innerText()
  return {
    bortle: numeric(await value('Bortle')),
    sqm: numeric(await value('Sky quality')),
    limitingMagnitude: numeric(await value('Naked-eye limit')),
    visibleStars: numeric(await value('Visible stars')),
  }
}

async function selectPresetAndVerifyProgress(page: Page, preset: WeatherPreset) {
  const progress = page.getByRole('progressbar', { name: 'Weather analysis progress' })
  await beginProgressRecording(page)
  await presetButton(page, preset).click()
  await expect.poll(() => sawIncompleteProgress(page), {
    message: `${preset.name} should trigger observable solver progress`,
    timeout: 10_000,
  }).toBe(true)
  await expect(progress).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuetext', 'Physical sky field ready', { timeout: 45_000 })
  await expect(progress).toHaveAttribute('aria-valuenow', '100')
  await expect(presetButton(page, preset)).toHaveAttribute('aria-pressed', 'true')
}

async function beginProgressRecording(page: Page) {
  await page.evaluate(() => {
    type ProgressWindow = Window & {
      __weatherProgress?: Array<{ value: number; stage: string }>
      __weatherProgressObserver?: MutationObserver
    }
    const progressWindow = window as ProgressWindow
    progressWindow.__weatherProgressObserver?.disconnect()
    progressWindow.__weatherProgress = []
    const progress = document.querySelector<HTMLElement>('[aria-label="Weather analysis progress"]')
    if (!progress) throw new Error('Visible weather progress bar is missing')
    const record = () => progressWindow.__weatherProgress!.push({
      value: Number(progress.getAttribute('aria-valuenow')),
      stage: progress.getAttribute('aria-valuetext') ?? '',
    })
    record()
    progressWindow.__weatherProgressObserver = new MutationObserver(record)
    progressWindow.__weatherProgressObserver.observe(progress, {
      attributes: true,
      attributeFilter: ['aria-valuenow', 'aria-valuetext'],
    })
  })
}

async function sawIncompleteProgress(page: Page) {
  return page.evaluate(() => {
    const samples = (window as Window & {
      __weatherProgress?: Array<{ value: number; stage: string }>
    }).__weatherProgress ?? []
    return samples.some(({ value, stage }) => value < 100 && stage !== 'Physical sky field ready')
  })
}

function presetButton(page: Page, preset: WeatherPreset) {
  return page.getByRole('button', { name: new RegExp(`^${escapeRegex(preset.name)}(?:\\s|$)`) })
}

function requiredPreset(id: string) {
  const preset = WEATHER_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(`Missing required weather preset ${id}`)
  return preset
}

function numeric(value: string) {
  const match = value.replaceAll(',', '').match(/[+-]?[0-9]+(?:\.[0-9]+)?/)
  if (!match) throw new Error(`Expected a numeric sky output, received ${value}`)
  return Number(match[0])
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

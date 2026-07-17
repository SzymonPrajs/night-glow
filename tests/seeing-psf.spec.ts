import { expect, test } from '@playwright/test'

test('uses one live seeing model for the star field and PSF preview', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('night-glow:sky-enhancement', '0'))
  await page.setViewportSize({ width: 1100, height: 760 })
  await page.goto('/')

  await page.locator('.side-drawer.right .drawer-tab').click()
  await page.getByRole('tab', { name: 'Custom' }).click()
  const previewCanvas = page.getByLabel(/Magnified Gaussian stellar point-spread function/)
  const initial = Number(await previewCanvas.getAttribute('data-psf-fwhm'))
  await page.getByLabel('Zenith seeing FWHM').fill('3.5')
  await expect.poll(async () => Number(await previewCanvas.getAttribute('data-psf-fwhm'))).toBeGreaterThan(initial * 2)
  await expect(page.locator('.psf-preview')).toContainText('Unit-integral PSF')
  await expect(page.locator('.psf-preview')).toContainText('Coherence τ₀')

  await page.getByRole('button', { name: 'Close Atmosphere' }).click()
  const sky = page.getByLabel('Interactive three-dimensional sky')
  await sky.focus()
  for (let index = 0; index < 24; index += 1) await page.keyboard.press('=')
  await expect(page.locator('.view-readout')).toContainText('′ field')
  expect(errors).toEqual([])
})

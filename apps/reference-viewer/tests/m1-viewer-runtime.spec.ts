import { expect, test } from '@playwright/test'

for (const route of ['/globe', '/observe']) {
  test(`${route} loads its canvas engine without browser errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('status')).toContainText('ready')
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(page.locator('body')).not.toHaveText('')
    await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('keeps the MapLibre payload out of a direct observer load', async ({ browser }) => {
  const measure = async (route: string) => {
    const page = await browser.newPage()
    let scriptBytes = 0
    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return
      scriptBytes += (await response.body()).byteLength
    })
    await page.goto(route, { waitUntil: 'networkidle' })
    await expect(page.getByRole('status')).toContainText('ready')
    await page.close()
    return scriptBytes
  }
  const globeScriptBytes = await measure('/globe')
  const observerScriptBytes = await measure('/observe')
  expect(globeScriptBytes - observerScriptBytes).toBeGreaterThan(500_000)
  console.log(JSON.stringify({ globeScriptBytes, observerScriptBytes }))
})

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'm1-viewer-runtime.spec.ts',
  outputDir: './output/playwright/runtime-results',
  timeout: 20_000,
  reporter: 'line',
  use: {
    baseURL: process.env.NIGHTGLOW_RUNTIME_URL ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm --prefix ../viewer/experiments/runtime run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/globe',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})

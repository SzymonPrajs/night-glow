import { defineConfig } from '@playwright/test'

// End-to-end smoke tests for the production Viewer against the fixture slice.
// The suite expects a production build (make web-build) and serves it via
// `next start`; the Makefile target `viewer-e2e-test` wires both steps.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3200',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3200',
    url: 'http://127.0.0.1:3200/globe',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

import { createHash } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

const defaultPlaywrightPort =
  43000 + (parseInt(createHash('sha1').update(process.cwd()).digest('hex').slice(0, 6), 16) % 10000)
const configuredPlaywrightPort = Number(process.env.PLAYWRIGHT_PORT ?? defaultPlaywrightPort)
const playwrightPort = Number.isFinite(configuredPlaywrightPort)
  ? configuredPlaywrightPort
  : defaultPlaywrightPort
const playwrightBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: playwrightBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // Default to an isolated per-worktree port so shared worktree environments do not
        // accidentally bind Playwright to a different checkout's Vite dev server.
        command: `npm run dev -- --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
        url: playwrightBaseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
        timeout: 120 * 1000,
      },
})

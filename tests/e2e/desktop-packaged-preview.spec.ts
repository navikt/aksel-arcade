import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'

test.describe('Desktop packaged preview', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('renders the default Arcade project preview from the packaged renderer protocol', async () => {
    let app: ElectronApplication | null = null
    const consoleMessages: string[] = []

    try {
      app = await electron.launch({
        args: ['desktop/main.cjs'],
        env: {
          ...process.env,
          AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
        },
      })

      const page = await app.firstWindow()
      page.on('console', (message) => {
        consoleMessages.push(`[${message.type()}] ${message.text()}`)
      })
      page.on('pageerror', (error) => {
        consoleMessages.push(`[pageerror] ${error.message}`)
      })
      page.on('requestfailed', (request) => {
        consoleMessages.push(
          `[requestfailed] ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`
        )
      })

      await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 10_000 })

      const iframe = page.frameLocator('[data-testid="preview-iframe"]')
      await expect(iframe.getByText('Welcome to Aksel Arcade!')).toBeVisible({ timeout: 10_000 })
    } finally {
      await app?.close()
    }

    expect(consoleMessages.join('\n')).not.toContain('Not allowed to load local resource')
  })
})

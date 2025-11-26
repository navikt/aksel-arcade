import { expect, test } from '@playwright/test'
import fs from 'node:fs'

const SHARED_PREVIEW_TEXT = 'Shared via E2E'
const SHARED_CODE = `export default function App() {
  return <div>${SHARED_PREVIEW_TEXT}</div>
}`
const SHARE_CHAR_LIMIT = 4000

const ensureArtifactDir = () => {
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true })
  }
}

test.describe('Share link flow', () => {
  test('communicates slow generation states before enabling copy', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AXEL_SHARE_DEBUG_CONFIG__ = {
        delayMs: 4000,
        apologyThresholdMs: 50,
      }
    })

    await page.goto('/')

    const shareButton = page.getByLabel('Share project')
    await shareButton.click()

    await expect(page.getByText(/Link is being generated/i)).toBeVisible()
    await expect(page.getByText(/This is taking longer than usual/i)).toBeVisible()

    const copyButton = page.getByRole('button', { name: /copy share link/i })
    await expect(copyButton).toBeEnabled({ timeout: 20000 })
  })

  test('hydrates a shared snapshot generated from the UI', async ({ page, browser }) => {
    await page.addInitScript(({ sharedCode }) => {
      window.__AXEL_SHARE_DEBUG_CONFIG__ = {
        delayMs: 0,
        apologyThresholdMs: 9000,
      }
      window.__COPIED_SHARE_URL__ = ''
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (text: string) => {
            window.__COPIED_SHARE_URL__ = text
            return Promise.resolve()
          },
        },
        configurable: true,
      })

      const now = new Date().toISOString()
      const project = {
        version: '1.0.0',
        id: self.crypto?.randomUUID ? self.crypto.randomUUID() : `share-${Math.random()}`,
        name: 'Shared via E2E',
        jsxCode: sharedCode,
        hooksCode: '',
        viewportSize: 'MD',
        panelLayout: 'editor-left',
        createdAt: now,
        lastModified: now,
      }
      localStorage.setItem('aksel-arcade:project', JSON.stringify(project))
    }, { sharedCode: SHARED_CODE })

    await page.goto('/')

    const shareButton = page.getByLabel('Share project')
    await shareButton.click()

    const copyButton = page.getByRole('button', { name: /copy share link/i })
    await expect(copyButton).toBeEnabled()
    await copyButton.click()

    const urlHandle = await page.waitForFunction(() => window.__COPIED_SHARE_URL__ || null)
    const shareUrl = await urlHandle.jsonValue<string>()
    expect(shareUrl).toMatch(/\?share=/)

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    await recipientPage.goto(shareUrl)

    await expect(recipientPage.getByText(/replace your current work/i)).toBeVisible()
    await recipientPage.getByRole('button', { name: /load shared project/i }).click()
    await expect(recipientPage).not.toHaveURL(/share=/)

    const previewFrame = recipientPage.frameLocator('[data-testid="preview-iframe"]')
    await expect(previewFrame.getByText(SHARED_PREVIEW_TEXT)).toBeVisible()

    await recipientContext.close()
  })

  test('records telemetry for share generation performance targets', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AXEL_SHARE_DEBUG_CONFIG__ = {
        delayMs: 2500,
      }
      window.__AKSEL_TELEMETRY_LOG__ = []
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve(),
        },
        configurable: true,
      })
    })

    await page.goto('/')

    const shareButton = page.getByLabel('Share project')
    await shareButton.click()

    const copyButton = page.getByRole('button', { name: /copy share link/i })
    await expect(copyButton).toBeEnabled()
    await copyButton.click()

    const generationHandle = await page.waitForFunction(() => {
      return window.__AKSEL_TELEMETRY_LOG__?.find?.(
        event => event.type === 'share_generation' && !event.reused
      ) ?? null
    })
    const generationEvent = await generationHandle.jsonValue<{
      bucket: string
      withinTarget: boolean
    }>()
    expect(generationEvent.withinTarget).toBeTruthy()
    expect(generationEvent.bucket).toBe('1-3s')

    const clipboardEvent = await page.evaluate(() => {
      return window.__AKSEL_TELEMETRY_LOG__?.find?.(event => event.type === 'share_clipboard') ?? null
    })
    expect(clipboardEvent?.outcome).toBe('success')
  })

  test('template share links stay below the 4,000 character limit', async ({ page }) => {
    await page.addInitScript(() => {
      window.__COPIED_SHARE_URL__ = ''
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (text: string) => {
            window.__COPIED_SHARE_URL__ = text
            return Promise.resolve()
          },
        },
        configurable: true,
      })
    })

    await page.goto('/')

    const captureShareLink = async (
      templateLabel: string,
      screenshotFile: string,
      expectWarning: boolean
    ) => {
      await page.getByTestId('project-controls-settings').click()
      await page.getByRole('menuitem', { name: templateLabel }).click()

      await page.evaluate(forceWarning => {
        window.__akselShareDebug = window.__akselShareDebug ?? {}
        if (forceWarning) {
          window.__akselShareDebug.forceWarningThresholdHit = true
        } else if (window.__akselShareDebug?.forceWarningThresholdHit) {
          delete window.__akselShareDebug.forceWarningThresholdHit
        }
      }, expectWarning)

      await page.getByLabel('Share project').click()

      const copyButton = page.getByRole('button', { name: /copy share link/i })
      // Summary template selects packed-deflate, which regularly needs ~9s locally, so keep
      // a 20s budget to avoid flaky CI runs while the packed snapshot finishes encoding.
      await expect(copyButton).toBeEnabled({ timeout: 20000 })

      const warningFlag = await page.evaluate(() => Boolean(window.__akselShareDebug?.warningThresholdHit))

      if (expectWarning) {
        expect(warningFlag).toBeTruthy()
        await expect(page.getByText(/Long link detected/i)).toBeVisible()
      } else {
        expect(warningFlag).toBeFalsy()
      }

      await page.evaluate(() => {
        window.__COPIED_SHARE_URL__ = ''
      })
      await copyButton.click()

      const urlHandle = await page.waitForFunction(() => window.__COPIED_SHARE_URL__ || null)
      const shareUrl = await urlHandle.jsonValue<string>()
      expect(shareUrl.length).toBeLessThanOrEqual(SHARE_CHAR_LIMIT)

      ensureArtifactDir()
      await page.screenshot({ path: `test-results/${screenshotFile}`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await page.evaluate(() => {
        if (window.__akselShareDebug?.forceWarningThresholdHit) {
          delete window.__akselShareDebug.forceWarningThresholdHit
        }
      })
      return shareUrl
    }

    await captureShareLink('Oppsummeringsside for søknadsdialoger', 'summary-share-popover.png', true)
    await captureShareLink('Hooks demo', 'hooks-share-popover.png', false)
  })
})

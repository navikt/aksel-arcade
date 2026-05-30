import { expect, test } from '@playwright/test'
import fs from 'node:fs'

import type { ShareGenerationTelemetryEvent } from '@/services/telemetry'

const SHARED_PREVIEW_TEXT = 'Shared via E2E'
const SENDER_PROJECT_NAME = 'Sender identity should stay local'
const SHARED_CODE = `export default function App() {
  return <div>${SHARED_PREVIEW_TEXT}</div>
}`
const WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy'
const SHARE_CHAR_LIMIT = 4000
const SHARE_WARNING_THRESHOLD = 3600
const WARNING_FILLER_REPEAT = 9

const buildWarningFillerBlock = (blockIndex: number) => {
  const lines = [`/* share size filler block start (${blockIndex}) */`]
  for (let lineIndex = 0; lineIndex < 96; lineIndex += 1) {
    const hash = ((lineIndex + 1) * 2654435761) >>> 0
    lines.push(`block-${blockIndex}-line-${lineIndex}: ${hash.toString(36)}-${lineIndex ** 3}`)
  }
  lines.push(`/* share size filler block end (${blockIndex}) */`)
  return lines.join('\n')
}

const ensureArtifactDir = () => {
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true })
  }
}

test.describe('Share link flow', () => {
  test('hydrates a shared snapshot generated from the UI', async ({ page, browser }) => {
    await page.addInitScript(
      ({ sharedCode, senderProjectName, format }) => {
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
          name: senderProjectName,
          jsxCode: sharedCode,
          hooksCode: '',
          viewportSize: 'MD',
          panelLayout: 'editor-left',
          createdAt: now,
          lastModified: now,
        }
        sessionStorage.setItem(
          'aksel-arcade:project',
          JSON.stringify({
            format,
            formatVersion: 1,
            project,
            preferences: {
              theme: 'dark',
              panelOrder: 'code-left',
            },
          })
        )
      },
      {
        sharedCode: SHARED_CODE,
        senderProjectName: SENDER_PROJECT_NAME,
        format: WORKING_COPY_FORMAT,
      }
    )

    await page.goto('/')

    const shareButton = page.getByLabel('Share project')
    await shareButton.click()

    const copyButton = page.getByRole('button', { name: /copy web share url/i })
    await expect(copyButton).toBeEnabled()
    await copyButton.click()

    const urlHandle = await page.waitForFunction<string | null>(
      () => window.__COPIED_SHARE_URL__ || null
    )
    const shareUrl = await urlHandle.jsonValue()
    if (!shareUrl) {
      throw new Error('Share URL was not captured')
    }
    expect(shareUrl).toMatch(/\?share=/)
    const shareToken = new URL(shareUrl).searchParams.get('share')
    expect(shareToken?.startsWith('3.')).toBe(true)

    const recipientContext = await browser.newContext()
    const recipientPage = await recipientContext.newPage()
    await recipientPage.goto(shareUrl)

    await expect(recipientPage.getByText(/replace only this Web Arcade working copy/i)).toBeVisible()
    await recipientPage.getByRole('button', { name: /load web share url/i }).click()
    await expect(recipientPage).not.toHaveURL(/share=/)

    const previewFrame = recipientPage.frameLocator('[data-testid="preview-iframe"]')
    await expect(previewFrame.getByText(SHARED_PREVIEW_TEXT)).toBeVisible()
    await expect(recipientPage.getByText('Untitled Project')).toBeVisible()
    await expect(recipientPage.getByText(SENDER_PROJECT_NAME)).toHaveCount(0)

    await recipientContext.close()
  })

  test('records telemetry for share generation performance targets', async ({ page }) => {
    await page.addInitScript(() => {
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

    const copyButton = page.getByRole('button', { name: /copy web share url/i })
    await expect(copyButton).toBeEnabled()
    await copyButton.click()

    const generationHandle = await page.waitForFunction<ShareGenerationTelemetryEvent | null>(() => {
      const event = window.__AKSEL_TELEMETRY_LOG__?.find?.(
        entry => entry.type === 'share_generation' && !entry.reused
      )
      return event && event.type === 'share_generation' ? event : null
    })
    const generationEvent = await generationHandle.jsonValue()
    if (!generationEvent) {
      throw new Error('Share generation telemetry not found')
    }
    expect(generationEvent.withinTarget).toBeTruthy()
    expect(['<1s', '1-3s']).toContain(generationEvent.bucket)

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
      const templateDialog = page.waitForEvent('dialog')
      await Promise.all([
        templateDialog.then(dialog => dialog.accept()),
        page.getByRole('menuitem', { name: templateLabel }).click(),
      ])

      if (expectWarning) {
        const editor = page.locator('.cm-content[contenteditable="true"]').first()
        await expect(editor).toContainText('FormSummary', { timeout: 10000 })
        await editor.click()

        const isMac = await page.evaluate(() => navigator.platform.includes('Mac'))
        const jumpShortcut = isMac ? 'Meta+ArrowDown' : 'Control+End'
        await page.keyboard.press(jumpShortcut).catch(async () => {
          await page.keyboard.press(isMac ? 'Meta+End' : 'Control+ArrowDown')
        })

        for (let i = 0; i < WARNING_FILLER_REPEAT; i += 1) {
          await page.keyboard.insertText(`\n${buildWarningFillerBlock(i)}`)
        }
      }

      await page.getByLabel('Share project').click()

      const copyButton = page.getByRole('button', { name: /copy web share url/i })
      // Summary template selects packed-deflate, which regularly needs ~9s locally, so keep
      // a 20s budget to avoid flaky CI runs while the packed snapshot finishes encoding.
      await expect(copyButton).toBeEnabled({ timeout: 20000 })

      const tag = page.locator('.share-popover__estimate-tag')
      await expect(tag).toBeVisible()
      const tagText = (await tag.textContent()) ?? ''
      const match = tagText.match(/(\d[\d\s.,]*)\s*\/\s*/) ?? undefined
      if (!match) {
        throw new Error(`Unable to parse share length text: "${tagText}"`)
      }
      const shareChars = Number(match[1].replace(/[^\d]/g, ''))

      if (expectWarning) {
        expect(shareChars).toBeGreaterThanOrEqual(SHARE_WARNING_THRESHOLD)
      } else {
        expect(shareChars).toBeLessThan(SHARE_WARNING_THRESHOLD)
      }

      await page.evaluate(() => {
        window.__COPIED_SHARE_URL__ = ''
      })
      await copyButton.click()

      const urlHandle = await page.waitForFunction<string | null>(
        () => window.__COPIED_SHARE_URL__ || null
      )
      const shareUrl = await urlHandle.jsonValue()
      if (!shareUrl) {
        throw new Error('Share URL was not captured')
      }
      expect(shareUrl.length).toBeLessThanOrEqual(SHARE_CHAR_LIMIT)

      ensureArtifactDir()
      await page.screenshot({ path: `test-results/${screenshotFile}`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      return shareUrl
    }

    await captureShareLink('Oppsummeringsside for søknadsdialoger', 'summary-share-popover.png', true)
    await captureShareLink('Hooks demo', 'hooks-share-popover.png', false)
  })
})

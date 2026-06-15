import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content').first()
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText(text)
}

async function expectPreviewSurfaceFlush(page: Page) {
  const geometry = await page.evaluate(() => {
    const previewSurface = document.querySelector<HTMLElement>('[data-name="Preview"]')
    const livePreview = document.querySelector<HTMLElement>('[data-testid="live-preview"]')

    if (!previewSurface || !livePreview) {
      throw new Error('Preview shell elements were not rendered.')
    }

    const previewSurfaceRect = previewSurface.getBoundingClientRect()
    const livePreviewRect = livePreview.getBoundingClientRect()
    const previewSurfaceStyles = getComputedStyle(previewSurface)

    return {
      padding: {
        top: previewSurfaceStyles.paddingTop,
        right: previewSurfaceStyles.paddingRight,
        bottom: previewSurfaceStyles.paddingBottom,
        left: previewSurfaceStyles.paddingLeft,
      },
      offsets: {
        top: livePreviewRect.top - previewSurfaceRect.top,
        right: previewSurfaceRect.right - livePreviewRect.right,
        bottom: previewSurfaceRect.bottom - livePreviewRect.bottom,
        left: livePreviewRect.left - previewSurfaceRect.left,
      },
    }
  })

  expect(geometry.padding).toEqual({
    top: '0px',
    right: '0px',
    bottom: '0px',
    left: '0px',
  })

  for (const offset of Object.values(geometry.offsets)) {
    expect(Math.abs(offset)).toBeLessThanOrEqual(1)
  }
}

test.describe('Desktop renderer protocol preview', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('renders the default Arcade project preview from the Desktop renderer protocol', async () => {
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

      const previewBackgrounds = await page.evaluate(() => {
        const defaultProbe = document.createElement('div')
        defaultProbe.style.background = 'var(--ax-bg-default)'
        const previewSurface = document.querySelector<HTMLElement>('[data-name="Preview"]')
        const livePreview = document.querySelector<HTMLElement>('[data-testid="live-preview"]')

        if (!previewSurface || !livePreview) {
          throw new Error('Preview shell elements were not rendered.')
        }

        previewSurface.append(defaultProbe)
        const expected = getComputedStyle(defaultProbe).backgroundColor
        defaultProbe.remove()

        return {
          expected,
          surface: getComputedStyle(previewSurface).backgroundColor,
          livePreview: getComputedStyle(livePreview).backgroundColor,
        }
      })
      expect(previewBackgrounds.surface).toBe(previewBackgrounds.expected)
      expect(previewBackgrounds.livePreview).toBe(previewBackgrounds.expected)

      const sandboxBackground = await iframe.locator('html').evaluate((html) => {
        const defaultProbe = document.createElement('div')
        defaultProbe.style.background = 'var(--ax-bg-default)'
        document.body.append(defaultProbe)
        const expected = getComputedStyle(defaultProbe).backgroundColor
        defaultProbe.remove()

        return {
          expected,
          html: getComputedStyle(html).backgroundColor,
        }
      })
      expect(sandboxBackground.html).toBe(sandboxBackground.expected)

      await expectPreviewSurfaceFlush(page)
      await page.getByRole('button', { name: 'Enter preview fullscreen' }).click()
      await expect(page.getByRole('button', { name: 'Exit preview fullscreen' })).toBeVisible()
      await expectPreviewSurfaceFlush(page)
      await page.getByRole('button', { name: 'Exit preview fullscreen' }).click()

      await replaceEditorText(page, '<Button size="')
      await page.keyboard.press('Control+Space')

      const autocomplete = page.locator('.cm-tooltip-autocomplete')
      await expect(autocomplete).toBeVisible({ timeout: 5000 })
      await expect(autocomplete).toContainText('medium')

      await page.keyboard.type('s', { delay: 20 })
      await expect(autocomplete).toContainText('small')
      await expect(autocomplete).not.toContainText('medium')
      await expect(autocomplete).not.toContainText('xsmall')
    } finally {
      await app?.close()
    }

    expect(consoleMessages.join('\n')).not.toContain('Not allowed to load local resource')
  })
})

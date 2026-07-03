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

async function expectResponsiveGridColumns(page: Page, expectedColumns: 1 | 2) {
  const positions = await page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('[data-testid^="responsive-cell-"]')
    .evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, top: rect.top }
      })
    )

  expect(positions).toHaveLength(2)

  if (expectedColumns === 1) {
    expect(positions[1]!.top).toBeGreaterThan(positions[0]!.top + 1)
    return
  }

  expect(Math.abs(positions[1]!.top - positions[0]!.top)).toBeLessThanOrEqual(1)
  expect(positions[1]!.left).toBeGreaterThan(positions[0]!.left + 1)
}

async function readPreviewViewportMetrics(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="preview-viewport-stage"]')
    const shell = document.querySelector<HTMLElement>('[data-testid="preview-viewport-shell"]')
    const iframe = document.querySelector<HTMLIFrameElement>('[data-testid="preview-iframe"]')

    if (!stage || !shell || !iframe) {
      throw new Error('Preview viewport elements were not rendered.')
    }

    return {
      stageWidth: Math.round(stage.getBoundingClientRect().width),
      shellWidth: Math.round(shell.getBoundingClientRect().width),
      iframeTransform: getComputedStyle(iframe).transform,
    }
  })
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
        const sunkenProbe = document.createElement('div')
        defaultProbe.style.background = 'var(--ax-bg-default)'
        sunkenProbe.style.background = 'var(--ax-bg-sunken)'
        const previewSurface = document.querySelector<HTMLElement>('[data-name="Preview"]')
        const livePreview = document.querySelector<HTMLElement>('[data-testid="live-preview"]')

        if (!previewSurface || !livePreview) {
          throw new Error('Preview shell elements were not rendered.')
        }

        previewSurface.append(defaultProbe)
        previewSurface.append(sunkenProbe)
        const expected = getComputedStyle(defaultProbe).backgroundColor
        const expectedSunken = getComputedStyle(sunkenProbe).backgroundColor
        defaultProbe.remove()
        sunkenProbe.remove()

        return {
          expected,
          expectedSunken,
          surface: getComputedStyle(previewSurface).backgroundColor,
          livePreview: getComputedStyle(livePreview).backgroundColor,
        }
      })
      expect(previewBackgrounds.surface).toBe(previewBackgrounds.expected)
      expect(previewBackgrounds.livePreview).toBe(previewBackgrounds.expectedSunken)

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

      await replaceEditorText(
        page,
        `export default function App() {
  return (
    <HGrid data-testid="responsive-grid" gap="space-0" columns={{ xs: 1, sm: 2 }}>
      <Box data-testid="responsive-cell-1" height="40px" background="accent-moderate" />
      <Box data-testid="responsive-cell-2" height="40px" background="accent-moderate" />
      <Box data-testid="responsive-cell-3" height="40px" background="accent-moderate" />
      <Box data-testid="responsive-cell-4" height="40px" background="accent-moderate" />
    </HGrid>
  )
}`
      )

      await expect(iframe.getByTestId('responsive-grid')).toBeVisible({ timeout: 10_000 })

      await page.getByLabel('Mobile Small (320px)').click()
      await expect
        .poll(async () => iframe.locator('body').evaluate(() => window.innerWidth))
        .toBe(320)
      await expectResponsiveGridColumns(page, 1)

      await page.getByLabel('Mobile Large (480px)').click()
      await expect
        .poll(async () => iframe.locator('body').evaluate(() => window.innerWidth))
        .toBe(480)
      await expectResponsiveGridColumns(page, 2)

      await page.getByLabel('Tablet Landscape (1024px)').click()
      const wideViewportMetrics = await readPreviewViewportMetrics(page)
      await expect
        .poll(async () => iframe.locator('body').evaluate(() => window.innerWidth))
        .toBe(wideViewportMetrics.stageWidth)
      expect(wideViewportMetrics.shellWidth).toBe(wideViewportMetrics.stageWidth)
      expect(wideViewportMetrics.iframeTransform).toBe('none')
    } finally {
      await app?.close()
    }

    expect(consoleMessages.join('\n')).not.toContain('Not allowed to load local resource')
  })
})

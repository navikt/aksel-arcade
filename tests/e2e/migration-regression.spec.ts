import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs/promises'

const STORAGE_KEY = 'aksel-arcade:project'
const WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy'
const NOW = '2026-05-25T00:00:00.000Z'
const PACKAGE_FORMAT = 'aksel-arcade/project-package'
const PACKAGE_FORMAT_VERSION = 2
const PACKAGE_EXTENSION = '.akselarcade'

const savedProject = {
  version: '1.0.0',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Saved migration regression',
  jsxCode: `export default function App() {
  return (
    <Box padding="space-16" background="raised" borderRadius="8">
      <VStack gap="space-8">
        <Heading size="large" level="1">Saved migration prototype</Heading>
        <Button variant="primary">Saved action</Button>
      </VStack>
    </Box>
  )
}`,
  hooksCode: '',
  viewportSize: 'MD',
  panelLayout: 'editor-left',
  createdAt: NOW,
  lastModified: NOW,
}

const importedPackage = {
  format: PACKAGE_FORMAT,
  formatVersion: PACKAGE_FORMAT_VERSION,
  project: {
    name: 'Imported migration regression',
    source: {
      jsx: `export default function App() {
  return (
    <Box padding="space-16" background="raised" borderRadius="8">
      <VStack gap="space-12">
        <Heading size="large" level="1">Imported migration prototype</Heading>
        <Button variant="primary">Imported action</Button>
      </VStack>
    </Box>
  )
}`,
      hooks: '',
    },
    preview: {
      viewport: 'MD',
    },
  },
}

function collectObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ])
}

async function waitForPreviewText(page: Page, text: string) {
  await expect(
    page.frameLocator('[data-testid="preview-iframe"]').getByText(text).first()
  ).toBeVisible({
    timeout: 15000,
  })
}

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

test.describe('Aksel v8 migration regression hardening', () => {
  test('loads saved prototypes and keeps preview theme and viewport semantics intact', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, project, format }) => {
        sessionStorage.setItem(
          key,
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
      { key: STORAGE_KEY, project: savedProject, format: WORKING_COPY_FORMAT }
    )

    await page.goto('/')
    await waitForPreviewText(page, 'Saved migration prototype')

    const previewFrame = page.frameLocator('[data-testid="preview-iframe"]')
    const themeState = await previewFrame.locator('#root').evaluate((root) => ({
      className: root.className,
      axBackground: getComputedStyle(root).getPropertyValue('--ax-bg-default'),
    }))

    expect(themeState.className).toContain('aksel-theme')
    expect(themeState.className).toContain('dark')
    expect(themeState.axBackground.trim()).not.toBe('')

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

    const sandboxBackground = await previewFrame.locator('html').evaluate((html) => {
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

    await page.getByTestId('project-controls-settings').click()
    await page.getByRole('menuitem', { name: /switch to light (theme|mode)/i }).click()

    await expect
      .poll(async () => previewFrame.locator('#root').evaluate((root) => root.className))
      .toContain('light')

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
    await expect(previewFrame.getByTestId('responsive-grid')).toBeVisible()

    await page.getByLabel('Mobile Small (320px)').click()
    await expect
      .poll(async () => previewFrame.locator('body').evaluate(() => window.innerWidth))
      .toBe(320)
    await expectResponsiveGridColumns(page, 1)

    await page.getByLabel('Mobile Large (480px)').click()
    await expect
      .poll(async () => previewFrame.locator('body').evaluate(() => window.innerWidth))
      .toBe(480)
    await expectResponsiveGridColumns(page, 2)

    await page.getByLabel('Tablet Landscape (1024px)').click()
    const wideViewportMetrics = await readPreviewViewportMetrics(page)
    await expect
      .poll(async () => previewFrame.locator('body').evaluate(() => window.innerWidth))
      .toBe(wideViewportMetrics.stageWidth)
    expect(wideViewportMetrics.shellWidth).toBe(wideViewportMetrics.stageWidth)
    expect(wideViewportMetrics.iframeTransform).toBe('none')
  })

  test('keeps palette, share, export, import, and inspect flows covered', async (
    { page },
    testInfo
  ) => {
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
      localStorage.clear()
      sessionStorage.clear()
    })
    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/')
    await waitForPreviewText(page, 'Welcome to Aksel Arcade!')

    await page.getByRole('button', { name: /^Add$/ }).click()
    await expect(page.getByTestId('component-palette')).toBeVisible()
    await page
      .getByTestId('component-palette')
      .getByRole('link', { name: /^Button\b/ })
      .first()
      .click()
    await expect(page.locator('.cm-content')).toContainText('<Button')

    await page.getByLabel('Share project').click()
    const copyButton = page.getByRole('button', { name: /copy web share url/i })
    await expect(copyButton).toBeEnabled({ timeout: 20000 })
    await copyButton.click()
    await expect
      .poll(() => page.evaluate(() => window.__COPIED_SHARE_URL__ ?? ''))
      .toContain('?share=')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Export$/ }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    if (!downloadPath) {
      throw new Error('Expected Playwright to provide an export download path')
    }
    const exportedText = await fs.readFile(downloadPath, 'utf-8')
    const exportedProjectPackage = JSON.parse(exportedText) as {
      format: string
      formatVersion: number
      project: {
        name: string
        source: { jsx: string; hooks: string }
        preview: { viewport: string }
      }
    }
    expect(exportedProjectPackage).toMatchObject({
      format: PACKAGE_FORMAT,
      formatVersion: PACKAGE_FORMAT_VERSION,
      project: {
        name: 'Untitled Project',
        source: {
          hooks: '',
        },
        preview: {
          viewport: 'MD',
        },
      },
    })
    expect(Object.keys(exportedProjectPackage).sort()).toEqual([
      'format',
      'formatVersion',
      'project',
    ])
    expect(Object.keys(exportedProjectPackage.project).sort()).toEqual([
      'name',
      'preview',
      'source',
    ])
    expect(Object.keys(exportedProjectPackage.project.source).sort()).toEqual(['hooks', 'jsx'])
    expect(Object.keys(exportedProjectPackage.project.preview)).toEqual(['viewport'])
    expect(collectObjectKeys(exportedProjectPackage).join(' ')).not.toMatch(
      /agent|session|credential|endpoint|permission|checkpoint|diagnostic|evidence|transport|meta|exportedAt|createdAt|lastModified|panelLayout/i
    )
    expect(exportedText).not.toContain('Aksel v8')
    expect(exportedText).not.toContain('@navikt/ds-react')
    expect(exportedText).not.toContain(savedProject.id)

    const importPath = testInfo.outputPath(`aksel-arcade-import${PACKAGE_EXTENSION}`)
    await fs.writeFile(importPath, JSON.stringify(importedPackage), 'utf-8')
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /^Import$/ }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(importPath)
    await waitForPreviewText(page, 'Imported migration prototype')

    const inspectToggle = page.getByRole('button', { name: 'Enable inspect mode' })
    await inspectToggle.click()
    await expect(page.getByRole('button', { name: 'Disable inspect mode' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.frameLocator('[data-testid="preview-iframe"]').getByRole('button').hover()
    await expect(page.getByTestId('inspection-popover')).toBeVisible({ timeout: 5000 })
  })

  test('renders migration-sensitive aliases and built-in examples without imports', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/')

    await replaceEditorText(
      page,
      `export default function App() {
  return <BoxNew padding="space-16" background="raised">Compatibility alias still renders</BoxNew>
}`
    )
    await waitForPreviewText(page, 'Compatibility alias still renders')
    await expect(page.locator('.error-overlay')).toHaveCount(0)

    await page.getByTestId('project-controls-settings').click()
    await page.getByRole('menuitem', { name: 'Oppsummeringsside for søknadsdialoger' }).click()
    await waitForPreviewText(page, 'Oppsummering')
    await expect(page.locator('.error-overlay')).toHaveCount(0)

    await page.getByTestId('project-controls-settings').click()
    await page.getByRole('menuitem', { name: 'Hooks demo' }).click()
    await waitForPreviewText(page, 'Aksel Arcade Demo')
    await expect(page.locator('.error-overlay')).toHaveCount(0)
  })
})

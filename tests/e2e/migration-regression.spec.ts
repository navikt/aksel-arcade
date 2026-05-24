import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs/promises'

const STORAGE_KEY = 'aksel-arcade:project'
const NOW = '2026-05-25T00:00:00.000Z'

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

const importedProject = {
  ...savedProject,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Imported migration regression',
  jsxCode: `export default function App() {
  return (
    <Box padding="space-16" background="raised" borderRadius="8">
      <VStack gap="space-12">
        <Heading size="large" level="1">Imported migration prototype</Heading>
        <Button variant="primary">Imported action</Button>
      </VStack>
    </Box>
  )
}`,
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

test.describe('Aksel v8 migration regression hardening', () => {
  test('loads saved prototypes and keeps preview theme and viewport semantics intact', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, project }) => {
        localStorage.setItem(key, JSON.stringify(project))
      },
      { key: STORAGE_KEY, project: savedProject }
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

    await page.getByTestId('project-controls-settings').click()
    await page.getByRole('menuitem', { name: /switch to light (theme|mode)/i }).click()

    await expect
      .poll(async () => previewFrame.locator('#root').evaluate((root) => root.className))
      .toContain('light')

    await page.getByLabel('Tablet Landscape (1024px)').click()
    await expect
      .poll(async () => previewFrame.locator('#root').evaluate((root) => root.style.maxWidth))
      .toBe('1024px')
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
    })
    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/')
    await waitForPreviewText(page, 'Welcome to Aksel Arcade!')

    await page.getByRole('button', { name: /^Add$/ }).click()
    await expect(page.getByTestId('component-palette')).toBeVisible()
    await page.getByRole('button', { name: /^Button\b/ }).first().click()
    await expect(page.locator('.cm-content')).toContainText('<Button')

    await page.getByLabel('Share project').click()
    const copyButton = page.getByRole('button', { name: /copy share link/i })
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
    const exportedProject = JSON.parse(await fs.readFile(downloadPath, 'utf-8')) as {
      meta?: { designSystem?: string; packageVersions?: Record<string, string> }
    }
    expect(exportedProject.meta?.designSystem).toBe('Aksel v8')
    expect(exportedProject.meta?.packageVersions?.['@navikt/ds-react']).toBe('8.11.0')

    const importPath = testInfo.outputPath('aksel-arcade-import.json')
    await fs.writeFile(importPath, JSON.stringify(importedProject), 'utf-8')
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
    await page.addInitScript(() => localStorage.clear())
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

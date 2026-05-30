import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import fs from 'node:fs/promises'

const STORAGE_KEY = 'aksel-arcade:project'
const WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy'
const PACKAGE_FORMAT = 'aksel-arcade/project-package'
const PACKAGE_FORMAT_VERSION = 2
const PACKAGE_EXTENSION = '.akselarcade'
const DEFAULT_PREVIEW_TEXT = 'Welcome to Aksel Arcade!'

const jsxFor = (label: string) => `export default function App() {
  return (
    <Box padding="space-16" background="raised" borderRadius="8">
      <Heading size="large" level="1">${label}</Heading>
    </Box>
  )
}`

async function openArcade(page: Page) {
  await page.goto('/')
  await page.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 })
}

function previewText(page: Page, text: string) {
  return page.frameLocator('[data-testid="preview-iframe"]').getByText(text)
}

async function waitForPreviewText(page: Page, text: string) {
  await expect(previewText(page, text).first()).toBeVisible({ timeout: 15000 })
}

async function expectNoPreviewText(page: Page, text: string) {
  await expect(previewText(page, text)).toHaveCount(0)
}

async function replaceEditorText(page: Page, text: string) {
  const editor = page.locator('.cm-content[contenteditable="true"]').first()
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.insertText(text)
}

async function waitForWorkingCopyStorage(page: Page, text: string) {
  await expect
    .poll(
      () => page.evaluate((key) => sessionStorage.getItem(key) ?? '', STORAGE_KEY),
      { timeout: 7000 }
    )
    .toContain(text)
}

async function editProject(page: Page, label: string) {
  await replaceEditorText(page, jsxFor(label))
  await waitForPreviewText(page, label)
  await waitForWorkingCopyStorage(page, label)
}

async function seedWorkingCopy(page: Page, label: string) {
  await page.addInitScript(
    ({ format, key, jsx, projectName }) => {
      const now = new Date().toISOString()
      sessionStorage.setItem(
        key,
        JSON.stringify({
          format,
          formatVersion: 1,
          project: {
            version: '1.0.0',
            id: crypto.randomUUID(),
            name: projectName,
            jsxCode: jsx,
            hooksCode: '',
            viewportSize: 'MD',
            panelLayout: 'editor-left',
            createdAt: now,
            lastModified: now,
          },
          preferences: {
            theme: 'dark',
            panelOrder: 'code-left',
          },
        })
      )
    },
    {
      format: WORKING_COPY_FORMAT,
      key: STORAGE_KEY,
      jsx: jsxFor(label),
      projectName: `${label} project`,
    }
  )
}

async function captureClipboardWrites(page: Page) {
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
}

async function openSeededPage(
  context: BrowserContext,
  label: string,
  options: { captureClipboard?: boolean } = {}
) {
  const page = await context.newPage()
  await seedWorkingCopy(page, label)
  if (options.captureClipboard) {
    await captureClipboardWrites(page)
  }
  await openArcade(page)
  await waitForPreviewText(page, label)
  return page
}

async function copyShareUrl(page: Page) {
  await page.getByLabel('Share project').click()

  const copyButton = page.getByRole('button', { name: /copy web share url/i })
  await expect(copyButton).toBeEnabled({ timeout: 20000 })
  await copyButton.click()

  const urlHandle = await page.waitForFunction<string | null>(
    () => window.__COPIED_SHARE_URL__ || null
  )
  const shareUrl = await urlHandle.jsonValue()
  if (!shareUrl) {
    throw new Error('Share URL was not captured')
  }
  return shareUrl
}

async function importPackage(page: Page, packagePath: string, label: string) {
  await fs.writeFile(
    packagePath,
    JSON.stringify({
      format: PACKAGE_FORMAT,
      formatVersion: PACKAGE_FORMAT_VERSION,
      project: {
        name: `${label} package`,
        source: {
          jsx: jsxFor(label),
          hooks: '',
        },
        preview: {
          viewport: 'MD',
        },
      },
    }),
    'utf-8'
  )

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /^Import$/ }).click()

  const confirmImport = page.getByRole('button', { name: 'Importer' })
  if (await confirmImport.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmImport.click()
  }

  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(packagePath)
}

test.describe('Web Arcade tab-scoped working copies', () => {
  test('keeps ordinary tabs independent while edits and reloads stay tab-scoped', async ({
    context,
  }) => {
    const firstTab = await context.newPage()
    const secondTab = await context.newPage()

    await openArcade(firstTab)
    await openArcade(secondTab)
    await waitForPreviewText(firstTab, DEFAULT_PREVIEW_TEXT)
    await waitForPreviewText(secondTab, DEFAULT_PREVIEW_TEXT)

    await editProject(firstTab, 'First tab edit')
    await waitForPreviewText(secondTab, DEFAULT_PREVIEW_TEXT)
    await expectNoPreviewText(secondTab, 'First tab edit')

    await editProject(secondTab, 'Second tab edit')
    await waitForPreviewText(firstTab, 'First tab edit')
    await expectNoPreviewText(firstTab, 'Second tab edit')

    await firstTab.reload()
    await waitForPreviewText(firstTab, 'First tab edit')
    await waitForPreviewText(secondTab, 'Second tab edit')
  })

  test('forks a duplicated tab and lets later edits diverge independently', async ({ page }) => {
    await openArcade(page)
    await editProject(page, 'Original before duplicate')

    const popupPromise = page.waitForEvent('popup')
    await page.evaluate(() => window.open(window.location.href, '_blank'))
    const duplicate = await popupPromise
    await duplicate.waitForSelector('[data-testid="preview-iframe"]', { timeout: 10000 })

    await waitForPreviewText(duplicate, 'Original before duplicate')

    await editProject(duplicate, 'Duplicate tab edit')
    await waitForPreviewText(page, 'Original before duplicate')
    await expectNoPreviewText(page, 'Duplicate tab edit')

    await editProject(page, 'Original tab edit')
    await waitForPreviewText(duplicate, 'Duplicate tab edit')
    await expectNoPreviewText(duplicate, 'Original tab edit')

    await page.reload()
    await duplicate.reload()
    await waitForPreviewText(page, 'Original tab edit')
    await waitForPreviewText(duplicate, 'Duplicate tab edit')
  })

  test('replaces only one tab through share, import, and reset flows', async ({
    context,
  }, testInfo) => {
    const shareSource = await openSeededPage(context, 'Shared replacement', {
      captureClipboard: true,
    })
    const targetTab = await openSeededPage(context, 'Target tab original')
    const otherTab = await openSeededPage(context, 'Other tab unchanged')

    const shareUrl = await copyShareUrl(shareSource)
    await targetTab.goto(shareUrl)
    await expect(targetTab.getByText(/replace only this Web Arcade working copy/i)).toBeVisible()
    await targetTab.getByRole('button', { name: /load web share url/i }).click()
    await expect(targetTab).not.toHaveURL(/share=/)
    await waitForPreviewText(targetTab, 'Shared replacement')
    await waitForPreviewText(otherTab, 'Other tab unchanged')
    await expectNoPreviewText(otherTab, 'Shared replacement')

    await importPackage(
      targetTab,
      testInfo.outputPath(`tab-scoped-import${PACKAGE_EXTENSION}`),
      'Imported replacement'
    )
    await waitForPreviewText(targetTab, 'Imported replacement')
    await waitForPreviewText(otherTab, 'Other tab unchanged')
    await expectNoPreviewText(otherTab, 'Imported replacement')

    targetTab.on('dialog', (dialog) => dialog.accept())
    await targetTab.getByTestId('project-controls-settings').click()
    await targetTab.getByRole('menuitem', { name: 'Reset editor' }).click()
    await waitForPreviewText(targetTab, DEFAULT_PREVIEW_TEXT)
    await expectNoPreviewText(targetTab, 'Imported replacement')
    await waitForPreviewText(otherTab, 'Other tab unchanged')
  })

  test('surfaces autosave failure feedback when tab-scoped persistence fails', async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      const originalSetItem = Storage.prototype.setItem
      Object.defineProperty(Storage.prototype, 'setItem', {
        configurable: true,
        value(this: Storage, storageKey: string, value: string) {
          if (this === window.sessionStorage && storageKey === key) {
            throw new Error('e2e sessionStorage denied')
          }
          return originalSetItem.call(this, storageKey, value)
        },
      })
    }, STORAGE_KEY)

    await openArcade(page)
    await replaceEditorText(page, jsxFor('Autosave failure remains visible'))
    await waitForPreviewText(page, 'Autosave failure remains visible')

    await expect(page.getByText('Autosave failed')).toBeVisible({ timeout: 7000 })
    await expect(
      page.getByText(/Save error: Storage error: e2e sessionStorage denied/)
    ).toBeVisible()
  })
})

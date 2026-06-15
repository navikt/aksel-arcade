import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import LZString from 'lz-string'
import {
  ARCADE_PROJECT_PACKAGE_FORMAT,
  ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
  createArcadeProjectPackage,
} from '@/services/storage'
import {
  createArcadePage,
  createArcadeSourceFile,
  createSinglePageProjectSource,
} from '@/services/projectSource'
import { createDefaultProject } from '@/utils/projectDefaults'

const STORAGE_KEY = 'aksel-arcade:project'
const WORKING_COPY_FORMAT = 'aksel-arcade/web-working-copy'
const SHARE_METADATA_SEGMENT = Buffer.from(JSON.stringify({ v: 1, s: 'lz-string-uri' })).toString(
  'base64url'
)

const seedClipboardCapture = async (page: Page) => {
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

const seedWorkingCopy = async (
  page: Page,
  options: {
    project?: ReturnType<typeof createDefaultProject>
    pagePanelOpen?: boolean
    multiPageEnabled?: boolean
    theme?: 'light' | 'dark'
  } = {}
) => {
  const project = options.project ?? createDefaultProject()
  await page.addInitScript(
    ({ storageKey, project, format, pagePanelOpen, multiPageEnabled, theme }) => {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          format,
          formatVersion: 1,
          project,
          preferences: {
            theme,
            panelOrder: 'code-left',
            pagePanelOpen,
            selectedEditTarget: 'page',
            previewFullscreen: false,
            multiPageEnabled,
          },
        })
      )
    },
    {
      storageKey: STORAGE_KEY,
      format: WORKING_COPY_FORMAT,
      project,
      pagePanelOpen: options.pagePanelOpen ?? false,
      multiPageEnabled: options.multiPageEnabled ?? false,
      theme: options.theme ?? 'dark',
    }
  )
}

const createPermanentPagesProject = () => {
  const project = createDefaultProject()
  project.name = 'Permanent pages regression'
  project.viewportSize = 'LG'
  project.source = {
    globalConfig: createArcadeSourceFile(
      'export const SharedChrome = () => <BodyShort>Shared chrome</BodyShort>',
      'export const useSharedChrome = () => "shared-chrome"'
    ),
    pages: [
      createArcadePage(
        'page01',
        'Overview',
        createArcadeSourceFile(
          'export default function App() { return <Heading>Overview page</Heading> }',
          'export const useOverviewPage = () => "overview"'
        )
      ),
      createArcadePage(
        'page02',
        'Details',
        createArcadeSourceFile(
          'export default function App() { return <Heading>Details start page</Heading> }',
          'export const useDetailsPage = () => "details"'
        )
      ),
    ],
    startPageId: 'page02',
    nextPageNumber: 3,
  }
  project.activePageId = 'page01'
  return project
}

const createLegacySinglePageProject = () => {
  const project = createDefaultProject()
  project.name = 'Legacy single-page share'
  project.source = createSinglePageProjectSource(
    'export default function App() { return <Heading>Legacy single-page share</Heading> }',
    'export const useLegacyShare = () => "legacy-share"'
  )
  return project
}

const createLegacySinglePagePackage = () => {
  const project = createDefaultProject()
  project.name = 'Legacy v2 package import'
  project.viewportSize = 'SM'
  project.source = createSinglePageProjectSource(
    'export default function App() { return <Heading>Legacy single-page package</Heading> }',
    'export const useLegacyPackage = () => "legacy-package"'
  )

  return {
    format: ARCADE_PROJECT_PACKAGE_FORMAT,
    formatVersion: 2,
    project: {
      name: project.name,
      source: {
        jsx: project.source.pages[0]?.source.jsx ?? '',
        hooks: project.source.pages[0]?.source.hooks ?? '',
      },
      preview: {
        viewport: project.viewportSize,
      },
    },
  }
}

const collectObjectKeys = (value: unknown): string[] => {
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

const waitForPreviewText = async (page: Page, text: string) => {
  await expect(
    page.frameLocator('[data-testid="preview-iframe"]').getByText(text).first()
  ).toBeVisible({
    timeout: 15_000,
  })
}

const captureShareUrl = async (page: Page): Promise<string> => {
  await page.getByLabel('Share project').click()
  const copyButton = page.getByRole('button', { name: /copy web share url/i })
  await expect(copyButton).toBeEnabled({ timeout: 20_000 })
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

  await page.keyboard.press('Escape')
  return shareUrl
}

const createLegacyMinimalShareToken = (
  project: ReturnType<typeof createLegacySinglePageProject>
) => {
  const serialized = JSON.stringify({
    source: {
      jsx: project.source.pages[0]?.source.jsx ?? '',
      hooks: project.source.pages[0]?.source.hooks ?? '',
    },
    preview: {
      viewport: project.viewportSize,
      theme: 'dark',
    },
  })
  const checksum = createHash('sha256').update(serialized).digest('base64url')
  const compressed = LZString.compressToEncodedURIComponent(serialized)
  return `3.${SHARE_METADATA_SEGMENT}.${checksum}.${compressed}`
}

const importProjectPackage = async (page: Page, filePath: string) => {
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /^import$/i }).click()
  await expect(page.getByRole('button', { name: 'Importer' })).toBeVisible()
  await page.getByRole('button', { name: 'Importer' }).click()
  const chooser = await fileChooserPromise
  await chooser.setFiles(filePath)
}

test.describe('Permanent pages regression', () => {
  test('keeps Settings and the Page panel aligned with permanent-page defaults', async ({
    page,
  }) => {
    await seedWorkingCopy(page, {
      project: createPermanentPagesProject(),
      pagePanelOpen: false,
      multiPageEnabled: false,
    })
    await page.goto('/')
    await waitForPreviewText(page, 'Overview page')

    const showPagesButton = page.getByRole('button', { name: /^show pages$/i })
    await expect(showPagesButton).toBeVisible()
    await expect(page.getByLabel('Config')).toHaveCount(0)

    const collapsedClasses = await showPagesButton.evaluate((element) => element.className)
    expect(collapsedClasses).not.toMatch(/warning|danger|error|stale/i)

    await page.getByTestId('project-controls-settings').click()
    await expect(page.getByText('Experiments')).toHaveCount(0)
    await expect(page.getByRole('menuitemcheckbox', { name: /multiple pages/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /multiple pages/i })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await showPagesButton.click()
    await expect(page.getByRole('button', { name: /^hide pages$/i })).toBeVisible()
    await expect(page.getByLabel('Config')).toBeVisible()
    await expect(page.getByRole('button', { name: /^overview/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^details/i })).toBeVisible()
  })

  test('keeps new full-project Web shares lossless while still loading legacy single-page shares', async ({
    page,
    browser,
  }) => {
    const senderProject = createPermanentPagesProject()
    await seedClipboardCapture(page)
    await seedWorkingCopy(page, { project: senderProject })
    await page.goto('/')
    await waitForPreviewText(page, 'Overview page')

    const shareUrl = await captureShareUrl(page)
    const shareToken = new URL(shareUrl).searchParams.get('share')
    if (!shareToken) {
      throw new Error('Expected a share token in the copied URL')
    }
    expect(shareToken.startsWith('5.')).toBe(true)

    const recipientContext = await browser.newContext()
    await recipientContext.addInitScript(
      ({ storageKey, format, project }) => {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            format,
            formatVersion: 1,
            project,
            preferences: {
              theme: 'light',
              panelOrder: 'preview-left',
              pagePanelOpen: true,
              selectedEditTarget: 'page',
              previewFullscreen: false,
            },
          })
        )
      },
      {
        storageKey: STORAGE_KEY,
        format: WORKING_COPY_FORMAT,
        project: createDefaultProject(),
      }
    )
    const recipientPage = await recipientContext.newPage()
    await recipientPage.goto(shareUrl)
    await recipientPage.getByRole('button', { name: /load web share url/i }).click()
    await expect(recipientPage).not.toHaveURL(/share=/)
    await waitForPreviewText(recipientPage, 'Details start page')
    await expect(recipientPage.getByText(senderProject.name)).toBeVisible()
    await expect(recipientPage.getByRole('button', { name: /^hide pages$/i })).toBeVisible()
    await expect(recipientPage.getByRole('button', { name: /^overview/i })).toBeVisible()
    await expect(recipientPage.getByRole('button', { name: /^details/i })).toBeVisible()

    await recipientPage.getByRole('button', { name: /^overview/i }).click()
    await waitForPreviewText(recipientPage, 'Overview page')
    await recipientContext.close()

    const legacyProject = createLegacySinglePageProject()
    const legacyToken = createLegacyMinimalShareToken(legacyProject)
    const legacyUrl = new URL(page.url())
    legacyUrl.search = ''
    legacyUrl.searchParams.set('share', legacyToken)

    const legacyRecipientPage = await browser.newPage()
    await legacyRecipientPage.goto(legacyUrl.toString())
    await legacyRecipientPage.getByRole('button', { name: /load web share url/i }).click()
    await waitForPreviewText(legacyRecipientPage, 'Legacy single-page share')
    await legacyRecipientPage.getByRole('button', { name: /^show pages$/i }).click()
    await expect(legacyRecipientPage.getByRole('button', { name: /^page 1/i })).toBeVisible()
    await expect(legacyRecipientPage.getByRole('button', { name: /^details/i })).toHaveCount(0)
    await legacyRecipientPage.close()
  })

  test('exports and imports full-source packages while keeping legacy package imports compatible', async ({
    page,
    browser,
  }, testInfo) => {
    const senderProject = createPermanentPagesProject()
    await seedWorkingCopy(page, { project: senderProject })
    await page.goto('/')
    await waitForPreviewText(page, 'Overview page')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Export$/i }).click()
    const download = await downloadPromise
    const exportPath = await download.path()
    if (!exportPath) {
      throw new Error('Expected Playwright to provide a downloaded package path')
    }

    const exportedText = await fs.readFile(exportPath, 'utf-8')
    const portableExportPath = testInfo.outputPath('portable-pages-export.akselarcade')
    await fs.writeFile(portableExportPath, exportedText, 'utf-8')
    const exportedPackage = JSON.parse(exportedText) as ReturnType<
      typeof createArcadeProjectPackage
    >

    expect(exportedPackage).toMatchObject({
      format: ARCADE_PROJECT_PACKAGE_FORMAT,
      formatVersion: ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
      project: {
        name: senderProject.name,
        source: senderProject.source,
        preview: {
          viewport: 'LG',
        },
      },
    })
    expect(Object.keys(exportedPackage).sort()).toEqual(['format', 'formatVersion', 'project'])
    expect(Object.keys(exportedPackage.project).sort()).toEqual(['name', 'preview', 'source'])
    expect(Object.keys(exportedPackage.project.source).sort()).toEqual([
      'globalConfig',
      'nextPageNumber',
      'pages',
      'startPageId',
    ])
    expect(collectObjectKeys(exportedPackage).join(' ')).not.toMatch(
      /activePageId|createdAt|lastModified|panelLayout|pagePanelOpen|previewFullscreen|agent|diagnostic/i
    )

    const importContext = await browser.newContext()
    await importContext.addInitScript(
      ({ storageKey, format, project }) => {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            format,
            formatVersion: 1,
            project,
            preferences: {
              theme: 'dark',
              panelOrder: 'code-left',
              pagePanelOpen: true,
              selectedEditTarget: 'page',
              previewFullscreen: false,
            },
          })
        )
      },
      {
        storageKey: STORAGE_KEY,
        format: WORKING_COPY_FORMAT,
        project: createDefaultProject(),
      }
    )
    const importPage = await importContext.newPage()
    await importPage.goto('/')
    await expect(importPage.getByRole('button', { name: /^hide pages$/i })).toBeVisible()
    await importProjectPackage(importPage, portableExportPath)
    await waitForPreviewText(importPage, 'Details start page')
    await expect(importPage.getByText(senderProject.name)).toBeVisible()
    await expect(importPage.getByRole('button', { name: /^show pages$/i })).toBeVisible()
    await expect(importPage.getByLabel('Config')).toHaveCount(0)
    await importPage.getByRole('button', { name: /^show pages$/i }).click()
    await expect(importPage.getByRole('button', { name: /^overview/i })).toBeVisible()
    await expect(importPage.getByRole('button', { name: /^details/i })).toBeVisible()
    await importContext.close()

    const legacyPackagePath = testInfo.outputPath('legacy-v2-package.akselarcade')
    await fs.writeFile(legacyPackagePath, JSON.stringify(createLegacySinglePagePackage()), 'utf-8')

    const legacyImportPage = await browser.newPage()
    await legacyImportPage.goto('/')
    await importProjectPackage(legacyImportPage, legacyPackagePath)
    await waitForPreviewText(legacyImportPage, 'Legacy single-page package')
    await legacyImportPage.getByRole('button', { name: /^show pages$/i }).click()
    await expect(legacyImportPage.getByRole('button', { name: /^page 1/i })).toBeVisible()
    await expect(legacyImportPage.getByRole('button', { name: /^details/i })).toHaveCount(0)
    await legacyImportPage.close()
  })
})

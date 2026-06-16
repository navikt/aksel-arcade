import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
}

const postMcpRequest = async (payload: Record<string, unknown>) => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  expect(response.status).toBe(200)
  return response.json()
}

const readMcpResource = async (uri: string) => {
  const payload = await postMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/read',
    params: {
      uri,
    },
  })

  return payload.result.contents[0]
}

const readJsonMcpResource = async (uri: string) =>
  JSON.parse((await readMcpResource(uri)).text as string)

const callApplyChanges = async (argumentsPayload: Record<string, unknown>) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'apply_changes',
      arguments: argumentsPayload,
    },
  })

const waitForDiagnosticsIdle = async (timeoutMs = 15_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const diagnostics = await readJsonMcpResource('arcade://project/diagnostics')
    if (diagnostics.status === 'idle') {
      return diagnostics
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error('Desktop MCP diagnostics did not settle to idle in time.')
}

test.describe('Desktop MCP apply_changes page lifecycle', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('creates, links, and activates a page through one temp-ref batch', async () => {
    test.setTimeout(120_000)

    const app: ElectronApplication = await electron.launch({
      args: ['desktop/main.cjs'],
      env: {
        ...process.env,
        AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
      },
    })

    try {
      const page = await app.firstWindow()
      await waitForDefaultPreview(page)

      const manifest = await readJsonMcpResource('arcade://project/manifest')
      const entryPage =
        manifest.pages.find((page: { id: string }) => page.id === manifest.activePageId) ??
        manifest.pages[0]
      const pageOneJsxUri = entryPage.source.jsx.uri

      const applyChangesPayload = await callApplyChanges({
        summary: 'Create a landing page and link the starter page to it',
        expectedProjectRevision: manifest.projectRevision,
        operations: [
          {
            type: 'create_page',
            newPageRef: 'landing',
            jsxCode:
              'export default function LandingPage() {\n  return <div><h1>Landing</h1><a href="{{pageRef:landing}}">Stay on landing</a></div>\n}',
          },
          {
            type: 'rename_page',
            tempPageRef: 'landing',
            name: 'Landing',
          },
          {
            type: 'replace_source',
            resourceUri: pageOneJsxUri,
            content:
              'export default function PageOne() {\n  return <a href="{{pageRef:landing}}">Open landing</a>\n}',
          },
          {
            type: 'set_start_page',
            tempPageRef: 'landing',
          },
          {
            type: 'select_active_page',
            tempPageRef: 'landing',
          },
        ],
      })

      expect(applyChangesPayload).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          structuredContent: {
            ok: true,
          },
        },
      })
      const landingPageId =
        applyChangesPayload.result.structuredContent.tempPageRefMappings.landing.pageId as string

      const pageTwoJsxUri =
        applyChangesPayload.result.structuredContent.tempPageRefMappings.landing.sourceResources
          .jsxResourceUri as string

      const updatedManifest = await readJsonMcpResource('arcade://project/manifest')
      expect(updatedManifest).toMatchObject({
        startPageId: landingPageId,
        activePageId: landingPageId,
      })
      expect(updatedManifest.pages).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: landingPageId, name: 'Landing' })])
      )

      const updatedPageOneSource = await readMcpResource(pageOneJsxUri)
      expect(updatedPageOneSource.text).toContain(`href="${landingPageId}"`)

      const updatedPageTwoSource = await readMcpResource(pageTwoJsxUri)
      expect(updatedPageTwoSource.text).toContain(`href="${landingPageId}"`)

      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', { name: 'Landing' })
      ).toBeVisible({ timeout: 15_000 })

      const diagnostics = await waitForDiagnosticsIdle()
      expect(diagnostics.status).toBe('idle')
    } finally {
      await app.close()
    }
  })
})

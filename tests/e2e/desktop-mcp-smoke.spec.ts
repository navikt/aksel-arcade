import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'

const stableResourceUris = [
  'arcade://desktop/operating-guide',
  'arcade://desktop/authoring-guide',
  'arcade://desktop/capabilities',
  'arcade://project/manifest',
  'arcade://project/preview-context',
  'arcade://project/diagnostics',
]

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.frameLocator('[data-testid="preview-iframe"]').getByText('Welcome to Aksel Arcade!')
  ).toBeVisible({ timeout: 15_000 })
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

const callTool = async (id: number, name: string, argumentsPayload: Record<string, unknown>) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: argumentsPayload,
    },
  })

const listTools = async () =>
  postMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  })

const listResources = async () =>
  postMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
  })

const readMcpResource = async (id: number, uri: string) => {
  const payload = await postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: {
      uri,
    },
  })

  expect(payload).toMatchObject({
    jsonrpc: '2.0',
    id,
    result: {
      contents: [
        {
          uri,
        },
      ],
    },
  })

  return payload.result.contents[0] as {
    uri: string
    mimeType: string
    text: string
  }
}

const readJsonMcpResource = async (id: number, uri: string) =>
  JSON.parse((await readMcpResource(id, uri)).text)

const waitForDiagnosticsIdle = async (timeoutMs = 15_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const diagnostics = await readJsonMcpResource(90, 'arcade://project/diagnostics')
    if (diagnostics.status === 'idle') {
      return diagnostics
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error('Desktop MCP diagnostics did not settle to idle in time.')
}

const expectToolSuccess = <T>(payload: {
  jsonrpc: '2.0'
  id: number
  result: { structuredContent: { ok: true; [key: string]: unknown } }
}) => {
  expect(payload).toMatchObject({
    result: {
      structuredContent: {
        ok: true,
      },
    },
  })

  return payload.result.structuredContent as T
}

test.describe('Desktop MCP v1 smoke flow', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('verifies the full Desktop MCP happy path without widening the v1 surface', async () => {
    test.setTimeout(180_000)

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

      const toolsPayload = await listTools()
      expect(toolsPayload.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
        'capture_preview_evidence',
        'apply_changes',
      ])

      const resourcesPayload = await listResources()
      expect(resourcesPayload.result.resources.map((resource: { uri: string }) => resource.uri)).toEqual(
        stableResourceUris
      )

      const operatingGuide = await readMcpResource(3, 'arcade://desktop/operating-guide')
      expect(operatingGuide.text).toContain('`resources/read`')
      expect(operatingGuide.text).toContain('`capture_preview_evidence({ pageId })`')
      expect(operatingGuide.text).not.toContain('read_resource')

      const authoringGuide = await readMcpResource(4, 'arcade://desktop/authoring-guide')
      expect(authoringGuide.text).toContain('`Global config`')
      expect(authoringGuide.text).toContain('`{{pageRef:name}}` placeholders')

      const capabilities = await readJsonMcpResource(5, 'arcade://desktop/capabilities')
      expect(capabilities).toMatchObject({
        serverName: 'desktop-arcade',
        endpoint: desktopMcpUrl,
        transport: 'HTTP (MCP Streamable HTTP)',
        requiresAuth: false,
        authDescription: 'No token/header required.',
      })
      expect(capabilities.toolNames).toEqual(['capture_preview_evidence', 'apply_changes'])
      expect(capabilities.stableResourceUris).toEqual(stableResourceUris)
      expect(capabilities.v1Omissions).toContain('No Web Arcade MCP endpoint.')

      const previewContextBefore = await readJsonMcpResource(6, 'arcade://project/preview-context')
      expect(previewContextBefore).toEqual({
        viewportSize: expect.any(String),
        theme: expect.any(String),
      })

      const diagnosticsBefore = await waitForDiagnosticsIdle()
      expect(diagnosticsBefore.issues).toEqual([])

      const manifestBefore = await readJsonMcpResource(7, 'arcade://project/manifest')
      expect(manifestBefore.pages).toHaveLength(1)
      expect(manifestBefore.activePageId).toBe('page01')
      const pageOneJsxUri = manifestBefore.pages[0].source.jsx.uri as string
      const pageOneHooksUri = manifestBefore.pages[0].source.hooks.uri as string

      const pageOneJsxBefore = await readMcpResource(8, pageOneJsxUri)
      expect(pageOneJsxBefore.text).toContain('Welcome to Aksel Arcade!')
      const pageOneHooksBefore = await readMcpResource(9, pageOneHooksUri)
      expect(pageOneHooksBefore.text).toContain('Define custom hooks here')

      const applyChanges = expectToolSuccess<{
        tempPageRefMappings: Record<
          string,
          {
            pageId: string
            sourceResources: {
              jsxResourceUri: string
              hooksResourceUri: string
            }
          }
        >
      }>(
        await callTool(10, 'apply_changes', {
          summary: 'Add a details page and link the visible page to it',
          expectedProjectRevision: manifestBefore.projectRevision,
          operations: [
            {
              type: 'create_page',
              newPageRef: 'details',
              jsxCode: `export default function DetailsPage() {
  return (
    <main>
      <h1>Details page</h1>
      <p>Smoke path ready</p>
    </main>
  )
}`,
            },
            {
              type: 'rename_page',
              tempPageRef: 'details',
              name: 'Details',
            },
            {
              type: 'replace_source',
              resourceUri: pageOneJsxUri,
              content: `export default function PageOne() {
  return (
    <main>
      <h1>Smoke entry</h1>
      <p>Desktop MCP updated the visible page.</p>
      <a href="{{pageRef:details}}">Open details page</a>
    </main>
  )
}`,
            },
          ],
        })
      )

      const newPage = applyChanges.tempPageRefMappings.details
      expect(newPage.pageId).toBe('page02')

      const diagnosticsAfterChange = await waitForDiagnosticsIdle()
      expect(diagnosticsAfterChange.issues).toEqual([])

      const manifestAfterChange = await readJsonMcpResource(11, 'arcade://project/manifest')
      expect(manifestAfterChange.startPageId).toBe('page01')
      expect(manifestAfterChange.activePageId).toBe('page01')
      expect(manifestAfterChange.pages).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'page02', name: 'Details' })])
      )

      const pageOneJsxAfter = await readMcpResource(12, pageOneJsxUri)
      expect(pageOneJsxAfter.text).toContain('href="page02"')
      const newPageJsx = await readMcpResource(13, newPage.sourceResources.jsxResourceUri)
      expect(newPageJsx.text).toContain('Smoke path ready')
      const newPageHooks = await readMcpResource(14, newPage.sourceResources.hooksResourceUri)
      expect(newPageHooks.text).toBe('')

      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', {
          name: 'Smoke entry',
        })
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByText(
          'Desktop MCP updated the visible page.'
        )
      ).toBeVisible({ timeout: 15_000 })

      const capture = expectToolSuccess<{
        page: { id: string; name: string }
        manifestResourceUri: string
        layerResources: {
          screenshot: string
          accessibility: string
          dom_layout_style: string
          frame: string
        }
      }>(await callTool(15, 'capture_preview_evidence', { pageId: newPage.pageId }))
      expect(capture.page).toEqual({ id: 'page02', name: 'Details' })

      const captureManifest = await readJsonMcpResource(16, capture.manifestResourceUri)
      const captureScreenshot = await readMcpResource(17, capture.layerResources.screenshot)
      const captureAccessibility = await readJsonMcpResource(18, capture.layerResources.accessibility)
      const captureDom = await readJsonMcpResource(19, capture.layerResources.dom_layout_style)
      const captureFrame = await readJsonMcpResource(20, capture.layerResources.frame)

      expect(captureManifest.layerResources).toMatchObject(capture.layerResources)
      expect(captureScreenshot.text).toContain('<svg')
      expect(JSON.stringify(captureAccessibility)).toContain('Details page')
      expect(JSON.stringify(captureDom)).toContain('Smoke path ready')
      expect(captureFrame.page).toEqual({ id: 'page02', name: 'Details' })

      const previewContextAfterCapture = await readJsonMcpResource(21, 'arcade://project/preview-context')
      expect(previewContextAfterCapture).toEqual(previewContextBefore)
      const manifestAfterCapture = await readJsonMcpResource(22, 'arcade://project/manifest')
      expect(manifestAfterCapture.activePageId).toBe('page01')
      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', {
          name: 'Smoke entry',
        })
      ).toBeVisible({ timeout: 15_000 })

      await page.getByTestId('project-controls-settings').click()
      await expect(page.getByText('Desktop Arcade MCP')).toBeVisible()
      await expect(page.getByText('Status: Available')).toBeVisible()
      await expect(page.getByText('Server name: desktop-arcade')).toBeVisible()
      await expect(page.getByText('Type: HTTP (MCP Streamable HTTP)')).toBeVisible()
      await expect(page.getByText('URL: http://127.0.0.1:3846/mcp')).toBeVisible()
      await expect(page.getByText('No token/header required.')).toBeVisible()
      const activityLine = page.getByText(/Last activity:/)
      await expect(activityLine).toContainText('capture_preview_evidence')
      await expect(activityLine).not.toContainText('Details page')
      await expect(activityLine).not.toContainText('Smoke path ready')
    } finally {
      await app.close()
    }
  })

  test('keeps the MCP feature out of Web Arcade', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByLabel('Share project')).toBeVisible()

    await page.getByTestId('project-controls-settings').click()
    await expect(page.getByText('Desktop Arcade MCP')).toHaveCount(0)

    const mcpEndpointResponse = await page.request.fetch('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      },
    })
    const mcpEndpointText = await mcpEndpointResponse.text()
    const mcpContentType = mcpEndpointResponse.headers()['content-type'] ?? ''
    const behavesLikeMcp =
      mcpEndpointResponse.status() === 200 &&
      mcpContentType.includes('application/json') &&
      mcpEndpointText.includes('"jsonrpc"')
    expect(behavesLikeMcp).toBe(false)
  })
})

import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'
const ACTIVITY_SENTINEL = 'TOPSECRET-SUMMARY-CHECK-456'
const ERROR_SENTINEL = 'TOPSECRET-PAYLOAD-CHECK-123'

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.frameLocator('[data-testid="preview-iframe"]').getByText('Welcome to Aksel Arcade!')
  ).toBeVisible({ timeout: 15_000 })
}

const postMcpRequest = async (
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
) => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })

  expect(response.status).toBe(200)
  return response.json()
}

const callMcpTool = async (id: number, name: string, argumentsPayload: Record<string, unknown>) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: argumentsPayload,
    },
  })

const readDesktopResource = async (id: number, uri: string) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: {
      uri,
    },
  })

const readJsonDesktopResource = async (id: number, uri: string) =>
  JSON.parse((await expectDesktopResourceRead(id, uri)).text)

const expectDesktopResourceRead = async (id: number, uri: string) => {
  const payload = await readDesktopResource(id, uri)
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

const createProcessOutputCollector = (app: ElectronApplication) => {
  const chunks: string[] = []
  const child = app.process()
  const handleChunk = (chunk: Buffer | string) => {
    chunks.push(chunk.toString())
  }

  child?.stdout?.on('data', handleChunk)
  child?.stderr?.on('data', handleChunk)

  return {
    read: () => chunks.join(''),
    dispose: () => {
      child?.stdout?.off('data', handleChunk)
      child?.stderr?.off('data', handleChunk)
    },
  }
}

test.describe('Issue #279 MCP hardening', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('verifies the Desktop MCP setup, activity redaction, error redaction, and closed-window behavior', async () => {
    test.setTimeout(180_000)

    const app: ElectronApplication = await electron.launch({
      args: ['desktop/main.cjs'],
      env: {
        ...process.env,
        AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
      },
    })
    const processOutput = createProcessOutputCollector(app)

    try {
      const page = await app.firstWindow()
      await waitForDefaultPreview(page)

      const toolsListPayload = await postMcpRequest({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/list',
      })
      expect(toolsListPayload.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
        'capture_preview_evidence',
        'apply_changes',
      ])

      const resourcesListPayload = await postMcpRequest({
        jsonrpc: '2.0',
        id: 12,
        method: 'resources/list',
      })
      expect(
        resourcesListPayload.result.resources.map((resource: { uri: string }) => resource.uri)
      ).toEqual(
        expect.arrayContaining([
          'arcade://desktop/operating-guide',
          'arcade://desktop/capabilities',
          'arcade://project/manifest',
        ])
      )

      const capabilities = await readJsonDesktopResource(13, 'arcade://desktop/capabilities')
      expect(capabilities.requiresAuth).toBe(false)
      expect(capabilities.authDescription).toBe('No token/header required.')

      await page.getByTestId('project-controls-settings').click()
      await expect(page.getByText('Desktop Arcade MCP')).toBeVisible()
      await expect(page.getByText('Server name: desktop-arcade')).toBeVisible()
      await expect(page.getByText('Type: HTTP (MCP Streamable HTTP)')).toBeVisible()
      await expect(page.getByText('URL: http://127.0.0.1:3846/mcp')).toBeVisible()
      await expect(page.getByText('No token/header required.')).toBeVisible()
      await expect(page.getByText('Last activity: No MCP activity yet.')).toBeVisible()
      await expect(page.getByTestId('agent-session-menu')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /connect an agent|koble til agent/i })).toHaveCount(0)
      await expect(page.getByText(/pairing handoff/i)).toHaveCount(0)

      const manifest = await readJsonDesktopResource(14, 'arcade://project/manifest')
      const applyChangesPayload = await callMcpTool(15, 'apply_changes', {
        summary: ACTIVITY_SENTINEL,
        expectedProjectRevision: manifest.projectRevision,
        operations: [
          {
            type: 'rename_project',
            name: 'Desktop MCP verification project',
          },
        ],
      })
      expect(applyChangesPayload).toMatchObject({
        jsonrpc: '2.0',
        id: 15,
        result: {
          structuredContent: {
            ok: true,
            safeActivity: {
              toolName: 'apply_changes',
              operationTypes: ['rename_project'],
            },
          },
        },
      })

      const activityLine = page.getByText(/Last activity:/)
      await expect(activityLine).toContainText('apply_changes (rename_project) at')
      await expect(activityLine).not.toContainText(ACTIVITY_SENTINEL)

      const captureErrorPayload = await callMcpTool(16, 'capture_preview_evidence', {
        pageId: 'page01',
        interactions: [
          {
            action: 'click',
            target: {
              text: ERROR_SENTINEL,
            },
          },
        ],
      })
      expect(captureErrorPayload).toMatchObject({
        jsonrpc: '2.0',
        id: 16,
        result: {
          isError: true,
          structuredContent: {
            code: 'invalid-capture-target',
            toolName: 'capture_preview_evidence',
          },
        },
      })
      const captureError = captureErrorPayload.result.structuredContent as Record<string, unknown>
      expect(String(captureError.message)).not.toContain(ERROR_SENTINEL)
      expect(JSON.stringify(captureError)).not.toContain(ERROR_SENTINEL)

      await page.waitForTimeout(250)
      expect(processOutput.read()).not.toContain(ERROR_SENTINEL)

      if (process.platform === 'darwin') {
        await page.close()
        await expect.poll(() => app.windows().length).toBe(0)

        const closedWindowResponse = await readDesktopResource(17, 'arcade://project/manifest')
        expect(closedWindowResponse).toMatchObject({
          jsonrpc: '2.0',
          id: 17,
          error: {
            code: -32002,
            message:
              'Desktop Arcade project resources are unavailable because no renderer window is available.',
            data: {
              code: 'project-unavailable',
              resourceUri: 'arcade://project/manifest',
            },
          },
        })

        await new Promise((resolve) => setTimeout(resolve, 250))
        expect(app.windows().length).toBe(0)
      }
    } finally {
      processOutput.dispose()
      await app.close()
    }
  })

  test('verifies the Web surface has no MCP or Agent UI or endpoint behavior', async ({
    page,
  }) => {
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
    await expect(page.getByLabel('Share project')).toBeVisible()
    await expect(page.getByTestId('agent-session-menu')).toHaveCount(0)

    await page.getByTestId('project-controls-settings').click()
    await expect(page.getByText('Desktop Arcade MCP')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /connect an agent|koble til agent/i })).toHaveCount(0)
    await page.keyboard.press('Escape')

    const runtimeGlobals = await page.evaluate(() => ({
      desktopPreload: Reflect.has(window, '__AKSEL_ARCADE_DESKTOP__'),
      legacyAgentBridge: Reflect.has(window, '__AKSEL_ARCADE_AGENT_BRIDGE__'),
    }))
    expect(runtimeGlobals).toEqual({
      desktopPreload: false,
      legacyAgentBridge: false,
    })

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

    await page.getByLabel('Share project').click()
    const copyShareUrlButton = page.getByRole('button', { name: /copy web share url/i })
    await expect(copyShareUrlButton).toBeEnabled()
    await copyShareUrlButton.click()

    const copiedShareUrlHandle = await page.waitForFunction<string | null>(
      () => window.__COPIED_SHARE_URL__ || null
    )
    const shareUrl = await copiedShareUrlHandle.jsonValue()
    if (!shareUrl) {
      throw new Error('Expected Web share URL to be captured from the clipboard stub.')
    }

    const shareToken = new URL(shareUrl).searchParams.get('share')
    if (!shareToken) {
      throw new Error('Expected Web share URL to contain a share token.')
    }
  })
})

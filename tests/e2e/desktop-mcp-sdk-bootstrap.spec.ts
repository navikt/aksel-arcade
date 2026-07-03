import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
}

const postJsonRpc = async (payload: Record<string, unknown>) => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(payload),
  })

  const bodyText = await response.text()
  return {
    response,
    payload: parseJsonOrSse(bodyText),
  }
}

const parseJsonOrSse = (bodyText: string) => {
  if (!bodyText.startsWith('event:')) {
    return JSON.parse(bodyText) as Record<string, unknown>
  }

  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))

  return JSON.parse(dataLines.join('\n')) as Record<string, unknown>
}

test.describe('Issue #344 Desktop MCP SDK bootstrap', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('starts the fixed local SDK endpoint and negotiates initialize through the official SDK', async () => {
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

      await page.getByTestId('project-controls-settings').click()
      await expect(page.getByText('Desktop Arcade MCP')).toBeVisible()
      await expect(page.getByText('Status: Available')).toBeVisible()
      await expect(page.getByText('Type: HTTP (MCP Streamable HTTP)')).toBeVisible()
      await expect(page.getByText('URL: http://127.0.0.1:3846/mcp')).toBeVisible()

      const initialize = await postJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'playwright',
            version: '1.0.0',
          },
        },
      })

      expect(initialize.response.status).toBe(200)
      expect(initialize.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          serverInfo: {
            name: 'aksel-arcade',
            version: '0.0.0',
          },
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              subscribe: false,
              listChanged: false,
            },
          },
          instructions: expect.stringContaining('Desktop Arcade is a live sandbox'),
        },
      })
      expect((initialize.payload as { result: { instructions: string } }).result.instructions).toContain(
        'arcade://desktop/start-here'
      )
      expect(
        (initialize.payload as { result: { protocolVersion: string } }).result.protocolVersion
      ).not.toBe('2024-11-05')
    } finally {
      await app.close()
    }

    await expect
      .poll(async () => {
        try {
          await fetch(desktopMcpUrl, { method: 'POST' })
          return 'reachable'
        } catch {
          return 'stopped'
        }
      })
      .toBe('stopped')
  })

  test('surfaces a clear unavailable state when the fixed MCP port is already occupied', async () => {
    test.setTimeout(180_000)

    const occupiedServer = await listenOnPort(3846)
    let app: ElectronApplication | null = null

    try {
      app = await electron.launch({
        args: ['desktop/main.cjs'],
        env: {
          ...process.env,
          AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
        },
      })

      const page = await app.firstWindow()
      await waitForDefaultPreview(page)

      await page.getByTestId('project-controls-settings').click()
      await expect(page.getByText('Desktop Arcade MCP')).toBeVisible()
      await expect(
        page.getByText('Status: Unavailable: Port 3846 on 127.0.0.1 is already in use.')
      ).toBeVisible()
      await expect(
        page.getByText('Connection details are available once Desktop Arcade owns the MCP endpoint.')
      ).toBeVisible()
    } finally {
      if (app) {
        await app.close()
      }
      await closeHttpServer(occupiedServer)
    }
  })
})

const listenOnPort = (port: number) =>
  new Promise<Server>((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.statusCode = 200
      response.end('occupied')
    })

    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

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

const readMcpResource = async (id: number, uri: string) => {
  const payload = await postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: { uri },
  })

  return payload.result.contents[0] as {
    uri: string
    mimeType: string
    text: string
  }
}

const readJsonMcpResource = async (id: number, uri: string) =>
  JSON.parse((await readMcpResource(id, uri)).text)

test.describe('Desktop MCP on-demand Aksel resources', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('surfaces self-teaching instructions and version-matched Aksel snippet resources', async () => {
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

      const initialize = await postMcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'e2e-client', version: '1.0.0' },
        },
      })
      expect(typeof initialize.result.instructions).toBe('string')
      expect(initialize.result.instructions).toContain('goToPage')
      expect(initialize.result.instructions).toContain('import-free')
      expect(initialize.result.instructions).toContain('arcade://desktop/authoring-guide')

      const catalog = await readJsonMcpResource(2, 'arcade://aksel/catalog')
      expect(typeof catalog.akselVersion).toBe('string')
      expect(catalog.akselVersion).not.toBe('unknown')
      expect(catalog.componentResourceUriTemplate).toBe('arcade://aksel/components/{name}')
      const buttonIndex = catalog.components.find(
        (component: { name: string }) => component.name === 'Button'
      )
      expect(buttonIndex).toMatchObject({
        name: 'Button',
        resourceUri: 'arcade://aksel/components/Button',
      })

      const component = await readJsonMcpResource(3, buttonIndex.resourceUri)
      expect(component.akselVersion).toBe(catalog.akselVersion)
      expect(component.component.name).toBe('Button')
      expect(component.component.snippet.jsx).not.toMatch(/\bimport\b/)
      expect(component.component.snippet.jsx).not.toContain('${')
      expect(component.component.snippet.jsx).not.toMatch(/\{\{[\w]+\}\}/)

      const operations = await readMcpResource(4, 'arcade://desktop/apply-changes-operations')
      expect(operations.mimeType).toBe('text/markdown')
      expect(operations.text).toContain('`create_page`')
      expect(operations.text).toContain('`replace_source`')
      expect(operations.text).toContain('earlier in the same batch')
    } finally {
      await app.close()
    }
  })
})

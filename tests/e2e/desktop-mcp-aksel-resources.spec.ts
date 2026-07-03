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
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(payload),
  })

  expect(response.status).toBe(200)
  return parseJsonOrSse(await response.text())
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

interface JsonRpcSuccessResult<T> {
  jsonrpc: '2.0'
  id: number
  result: T
}

interface ResourceReadResultPayload {
  contents: Array<{
    uri: string
    mimeType: string
    text: string
  }>
}

const readMcpResource = async (id: number, uri: string) => {
  const payload = (await postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: { uri },
  })) as unknown as JsonRpcSuccessResult<ResourceReadResultPayload>

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

      const initialize = (await postMcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'e2e-client', version: '1.0.0' },
        },
      })) as unknown as JsonRpcSuccessResult<{
        instructions: string
      }>
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
      expect(component.resolution).toMatchObject({
        kind: 'exact',
        matchedName: 'Button',
      })
      expect(component.component.snippet.jsx).not.toMatch(/\bimport\b/)
      expect(component.component.snippet.jsx).not.toContain('${')
      expect(component.component.snippet.jsx).not.toMatch(/\{\{[\w]+\}\}/)

      const alias = await readJsonMcpResource(4, 'arcade://aksel/components/RadioGroup')
      expect(alias.component.name).toBe('Radio')
      expect(alias.resolution).toMatchObject({
        kind: 'alias',
        requestedName: 'RadioGroup',
        matchedName: 'Radio',
      })

      const hiddenRoot = await readJsonMcpResource(5, 'arcade://aksel/components/Alert')
      expect(hiddenRoot.resolution).toMatchObject({
        kind: 'replacement',
        hiddenRootName: 'Alert',
        reason: 'deprecated',
      })
      expect(hiddenRoot.resolution.replacements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'InfoCard' }),
          expect.objectContaining({ name: 'InlineMessage' }),
          expect.objectContaining({ name: 'LocalAlert' }),
          expect.objectContaining({ name: 'GlobalAlert' }),
        ])
      )
      expect(hiddenRoot.resolution.migrationRules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            when: 'Alert with fullWidth',
            target: expect.objectContaining({ name: 'GlobalAlert' }),
          }),
          expect.objectContaining({
            when: 'Alert variant="info"',
            target: expect.objectContaining({ name: 'InfoCard' }),
          }),
        ])
      )

      const hiddenDescendant = await readJsonMcpResource(6, 'arcade://aksel/components/Dropdown.Menu')
      expect(hiddenDescendant.resolution).toMatchObject({
        kind: 'replacement',
        requestedName: 'Dropdown.Menu',
        hiddenRootName: 'Dropdown',
        reason: 'replaced',
      })
      expect(hiddenDescendant.resolution.replacements).toEqual([
        expect.objectContaining({ name: 'ActionMenu' }),
      ])

      const suggestions = await readJsonMcpResource(7, 'arcade://aksel/components/Buton')
      expect(suggestions.resolution).toMatchObject({
        kind: 'did-you-mean',
        requestedName: 'Buton',
      })
      expect(suggestions.resolution.suggestions).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Button' })])
      )

      const authoringGuide = await readMcpResource(8, 'arcade://desktop/authoring-guide')
      expect(authoringGuide.text).toContain(
        '## Getting Aksel component usage (on demand — fetch only the components you need)'
      )
      expect(authoringGuide.text).toContain('`arcade://aksel/catalog`')
      expect(authoringGuide.text).toContain('`Alert` is deprecated')

      const operations = await readMcpResource(9, 'arcade://desktop/apply-changes-operations')
      expect(operations.mimeType).toBe('text/markdown')
      expect(operations.text).toContain('`create_page`')
      expect(operations.text).toContain('`replace_source`')
      expect(operations.text).toContain('Target the page with either `pageId` or `tempPageRef`.')
      expect(operations.text).toContain('Final-state assertions')
    } finally {
      await app.close()
    }
  })
})

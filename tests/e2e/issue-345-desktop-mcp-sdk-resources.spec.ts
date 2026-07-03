import { execFileSync } from 'node:child_process'
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

const readResource = async (id: number, uri: string) => {
  const result = await postJsonRpc({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: { uri },
  })

  expect(result.response.status).toBe(200)
  return result
}

const normalizeEditorText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.length > 0 || lines[index - 1] !== '')
    .join('\n')
    .trim()

test.describe('Issue #345 Desktop MCP SDK resources', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('exposes the SDK resource surface for the active Desktop Arcade project', async () => {
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
      await expect(page.getByText('URL: http://127.0.0.1:3846/mcp')).toBeVisible()

      const resourcesList = await postJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
      })
      expect(resourcesList.response.status).toBe(200)
      const listedResourceUris = (
        resourcesList.payload as {
          result: { resources: Array<{ uri: string }> }
        }
      ).result.resources.map((resource) => resource.uri)
      expect(listedResourceUris).toEqual(
        expect.arrayContaining([
          'arcade://desktop/start-here',
          'arcade://desktop/capabilities',
          'arcade://project/manifest',
        ])
      )

      const resourceTemplates = await postJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/templates/list',
      })
      expect(resourceTemplates.response.status).toBe(200)
      expect(
        (
          resourceTemplates.payload as {
            result: { resourceTemplates: Array<{ uriTemplate: string }> }
          }
        ).result.resourceTemplates.map((template) => template.uriTemplate)
      ).toEqual(
        expect.arrayContaining([
          'arcade://project/source/pages/{pageId}/jsx',
          'arcade://project/pages/{pageId}/annotations',
          'arcade://aksel/components/{name}',
        ])
      )

      const startHere = await readResource(3, 'arcade://desktop/start-here')
      expect(
        (
          startHere.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      ).toContain('# Desktop Arcade MCP start-here')

      const capabilities = await readResource(4, 'arcade://desktop/capabilities')
      const capabilitiesJson = JSON.parse(
        (
          capabilities.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      ) as {
        endpoint: string
        omittedFeatures: string[]
        resourceTemplateUris: string[]
      }
      expect(capabilitiesJson.endpoint).toBe(desktopMcpUrl)
      expect(capabilitiesJson.omittedFeatures).toEqual(
        expect.arrayContaining([
          'No prompts surface.',
          'No resource subscriptions.',
          'No list-changed notifications.',
        ])
      )
      expect(capabilitiesJson.resourceTemplateUris).toEqual(
        expect.arrayContaining(['arcade://project/source/pages/{pageId}/jsx'])
      )

      const manifestRead = await readResource(5, 'arcade://project/manifest')
      const manifest = JSON.parse(
        (
          manifestRead.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      ) as {
        activePageId: string
        pages: Array<{ id: string; source: { jsx: { uri: string } } }>
      }
      const activePage = manifest.pages.find((pageEntry) => pageEntry.id === manifest.activePageId)
      expect(activePage).toBeTruthy()

      const editorText = normalizeEditorText(await page.locator('.cm-content').first().innerText())
      const activeSourceRead = await readResource(6, activePage!.source.jsx.uri)
      const activeSourceText = normalizeEditorText(
        (
          activeSourceRead.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      )
      expect(activeSourceText).toBe(editorText)

      const invalidResource = await readResource(7, 'arcade://desktop/not-a-resource')
      expect(invalidResource.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        error: {
          code: -32602,
        },
      })
      expect(
        (
          invalidResource.payload as {
            error: { message: string }
          }
        ).error.message
      ).toContain('arcade://desktop/not-a-resource')
    } finally {
      await app.close()
    }
  })
})

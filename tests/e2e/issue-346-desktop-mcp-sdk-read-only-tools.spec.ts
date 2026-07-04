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

test.describe('Issue #346 Desktop MCP SDK read-only tools', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('exposes the SDK read-only tool surface against the live Desktop Arcade project', async () => {
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

      const toolsList = await postJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      })
      expect(toolsList.response.status).toBe(200)
      expect(
        (
          toolsList.payload as {
            result: { tools: Array<{ name: string }> }
          }
        ).result.tools.map((tool) => tool.name)
      ).toEqual(
        expect.arrayContaining([
          'read_resource',
          'read_source',
          'list_annotations',
          'watch_annotations',
          'capture_preview_evidence',
        ])
      )

      const readStartHere = await postJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'read_resource',
          arguments: {
            uri: 'arcade://desktop/start-here',
          },
        },
      })
      expect(readStartHere.response.status).toBe(200)
      expect(readStartHere.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          structuredContent: {
            ok: true,
            uri: 'arcade://desktop/start-here',
            mimeType: 'text/markdown',
            text: expect.stringContaining('# Desktop Arcade MCP start-here'),
          },
        },
      })

      const manifestResult = await postJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: {
          uri: 'arcade://project/manifest',
        },
      })
      expect(manifestResult.response.status).toBe(200)
      const manifest = JSON.parse(
        (
          manifestResult.payload as {
            result: { contents: Array<{ text: string }> }
          }
        ).result.contents[0].text
      ) as {
        activePageId: string
      }

      const listAnnotations = await postJsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'list_annotations',
          arguments: {},
        },
      })
      expect(listAnnotations.response.status).toBe(200)
      expect(listAnnotations.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: {
          structuredContent: {
            ok: true,
            scope: 'page',
            status: 'open',
            resourceUri: `arcade://project/pages/${manifest.activePageId}/annotations`,
            annotations: expect.any(Array),
          },
        },
      })

      const listProjectAnnotations = await postJsonRpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_annotations',
          arguments: {
            scope: 'project',
            status: 'all',
          },
        },
      })
      expect(listProjectAnnotations.response.status).toBe(200)
      expect(listProjectAnnotations.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        result: {
          structuredContent: {
            ok: true,
            scope: 'project',
            status: 'all',
            resourceUri: 'arcade://project/annotations',
            annotations: expect.any(Array),
          },
        },
      })

      const watchAnnotations = await postJsonRpc({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'watch_annotations',
          arguments: {
            waitTimeoutSeconds: 1,
            batchWindowSeconds: 1,
          },
        },
      })
      expect(watchAnnotations.response.status).toBe(200)
      expect(watchAnnotations.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 6,
        result: {
          structuredContent: {
            ok: true,
            status: 'pending',
            timedOut: expect.any(Boolean),
            annotations: expect.any(Array),
          },
        },
      })

      const capturePreview = await postJsonRpc({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'capture_preview_evidence',
          arguments: {
            pageId: manifest.activePageId,
          },
        },
      })
      expect(capturePreview.response.status).toBe(200)
      expect(capturePreview.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        result: {
          structuredContent: {
            ok: true,
            manifestResourceUri: expect.stringContaining('arcade://preview/captures/'),
            producedResources: expect.any(Array),
          },
        },
      })

      const captureManifestUri = (
        capturePreview.payload as {
          result: { structuredContent: { manifestResourceUri: string } }
        }
      ).result.structuredContent.manifestResourceUri

      const captureManifest = await postJsonRpc({
        jsonrpc: '2.0',
        id: 8,
        method: 'resources/read',
        params: {
          uri: captureManifestUri,
        },
      })
      expect(captureManifest.response.status).toBe(200)
      expect(captureManifest.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 8,
        result: {
          contents: [
            {
              uri: captureManifestUri,
            },
          ],
        },
      })

      const invalidArguments = await postJsonRpc({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'capture_preview_evidence',
          arguments: {
            interactions: [
              {
                action: 'waitFor',
                text: 'Loaded',
                renderIdle: true,
              },
            ],
          },
        },
      })
      expect(invalidArguments.response.status).toBe(200)
      expect(invalidArguments.payload).toMatchObject({
        jsonrpc: '2.0',
        id: 9,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: expect.stringContaining(
                'capture_preview_evidence interactions[0] waitFor steps require exactly one of text, target, or renderIdle.'
              ),
            },
          ],
        },
      })
    } finally {
      await app.close()
    }
  })
})

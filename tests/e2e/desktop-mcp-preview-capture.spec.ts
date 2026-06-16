import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
  await expect(
    page.frameLocator('[data-testid="preview-iframe"]').getByText('Welcome to Aksel Arcade!')
  ).toBeVisible({ timeout: 15_000 })
}

const readMcpResource = async (uri: string) => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'read_resource',
        arguments: {
          uri,
        },
      },
    }),
  })

  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload).toMatchObject({
    jsonrpc: '2.0',
    id: 2,
    result: {
      structuredContent: {
        ok: true,
        uri,
      },
    },
  })

  return payload.result.structuredContent
}

const captureDefaultPreviewEvidence = async () => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {},
      },
    }),
  })

  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: {
      structuredContent: {
        ok: true,
      },
    },
  })

  const capture = payload.result.structuredContent
  const frameResourceResponse = await readMcpResource(capture.layerResources.frame)
  const frameResourceText = frameResourceResponse.text
  const frameResource = JSON.parse(frameResourceText)
  expect(frameResource.preview.viewport.width).toBeGreaterThan(0)
  expect(frameResource.preview.viewport.height).toBeGreaterThan(0)

  const screenshotResourceResponse = await readMcpResource(capture.layerResources.screenshot)
  const screenshotSvg = screenshotResourceResponse.text as string
  const screenshotMatch = screenshotSvg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/)
  expect(screenshotMatch).not.toBeNull()
  expect(Number(screenshotMatch?.[1])).toBeGreaterThan(1)
  expect(Number(screenshotMatch?.[2])).toBeGreaterThan(1)

  const accessibilityResourceResponse = await readMcpResource(capture.layerResources.accessibility)
  const accessibilityResource = JSON.parse(accessibilityResourceResponse.text)
  expect(accessibilityResource.rootSelector).toBe('#root')
  expect(accessibilityResource.nodeCount).toBeGreaterThan(0)
  expect(Array.isArray(accessibilityResource.nodes)).toBe(true)

  const domLayoutStyleResponse = await readMcpResource(capture.layerResources.dom_layout_style)
  const domLayoutStyleResource = JSON.parse(domLayoutStyleResponse.text)
  expect(domLayoutStyleResource.rootSelector).toBe('#root')
  expect(domLayoutStyleResource.capturedElementCount).toBeGreaterThan(0)
  expect(domLayoutStyleResource.tree.tagName).toBe('div')
}

test.describe('Desktop MCP preview capture', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('serves repeated default capture_preview_evidence calls without timeouts or zero-sized output', async () => {
    test.setTimeout(120_000)

    for (let launch = 0; launch < 3; launch += 1) {
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
        await captureDefaultPreviewEvidence()
        await captureDefaultPreviewEvidence()
      } finally {
        await app.close()
      }
    }
  })
})

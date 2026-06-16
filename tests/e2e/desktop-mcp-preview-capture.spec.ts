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

const callTool = async (name: string, argumentsPayload: Record<string, unknown>) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name,
      arguments: argumentsPayload,
    },
  })

const readMcpResource = async (uri: string) => {
  const payload = await postMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/read',
    params: {
      uri,
    },
  })
  expect(payload).toMatchObject({
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

const readJsonMcpResource = async (uri: string) => JSON.parse((await readMcpResource(uri)).text)

const callApplyChanges = async (argumentsPayload: Record<string, unknown>) =>
  callTool('apply_changes', argumentsPayload)

const callCapturePreviewEvidence = async (argumentsPayload: Record<string, unknown>) =>
  callTool('capture_preview_evidence', argumentsPayload)

type ToolCallSuccessPayload = {
  jsonrpc: '2.0'
  id: number
  result: {
    structuredContent: {
      ok: true
      [key: string]: unknown
    }
  }
}

type ToolCallFailurePayload = {
  jsonrpc: '2.0'
  id: number
  result: {
    isError: true
    structuredContent: {
      code: string
      toolName: string
      message: string
      manifestResourceUri?: string
      [key: string]: unknown
    }
  }
}

const expectToolSuccess = <T>(payload: ToolCallSuccessPayload): T => {
  expect(payload).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: {
      structuredContent: {
        ok: true,
      },
    },
  })

  return payload.result.structuredContent as T
}

const expectToolFailure = (payload: ToolCallFailurePayload) => {
  expect(payload).toMatchObject({
    jsonrpc: '2.0',
    id: 1,
    result: {
      isError: true,
      structuredContent: {
        toolName: 'capture_preview_evidence',
      },
    },
  })

  return payload.result.structuredContent
}

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

const loadInteractionDemoProject = async () => {
  const manifest = await readJsonMcpResource('arcade://project/manifest')
  const pageOneJsxUri = manifest.pages[0].source.jsx.uri as string
  const pageOneHooksUri = manifest.pages[0].source.hooks.uri as string

  const applyChangesPayload = await callApplyChanges({
    summary: 'Load an interactive MCP Preview capture demo',
    expectedProjectRevision: manifest.projectRevision,
    operations: [
      {
        type: 'create_page',
        newPageRef: 'details',
        jsxCode: `export default function DetailsPage() {
  return (
    <main>
      <h1>Details page</h1>
      <button aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        Toggle menu
      </button>
      {menuOpen ? (
        <div role="menu">
          <button>Menu action</button>
        </div>
      ) : null}
      <a href="https://example.com">External docs</a>
    </main>
  )
}`,
        hooksCode: `const [menuOpen, setMenuOpen] = useState(false)`,
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
      <h1>Interaction demo</h1>

      <button
        aria-expanded={accordionOpen}
        aria-controls="demo-panel"
        onClick={() => setAccordionOpen((open) => !open)}
      >
        Toggle details
      </button>
      {accordionOpen ? (
        <section id="demo-panel">
          <h2>Expanded details</h2>
          <p>Accordion content ready</p>
        </section>
      ) : null}

      <label htmlFor="full-name">Full name</label>
      <input
        id="full-name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <p>Typed value: {fullName || 'empty'}</p>

      <label htmlFor="planet">Planet</label>
      <select
        id="planet"
        value={planet}
        onChange={(event) => setPlanet(event.target.value)}
      >
        <option value="earth">earth</option>
        <option value="mars">mars</option>
      </select>
      <p>Selected planet: {planet}</p>

      <button onClick={() => setKeyStatus('confirmed')}>Confirm via key</button>
      <p>Key status: {keyStatus}</p>

      <button
        onClick={() => {
          setStatus('Loading…')
          window.setTimeout(() => setStatus('Loaded'), 150)
        }}
      >
        Load async state
      </button>
      <p>{status}</p>

      <a href="{{pageRef:details}}">Open details page</a>
      <div style={{ height: 1200 }} />
    </main>
  )
}`,
      },
      {
        type: 'replace_source',
        resourceUri: pageOneHooksUri,
        content: `const [accordionOpen, setAccordionOpen] = useState(false)
const [fullName, setFullName] = useState('')
const [planet, setPlanet] = useState('earth')
const [status, setStatus] = useState('Idle')
const [keyStatus, setKeyStatus] = useState('idle')`,
      },
    ],
  })

  expectToolSuccess(applyChangesPayload)
  const diagnostics = await waitForDiagnosticsIdle()
  expect(diagnostics.issues).toEqual([])
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

        const capture = expectToolSuccess<{
          layerResources: {
            frame: string
            screenshot: string
            accessibility: string
            dom_layout_style: string
          }
        }>(await callCapturePreviewEvidence({}))

        const frameResource = JSON.parse((await readMcpResource(capture.layerResources.frame)).text)
        expect(frameResource.preview.viewport.width).toBeGreaterThan(0)
        expect(frameResource.preview.viewport.height).toBeGreaterThan(0)

        const screenshotSvg = (await readMcpResource(capture.layerResources.screenshot)).text
        const screenshotMatch = screenshotSvg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/)
        expect(screenshotMatch).not.toBeNull()
        expect(Number(screenshotMatch?.[1])).toBeGreaterThan(1)
        expect(Number(screenshotMatch?.[2])).toBeGreaterThan(1)

        const accessibility = JSON.parse(
          (await readMcpResource(capture.layerResources.accessibility)).text
        )
        expect(accessibility.rootSelector).toBe('#root')
        expect(accessibility.nodeCount).toBeGreaterThan(0)

        const domLayoutStyle = JSON.parse(
          (await readMcpResource(capture.layerResources.dom_layout_style)).text
        )
        expect(domLayoutStyle.rootSelector).toBe('#root')
        expect(domLayoutStyle.capturedElementCount).toBeGreaterThan(0)
      } finally {
        await app.close()
      }
    }
  })

  test('supports bounded preview interaction captures and preserves human-visible state', async () => {
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
      await loadInteractionDemoProject()

      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', {
          name: 'Interaction demo',
        })
      ).toBeVisible({ timeout: 15_000 })

      const previewContextBefore = await readJsonMcpResource('arcade://project/preview-context')
      const manifestBefore = await readJsonMcpResource('arcade://project/manifest')
      expect(manifestBefore.activePageId).toBe('page01')

      const menuCapture = expectToolSuccess<{
        page: { id: string }
        layerResources: {
          screenshot: string
          accessibility: string
          dom_layout_style: string
          frame: string
        }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page02',
          viewportSize: 'XS',
          theme: 'light',
          interactions: [
            {
              action: 'click',
              target: { role: 'button', name: 'Toggle menu' },
            },
          ],
        })
      )
      expect(menuCapture.page.id).toBe('page02')

      const menuScreenshot = (await readMcpResource(menuCapture.layerResources.screenshot)).text
      expect(menuScreenshot).toContain('Menu action')

      const menuAccessibility = JSON.parse(
        (await readMcpResource(menuCapture.layerResources.accessibility)).text
      )
      expect(JSON.stringify(menuAccessibility)).toContain('Menu action')

      const menuDom = JSON.parse((await readMcpResource(menuCapture.layerResources.dom_layout_style)).text)
      expect(JSON.stringify(menuDom)).toContain('Menu action')

      const menuFrame = JSON.parse((await readMcpResource(menuCapture.layerResources.frame)).text)
      expect(menuFrame.page).toEqual({ id: 'page02', name: 'Details' })
      expect(menuFrame.preview.theme).toBe('light')

      const previewContextAfterMenu = await readJsonMcpResource('arcade://project/preview-context')
      expect(previewContextAfterMenu).toEqual(previewContextBefore)
      const manifestAfterMenu = await readJsonMcpResource('arcade://project/manifest')
      expect(manifestAfterMenu.activePageId).toBe('page01')
      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', {
          name: 'Interaction demo',
        })
      ).toBeVisible({ timeout: 15_000 })

      const fillCapture = expectToolSuccess<{
        layerResources: { screenshot: string; dom_layout_style: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['screenshot', 'dom_layout_style'],
          interactions: [
            {
              action: 'fill',
              target: { label: 'Full name' },
              value: 'Ada Lovelace',
            },
          ],
        })
      )
      expect((await readMcpResource(fillCapture.layerResources.screenshot)).text).toContain(
        'Ada Lovelace'
      )
      expect((await readMcpResource(fillCapture.layerResources.dom_layout_style)).text).toContain(
        'Typed value: Ada Lovelace'
      )

      const selectCapture = expectToolSuccess<{
        layerResources: { dom_layout_style: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['dom_layout_style'],
          interactions: [
            {
              action: 'select',
              target: { label: 'Planet' },
              value: 'mars',
            },
          ],
        })
      )
      expect((await readMcpResource(selectCapture.layerResources.dom_layout_style)).text).toContain(
        'Selected planet: mars'
      )

      const pressCapture = expectToolSuccess<{
        layerResources: { dom_layout_style: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['dom_layout_style'],
          interactions: [
            {
              action: 'press',
              target: { role: 'button', name: 'Confirm via key' },
              key: 'Enter',
            },
          ],
        })
      )
      expect((await readMcpResource(pressCapture.layerResources.dom_layout_style)).text).toContain(
        'Key status: confirmed'
      )

      const waitCapture = expectToolSuccess<{
        layerResources: { dom_layout_style: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['dom_layout_style'],
          interactions: [
            {
              action: 'click',
              target: { role: 'button', name: 'Load async state' },
            },
            {
              action: 'waitFor',
              text: 'Loaded',
              timeoutMs: 800,
            },
          ],
        })
      )
      expect((await readMcpResource(waitCapture.layerResources.dom_layout_style)).text).toContain(
        'Loaded'
      )

      const navigationCapture = expectToolSuccess<{
        manifestResourceUri: string
        layerResources: { frame: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['frame'],
          interactions: [
            {
              action: 'click',
              target: { role: 'link', name: 'Open details page' },
            },
            {
              action: 'waitFor',
              text: 'Details page',
              timeoutMs: 800,
            },
          ],
        })
      )
      const navigationFrame = JSON.parse(
        (await readMcpResource(navigationCapture.layerResources.frame)).text
      )
      expect(navigationFrame.page).toEqual({ id: 'page01', name: 'Page 1' })
      expect(navigationFrame.capture.requestedLayers).toEqual(['frame'])
      const navigationManifest = JSON.parse(
        (await readMcpResource(navigationCapture.manifestResourceUri)).text
      )
      expect(navigationManifest.interactions.finalState.pageId).toBe('page02')

      const scrollCapture = expectToolSuccess<{
        layerResources: { frame: string }
      }>(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          layers: ['frame'],
          interactions: [
            {
              action: 'scroll',
              y: 160,
            },
          ],
        })
      )
      const scrollFrame = JSON.parse((await readMcpResource(scrollCapture.layerResources.frame)).text)
      expect(scrollFrame.preview.scroll.y).toBeGreaterThan(0)

      const missingTargetFailure = expectToolFailure(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          interactions: [
            {
              action: 'click',
              target: { selector: '#missing-control' },
            },
          ],
        })
      )
      expect(missingTargetFailure.code).toBe('invalid-capture-target')
      expect(missingTargetFailure.manifestResourceUri).toBeUndefined()

      const hostUiFailure = expectToolFailure(
        await callCapturePreviewEvidence({
          pageId: 'page01',
          interactions: [
            {
              action: 'click',
              target: { selector: '[data-testid="project-controls-settings"]' },
            },
          ],
        })
      )
      expect(hostUiFailure.code).toBe('invalid-capture-target')

      const externalNavigationFailure = expectToolFailure(
        await callCapturePreviewEvidence({
          pageId: 'page02',
          interactions: [
            {
              action: 'click',
              target: { role: 'link', name: 'External docs' },
            },
          ],
        })
      )
      expect(externalNavigationFailure).toMatchObject({
        code: 'invalid-capture-target',
        message:
          'Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed.',
      })

      const externalPressFailure = expectToolFailure(
        await callCapturePreviewEvidence({
          pageId: 'page02',
          interactions: [
            {
              action: 'press',
              target: { role: 'link', name: 'External docs' },
              key: 'Enter',
            },
          ],
        })
      )
      expect(externalPressFailure).toMatchObject({
        code: 'invalid-capture-target',
        message:
          'Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed.',
      })

      const previewContextAfterAll = await readJsonMcpResource('arcade://project/preview-context')
      expect(previewContextAfterAll).toEqual(previewContextBefore)
      const manifestAfterAll = await readJsonMcpResource('arcade://project/manifest')
      expect(manifestAfterAll.activePageId).toBe('page01')
      await expect(
        page.frameLocator('[data-testid="preview-iframe"]').getByRole('heading', {
          name: 'Interaction demo',
        })
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await app.close()
    }
  })
})

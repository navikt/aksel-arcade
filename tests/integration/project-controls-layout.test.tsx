import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import {
  MAX_SANDBOX_CONSOLE_MESSAGES,
  type PreviewDiagnostics,
} from '@/services/previewDiagnostics'
import type {
  AgentBridge,
  AgentBridgeCommandResult,
  AgentBridgeErrorCode,
} from '@/services/agentBridge'
import type {
  DesktopAgentTransportRequestHandler,
  DesktopAgentTransportRouteRequest,
  DesktopAgentTransportRouteResponse,
} from '@/services/desktopAgentTransportProtocol'
import type { PreviewEvidenceElement } from '@/services/previewEvidence'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import {
  ARCADE_PROJECT_IMPORT_ACCEPT,
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_FORMAT,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  type ArcadeProjectPackage,
} from '@/services/storage'

const noop = () => {}

interface HarnessProps {
  includePreview?: boolean
  shellCapabilities?: ShellCapabilities
}

const Harness = ({
  includePreview = false,
  shellCapabilities = DESKTOP_ARCADE_CAPABILITIES,
}: HarnessProps) => {
  const {
    project,
    setProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
  } = useProject()
  const { setTheme } = useSettings()

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={(name) => updateProject({ name })}
        currentProject={project}
        onProjectImported={setProject}
        saveStatus="idle"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
        onClearStorage={noop}
        onLoadFormSummaryTemplate={loadFormSummaryTemplate}
        onLoadHooksDemo={loadHooksDemo}
        shellCapabilities={shellCapabilities}
      />
      <button
        type="button"
        onClick={() => {
          updateProject({
            name: 'Updated Agent Project',
            jsxCode: 'export default function App() { return <Heading>Updated</Heading> }',
            hooksCode: 'export const useAgentFixture = () => "updated"',
            viewportSize: 'LG',
          })
          setTheme('light')
        }}
      >
        Update Agent read fixture
      </button>
      {includePreview && <PreviewPane />}
    </>
  )
}

const renderHeader = (options?: HarnessProps) => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness {...options} />
      </AppProvider>
    </SettingsProvider>
  )
}

const findAgentAccessButton = () => screen.findByRole('button', { name: /koble til agent/i })

const collectObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ])
}

const AGENT_PACKAGE_ARTIFACT_KEY_PATTERN =
  /agent|session|credential|endpoint|permission|checkpoint|diagnostic|evidence|transport|activity|bridge|rollback/i

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const exportCurrentProjectPackage = async (
  capturedBlobs: Blob[]
): Promise<{ packageData: ArcadeProjectPackage; text: string }> => {
  const blobCountBeforeExport = capturedBlobs.length

  fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

  const capturedBlob = capturedBlobs[blobCountBeforeExport]
  if (!capturedBlob) {
    throw new Error('Expected Export to create an Arcade project package blob.')
  }
  expect(capturedBlob.type).toBe(ARCADE_PROJECT_PACKAGE_MIME_TYPE)

  const text = await readBlobText(capturedBlob)
  return {
    packageData: JSON.parse(text) as ArcadeProjectPackage,
    text,
  }
}

const getPackagePortableShape = (packageData: ArcadeProjectPackage) => ({
  root: Object.keys(packageData).sort(),
  project: Object.keys(packageData.project).sort(),
  code: Object.keys(packageData.project.code).sort(),
  ui: Object.keys(packageData.project.ui).sort(),
  meta: packageData.meta ? Object.keys(packageData.meta).sort() : [],
})

const expectCleanPackage = (
  packageData: ArcadeProjectPackage,
  text: string,
  forbiddenValues: string[]
) => {
  expect(packageData.format).toBe(ARCADE_PROJECT_PACKAGE_FORMAT)
  expect(collectObjectKeys(packageData).join(' ')).not.toMatch(
    AGENT_PACKAGE_ARTIFACT_KEY_PATTERN
  )

  for (const forbiddenValue of forbiddenValues) {
    expect(text).not.toContain(forbiddenValue)
  }
}

const createProjectPackageFile = (text: string): File => {
  const file = new File([text], `agent-clean-package${ARCADE_PROJECT_PACKAGE_EXTENSION}`, {
    type: ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  })
  Object.defineProperty(file, 'text', {
    value: async () => text,
  })
  return file
}

const callBridgeCommand = <TResult,>(command: () => TResult): TResult => {
  let result: TResult | undefined

  act(() => {
    result = command()
  })

  if (result === undefined) {
    throw new Error('Expected bridge command to return a result.')
  }

  return result
}

const expectBridgeSuccess = <TData,>(result: AgentBridgeCommandResult<TData>): TData => {
  expect(result.ok).toBe(true)

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

const expectBridgeFailure = <TData,>(
  result: AgentBridgeCommandResult<TData>,
  code: AgentBridgeErrorCode
) => {
  expect(result).toMatchObject({
    ok: false,
    error: {
      code,
      message: expect.any(String),
    },
  })

  if (result.ok) {
    throw new Error('Expected bridge command to fail.')
  }

  expect(result.error.message.trim().length).toBeGreaterThan(0)
  return result.error
}

const getRollbackLabels = (): string[] =>
  screen
    .queryAllByRole('menuitem')
    .map((item) => item.textContent ?? '')
    .filter((label) => label.startsWith('Gjenopprett '))

const captureAgentState = (bridge: AgentBridge) => {
  const project = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
  const preview = expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))
  const session = expectBridgeSuccess(callBridgeCommand(() => bridge.getSessionState()))

  return {
    project,
    preview,
    permissions: session.permissions,
    statusText: screen.getByRole('status').textContent,
    rollbackLabels: getRollbackLabels(),
  }
}

const startAgentAccess = async () => {
  fireEvent.click(await findAgentAccessButton())
  expect(await screen.findByText(/Koble til agent/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))

  await waitFor(() => expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeDefined())
  const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
  if (!bridge) {
    throw new Error('Expected Agent bridge to be published after access starts.')
  }

  return bridge
}

const setupDesktopTransportPreload = (
  sessionId: ReturnType<Crypto['randomUUID']> = '11111111-1111-4111-8111-111111111111'
) => {
  let transportRequestHandler: DesktopAgentTransportRequestHandler | null = null
  const endpoint = {
    endpoint: 'http://127.0.0.1:48123',
    sessionId,
    authorizationHeader: 'Bearer copied-agent-secret',
  }
  const api = {
    getShellCapabilities: vi.fn().mockResolvedValue(DESKTOP_ARCADE_CAPABILITIES),
    startAgentTransportSession: vi.fn().mockResolvedValue(endpoint),
    stopAgentTransportSession: vi.fn().mockResolvedValue(true),
    setAgentTransportRequestHandler: vi.fn(
      (handler: DesktopAgentTransportRequestHandler | null) => {
        transportRequestHandler = handler
      }
    ),
  }

  window.__AKSEL_ARCADE_DESKTOP__ = api
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(sessionId)

  return {
    api,
    endpoint,
    route: async (
      request: Omit<DesktopAgentTransportRouteRequest, 'sessionId'> & {
        sessionId?: string
      }
    ): Promise<DesktopAgentTransportRouteResponse> => {
      if (!transportRequestHandler) {
        throw new Error('Expected Desktop transport request handler to be registered.')
      }
      const handler = transportRequestHandler

      let response: DesktopAgentTransportRouteResponse | undefined
      await act(async () => {
        response = await handler({
          ...request,
          sessionId: request.sessionId ?? sessionId,
        })
      })

      if (!response) {
        throw new Error('Expected Desktop transport request handler to return a response.')
      }

      return response
    },
  }
}

const dispatchSandboxMessage = (data: unknown) => {
  const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
  if (!iframe.contentWindow) {
    throw new Error('Expected preview iframe to have a contentWindow.')
  }

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: window.location.origin,
        source: iframe.contentWindow,
      })
    )
  })
}

const setupPreviewEvidenceFrame = () => {
  const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
  const frameDocument = iframe.contentDocument
  const frameWindow = iframe.contentWindow
  if (!frameDocument || !frameWindow) {
    throw new Error('Expected preview iframe document to be available.')
  }

  if (!frameDocument.body) {
    frameDocument.open()
    frameDocument.write('<!doctype html><html><body></body></html>')
    frameDocument.close()
  }
  const frameBody = frameDocument.body
  if (!frameBody) {
    throw new Error('Expected preview iframe body to be available.')
  }

  Object.defineProperties(frameWindow, {
    innerWidth: { configurable: true, value: 640 },
    innerHeight: { configurable: true, value: 480 },
    devicePixelRatio: { configurable: true, value: 1 },
    scrollX: { configurable: true, value: 0 },
    scrollY: { configurable: true, value: 0 },
  })

  frameBody.innerHTML = `
    <div
      id="root"
      class="aksel-theme dark"
      data-color="accent"
      data-reactroot=""
      onclick="evil()"
      style="display: flex; padding: 8px; row-gap: 12px;"
    >
      Preview root text
      <section class="aksel-box custom-card" data-color="info" data-agent-note="safe">
        <h1 class="aksel-heading" aria-label="Evidence title">Evidence title</h1>
        <button
          class="aksel-button"
          data-color="accent"
          onclick="steal()"
          style="background-color: rgb(4, 5, 6);"
        >
          Continue
        </button>
        <script>window.localStorage.secret = document.cookie</script>
        <style>.unsafe-css { color: red; }</style>
      </section>
    </div>
  `

  const root = frameDocument.getElementById('root')
  const section = frameDocument.querySelector('section')
  const button = frameDocument.querySelector('button')
  if (!root || !section || !button) {
    throw new Error('Expected preview evidence fixture to render.')
  }

  mockElementRect(root, { x: 10, y: 20, width: 300, height: 200 })
  mockElementRect(section, { x: 18, y: 28, width: 260, height: 140 })
  mockElementRect(button, { x: 24, y: 86, width: 96, height: 32 })

  return { button, root, section }
}

const findEvidenceElement = (
  element: PreviewEvidenceElement,
  tagName: string
): PreviewEvidenceElement | null => {
  if (element.tagName === tagName) {
    return element
  }

  for (const child of element.children ?? []) {
    const match = findEvidenceElement(child, tagName)
    if (match) {
      return match
    }
  }

  return null
}

const mockElementRect = (element: Element, rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>) => {
  const fullRect = {
    ...rect,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    left: rect.x,
    toJSON: () => ({
      ...rect,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      left: rect.x,
    }),
  } as DOMRect

  element.getBoundingClientRect = () => fullRect
}

describe('ProjectControls layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    delete window.__AKSEL_ARCADE_AGENT_BRIDGE__
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AKSEL_ARCADE_AGENT_BRIDGE__
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  it('keeps Web Arcade Share URL available and Agent access absent', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const importInput = screen.getByLabelText(/import project file/i) as HTMLInputElement
    const shareButton = screen.getByLabelText(/share project/i)
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(importInput.accept).toBe(ARCADE_PROJECT_IMPORT_ACCEPT)
    expect(screen.queryByRole('button', { name: /koble til agent/i })).toBeNull()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()
    expect(
      importButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      shareButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(shareButton)

    expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
    expect(screen.getByText(/Strategy:/i)).toBeTruthy()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()
  })

  it('keeps Desktop Arcade Agent access available and Share URL absent', async () => {
    renderHeader()

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const agentButton = await findAgentAccessButton()
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(screen.queryByLabelText(/share project/i)).toBeNull()
    expect(
      importButton.compareDocumentPosition(agentButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      agentButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(settingsButton)
    expect(await screen.findByText(/Switch to light theme/i)).toBeTruthy()
    expect(screen.queryByText(/Switch to light mode/i)).toBeNull()
  })

  it('keeps Agent bridge inactive by default and publishes it only for a temporary session', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    )
    const { unmount } = renderHeader()

    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    fireEvent.click(await findAgentAccessButton())

    expect(await screen.findByText(/Koble til agent/i)).toBeTruthy()
    expect(screen.queryByText(/kommandoen gir agenten tilgang/i)).toBeNull()
    expect(screen.queryByText('Del bare med agenten du vil gi tilgang.')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Kopier agentkommando/i })).toBeNull()
    const inactiveStatus = screen.getByRole('status').textContent ?? ''
    expect(inactiveStatus).toBe('Status: inaktiv')
    expect(inactiveStatus).not.toMatch(/connected|disconnected/i)

    const accessItem = screen.getByRole('menuitemcheckbox', {
      name: /agent-tilgang/i,
    })

    expect(accessItem.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('menuitemcheckbox', { name: /allow source changes/i })).toBeNull()
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /allow preview setting changes/i })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /allow preview evidence reads/i })
    ).toBeNull()
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /allow project metadata changes/i })
    ).toBeNull()

    fireEvent.click(accessItem)

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Status: aktiv'))
    expect(screen.getByText(/kommandoen gir agenten tilgang/i)).toBeTruthy()
    expect(screen.getByText('Del bare med agenten du vil gi tilgang.')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Kopier agentkommando/i })).toBeTruthy()
    const activeBridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
    expect(activeBridge).toMatchObject({
      sessionId: '11111111-1111-4111-8111-111111111111',
      status: 'active',
      readScope: 'arcade-session',
      permissions: {
        sourceChanges: true,
        previewSettings: true,
        previewEvidence: true,
        projectMetadata: true,
      },
      commandNames: [
        'getAgentInstructions',
        'getProject',
        'getPreviewContext',
        'getDiagnostics',
        'getPreviewEvidence',
        'getSessionState',
        'applySourceChange',
      ],
    })
    expect(activeBridge?.getAgentInstructions).toEqual(expect.any(Function))
    expect(activeBridge?.getProject).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewContext).toEqual(expect.any(Function))
    expect(activeBridge?.getDiagnostics).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewEvidence).toEqual(expect.any(Function))
    expect(activeBridge?.getSessionState).toEqual(expect.any(Function))
    expect(activeBridge?.applySourceChange).toEqual(expect.any(Function))
    expect(activeBridge?.commandNames.join(' ')).not.toMatch(/share|export/i)
    expect(activeBridge?.commandNames).not.toContain('restoreCheckpoint')
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty(
      'generateShareUrl'
    )
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty('exportProject')
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty('exportJson')
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty(
      'restoreCheckpoint'
    )
    expect(activeBridge as unknown as Record<string, unknown>).not.toHaveProperty(
      'pairingCredential'
    )

    expect(activeBridge?.permissions).toMatchObject({
      sourceChanges: true,
      previewSettings: true,
      previewEvidence: true,
      projectMetadata: true,
    })

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))

    expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()
    expect(activeBridge?.getProject()).toMatchObject({
      ok: false,
      command: 'getProject',
      error: {
        code: 'session-revoked',
      },
    })

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))
    await waitFor(() => expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeDefined())

    unmount()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    renderHeader()
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

    fireEvent.click(await findAgentAccessButton())
    expect(
      (
        await screen.findByRole('menuitemcheckbox', {
          name: /agent-tilgang/i,
        })
      ).getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')
  })

  it('hides the Agent pairing handoff before Agent access is active', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderHeader()

    fireEvent.click(await findAgentAccessButton())
    expect(await screen.findByText(/Koble til agent/i)).toBeTruthy()

    expect(screen.queryByText(/kommandoen gir agenten tilgang/i)).toBeNull()
    expect(screen.queryByText('Del bare med agenten du vil gi tilgang.')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /kopier agentkommando/i })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies a one-line Agent pairing handoff command only after Desktop Agent access starts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const sessionId = '11111111-1111-4111-8111-111111111111'
    const endpoint = {
      endpoint: 'http://127.0.0.1:48123',
      sessionId,
      authorizationHeader: 'Bearer copied-agent-secret',
    }
    window.__AKSEL_ARCADE_DESKTOP__ = {
      getShellCapabilities: vi.fn().mockResolvedValue(DESKTOP_ARCADE_CAPABILITIES),
      startAgentTransportSession: vi.fn().mockResolvedValue(endpoint),
      stopAgentTransportSession: vi.fn().mockResolvedValue(true),
    }
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(sessionId)

    renderHeader()

    await startAgentAccess()
    fireEvent.click(screen.getByRole('menuitem', { name: /kopier agentkommando/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    const instructions = writeText.mock.calls[0]?.[0] ?? ''
    expect(window.__AKSEL_ARCADE_DESKTOP__.startAgentTransportSession).toHaveBeenCalledTimes(1)
    expect(instructions).toBe(
      `curl -sS -X POST '${endpoint.endpoint}' -H 'Authorization: ${endpoint.authorizationHeader}' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    )
    expect(instructions).not.toContain('\n')
    expect(instructions).toContain(`'${endpoint.endpoint}'`)
    expect(instructions).toContain(`'Authorization: ${endpoint.authorizationHeader}'`)
    expect(instructions).toContain('"method":"getAgentInstructions"')
    expect(instructions).not.toContain('window.__AKSEL_ARCADE_AGENT_BRIDGE__')
    expect(instructions).not.toContain('Desktop loopback JSON-RPC transport')
    expect(instructions).not.toContain('getProject')
    expect(instructions).not.toContain('applySourceChange')
    expect(instructions).not.toMatch(/\b(jq|mcp|helper)\b/i)
    expect(instructions).toContain('"jsonrpc":"2.0"')
    expect(instructions).not.toMatch(/[?&](token|credential|authorization)=/i)
    expect(screen.queryByText(endpoint.endpoint)).toBeNull()
    expect(screen.queryByText(endpoint.authorizationHeader)).toBeNull()
    expect(screen.queryByText('copied-agent-secret')).toBeNull()
    expect(screen.queryByText(/curl -sS/i)).toBeNull()
    expect(screen.queryByText(/getAgentInstructions/i)).toBeNull()
  })

  it('routes Desktop transport Agent changes through normal project and preview flows', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    renderHeader()

    const bridge = await startAgentAccess()
    await waitFor(() =>
      expect(desktopTransport.api.setAgentTransportRequestHandler).toHaveBeenCalledWith(
        expect.any(Function)
      )
    )

    await expect(
      desktopTransport.route({
        id: 'instructions-1',
        method: 'getAgentInstructions',
      })
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 'instructions-1',
      result: {
        ok: true,
        command: 'getAgentInstructions',
        data: {
          version: 1,
          sessionId: desktopTransport.endpoint.sessionId,
          endpoint: desktopTransport.endpoint.endpoint,
          authorizationHeader: desktopTransport.endpoint.authorizationHeader,
          readScope: 'arcade-session',
        },
      },
    })

    const nextJsx = 'export default function App() { return <Heading>Transport update</Heading> }'
    const acceptedResponse = await desktopTransport.route({
      id: 'change-1',
      method: 'applySourceChange',
      params: {
        summary: 'Desktop transport update',
        jsxCode: nextJsx,
        viewportSize: 'LG',
        theme: 'light',
        name: 'Transport Agent Project',
      },
    })

    expect(acceptedResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 'change-1',
      result: {
        ok: true,
        command: 'applySourceChange',
        data: {
          checkpointId: expect.any(String),
          changedFields: ['jsxCode', 'viewportSize', 'theme', 'name'],
        },
      },
    })

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const updatedPreview = expectBridgeSuccess(
        callBridgeCommand(() => bridge.getPreviewContext())
      )

      expect(updatedProject).toMatchObject({
        name: 'Transport Agent Project',
        jsxCode: nextJsx,
      })
      expect(updatedPreview).toMatchObject({
        theme: 'light',
        viewportSize: 'LG',
      })
    })
    expect(
      screen.getByRole('menuitem', {
        name: /gjenopprett desktop transport update \(JSX \+ Skjermstørrelse \+ Tema \+ Navn\)/i,
      })
    ).toBeTruthy()

    const beforeInvalid = captureAgentState(bridge)
    const invalidResponse = await desktopTransport.route({
      id: 'invalid-1',
      method: 'applySourceChange',
      params: {
        summary: 'Invalid viewport',
        viewportSize: 'XXL',
      },
    })

    expect(invalidResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 'invalid-1',
      error: {
        code: -32002,
        data: {
          code: 'invalid-request',
          command: 'applySourceChange',
          bridgeError: {
            code: 'invalid-request',
          },
        },
      },
    })
    expect(captureAgentState(bridge)).toEqual(beforeInvalid)

    await expect(
      desktopTransport.route({
        id: 'shell-1',
        method: 'openShell',
      })
    ).resolves.toMatchObject({
      error: {
        code: -32601,
        data: {
          code: 'unsupported-method',
        },
      },
    })

    await expect(
      desktopTransport.route({
        id: 'stale-1',
        method: 'applySourceChange',
        params: {
          summary: 'Stale session',
          jsxCode: 'export default function App() { return <Heading>Stale</Heading> }',
        },
        sessionId: 'stale-session',
      })
    ).resolves.toMatchObject({
      error: {
        code: -32001,
        data: {
          code: 'session-mismatch',
        },
      },
    })
  })

  it('restores Desktop transport Checkpoints only from the human Agent menu', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    renderHeader()

    const bridge = await startAgentAccess()
    await waitFor(() =>
      expect(desktopTransport.api.setAgentTransportRequestHandler).toHaveBeenCalledWith(
        expect.any(Function)
      )
    )

    const original = captureAgentState(bridge)
    const nextJsx =
      'export default function App() { return <Heading>Human rollback transport update</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "desktop-rollback"'
    const acceptedResponse = await desktopTransport.route({
      id: 'rollback-change-1',
      method: 'applySourceChange',
      params: {
        summary: 'Desktop rollback update',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'XS',
        theme: 'light',
        name: 'Desktop Rollback Project',
      },
    })

    expect(acceptedResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 'rollback-change-1',
      result: {
        ok: true,
        command: 'applySourceChange',
        data: {
          checkpointId: expect.any(String),
          changedFields: ['jsxCode', 'hooksCode', 'viewportSize', 'theme', 'name'],
        },
      },
    })

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const updatedPreview = expectBridgeSuccess(
        callBridgeCommand(() => bridge.getPreviewContext())
      )

      expect(updatedProject).toMatchObject({
        name: 'Desktop Rollback Project',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
      expect(updatedPreview).toEqual({
        theme: 'light',
        viewportSize: 'XS',
      })
    })

    const restoreItem = await screen.findByRole('menuitem', {
      name: /gjenopprett desktop rollback update \(JSX \+ Hooks \+ Skjermstørrelse \+ Tema \+ Navn\)/i,
    })
    const changed = captureAgentState(bridge)

    for (const method of ['restoreCheckpoint', 'deleteCheckpoint']) {
      await expect(
        desktopTransport.route({
          id: `${method}-1`,
          method,
          params: {
            checkpointId: 'checkpoint-id-reported-to-agent',
          },
        })
      ).resolves.toMatchObject({
        error: {
          code: -32601,
          data: {
            code: 'unsupported-method',
          },
        },
      })
    }
    expect(captureAgentState(bridge)).toEqual(changed)

    fireEvent.click(restoreItem)

    await waitFor(() => {
      const restoredProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const restoredPreview = expectBridgeSuccess(
        callBridgeCommand(() => bridge.getPreviewContext())
      )

      expect(restoredProject).toEqual(original.project)
      expect(restoredPreview).toEqual(original.preview)
    })

    fireEvent.click(await findAgentAccessButton())
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))

    expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')
    expect(
      screen.queryByRole('menuitem', {
        name: /gjenopprett desktop rollback update/i,
      })
    ).toBeNull()
  })

  it('keeps Desktop packages clean after transport reads, changes, rollback, stop, and import', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    const deterministicProjectId = '22222222-2222-4222-8222-222222222222'
    vi.mocked(globalThis.crypto.randomUUID).mockReturnValueOnce(deterministicProjectId)
    const capturedBlobs: Blob[] = []
    const originalCreateObjectURL = global.URL.createObjectURL
    const originalRevokeObjectURL = global.URL.revokeObjectURL
    global.URL.createObjectURL = ((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) {
        capturedBlobs.push(blob)
      }
      return `blob:desktop-package-${capturedBlobs.length}`
    }) as typeof URL.createObjectURL
    global.URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL

    try {
      const { unmount } = renderHeader()
      const importInput = screen.getByLabelText(/import project file/i) as HTMLInputElement

      expect(screen.queryByLabelText(/share project/i)).toBeNull()
      expect(screen.getByRole('button', { name: /^Export$/i })).toBeTruthy()
      expect(screen.getByRole('button', { name: /^Import$/i })).toBeTruthy()
      expect(importInput.accept).toBe(ARCADE_PROJECT_IMPORT_ACCEPT)

      const normalPackage = await exportCurrentProjectPackage(capturedBlobs)
      const normalPackageShape = getPackagePortableShape(normalPackage.packageData)
      const bridge = await startAgentAccess()
      await waitFor(() =>
        expect(desktopTransport.api.setAgentTransportRequestHandler).toHaveBeenCalledWith(
          expect.any(Function)
        )
      )

      const original = captureAgentState(bridge)
      await expect(
        desktopTransport.route({
          id: 'read-before-package-export',
          method: 'getProject',
        })
      ).resolves.toMatchObject({
        jsonrpc: '2.0',
        id: 'read-before-package-export',
        result: {
          ok: true,
          command: 'getProject',
          data: {
            name: original.project.name,
            jsxCode: original.project.jsxCode,
            hooksCode: original.project.hooksCode,
          },
        },
      })

      const checkpointSummary = 'Confidential package checkpoint summary'
      const nextJsx =
        'export default function App() { return <Heading>Desktop package export</Heading> }'
      const nextHooks = 'export const useAgentFixture = () => "package-export"'
      const acceptedResponse = await desktopTransport.route({
        id: 'package-change-1',
        method: 'applySourceChange',
        params: {
          summary: checkpointSummary,
          jsxCode: nextJsx,
          hooksCode: nextHooks,
          viewportSize: 'XS',
          theme: 'light',
          name: 'Transport Package Project',
        },
      })

      expect(acceptedResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 'package-change-1',
        result: {
          ok: true,
          command: 'applySourceChange',
          data: {
            checkpointId: desktopTransport.endpoint.sessionId,
            changedFields: ['jsxCode', 'hooksCode', 'viewportSize', 'theme', 'name'],
          },
        },
      })
      await waitFor(() => {
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
          name: 'Transport Package Project',
          jsxCode: nextJsx,
          hooksCode: nextHooks,
        })
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))).toEqual({
          theme: 'light',
          viewportSize: 'XS',
        })
      })

      const forbiddenPackageValues = [
        desktopTransport.endpoint.sessionId,
        desktopTransport.endpoint.endpoint,
        desktopTransport.endpoint.authorizationHeader,
        checkpointSummary,
        '__AKSEL_ARCADE_AGENT_BRIDGE__',
      ]
      const activePackage = await exportCurrentProjectPackage(capturedBlobs)

      expect(getPackagePortableShape(activePackage.packageData)).toEqual(normalPackageShape)
      expect(activePackage.packageData.project).toMatchObject({
        name: 'Transport Package Project',
        code: {
          jsxCode: nextJsx,
          hooksCode: nextHooks,
        },
        ui: {
          viewportSize: 'XS',
        },
      })
      expectCleanPackage(activePackage.packageData, activePackage.text, forbiddenPackageValues)

      fireEvent.click(
        await screen.findByRole('menuitem', {
          name: /gjenopprett confidential package checkpoint summary \(JSX \+ Hooks \+ Skjermstørrelse \+ Tema \+ Navn\)/i,
        })
      )
      await waitFor(() => {
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toEqual(
          original.project
        )
        expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))).toEqual(
          original.preview
        )
      })

      fireEvent.click(await findAgentAccessButton())
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))
      expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')
      expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

      const stoppedPackage = await exportCurrentProjectPackage(capturedBlobs)

      expect(getPackagePortableShape(stoppedPackage.packageData)).toEqual(normalPackageShape)
      expect(stoppedPackage.packageData.project).toMatchObject({
        name: original.project.name,
        code: {
          jsxCode: original.project.jsxCode,
          hooksCode: original.project.hooksCode,
        },
        ui: {
          viewportSize: original.preview.viewportSize,
        },
      })
      expectCleanPackage(stoppedPackage.packageData, stoppedPackage.text, forbiddenPackageValues)

      unmount()
      expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()
      renderHeader()

      fireEvent.change(screen.getByLabelText(/import project file/i), {
        target: {
          files: [createProjectPackageFile(activePackage.text)],
        },
      })

      await waitFor(() => expect(screen.getByText('Transport Package Project')).toBeTruthy())
      expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeUndefined()

      fireEvent.click(await findAgentAccessButton())
      expect(await screen.findByText(/Koble til agent/i)).toBeTruthy()
      expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')
      expect(
        screen.queryByRole('menuitem', {
          name: /gjenopprett confidential package checkpoint summary/i,
        })
      ).toBeNull()
    } finally {
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
    }
  })

  it('shows copy failure feedback and lets the user retry without revealing secrets', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionId = '11111111-1111-4111-8111-111111111111'
    const endpoint = {
      endpoint: 'http://127.0.0.1:48123',
      sessionId,
      authorizationHeader: 'Bearer copied-agent-secret',
    }
    const command = `curl -sS -X POST '${endpoint.endpoint}' -H 'Authorization: ${endpoint.authorizationHeader}' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          `clipboard blocked while writing ${command} to ${endpoint.endpoint} with ${endpoint.authorizationHeader}`
        )
      )
      .mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    window.__AKSEL_ARCADE_DESKTOP__ = {
      getShellCapabilities: vi.fn().mockResolvedValue(DESKTOP_ARCADE_CAPABILITIES),
      startAgentTransportSession: vi.fn().mockResolvedValue(endpoint),
      stopAgentTransportSession: vi.fn().mockResolvedValue(true),
    }
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(sessionId)

    renderHeader()

    await startAgentAccess()
    fireEvent.click(screen.getByRole('menuitem', { name: /kopier agentkommando/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/kunne ikke kopiere/i)
    const serializedLog = JSON.stringify(consoleError.mock.calls)
    expect(serializedLog).not.toContain(command)
    expect(serializedLog).not.toContain(endpoint.endpoint)
    expect(serializedLog).not.toContain(endpoint.authorizationHeader)
    expect(serializedLog).not.toContain('copied-agent-secret')
    expect(screen.queryByText(endpoint.endpoint)).toBeNull()
    expect(screen.queryByText(endpoint.authorizationHeader)).toBeNull()
    expect(screen.queryByText(/transport/i)).toBeNull()
    expect(screen.queryByText(/local server/i)).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /prøv igjen/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/agentkommando kopiert/i)).toBeTruthy()
    expect(screen.queryByText(endpoint.endpoint)).toBeNull()
    expect(screen.queryByText(endpoint.authorizationHeader)).toBeNull()
  })

  it('returns Arcade-scoped read state with simplified Agent status', async () => {
    renderHeader()

    fireEvent.click(await findAgentAccessButton())
    expect(await screen.findByText(/Koble til agent/i)).toBeTruthy()
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', {
        name: /agent-tilgang/i,
      })
    )

    await waitFor(() => expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__).toBeDefined())
    const bridge = window.__AKSEL_ARCADE_AGENT_BRIDGE__
    if (!bridge) {
      throw new Error('Expected Agent bridge to be published after access starts.')
    }

    const projectResult = callBridgeCommand(() => bridge.getProject())
    expect(projectResult).toMatchObject({
      ok: true,
      command: 'getProject',
    })
    const projectData = expectBridgeSuccess(projectResult)
    expect(projectData).toEqual({
      name: expect.any(String),
      jsxCode: expect.any(String),
      hooksCode: expect.any(String),
    })
    expect(projectData).not.toHaveProperty('id')

    expect(screen.getByRole('status').textContent).toBe('Status: aktiv')

    const previewResult = callBridgeCommand(() => bridge.getPreviewContext())
    expect(previewResult).toMatchObject({
      ok: true,
      command: 'getPreviewContext',
      data: {
        theme: 'dark',
        viewportSize: 'MD',
      },
    })

    const sessionResult = callBridgeCommand(() => bridge.getSessionState())
    expect(sessionResult).toMatchObject({
      ok: true,
      command: 'getSessionState',
      data: {
        status: 'active',
        permissions: {
          sourceChanges: true,
          previewSettings: true,
          previewEvidence: true,
          projectMetadata: true,
        },
        readScope: 'arcade-session',
        commandNames: [
          'getAgentInstructions',
          'getProject',
          'getPreviewContext',
          'getDiagnostics',
          'getPreviewEvidence',
          'getSessionState',
          'applySourceChange',
        ],
      },
    })

    const exposedReadKeys = collectObjectKeys({
      project: projectData,
      preview: previewResult.ok ? previewResult.data : null,
      session: sessionResult.ok ? sessionResult.data : null,
    }).join(' ')
    expect(exposedReadKeys).not.toMatch(/share|export|storage|clipboard|cookie/i)
    expect(sessionResult.ok ? sessionResult.data.commandNames.join(' ') : '').not.toMatch(
      /share|export/i
    )
  })

  it('returns preview diagnostics, keeps simplified status, and revokes stale reads', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const diagnosticsResult = callBridgeCommand(() => bridge.getDiagnostics())

    expect(diagnosticsResult).toMatchObject({
      ok: true,
      command: 'getDiagnostics',
      data: {
        status: expect.any(String),
        compileError: null,
        runtimeError: null,
        sandboxConsoleMessages: [],
      },
    })

    const diagnostics = expectBridgeSuccess(diagnosticsResult)
    const exposedDiagnosticsKeys = collectObjectKeys({ diagnostics }).join(' ')
    expect(exposedDiagnosticsKeys).not.toMatch(
      /share|export|storage|clipboard|cookie|document|window/i
    )

    expect(screen.getByRole('status').textContent).toBe('Status: aktiv')

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))

    expect(callBridgeCommand(() => bridge.getDiagnostics())).toMatchObject({
      ok: false,
      command: 'getDiagnostics',
      error: {
        code: 'session-revoked',
      },
    })
  })

  it('returns sanitized Preview evidence from only the sandboxed frame', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const { button } = setupPreviewEvidenceFrame()
    const firstResult = callBridgeCommand(() => bridge.getPreviewEvidence())

    expect(firstResult).toMatchObject({
      ok: true,
      command: 'getPreviewEvidence',
    })
    const evidence = expectBridgeSuccess(firstResult)
    expect(evidence.frame).toMatchObject({
      rootSelector: '#root',
      viewport: {
        width: 640,
        height: 480,
      },
      capturedElementCount: 4,
      truncated: false,
    })
    expect(evidence.tree).toMatchObject({
      tagName: 'div',
      text: 'Preview root text',
      attributes: {
        'data-color': 'accent',
        id: 'root',
      },
      classNames: ['aksel-theme', 'dark'],
      boundingBox: {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      },
      computedStyle: {
        display: 'flex',
        paddingTop: '8px',
        rowGap: '12px',
      },
    })

    const section = findEvidenceElement(evidence.tree, 'section')
    const heading = findEvidenceElement(evidence.tree, 'h1')
    const evidenceButton = findEvidenceElement(evidence.tree, 'button')
    expect(section).toMatchObject({
      attributes: {
        'data-agent-note': 'safe',
        'data-color': 'info',
      },
      classNames: ['aksel-box', 'custom-card'],
    })
    expect(heading).toMatchObject({
      text: 'Evidence title',
      attributes: {
        'aria-label': 'Evidence title',
      },
    })
    expect(evidenceButton).toMatchObject({
      text: 'Continue',
      attributes: {
        'data-color': 'accent',
      },
      computedStyle: {
        backgroundColor: 'rgb(4, 5, 6)',
      },
    })
    expect(button.getAttribute('onclick')).toBe('steal()')

    const serialized = JSON.stringify(evidence)
    expect(serialized).not.toContain('Aksel Arcade')
    expect(serialized).not.toContain('onclick')
    expect(serialized).not.toContain('steal()')
    expect(serialized).not.toContain('data-reactroot')
    expect(serialized).not.toContain('__reactFiber')
    expect(serialized).not.toContain('localStorage')
    expect(serialized).not.toContain('document.cookie')
    expect(serialized).not.toContain('clipboard')
    expect(serialized).not.toContain('.unsafe-css')

    expect(screen.getByRole('status').textContent).toBe('Status: aktiv')

    expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewEvidence()))).toEqual(
      evidence
    )
  })

  it('revokes stale Preview evidence reads after Agent access stops', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    setupPreviewEvidenceFrame()

    expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewEvidence()))
    expect(screen.getByRole('status').textContent).toBe('Status: aktiv')

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /agent-tilgang/i }))
    expect(screen.getByRole('status').textContent).toBe('Status: inaktiv')

    expect(callBridgeCommand(() => bridge.getPreviewEvidence())).toMatchObject({
      ok: false,
      command: 'getPreviewEvidence',
      error: {
        code: 'session-revoked',
      },
    })
  })

  it('returns runtime error diagnostics from normal preview state', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const runtimeError = {
      message: 'Agent runtime exploded',
      componentStack: '\n    at App',
      stack: 'Error: Agent runtime exploded',
    }

    dispatchSandboxMessage({
      type: 'RUNTIME_ERROR',
      payload: runtimeError,
    })

    expect(await screen.findByText(/Runtime Error/i)).toBeTruthy()

    await waitFor(() => {
      const diagnostics = expectBridgeSuccess(callBridgeCommand(() => bridge.getDiagnostics()))
      expect(diagnostics).toMatchObject({
        status: 'error',
        compileError: null,
        runtimeError,
      })
    })
  })

  it('returns bounded sandbox console history in diagnostics', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const levels = ['log', 'warn', 'error'] as const

    for (let index = 0; index < MAX_SANDBOX_CONSOLE_MESSAGES + 3; index += 1) {
      dispatchSandboxMessage({
        type: 'CONSOLE_LOG',
        payload: {
          level: levels[index % levels.length],
          args: [`sandbox message ${index}`, { index }],
        },
      })
    }

    await waitFor(() => {
      const diagnostics = expectBridgeSuccess(callBridgeCommand(() => bridge.getDiagnostics()))
      expect(diagnostics.sandboxConsoleMessages).toHaveLength(MAX_SANDBOX_CONSOLE_MESSAGES)
    })

    const diagnostics = expectBridgeSuccess(callBridgeCommand(() => bridge.getDiagnostics()))
    const firstMessage = diagnostics.sandboxConsoleMessages[0]
    const lastMessage =
      diagnostics.sandboxConsoleMessages[diagnostics.sandboxConsoleMessages.length - 1]

    expect(firstMessage).toMatchObject({
      level: 'log',
      message: 'sandbox message 3 {"index":3}',
      args: ['sandbox message 3', '{"index":3}'],
      timestamp: expect.any(String),
    })
    expect(lastMessage).toMatchObject({
      level: 'log',
      message: `sandbox message ${MAX_SANDBOX_CONSOLE_MESSAGES + 2} {"index":${MAX_SANDBOX_CONSOLE_MESSAGES + 2}}`,
      timestamp: expect.any(String),
    })
  })

  it('returns current project, preview, and permission state through captured bridge references', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    fireEvent.click(screen.getByRole('button', { name: /update agent read fixture/i }))

    const updatedProject = callBridgeCommand(() => bridge.getProject())
    expect(updatedProject).toMatchObject({
      ok: true,
      data: {
        name: 'Updated Agent Project',
        jsxCode: 'export default function App() { return <Heading>Updated</Heading> }',
        hooksCode: 'export const useAgentFixture = () => "updated"',
      },
    })

    const updatedPreview = callBridgeCommand(() => bridge.getPreviewContext())
    expect(updatedPreview).toMatchObject({
      ok: true,
      data: {
        theme: 'light',
        viewportSize: 'LG',
      },
    })

    expect(bridge.permissions.projectMetadata).toBe(true)
    expect(window.__AKSEL_ARCADE_AGENT_BRIDGE__?.permissions.projectMetadata).toBe(true)

    const updatedSession = callBridgeCommand(() => bridge.getSessionState())
    expect(updatedSession).toMatchObject({
      ok: true,
      data: {
        permissions: {
          projectMetadata: true,
        },
      },
    })
  })

  it('applies source replacements with automatic Checkpoints and human rollback', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const originalProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    const nextJsx = 'export default function App() { return <Heading>Agent update</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "changed"'

    const changeResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Replace source for demo',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
    )

    const changeData = expectBridgeSuccess(changeResult)
    expect(changeResult).toMatchObject({
      ok: true,
      command: 'applySourceChange',
    })
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['jsxCode', 'hooksCode'],
    })
    expect(screen.getByRole('status').textContent).toBe('Status: aktiv')

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      expect(updatedProject.jsxCode).toBe(nextJsx)
      expect(updatedProject.hooksCode).toBe(nextHooks)
    })

    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /gjenopprett replace source for demo \(JSX \+ Hooks\)/i,
      })
    )

    await waitFor(() => {
      const restoredProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      expect(restoredProject.jsxCode).toBe(originalProject.jsxCode)
      expect(restoredProject.hooksCode).toBe(originalProject.hooksCode)
    })
  })

  it('captures rapid sequential Checkpoints against the latest accepted Agent state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const originalProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    const firstJsx = 'export default function App() { return <Heading>First rapid</Heading> }'
    const secondJsx = 'export default function App() { return <Heading>Second rapid</Heading> }'
    const results: AgentBridgeCommandResult<unknown>[] = []

    act(() => {
      results.push(
        bridge.applySourceChange({
          summary: 'First rapid change',
          jsxCode: firstJsx,
        })
      )
      results.push(
        bridge.applySourceChange({
          summary: 'Second rapid change',
          jsxCode: secondJsx,
        })
      )
    })

    for (const result of results) {
      expectBridgeSuccess(result)
    }

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).jsxCode).toBe(
        secondJsx
      )
    })

    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /gjenopprett second rapid change \(JSX\)/i,
      })
    )

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).jsxCode).toBe(
        firstJsx
      )
    })

    fireEvent.click(await findAgentAccessButton())
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /gjenopprett first rapid change \(JSX\)/i,
      })
    )

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).jsxCode).toBe(
        originalProject.jsxCode
      )
    })
  })

  it('applies preview setting replacements with default Agent permissions', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Switch preview context',
        viewportSize: 'XS',
        theme: 'light',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['viewportSize', 'theme'],
    })

    await waitFor(() => {
      expect(callBridgeCommand(() => bridge.getPreviewContext())).toMatchObject({
        ok: true,
        data: {
          theme: 'light',
          viewportSize: 'XS',
        },
      })
    })
    expect(
      screen.getByRole('menuitem', {
        name: /gjenopprett switch preview context \(skjermstørrelse \+ tema\)/i,
      })
    ).toBeTruthy()
  })

  it('applies project metadata replacements with default Agent permissions', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    expect(bridge.permissions.projectMetadata).toBe(true)

    const acceptedResult = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Rename project',
        name: 'Agent Named Project',
      })
    )

    const changeData = expectBridgeSuccess(acceptedResult)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['name'],
    })
    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).name).toBe(
        'Agent Named Project'
      )
    })
  })

  it('applies combined source, preview, and metadata replacements atomically with rollback', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const original = captureAgentState(bridge)
    const nextJsx = 'export default function App() { return <Heading>Combined</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "combined"'

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Combined Agent update',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'LG',
        theme: 'light',
        name: 'Combined Agent Project',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
      checkpointId: expect.any(String),
      changedFields: ['jsxCode', 'hooksCode', 'viewportSize', 'theme', 'name'],
    })

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const updatedPreview = expectBridgeSuccess(
        callBridgeCommand(() => bridge.getPreviewContext())
      )

      expect(updatedProject).toMatchObject({
        name: 'Combined Agent Project',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
      expect(updatedPreview).toMatchObject({
        theme: 'light',
        viewportSize: 'LG',
      })
    })

    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: /gjenopprett combined agent update \(JSX \+ Hooks \+ Skjermstørrelse \+ Tema \+ Navn\)/i,
      })
    )

    await waitFor(() => {
      const restoredProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      const restoredPreview = expectBridgeSuccess(
        callBridgeCommand(() => bridge.getPreviewContext())
      )

      expect(restoredProject).toEqual(original.project)
      expect(restoredPreview).toEqual(original.preview)
    })
  })

  it('caps automatic source Checkpoints at ten recent entries', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    for (let index = 1; index <= 11; index += 1) {
      const result = callBridgeCommand(() =>
        bridge.applySourceChange({
          summary: `change ${index}`,
          jsxCode: `export default function App() { return <Heading>Change ${index}</Heading> }`,
        })
      )
      expectBridgeSuccess(result)
    }

    await waitFor(() => {
      const rollbackItems = screen
        .getAllByRole('menuitem')
        .filter((item) => item.textContent?.startsWith('Gjenopprett change'))
      expect(rollbackItems).toHaveLength(10)
    })
    expect(screen.queryByRole('menuitem', { name: /^Gjenopprett change 1 \(/i })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /^Gjenopprett change 11 \(/i })).toBeTruthy()
  })

  it('rejects malformed and unsupported Agent change requests without mutating Agent state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applySourceChange({
          summary: 'Seed checkpoint',
          jsxCode: 'export default function App() { return <Heading>Seed</Heading> }',
        })
      )
    )
    const before = captureAgentState(bridge)

    const invalidRequests: Array<{
      request: unknown
      code: AgentBridgeErrorCode
      message: RegExp
    }> = [
      {
        request: undefined,
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: null,
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: [],
        code: 'invalid-request',
        message: /provided as an object/i,
      },
      {
        request: { summary: 'No fields' },
        code: 'invalid-request',
        message: /jsxCode, hooksCode, viewportSize, theme, and\/or name/i,
      },
      {
        request: {
          summary: '   ',
          jsxCode: 'export default function App() { return <Heading>Blank</Heading> }',
        },
        code: 'invalid-request',
        message: /non-empty/i,
      },
      {
        request: { summary: 'Wrong type', jsxCode: 123 },
        code: 'invalid-request',
        message: /jsxCode must be a full-field string/i,
      },
      {
        request: { summary: 'Empty JSX', jsxCode: '' },
        code: 'invalid-request',
        message: /jsxCode must be a non-empty full-field string/i,
      },
      {
        request: { summary: 'Blank Hooks', hooksCode: '   ' },
        code: 'invalid-request',
        message: /hooksCode must be a non-empty full-field string/i,
      },
      {
        request: {
          summary: 'Unknown field',
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          notes: 'Not part of the Agent change contract',
        },
        code: 'unsupported-field',
        message: /Unsupported Agent change field: notes/i,
      },
      {
        request: {
          summary: 'Invalid viewport',
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          viewportSize: 'XXL',
        },
        code: 'invalid-request',
        message: /viewportSize/i,
      },
      {
        request: {
          summary: 'Invalid theme',
          hooksCode: 'export const useAgentFixture = () => "theme"',
          theme: 'system',
        },
        code: 'invalid-request',
        message: /theme/i,
      },
      {
        request: {
          summary: 'Invalid name type',
          name: 123,
        },
        code: 'invalid-request',
        message: /name must be a full-field string/i,
      },
      {
        request: {
          summary: 'Invalid blank name',
          name: '   ',
        },
        code: 'invalid-request',
        message: /name must be 1-100 characters/i,
      },
    ]

    for (const { request, code, message } of invalidRequests) {
      const result = callBridgeCommand(() => bridge.applySourceChange(request))
      const error = expectBridgeFailure(result, code)
      expect(error.message).toMatch(message)
      expect(screen.getByRole('status').textContent).toBe(before.statusText)
      expect(captureAgentState(bridge)).toEqual(before)
    }
  })

  it('rejects oversized source changes before mutation or Checkpoint creation', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const before = captureAgentState(bridge)
    const oversizedJsx = `export default function App() {
  return <Heading>${'x'.repeat(5 * 1024 * 1024)}</Heading>
}`

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Oversized source replacement',
        jsxCode: oversizedJsx,
      })
    )

    const error = expectBridgeFailure(result, 'payload-too-large')
    expect(error.message).toMatch(/exceeds 5MB limit/i)
    expect(screen.getByRole('status').textContent).toBe(before.statusText)
    expect(captureAgentState(bridge)).toEqual(before)
  })

  it('applies schema-valid invalid source and lets the normal preview report compile errors', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const invalidJsx = `export default function App() {
  return <Button>Broken
}`

    const result = callBridgeCommand(() =>
      bridge.applySourceChange({
        summary: 'Introduce invalid JSX',
        jsxCode: invalidJsx,
      })
    )

    expectBridgeSuccess(result)
    const appliedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    expect(appliedProject.jsxCode).toBe(invalidJsx)

    expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getDiagnostics()))).toMatchObject({
      status: 'transpiling',
      compileError: null,
      runtimeError: null,
    })

    expect(await screen.findByText(/Compile Error/i, undefined, { timeout: 5000 })).toBeTruthy()

    const diagnostics = expectBridgeSuccess(
      callBridgeCommand<AgentBridgeCommandResult<PreviewDiagnostics>>(() => bridge.getDiagnostics())
    )
    expect(diagnostics).toMatchObject({
      status: 'error',
      compileError: {
        message: expect.stringMatching(/Unterminated JSX contents/i),
        line: expect.any(Number),
        column: expect.any(Number),
        stack: expect.any(String),
      },
      runtimeError: null,
    })
  })
})

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { AppHeader } from '@/components/Header/AppHeader'
import { PreviewPane } from '@/components/Preview/PreviewPane'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createSinglePageProjectSource, getActiveSource } from '@/services/projectSource'
import {
  MAX_SANDBOX_CONSOLE_MESSAGES,
  type PreviewDiagnostics,
} from '@/services/previewDiagnostics'
import { AGENT_BRIDGE_PROTOCOL_VERSION } from '@/services/agentBridge'
import type {
  AgentBridgeCommandResult,
  AgentBridgeCommandName,
  AgentBridgeErrorCode,
  AgentInstructionsPayload,
  AgentPreviewReadState,
  AgentProjectReadState,
  AgentChangeResult,
  AgentSessionReadState,
} from '@/services/agentBridge'
import type {
  DesktopAgentTransportRequestHandler,
  DesktopAgentTransportRouteRequest,
  DesktopAgentTransportRouteResponse,
} from '@/services/desktopAgentTransportProtocol'
import {
  collectPreviewEvidenceFromFrame,
  registerPreviewEvidenceRequestHandler,
  type PreviewEvidence,
  type PreviewEvidenceElement,
} from '@/services/previewEvidence'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  type DesktopArcadePreloadApi,
  type ShellCapabilities,
} from '@/services/shellCapabilities'
import {
  ARCADE_PROJECT_IMPORT_ACCEPT,
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_FORMAT,
  ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  createArcadeProjectPackage,
  createShareSnapshot,
  type ArcadeProjectPackage,
} from '@/services/storage'
import { createShareToken, encodeSharePayload } from '@/utils/shareEncoding'

const LEGACY_AGENT_BRIDGE_GLOBAL = '__AKSEL_ARCADE_AGENT_BRIDGE__'

const getLegacyAgentBridgeGlobal = () => Reflect.get(window, LEGACY_AGENT_BRIDGE_GLOBAL)

const clearLegacyAgentBridgeGlobal = () => {
  Reflect.deleteProperty(window, LEGACY_AGENT_BRIDGE_GLOBAL)
}

const expectLegacyAgentBridgeAbsent = () => {
  expect(getLegacyAgentBridgeGlobal()).toBeUndefined()
}

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
    replaceProject,
    updateProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
    shareHydration,
    applySharedSnapshot,
  } = useProject()
  const { setTheme } = useSettings()

  return (
    <>
      <AppHeader
        projectName={project.name}
        onProjectNameChange={(name) => updateProject({ name })}
        currentProject={project}
        onProjectImported={replaceProject}
        saveStatus="idle"
        projectSizeBytes={0}
        onResetToIntro={resetToIntro}
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
      <div data-testid="project-jsx-code" hidden>
        {getActiveSource(project).jsx}
      </div>
      {shareHydration.status === 'ready' && (
        <button type="button" onClick={applySharedSnapshot}>
          Load shared project
        </button>
      )}
      {includePreview && <PreviewPane />}
    </>
  )
}

const renderHeader = (options?: HarnessProps) => {
  const shellCapabilities = options?.shellCapabilities ?? DESKTOP_ARCADE_CAPABILITIES
  if (shellCapabilities.agentSessions.enabled && !window.__AKSEL_ARCADE_DESKTOP__) {
    setupDesktopTransportPreload()
  }

  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness {...options} />
      </AppProvider>
    </SettingsProvider>
  )
}

const AGENT_ACCESS_BUTTON_NAME = /connect an agent|koble til agent/i
const AGENT_ACCESS_TOGGLE_NAME = /agent bridge|agent-tilgang/i
const AGENT_STATUS_ACTIVE = 'Status: active'
const AGENT_STATUS_INACTIVE = 'Status: inactive'
const DEFAULT_AGENT_SOURCE_TARGET = { type: 'page', pageId: 'page01' } as const

const findAgentAccessButton = () => screen.findByRole('button', { name: AGENT_ACCESS_BUTTON_NAME })
const queryAgentAccessToggle = () =>
  screen.queryByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME })

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
  source: Object.keys(packageData.project.source).sort(),
  preview: Object.keys(packageData.project.preview).sort(),
})

const expectCleanPackage = (
  packageData: ArcadeProjectPackage,
  text: string,
  forbiddenValues: string[]
) => {
  expect(packageData.format).toBe(ARCADE_PROJECT_PACKAGE_FORMAT)
  expect(packageData.formatVersion).toBe(ARCADE_PROJECT_PACKAGE_FORMAT_VERSION)
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

const createProjectPackageFileForCode = (name: string, jsxCode: string): File => {
  const project = createDefaultProject()
  project.name = name
  project.source = createSinglePageProjectSource(jsxCode, getActiveSource(project).hooks)

  return createProjectPackageFile(
    JSON.stringify(createArcadeProjectPackage(project))
  )
}

const createShareTokenForCode = async (jsxCode: string): Promise<string> => {
  const project = createDefaultProject()
  project.source = createSinglePageProjectSource(jsxCode, getActiveSource(project).hooks)

  return createShareToken(await encodeSharePayload(createShareSnapshot(project)))
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

type AgentTransportClient = {
  readonly sessionId: string
  readonly status: 'active'
  readonly permissions: AgentSessionReadState['permissions']
  readonly readScope: 'arcade-session'
  readonly commandNames: AgentSessionReadState['commandNames']
  getAgentInstructions: () => AgentBridgeCommandResult<AgentInstructionsPayload>
  getProject: () => AgentBridgeCommandResult<AgentProjectReadState>
  getPreviewContext: () => AgentBridgeCommandResult<AgentPreviewReadState>
  getDiagnostics: () => AgentBridgeCommandResult<PreviewDiagnostics>
  getPreviewEvidence: () => Promise<AgentBridgeCommandResult<PreviewEvidence>>
  getSessionState: () => AgentBridgeCommandResult<AgentSessionReadState>
  applyAgentChange: (request: unknown) => AgentBridgeCommandResult<AgentChangeResult>
  createPage: (request?: unknown) => AgentBridgeCommandResult<{ pageId: string }>
  renamePage: (request: unknown) => AgentBridgeCommandResult<{ pageId: string }>
  deletePage: (request: unknown) => AgentBridgeCommandResult<{ pageId: string }>
  setStartPage: (request: unknown) => AgentBridgeCommandResult<{ pageId: string }>
  selectActivePage: (request: unknown) => AgentBridgeCommandResult<{ pageId: string }>
}

const createAgentTransportClient = (
  desktopTransport: ReturnType<typeof setupDesktopTransportPreload>
): AgentTransportClient => {
  const normalizeResponse = <TData,>(
    method: AgentBridgeCommandName,
    response: DesktopAgentTransportRouteResponse
  ): AgentBridgeCommandResult<TData> => {
    if ('error' in response) {
      return {
        ok: false,
        command: method,
        error: response.error.data.bridgeError ?? {
          code: response.error.data.code as AgentBridgeErrorCode,
          message: response.error.message,
        },
      }
    }

    return response.result as AgentBridgeCommandResult<TData>
  }

  const route = <TData,>(
    method: AgentBridgeCommandName,
    params?: unknown
  ): AgentBridgeCommandResult<TData> => {
    const response = desktopTransport.route({
      id: `${method}-test`,
      method,
      params,
    })

    return normalizeResponse<TData>(method, response)
  }

  const routeAsync = async <TData,>(
    method: AgentBridgeCommandName,
    params?: unknown
  ): Promise<AgentBridgeCommandResult<TData>> => {
    const response = await desktopTransport.routeAsync({
      id: `${method}-test`,
      method,
      params,
    })

    return normalizeResponse<TData>(method, response)
  }

  const readSession = () => {
    const session = expectBridgeSuccess(route<AgentSessionReadState>('getSessionState'))
    return session
  }

  return {
    get sessionId() {
      return readSession().sessionId
    },
    status: 'active',
    get permissions() {
      return readSession().permissions
    },
    readScope: 'arcade-session',
    get commandNames() {
      return readSession().commandNames
    },
    getAgentInstructions: () => route<AgentInstructionsPayload>('getAgentInstructions'),
    getProject: () => route<AgentProjectReadState>('getProject'),
    getPreviewContext: () => route<AgentPreviewReadState>('getPreviewContext'),
    getDiagnostics: () => route<PreviewDiagnostics>('getDiagnostics'),
    getPreviewEvidence: () => routeAsync<PreviewEvidence>('getPreviewEvidence'),
    getSessionState: () => route<AgentSessionReadState>('getSessionState'),
    applyAgentChange: (request) => route<AgentChangeResult>('applyAgentChange', request),
    createPage: (request) => route<{ pageId: string }>('createPage', request),
    renamePage: (request) => route<{ pageId: string }>('renamePage', request),
    deletePage: (request) => route<{ pageId: string }>('deletePage', request),
    setStartPage: (request) => route<{ pageId: string }>('setStartPage', request),
    selectActivePage: (request) => route<{ pageId: string }>('selectActivePage', request),
  }
}

const captureAgentState = (bridge: AgentTransportClient) => {
  const project = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
  const preview = expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))
  const session = expectBridgeSuccess(callBridgeCommand(() => bridge.getSessionState()))

  return {
    project,
    preview,
    permissions: session.permissions,
    statusText: screen.getByRole('status').textContent,
  }
}

const expectProjectReplacementRevokedAgentAccess = async (
  desktopTransport: ReturnType<typeof setupDesktopTransportPreload>,
  stopCallIndex: number
) => {
  await waitFor(() =>
    expect(desktopTransport.api.stopAgentTransportSession).toHaveBeenNthCalledWith(
      stopCallIndex,
      desktopTransport.endpoint.sessionId,
      'project-replaced'
    )
  )
  expectLegacyAgentBridgeAbsent()
  expect(desktopTransport.hasRequestHandler()).toBe(false)

  await ensureAgentMenuOpen()
  expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
  expect(screen.queryByRole('alert')).toBeNull()
  await closeAgentMenuIfOpen()
}

const startAgentAccess = async () => {
  await ensureAgentMenuOpen()
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))

  await waitFor(() => expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE))
  expectLegacyAgentBridgeAbsent()
  if (!currentDesktopTransport) {
    throw new Error('Expected Desktop transport preload to be installed before Agent access starts.')
  }
  await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(true))

  return createAgentTransportClient(currentDesktopTransport)
}

const selectSettingsMenuItem = async (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: /settings/i }))
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}

const ensureAgentMenuOpen = async () => {
  if (queryAgentAccessToggle()) {
    return
  }

  const button = await findAgentAccessButton()
  fireEvent.click(button)
  if (!queryAgentAccessToggle()) {
    fireEvent.click(button)
  }

  expect(await screen.findByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME })).toBeTruthy()
}

const closeAgentMenuIfOpen = async () => {
  if (queryAgentAccessToggle()) {
    fireEvent.click(await findAgentAccessButton())
  }
}

let currentDesktopTransport: ReturnType<typeof setupDesktopTransportPreload> | null = null

function setupDesktopTransportPreload(
  sessionId: ReturnType<Crypto['randomUUID']> = '11111111-1111-4111-8111-111111111111'
) {
  let transportRequestHandler: DesktopAgentTransportRequestHandler | null = null
  const endpoint = {
    endpoint: 'http://127.0.0.1:48123',
    sessionId,
    authorizationHeader: 'Bearer copied-agent-secret',
  }
  const api: DesktopArcadePreloadApi & {
    getShellCapabilities: ReturnType<typeof vi.fn>
    startAgentTransportSession: ReturnType<typeof vi.fn>
    stopAgentTransportSession: ReturnType<typeof vi.fn>
    setAgentTransportRequestHandler: ReturnType<typeof vi.fn>
  } = {
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

  const fixture = {
    api,
    endpoint,
    hasRequestHandler: () => transportRequestHandler !== null,
    route: (
      request: Omit<DesktopAgentTransportRouteRequest, 'sessionId'> & {
        sessionId?: string
      }
    ): DesktopAgentTransportRouteResponse => {
      if (!transportRequestHandler) {
        throw new Error('Expected Desktop transport request handler to be registered.')
      }
      const handler = transportRequestHandler

      let response: DesktopAgentTransportRouteResponse | Promise<DesktopAgentTransportRouteResponse> | undefined
      act(() => {
        response = handler({
          ...request,
          sessionId: request.sessionId ?? sessionId,
        })
      })

      if (!response) {
        throw new Error('Expected Desktop transport request handler to return a response.')
      }
      if (isPromiseLike(response)) {
        throw new Error('Expected Desktop transport request handler to return synchronously.')
      }

      return response
    },
    routeAsync: async (
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

  currentDesktopTransport = fixture
  return fixture
}

const isPromiseLike = <TValue,>(value: TValue | Promise<TValue>): value is Promise<TValue> =>
  typeof (value as Promise<TValue>).then === 'function'

const getPreviewIframe = () => {
  const iframe = screen.getByTestId('preview-iframe') as HTMLIFrameElement
  if (!iframe.contentWindow) {
    throw new Error('Expected preview iframe to have a contentWindow.')
  }

  return iframe
}

const dispatchSandboxMessage = (data: unknown) => {
  const iframe = getPreviewIframe()

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
  registerPreviewEvidenceRequestHandler(iframe, () =>
    Promise.resolve(collectPreviewEvidenceFromFrame(iframe))
  )

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
    window.history.replaceState({}, '', '/')
    currentDesktopTransport = null
    clearLegacyAgentBridgeGlobal()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  afterEach(() => {
    vi.restoreAllMocks()
    currentDesktopTransport = null
    clearLegacyAgentBridgeGlobal()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  it('keeps Web Arcade Share URL available and Agent access absent', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    const importButton = screen.getByRole('button', { name: /^import$/i })
    const importInput = screen.getByLabelText(
      /import \.akselarcade arcade project package/i
    ) as HTMLInputElement
    const shareButton = screen.getByLabelText(/share project/i)
    const settingsButton = screen.getByRole('button', { name: /settings/i })

    expect(importInput.accept).toBe(ARCADE_PROJECT_IMPORT_ACCEPT)
    expect(screen.queryByRole('button', { name: AGENT_ACCESS_BUTTON_NAME })).toBeNull()
    expectLegacyAgentBridgeAbsent()
    expect(currentDesktopTransport).toBeNull()
    expect(
      importButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      shareButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(shareButton)

    expect(await screen.findByText(/Share URL length/i)).toBeTruthy()
    expect(screen.getByText(/Strategy:/i)).toBeTruthy()
    expectLegacyAgentBridgeAbsent()
  })

  it('keeps Reset editor available without exposing browser-wide storage clearing', async () => {
    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    expect(await screen.findByRole('menuitem', { name: /Reset editor/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Clear storage & reload/i })).toBeNull()
  })

  it('confirms import with an Aksel Dialog and custom action label', async () => {
    const nativeConfirmSpy = vi.spyOn(window, 'confirm')
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    renderHeader({ shellCapabilities: WEB_ARCADE_CAPABILITIES })

    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }))

    expect(nativeConfirmSpy).not.toHaveBeenCalled()
    expect(inputClickSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: /bekreft import/i })).toBeTruthy()
    expect(
      screen.getByText(
        'Importing this Arcade project package replaces only this Web Arcade working copy. Continue?'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Importer' }))

    expect(inputClickSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        screen.queryByText(
          'Importing this Arcade project package replaces only this Web Arcade working copy. Continue?'
        )
      ).toBeNull()
    })
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

  it('keeps the legacy Agent browser bridge absent while Desktop transport is temporary', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    )
    const { unmount } = renderHeader()

    expectLegacyAgentBridgeAbsent()

    fireEvent.click(await findAgentAccessButton())

    expect(await screen.findByText(AGENT_ACCESS_BUTTON_NAME)).toBeTruthy()
    expect(
      screen.queryByText(/command will give the agent access|kommandoen gir agenten tilgang/i)
    ).toBeNull()
    expect(
      screen.queryByText(/click the button below to copy a command|del bare med agenten du vil gi tilgang/i)
    ).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /copy command|kopier agentkommando/i })).toBeNull()
    const inactiveStatus = screen.getByRole('status').textContent ?? ''
    expect(inactiveStatus).toBe(AGENT_STATUS_INACTIVE)
    expect(inactiveStatus).not.toMatch(/connected|disconnected/i)

    const accessItem = screen.getByRole('menuitemcheckbox', {
      name: AGENT_ACCESS_TOGGLE_NAME,
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

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE))
    expect(
      screen.getByText(/command will give the agent access|kommandoen gir agenten tilgang/i)
    ).toBeTruthy()
    expect(
      screen.getByText(/click the button below to copy a command|del bare med agenten du vil gi tilgang/i)
    ).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /copy command|kopier agentkommando/i })).toBeTruthy()
    expectLegacyAgentBridgeAbsent()
    await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(true))
    if (!currentDesktopTransport) {
      throw new Error('Expected Desktop transport fixture to be active.')
    }
    const activeBridge = createAgentTransportClient(currentDesktopTransport)
    expect(expectBridgeSuccess(callBridgeCommand(() => activeBridge.getSessionState())).version).toBe(
      AGENT_BRIDGE_PROTOCOL_VERSION
    )
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
        'applyAgentChange',
      ],
    })
    expect(activeBridge?.getAgentInstructions).toEqual(expect.any(Function))
    expect(activeBridge?.getProject).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewContext).toEqual(expect.any(Function))
    expect(activeBridge?.getDiagnostics).toEqual(expect.any(Function))
    expect(activeBridge?.getPreviewEvidence).toEqual(expect.any(Function))
    expect(activeBridge?.getSessionState).toEqual(expect.any(Function))
    expect(activeBridge?.applyAgentChange).toEqual(expect.any(Function))
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

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))

    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
    expectLegacyAgentBridgeAbsent()
    await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(false))

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))
    await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(true))
    expectLegacyAgentBridgeAbsent()

    unmount()
    expectLegacyAgentBridgeAbsent()

    renderHeader()
    expectLegacyAgentBridgeAbsent()

    fireEvent.click(await findAgentAccessButton())
    expect(
      (
        await screen.findByRole('menuitemcheckbox', {
          name: AGENT_ACCESS_TOGGLE_NAME,
        })
      ).getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
  })

  it('revokes active Agent access before explicit project replacements are exposed', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderHeader()

    await startAgentAccess()
    await selectSettingsMenuItem(/Reset editor/i)
    await expectProjectReplacementRevokedAgentAccess(desktopTransport, 1)

    await startAgentAccess()
    await selectSettingsMenuItem(/Oppsummeringsside for søknadsdialoger/i)
    await expectProjectReplacementRevokedAgentAccess(desktopTransport, 2)

    await startAgentAccess()
    await selectSettingsMenuItem(/Hooks demo/i)
    await expectProjectReplacementRevokedAgentAccess(desktopTransport, 3)

    await startAgentAccess()
    fireEvent.change(screen.getByLabelText(/import \.akselarcade arcade project package/i), {
      target: {
        files: [
          createProjectPackageFileForCode(
            'Imported Replacement Project',
            'export default function App() { return <Heading>Imported replacement</Heading> }'
          ),
        ],
      },
    })
    await waitFor(() => expect(screen.getByText('Imported Replacement Project')).toBeTruthy())
    await expectProjectReplacementRevokedAgentAccess(desktopTransport, 4)
  })

  it('revokes active Agent access when loading a shared project snapshot', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    const token = await createShareTokenForCode(
      'export default function App() { return <Heading>Shared replacement</Heading> }'
    )
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}`)
    renderHeader()

    const loadSharedProject = await screen.findByRole('button', { name: /load shared project/i })
    await startAgentAccess()

    fireEvent.click(loadSharedProject)

    await waitFor(() =>
      expect(screen.getByTestId('project-jsx-code').textContent).toContain('Shared replacement')
    )
    await expectProjectReplacementRevokedAgentAccess(desktopTransport, 1)
  })

  it('keeps Agent access active for normal edits, preview changes, layout changes, and Agent changes', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    renderHeader()

    const bridge = await startAgentAccess()

    fireEvent.click(screen.getByRole('button', { name: /update agent read fixture/i }))
    await waitFor(() =>
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).name).toBe(
        'Updated Agent Project'
      )
    )

    await selectSettingsMenuItem(/Swap panel order/i)

    const nextJsx =
      'export default function App() { return <Heading>Agent change stays active</Heading> }'
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: 'Normal Agent-applied change',
          target: DEFAULT_AGENT_SOURCE_TARGET,
          jsxCode: nextJsx,
          viewportSize: 'XS',
          theme: 'light',
          name: 'Agent Change Active Project',
        })
      )
    )

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
        name: 'Agent Change Active Project',
        jsxCode: nextJsx,
      })
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getPreviewContext()))).toMatchObject(
        {
          theme: 'light',
          viewportSize: 'XS',
        }
      )
    })

    expect(desktopTransport.api.stopAgentTransportSession).not.toHaveBeenCalled()
    expect(desktopTransport.hasRequestHandler()).toBe(true)
    expectLegacyAgentBridgeAbsent()
    await ensureAgentMenuOpen()
    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)
    await closeAgentMenuIfOpen()
  })

  it('hides the Agent pairing handoff before Agent access is active', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderHeader()

    fireEvent.click(await findAgentAccessButton())
    expect(await screen.findByText(AGENT_ACCESS_BUTTON_NAME)).toBeTruthy()

    expect(
      screen.queryByText(/command will give the agent access|kommandoen gir agenten tilgang/i)
    ).toBeNull()
    expect(
      screen.queryByText(/click the button below to copy a command|del bare med agenten du vil gi tilgang/i)
    ).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /copy command|kopier agentkommando/i })).toBeNull()
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
    const desktopTransport = setupDesktopTransportPreload(sessionId)
    const { endpoint } = desktopTransport

    renderHeader()

    await startAgentAccess()
    fireEvent.click(screen.getByRole('menuitem', { name: /copy command|kopier agentkommando/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    const instructions = writeText.mock.calls[0]?.[0] ?? ''
    expect(desktopTransport.api.startAgentTransportSession).toHaveBeenCalledTimes(1)
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
    expect(instructions).not.toContain('applyAgentChange')
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

    expect(
      desktopTransport.route({
        id: 'instructions-1',
        method: 'getAgentInstructions',
      })
    ).toMatchObject({
      jsonrpc: '2.0',
      id: 'instructions-1',
      result: {
        ok: true,
        command: 'getAgentInstructions',
        data: {
          version: AGENT_BRIDGE_PROTOCOL_VERSION,
          sessionId: desktopTransport.endpoint.sessionId,
          endpoint: desktopTransport.endpoint.endpoint,
          authorizationHeader: desktopTransport.endpoint.authorizationHeader,
          readScope: 'arcade-session',
        },
      },
    })

    expect(
      desktopTransport.route({
        id: 'session-state-1',
        method: 'getSessionState',
      })
    ).toMatchObject({
      jsonrpc: '2.0',
      id: 'session-state-1',
      result: {
        ok: true,
        command: 'getSessionState',
        data: {
          version: AGENT_BRIDGE_PROTOCOL_VERSION,
          commandNames: [
            'getAgentInstructions',
            'getProject',
            'getPreviewContext',
            'getDiagnostics',
            'getPreviewEvidence',
            'getSessionState',
            'applyAgentChange',
          ],
        },
      },
    })

    const nextJsx = 'export default function App() { return <Heading>Transport update</Heading> }'
    const acceptedResponse = await desktopTransport.route({
      id: 'change-1',
      method: 'applyAgentChange',
      params: {
        summary: 'Desktop transport update',
        target: DEFAULT_AGENT_SOURCE_TARGET,
        jsxCode: nextJsx,
        viewportSize: 'LG',
        theme: 'light',
        name: 'Transport Agent Project',
      },
    })

    expect(acceptedResponse).toEqual({
      jsonrpc: '2.0',
      id: 'change-1',
      result: {
        ok: true,
        command: 'applyAgentChange',
        data: {
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
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()

    const beforeInvalid = captureAgentState(bridge)
    const invalidResponse = await desktopTransport.route({
      id: 'invalid-1',
      method: 'applyAgentChange',
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
          command: 'applyAgentChange',
          bridgeError: {
            code: 'invalid-request',
          },
        },
      },
    })
    expect(captureAgentState(bridge)).toEqual(beforeInvalid)

    expect(
      desktopTransport.route({
        id: 'shell-1',
        method: 'openShell',
      })
    ).toMatchObject({
      error: {
        code: -32601,
        data: {
          code: 'unsupported-method',
        },
      },
    })

    expect(
      desktopTransport.route({
        id: 'stale-command-1',
        method: 'applySourceChange',
        params: {
          summary: 'Stale command',
          jsxCode: 'export default function App() { return <Heading>Stale command</Heading> }',
        },
      })
    ).toMatchObject({
      error: {
        code: -32601,
        message:
          'Unsupported Agent transport method "applySourceChange". Supported methods: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applyAgentChange.',
        data: {
          code: 'unsupported-method',
        },
      },
    })
    expect(captureAgentState(bridge)).toEqual(beforeInvalid)

    expect(
      desktopTransport.route({
        id: 'stale-1',
        method: 'applyAgentChange',
        params: {
          summary: 'Stale session',
          jsxCode: 'export default function App() { return <Heading>Stale</Heading> }',
        },
        sessionId: 'stale-session',
      })
    ).toMatchObject({
      error: {
        code: -32001,
        data: {
          code: 'session-mismatch',
        },
      },
    })
  })

  it('applies Desktop transport changes without exposing rollback controls', async () => {
    const desktopTransport = setupDesktopTransportPreload()
    renderHeader()

    const bridge = await startAgentAccess()
    await waitFor(() =>
      expect(desktopTransport.api.setAgentTransportRequestHandler).toHaveBeenCalledWith(
        expect.any(Function)
      )
    )

    const nextJsx =
      'export default function App() { return <Heading>Immediate transport update</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "desktop-change"'
    const acceptedResponse = await desktopTransport.route({
      id: 'desktop-change-1',
      method: 'applyAgentChange',
      params: {
        summary: 'Desktop immediate update',
        target: DEFAULT_AGENT_SOURCE_TARGET,
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'XS',
        theme: 'light',
        name: 'Desktop Immediate Project',
      },
    })

    expect(acceptedResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 'desktop-change-1',
      result: {
        ok: true,
        command: 'applyAgentChange',
        data: {
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
        name: 'Desktop Immediate Project',
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
      expect(updatedPreview).toEqual({
        theme: 'light',
        viewportSize: 'XS',
      })
    })

    const changed = captureAgentState(bridge)
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()

    for (const method of ['restoreCheckpoint', 'deleteCheckpoint']) {
      expect(
        desktopTransport.route({
          id: `${method}-1`,
          method,
          params: {},
        })
      ).toMatchObject({
        error: {
          code: -32601,
          data: {
            code: 'unsupported-method',
          },
        },
      })
    }
    expect(captureAgentState(bridge)).toEqual(changed)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))

    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('keeps Desktop packages clean after transport reads, changes, stop, and import', async () => {
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
      const importInput = screen.getByLabelText(
        /import \.akselarcade arcade project package/i
      ) as HTMLInputElement

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
      expect(
        desktopTransport.route({
          id: 'read-before-package-export',
          method: 'getProject',
        })
      ).toMatchObject({
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

      const changeSummary = 'Confidential package change summary'
      const nextJsx =
        'export default function App() { return <Heading>Desktop package export</Heading> }'
      const nextHooks = 'export const useAgentFixture = () => "package-export"'
      const acceptedResponse = await desktopTransport.route({
        id: 'package-change-1',
        method: 'applyAgentChange',
        params: {
          summary: changeSummary,
          target: DEFAULT_AGENT_SOURCE_TARGET,
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
          command: 'applyAgentChange',
          data: {
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
        changeSummary,
        '__AKSEL_ARCADE_AGENT_BRIDGE__',
      ]
      const activePackage = await exportCurrentProjectPackage(capturedBlobs)

      expect(getPackagePortableShape(activePackage.packageData)).toEqual(normalPackageShape)
      expect(activePackage.packageData.project).toMatchObject({
        name: 'Transport Package Project',
        source: {
          jsx: nextJsx,
          hooks: nextHooks,
        },
        preview: {
          viewport: 'XS',
        },
      })
      expectCleanPackage(activePackage.packageData, activePackage.text, forbiddenPackageValues)

      expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()

      let accessToggle = screen.queryByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME })
      if (!accessToggle) {
        fireEvent.click(await findAgentAccessButton())
        accessToggle = screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME })
      }
      fireEvent.click(accessToggle)
      expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
      expectLegacyAgentBridgeAbsent()

      const stoppedPackage = await exportCurrentProjectPackage(capturedBlobs)

      expect(getPackagePortableShape(stoppedPackage.packageData)).toEqual(normalPackageShape)
      expect(stoppedPackage.packageData.project).toMatchObject({
        name: 'Transport Package Project',
        source: {
          jsx: nextJsx,
          hooks: nextHooks,
        },
        preview: {
          viewport: 'XS',
        },
      })
      expectCleanPackage(stoppedPackage.packageData, stoppedPackage.text, forbiddenPackageValues)

      unmount()
      expectLegacyAgentBridgeAbsent()
      renderHeader()

      fireEvent.change(screen.getByLabelText(/import \.akselarcade arcade project package/i), {
        target: {
          files: [createProjectPackageFile(activePackage.text)],
        },
      })

      await waitFor(() => expect(screen.getByText('Transport Package Project')).toBeTruthy())
      expectLegacyAgentBridgeAbsent()

      fireEvent.click(await findAgentAccessButton())
      expect(await screen.findByText(AGENT_ACCESS_BUTTON_NAME)).toBeTruthy()
      expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)
      expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
    } finally {
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
    }
  })

  it('shows copy failure feedback and lets the user retry without revealing secrets', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionId = '11111111-1111-4111-8111-111111111111'
    const desktopTransport = setupDesktopTransportPreload(sessionId)
    const { endpoint } = desktopTransport
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
    renderHeader()

    await startAgentAccess()
    fireEvent.click(screen.getByRole('menuitem', { name: /copy command|kopier agentkommando/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /could not copy command|kunne ikke kopiere/i
    )
    const serializedLog = JSON.stringify(consoleError.mock.calls)
    expect(serializedLog).not.toContain(command)
    expect(serializedLog).not.toContain(endpoint.endpoint)
    expect(serializedLog).not.toContain(endpoint.authorizationHeader)
    expect(serializedLog).not.toContain('copied-agent-secret')
    expect(serializedLog).not.toContain('getAgentInstructions')
    expect(screen.queryByText(endpoint.endpoint)).toBeNull()
    expect(screen.queryByText(endpoint.authorizationHeader)).toBeNull()
    expect(screen.queryByText(/curl -sS/i)).toBeNull()
    expect(screen.queryByText(/getAgentInstructions/i)).toBeNull()
    expect(screen.queryByText(/Agent operating instructions/i)).toBeNull()
    expect(screen.queryByText(/transport/i)).toBeNull()
    expect(screen.queryByText(/local server/i)).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /try again|prøv igjen/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/command copied|agentkommando kopiert/i)).toBeTruthy()
    expect(screen.queryByText(endpoint.endpoint)).toBeNull()
    expect(screen.queryByText(endpoint.authorizationHeader)).toBeNull()
    expect(screen.queryByText(/getAgentInstructions/i)).toBeNull()
    expect(screen.queryByText(/Agent operating instructions/i)).toBeNull()
  })

  it('returns Arcade-scoped read state with simplified Agent status', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    const projectResult = callBridgeCommand(() => bridge.getProject())
    expect(projectResult).toMatchObject({
      ok: true,
      command: 'getProject',
    })
    const projectData = expectBridgeSuccess(projectResult)
    expect(projectData).toMatchObject({
      name: expect.any(String),
      pageMode: 'single-page',
      jsxCode: expect.any(String),
      hooksCode: expect.any(String),
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [
        {
          id: 'page01',
          name: 'Page 1',
          jsxCode: expect.any(String),
          hooksCode: expect.any(String),
        },
      ],
      startPageId: 'page01',
      activePageId: 'page01',
    })
    expect(projectData).not.toHaveProperty('id')

    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)

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
          'applyAgentChange',
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

  it('returns preview diagnostics, keeps simplified status, and unregisters the Desktop transport handler on stop', async () => {
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

    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))

    await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(false))
  })

  it('returns sanitized Preview evidence from only the sandboxed frame', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    const { button } = setupPreviewEvidenceFrame()
    const firstResult = await bridge.getPreviewEvidence()

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

    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)

    expect(expectBridgeSuccess(await bridge.getPreviewEvidence())).toEqual(evidence)
  })

  it('unregisters the Desktop transport handler for Preview evidence after Agent access stops', async () => {
    renderHeader({ includePreview: true })

    const bridge = await startAgentAccess()
    setupPreviewEvidenceFrame()

    expectBridgeSuccess(await bridge.getPreviewEvidence())
    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: AGENT_ACCESS_TOGGLE_NAME }))
    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_INACTIVE)

    await waitFor(() => expect(currentDesktopTransport?.hasRequestHandler()).toBe(false))
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
    expectLegacyAgentBridgeAbsent()

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

  it('keeps the Agent bridge single-page until the human enables multi-page authoring', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const project = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
    const instructions = expectBridgeSuccess(callBridgeCommand(() => bridge.getAgentInstructions()))

    expect(project).toMatchObject({
      pageMode: 'single-page',
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [
        {
          id: 'page01',
          name: 'Page 1',
        },
      ],
      startPageId: 'page01',
      activePageId: 'page01',
    })
    expect(bridge.commandNames).not.toContain('createPage')
    expect(instructions.commandNames).not.toContain('createPage')
    expect(instructions.instructionsMarkdown).toMatch(
      /ask the human to enable experimental multi-page authoring/i
    )

    const lifecycleError = expectBridgeFailure(
      callBridgeCommand(() => bridge.createPage({})),
      'unsupported-command'
    )
    expect(lifecycleError.message).toMatch(/enable experimental multi-page authoring/i)

    const globalConfigError = expectBridgeFailure(
      callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: 'Try hidden global config edit',
          target: { type: 'global-config' },
          jsxCode: '<Box>Hidden</Box>',
        })
      ),
      'invalid-request'
    )
    expect(globalConfigError.message).toMatch(/Global config edits require experimental multi-page/i)
  })

  it('exposes pages-aware bridge commands and targeted source edits when multi-page is enabled', async () => {
    renderHeader()

    await selectSettingsMenuItem(/enable experimental multi-page authoring/i)
    const bridge = await startAgentAccess()
    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).pageMode).toBe(
        'multi-page'
      )
    })

    expect(bridge.commandNames).toEqual([
      'getAgentInstructions',
      'getProject',
      'getPreviewContext',
      'getDiagnostics',
      'getPreviewEvidence',
      'getSessionState',
      'applyAgentChange',
      'createPage',
      'renamePage',
      'deletePage',
      'setStartPage',
      'selectActivePage',
    ])

    const instructions = expectBridgeSuccess(callBridgeCommand(() => bridge.getAgentInstructions()))
    expect(instructions.commandNames).toEqual(bridge.commandNames)
    expect(instructions.instructionsMarkdown).toMatch(
      /createPage, renamePage, deletePage, setStartPage, and selectActivePage/i
    )
    expect(instructions.instructionsMarkdown).toContain(
      'applyAgentChange({ summary, target, jsxCode?, hooksCode?, viewportSize?, theme?, name? })'
    )

    expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
      pageMode: 'multi-page',
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [
        {
          id: 'page01',
          name: 'Page 1',
        },
      ],
      startPageId: 'page01',
      activePageId: 'page01',
    })

    expectBridgeSuccess(callBridgeCommand(() => bridge.createPage({})))
    expectBridgeSuccess(
      callBridgeCommand(() => bridge.renamePage({ pageId: 'page02', name: 'Details' }))
    )
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: 'Update shared config',
          target: { type: 'global-config' },
          hooksCode: 'export const useSharedValue = () => "shared"',
        })
      )
    )
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: 'Update page 2 source',
          target: { type: 'page', pageId: 'page02' },
          jsxCode: 'export default function App() { return <Heading>Details</Heading> }',
          hooksCode: 'export const useDetails = () => "details"',
        })
      )
    )
    expectBridgeSuccess(callBridgeCommand(() => bridge.setStartPage({ pageId: 'page02' })))
    expectBridgeSuccess(callBridgeCommand(() => bridge.selectActivePage({ pageId: 'page02' })))

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
        pageMode: 'multi-page',
        startPageId: 'page02',
        activePageId: 'page02',
        jsxCode: 'export default function App() { return <Heading>Details</Heading> }',
        hooksCode: 'export const useDetails = () => "details"',
        globalConfig: {
          jsxCode: '',
          hooksCode: 'export const useSharedValue = () => "shared"',
        },
        pages: expect.arrayContaining([
          expect.objectContaining({
            id: 'page02',
            name: 'Details',
            jsxCode: 'export default function App() { return <Heading>Details</Heading> }',
            hooksCode: 'export const useDetails = () => "details"',
          }),
        ]),
      })
      expect(screen.getByTestId('project-jsx-code').textContent).toContain('Details')
    })

    expectBridgeSuccess(callBridgeCommand(() => bridge.deletePage({ pageId: 'page02' })))

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))).toMatchObject({
        pageMode: 'multi-page',
        startPageId: 'page01',
        activePageId: 'page01',
        pages: [
          expect.objectContaining({
            id: 'page01',
            name: 'Page 1',
          }),
        ],
      })
      expect(screen.getByTestId('project-jsx-code').textContent).not.toContain('Details')
    })
  })

  it('applies source replacements as normal project edits without rollback state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const nextJsx = 'export default function App() { return <Heading>Agent update</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "changed"'

    const changeResult = callBridgeCommand(() =>
      bridge.applyAgentChange({
        summary: 'Replace source for demo',
        target: DEFAULT_AGENT_SOURCE_TARGET,
        jsxCode: nextJsx,
        hooksCode: nextHooks,
      })
    )

    const changeData = expectBridgeSuccess(changeResult)
    expect(changeResult).toMatchObject({
      ok: true,
      command: 'applyAgentChange',
    })
    expect(changeData).toEqual({
      changedFields: ['jsxCode', 'hooksCode'],
    })
    expect(screen.getByRole('status').textContent).toBe(AGENT_STATUS_ACTIVE)

    await waitFor(() => {
      const updatedProject = expectBridgeSuccess(callBridgeCommand(() => bridge.getProject()))
      expect(updatedProject.jsxCode).toBe(nextJsx)
      expect(updatedProject.hooksCode).toBe(nextHooks)
    })
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('applies rapid sequential changes against the latest accepted Agent state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const firstJsx = 'export default function App() { return <Heading>First rapid</Heading> }'
    const secondJsx = 'export default function App() { return <Heading>Second rapid</Heading> }'
    const results: AgentBridgeCommandResult<unknown>[] = []

    act(() => {
      results.push(
        bridge.applyAgentChange({
          summary: 'First rapid change',
          target: DEFAULT_AGENT_SOURCE_TARGET,
          jsxCode: firstJsx,
        })
      )
      results.push(
        bridge.applyAgentChange({
          summary: 'Second rapid change',
          target: DEFAULT_AGENT_SOURCE_TARGET,
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
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('applies preview setting replacements with default Agent permissions', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    const result = callBridgeCommand(() =>
      bridge.applyAgentChange({
        summary: 'Switch preview context',
        viewportSize: 'XS',
        theme: 'light',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
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
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('applies project metadata replacements with default Agent permissions', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    expect(bridge.permissions.projectMetadata).toBe(true)

    const acceptedResult = callBridgeCommand(() =>
      bridge.applyAgentChange({
        summary: 'Rename project',
        name: 'Agent Named Project',
      })
    )

    const changeData = expectBridgeSuccess(acceptedResult)
    expect(changeData).toEqual({
      changedFields: ['name'],
    })
    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).name).toBe(
        'Agent Named Project'
      )
    })
  })

  it('applies combined source, preview, and metadata replacements atomically', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const nextJsx = 'export default function App() { return <Heading>Combined</Heading> }'
    const nextHooks = 'export const useAgentFixture = () => "combined"'

    const result = callBridgeCommand(() =>
      bridge.applyAgentChange({
        summary: 'Combined Agent update',
        target: DEFAULT_AGENT_SOURCE_TARGET,
        jsxCode: nextJsx,
        hooksCode: nextHooks,
        viewportSize: 'LG',
        theme: 'light',
        name: 'Combined Agent Project',
      })
    )

    const changeData = expectBridgeSuccess(result)
    expect(changeData).toEqual({
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
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('does not accumulate Agent rollback entries for accepted source changes', async () => {
    renderHeader()

    const bridge = await startAgentAccess()

    for (let index = 1; index <= 11; index += 1) {
      const result = callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: `change ${index}`,
          target: DEFAULT_AGENT_SOURCE_TARGET,
          jsxCode: `export default function App() { return <Heading>Change ${index}</Heading> }`,
        })
      )
      expectBridgeSuccess(result)
    }

    await waitFor(() => {
      expect(expectBridgeSuccess(callBridgeCommand(() => bridge.getProject())).jsxCode).toContain(
        'Change 11'
      )
    })
    expect(screen.queryByRole('menuitem', { name: /gjenopprett/i })).toBeNull()
  })

  it('rejects malformed and unsupported Agent change requests without mutating Agent state', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    expectBridgeSuccess(
      callBridgeCommand(() =>
        bridge.applyAgentChange({
          summary: 'Seed change',
          target: DEFAULT_AGENT_SOURCE_TARGET,
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
          summary: 'Missing target',
          jsxCode: 'export default function App() { return <Heading>Missing target</Heading> }',
        },
        code: 'invalid-request',
        message: /requires target/i,
      },
      {
        request: {
          summary: 'Target only',
          target: DEFAULT_AGENT_SOURCE_TARGET,
        },
        code: 'invalid-request',
        message: /target is only valid/i,
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
          target: DEFAULT_AGENT_SOURCE_TARGET,
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          notes: 'Not part of the Agent change contract',
        },
        code: 'unsupported-field',
        message: /Unsupported Agent change field: notes/i,
      },
      {
        request: {
          summary: 'Invalid viewport',
          target: DEFAULT_AGENT_SOURCE_TARGET,
          jsxCode: 'export default function App() { return <Heading>Changed</Heading> }',
          viewportSize: 'XXL',
        },
        code: 'invalid-request',
        message: /viewportSize/i,
      },
      {
        request: {
          summary: 'Invalid theme',
          target: DEFAULT_AGENT_SOURCE_TARGET,
          hooksCode: 'export const useAgentFixture = () => "theme"',
          theme: 'system',
        },
        code: 'invalid-request',
        message: /theme/i,
      },
      {
        request: {
          summary: 'Invalid target shape',
          target: { type: 'page' },
          jsxCode: 'export default function App() { return <Heading>Target</Heading> }',
        },
        code: 'invalid-request',
        message: /valid pageId/i,
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
      const result = callBridgeCommand(() => bridge.applyAgentChange(request))
      const error = expectBridgeFailure(result, code)
      expect(error.message).toMatch(message)
      expect(screen.getByRole('status').textContent).toBe(before.statusText)
      expect(captureAgentState(bridge)).toEqual(before)
    }
  })

  it('rejects oversized source changes before mutation', async () => {
    renderHeader()

    const bridge = await startAgentAccess()
    const before = captureAgentState(bridge)
    const oversizedJsx = `export default function App() {
  return <Heading>${'x'.repeat(5 * 1024 * 1024)}</Heading>
}`

    const result = callBridgeCommand(() =>
      bridge.applyAgentChange({
        summary: 'Oversized source replacement',
        target: DEFAULT_AGENT_SOURCE_TARGET,
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
      bridge.applyAgentChange({
        summary: 'Introduce invalid JSX',
        target: DEFAULT_AGENT_SOURCE_TARGET,
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

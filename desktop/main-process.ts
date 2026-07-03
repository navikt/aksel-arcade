import { app, BrowserWindow, ipcMain, net, protocol, type IpcMainEvent } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createDesktopMcpServer } from './mcpSdkServer'

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const GET_DESKTOP_MCP_SERVER_STATE_CHANNEL = 'aksel-arcade:get-desktop-mcp-server-state'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-request'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-response'
const ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-annotation-mutation-request'
const ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-annotation-mutation-response'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-request'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-response'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-request'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-response'
const DEFAULT_RENDERER_URL = 'http://127.0.0.1:5173/aksel-arcade/'
const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist-desktop')
const PRELOAD_PATH = path.resolve(__dirname, '..', 'preload.cjs')
const DESKTOP_RENDERER_PROTOCOL = 'aksel-arcade'
const DESKTOP_RENDERER_HOST = 'app'
const DESKTOP_RENDERER_ORIGIN = `${DESKTOP_RENDERER_PROTOCOL}://${DESKTOP_RENDERER_HOST}`
const DESKTOP_RENDERER_URL = `${DESKTOP_RENDERER_ORIGIN}/index.html`
const DESKTOP_MCP_PROJECT_RESOURCE_ROUTE_TIMEOUT_MS = 5_000
const DESKTOP_MCP_ANNOTATION_MUTATION_ROUTE_TIMEOUT_MS = 30_000
const DESKTOP_MCP_APPLY_CHANGES_ROUTE_TIMEOUT_MS = 5_000
const DESKTOP_MCP_PREVIEW_CAPTURE_ROUTE_TIMEOUT_MS = 30_000

interface DesktopCapabilities {
  surface: 'desktop'
  shareUrl: {
    enabled: boolean
  }
  projectPackages: {
    enabled: boolean
    defaultExtension: string
    legacyJsonImport: boolean
  }
}

interface ProjectResourceReadSuccess {
  ok: true
  uri: string
  mimeType: string
  text: string
}

interface ProjectResourceReadFailure {
  ok: false
  code: 'project-unavailable' | 'source-not-found' | 'invalid-resource-uri'
  resourceUri: string
  message: string
}

type DesktopMcpProjectResourceReadResult = ProjectResourceReadSuccess | ProjectResourceReadFailure

interface AnnotationMutationSuccess {
  ok: true
  toolName: string
  annotationId: string
  pageId: string
  message: string
  annotation: Record<string, unknown>
  annotations: Array<Record<string, unknown>>
}

interface AnnotationMutationFailure {
  ok: false
  code: 'project-unavailable' | 'annotation-not-found' | 'dead-target-annotation' | 'invalid-annotation-payload'
  annotationId: string
  message: string
}

type DesktopMcpAnnotationMutationResult = AnnotationMutationSuccess | AnnotationMutationFailure

interface ApplyChangesSuccess {
  ok: true
  summary: string
  projectRevision: string
  changedResources: string[]
  nextRecommendedResources: string[]
  operationResults: unknown[]
  safeActivity: {
    toolName: string
    timestamp: string
    operationTypes?: string[]
  }
}

interface ApplyChangesFailure {
  ok: false
  code:
    | 'project-unavailable'
    | 'invalid-operation'
    | 'stale-project-revision'
    | 'invalid-operation-target'
    | 'invalid-project-name'
    | 'payload-too-large'
    | 'persistence-failed'
  message: string
  manifestResourceUri?: string
  resourceUri?: string
  expectedProjectRevision?: string
  currentProjectRevision?: string
}

type DesktopMcpApplyChangesResult = ApplyChangesSuccess | ApplyChangesFailure

interface PreviewCaptureSuccess {
  ok: true
  summary: string
  captureId: string
  manifestResourceUri: string
  producedResources: string[]
  page: {
    id: string
    name: string
  }
  requestedLayers: string[]
  producedLayers: string[]
  layerResources: {
    accessibility?: string
    dom_layout_style?: string
    frame?: string
    screenshot?: string
  }
  resources: Array<{
    uri: string
    mimeType: string
    text: string
  }>
  safeActivity: {
    toolName: 'capture_preview_evidence'
    timestamp: string
    operationTypes?: string[]
  }
}

interface PreviewCaptureFailure {
  ok: false
  code:
    | 'project-unavailable'
    | 'invalid-page-id'
    | 'invalid-capture-target'
    | 'render-timeout'
    | 'render-failed'
  message: string
  manifestResourceUri?: string
}

type DesktopMcpPreviewCaptureResult = PreviewCaptureSuccess | PreviewCaptureFailure

interface PendingProjectResourceRequest {
  resolve: (value: DesktopMcpProjectResourceReadResult) => void
  timeout: ReturnType<typeof setTimeout>
  uri: string
  webContentsId: number
}

interface PendingAnnotationMutationRequest {
  resolve: (value: DesktopMcpAnnotationMutationResult) => void
  timeout: ReturnType<typeof setTimeout>
  request: {
    annotationId: string
  }
  webContentsId: number
}

interface PendingApplyChangesRequest {
  resolve: (value: DesktopMcpApplyChangesResult) => void
  timeout: ReturnType<typeof setTimeout>
  webContentsId: number
}

interface PendingPreviewCaptureRequest {
  resolve: (value: DesktopMcpPreviewCaptureResult) => void
  timeout: ReturnType<typeof setTimeout>
  webContentsId: number
}

const desktopMcpServer = createDesktopMcpServer({
  readProjectResource: routeDesktopMcpProjectResourceRead,
  mutateAnnotation: routeDesktopMcpAnnotationMutation,
  applyChanges: routeDesktopMcpApplyChanges,
  capturePreviewEvidence: routeDesktopMcpPreviewCapture,
})
let activeMainWindow: BrowserWindow | null = null
let nextDesktopMcpProjectResourceRequestId = 0
const pendingDesktopMcpProjectResourceRequests = new Map<string, PendingProjectResourceRequest>()
let nextDesktopMcpAnnotationMutationRequestId = 0
const pendingDesktopMcpAnnotationMutationRequests = new Map<
  string,
  PendingAnnotationMutationRequest
>()
let nextDesktopMcpApplyChangesRequestId = 0
const pendingDesktopMcpApplyChangesRequests = new Map<string, PendingApplyChangesRequest>()
let nextDesktopMcpPreviewCaptureRequestId = 0
const pendingDesktopMcpPreviewCaptureRequests = new Map<string, PendingPreviewCaptureRequest>()
let desktopRendererProtocolRegistered = false
let desktopMainProcessStartPromise: Promise<void> | null = null

const DESKTOP_ARCADE_CAPABILITIES: DesktopCapabilities = Object.freeze({
  surface: 'desktop',
  shareUrl: Object.freeze({ enabled: false }),
  projectPackages: Object.freeze({
    enabled: true,
    defaultExtension: '.akselarcade',
    legacyJsonImport: false,
  }),
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_RENDERER_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

const getRendererUrl = () => process.env.AKSEL_ARCADE_RENDERER_URL || DEFAULT_RENDERER_URL

const getDesktopRendererUrl = () => DESKTOP_RENDERER_URL

const cloneDesktopCapabilities = (): DesktopCapabilities => ({
  surface: DESKTOP_ARCADE_CAPABILITIES.surface,
  shareUrl: { ...DESKTOP_ARCADE_CAPABILITIES.shareUrl },
  projectPackages: { ...DESKTOP_ARCADE_CAPABILITIES.projectPackages },
})

const registerDesktopIpc = () => {
  ipcMain.handle(SHELL_CAPABILITIES_CHANNEL, () => cloneDesktopCapabilities())
  ipcMain.handle(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL, () => desktopMcpServer.getState())
  ipcMain.on(
    ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
    handleDesktopMcpProjectResourceResponse
  )
  ipcMain.on(
    ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL,
    handleDesktopMcpAnnotationMutationResponse
  )
  ipcMain.on(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, handleDesktopMcpApplyChangesResponse)
  ipcMain.on(
    ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL,
    handleDesktopMcpPreviewCaptureResponse
  )
}

const removeDesktopIpc = () => {
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
  ipcMain.removeHandler(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL)
  ipcMain.off(
    ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
    handleDesktopMcpProjectResourceResponse
  )
  ipcMain.off(
    ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL,
    handleDesktopMcpAnnotationMutationResponse
  )
  ipcMain.off(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, handleDesktopMcpApplyChangesResponse)
  ipcMain.off(
    ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL,
    handleDesktopMcpPreviewCaptureResponse
  )
}

const registerDesktopRendererProtocol = () => {
  if (desktopRendererProtocolRegistered) {
    return
  }

  protocol.handle(DESKTOP_RENDERER_PROTOCOL, (request) => {
    const filePath = getDesktopRendererProtocolFilePath(request.url)

    if (!filePath) {
      return new Response('Desktop Arcade resource not found.', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })

  desktopRendererProtocolRegistered = true
}

function routeDesktopMcpProjectResourceRead({
  uri,
}: {
  uri: string
}): Promise<DesktopMcpProjectResourceReadResult> {
  const targetWindow = getDesktopMcpProjectResourceWindow()
  if (!targetWindow) {
    return Promise.resolve(
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        uri,
        'Desktop Arcade project resources are unavailable because no renderer window is available.'
      )
    )
  }

  const requestId = `desktop-mcp-project-resource-${++nextDesktopMcpProjectResourceRequestId}`

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingDesktopMcpProjectResourceRequests.delete(requestId)
      resolve(
        createDesktopMcpProjectResourceFailure(
          'project-unavailable',
          uri,
          'Desktop Arcade project resources are unavailable because the renderer did not respond in time.'
        )
      )
    }, DESKTOP_MCP_PROJECT_RESOURCE_ROUTE_TIMEOUT_MS)

    pendingDesktopMcpProjectResourceRequests.set(requestId, {
      resolve,
      timeout,
      uri,
      webContentsId: targetWindow.webContents.id,
    })

    try {
      targetWindow.webContents.send(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL, {
        requestId,
        uri,
      })
    } catch {
      pendingDesktopMcpProjectResourceRequests.delete(requestId)
      clearTimeout(timeout)
      resolve(
        createDesktopMcpProjectResourceFailure(
          'project-unavailable',
          uri,
          'Desktop Arcade project resources are unavailable because the renderer window is no longer reachable.'
        )
      )
    }
  })
}

function routeDesktopMcpAnnotationMutation(request: {
  annotationId: string
}): Promise<DesktopMcpAnnotationMutationResult> {
  const targetWindow = getDesktopMcpProjectResourceWindow()
  if (!targetWindow) {
    return Promise.resolve(
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because no renderer window is available.'
      )
    )
  }

  const requestId = `desktop-mcp-annotation-mutation-${++nextDesktopMcpAnnotationMutationRequestId}`

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingDesktopMcpAnnotationMutationRequests.delete(requestId)
      resolve(
        createDesktopMcpAnnotationMutationFailure(
          'project-unavailable',
          request.annotationId,
          'Desktop Arcade annotation mutation timed out before the renderer responded.'
        )
      )
    }, DESKTOP_MCP_ANNOTATION_MUTATION_ROUTE_TIMEOUT_MS)

    pendingDesktopMcpAnnotationMutationRequests.set(requestId, {
      resolve,
      timeout,
      request,
      webContentsId: targetWindow.webContents.id,
    })

    try {
      targetWindow.webContents.send(ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_REQUEST_CHANNEL, {
        requestId,
        ...request,
      })
    } catch {
      pendingDesktopMcpAnnotationMutationRequests.delete(requestId)
      clearTimeout(timeout)
      resolve(
        createDesktopMcpAnnotationMutationFailure(
          'project-unavailable',
          request.annotationId,
          'Desktop Arcade annotation mutations are unavailable because the renderer window is no longer reachable.'
        )
      )
    }
  })
}

function routeDesktopMcpApplyChanges(
  request: Record<string, unknown>
): Promise<DesktopMcpApplyChangesResult> {
  const targetWindow = getDesktopMcpProjectResourceWindow()
  if (!targetWindow) {
    return Promise.resolve(
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because no renderer window is available.'
      )
    )
  }

  const requestId = `desktop-mcp-apply-changes-${++nextDesktopMcpApplyChangesRequestId}`

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingDesktopMcpApplyChangesRequests.delete(requestId)
      resolve(
        createDesktopMcpApplyChangesFailure(
          'project-unavailable',
          'Desktop Arcade MCP apply_changes timed out before the renderer responded.'
        )
      )
    }, DESKTOP_MCP_APPLY_CHANGES_ROUTE_TIMEOUT_MS)

    pendingDesktopMcpApplyChangesRequests.set(requestId, {
      resolve,
      timeout,
      webContentsId: targetWindow.webContents.id,
    })

    try {
      targetWindow.webContents.send(ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL, {
        requestId,
        ...request,
      })
    } catch {
      pendingDesktopMcpApplyChangesRequests.delete(requestId)
      clearTimeout(timeout)
      resolve(
        createDesktopMcpApplyChangesFailure(
          'project-unavailable',
          'Desktop Arcade MCP apply_changes is unavailable because the renderer window is no longer reachable.'
        )
      )
    }
  })
}

function routeDesktopMcpPreviewCapture(
  request: Record<string, unknown>
): Promise<DesktopMcpPreviewCaptureResult> {
  const targetWindow = getDesktopMcpProjectResourceWindow()
  if (!targetWindow) {
    return Promise.resolve(
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop Arcade MCP capture_preview_evidence is unavailable because no renderer window is available.'
      )
    )
  }

  const requestId = `desktop-mcp-preview-capture-${++nextDesktopMcpPreviewCaptureRequestId}`

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingDesktopMcpPreviewCaptureRequests.delete(requestId)
      resolve(
        createDesktopMcpPreviewCaptureFailure(
          'render-timeout',
          'Desktop Arcade MCP capture_preview_evidence timed out before the renderer responded.'
        )
      )
    }, DESKTOP_MCP_PREVIEW_CAPTURE_ROUTE_TIMEOUT_MS)

    pendingDesktopMcpPreviewCaptureRequests.set(requestId, {
      resolve,
      timeout,
      webContentsId: targetWindow.webContents.id,
    })

    try {
      targetWindow.webContents.send(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL, {
        requestId,
        ...request,
      })
    } catch {
      pendingDesktopMcpPreviewCaptureRequests.delete(requestId)
      clearTimeout(timeout)
      resolve(
        createDesktopMcpPreviewCaptureFailure(
          'project-unavailable',
          'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer window is no longer reachable.'
        )
      )
    }
  })
}

function handleDesktopMcpProjectResourceResponse(
  event: IpcMainEvent,
  payload: unknown
): void {
  if (!isRecord(payload) || typeof payload.requestId !== 'string') {
    return
  }

  const pendingRequest = pendingDesktopMcpProjectResourceRequests.get(payload.requestId)
  if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
    return
  }

  pendingDesktopMcpProjectResourceRequests.delete(payload.requestId)
  clearTimeout(pendingRequest.timeout)

  if (!isDesktopMcpProjectResourceReadResult(payload.response, pendingRequest.uri)) {
    pendingRequest.resolve(
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.uri,
        'Desktop Arcade project resources are unavailable because the renderer returned an invalid response.'
      )
    )
    return
  }

  pendingRequest.resolve(payload.response)
}

function handleDesktopMcpAnnotationMutationResponse(event: IpcMainEvent, payload: unknown): void {
  if (!isRecord(payload) || typeof payload.requestId !== 'string') {
    return
  }

  const pendingRequest = pendingDesktopMcpAnnotationMutationRequests.get(payload.requestId)
  if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
    return
  }

  pendingDesktopMcpAnnotationMutationRequests.delete(payload.requestId)
  clearTimeout(pendingRequest.timeout)

  if (!isDesktopMcpAnnotationMutationResult(payload.response)) {
    pendingRequest.resolve(
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        pendingRequest.request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because the renderer returned an invalid response.'
      )
    )
    return
  }

  pendingRequest.resolve(payload.response)
}

function handleDesktopMcpApplyChangesResponse(event: IpcMainEvent, payload: unknown): void {
  if (!isRecord(payload) || typeof payload.requestId !== 'string') {
    return
  }

  const pendingRequest = pendingDesktopMcpApplyChangesRequests.get(payload.requestId)
  if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
    return
  }

  pendingDesktopMcpApplyChangesRequests.delete(payload.requestId)
  clearTimeout(pendingRequest.timeout)

  if (!isDesktopMcpApplyChangesResult(payload.response)) {
    pendingRequest.resolve(
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer returned an invalid response.'
      )
    )
    return
  }

  pendingRequest.resolve(payload.response)
}

function handleDesktopMcpPreviewCaptureResponse(event: IpcMainEvent, payload: unknown): void {
  if (!isRecord(payload) || typeof payload.requestId !== 'string') {
    return
  }

  const pendingRequest = pendingDesktopMcpPreviewCaptureRequests.get(payload.requestId)
  if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
    return
  }

  pendingDesktopMcpPreviewCaptureRequests.delete(payload.requestId)
  clearTimeout(pendingRequest.timeout)

  if (!isDesktopMcpPreviewCaptureResult(payload.response)) {
    pendingRequest.resolve(
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer returned an invalid response.'
      )
    )
    return
  }

  pendingRequest.resolve(payload.response)
}

const getDesktopMcpProjectResourceWindow = (): BrowserWindow | null => {
  if (activeMainWindow && !activeMainWindow.isDestroyed()) {
    return activeMainWindow
  }

  return BrowserWindow.getAllWindows().find((browserWindow) => !browserWindow.isDestroyed()) ?? null
}

const resolvePendingDesktopMcpProjectResourceRequests = (
  responseFactory: (pendingRequest: PendingProjectResourceRequest) => DesktopMcpProjectResourceReadResult
) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpProjectResourceRequests) {
    pendingDesktopMcpProjectResourceRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const resolvePendingDesktopMcpAnnotationMutationRequests = (
  responseFactory: (pendingRequest: PendingAnnotationMutationRequest) => DesktopMcpAnnotationMutationResult
) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpAnnotationMutationRequests) {
    pendingDesktopMcpAnnotationMutationRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const resolvePendingDesktopMcpApplyChangesRequests = (
  responseFactory: (pendingRequest: PendingApplyChangesRequest) => DesktopMcpApplyChangesResult
) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpApplyChangesRequests) {
    pendingDesktopMcpApplyChangesRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const resolvePendingDesktopMcpPreviewCaptureRequests = (
  responseFactory: (pendingRequest: PendingPreviewCaptureRequest) => DesktopMcpPreviewCaptureResult
) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpPreviewCaptureRequests) {
    pendingDesktopMcpPreviewCaptureRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const createDesktopMcpProjectResourceFailure = (
  code: ProjectResourceReadFailure['code'],
  resourceUri: string,
  message: string
): ProjectResourceReadFailure => ({
  ok: false,
  code,
  resourceUri,
  message,
})

const createDesktopMcpAnnotationMutationFailure = (
  code: AnnotationMutationFailure['code'],
  annotationId: string,
  message: string
): AnnotationMutationFailure => ({
  ok: false,
  code,
  annotationId,
  message,
})

const createDesktopMcpApplyChangesFailure = (
  code: ApplyChangesFailure['code'],
  message: string,
  extras: Partial<ApplyChangesFailure> = {}
): ApplyChangesFailure => ({
  ok: false,
  code,
  message,
  ...extras,
})

const createDesktopMcpPreviewCaptureFailure = (
  code: PreviewCaptureFailure['code'],
  message: string,
  extras: Partial<PreviewCaptureFailure> = {}
): PreviewCaptureFailure => ({
  ok: false,
  code,
  message,
  ...extras,
})

const getDesktopRendererProtocolFilePath = (requestUrl: string): string | null => {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (url.protocol !== `${DESKTOP_RENDERER_PROTOCOL}:` || url.hostname !== DESKTOP_RENDERER_HOST) {
    return null
  }

  let resourcePath: string
  try {
    resourcePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  } catch {
    return null
  }

  const filePath = path.normalize(path.join(DIST_DIR, `.${resourcePath}`))
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null
  }

  return filePath
}

const isDesktopRendererProtocolUrl = (targetUrl: string) => {
  try {
    const url = new URL(targetUrl)
    return url.protocol === `${DESKTOP_RENDERER_PROTOCOL}:` && url.hostname === DESKTOP_RENDERER_HOST
  } catch {
    return false
  }
}

const isAllowedNavigation = (targetUrl: string) => {
  if (isDesktopRendererProtocolUrl(targetUrl)) {
    return true
  }

  if (app.isPackaged) {
    return false
  }

  try {
    return new URL(targetUrl).origin === new URL(getRendererUrl()).origin
  } catch {
    return false
  }
}

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: 'Aksel Arcade',
    backgroundColor: '#111827',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  activeMainWindow = mainWindow
  mainWindow.on('closed', () => {
    if (activeMainWindow === mainWindow) {
      activeMainWindow = null
    }

    resolvePendingDesktopMcpProjectResourceRequests((pendingRequest) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.uri,
        'Desktop Arcade project resources are unavailable because the renderer window closed.'
      )
    )
    resolvePendingDesktopMcpAnnotationMutationRequests((pendingRequest) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        pendingRequest.request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because the renderer window closed.'
      )
    )
    resolvePendingDesktopMcpApplyChangesRequests(() =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer window closed.'
      )
    )
    resolvePendingDesktopMcpPreviewCaptureRequests(() =>
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer window closed.'
      )
    )
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedNavigation(targetUrl)) {
      event.preventDefault()
    }
  })

  if (app.isPackaged) {
    await mainWindow.loadURL(getDesktopRendererUrl())
    return
  }

  await mainWindow.loadURL(getRendererUrl())
}

export const startDesktopMainProcess = async () => {
  if (desktopMainProcessStartPromise) {
    return desktopMainProcessStartPromise
  }

  app.setName('Aksel Arcade')
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('will-quit', () => {
    void desktopMcpServer.stop()
    resolvePendingDesktopMcpProjectResourceRequests((pendingRequest) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.uri,
        'Desktop Arcade project resources are unavailable because the renderer is shutting down.'
      )
    )
    resolvePendingDesktopMcpAnnotationMutationRequests((pendingRequest) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        pendingRequest.request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because the renderer is shutting down.'
      )
    )
    resolvePendingDesktopMcpApplyChangesRequests(() =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer is shutting down.'
      )
    )
    resolvePendingDesktopMcpPreviewCaptureRequests(() =>
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer is shutting down.'
      )
    )
    removeDesktopIpc()
  })

  desktopMainProcessStartPromise = app
    .whenReady()
    .then(async () => {
      await desktopMcpServer.start()
      registerDesktopIpc()
      registerDesktopRendererProtocol()
      await createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          void createWindow()
        }
      })
    })
    .catch((error: unknown) => {
      console.error('Failed to start Desktop Arcade:', error)
      app.exit(1)
    })

  return desktopMainProcessStartPromise
}

const isDesktopMcpProjectResourceReadResult = (
  value: unknown,
  expectedUri: string
): value is DesktopMcpProjectResourceReadResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      value.uri === expectedUri &&
      typeof value.mimeType === 'string' &&
      value.mimeType.length > 0 &&
      typeof value.text === 'string'
    )
  }

  return (
    value.resourceUri === expectedUri &&
    (value.code === 'project-unavailable' ||
      value.code === 'source-not-found' ||
      value.code === 'invalid-resource-uri') &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0
  )
}

const isDesktopMcpAnnotationMutationResult = (
  value: unknown
): value is DesktopMcpAnnotationMutationResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.toolName === 'string' &&
      typeof value.annotationId === 'string' &&
      value.annotationId.trim().length > 0 &&
      typeof value.pageId === 'string' &&
      value.pageId.trim().length > 0 &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0 &&
      isRecord(value.annotation) &&
      Array.isArray(value.annotations)
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'annotation-not-found' ||
      value.code === 'dead-target-annotation' ||
      value.code === 'invalid-annotation-payload') &&
    typeof value.annotationId === 'string' &&
    value.annotationId.trim().length > 0 &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0
  )
}

const isDesktopMcpApplyChangesResult = (
  value: unknown
): value is DesktopMcpApplyChangesResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      typeof value.projectRevision === 'string' &&
      value.projectRevision.trim().length > 0 &&
      Array.isArray(value.changedResources) &&
      value.changedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.nextRecommendedResources) &&
      value.nextRecommendedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.operationResults) &&
      isRecord(value.safeActivity) &&
      typeof value.safeActivity.toolName === 'string' &&
      typeof value.safeActivity.timestamp === 'string' &&
      (value.safeActivity.operationTypes === undefined ||
        (Array.isArray(value.safeActivity.operationTypes) &&
          value.safeActivity.operationTypes.every((operationType) => typeof operationType === 'string')))
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'invalid-operation' ||
      value.code === 'stale-project-revision' ||
      value.code === 'invalid-operation-target' ||
      value.code === 'invalid-project-name' ||
      value.code === 'payload-too-large' ||
      value.code === 'persistence-failed') &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0 &&
    (value.manifestResourceUri === undefined || typeof value.manifestResourceUri === 'string') &&
    (value.resourceUri === undefined || typeof value.resourceUri === 'string') &&
    (value.expectedProjectRevision === undefined ||
      typeof value.expectedProjectRevision === 'string') &&
    (value.currentProjectRevision === undefined || typeof value.currentProjectRevision === 'string')
  )
}

const isDesktopMcpPreviewCaptureResult = (
  value: unknown
): value is DesktopMcpPreviewCaptureResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      typeof value.captureId === 'string' &&
      value.captureId.trim().length > 0 &&
      typeof value.manifestResourceUri === 'string' &&
      value.manifestResourceUri.trim().length > 0 &&
      Array.isArray(value.producedResources) &&
      value.producedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      isRecord(value.page) &&
      typeof value.page.id === 'string' &&
      typeof value.page.name === 'string' &&
      Array.isArray(value.requestedLayers) &&
      value.requestedLayers.every((layer) => typeof layer === 'string') &&
      Array.isArray(value.producedLayers) &&
      value.producedLayers.every((layer) => typeof layer === 'string') &&
      isRecord(value.layerResources) &&
      (value.layerResources.accessibility === undefined ||
        typeof value.layerResources.accessibility === 'string') &&
      (value.layerResources.dom_layout_style === undefined ||
        typeof value.layerResources.dom_layout_style === 'string') &&
      (value.layerResources.frame === undefined || typeof value.layerResources.frame === 'string') &&
      (value.layerResources.screenshot === undefined ||
        typeof value.layerResources.screenshot === 'string') &&
      Array.isArray(value.resources) &&
      value.resources.every(
        (resource) =>
          isRecord(resource) &&
          typeof resource.uri === 'string' &&
          typeof resource.mimeType === 'string' &&
          typeof resource.text === 'string'
      ) &&
      isRecord(value.safeActivity) &&
      value.safeActivity.toolName === 'capture_preview_evidence' &&
      typeof value.safeActivity.timestamp === 'string' &&
      (value.safeActivity.operationTypes === undefined ||
        (Array.isArray(value.safeActivity.operationTypes) &&
          value.safeActivity.operationTypes.every((operationType) => typeof operationType === 'string')))
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'invalid-page-id' ||
      value.code === 'invalid-capture-target' ||
      value.code === 'render-timeout' ||
      value.code === 'render-failed') &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0 &&
    (value.manifestResourceUri === undefined || typeof value.manifestResourceUri === 'string')
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

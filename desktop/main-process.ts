import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  DesktopMcpApplyChangesFailure,
  DesktopMcpApplyChangesRequest,
  DesktopMcpApplyChangesResult,
} from '../src/services/desktopMcpApplyChangesProtocol'
import type {
  DesktopMcpAnnotationMutationFailure,
  DesktopMcpAnnotationMutationRequest,
  DesktopMcpAnnotationMutationResult,
} from '../src/services/desktopMcpAnnotationProtocol'
import type {
  DesktopMcpPreviewCaptureFailure as PreviewCaptureFailure,
  DesktopMcpPreviewCaptureRequest,
  DesktopMcpPreviewCaptureResult,
} from '../src/services/desktopMcpPreviewCaptureProtocol'
import type {
  DesktopMcpProjectResourceReadFailure,
  DesktopMcpProjectResourceReadRequest,
  DesktopMcpProjectResourceReadResult,
} from '../src/services/desktopMcpProjectResourceProtocol'
import {
  createDesktopMcpBridgeRoute,
  type DesktopMcpBridgePendingRequest,
} from './desktopMcpBridgeRouter'
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

interface PendingProjectResourceRequest
  extends DesktopMcpBridgePendingRequest<DesktopMcpProjectResourceReadResult> {
  request: DesktopMcpProjectResourceReadRequest
}

interface PendingAnnotationMutationRequest
  extends DesktopMcpBridgePendingRequest<DesktopMcpAnnotationMutationResult> {
  request: {
    annotationId: string
  }
}

type PendingApplyChangesRequest = DesktopMcpBridgePendingRequest<DesktopMcpApplyChangesResult>

type PendingPreviewCaptureRequest = DesktopMcpBridgePendingRequest<DesktopMcpPreviewCaptureResult>

const desktopMcpServer = createDesktopMcpServer({
  readProjectResource: routeDesktopMcpProjectResourceRead,
  mutateAnnotation: routeDesktopMcpAnnotationMutation,
  applyChanges: routeDesktopMcpApplyChanges,
  capturePreviewEvidence: routeDesktopMcpPreviewCapture,
})
let activeMainWindow: BrowserWindow | null = null
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

const desktopMcpProjectResourceRoute = createDesktopMcpBridgeRoute<
  DesktopMcpProjectResourceReadRequest,
  DesktopMcpProjectResourceReadResult,
  PendingProjectResourceRequest
>({
  requestChannel: ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL,
  responseChannel: ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
  requestIdPrefix: 'desktop-mcp-project-resource',
  timeoutMs: DESKTOP_MCP_PROJECT_RESOURCE_ROUTE_TIMEOUT_MS,
  getTargetWindow: getDesktopMcpActiveWindow,
  buildRequestPayload: (requestId, request) => ({ requestId, ...request }),
  createPendingRequest: (request, resolve, timeout, webContentsId) => ({
    request,
    resolve,
    timeout,
    webContentsId,
  }),
  createNoTargetWindowResult: ({ uri }) =>
    createDesktopMcpProjectResourceFailure(
      'project-unavailable',
      uri,
      'Desktop Arcade project resources are unavailable because no renderer window is available.'
    ),
  createTimeoutResult: ({ request }) =>
    createDesktopMcpProjectResourceFailure(
      'project-unavailable',
      request.uri,
      'Desktop Arcade project resources are unavailable because the renderer did not respond in time.'
    ),
  createSendFailureResult: ({ request }) =>
    createDesktopMcpProjectResourceFailure(
      'project-unavailable',
      request.uri,
      'Desktop Arcade project resources are unavailable because the renderer window is no longer reachable.'
    ),
  createInvalidResponseResult: ({ request }) =>
    createDesktopMcpProjectResourceFailure(
      'project-unavailable',
      request.uri,
      'Desktop Arcade project resources are unavailable because the renderer returned an invalid response.'
    ),
  isResult: (value, pendingRequest) => isDesktopMcpProjectResourceReadResult(value, pendingRequest.request.uri),
})

const desktopMcpAnnotationMutationRoute = createDesktopMcpBridgeRoute<
  DesktopMcpAnnotationMutationRequest,
  DesktopMcpAnnotationMutationResult,
  PendingAnnotationMutationRequest
>({
  requestChannel: ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_REQUEST_CHANNEL,
  responseChannel: ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL,
  requestIdPrefix: 'desktop-mcp-annotation-mutation',
  timeoutMs: DESKTOP_MCP_ANNOTATION_MUTATION_ROUTE_TIMEOUT_MS,
  getTargetWindow: getDesktopMcpActiveWindow,
  buildRequestPayload: (requestId, request) => ({ requestId, ...request }),
  createPendingRequest: (request, resolve, timeout, webContentsId) => ({
    request: { annotationId: request.annotationId },
    resolve,
    timeout,
    webContentsId,
  }),
  createNoTargetWindowResult: (request) =>
    createDesktopMcpAnnotationMutationFailure(
      'project-unavailable',
      request.annotationId,
      'Desktop Arcade annotation mutations are unavailable because no renderer window is available.'
    ),
  createTimeoutResult: ({ request }) =>
    createDesktopMcpAnnotationMutationFailure(
      'project-unavailable',
      request.annotationId,
      'Desktop Arcade annotation mutation timed out before the renderer responded.'
    ),
  createSendFailureResult: ({ request }) =>
    createDesktopMcpAnnotationMutationFailure(
      'project-unavailable',
      request.annotationId,
      'Desktop Arcade annotation mutations are unavailable because the renderer window is no longer reachable.'
    ),
  createInvalidResponseResult: ({ request }) =>
    createDesktopMcpAnnotationMutationFailure(
      'project-unavailable',
      request.annotationId,
      'Desktop Arcade annotation mutations are unavailable because the renderer returned an invalid response.'
    ),
  isResult: (value) => isDesktopMcpAnnotationMutationResult(value),
})

const desktopMcpApplyChangesRoute = createDesktopMcpBridgeRoute<
  DesktopMcpApplyChangesRequest,
  DesktopMcpApplyChangesResult,
  PendingApplyChangesRequest
>({
  requestChannel: ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL,
  responseChannel: ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL,
  requestIdPrefix: 'desktop-mcp-apply-changes',
  timeoutMs: DESKTOP_MCP_APPLY_CHANGES_ROUTE_TIMEOUT_MS,
  getTargetWindow: getDesktopMcpActiveWindow,
  buildRequestPayload: (requestId, request) => ({ requestId, ...request }),
  createPendingRequest: (_request, resolve, timeout, webContentsId) => ({
    resolve,
    timeout,
    webContentsId,
  }),
  createNoTargetWindowResult: () =>
    createDesktopMcpApplyChangesFailure(
      'project-unavailable',
      'Desktop Arcade MCP apply_changes is unavailable because no renderer window is available.'
    ),
  createTimeoutResult: () =>
    createDesktopMcpApplyChangesFailure(
      'project-unavailable',
      'Desktop Arcade MCP apply_changes timed out before the renderer responded.'
    ),
  createSendFailureResult: () =>
    createDesktopMcpApplyChangesFailure(
      'project-unavailable',
      'Desktop Arcade MCP apply_changes is unavailable because the renderer window is no longer reachable.'
    ),
  createInvalidResponseResult: () =>
    createDesktopMcpApplyChangesFailure(
      'project-unavailable',
      'Desktop Arcade MCP apply_changes is unavailable because the renderer returned an invalid response.'
    ),
  isResult: (value) => isDesktopMcpApplyChangesResult(value),
})

const desktopMcpPreviewCaptureRoute = createDesktopMcpBridgeRoute<
  DesktopMcpPreviewCaptureRequest,
  DesktopMcpPreviewCaptureResult,
  PendingPreviewCaptureRequest
>({
  requestChannel: ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL,
  responseChannel: ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL,
  requestIdPrefix: 'desktop-mcp-preview-capture',
  timeoutMs: DESKTOP_MCP_PREVIEW_CAPTURE_ROUTE_TIMEOUT_MS,
  getTargetWindow: getDesktopMcpActiveWindow,
  buildRequestPayload: (requestId, request) => ({ requestId, ...request }),
  createPendingRequest: (_request, resolve, timeout, webContentsId) => ({
    resolve,
    timeout,
    webContentsId,
  }),
  createNoTargetWindowResult: () =>
    createDesktopMcpPreviewCaptureFailure(
      'project-unavailable',
      'Desktop Arcade MCP capture_preview_evidence is unavailable because no renderer window is available.'
    ),
  createTimeoutResult: () =>
    createDesktopMcpPreviewCaptureFailure(
      'render-timeout',
      'Desktop Arcade MCP capture_preview_evidence timed out before the renderer responded.'
    ),
  createSendFailureResult: () =>
    createDesktopMcpPreviewCaptureFailure(
      'project-unavailable',
      'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer window is no longer reachable.'
    ),
  createInvalidResponseResult: () =>
    createDesktopMcpPreviewCaptureFailure(
      'project-unavailable',
      'Desktop Arcade MCP capture_preview_evidence is unavailable because the renderer returned an invalid response.'
    ),
  isResult: (value) => isDesktopMcpPreviewCaptureResult(value),
})

const desktopMcpBridgeRoutes = [
  desktopMcpProjectResourceRoute,
  desktopMcpAnnotationMutationRoute,
  desktopMcpApplyChangesRoute,
  desktopMcpPreviewCaptureRoute,
] as const

const registerDesktopIpc = () => {
  ipcMain.handle(SHELL_CAPABILITIES_CHANNEL, () => cloneDesktopCapabilities())
  ipcMain.handle(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL, () => desktopMcpServer.getState())
  for (const route of desktopMcpBridgeRoutes) {
    ipcMain.on(route.responseChannel, route.handleResponse)
  }
}

const removeDesktopIpc = () => {
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
  ipcMain.removeHandler(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL)
  for (const route of desktopMcpBridgeRoutes) {
    ipcMain.off(route.responseChannel, route.handleResponse)
  }
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
  return desktopMcpProjectResourceRoute.route({ uri })
}

function routeDesktopMcpAnnotationMutation(
  request: DesktopMcpAnnotationMutationRequest
): Promise<DesktopMcpAnnotationMutationResult> {
  return desktopMcpAnnotationMutationRoute.route(request)
}

function routeDesktopMcpApplyChanges(
  request: DesktopMcpApplyChangesRequest
): Promise<DesktopMcpApplyChangesResult> {
  return desktopMcpApplyChangesRoute.route(request)
}

function routeDesktopMcpPreviewCapture(
  request: DesktopMcpPreviewCaptureRequest
): Promise<DesktopMcpPreviewCaptureResult> {
  return desktopMcpPreviewCaptureRoute.route(request)
}

function getDesktopMcpActiveWindow(): BrowserWindow | null {
  if (activeMainWindow && !activeMainWindow.isDestroyed()) {
    return activeMainWindow
  }

  return BrowserWindow.getAllWindows().find((browserWindow) => !browserWindow.isDestroyed()) ?? null
}

const createDesktopMcpProjectResourceFailure = (
  code: DesktopMcpProjectResourceReadFailure['code'],
  resourceUri: string,
  message: string
): DesktopMcpProjectResourceReadFailure => ({
  ok: false,
  code,
  resourceUri,
  message,
})

const createDesktopMcpAnnotationMutationFailure = (
  code: DesktopMcpAnnotationMutationFailure['code'],
  annotationId: string,
  message: string
): DesktopMcpAnnotationMutationFailure => ({
  ok: false,
  code,
  annotationId,
  message,
})

const createDesktopMcpApplyChangesFailure = (
  code: DesktopMcpApplyChangesFailure['code'],
  message: string,
  extras: Partial<DesktopMcpApplyChangesFailure> = {}
): DesktopMcpApplyChangesFailure => ({
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

    desktopMcpProjectResourceRoute.resolvePending((pendingRequest) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.request.uri,
        'Desktop Arcade project resources are unavailable because the renderer window closed.'
      )
    )
    desktopMcpAnnotationMutationRoute.resolvePending((pendingRequest) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        pendingRequest.request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because the renderer window closed.'
      )
    )
    desktopMcpApplyChangesRoute.resolvePending(() =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer window closed.'
      )
    )
    desktopMcpPreviewCaptureRoute.resolvePending(() =>
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
    desktopMcpProjectResourceRoute.resolvePending((pendingRequest) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.request.uri,
        'Desktop Arcade project resources are unavailable because the renderer is shutting down.'
      )
    )
    desktopMcpAnnotationMutationRoute.resolvePending((pendingRequest) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        pendingRequest.request.annotationId,
        'Desktop Arcade annotation mutations are unavailable because the renderer is shutting down.'
      )
    )
    desktopMcpApplyChangesRoute.resolvePending(() =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer is shutting down.'
      )
    )
    desktopMcpPreviewCaptureRoute.resolvePending(() =>
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
    ((value.code === 'project-unavailable' ||
      value.code === 'annotation-not-found' ||
      value.code === 'dead-target-annotation' ||
      value.code === 'invalid-annotation-payload' ||
      value.code === 'persistence-failed')) &&
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

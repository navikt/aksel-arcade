const { app, BrowserWindow, ipcMain, net, protocol } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createAgentLoopbackJsonRpcTransport } = require('./agentLoopbackTransport.cjs')
const { createDesktopMcpServer } = require('./mcpServer.cjs')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const GET_DESKTOP_MCP_SERVER_STATE_CHANNEL = 'aksel-arcade:get-desktop-mcp-server-state'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'
const ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL = 'aksel-arcade:route-agent-transport-request'
const ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL = 'aksel-arcade:route-agent-transport-response'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-request'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-response'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-request'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-response'
const DEFAULT_RENDERER_URL = 'http://127.0.0.1:5173/aksel-arcade/'
const DIST_DIR = path.resolve(__dirname, '..', 'dist-desktop')
const DESKTOP_RENDERER_PROTOCOL = 'aksel-arcade'
const DESKTOP_RENDERER_HOST = 'app'
const DESKTOP_RENDERER_ORIGIN = `${DESKTOP_RENDERER_PROTOCOL}://${DESKTOP_RENDERER_HOST}`
const DESKTOP_RENDERER_URL = `${DESKTOP_RENDERER_ORIGIN}/index.html`
const AGENT_TRANSPORT_ROUTE_TIMEOUT_MS = 5000
const DESKTOP_MCP_PROJECT_RESOURCE_ROUTE_TIMEOUT_MS = 5000
const DESKTOP_MCP_APPLY_CHANGES_ROUTE_TIMEOUT_MS = 5000
const agentLoopbackTransport = createAgentLoopbackJsonRpcTransport({
  routeRequest: routeAgentTransportRequest,
})
const desktopMcpServer = createDesktopMcpServer({
  readProjectResource: routeDesktopMcpProjectResourceRead,
  applyChanges: routeDesktopMcpApplyChanges,
})
let activeMainWindow = null
let nextAgentTransportRouteRequestId = 0
const pendingAgentTransportRouteRequests = new Map()
let nextDesktopMcpProjectResourceRequestId = 0
const pendingDesktopMcpProjectResourceRequests = new Map()
let nextDesktopMcpApplyChangesRequestId = 0
const pendingDesktopMcpApplyChangesRequests = new Map()
let desktopRendererProtocolRegistered = false
const DESKTOP_ARCADE_CAPABILITIES = Object.freeze({
  surface: 'desktop',
  shareUrl: Object.freeze({ enabled: false }),
  agentSessions: Object.freeze({ enabled: true }),
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

app.setName('Aksel Arcade')

const getRendererUrl = () => process.env.AKSEL_ARCADE_RENDERER_URL || DEFAULT_RENDERER_URL

const getDesktopRendererUrl = () => DESKTOP_RENDERER_URL

const cloneDesktopCapabilities = () => ({
  surface: DESKTOP_ARCADE_CAPABILITIES.surface,
  shareUrl: { ...DESKTOP_ARCADE_CAPABILITIES.shareUrl },
  agentSessions: { ...DESKTOP_ARCADE_CAPABILITIES.agentSessions },
  projectPackages: { ...DESKTOP_ARCADE_CAPABILITIES.projectPackages },
})

const registerDesktopIpc = () => {
  ipcMain.handle(SHELL_CAPABILITIES_CHANNEL, () => cloneDesktopCapabilities())
  ipcMain.handle(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL, () => desktopMcpServer.getState())
  ipcMain.handle(START_AGENT_TRANSPORT_CHANNEL, (_event, payload) =>
    agentLoopbackTransport.startSession(parseTransportSessionPayload(payload))
  )
  ipcMain.handle(STOP_AGENT_TRANSPORT_CHANNEL, (_event, payload) => {
    const sessionId = parseStopTransportPayload(payload)
    return agentLoopbackTransport.stopSession(sessionId)
  })
  ipcMain.on(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, handleAgentTransportRouteResponse)
  ipcMain.on(
    ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
    handleDesktopMcpProjectResourceResponse
  )
  ipcMain.on(
    ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL,
    handleDesktopMcpApplyChangesResponse
  )
}

const removeDesktopIpc = () => {
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
  ipcMain.removeHandler(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL)
  ipcMain.removeHandler(START_AGENT_TRANSPORT_CHANNEL)
  ipcMain.removeHandler(STOP_AGENT_TRANSPORT_CHANNEL)
  ipcMain.off(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, handleAgentTransportRouteResponse)
  ipcMain.off(
    ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
    handleDesktopMcpProjectResourceResponse
  )
  ipcMain.off(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, handleDesktopMcpApplyChangesResponse)
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

function routeAgentTransportRequest({ id, method, params, session }) {
  const targetWindow = getAgentTransportWindow()
  if (!targetWindow) {
    return createAgentTransportRouteErrorResponse(
      id,
      -32003,
      'renderer-unavailable',
      'Desktop Agent transport cannot route requests because the renderer window is unavailable.'
    )
  }

  const requestId = `agent-transport-route-${++nextAgentTransportRouteRequestId}`
  const routePayload = {
    requestId,
    id,
    method,
    ...(params !== undefined ? { params } : {}),
    sessionId: session.id,
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingAgentTransportRouteRequests.delete(requestId)
      resolve(
        createAgentTransportRouteErrorResponse(
          id,
          -32003,
          'route-timeout',
          'Desktop Agent transport request routing timed out before the renderer responded.'
        )
      )
    }, AGENT_TRANSPORT_ROUTE_TIMEOUT_MS)

    pendingAgentTransportRouteRequests.set(requestId, {
      id,
      resolve,
      timeout,
      webContentsId: targetWindow.webContents.id,
    })

    try {
      targetWindow.webContents.send(ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL, routePayload)
    } catch {
      pendingAgentTransportRouteRequests.delete(requestId)
      clearTimeout(timeout)
      resolve(
        createAgentTransportRouteErrorResponse(
          id,
          -32003,
          'renderer-unavailable',
          'Desktop Agent transport renderer became unavailable before the request could be routed.'
        )
      )
    }
  })
}

function routeDesktopMcpProjectResourceRead({ uri }) {
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

function routeDesktopMcpApplyChanges(request) {
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

function handleAgentTransportRouteResponse(event, payload) {
  if (!isRecord(payload) || typeof payload.requestId !== 'string') {
    return
  }

  const pendingRequest = pendingAgentTransportRouteRequests.get(payload.requestId)
  if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
    return
  }

  pendingAgentTransportRouteRequests.delete(payload.requestId)
  clearTimeout(pendingRequest.timeout)

  if (!isAgentTransportRouteResponse(payload.response, pendingRequest.id)) {
    pendingRequest.resolve(
      createAgentTransportRouteErrorResponse(
        pendingRequest.id,
        -32603,
        'invalid-route-response',
        'Desktop Agent transport renderer returned an invalid JSON-RPC response.'
      )
    )
    return
  }

  pendingRequest.resolve(payload.response)
}

function handleDesktopMcpProjectResourceResponse(event, payload) {
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

function handleDesktopMcpApplyChangesResponse(event, payload) {
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

const getAgentTransportWindow = () => {
  if (activeMainWindow && !activeMainWindow.isDestroyed()) {
    return activeMainWindow
  }

  return BrowserWindow.getAllWindows().find((browserWindow) => !browserWindow.isDestroyed()) ?? null
}

const getDesktopMcpProjectResourceWindow = () => {
  if (activeMainWindow && !activeMainWindow.isDestroyed()) {
    return activeMainWindow
  }

  return BrowserWindow.getAllWindows().find((browserWindow) => !browserWindow.isDestroyed()) ?? null
}

const resolvePendingAgentTransportRouteRequests = (responseFactory) => {
  for (const [requestId, pendingRequest] of pendingAgentTransportRouteRequests) {
    pendingAgentTransportRouteRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest.id))
  }
}

const resolvePendingDesktopMcpProjectResourceRequests = (responseFactory) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpProjectResourceRequests) {
    pendingDesktopMcpProjectResourceRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const resolvePendingDesktopMcpApplyChangesRequests = (responseFactory) => {
  for (const [requestId, pendingRequest] of pendingDesktopMcpApplyChangesRequests) {
    pendingDesktopMcpApplyChangesRequests.delete(requestId)
    clearTimeout(pendingRequest.timeout)
    pendingRequest.resolve(responseFactory(pendingRequest))
  }
}

const createAgentTransportRouteErrorResponse = (id, jsonRpcCode, code, message) => ({
  jsonrpc: '2.0',
  id: isJsonRpcId(id) ? id : null,
  error: {
    code: jsonRpcCode,
    message,
    data: {
      code,
    },
  },
})

const createDesktopMcpProjectResourceFailure = (code, resourceUri, message) => ({
  ok: false,
  code,
  resourceUri,
  message,
})

const createDesktopMcpApplyChangesFailure = (code, message, extras = {}) => ({
  ok: false,
  code,
  message,
  ...extras,
})

const parseTransportSessionPayload = (payload) => {
  if (
    !isRecord(payload) ||
    typeof payload.id !== 'string' ||
    typeof payload.startedAt !== 'string' ||
    payload.status !== 'active' ||
    typeof payload.pairingCredential !== 'string' ||
    !isAgentPermissions(payload.permissions)
  ) {
    throw new Error('Invalid Agent transport session payload.')
  }

  return {
    id: payload.id,
    startedAt: payload.startedAt,
    status: payload.status,
    permissions: { ...payload.permissions },
    pairingCredential: payload.pairingCredential,
  }
}

const parseStopTransportPayload = (payload) => {
  if (!isRecord(payload) || typeof payload.sessionId !== 'string') {
    throw new Error('Invalid Agent transport stop payload.')
  }

  return payload.sessionId
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const getDesktopRendererProtocolFilePath = (requestUrl) => {
  let url
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (
    url.protocol !== `${DESKTOP_RENDERER_PROTOCOL}:` ||
    url.hostname !== DESKTOP_RENDERER_HOST
  ) {
    return null
  }

  let resourcePath
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

const isDesktopRendererProtocolUrl = (targetUrl) => {
  try {
    const url = new URL(targetUrl)
    return url.protocol === `${DESKTOP_RENDERER_PROTOCOL}:` && url.hostname === DESKTOP_RENDERER_HOST
  } catch {
    return false
  }
}

const isAgentPermissions = (value) =>
  isRecord(value) &&
  typeof value.sourceChanges === 'boolean' &&
  typeof value.previewSettings === 'boolean' &&
  typeof value.previewEvidence === 'boolean' &&
  typeof value.projectMetadata === 'boolean'

const isAllowedNavigation = (targetUrl) => {
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
      preload: path.join(__dirname, 'preload.cjs'),
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
    resolvePendingAgentTransportRouteRequests((id) =>
      createAgentTransportRouteErrorResponse(
        id,
        -32003,
        'renderer-unavailable',
        'Desktop Agent transport renderer closed before it returned a response.'
      )
    )
    resolvePendingDesktopMcpProjectResourceRequests((pendingRequest) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        pendingRequest.uri,
        'Desktop Arcade project resources are unavailable because the renderer window closed.'
      )
    )
    resolvePendingDesktopMcpApplyChangesRequests(() =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop Arcade MCP apply_changes is unavailable because the renderer window closed.'
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

app
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
  .catch((error) => {
    console.error('Failed to start Desktop Arcade:', error)
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  void desktopMcpServer.stop()
  void agentLoopbackTransport.stopSession()
  resolvePendingAgentTransportRouteRequests((id) =>
    createAgentTransportRouteErrorResponse(
      id,
      -32003,
      'renderer-unavailable',
      'Desktop Agent transport renderer is shutting down.'
    )
  )
  resolvePendingDesktopMcpProjectResourceRequests((pendingRequest) =>
    createDesktopMcpProjectResourceFailure(
      'project-unavailable',
      pendingRequest.uri,
      'Desktop Arcade project resources are unavailable because the renderer is shutting down.'
    )
  )
  resolvePendingDesktopMcpApplyChangesRequests(() =>
    createDesktopMcpApplyChangesFailure(
      'project-unavailable',
      'Desktop Arcade MCP apply_changes is unavailable because the renderer is shutting down.'
    )
  )
  removeDesktopIpc()
})

const isAgentTransportRouteResponse = (value, expectedId) => {
  if (!isRecord(value) || value.jsonrpc !== '2.0' || value.id !== expectedId) {
    return false
  }

  if ('result' in value && !('error' in value)) {
    return true
  }

  return (
    !('result' in value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'number' &&
    typeof value.error.message === 'string' &&
    isRecord(value.error.data) &&
    typeof value.error.data.code === 'string'
  )
}

const isJsonRpcId = (value) =>
  value === null || value === undefined || typeof value === 'string' || typeof value === 'number'

const isDesktopMcpProjectResourceReadResult = (value, expectedUri) => {
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

const isDesktopMcpApplyChangesResult = (value) => {
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
    (value.currentProjectRevision === undefined ||
    typeof value.currentProjectRevision === 'string')
  )
}

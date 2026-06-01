const { app, BrowserWindow, ipcMain, net, protocol } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { createAgentLoopbackJsonRpcTransport } = require('./agentLoopbackTransport.cjs')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'
const ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL = 'aksel-arcade:route-agent-transport-request'
const ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL = 'aksel-arcade:route-agent-transport-response'
const DEFAULT_RENDERER_URL = 'http://127.0.0.1:5173/aksel-arcade/'
const DIST_DIR = path.resolve(__dirname, '..', 'dist-desktop')
const DESKTOP_RENDERER_PROTOCOL = 'aksel-arcade'
const DESKTOP_RENDERER_HOST = 'app'
const DESKTOP_RENDERER_ORIGIN = `${DESKTOP_RENDERER_PROTOCOL}://${DESKTOP_RENDERER_HOST}`
const DESKTOP_RENDERER_URL = `${DESKTOP_RENDERER_ORIGIN}/index.html`
const AGENT_TRANSPORT_ROUTE_TIMEOUT_MS = 5000
const agentLoopbackTransport = createAgentLoopbackJsonRpcTransport({
  routeRequest: routeAgentTransportRequest,
})
let activeMainWindow = null
let nextAgentTransportRouteRequestId = 0
const pendingAgentTransportRouteRequests = new Map()
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
  ipcMain.handle(START_AGENT_TRANSPORT_CHANNEL, (_event, payload) =>
    agentLoopbackTransport.startSession(parseTransportSessionPayload(payload))
  )
  ipcMain.handle(STOP_AGENT_TRANSPORT_CHANNEL, (_event, payload) => {
    const sessionId = parseStopTransportPayload(payload)
    return agentLoopbackTransport.stopSession(sessionId)
  })
  ipcMain.on(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, handleAgentTransportRouteResponse)
}

const removeDesktopIpc = () => {
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
  ipcMain.removeHandler(START_AGENT_TRANSPORT_CHANNEL)
  ipcMain.removeHandler(STOP_AGENT_TRANSPORT_CHANNEL)
  ipcMain.off(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, handleAgentTransportRouteResponse)
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

const getAgentTransportWindow = () => {
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
  void agentLoopbackTransport.stopSession()
  resolvePendingAgentTransportRouteRequests((id) =>
    createAgentTransportRouteErrorResponse(
      id,
      -32003,
      'renderer-unavailable',
      'Desktop Agent transport renderer is shutting down.'
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

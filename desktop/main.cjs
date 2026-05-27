const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { fileURLToPath } = require('node:url')
const { createAgentLoopbackJsonRpcTransport } = require('./agentLoopbackTransport.cjs')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'
const DEFAULT_RENDERER_URL = 'http://127.0.0.1:5173/aksel-arcade/'
const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const agentLoopbackTransport = createAgentLoopbackJsonRpcTransport()
const DESKTOP_ARCADE_CAPABILITIES = Object.freeze({
  surface: 'desktop',
  shareUrl: Object.freeze({ enabled: false }),
  agentSessions: Object.freeze({ enabled: true }),
  projectPackages: Object.freeze({
    enabled: true,
    defaultExtension: '.akselarcade',
    legacyJsonImport: true,
  }),
})

const getRendererUrl = () => process.env.AKSEL_ARCADE_RENDERER_URL || DEFAULT_RENDERER_URL

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
}

const removeDesktopIpc = () => {
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
  ipcMain.removeHandler(START_AGENT_TRANSPORT_CHANNEL)
  ipcMain.removeHandler(STOP_AGENT_TRANSPORT_CHANNEL)
}

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

const isAgentPermissions = (value) =>
  isRecord(value) &&
  typeof value.sourceChanges === 'boolean' &&
  typeof value.previewSettings === 'boolean' &&
  typeof value.previewEvidence === 'boolean' &&
  typeof value.projectMetadata === 'boolean'

const isAllowedNavigation = (targetUrl) => {
  if (app.isPackaged) {
    try {
      const targetPath = fileURLToPath(targetUrl)
      return (
        targetPath === path.join(DIST_DIR, 'index.html') ||
        targetPath.startsWith(`${DIST_DIR}${path.sep}`)
      )
    } catch {
      return false
    }
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

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedNavigation(targetUrl)) {
      event.preventDefault()
    }
  })

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(DIST_DIR, 'index.html'))
    return
  }

  await mainWindow.loadURL(getRendererUrl())
}

app
  .whenReady()
  .then(async () => {
    registerDesktopIpc()
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
  removeDesktopIpc()
})

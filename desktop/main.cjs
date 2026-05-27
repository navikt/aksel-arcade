const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const DEFAULT_RENDERER_URL = 'http://127.0.0.1:5173/aksel-arcade/'
const DIST_DIR = path.resolve(__dirname, '..', 'dist')
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
}

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
  ipcMain.removeHandler(SHELL_CAPABILITIES_CHANNEL)
})

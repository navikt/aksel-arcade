import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const desktopMainPath = resolve(process.cwd(), 'desktop/main.cjs')
const desktopDir = resolve(process.cwd(), 'desktop')

interface RunDesktopMainOptions {
  isPackaged: boolean
  env?: Record<string, string | undefined>
}

const runDesktopMain = async ({ isPackaged, env = {} }: RunDesktopMainOptions) => {
  const source = readFileSync(desktopMainPath, 'utf8')
  const loadedUrls: string[] = []
  let resolveRendererLoad: (() => void) | null = null
  const rendererLoaded = new Promise<void>((resolveLoaded) => {
    resolveRendererLoad = resolveLoaded
  })

  const browserWindows: MockBrowserWindow[] = []

  class MockBrowserWindow {
    static getAllWindows = vi.fn(() => browserWindows)

    webContents = {
      id: browserWindows.length + 1,
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
    }

    on = vi.fn()
    isDestroyed = vi.fn(() => false)
    loadURL = vi.fn((url: string) => {
      loadedUrls.push(url)
      resolveRendererLoad?.()
      return Promise.resolve()
    })

    constructor() {
      browserWindows.push(this)
    }
  }

  const app = {
    isPackaged,
    setName: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn(),
  }
  const ipcMain = {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
  const net = {
    fetch: vi.fn(),
  }
  const protocol = {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  }
  const desktopMcpServer = {
    getState: vi.fn(() => ({
      serverName: 'aksel-arcade',
      transportLabel: 'HTTP (MCP Streamable HTTP)',
      url: 'http://127.0.0.1:3846/mcp',
      requiresAuth: false,
      authDescription: 'No token/header required.',
      availability: { status: 'available' },
    })),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve(true)),
  }
  const processMock = {
    env: { ...process.env, ...env },
    platform: process.platform,
    once: vi.fn(),
    exitCode: 0,
  }

  runInNewContext(
    source,
    {
      require: (request: string) => {
        if (request === 'electron') {
          return { app, BrowserWindow: MockBrowserWindow, ipcMain, net, protocol }
        }
        if (request === './mcpServer.cjs') {
          return {
            createDesktopMcpServer: () => desktopMcpServer,
          }
        }
        return require(request)
      },
      module: { exports: {} },
      exports: {},
      __dirname: desktopDir,
      __filename: desktopMainPath,
      process: processMock,
      console,
      URL,
      Response,
      setTimeout,
      clearTimeout,
    },
    { filename: desktopMainPath }
  )

  await Promise.race([
    rendererLoaded,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('Desktop renderer did not load.')), 1_000)
    ),
  ])

  return {
    app,
    loadedUrls,
    protocol,
  }
}

describe('desktop main process', () => {
  it('loads the packaged Desktop renderer through the app protocol', async () => {
    const { loadedUrls, protocol } = await runDesktopMain({
      isPackaged: true,
      env: {
        AKSEL_ARCADE_RENDERER_URL: 'http://127.0.0.1:5173/aksel-arcade/',
      },
    })

    expect(loadedUrls).toEqual(['aksel-arcade://app/index.html'])
    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: 'aksel-arcade',
        privileges: expect.objectContaining({
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
        }),
      },
    ])
    expect(protocol.handle).toHaveBeenCalledWith('aksel-arcade', expect.any(Function))
  })
})

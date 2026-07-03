import { describe, expect, it, vi } from 'vitest'

interface RunDesktopMainOptions {
  isPackaged: boolean
  env?: Record<string, string | undefined>
}

interface MockDesktopMcpServerOptions {
  mutateAnnotation?: (request: Record<string, unknown>) => Promise<unknown> | unknown
}

const runDesktopMain = async ({
  isPackaged,
  env = {},
}: RunDesktopMainOptions): Promise<{
  app: {
    isPackaged: boolean
    setName: ReturnType<typeof vi.fn>
    whenReady: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    quit: ReturnType<typeof vi.fn>
    exit: ReturnType<typeof vi.fn>
  }
  browserWindows: Array<{
    webContents: {
      id: number
      send: ReturnType<typeof vi.fn>
    }
  }>
  desktopMcpServerOptions: MockDesktopMcpServerOptions | null
  ipcListeners: Map<string, (...args: unknown[]) => void>
  loadedUrls: string[]
  protocol: {
    registerSchemesAsPrivileged: ReturnType<typeof vi.fn>
    handle: ReturnType<typeof vi.fn>
  }
}> => {
  vi.resetModules()

  const loadedUrls: string[] = []
  const ipcListeners = new Map<string, (...args: unknown[]) => void>()
  let desktopMcpServerOptions: MockDesktopMcpServerOptions | null = null
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
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      ipcListeners.set(channel, handler)
    }),
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
      availability: { status: 'available' as const },
    })),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve(true)),
  }

  vi.stubEnv('AKSEL_ARCADE_RENDERER_URL', env.AKSEL_ARCADE_RENDERER_URL)

  vi.doMock('electron', () => ({
    app,
    BrowserWindow: MockBrowserWindow,
    ipcMain,
    net,
    protocol,
  }))

  vi.doMock('../../desktop/mcpSdkServer', () => ({
    createDesktopMcpServer: (options: MockDesktopMcpServerOptions) => {
      desktopMcpServerOptions = options
      return desktopMcpServer
    },
  }))

  const { startDesktopMainProcess } = await import('../../desktop/main-process')
  await startDesktopMainProcess()

  vi.unstubAllEnvs()

  return {
    app,
    browserWindows,
    desktopMcpServerOptions,
    ipcListeners,
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

  it('lets annotation mutations wait for the renderer target-resolution path', async () => {
    vi.useFakeTimers()
    try {
      const { browserWindows, desktopMcpServerOptions, ipcListeners } = await runDesktopMain({
        isPackaged: true,
      })

      const mutateAnnotation = desktopMcpServerOptions?.mutateAnnotation
      if (!mutateAnnotation) {
        throw new Error('Expected Desktop MCP annotation mutator to be registered')
      }

      const mutationPromise = mutateAnnotation({
        toolName: 'acknowledge_annotation',
        annotationId: 'ann-1',
      })

      const routeRequest = browserWindows[0].webContents.send.mock.calls.find(
        (call) => call[0] === 'aksel-arcade:route-desktop-mcp-annotation-mutation-request'
      )
      expect(routeRequest).toBeTruthy()

      await vi.advanceTimersByTimeAsync(6_000)

      const responseHandler = ipcListeners.get(
        'aksel-arcade:route-desktop-mcp-annotation-mutation-response'
      )
      if (!responseHandler) {
        throw new Error('Expected Desktop MCP annotation response handler to be registered')
      }

      responseHandler(
        { sender: { id: browserWindows[0].webContents.id } },
        {
          requestId: routeRequest![1].requestId,
          response: {
            ok: true,
            toolName: 'acknowledge_annotation',
            annotationId: 'ann-1',
            pageId: 'page01',
            message: 'Acknowledged annotation ann-1.',
            annotation: { id: 'ann-1', status: 'acknowledged' },
            annotations: [{ id: 'ann-1', status: 'acknowledged' }],
          },
        }
      )

      await expect(mutationPromise).resolves.toMatchObject({
        ok: true,
        annotationId: 'ann-1',
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const runDesktopPreload = () => {
  const preloadScript = readFileSync(resolve(process.cwd(), 'desktop/preload.cjs'), 'utf8')
  const ipcListeners = new Map<string, (...args: unknown[]) => void>()
  const exposedApis = new Map<string, Record<string, unknown>>()
  const ipcRenderer = {
    invoke: vi.fn(),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      ipcListeners.set(channel, handler)
    }),
    send: vi.fn(),
  }
  const contextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: Record<string, unknown>) => {
      exposedApis.set(key, api)
    }),
  }

  runInNewContext(
    preloadScript,
    {
      require: (request: string) => {
        if (request === 'electron') {
          return { contextBridge, ipcRenderer }
        }
        throw new Error(`Unexpected preload require: ${request}`)
      },
      console,
    },
    { filename: 'desktop/preload.cjs' }
  )

  return { exposedApis, ipcListeners, ipcRenderer }
}

describe('desktop preload script', () => {
  it('does not require project-local modules in the sandboxed preload context', () => {
    const preloadScript = readFileSync(resolve(process.cwd(), 'desktop/preload.cjs'), 'utf8')

    expect(preloadScript).not.toMatch(/require\(['"]\.\//)
  })

  it('routes Desktop MCP annotation mutation requests to the renderer handler', async () => {
    const { exposedApis, ipcListeners, ipcRenderer } = runDesktopPreload()
    const desktopApi = exposedApis.get('__AKSEL_ARCADE_DESKTOP__')
    const setDesktopMcpAnnotationHandler = desktopApi?.setDesktopMcpAnnotationHandler
    if (typeof setDesktopMcpAnnotationHandler !== 'function') {
      throw new Error('Expected Desktop preload API to expose setDesktopMcpAnnotationHandler')
    }

    const handler = vi.fn(async (request: Record<string, unknown>) => ({
      ok: true,
      toolName: request.toolName,
      annotationId: request.annotationId,
      pageId: 'page01',
      message: 'Acknowledged annotation ann-1.',
      annotation: { id: request.annotationId, status: 'acknowledged' },
      annotations: [{ id: request.annotationId, status: 'acknowledged' }],
    }))
    setDesktopMcpAnnotationHandler(handler)

    const routeRequest = ipcListeners.get(
      'aksel-arcade:route-desktop-mcp-annotation-mutation-request'
    )
    if (!routeRequest) {
      throw new Error('Expected annotation mutation IPC listener to be registered')
    }

    routeRequest(null, {
      requestId: 'mutation-1',
      toolName: 'acknowledge_annotation',
      annotationId: 'ann-1',
    })

    await vi.waitFor(() =>
      expect(ipcRenderer.send).toHaveBeenCalledWith(
        'aksel-arcade:route-desktop-mcp-annotation-mutation-response',
        {
          requestId: 'mutation-1',
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
    )

    expect(handler).toHaveBeenCalledWith({
      toolName: 'acknowledge_annotation',
      annotationId: 'ann-1',
    })
  })
})

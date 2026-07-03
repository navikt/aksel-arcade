import { describe, expect, it, vi } from 'vitest'
import {
  createDesktopMcpBridgeRoute,
  type DesktopMcpBridgePendingRequest,
} from '../../desktop/desktopMcpBridgeRouter'

interface MockRequest {
  label: string
}

interface MockResult {
  ok: boolean
  label: string
  code?: 'project-unavailable' | 'invalid-response'
  senderId?: number
}

interface MockPendingRequest extends DesktopMcpBridgePendingRequest<MockResult> {
  request: MockRequest
}

const createMockRoute = ({
  targetWindowAvailable = true,
  senderId = 7,
  timeoutMs = 1_000,
} = {}) => {
  const send = vi.fn()

  const route = createDesktopMcpBridgeRoute<MockRequest, MockResult, MockPendingRequest>({
    requestChannel: 'desktop-mcp:test-request',
    responseChannel: 'desktop-mcp:test-response',
    requestIdPrefix: 'desktop-mcp-test',
    timeoutMs,
    getTargetWindow: () =>
      targetWindowAvailable
        ? ({
            webContents: {
              id: senderId,
              send,
            },
          } as never)
        : null,
    buildRequestPayload: (requestId, request) => ({
      requestId,
      label: request.label,
    }),
    createPendingRequest: (request, resolve, timeout, webContentsId) => ({
      request,
      resolve,
      timeout,
      webContentsId,
    }),
    createNoTargetWindowResult: (request) => ({
      ok: false,
      code: 'project-unavailable',
      label: request.label,
    }),
    createTimeoutResult: (pendingRequest) => ({
      ok: false,
      code: 'project-unavailable',
      label: pendingRequest.request.label,
    }),
    createSendFailureResult: (pendingRequest) => ({
      ok: false,
      code: 'project-unavailable',
      label: pendingRequest.request.label,
    }),
    createInvalidResponseResult: (pendingRequest) => ({
      ok: false,
      code: 'invalid-response',
      label: pendingRequest.request.label,
    }),
    isResult: (value, pendingRequest): value is MockResult =>
      isRecord(value) &&
      typeof value.ok === 'boolean' &&
      value.label === pendingRequest.request.label &&
      (value.senderId === undefined || typeof value.senderId === 'number'),
  })

  return { route, send }
}

describe('desktopMcpBridgeRouter', () => {
  it('returns an explicit unavailable result when no renderer window is available', async () => {
    const { route, send } = createMockRoute({ targetWindowAvailable: false })

    await expect(route.route({ label: 'project/manifest' })).resolves.toEqual({
      ok: false,
      code: 'project-unavailable',
      label: 'project/manifest',
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('routes a request to the active renderer and resolves the matching response', async () => {
    const { route, send } = createMockRoute()

    const resultPromise = route.route({ label: 'project/manifest' })
    const requestPayload = send.mock.calls[0]?.[1] as { requestId: string; label: string }

    expect(send).toHaveBeenCalledWith('desktop-mcp:test-request', {
      requestId: requestPayload.requestId,
      label: 'project/manifest',
    })

    route.handleResponse(
      {
        sender: { id: 7 },
      } as never,
      {
        requestId: requestPayload.requestId,
        response: {
          ok: true,
          label: 'project/manifest',
          senderId: 7,
        },
      }
    )

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      label: 'project/manifest',
      senderId: 7,
    })
  })

  it('keeps waiting when the response comes from a different renderer sender', async () => {
    const { route, send } = createMockRoute()

    const resultPromise = route.route({ label: 'project/manifest' })
    const requestPayload = send.mock.calls[0]?.[1] as { requestId: string }
    let settled = false
    void resultPromise.then(() => {
      settled = true
    })

    route.handleResponse(
      {
        sender: { id: 99 },
      } as never,
      {
        requestId: requestPayload.requestId,
        response: {
          ok: true,
          label: 'project/manifest',
          senderId: 99,
        },
      }
    )

    await Promise.resolve()
    expect(settled).toBe(false)

    route.handleResponse(
      {
        sender: { id: 7 },
      } as never,
      {
        requestId: requestPayload.requestId,
        response: {
          ok: true,
          label: 'project/manifest',
          senderId: 7,
        },
      }
    )

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      label: 'project/manifest',
      senderId: 7,
    })
  })

  it('returns an explicit invalid-response result when the renderer response shape is wrong', async () => {
    const { route, send } = createMockRoute()

    const resultPromise = route.route({ label: 'project/manifest' })
    const requestPayload = send.mock.calls[0]?.[1] as { requestId: string }

    route.handleResponse(
      {
        sender: { id: 7 },
      } as never,
      {
        requestId: requestPayload.requestId,
        response: {
          ok: true,
          label: 'different-resource',
        },
      }
    )

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      code: 'invalid-response',
      label: 'project/manifest',
    })
  })

  it('returns a timeout result when the renderer never responds', async () => {
    vi.useFakeTimers()
    try {
      const { route } = createMockRoute({ timeoutMs: 5_000 })

      const resultPromise = route.route({ label: 'project/manifest' })
      await vi.advanceTimersByTimeAsync(5_000)

      await expect(resultPromise).resolves.toEqual({
        ok: false,
        code: 'project-unavailable',
        label: 'project/manifest',
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

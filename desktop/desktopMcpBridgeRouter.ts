import type { BrowserWindow, IpcMainEvent } from 'electron'

export interface DesktopMcpBridgePendingRequest<Result> {
  resolve: (value: Result) => void
  timeout: ReturnType<typeof setTimeout>
  webContentsId: number
}

interface DesktopMcpBridgeResponsePayload {
  requestId: string
  response: unknown
}

interface DesktopMcpBridgeTargetWindow {
  webContents: Pick<BrowserWindow['webContents'], 'id' | 'send'>
}

interface DesktopMcpBridgeRouteOptions<
  Request,
  Result,
  Pending extends DesktopMcpBridgePendingRequest<Result>,
> {
  requestChannel: string
  responseChannel: string
  requestIdPrefix: string
  timeoutMs: number
  getTargetWindow: () => DesktopMcpBridgeTargetWindow | null
  buildRequestPayload: (requestId: string, request: Request) => Record<string, unknown>
  createPendingRequest: (
    request: Request,
    resolve: (value: Result) => void,
    timeout: ReturnType<typeof setTimeout>,
    webContentsId: number
  ) => Pending
  createNoTargetWindowResult: (request: Request) => Result
  createTimeoutResult: (pendingRequest: Pending) => Result
  createSendFailureResult: (pendingRequest: Pending) => Result
  createInvalidResponseResult: (pendingRequest: Pending) => Result
  isResult: (value: unknown, pendingRequest: Pending) => value is Result
}

export interface DesktopMcpBridgeRoute<
  Request,
  Result,
  Pending extends DesktopMcpBridgePendingRequest<Result>,
> {
  requestChannel: string
  responseChannel: string
  route: (request: Request) => Promise<Result>
  handleResponse: (event: IpcMainEvent, payload: unknown) => void
  resolvePending: (responseFactory: (pendingRequest: Pending) => Result) => void
}

export const createDesktopMcpBridgeRoute = <
  Request,
  Result,
  Pending extends DesktopMcpBridgePendingRequest<Result>,
>({
  requestChannel,
  responseChannel,
  requestIdPrefix,
  timeoutMs,
  getTargetWindow,
  buildRequestPayload,
  createPendingRequest,
  createNoTargetWindowResult,
  createTimeoutResult,
  createSendFailureResult,
  createInvalidResponseResult,
  isResult,
}: DesktopMcpBridgeRouteOptions<Request, Result, Pending>): DesktopMcpBridgeRoute<
  Request,
  Result,
  Pending
> => {
  let nextRequestId = 0
  const pendingRequests = new Map<string, Pending>()

  const route = (request: Request): Promise<Result> => {
    const targetWindow = getTargetWindow()
    if (!targetWindow) {
      return Promise.resolve(createNoTargetWindowResult(request))
    }

    const requestId = `${requestIdPrefix}-${++nextRequestId}`

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const pendingRequest = pendingRequests.get(requestId)
        if (!pendingRequest) {
          return
        }

        pendingRequests.delete(requestId)
        resolve(createTimeoutResult(pendingRequest))
      }, timeoutMs)

      const pendingRequest = createPendingRequest(
        request,
        resolve,
        timeout,
        targetWindow.webContents.id
      )

      pendingRequests.set(requestId, pendingRequest)

      try {
        targetWindow.webContents.send(requestChannel, buildRequestPayload(requestId, request))
      } catch {
        pendingRequests.delete(requestId)
        clearTimeout(timeout)
        resolve(createSendFailureResult(pendingRequest))
      }
    })
  }

  const handleResponse = (event: IpcMainEvent, payload: unknown): void => {
    if (!isDesktopMcpBridgeResponsePayload(payload)) {
      return
    }

    const pendingRequest = pendingRequests.get(payload.requestId)
    if (!pendingRequest || pendingRequest.webContentsId !== event.sender.id) {
      return
    }

    pendingRequests.delete(payload.requestId)
    clearTimeout(pendingRequest.timeout)

    if (!isResult(payload.response, pendingRequest)) {
      pendingRequest.resolve(createInvalidResponseResult(pendingRequest))
      return
    }

    pendingRequest.resolve(payload.response)
  }

  const resolvePending = (responseFactory: (pendingRequest: Pending) => Result) => {
    for (const [requestId, pendingRequest] of pendingRequests) {
      pendingRequests.delete(requestId)
      clearTimeout(pendingRequest.timeout)
      pendingRequest.resolve(responseFactory(pendingRequest))
    }
  }

  return {
    requestChannel,
    responseChannel,
    route,
    handleResponse,
    resolvePending,
  }
}

const isDesktopMcpBridgeResponsePayload = (
  value: unknown
): value is DesktopMcpBridgeResponsePayload =>
  isRecord(value) && typeof value.requestId === 'string' && 'response' in value

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

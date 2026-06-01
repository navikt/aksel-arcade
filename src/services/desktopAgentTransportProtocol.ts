import {
  isAgentBridgeCommandName,
  type AgentBridgeCommandRouter,
  type AgentBridgeMaybeAsyncRoutedCommandResult,
  type AgentBridgeErrorCode,
  type AgentBridgeRoutedCommandResult,
} from './agentBridge'
import type { AgentBridgeSession } from './agentBridge'

export type DesktopAgentTransportJsonRpcId = string | number | null

export interface DesktopAgentTransportRouteRequest {
  id: DesktopAgentTransportJsonRpcId
  method: string
  params?: unknown
  sessionId: string
}

export interface DesktopAgentTransportErrorData {
  code: string
  command?: string
  bridgeError?: {
    code: AgentBridgeErrorCode
    message: string
  }
}

export interface DesktopAgentTransportJsonRpcError {
  code: number
  message: string
  data: DesktopAgentTransportErrorData
}

export type DesktopAgentTransportRouteResponse =
  | {
      jsonrpc: '2.0'
      id: DesktopAgentTransportJsonRpcId
      result: AgentBridgeRoutedCommandResult
    }
  | {
      jsonrpc: '2.0'
      id: DesktopAgentTransportJsonRpcId
      error: DesktopAgentTransportJsonRpcError
    }

export type DesktopAgentTransportRequestHandler = (
  request: DesktopAgentTransportRouteRequest
) => MaybePromise<DesktopAgentTransportRouteResponse>

type MaybePromise<T> = T | Promise<T>

export const createDesktopAgentTransportErrorResponse = (
  id: DesktopAgentTransportJsonRpcId,
  jsonRpcCode: number,
  code: string,
  message: string,
  data: Omit<DesktopAgentTransportErrorData, 'code'> = {}
): DesktopAgentTransportRouteResponse => ({
  jsonrpc: '2.0',
  id,
  error: {
    code: jsonRpcCode,
    message,
    data: {
      code,
      ...data,
    },
  },
})

export const createDesktopAgentTransportSuccessResponse = (
  id: DesktopAgentTransportJsonRpcId,
  result: AgentBridgeRoutedCommandResult
): DesktopAgentTransportRouteResponse => ({
  jsonrpc: '2.0',
  id,
  result,
})

export const routeDesktopAgentTransportRequest = (
  request: DesktopAgentTransportRouteRequest,
  {
    router,
    session,
  }: {
    router: AgentBridgeCommandRouter
    session: AgentBridgeSession
  }
): MaybePromise<DesktopAgentTransportRouteResponse> => {
  if (request.sessionId !== session.id) {
    return createDesktopAgentTransportErrorResponse(
      request.id,
      -32001,
      'session-mismatch',
      'Agent transport request does not belong to the active renderer session.'
    )
  }

  const method = request.method
  if (!isAgentBridgeCommandName(method)) {
    return createDesktopAgentTransportErrorResponse(
      request.id,
      -32601,
      'unsupported-method',
      `Unsupported Agent transport method "${method}". Supported methods: ${router.commandNames.join(
        ', '
      )}.`
    )
  }

  const result =
    method === 'applyAgentChange'
      ? router.routeCommand(method, request.params)
      : router.routeCommand(method)

  if (isPromiseLike(result)) {
    return result.then((resolvedResult) => toTransportResponse(request.id, resolvedResult))
  }

  return toTransportResponse(request.id, result)
}

const toTransportResponse = (
  id: DesktopAgentTransportJsonRpcId,
  result: AgentBridgeRoutedCommandResult
): DesktopAgentTransportRouteResponse => {
  if (!result.ok) {
    return createDesktopAgentTransportErrorResponse(
      id,
      -32002,
      result.error.code,
      result.error.message,
      {
        command: result.command,
        bridgeError: result.error,
      }
    )
  }

  return createDesktopAgentTransportSuccessResponse(id, result)
}

const isPromiseLike = (
  value: AgentBridgeMaybeAsyncRoutedCommandResult
): value is Promise<AgentBridgeRoutedCommandResult> =>
  typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function'

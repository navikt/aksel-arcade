const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'
const ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL = 'aksel-arcade:route-agent-transport-request'
const ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL = 'aksel-arcade:route-agent-transport-response'

let agentTransportRequestHandler = null

ipcRenderer.on(ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL, (_event, payload) => {
  void routeAgentTransportRequest(payload)
})

const routeAgentTransportRequest = async (payload) => {
  const requestId =
    isRecord(payload) && typeof payload.requestId === 'string' ? payload.requestId : null
  if (!requestId) {
    return
  }

  const request = parseAgentTransportRouteRequest(payload)
  if (!request) {
    ipcRenderer.send(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, {
      requestId,
      response: createRouteErrorResponse(
        getPayloadJsonRpcId(payload),
        -32600,
        'invalid-route-request',
        'Desktop Agent transport route request from the main process was invalid.'
      ),
    })
    return
  }

  if (!agentTransportRequestHandler) {
    ipcRenderer.send(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, {
      requestId,
      response: createRouteErrorResponse(
        request.id,
        -32003,
        'route-handler-unavailable',
        'Desktop Agent transport route handler is unavailable in the renderer.'
      ),
    })
    return
  }

  try {
    const response = await agentTransportRequestHandler(request)
    ipcRenderer.send(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, {
      requestId,
      response,
    })
  } catch (error) {
    ipcRenderer.send(ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL, {
      requestId,
      response: createRouteErrorResponse(
        request.id,
        -32603,
        'route-handler-failed',
        error instanceof Error
          ? error.message
          : 'Desktop Agent transport route handler failed unexpectedly.'
      ),
    })
  }
}

contextBridge.exposeInMainWorld(
  '__AKSEL_ARCADE_DESKTOP__',
  Object.freeze({
    getShellCapabilities: () => ipcRenderer.invoke(SHELL_CAPABILITIES_CHANNEL),
    startAgentTransportSession: (session) =>
      ipcRenderer.invoke(START_AGENT_TRANSPORT_CHANNEL, session),
    stopAgentTransportSession: (sessionId, reason) =>
      ipcRenderer.invoke(STOP_AGENT_TRANSPORT_CHANNEL, { sessionId, reason }),
    setAgentTransportRequestHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error('Desktop Agent transport request handler must be a function or null.')
      }
      agentTransportRequestHandler = handler
    },
  })
)

const parseAgentTransportRouteRequest = (payload) => {
  if (
    !isRecord(payload) ||
    !isJsonRpcId(payload.id) ||
    typeof payload.method !== 'string' ||
    payload.method.trim().length === 0 ||
    typeof payload.sessionId !== 'string' ||
    payload.sessionId.length === 0
  ) {
    return null
  }

  return {
    id: payload.id,
    method: payload.method,
    ...(payload.params !== undefined ? { params: payload.params } : {}),
    sessionId: payload.sessionId,
  }
}

const getPayloadJsonRpcId = (payload) =>
  isRecord(payload) && isJsonRpcId(payload.id) ? payload.id : null

const createRouteErrorResponse = (id, jsonRpcCode, code, message) => ({
  jsonrpc: '2.0',
  id,
  error: {
    code: jsonRpcCode,
    message,
    data: {
      code,
    },
  },
})

const isJsonRpcId = (value) =>
  value === null || typeof value === 'string' || typeof value === 'number'

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

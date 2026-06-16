const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const GET_DESKTOP_MCP_SERVER_STATE_CHANNEL = 'aksel-arcade:get-desktop-mcp-server-state'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'
const ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL = 'aksel-arcade:route-agent-transport-request'
const ROUTE_AGENT_TRANSPORT_RESPONSE_CHANNEL = 'aksel-arcade:route-agent-transport-response'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-request'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-response'

let agentTransportRequestHandler = null
let desktopMcpProjectResourceReadHandler = null

ipcRenderer.on(ROUTE_AGENT_TRANSPORT_REQUEST_CHANNEL, (_event, payload) => {
  void routeAgentTransportRequest(payload)
})
ipcRenderer.on(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL, (_event, payload) => {
  void routeDesktopMcpProjectResourceRequest(payload)
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
        getRedactedAgentErrorMessage(
          error,
          'Desktop Agent transport route handler failed unexpectedly.'
        )
      ),
    })
  }
}

const routeDesktopMcpProjectResourceRequest = async (payload) => {
  const requestId =
    isRecord(payload) && typeof payload.requestId === 'string' ? payload.requestId : null
  if (!requestId) {
    return
  }

  const request = parseDesktopMcpProjectResourceRequest(payload)
  if (!request) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpProjectResourceFailure(
        'invalid-resource-uri',
        getPayloadResourceUri(payload),
        'Desktop MCP project resource read request from the main process was invalid.'
      ),
    })
    return
  }

  if (!desktopMcpProjectResourceReadHandler) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        request.uri,
        'Desktop MCP project resources are not available in the renderer yet.'
      ),
    })
    return
  }

  try {
    const response = await desktopMcpProjectResourceReadHandler(request)
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL, {
      requestId,
      response,
    })
  } catch (error) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        request.uri,
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP project resource read failed unexpectedly in the renderer.'
        )
      ),
    })
  }
}

contextBridge.exposeInMainWorld(
  '__AKSEL_ARCADE_DESKTOP__',
  Object.freeze({
    getShellCapabilities: () => ipcRenderer.invoke(SHELL_CAPABILITIES_CHANNEL),
    getDesktopMcpServerState: () => ipcRenderer.invoke(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL),
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
    setDesktopMcpProjectResourceReadHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error(
          'Desktop MCP project resource read handler must be a function or null.'
        )
      }
      desktopMcpProjectResourceReadHandler = handler
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

const parseDesktopMcpProjectResourceRequest = (payload) => {
  if (
    !isRecord(payload) ||
    typeof payload.uri !== 'string' ||
    payload.uri.trim().length === 0
  ) {
    return null
  }

  return {
    uri: payload.uri,
  }
}

const getPayloadResourceUri = (payload) =>
  isRecord(payload) && typeof payload.uri === 'string' ? payload.uri : ''

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

const createDesktopMcpProjectResourceFailure = (code, resourceUri, message) => ({
  ok: false,
  code,
  resourceUri,
  message,
})

const getRedactedAgentErrorMessage = (error, fallback) => {
  const message = error instanceof Error ? error.message : fallback
  return redactAgentHandoffSecrets(message)
}

const REDACTED_AGENT_PAIRING_DATA = '[redacted Agent pairing handoff]'
const REDACTED_AGENT_OPERATING_INSTRUCTIONS = '[redacted Agent operating instructions]'
const REDACTED_AGENT_ENDPOINT = '[redacted Agent endpoint]'
const REDACTED_AGENT_AUTHORIZATION = 'Authorization: Bearer [redacted]'
const REDACTED_AGENT_AUTHORIZATION_VALUE = 'Bearer [redacted]'

const AGENT_PAIRING_COMMAND_PATTERN =
  /\bcurl\b(?=[^\r\n]*getAgentInstructions)[^\r\n]*?--data\s+(?:"(?:\\.|[^"\\])*getAgentInstructions(?:\\.|[^"\\])*"|'(?:'\\''|\\.|[^'\\])*getAgentInstructions(?:'\\''|\\.|[^'\\])*'|[^\s'"`]*getAgentInstructions[^\s'"`]*)/gi
const LOOPBACK_ENDPOINT_PATTERN =
  /\bhttps?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/[^\s'"`<>)\]]*)?/gi
const AUTHORIZATION_HEADER_PATTERN = /\bAuthorization\s*:\s*Bearer\s+[^'",\s)}\]]+/gi
const BEARER_TOKEN_PATTERN = /\bBearer\s+(?!\[redacted\])[^'",\s)}\]]+/gi
const AUTHORIZATION_HEADER_VALUE_PATTERN =
  /(\bauthorizationHeader["']?\s*[:=]\s*["']?)Bearer\s+[^'",}\]\s]+(["']?)/gi
const PAIRING_CREDENTIAL_VALUE_PATTERN =
  /(\bpairingCredential["']?\s*[:=]\s*["']?)[^'",}\]\s]+(["']?)/gi
const INSTRUCTIONS_MARKDOWN_QUOTED_VALUE_PATTERN =
  /((?:"instructionsMarkdown"|'instructionsMarkdown'|\binstructionsMarkdown\b)\s*[:=]\s*)(["'])(?:\\[\s\S]|(?!\2)[\s\S])*?\2/gi
const INSTRUCTIONS_MARKDOWN_BARE_VALUE_PATTERN =
  /((?:"instructionsMarkdown"|'instructionsMarkdown'|\binstructionsMarkdown\b)\s*[:=]\s*)(?!["'])[^,\r\n}]*/gi

const redactAgentHandoffSecrets = (value) =>
  redactAgentOperatingInstructions(value)
    .replace(AGENT_PAIRING_COMMAND_PATTERN, REDACTED_AGENT_PAIRING_DATA)
    .replace(AUTHORIZATION_HEADER_VALUE_PATTERN, `$1${REDACTED_AGENT_AUTHORIZATION_VALUE}$2`)
    .replace(PAIRING_CREDENTIAL_VALUE_PATTERN, `$1${REDACTED_AGENT_PAIRING_DATA}$2`)
    .replace(AUTHORIZATION_HEADER_PATTERN, REDACTED_AGENT_AUTHORIZATION)
    .replace(BEARER_TOKEN_PATTERN, REDACTED_AGENT_AUTHORIZATION_VALUE)
    .replace(LOOPBACK_ENDPOINT_PATTERN, REDACTED_AGENT_ENDPOINT)

const redactAgentOperatingInstructions = (value) =>
  value
    .replace(
      INSTRUCTIONS_MARKDOWN_QUOTED_VALUE_PATTERN,
      (_match, prefix, quote) => `${prefix}${quote}${REDACTED_AGENT_OPERATING_INSTRUCTIONS}${quote}`
    )
    .replace(INSTRUCTIONS_MARKDOWN_BARE_VALUE_PATTERN, `$1${REDACTED_AGENT_OPERATING_INSTRUCTIONS}`)

const isJsonRpcId = (value) =>
  value === null || typeof value === 'string' || typeof value === 'number'

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

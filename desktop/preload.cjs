const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const GET_DESKTOP_MCP_SERVER_STATE_CHANNEL = 'aksel-arcade:get-desktop-mcp-server-state'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-request'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-response'
const ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-annotation-mutation-request'
const ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-annotation-mutation-response'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-request'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-response'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-request'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-response'

const desktopMcpHandlers = {
  projectResourceRead: null,
  annotationMutation: null,
  applyChanges: null,
  previewCapture: null,
}

const desktopMcpBridgeRoutes = [
  {
    handlerKey: 'projectResourceRead',
    requestChannel: ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL,
    responseChannel: ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL,
    parseRequest: (payload) => parseDesktopMcpProjectResourceRequest(payload),
    createInvalidRequestResponse: (payload) =>
      createDesktopMcpProjectResourceFailure(
        'invalid-resource-uri',
        getPayloadResourceUri(payload),
        'Desktop MCP project resource read request from the main process was invalid.'
      ),
    createUnavailableResponse: (request) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        request.uri,
        'Desktop MCP project resources are not available in the renderer yet.'
      ),
    createUnexpectedErrorResponse: (request, error) =>
      createDesktopMcpProjectResourceFailure(
        'project-unavailable',
        request.uri,
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP project resource read failed unexpectedly in the renderer.'
        )
      ),
  },
  {
    handlerKey: 'annotationMutation',
    requestChannel: ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_REQUEST_CHANNEL,
    responseChannel: ROUTE_DESKTOP_MCP_ANNOTATION_MUTATION_RESPONSE_CHANNEL,
    parseRequest: (payload) => parseDesktopMcpAnnotationMutationRequest(payload),
    createInvalidRequestResponse: (payload) =>
      createDesktopMcpAnnotationMutationFailure(
        'invalid-annotation-payload',
        getPayloadAnnotationId(payload),
        'Desktop MCP annotation mutation request from the main process was invalid.'
      ),
    createUnavailableResponse: (request) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        request.annotationId,
        'Desktop MCP annotation mutations are not available in the renderer yet.'
      ),
    createUnexpectedErrorResponse: (request, error) =>
      createDesktopMcpAnnotationMutationFailure(
        'project-unavailable',
        request.annotationId,
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP annotation mutation failed unexpectedly in the renderer.'
        )
      ),
  },
  {
    handlerKey: 'applyChanges',
    requestChannel: ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL,
    responseChannel: ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL,
    parseRequest: (payload) => parseDesktopMcpApplyChangesRequest(payload),
    createInvalidRequestResponse: () =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop MCP apply_changes route request from the main process was invalid.'
      ),
    createUnavailableResponse: () =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop MCP apply_changes is not available in the renderer yet.'
      ),
    createUnexpectedErrorResponse: (_request, error) =>
      createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP apply_changes failed unexpectedly in the renderer.'
        )
      ),
  },
  {
    handlerKey: 'previewCapture',
    requestChannel: ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL,
    responseChannel: ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL,
    parseRequest: (payload) => parseDesktopMcpPreviewCaptureRequest(payload),
    createInvalidRequestResponse: () =>
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop MCP capture_preview_evidence route request from the main process was invalid.'
      ),
    createUnavailableResponse: () =>
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop MCP capture_preview_evidence is not available in the renderer yet.'
      ),
    createUnexpectedErrorResponse: (_request, error) =>
      createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP capture_preview_evidence failed unexpectedly in the renderer.'
        )
      ),
  },
]

for (const route of desktopMcpBridgeRoutes) {
  ipcRenderer.on(route.requestChannel, (_event, payload) => {
    void routeDesktopMcpBridgeRequest(route, payload)
  })
}

const routeDesktopMcpBridgeRequest = async (route, payload) => {
  const requestId = getPayloadRequestId(payload)
  if (!requestId) {
    return
  }

  const request = route.parseRequest(payload)
  if (!request) {
    sendDesktopMcpBridgeResponse(
      route.responseChannel,
      requestId,
      route.createInvalidRequestResponse(payload)
    )
    return
  }

  const handler = desktopMcpHandlers[route.handlerKey]
  if (!handler) {
    sendDesktopMcpBridgeResponse(
      route.responseChannel,
      requestId,
      route.createUnavailableResponse(request)
    )
    return
  }

  try {
    const response = await handler(request)
    sendDesktopMcpBridgeResponse(route.responseChannel, requestId, response)
  } catch (error) {
    sendDesktopMcpBridgeResponse(
      route.responseChannel,
      requestId,
      route.createUnexpectedErrorResponse(request, error)
    )
  }
}

contextBridge.exposeInMainWorld(
  '__AKSEL_ARCADE_DESKTOP__',
  Object.freeze({
    getShellCapabilities: () => ipcRenderer.invoke(SHELL_CAPABILITIES_CHANNEL),
    getDesktopMcpServerState: () => ipcRenderer.invoke(GET_DESKTOP_MCP_SERVER_STATE_CHANNEL),
    setDesktopMcpProjectResourceReadHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error(
          'Desktop MCP project resource read handler must be a function or null.'
        )
      }
      desktopMcpHandlers.projectResourceRead = handler
    },
    setDesktopMcpAnnotationHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error('Desktop MCP annotation mutation handler must be a function or null.')
      }
      desktopMcpHandlers.annotationMutation = handler
    },
    setDesktopMcpApplyChangesHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error('Desktop MCP apply_changes handler must be a function or null.')
      }
      desktopMcpHandlers.applyChanges = handler
    },
    setDesktopMcpPreviewCaptureHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error(
          'Desktop MCP capture_preview_evidence handler must be a function or null.'
        )
      }
      desktopMcpHandlers.previewCapture = handler
    },
  })
)

const getPayloadRequestId = (payload) =>
  isRecord(payload) && typeof payload.requestId === 'string' ? payload.requestId : null

const sendDesktopMcpBridgeResponse = (channel, requestId, response) => {
  ipcRenderer.send(channel, {
    requestId,
    response,
  })
}

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

const parseDesktopMcpAnnotationMutationRequest = (payload) => {
  if (
    !isRecord(payload) ||
    typeof payload.toolName !== 'string' ||
    typeof payload.annotationId !== 'string' ||
    payload.annotationId.trim().length === 0
  ) {
    return null
  }

  return {
    toolName: payload.toolName,
    annotationId: payload.annotationId,
    ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
    ...(typeof payload.reason === 'string' ? { reason: payload.reason } : {}),
    ...(typeof payload.summary === 'string' ? { summary: payload.summary } : {}),
  }
}

const getPayloadAnnotationId = (payload) =>
  isRecord(payload) && typeof payload.annotationId === 'string' ? payload.annotationId : ''

const createDesktopMcpAnnotationMutationFailure = (code, annotationId, message) => ({
  ok: false,
  code,
  annotationId,
  message,
})

const parseDesktopMcpApplyChangesRequest = (payload) => {
  if (
    !isRecord(payload) ||
    typeof payload.summary !== 'string' ||
    payload.summary.trim().length === 0 ||
    !Array.isArray(payload.operations)
  ) {
    return null
  }

  return {
    summary: payload.summary,
    ...(typeof payload.expectedProjectRevision === 'string'
      ? { expectedProjectRevision: payload.expectedProjectRevision }
      : {}),
    operations: payload.operations,
    ...(isRecord(payload.assertions) ? { assertions: payload.assertions } : {}),
  }
}

const parseDesktopMcpPreviewCaptureRequest = (payload) => {
  if (!isRecord(payload)) {
    return null
  }

  const target = parseDesktopMcpPreviewCaptureTarget(payload.target)
  if (payload.target !== undefined && target === null) {
    return null
  }
  const interactions = parseDesktopMcpPreviewCaptureInteractions(payload.interactions)
  if (payload.interactions !== undefined && interactions === null) {
    return null
  }

  if (
    (payload.pageId !== undefined &&
      (typeof payload.pageId !== 'string' || payload.pageId.trim().length === 0)) ||
    (payload.viewportSize !== undefined && typeof payload.viewportSize !== 'string') ||
    (payload.theme !== undefined && typeof payload.theme !== 'string') ||
    (payload.includeAnnotationOverlays !== undefined &&
      typeof payload.includeAnnotationOverlays !== 'boolean') ||
    (payload.layers !== undefined &&
      (!Array.isArray(payload.layers) ||
        payload.layers.some((layer) => typeof layer !== 'string'))) ||
    (payload.screenshotScope !== undefined && typeof payload.screenshotScope !== 'string')
  ) {
    return null
  }

  return {
    ...(typeof payload.pageId === 'string' ? { pageId: payload.pageId } : {}),
    ...(typeof payload.viewportSize === 'string' ? { viewportSize: payload.viewportSize } : {}),
    ...(typeof payload.theme === 'string' ? { theme: payload.theme } : {}),
    ...(Array.isArray(payload.layers) ? { layers: payload.layers } : {}),
    ...(typeof payload.screenshotScope === 'string'
      ? { screenshotScope: payload.screenshotScope }
      : {}),
    ...(payload.includeAnnotationOverlays === true ? { includeAnnotationOverlays: true } : {}),
    ...(target ? { target } : {}),
    ...(interactions ? { interactions } : {}),
  }
}

const parseDesktopMcpPreviewCaptureInteractions = (value) => {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    return null
  }

  const interactions = []
  for (const step of value) {
    if (!isRecord(step) || typeof step.action !== 'string') {
      return null
    }

    const target = parseDesktopMcpPreviewCaptureTarget(step.target)
    if (step.target !== undefined && target === null) {
      return null
    }

    const parsedStep = {
      action: step.action,
    }

    if (target) {
      parsedStep.target = target
    }

    for (const key of ['value', 'key', 'text']) {
      if (step[key] === undefined) {
        continue
      }

      if (typeof step[key] !== 'string') {
        return null
      }

      parsedStep[key] = step[key]
    }

    for (const key of ['checked', 'renderIdle']) {
      if (step[key] === undefined) {
        continue
      }

      if (typeof step[key] !== 'boolean') {
        return null
      }

      parsedStep[key] = step[key]
    }

    for (const key of ['x', 'y', 'timeoutMs']) {
      if (step[key] === undefined) {
        continue
      }

      if (typeof step[key] !== 'number') {
        return null
      }

      parsedStep[key] = step[key]
    }

    interactions.push(parsedStep)
  }

  return interactions
}

const parseDesktopMcpPreviewCaptureTarget = (value) => {
  if (value === undefined) {
    return undefined
  }

  if (!isRecord(value)) {
    return null
  }

  const target = {}
  for (const key of ['selector', 'role', 'name', 'text', 'label']) {
    if (value[key] === undefined) {
      continue
    }

    if (typeof value[key] !== 'string') {
      return null
    }

    target[key] = value[key]
  }

  return target
}

const createDesktopMcpProjectResourceFailure = (code, resourceUri, message) => ({
  ok: false,
  code,
  resourceUri,
  message,
})

const createDesktopMcpApplyChangesFailure = (code, message) => ({
  ok: false,
  code,
  message,
})

const createDesktopMcpPreviewCaptureFailure = (code, message, extras = {}) => ({
  ok: false,
  code,
  message,
  ...extras,
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

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

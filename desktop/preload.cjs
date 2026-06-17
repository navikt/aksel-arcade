const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const GET_DESKTOP_MCP_SERVER_STATE_CHANNEL = 'aksel-arcade:get-desktop-mcp-server-state'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-request'
const ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-project-resource-response'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-request'
const ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-apply-changes-response'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-request'
const ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL =
  'aksel-arcade:route-desktop-mcp-preview-capture-response'

let desktopMcpProjectResourceReadHandler = null
let desktopMcpApplyChangesHandler = null
let desktopMcpPreviewCaptureHandler = null

ipcRenderer.on(ROUTE_DESKTOP_MCP_PROJECT_RESOURCE_REQUEST_CHANNEL, (_event, payload) => {
  void routeDesktopMcpProjectResourceRequest(payload)
})
ipcRenderer.on(ROUTE_DESKTOP_MCP_APPLY_CHANGES_REQUEST_CHANNEL, (_event, payload) => {
  void routeDesktopMcpApplyChangesRequest(payload)
})
ipcRenderer.on(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_REQUEST_CHANNEL, (_event, payload) => {
  void routeDesktopMcpPreviewCaptureRequest(payload)
})

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

const routeDesktopMcpApplyChangesRequest = async (payload) => {
  const requestId =
    isRecord(payload) && typeof payload.requestId === 'string' ? payload.requestId : null
  if (!requestId) {
    return
  }

  const request = parseDesktopMcpApplyChangesRequest(payload)
  if (!request) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop MCP apply_changes route request from the main process was invalid.'
      ),
    })
    return
  }

  if (!desktopMcpApplyChangesHandler) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        'Desktop MCP apply_changes is not available in the renderer yet.'
      ),
    })
    return
  }

  try {
    const response = await desktopMcpApplyChangesHandler(request)
    ipcRenderer.send(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, {
      requestId,
      response,
    })
  } catch (error) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_APPLY_CHANGES_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpApplyChangesFailure(
        'project-unavailable',
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP apply_changes failed unexpectedly in the renderer.'
        )
      ),
    })
  }
}

const routeDesktopMcpPreviewCaptureRequest = async (payload) => {
  const requestId =
    isRecord(payload) && typeof payload.requestId === 'string' ? payload.requestId : null
  if (!requestId) {
    return
  }

  const request = parseDesktopMcpPreviewCaptureRequest(payload)
  if (!request) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop MCP capture_preview_evidence route request from the main process was invalid.'
      ),
    })
    return
  }

  if (!desktopMcpPreviewCaptureHandler) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        'Desktop MCP capture_preview_evidence is not available in the renderer yet.'
      ),
    })
    return
  }

  try {
    const response = await desktopMcpPreviewCaptureHandler(request)
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL, {
      requestId,
      response,
    })
  } catch (error) {
    ipcRenderer.send(ROUTE_DESKTOP_MCP_PREVIEW_CAPTURE_RESPONSE_CHANNEL, {
      requestId,
      response: createDesktopMcpPreviewCaptureFailure(
        'project-unavailable',
        getRedactedAgentErrorMessage(
          error,
          'Desktop MCP capture_preview_evidence failed unexpectedly in the renderer.'
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
    setDesktopMcpProjectResourceReadHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error(
          'Desktop MCP project resource read handler must be a function or null.'
        )
      }
      desktopMcpProjectResourceReadHandler = handler
    },
    setDesktopMcpApplyChangesHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error('Desktop MCP apply_changes handler must be a function or null.')
      }
      desktopMcpApplyChangesHandler = handler
    },
    setDesktopMcpPreviewCaptureHandler: (handler) => {
      if (handler !== null && typeof handler !== 'function') {
        throw new Error(
          'Desktop MCP capture_preview_evidence handler must be a function or null.'
        )
      }
      desktopMcpPreviewCaptureHandler = handler
    },
  })
)

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

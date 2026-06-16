const http = require('node:http')

const DESKTOP_MCP_HOST = '127.0.0.1'
const DESKTOP_MCP_PORT = 3846
const DESKTOP_MCP_PATH = '/mcp'
const DESKTOP_MCP_SERVER_NAME = 'desktop-arcade'
const DESKTOP_MCP_SERVER_VERSION = '0.0.0'
const DESKTOP_MCP_TRANSPORT_LABEL = 'HTTP (MCP Streamable HTTP)'
const DESKTOP_MCP_AUTH_DESCRIPTION = 'No token/header required.'
const DESKTOP_MCP_PROTOCOL_VERSION = '2024-11-05'
const MAX_MCP_BODY_BYTES = 1024 * 1024
const DEFAULT_PREVIEW_CAPTURE_TTL_MS = 5 * 60 * 1000
const VALID_VIEWPORT_SIZES = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS']
const VALID_THEMES = ['light', 'dark']
const VALID_PREVIEW_CAPTURE_LAYERS = ['screenshot', 'frame']
const VALID_PREVIEW_SCREENSHOT_SCOPES = ['viewport', 'full_page', 'region']
const APPLY_CHANGES_OPERATION_TYPES = [
  'replace_source',
  'create_page',
  'rename_page',
  'delete_page',
  'set_start_page',
  'select_active_page',
  'set_preview_context',
  'rename_project',
]
const PAGE_REF_PLACEHOLDER_SYNTAX = '{{pageRef:name}}'
const CAPABILITY_PREVIEW_CAPTURE_LAYERS = [
  'screenshot',
  'accessibility',
  'dom_layout_style',
  'frame',
]
const CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES = Object.freeze({
  screenshot: 'visual appearance and spatial gestalt',
  accessibility:
    'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
  dom_layout_style:
    'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
  frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
})
const CAPABILITY_PREVIEW_INTERACTION_ACTIONS = [
  'click',
  'fill',
  'select',
  'press',
  'scroll',
  'waitFor',
]
const CAPABILITY_SOURCE_URI_TEMPLATES = Object.freeze([
  'arcade://project/source/global/jsx',
  'arcade://project/source/global/hooks',
  'arcade://project/source/pages/{pageId}/jsx',
  'arcade://project/source/pages/{pageId}/hooks',
])
const CAPABILITY_PREVIEW_EVIDENCE_URI_TEMPLATES = Object.freeze([
  'arcade://preview/captures/{captureId}/manifest',
  'arcade://preview/captures/{captureId}/screenshot',
  'arcade://preview/captures/{captureId}/frame',
  'arcade://preview/captures/{captureId}/accessibility',
  'arcade://preview/captures/{captureId}/dom-layout-style',
])
const CAPABILITY_V1_OMISSIONS = Object.freeze([
  'No prompts surface.',
  'No SSE subscriptions or list-changed notifications.',
  'No general filesystem, network, shell, or clipboard access.',
  'No import, export, Share URL, or Arcade project package tools.',
  'No arbitrary JavaScript execution.',
  'No visual diff API.',
  'No Web Arcade MCP endpoint.',
])
const PROJECT_SOURCE_PAGE_URI_PATTERN = /^arcade:\/\/project\/source\/pages\/(page\d+)\/(jsx|hooks)$/
const PREVIEW_CAPTURE_RESOURCE_URI_PATTERN =
  /^arcade:\/\/preview\/captures\/([a-z0-9-]+)\/(manifest|screenshot|frame)$/

const MCP_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: 'capture_preview_evidence',
    description: 'Capture targeted Preview evidence for the active Arcade project.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        pageId: Object.freeze({
          type: 'string',
          description: 'Optional Arcade page id to capture.',
        }),
        viewportSize: Object.freeze({
          type: 'string',
          enum: VALID_VIEWPORT_SIZES,
          description: 'Optional capture-only viewport override.',
        }),
        theme: Object.freeze({
          type: 'string',
          enum: VALID_THEMES,
          description: 'Optional capture-only theme override.',
        }),
        layers: Object.freeze({
          type: 'array',
          uniqueItems: true,
          items: Object.freeze({
            type: 'string',
            enum: VALID_PREVIEW_CAPTURE_LAYERS,
          }),
          description: 'Optional requested baseline evidence layers.',
        }),
        screenshotScope: Object.freeze({
          type: 'string',
          enum: VALID_PREVIEW_SCREENSHOT_SCOPES,
          description: 'Optional screenshot scope for the capture.',
        }),
        target: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            selector: Object.freeze({
              type: 'string',
              description: 'Preview-root-scoped CSS selector for region screenshots.',
            }),
            role: Object.freeze({
              type: 'string',
              description: 'Accessibility role filter for region screenshots.',
            }),
            name: Object.freeze({
              type: 'string',
              description: 'Accessible name filter for region screenshots.',
            }),
            text: Object.freeze({
              type: 'string',
              description: 'Visible text filter for region screenshots.',
            }),
            label: Object.freeze({
              type: 'string',
              description: 'Associated label filter for region screenshots.',
            }),
          }),
          description:
            'Optional preview-root selector or accessibility target for region screenshots.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'apply_changes',
    description: 'Apply a validated, durable batch of Arcade project changes.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['summary', 'operations']),
      properties: Object.freeze({
        summary: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Required human-readable summary for the batch.',
        }),
        expectedProjectRevision: Object.freeze({
          type: 'string',
          description: 'Optional stale-state protection revision.',
        }),
        operations: Object.freeze({
          type: 'array',
          minItems: 1,
          description: 'Ordered batch operations for source, page lifecycle, preview, or project metadata.',
          items: Object.freeze({
            type: 'object',
            additionalProperties: false,
            required: Object.freeze(['type']),
            properties: Object.freeze({
              type: Object.freeze({
                type: 'string',
                enum: Object.freeze(APPLY_CHANGES_OPERATION_TYPES),
              }),
              resourceUri: Object.freeze({
                type: 'string',
                description: 'Existing source resource URI from the project manifest.',
              }),
              content: Object.freeze({
                type: 'string',
                description:
                  'Full source replacement content for replace_source operations. Supports {{pageRef:name}} placeholders when the batch declares matching create_page.newPageRef values earlier.',
              }),
              pageId: Object.freeze({
                type: 'string',
                description: 'Existing permanent Arcade page id for page lifecycle operations.',
              }),
              tempPageRef: Object.freeze({
                type: 'string',
                description:
                  'Temporary page ref declared by create_page.newPageRef earlier in the same batch.',
              }),
              newPageRef: Object.freeze({
                type: 'string',
                description:
                  'Optional temporary page ref that later operations and {{pageRef:name}} placeholders can use inside the same batch.',
              }),
              jsxCode: Object.freeze({
                type: 'string',
                description:
                  'Optional initial JSX source for create_page operations. Supports {{pageRef:name}} placeholders.',
              }),
              hooksCode: Object.freeze({
                type: 'string',
                description:
                  'Optional initial Hooks source for create_page operations. Supports {{pageRef:name}} placeholders.',
              }),
              viewportSize: Object.freeze({
                type: 'string',
                enum: VALID_VIEWPORT_SIZES,
              }),
              theme: Object.freeze({
                type: 'string',
                enum: VALID_THEMES,
              }),
              name: Object.freeze({
                type: 'string',
                description: 'Replacement project name for rename_project operations.',
              }),
            }),
          }),
        }),
      }),
    }),
  }),
])

const MCP_STABLE_RESOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    uri: 'arcade://desktop/operating-guide',
    name: 'Desktop Arcade MCP operating guide',
    description: 'Short operating instructions for the Desktop Arcade MCP server.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/authoring-guide',
    name: 'Desktop Arcade MCP authoring guide',
    description: 'Short Arcade authoring guidance for MCP clients.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/capabilities',
    name: 'Desktop Arcade MCP capabilities',
    description: 'Machine-readable Desktop Arcade MCP contract and omissions.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/manifest',
    name: 'Active Arcade project manifest',
    description: 'Primary discovery resource for the active Arcade project.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/preview-context',
    name: 'Active Arcade project preview context',
    description: 'Saved preview theme and viewport preferences for the active Arcade project.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/diagnostics',
    name: 'Active Arcade project diagnostics',
    description: 'Compact Arcade-scoped diagnostics for the active Arcade project.',
    mimeType: 'application/json',
  }),
])

const TOOL_EXECUTION_STATUS = Object.freeze({
  capture_preview_evidence: 'available when an active preview capture bridge is connected',
  apply_changes: 'available when an active project writer is connected',
})

const PREVIEW_EVIDENCE_URI_TEMPLATE_STATUS = Object.freeze({
  'arcade://preview/captures/{captureId}/manifest':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/screenshot':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/frame':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/accessibility': 'not-yet-implemented',
  'arcade://preview/captures/{captureId}/dom-layout-style': 'not-yet-implemented',
})

const CAPTURE_LAYER_STATUS = Object.freeze({
  screenshot: 'available',
  accessibility: 'not-yet-implemented',
  dom_layout_style: 'not-yet-implemented',
  frame: 'available',
})

const SCREENSHOT_SCOPE_STATUS = Object.freeze({
  viewport: 'available',
  full_page: 'available',
  region: 'available',
})

const INTERACTION_ACTION_STATUS = Object.freeze(
  CAPABILITY_PREVIEW_INTERACTION_ACTIONS.reduce((status, action) => {
    status[action] = 'not-yet-implemented'
    return status
  }, {})
)

const createDesktopMcpServer = ({
  host = DESKTOP_MCP_HOST,
  port = DESKTOP_MCP_PORT,
  path = DESKTOP_MCP_PATH,
  readProjectResource = createProjectUnavailableResourceResult,
  applyChanges = createProjectUnavailableApplyChangesResult,
  capturePreviewEvidence = createProjectUnavailableCapturePreviewResult,
  previewCaptureTtlMs = DEFAULT_PREVIEW_CAPTURE_TTL_MS,
} = {}) => {
  let activeServer = null
  let startOperation = null
  let lastActivity = null
  const previewCaptureStore = createPreviewCaptureStore({ ttlMs: previewCaptureTtlMs })
  let availability = {
    status: 'unavailable',
    reason: 'Desktop Arcade MCP has not started yet.',
  }

  const getPort = () => {
    const address = activeServer?.address()
    return address && typeof address !== 'string' ? address.port : port
  }

  const getState = () => ({
    serverName: DESKTOP_MCP_SERVER_NAME,
    transportLabel: DESKTOP_MCP_TRANSPORT_LABEL,
    url: `http://${host}:${getPort()}${path}`,
    requiresAuth: false,
    authDescription: DESKTOP_MCP_AUTH_DESCRIPTION,
    lastActivity,
    availability:
      availability.status === 'available'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: availability.reason,
          },
  })

  const start = async () => {
    if (activeServer?.listening) {
      availability = { status: 'available' }
      return getState()
    }

    if (startOperation) {
      return startOperation
    }

    const nextServer = http.createServer((request, response) => {
      handleDesktopMcpRequest(request, response, {
        host,
        path,
        port: getPort(),
        previewCaptureStore,
        readProjectResource,
        applyChanges: async (requestPayload) => {
          const applyChangesResult = await applyChanges(requestPayload)
          if (isApplyChangesResult(applyChangesResult) && applyChangesResult.ok) {
            lastActivity = applyChangesResult.safeActivity
          }
          return applyChangesResult
        },
        capturePreviewEvidence: async (requestPayload) => {
          const captureResult = await capturePreviewEvidence(requestPayload)
          if (isCapturePreviewResult(captureResult) && captureResult.ok) {
            previewCaptureStore.store(captureResult)
            lastActivity = captureResult.safeActivity
          }
          return captureResult
        },
      })
    })

    startOperation = new Promise((resolve) => {
      const handleListening = () => {
        cleanupListeners()
        activeServer = nextServer
        availability = { status: 'available' }
        resolve(getState())
      }

      const handleError = (error) => {
        cleanupListeners()
        activeServer = null
        availability = {
          status: 'unavailable',
          reason: formatServerErrorReason(error, { host, port }),
        }
        void closeServer(nextServer)
        resolve(getState())
      }

      const cleanupListeners = () => {
        nextServer.off('error', handleError)
        nextServer.off('listening', handleListening)
      }

      nextServer.once('error', handleError)
      nextServer.once('listening', handleListening)
      nextServer.listen(port, host)
    }).finally(() => {
      startOperation = null
    })

    return startOperation
  }

  const stop = async () => {
    if (!activeServer) {
      return false
    }

    const serverToClose = activeServer
    activeServer = null
    availability = {
      status: 'unavailable',
      reason: 'Desktop Arcade MCP is not available.',
    }
    await closeServer(serverToClose)
    return true
  }

  return {
    getState,
    start,
    stop,
  }
}

const validateApplyChangesPageTarget = (operation, index, operationType, extraAllowedKeys = []) => {
  const extraKeys = getUnexpectedKeys(operation, [
    'type',
    'pageId',
    'tempPageRef',
    ...extraAllowedKeys,
  ])
  if (extraKeys.length > 0) {
    return `apply_changes ${operationType} operation ${index} contains unsupported fields: ${extraKeys.join(
      ', '
    )}.`
  }

  const hasPageId = operation.pageId !== undefined
  const hasTempPageRef = operation.tempPageRef !== undefined
  if ((hasPageId && hasTempPageRef) || (!hasPageId && !hasTempPageRef)) {
    return `apply_changes ${operationType} operation ${index} must provide exactly one of pageId or tempPageRef.`
  }

  if (
    hasPageId &&
    (typeof operation.pageId !== 'string' || operation.pageId.trim().length === 0)
  ) {
    return `apply_changes ${operationType} operation ${index} pageId must be a non-empty string.`
  }

  if (
    hasTempPageRef &&
    (typeof operation.tempPageRef !== 'string' || operation.tempPageRef.trim().length === 0)
  ) {
    return `apply_changes ${operationType} operation ${index} tempPageRef must be a non-empty string.`
  }

  return null
}

const handleDesktopMcpRequest = (
  request,
  response,
  { host, path, port, previewCaptureStore, readProjectResource, applyChanges, capturePreviewEvidence }
) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)
  if (requestUrl.pathname !== path) {
    sendText(response, 404, 'Desktop Arcade MCP endpoint not found.')
    return
  }

  const requestOrigin = getRequestOrigin(request)
  if (requestOrigin) {
    sendText(
      response,
      403,
      'Desktop Arcade MCP accepts only non-browser local MCP clients. Remove the Origin header and use POST JSON-RPC requests.'
    )
    return
  }

  if (request.method !== 'POST') {
    sendMethodNotAllowed(
      response,
      'Desktop Arcade MCP v1 supports POST JSON-RPC requests only and does not support GET or SSE streams.'
    )
    return
  }

  void routeDesktopMcpRequest(request, response, {
    previewCaptureStore,
    readProjectResource,
    applyChanges,
    capturePreviewEvidence,
  }).catch((error) => {
    if (response.writableEnded) {
      return
    }

    sendJsonRpcError(response, {
      httpStatus: 500,
      id: null,
      code: -32603,
      message:
        error instanceof Error
          ? error.message
          : 'Desktop Arcade MCP request handling failed unexpectedly.',
    })
  })
}

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const sendJsonRpcError = (response, { httpStatus = 200, id, code, message, data }) => {
  sendJson(response, httpStatus, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  })
}

const sendText = (response, statusCode, message) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendMethodNotAllowed = (response, message) => {
  response.statusCode = 405
  response.setHeader('allow', 'POST')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendNoContent = (response, statusCode = 204) => {
  response.statusCode = statusCode
  response.end()
}

const routeDesktopMcpRequest = async (
  request,
  response,
  { previewCaptureStore, readProjectResource, applyChanges, capturePreviewEvidence }
) => {
  let bodyText
  try {
    bodyText = await readRequestBody(request)
  } catch (error) {
    sendJsonRpcError(response, {
      httpStatus: 413,
      id: null,
      code: -32000,
      message:
        error instanceof Error
          ? error.message
          : 'Desktop Arcade MCP request body exceeds the 1MB limit.',
    })
    return
  }

  let payload
  try {
    payload = JSON.parse(bodyText)
  } catch {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32700,
      message: 'Desktop Arcade MCP request body must be valid JSON.',
    })
    return
  }

  if (!isJsonRpcRequest(payload)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: getJsonRpcId(payload),
      code: -32600,
      message:
        'Desktop Arcade MCP requests must be single JSON-RPC 2.0 objects with a string method.',
    })
    return
  }

  await routeDesktopMcpJsonRpcRequest(payload, response, {
    previewCaptureStore,
    readProjectResource,
    applyChanges,
    capturePreviewEvidence,
  })
}

const routeDesktopMcpJsonRpcRequest = async (
  payload,
  response,
  { previewCaptureStore, readProjectResource, applyChanges, capturePreviewEvidence }
) => {
  switch (payload.method) {
    case 'initialize':
      routeInitializeRequest(payload, response)
      return
    case 'notifications/initialized':
      routeInitializedNotification(payload, response)
      return
    case 'tools/list':
      routeToolsListRequest(payload, response)
      return
    case 'resources/list':
      routeResourcesListRequest(payload, response)
      return
    case 'tools/call':
      await routeToolsCallRequest(payload, response, { applyChanges, capturePreviewEvidence })
      return
    case 'resources/read':
      await routeResourcesReadRequest(payload, response, {
        previewCaptureStore,
        readProjectResource,
      })
      return
    default:
      sendJsonRpcError(response, {
        httpStatus: 200,
        id: getJsonRpcId(payload),
        code: -32601,
        message: `Desktop Arcade MCP method "${payload.method}" is not supported in v1.`,
      })
  }
}

const routeInitializeRequest = (payload, response) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP initialize requests must include a JSON-RPC id.',
    })
    return
  }

  if (payload.params !== undefined && !isPlainObject(payload.params)) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP initialize params must be an object when provided.',
    })
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      protocolVersion: DESKTOP_MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: DESKTOP_MCP_SERVER_NAME,
        version: DESKTOP_MCP_SERVER_VERSION,
      },
    },
  })
}

const routeInitializedNotification = (payload, response) => {
  sendNoContent(response, 202)
}

const routeToolsListRequest = (payload, response) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP tools/list requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['_meta'],
    id: payload.id,
    method: 'tools/list',
    response,
  })
  if (!params) {
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      tools: MCP_TOOL_DEFINITIONS,
    },
  })
}

const routeResourcesListRequest = (payload, response) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP resources/list requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['_meta'],
    id: payload.id,
    method: 'resources/list',
    response,
  })
  if (!params) {
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      resources: MCP_STABLE_RESOURCE_DEFINITIONS,
    },
  })
}

const routeToolsCallRequest = async (
  payload,
  response,
  { applyChanges, capturePreviewEvidence }
) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP tools/call requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['name', 'arguments', '_meta'],
    id: payload.id,
    method: 'tools/call',
    response,
  })
  if (!params) {
    return
  }

  if (typeof params.name !== 'string' || params.name.trim().length === 0) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP tools/call params.name must be a non-empty string.',
    })
    return
  }

  const toolDefinition = MCP_TOOL_DEFINITIONS.find((tool) => tool.name === params.name)
  if (!toolDefinition) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: `Unknown Desktop Arcade MCP tool "${params.name}".`,
      data: {
        code: 'unknown-tool',
        toolName: params.name,
      },
    })
    return
  }

  const argumentsPayload = params.arguments === undefined ? {} : params.arguments
  if (!isPlainObject(argumentsPayload)) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: `Desktop Arcade MCP tool "${toolDefinition.name}" arguments must be an object when provided.`,
      data: {
        code: 'invalid-tool-arguments',
        toolName: toolDefinition.name,
      },
    })
    return
  }

  const validationMessage = validateToolArguments(toolDefinition.name, argumentsPayload)
  if (validationMessage) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: validationMessage,
      data: {
        code: 'invalid-tool-arguments',
        toolName: toolDefinition.name,
      },
    })
    return
  }

  try {
    if (toolDefinition.name === 'capture_preview_evidence') {
      const captureResult = await capturePreviewEvidence(argumentsPayload)
      if (!isCapturePreviewResult(captureResult)) {
        sendJson(response, 200, {
          jsonrpc: '2.0',
          id: payload.id,
          result: createToolExecutionErrorResult(
            toolDefinition.name,
            'project-unavailable',
            'Desktop Arcade MCP capture_preview_evidence returned an invalid renderer response.'
          ),
        })
        return
      }

      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: captureResult.ok
          ? createToolExecutionSuccessResult(
              `Captured Preview evidence: ${captureResult.summary}`,
              toPublicCapturePreviewResult(captureResult)
            )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              captureResult.code,
              captureResult.message,
              {
                ...(captureResult.manifestResourceUri !== undefined
                  ? { manifestResourceUri: captureResult.manifestResourceUri }
                  : {}),
              }
            ),
      })
      return
    }

    const applyChangesResult = await applyChanges(argumentsPayload)
    if (!isApplyChangesResult(applyChangesResult)) {
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: createToolExecutionErrorResult(
          toolDefinition.name,
          'project-unavailable',
          'Desktop Arcade MCP apply_changes returned an invalid renderer response.'
        ),
      })
      return
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: applyChangesResult.ok
        ? createToolExecutionSuccessResult(
            `Applied changes: ${applyChangesResult.summary}`,
            applyChangesResult
          )
        : createToolExecutionErrorResult(
            toolDefinition.name,
            applyChangesResult.code,
            applyChangesResult.message,
            {
              ...(applyChangesResult.manifestResourceUri !== undefined
                ? { manifestResourceUri: applyChangesResult.manifestResourceUri }
                : {}),
              ...(applyChangesResult.resourceUri !== undefined
                ? { resourceUri: applyChangesResult.resourceUri }
                : {}),
              ...(applyChangesResult.expectedProjectRevision !== undefined
                ? { expectedProjectRevision: applyChangesResult.expectedProjectRevision }
                : {}),
              ...(applyChangesResult.currentProjectRevision !== undefined
                ? { currentProjectRevision: applyChangesResult.currentProjectRevision }
                : {}),
            }
          ),
    })
  } catch (error) {
    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: createToolExecutionErrorResult(
        toolDefinition.name,
        'project-unavailable',
        error instanceof Error
          ? error.message
          : 'Desktop Arcade MCP apply_changes failed unexpectedly.'
      ),
    })
  }
}

const routeResourcesReadRequest = async (
  payload,
  response,
  { previewCaptureStore, readProjectResource }
) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP resources/read requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['uri', '_meta'],
    id: payload.id,
    method: 'resources/read',
    response,
  })
  if (!params) {
    return
  }

  if (typeof params.uri !== 'string' || params.uri.trim().length === 0) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP resources/read params.uri must be a non-empty string.',
      data: {
        code: 'invalid-resource-uri',
      },
    })
    return
  }

  if (isPreviewCaptureResourceUri(params.uri)) {
    const resource = previewCaptureStore.read(params.uri)
    if (!resource) {
      sendJsonRpcError(response, {
        id: payload.id,
        code: -32002,
        message:
          `Desktop Arcade MCP resource "${params.uri}" is unavailable because the Preview capture does not exist or has expired.`,
        data: {
          code: 'resource-not-found',
          resourceUri: params.uri,
        },
      })
      return
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: {
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: resource.text,
          },
        ],
      },
    })
    return
  }

  if (isKnownProjectResourceUri(params.uri)) {
    let resourceResult
    try {
      resourceResult = await readProjectResource({ uri: params.uri })
    } catch (error) {
      sendJsonRpcError(response, {
        id: payload.id,
        code: -32002,
        message:
          error instanceof Error
            ? error.message
            : `Desktop Arcade MCP resource "${params.uri}" is unavailable.`,
        data: {
          code: 'project-unavailable',
          resourceUri: params.uri,
        },
      })
      return
    }

    if (!isProjectResourceReadResult(resourceResult, params.uri)) {
      sendJsonRpcError(response, {
        id: payload.id,
        code: -32002,
        message:
          `Desktop Arcade MCP resource "${params.uri}" returned an invalid project resource response.`,
        data: {
          code: 'project-unavailable',
          resourceUri: params.uri,
        },
      })
      return
    }

    if (!resourceResult.ok) {
      sendJsonRpcError(response, {
        id: payload.id,
        code: -32002,
        message: resourceResult.message,
        data: {
          code: resourceResult.code,
          resourceUri: resourceResult.resourceUri,
        },
      })
      return
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: {
        contents: [
          {
            uri: resourceResult.uri,
            mimeType: resourceResult.mimeType,
            text: resourceResult.text,
          },
        ],
      },
    })
    return
  }

  const resourceDefinition = MCP_STABLE_RESOURCE_DEFINITIONS.find(
    (resource) => resource.uri === params.uri
  )
  if (!resourceDefinition) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32002,
      message: `Unknown Desktop Arcade MCP resource "${params.uri}".`,
      data: {
        code: 'resource-not-found',
        resourceUri: params.uri,
      },
    })
    return
  }

  const desktopResourceText = createDesktopStableResourceText(resourceDefinition.uri)
  if (desktopResourceText !== null) {
    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: {
        contents: [
          {
            uri: resourceDefinition.uri,
            mimeType: resourceDefinition.mimeType,
            text: desktopResourceText,
          },
        ],
      },
    })
    return
  }

  sendJsonRpcError(response, {
    id: payload.id,
    code: -32002,
    message: `Desktop Arcade MCP resource "${resourceDefinition.uri}" is not implemented yet.`,
    data: {
      code: 'not-yet-implemented',
      resourceUri: resourceDefinition.uri,
    },
  })
}

const isKnownProjectResourceUri = (uri) =>
  uri === 'arcade://project/manifest' ||
  uri === 'arcade://project/preview-context' ||
  uri === 'arcade://project/diagnostics' ||
  uri === 'arcade://project/source/global/jsx' ||
  uri === 'arcade://project/source/global/hooks' ||
  PROJECT_SOURCE_PAGE_URI_PATTERN.test(uri)

const isPreviewCaptureResourceUri = (uri) => PREVIEW_CAPTURE_RESOURCE_URI_PATTERN.test(uri)

const readStrictParamsObject = (payload, { allowedKeys, id, method, response }) => {
  const params = payload.params === undefined ? {} : payload.params
  if (!isPlainObject(params)) {
    sendJsonRpcError(response, {
      id,
      code: -32602,
      message: `Desktop Arcade MCP ${method} params must be an object when provided.`,
    })
    return null
  }

  const extraKeys = getUnexpectedKeys(params, allowedKeys)
  if (extraKeys.length > 0) {
    sendJsonRpcError(response, {
      id,
      code: -32602,
      message: `Desktop Arcade MCP ${method} params contain unsupported fields: ${extraKeys.join(', ')}.`,
    })
    return null
  }

  return params
}

const validateToolArguments = (toolName, argumentsPayload) => {
  switch (toolName) {
    case 'capture_preview_evidence':
      return validateCapturePreviewEvidenceArguments(argumentsPayload)
    case 'apply_changes':
      return validateApplyChangesArguments(argumentsPayload)
    default:
      return `Unknown Desktop Arcade MCP tool "${toolName}".`
  }
}

const validateCapturePreviewEvidenceArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, [
    'pageId',
    'viewportSize',
    'theme',
    'layers',
    'screenshotScope',
    'target',
  ])
  if (extraKeys.length > 0) {
    return `capture_preview_evidence arguments contain unsupported fields: ${extraKeys.join(
      ', '
    )}.`
  }

  if (
    'pageId' in argumentsPayload &&
    (typeof argumentsPayload.pageId !== 'string' || argumentsPayload.pageId.trim().length === 0)
  ) {
    return 'capture_preview_evidence pageId must be a non-empty string.'
  }

  if (
    'viewportSize' in argumentsPayload &&
    !VALID_VIEWPORT_SIZES.includes(argumentsPayload.viewportSize)
  ) {
    return `capture_preview_evidence viewportSize must be one of ${VALID_VIEWPORT_SIZES.join(
      ', '
    )}.`
  }

  if ('theme' in argumentsPayload && !VALID_THEMES.includes(argumentsPayload.theme)) {
    return `capture_preview_evidence theme must be one of ${VALID_THEMES.join(', ')}.`
  }

  if ('layers' in argumentsPayload) {
    if (!Array.isArray(argumentsPayload.layers)) {
      return 'capture_preview_evidence layers must be an array when provided.'
    }

    if (argumentsPayload.layers.length === 0) {
      return 'capture_preview_evidence layers must include at least one requested layer.'
    }

    const invalidLayer = argumentsPayload.layers.find(
      (layer) => typeof layer !== 'string' || !VALID_PREVIEW_CAPTURE_LAYERS.includes(layer)
    )
    if (invalidLayer !== undefined) {
      return `capture_preview_evidence layers must be drawn from ${VALID_PREVIEW_CAPTURE_LAYERS.join(
        ', '
      )}.`
    }

    if (new Set(argumentsPayload.layers).size !== argumentsPayload.layers.length) {
      return 'capture_preview_evidence layers must not contain duplicate values.'
    }
  }

  if (
    'screenshotScope' in argumentsPayload &&
    !VALID_PREVIEW_SCREENSHOT_SCOPES.includes(argumentsPayload.screenshotScope)
  ) {
    return `capture_preview_evidence screenshotScope must be one of ${VALID_PREVIEW_SCREENSHOT_SCOPES.join(
      ', '
    )}.`
  }

  if ('target' in argumentsPayload) {
    if (!isPlainObject(argumentsPayload.target)) {
      return 'capture_preview_evidence target must be an object when provided.'
    }

    const extraTargetKeys = getUnexpectedKeys(argumentsPayload.target, [
      'selector',
      'role',
      'name',
      'text',
      'label',
    ])
    if (extraTargetKeys.length > 0) {
      return `capture_preview_evidence target contains unsupported fields: ${extraTargetKeys.join(
        ', '
      )}.`
    }

    const targetFields = ['selector', 'role', 'name', 'text', 'label'].filter((key) => {
      const value = argumentsPayload.target[key]
      return value !== undefined
    })
    if (targetFields.length === 0) {
      return 'capture_preview_evidence target must include at least one selector or accessibility field.'
    }

    for (const key of targetFields) {
      const value = argumentsPayload.target[key]
      if (typeof value !== 'string' || value.trim().length === 0) {
        return `capture_preview_evidence target.${key} must be a non-empty string when provided.`
      }
    }
  }

  if (argumentsPayload.screenshotScope === 'region' && argumentsPayload.target === undefined) {
    return 'capture_preview_evidence screenshotScope "region" requires a target.'
  }

  if (argumentsPayload.screenshotScope !== 'region' && argumentsPayload.target !== undefined) {
    return 'capture_preview_evidence target may be provided only when screenshotScope is "region".'
  }

  return null
}

const validateApplyChangesArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, [
    'summary',
    'expectedProjectRevision',
    'operations',
  ])
  if (extraKeys.length > 0) {
    return `apply_changes arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    typeof argumentsPayload.summary !== 'string' ||
    argumentsPayload.summary.trim().length === 0
  ) {
    return 'apply_changes summary must be a non-empty string.'
  }

  if (
    'expectedProjectRevision' in argumentsPayload &&
    (typeof argumentsPayload.expectedProjectRevision !== 'string' ||
      argumentsPayload.expectedProjectRevision.trim().length === 0)
  ) {
    return 'apply_changes expectedProjectRevision must be a non-empty string when provided.'
  }

  if (!Array.isArray(argumentsPayload.operations)) {
    return 'apply_changes operations must be an array.'
  }

  if (argumentsPayload.operations.length === 0) {
    return 'apply_changes operations must include at least one operation.'
  }

  for (const [index, operation] of argumentsPayload.operations.entries()) {
    const operationValidationMessage = validateApplyChangesOperation(operation, index)
    if (operationValidationMessage) {
      return operationValidationMessage
    }
  }

  return null
}

const validateApplyChangesOperation = (operation, index) => {
  if (!isPlainObject(operation)) {
    return `apply_changes operation ${index} must be an object.`
  }

  if (typeof operation.type !== 'string' || operation.type.trim().length === 0) {
    return `apply_changes operation ${index} type must be a non-empty string.`
  }

  switch (operation.type) {
    case 'replace_source': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'resourceUri', 'content'])
      if (extraKeys.length > 0) {
        return `apply_changes replace_source operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.resourceUri !== 'string' || operation.resourceUri.trim().length === 0) {
        return `apply_changes replace_source operation ${index} resourceUri must be a non-empty string.`
      }

      if (typeof operation.content !== 'string') {
        return `apply_changes replace_source operation ${index} content must be a string.`
      }

      return null
    }
    case 'create_page': {
      const extraKeys = getUnexpectedKeys(operation, [
        'type',
        'name',
        'newPageRef',
        'jsxCode',
        'hooksCode',
      ])
      if (extraKeys.length > 0) {
        return `apply_changes create_page operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (
        operation.name !== undefined &&
        (typeof operation.name !== 'string' || operation.name.trim().length === 0)
      ) {
        return `apply_changes create_page operation ${index} name must be a non-empty string when provided.`
      }

      if (
        operation.newPageRef !== undefined &&
        (typeof operation.newPageRef !== 'string' || operation.newPageRef.trim().length === 0)
      ) {
        return `apply_changes create_page operation ${index} newPageRef must be a non-empty string when provided.`
      }

      if (operation.jsxCode !== undefined && typeof operation.jsxCode !== 'string') {
        return `apply_changes create_page operation ${index} jsxCode must be a string when provided.`
      }

      if (operation.hooksCode !== undefined && typeof operation.hooksCode !== 'string') {
        return `apply_changes create_page operation ${index} hooksCode must be a string when provided.`
      }

      return null
    }
    case 'rename_page': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'name', 'pageId', 'tempPageRef'])
      if (extraKeys.length > 0) {
        return `apply_changes rename_page operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.name !== 'string' || operation.name.trim().length === 0) {
        return `apply_changes rename_page operation ${index} name must be a non-empty string.`
      }

      return validateApplyChangesPageTarget(operation, index, 'rename_page', ['name'])
    }
    case 'delete_page':
      return validateApplyChangesPageTarget(operation, index, 'delete_page')
    case 'set_start_page':
      return validateApplyChangesPageTarget(operation, index, 'set_start_page')
    case 'select_active_page':
      return validateApplyChangesPageTarget(operation, index, 'select_active_page')
    case 'set_preview_context': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'viewportSize', 'theme'])
      if (extraKeys.length > 0) {
        return `apply_changes set_preview_context operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (operation.viewportSize === undefined && operation.theme === undefined) {
        return `apply_changes set_preview_context operation ${index} must set viewportSize and/or theme.`
      }

      if (
        operation.viewportSize !== undefined &&
        !VALID_VIEWPORT_SIZES.includes(operation.viewportSize)
      ) {
        return `apply_changes set_preview_context operation ${index} viewportSize must be one of ${VALID_VIEWPORT_SIZES.join(
          ', '
        )}.`
      }

      if (operation.theme !== undefined && !VALID_THEMES.includes(operation.theme)) {
        return `apply_changes set_preview_context operation ${index} theme must be one of ${VALID_THEMES.join(
          ', '
        )}.`
      }

      return null
    }
    case 'rename_project': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'name'])
      if (extraKeys.length > 0) {
        return `apply_changes rename_project operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.name !== 'string' || operation.name.trim().length === 0) {
        return `apply_changes rename_project operation ${index} name must be a non-empty string.`
      }

      return null
    }
    default:
      return `apply_changes operation ${index} uses unsupported type "${operation.type}".`
  }
}

const createToolExecutionSuccessResult = (message, structuredContent) => ({
  content: [
    {
      type: 'text',
      text: message,
    },
  ],
  structuredContent,
})

const createToolExecutionErrorResult = (toolName, code, message, extras = {}) => ({
  content: [
    {
      type: 'text',
      text: message,
    },
  ],
  isError: true,
  structuredContent: {
    code,
    toolName,
    message,
    ...extras,
  },
})

const createDesktopStableResourceText = (uri) => {
  switch (uri) {
    case 'arcade://desktop/operating-guide':
      return [
        '# Desktop Arcade MCP operating guide',
        '',
        '- Work through `arcade://` resources and MCP tools only; do not edit repository files, package metadata, or the local filesystem.',
        '- Default loop: read this guide, read `arcade://project/manifest`, read the relevant source resources, use `apply_changes` for durable edits, read `arcade://project/diagnostics` unless the human asked for a different workflow, then capture Preview evidence when visual validation is needed.',
        '- Durable project edits happen through `apply_changes`, not by patching files outside the active Arcade project.',
        '- Use `create_page.newPageRef`, later `tempPageRef` targets, and `{{pageRef:name}}` placeholders when one batch must create a page and link to it.',
        '- `capture_preview_evidence({ pageId })` is the normal autonomous inspection path for pages and targeted visual states.',
        '- Use `select_active_page` only when you intentionally want the human-visible Active page to change; ordinary inspection should keep using `capture_preview_evidence({ pageId })`.',
        '- Saved Preview preferences live in `arcade://project/preview-context`; capture-only overrides must not mutate them.',
        '- If `apply_changes` returns `project-unavailable`, wait for an active Desktop Arcade window instead of falling back to repository or filesystem edits.',
        '- Baseline Preview capture currently supports `screenshot` and `frame` layers, with `viewport`, `full_page`, and `region` screenshot scopes. Later semantic layers may still be unavailable.',
        '- When state is unclear, re-read the manifest before making another durable change.',
      ].join('\n')
    case 'arcade://desktop/authoring-guide':
      return [
        '# Desktop Arcade MCP authoring guide',
        '',
        '- Arcade source is import-free JSX and Hooks for the active Arcade project.',
        '- Prefer Aksel-valid Arcade JSX: current Aksel components, layout primitives, icons, and `--ax` design tokens before native HTML or custom CSS fallbacks.',
        '- `Global config` is shared code in scope for every Arcade page; it is not a renderable page.',
        '- Durable page navigation targets stable page ids, not page names.',
        '- When a batch creates and links pages together, use `{{pageRef:name}}` placeholders in source and let Arcade rewrite them to the app-assigned page ids.',
        '- Temporary page refs become valid only after the matching `create_page.newPageRef` is declared in the batch order.',
        '- Diagnostics plus Preview evidence are the feedback loop after source changes.',
        '- Keep the output context-light: no broad Aksel training, package edits, or repository/file edits.',
      ].join('\n')
    case 'arcade://desktop/capabilities':
      return JSON.stringify({
        serverName: DESKTOP_MCP_SERVER_NAME,
        serverVersion: DESKTOP_MCP_SERVER_VERSION,
        endpoint: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}${DESKTOP_MCP_PATH}`,
        transport: DESKTOP_MCP_TRANSPORT_LABEL,
        requiresAuth: false,
        authDescription: DESKTOP_MCP_AUTH_DESCRIPTION,
        contractNote:
          'This resource lists the stable v1 MCP contract and the current implementation status for each published tool and preview surface.',
        toolNames: MCP_TOOL_DEFINITIONS.map((toolDefinition) => toolDefinition.name),
        stableResourceUris: MCP_STABLE_RESOURCE_DEFINITIONS.map(
          (resourceDefinition) => resourceDefinition.uri
        ),
        applyChangesOperationTypes: APPLY_CHANGES_OPERATION_TYPES,
        pageRefPlaceholderSyntax: PAGE_REF_PLACEHOLDER_SYNTAX,
        dynamicSourceUriTemplates: CAPABILITY_SOURCE_URI_TEMPLATES,
        previewEvidenceUriTemplates: CAPABILITY_PREVIEW_EVIDENCE_URI_TEMPLATES,
        captureLayers: CAPABILITY_PREVIEW_CAPTURE_LAYERS,
        captureLayerPurposes: CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES,
        screenshotScopes: VALID_PREVIEW_SCREENSHOT_SCOPES,
        interactionActions: CAPABILITY_PREVIEW_INTERACTION_ACTIONS,
        limits: {
          requestBodyBytes: MAX_MCP_BODY_BYTES,
        },
        implementationStatus: {
          stableDesktopResourceReads: 'available',
          projectResourceReads: 'available when an active project reader is connected',
          toolExecution: TOOL_EXECUTION_STATUS,
          previewEvidenceUriTemplates: PREVIEW_EVIDENCE_URI_TEMPLATE_STATUS,
          captureLayers: CAPTURE_LAYER_STATUS,
          screenshotScopes: SCREENSHOT_SCOPE_STATUS,
          interactionActions: INTERACTION_ACTION_STATUS,
        },
        v1Omissions: CAPABILITY_V1_OMISSIONS,
      })
    default:
      return null
  }
}

const createProjectUnavailableResourceResult = async ({ uri }) => ({
  ok: false,
  code: 'project-unavailable',
  resourceUri: uri,
  message: `Desktop Arcade MCP resource "${uri}" is unavailable because no project reader is connected.`,
})

const createProjectUnavailableApplyChangesResult = async () => ({
  ok: false,
  code: 'project-unavailable',
  message:
    'Desktop Arcade MCP apply_changes is unavailable because no active project writer is connected.',
})

const createProjectUnavailableCapturePreviewResult = async () => ({
  ok: false,
  code: 'project-unavailable',
  message:
    'Desktop Arcade MCP capture_preview_evidence is unavailable because no active preview capture bridge is connected.',
})

const createPreviewCaptureStore = ({ ttlMs }) => {
  const captures = new Map()

  const cleanupExpired = () => {
    const now = Date.now()
    for (const [captureId, capture] of captures) {
      if (capture.expiresAt <= now) {
        captures.delete(captureId)
      }
    }
  }

  return {
    store(captureResult) {
      cleanupExpired()
      captures.set(captureResult.captureId, {
        expiresAt: Date.now() + ttlMs,
        resources: new Map(captureResult.resources.map((resource) => [resource.uri, resource])),
      })
    },
    read(resourceUri) {
      cleanupExpired()
      const match = resourceUri.match(PREVIEW_CAPTURE_RESOURCE_URI_PATTERN)
      if (!match) {
        return null
      }

      const [, captureId] = match
      const capture = captures.get(captureId)
      return capture?.resources.get(resourceUri) ?? null
    },
  }
}

const formatServerErrorReason = (error, { host, port }) => {
  if (isPlainObject(error) && error.code === 'EADDRINUSE') {
    return `Port ${port} on ${host} is already in use.`
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return `Desktop Arcade could not start MCP on ${host}:${port}.`
}

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    const closeActiveConnections = () => {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections()
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections()
      }
    }

    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error)
        return
      }

      resolve()
    })
    closeActiveConnections()
  })

const readRequestBody = async (request) => {
  const chunks = []
  let bodyBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bodyBytes += buffer.length
    if (bodyBytes > MAX_MCP_BODY_BYTES) {
      throw new Error('Desktop Arcade MCP request body exceeds the 1MB limit.')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const getJsonRpcId = (value) =>
  isPlainObject(value) && value.id !== undefined && isJsonRpcId(value.id) ? value.id : null

const isJsonRpcRequest = (value) =>
  isPlainObject(value) &&
  getUnexpectedKeys(value, ['jsonrpc', 'id', 'method', 'params']).length === 0 &&
  value.jsonrpc === '2.0' &&
  typeof value.method === 'string' &&
  value.method.trim().length > 0 &&
  isJsonRpcId(value.id)

const isJsonRpcId = (value) =>
  value === undefined || value === null || typeof value === 'string' || typeof value === 'number'

const isJsonRpcResponseId = (value) => typeof value === 'string' || typeof value === 'number'

const getUnexpectedKeys = (value, allowedKeys) =>
  Object.keys(value).filter((key) => !allowedKeys.includes(key))

const getRequestOrigin = (request) =>
  typeof request.headers.origin === 'string' && request.headers.origin.trim().length > 0
    ? request.headers.origin.trim()
    : null

const isProjectResourceReadResult = (value, expectedUri) =>
  isPlainObject(value) &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? value.uri === expectedUri &&
      typeof value.mimeType === 'string' &&
      value.mimeType.trim().length > 0 &&
      typeof value.text === 'string'
    : value.resourceUri === expectedUri &&
      (value.code === 'project-unavailable' ||
        value.code === 'source-not-found' ||
        value.code === 'invalid-resource-uri') &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0)

const isCapturePreviewResult = (value) => {
  if (!isPlainObject(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.summary === 'string' &&
      typeof value.captureId === 'string' &&
      typeof value.manifestResourceUri === 'string' &&
      Array.isArray(value.producedResources) &&
      Array.isArray(value.requestedLayers) &&
      Array.isArray(value.producedLayers) &&
      isPlainObject(value.page) &&
      typeof value.page.id === 'string' &&
      typeof value.page.name === 'string' &&
      isPlainObject(value.layerResources) &&
      Array.isArray(value.resources) &&
      value.resources.every(
        (resource) =>
          isPlainObject(resource) &&
          typeof resource.uri === 'string' &&
          typeof resource.mimeType === 'string' &&
          typeof resource.text === 'string'
      ) &&
      isPlainObject(value.safeActivity) &&
      value.safeActivity.toolName === 'capture_preview_evidence' &&
      typeof value.safeActivity.timestamp === 'string'
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'invalid-page-id' ||
      value.code === 'invalid-capture-target' ||
      value.code === 'render-timeout' ||
      value.code === 'render-failed') &&
    typeof value.message === 'string' &&
    (value.manifestResourceUri === undefined || typeof value.manifestResourceUri === 'string')
  )
}

const toPublicCapturePreviewResult = (captureResult) => ({
  ok: true,
  summary: captureResult.summary,
  captureId: captureResult.captureId,
  manifestResourceUri: captureResult.manifestResourceUri,
  producedResources: captureResult.producedResources,
  page: captureResult.page,
  requestedLayers: captureResult.requestedLayers,
  producedLayers: captureResult.producedLayers,
  layerResources: captureResult.layerResources,
  safeActivity: captureResult.safeActivity,
})

const isApplyChangesResult = (value) =>
  isPlainObject(value) &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      typeof value.projectRevision === 'string' &&
      value.projectRevision.trim().length > 0 &&
      Array.isArray(value.changedResources) &&
      value.changedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.nextRecommendedResources) &&
      value.nextRecommendedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.operationResults) &&
      isPlainObject(value.safeActivity) &&
      typeof value.safeActivity.toolName === 'string' &&
      typeof value.safeActivity.timestamp === 'string' &&
      (value.safeActivity.operationTypes === undefined ||
        (Array.isArray(value.safeActivity.operationTypes) &&
          value.safeActivity.operationTypes.every((operationType) => typeof operationType === 'string')))
    : (value.code === 'project-unavailable' ||
        value.code === 'invalid-operation' ||
        value.code === 'stale-project-revision' ||
        value.code === 'invalid-operation-target' ||
        value.code === 'invalid-project-name' ||
        value.code === 'payload-too-large' ||
        value.code === 'persistence-failed') &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0 &&
      (value.manifestResourceUri === undefined ||
        typeof value.manifestResourceUri === 'string') &&
      (value.resourceUri === undefined || typeof value.resourceUri === 'string') &&
      (value.expectedProjectRevision === undefined ||
        typeof value.expectedProjectRevision === 'string') &&
      (value.currentProjectRevision === undefined ||
        typeof value.currentProjectRevision === 'string'))

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

module.exports = {
  DESKTOP_MCP_AUTH_DESCRIPTION,
  DESKTOP_MCP_HOST,
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}

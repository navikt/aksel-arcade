const http = require('node:http')

const DESKTOP_MCP_HOST = '127.0.0.1'
const DESKTOP_MCP_PORT = 3846
const DESKTOP_MCP_PATH = '/mcp'
const DESKTOP_MCP_SERVER_NAME = 'desktop-arcade'
const DESKTOP_MCP_SERVER_VERSION = '0.0.0'
const DESKTOP_MCP_TRANSPORT_LABEL = 'HTTP (MCP Streamable HTTP)'
const DESKTOP_MCP_AUTH_DESCRIPTION = 'No token/header required.'
const MAX_MCP_BODY_BYTES = 1024 * 1024

const createDesktopMcpServer = ({
  host = DESKTOP_MCP_HOST,
  port = DESKTOP_MCP_PORT,
  path = DESKTOP_MCP_PATH,
} = {}) => {
  let activeServer = null
  let startOperation = null
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
      handleDesktopMcpRequest(request, response, { host, path, port: getPort() })
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

const handleDesktopMcpRequest = (request, response, { host, path, port }) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)
  if (requestUrl.pathname !== path) {
    sendText(response, 404, 'Desktop Arcade MCP endpoint not found.')
    return
  }

  if (request.method !== 'POST') {
    sendText(response, 405, 'Desktop Arcade MCP currently supports POST only.')
    return
  }

  void routeDesktopMcpRequest(request, response)
}

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const sendJsonRpcError = (response, { httpStatus = 200, id, code, message }) => {
  sendJson(response, httpStatus, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
}

const sendText = (response, statusCode, message) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendNoContent = (response, statusCode = 204) => {
  response.statusCode = statusCode
  response.end()
}

const routeDesktopMcpRequest = async (request, response) => {
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

  if (payload.method === 'initialize') {
    if (payload.id === null) {
      sendJsonRpcError(response, {
        httpStatus: 400,
        id: null,
        code: -32600,
        message: 'Desktop Arcade MCP initialize requests must include a JSON-RPC id.',
      })
      return
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: {
          name: DESKTOP_MCP_SERVER_NAME,
          version: DESKTOP_MCP_SERVER_VERSION,
        },
      },
    })
    return
  }

  if (payload.method === 'notifications/initialized') {
    sendNoContent(response)
    return
  }

  sendJsonRpcError(response, {
    httpStatus: 200,
    id: payload.id,
    code: -32601,
    message: `Desktop Arcade MCP method "${payload.method}" is not implemented yet.`,
  })
}

const formatServerErrorReason = (error, { host, port }) => {
  if (isRecord(error) && error.code === 'EADDRINUSE') {
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

const getJsonRpcId = (value) => (isRecord(value) && isJsonRpcId(value.id) ? value.id : null)

const isJsonRpcRequest = (value) =>
  isRecord(value) &&
  value.jsonrpc === '2.0' &&
  typeof value.method === 'string' &&
  value.method.trim().length > 0 &&
  isJsonRpcId(value.id)

const isJsonRpcId = (value) =>
  value === undefined || value === null || typeof value === 'string' || typeof value === 'number'

const isRecord = (value) => typeof value === 'object' && value !== null

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

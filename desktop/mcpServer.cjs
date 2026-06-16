const http = require('node:http')

const DESKTOP_MCP_HOST = '127.0.0.1'
const DESKTOP_MCP_PORT = 3846
const DESKTOP_MCP_PATH = '/mcp'
const DESKTOP_MCP_SERVER_NAME = 'desktop-arcade'
const DESKTOP_MCP_TRANSPORT_LABEL = 'HTTP (MCP Streamable HTTP)'
const DESKTOP_MCP_AUTH_DESCRIPTION = 'No token/header required.'

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

  sendJson(response, 501, {
    error: {
      code: 'not-yet-implemented',
      message: 'Desktop Arcade MCP protocol foundation is not implemented yet.',
    },
  })
}

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const sendText = (response, statusCode, message) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
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

const isRecord = (value) => typeof value === 'object' && value !== null

module.exports = {
  DESKTOP_MCP_AUTH_DESCRIPTION,
  DESKTOP_MCP_HOST,
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}

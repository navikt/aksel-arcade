const http = require('node:http')
const { timingSafeEqual } = require('node:crypto')
const { getRedactedAgentErrorMessage } = require('./agentHandoffRedaction.cjs')

const LOOPBACK_HOST = '127.0.0.1'
const MAX_JSON_RPC_BODY_BYTES = 1024 * 1024

const createAgentLoopbackJsonRpcTransport = ({ host = LOOPBACK_HOST, routeRequest } = {}) => {
  let activeSession = null
  let startQueue = Promise.resolve()

  const stopSession = async (sessionId) => {
    if (!activeSession || (sessionId && activeSession.session.id !== sessionId)) {
      return false
    }

    const sessionToStop = activeSession
    activeSession = null
    await closeServer(sessionToStop.server)
    return true
  }

  const startSession = (session) => {
    assertTransportSession(session)

    const startOperation = startQueue.then(() => startSessionExclusive(session))
    startQueue = startOperation.catch(() => undefined)

    return startOperation
  }

  const startSessionExclusive = async (session) => {
    if (activeSession?.session.id === session.id) {
      return toTransportEndpoint(activeSession)
    }

    if (activeSession) {
      await stopSession(activeSession.session.id)
    }

    const server = http.createServer((request, response) => {
      void handleJsonRpcRequest(request, response, {
        getSession: () => activeSession?.session ?? null,
        routeRequest,
      })
    })
    const nextSession = {
      endpoint: '',
      server,
      session: cloneTransportSession(session),
    }

    activeSession = nextSession

    try {
      await listenOnRandomLoopbackPort(server, host)

      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Agent loopback transport did not receive a TCP address.')
      }

      nextSession.endpoint = `http://${host}:${address.port}`
    } catch (error) {
      if (activeSession === nextSession) {
        activeSession = null
      }
      await closeServer(server)
      throw error
    }

    return toTransportEndpoint(nextSession)
  }

  return {
    getActiveSession: () => (activeSession ? cloneTransportSession(activeSession.session) : null),
    startSession,
    stopSession,
  }
}

const handleJsonRpcRequest = async (request, response, { getSession, routeRequest }) => {
  const session = getSession()
  if (!session) {
    sendJsonRpcError(response, {
      httpStatus: 409,
      id: null,
      jsonRpcCode: -32001,
      code: 'session-inactive',
      message: 'Agent transport session is no longer active.',
    })
    return
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? LOOPBACK_HOST}`)
  if (url.searchParams.size > 0) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      jsonRpcCode: -32000,
      code: 'credentials-in-query',
      message: 'Agent pairing credentials must be sent only in the Authorization header.',
    })
    return
  }

  if (request.method !== 'POST') {
    sendJsonRpcError(response, {
      httpStatus: 405,
      id: null,
      jsonRpcCode: -32600,
      code: 'invalid-http-method',
      message: 'Agent JSON-RPC requests must use POST.',
    })
    return
  }

  const authResult = validateAuthorizationHeader(
    request.headers.authorization,
    session.pairingCredential
  )
  if (!authResult.ok) {
    sendJsonRpcError(response, {
      httpStatus: authResult.httpStatus,
      id: null,
      jsonRpcCode: -32000,
      code: authResult.code,
      message: authResult.message,
    })
    return
  }

  let bodyText
  try {
    bodyText = await readRequestBody(request)
  } catch (error) {
    sendJsonRpcError(response, {
      httpStatus: 413,
      id: null,
      jsonRpcCode: -32000,
      code: 'payload-too-large',
      message:
        error instanceof Error
          ? error.message
          : 'Agent JSON-RPC request body exceeds the transport limit.',
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
      jsonRpcCode: -32700,
      code: 'parse-error',
      message: 'Agent JSON-RPC request body must be valid JSON.',
    })
    return
  }

  const requestId = isJsonRpcId(payload?.id) ? payload.id : null
  if (!isJsonRpcRequest(payload)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: requestId,
      jsonRpcCode: -32600,
      code: 'invalid-request',
      message: 'Agent JSON-RPC requests must be single JSON-RPC 2.0 objects with a string method.',
    })
    return
  }

  if (routeRequest) {
    try {
      const routedResponse = await routeRequest({
        id: payload.id ?? null,
        method: payload.method,
        params: payload.params,
        session: toTransportRouteSession(session),
      })
      sendJson(response, 200, routedResponse)
    } catch (error) {
      sendJsonRpcError(response, {
        httpStatus: 500,
        id: payload.id ?? null,
        jsonRpcCode: -32603,
        code: 'route-request-failed',
        message: getRedactedAgentErrorMessage(
          error,
          'Agent transport request routing failed unexpectedly.'
        ),
      })
    }
    return
  }

  sendJsonRpcError(response, {
    httpStatus: 200,
    id: payload.id ?? null,
    jsonRpcCode: -32601,
    code: 'unsupported-method',
    message: `Unsupported Agent transport method "${payload.method}".`,
  })
}

const validateAuthorizationHeader = (authorization, expectedCredential) => {
  if (!authorization) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'missing-authorization',
      message: 'Missing Authorization header for Agent transport request.',
    }
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization)
  if (!match) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'unsupported-authorization',
      message: 'Agent transport Authorization must use the Bearer credential shape.',
    }
  }

  if (!constantTimeEqual(match[1], expectedCredential)) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'invalid-authorization',
      message: 'Invalid Agent pairing credential.',
    }
  }

  return { ok: true }
}

const constantTimeEqual = (received, expected) => {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer)
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

const readRequestBody = async (request) => {
  const chunks = []
  let bodyBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bodyBytes += buffer.length
    if (bodyBytes > MAX_JSON_RPC_BODY_BYTES) {
      throw new Error('Agent JSON-RPC request body exceeds the 1MB transport limit.')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const sendJsonRpcError = (response, { httpStatus, id, jsonRpcCode, code, message }) => {
  sendJson(response, httpStatus, {
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
}

const sendJson = (response, httpStatus, payload) => {
  response.statusCode = httpStatus
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const listenOnRandomLoopbackPort = (server, host) =>
  new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening)
      reject(error)
    }
    const handleListening = () => {
      server.off('error', handleError)
      resolve()
    }

    server.once('error', handleError)
    server.once('listening', handleListening)
    server.listen(0, host)
  })

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

const assertTransportSession = (session) => {
  if (
    !isRecord(session) ||
    typeof session.id !== 'string' ||
    session.id.length === 0 ||
    typeof session.startedAt !== 'string' ||
    session.startedAt.length === 0 ||
    session.status !== 'active' ||
    typeof session.pairingCredential !== 'string' ||
    session.pairingCredential.length === 0 ||
    !isAgentPermissions(session.permissions)
  ) {
    throw new Error('Invalid Agent transport session payload.')
  }
}

const cloneTransportSession = (session) => ({
  id: session.id,
  startedAt: session.startedAt,
  status: session.status,
  permissions: { ...session.permissions },
  pairingCredential: session.pairingCredential,
})

const toTransportEndpoint = ({ endpoint, session }) => ({
  endpoint,
  sessionId: session.id,
  authorizationHeader: `Bearer ${session.pairingCredential}`,
})

const toTransportRouteSession = (session) => ({
  id: session.id,
  startedAt: session.startedAt,
  status: session.status,
  permissions: { ...session.permissions },
})

const isJsonRpcRequest = (value) =>
  isRecord(value) &&
  value.jsonrpc === '2.0' &&
  typeof value.method === 'string' &&
  value.method.trim().length > 0 &&
  isJsonRpcId(value.id)

const isJsonRpcId = (value) =>
  value === undefined || value === null || typeof value === 'string' || typeof value === 'number'

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const isAgentPermissions = (value) =>
  isRecord(value) &&
  typeof value.sourceChanges === 'boolean' &&
  typeof value.previewSettings === 'boolean' &&
  typeof value.previewEvidence === 'boolean' &&
  typeof value.projectMetadata === 'boolean'

module.exports = {
  LOOPBACK_HOST,
  createAgentLoopbackJsonRpcTransport,
}

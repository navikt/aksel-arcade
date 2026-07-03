import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { DesktopMcpProjectResourceReadHandler } from '../src/services/desktopMcpProjectResourceProtocol'
import {
  createDesktopMcpPreviewCaptureStore,
  registerDesktopMcpResources,
} from './mcpSdkResources'

export const DESKTOP_MCP_HOST = '127.0.0.1'
export const DESKTOP_MCP_PORT = 3846
export const DESKTOP_MCP_PATH = '/mcp'
export const DESKTOP_MCP_SERVER_NAME = 'aksel-arcade'
export const DESKTOP_MCP_SERVER_VERSION = '0.0.0'
export const DESKTOP_MCP_TRANSPORT_LABEL = 'HTTP (MCP Streamable HTTP)'
export const DESKTOP_MCP_AUTH_DESCRIPTION = 'No token/header required.'

const MAX_MCP_BODY_BYTES = 1024 * 1024
const DESKTOP_MCP_BOOTSTRAP_INSTRUCTIONS = [
  'Desktop Arcade MCP is running on the fixed local endpoint and now uses the official TypeScript MCP SDK for initialize/lifecycle handling.',
  'Start by reading arcade://desktop/start-here, then use resources/list, resources/templates/list, and resources/read to discover the published Desktop Arcade resource surface.',
  'The SDK resource surface is re-registered in this slice. Tool registration follows in later rebuild slices, so tool-only hosts still need follow-up work before they can rely on read_resource or mutation tools here.',
  'No token or authorization header is required for local use. Connect with an MCP-capable client or MCP Inspector over HTTP POST to continue the rebuild verification.',
].join('\n')

export interface DesktopMcpServerAvailabilityAvailable {
  status: 'available'
}

export interface DesktopMcpServerAvailabilityUnavailable {
  status: 'unavailable'
  reason: string
}

export type DesktopMcpServerAvailability =
  | DesktopMcpServerAvailabilityAvailable
  | DesktopMcpServerAvailabilityUnavailable

export interface DesktopMcpServerState {
  serverName: string
  transportLabel: string
  url: string
  requiresAuth: false
  authDescription: string
  availability: DesktopMcpServerAvailability
}

export interface DesktopMcpServer {
  getState: () => DesktopMcpServerState
  start: () => Promise<DesktopMcpServerState>
  stop: () => Promise<boolean>
}

export interface DesktopMcpServerOptions {
  host?: string
  port?: number
  path?: string
  readProjectResource?: DesktopMcpProjectResourceReadHandler
  mutateAnnotation?: unknown
  applyChanges?: unknown
  previewCaptureTtlMs?: number
}

export const createDesktopMcpServer = ({
  host = DESKTOP_MCP_HOST,
  port = DESKTOP_MCP_PORT,
  path = DESKTOP_MCP_PATH,
  readProjectResource,
  previewCaptureTtlMs,
}: DesktopMcpServerOptions = {}): DesktopMcpServer => {
  let activeServer: http.Server | null = null
  let startOperation: Promise<DesktopMcpServerState> | null = null
  const activeRequestSessions = new Set<DesktopMcpRequestSession>()
  const projectResourceReader: DesktopMcpProjectResourceReadHandler =
    readProjectResource ??
    (({ uri }) => ({
      ok: false,
      code: 'project-unavailable',
      resourceUri: uri,
      message:
        'Desktop Arcade project resources are unavailable because no active project reader is connected.',
    }))
  const previewCaptureStore = createDesktopMcpPreviewCaptureStore(previewCaptureTtlMs)
  let availability: DesktopMcpServerAvailability = {
    status: 'unavailable',
    reason: 'Desktop Arcade MCP has not started yet.',
  }

  const getPort = () => {
    const address = activeServer?.address()
    return address && typeof address !== 'string' ? address.port : port
  }

  const getState = (): DesktopMcpServerState => ({
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

  const buildSdkServer = () =>
    {
      const sdkServer = new McpServer(
        {
          name: DESKTOP_MCP_SERVER_NAME,
          version: DESKTOP_MCP_SERVER_VERSION,
        },
        {
          capabilities: {
            tools: {
              listChanged: false,
            },
            resources: {
              subscribe: false,
              listChanged: false,
            },
          },
          instructions: DESKTOP_MCP_BOOTSTRAP_INSTRUCTIONS,
        }
      )

      registerDesktopMcpResources(sdkServer, {
        host,
        port: getPort(),
        path,
        serverName: DESKTOP_MCP_SERVER_NAME,
        serverVersion: DESKTOP_MCP_SERVER_VERSION,
        transportLabel: DESKTOP_MCP_TRANSPORT_LABEL,
        authDescription: DESKTOP_MCP_AUTH_DESCRIPTION,
        readProjectResource: projectResourceReader,
        previewCaptureStore,
      })

      return sdkServer
    }

  const createRequestSession = async () => {
    const sdkServer = buildSdkServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    await sdkServer.connect(transport)

    let closed = false
    const requestSession: DesktopMcpRequestSession = {
      close: async () => {
        if (closed) {
          return
        }

        closed = true
        activeRequestSessions.delete(requestSession)
        await Promise.all([transport.close(), sdkServer.close()])
      },
      sdkServer,
      transport,
    }

    activeRequestSessions.add(requestSession)
    return requestSession
  }

  const handleSdkRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${getPort()}`)
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
        'Desktop Arcade MCP SDK bootstrap currently supports POST JSON-RPC requests only.'
      )
      return
    }

    let parsedBody: unknown
    try {
      const bodyText = await readRequestBody(request)
      parsedBody = JSON.parse(bodyText)
    } catch (error) {
      sendJsonRpcError(response, {
        httpStatus:
          error instanceof Error && error.message.includes('1MB limit')
            ? 413
            : 400,
        id: null,
        code:
          error instanceof Error && error.message.includes('1MB limit')
            ? -32000
            : -32700,
        message:
          error instanceof Error
            ? error.message
            : 'Desktop Arcade MCP request body must be valid JSON.',
      })
      return
    }

    const requestSession = await createRequestSession()
    const closeRequestSession = () => {
      response.off('close', closeRequestSession)
      response.off('finish', closeRequestSession)
      void requestSession.close()
    }

    response.once('close', closeRequestSession)
    response.once('finish', closeRequestSession)

    await requestSession.transport.handleRequest(request, response, parsedBody)
  }

  const start = async () => {
    if (activeServer?.listening) {
      availability = { status: 'available' }
      return getState()
    }

    if (startOperation) {
      return startOperation
    }

    const nextServer = http.createServer((request, response) => {
      void handleSdkRequest(request, response).catch((error: unknown) => {
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
    })

    startOperation = new Promise<DesktopMcpServerState>((resolve) => {
      const cleanupListeners = () => {
        nextServer.off('error', handleError)
        nextServer.off('listening', handleListening)
      }

      const handleListening = () => {
        cleanupListeners()
        activeServer = nextServer
        availability = { status: 'available' }
        resolve(getState())
      }

      const handleError = (error: unknown) => {
        cleanupListeners()
        availability = {
          status: 'unavailable',
          reason: formatServerErrorReason(error, { host, port }),
        }
        void closeServer(nextServer)
        resolve(getState())
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
    if (!activeServer && activeRequestSessions.size === 0) {
      return false
    }

    const serverToClose = activeServer

    activeServer = null
    availability = {
      status: 'unavailable',
      reason: 'Desktop Arcade MCP is not available.',
    }
    await Promise.all([
      serverToClose ? closeServer(serverToClose) : Promise.resolve(),
      ...Array.from(activeRequestSessions, (requestSession) => requestSession.close()),
    ])

    return true
  }

  return {
    getState,
    start,
    stop,
  }
}

interface DesktopMcpRequestSession {
  close: () => Promise<void>
  sdkServer: McpServer
  transport: StreamableHTTPServerTransport
}

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const sendJsonRpcError = (
  response: ServerResponse,
  {
    httpStatus = 200,
    id,
    code,
    message,
  }: {
    httpStatus?: number
    id: number | string | null
    code: number
    message: string
  }
) => {
  sendJson(response, httpStatus, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  })
}

const sendText = (response: ServerResponse, statusCode: number, message: string) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendMethodNotAllowed = (response: ServerResponse, message: string) => {
  response.statusCode = 405
  response.setHeader('allow', 'POST')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const readRequestBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []
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

const getRequestOrigin = (request: IncomingMessage) =>
  typeof request.headers.origin === 'string' && request.headers.origin.trim().length > 0
    ? request.headers.origin.trim()
    : null

const formatServerErrorReason = (error: unknown, { host, port }: { host: string; port: number }) => {
  if (isObjectWithCode(error) && error.code === 'EADDRINUSE') {
    return `Port ${port} on ${host} is already in use.`
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return `Desktop Arcade could not start MCP on ${host}:${port}.`
}

const closeServer = (server: http.Server) =>
  new Promise<void>((resolve, reject) => {
    const closeActiveConnections = () => {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections()
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections()
      }
    }

    server.close((error) => {
      if (isObjectWithCode(error) && error.code === 'ERR_SERVER_NOT_RUNNING') {
        resolve()
        return
      }
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
    closeActiveConnections()
  })

const isObjectWithCode = (value: unknown): value is { code?: string } =>
  typeof value === 'object' && value !== null

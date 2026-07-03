import { createServer, request, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DESKTOP_MCP_AUTH_DESCRIPTION,
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
} from '../../../desktop/mcpSdkServer'

interface DesktopMcpServerState {
  serverName: string
  transportLabel: string
  url: string
  requiresAuth: false
  authDescription: string
  availability: { status: 'available' } | { status: 'unavailable'; reason: string }
}

interface DesktopMcpServer {
  getState: () => DesktopMcpServerState
  start: () => Promise<DesktopMcpServerState>
  stop: () => Promise<boolean>
}

const activeServers: DesktopMcpServer[] = []
const occupiedServers: Server[] = []

const createManagedServer = (options?: { port?: number }): DesktopMcpServer => {
  const server = createDesktopMcpServer({ port: options?.port ?? 0 })
  activeServers.push(server)
  return server
}

describe('desktopMcpSdkServer', () => {
  afterEach(async () => {
    await Promise.all(activeServers.map((server) => server.stop()))
    activeServers.length = 0
    await Promise.all(occupiedServers.map(closeHttpServer))
    occupiedServers.length = 0
  })

  it('exports the fixed Desktop Arcade MCP configuration', () => {
    expect(DESKTOP_MCP_SERVER_NAME).toBe('aksel-arcade')
    expect(DESKTOP_MCP_SERVER_VERSION).toBe('0.0.0')
    expect(DESKTOP_MCP_TRANSPORT_LABEL).toBe('HTTP (MCP Streamable HTTP)')
    expect(DESKTOP_MCP_AUTH_DESCRIPTION).toBe('No token/header required.')
    expect(DESKTOP_MCP_PORT).toBe(3846)
    expect(DESKTOP_MCP_PATH).toBe('/mcp')
  })

  it('starts an SDK-backed endpoint that negotiates initialize through the official SDK', async () => {
    const server = createManagedServer()
    const state = await server.start()

    expect(state.availability).toEqual({ status: 'available' })
    expect(state.requiresAuth).toBe(false)
    expect(state.authDescription).toBe('No token/header required.')

    const url = new URL(state.url)
    const initialize = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'vitest',
          version: '1.0.0',
        },
      },
    })

    expect(initialize.status).toBe(200)
    expect(initialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: {
          name: 'aksel-arcade',
          version: '0.0.0',
        },
        capabilities: {
          tools: {
            listChanged: false,
          },
          resources: {
            subscribe: false,
            listChanged: false,
          },
        },
        instructions: expect.stringContaining('official TypeScript MCP SDK'),
      },
    })
    expect(
      (initialize.payload as { result: { instructions: string } }).result.instructions
    ).toContain('arcade://desktop/start-here')
    expect(
      (initialize.payload as { result: { protocolVersion: string } }).result.protocolVersion
    ).not.toBe('2024-11-05')
  })

  it('accepts repeated initialize requests without reusing a stateless transport', async () => {
    const server = createManagedServer()
    const state = await server.start()

    const url = new URL(state.url)
    const initializePayload = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'vitest',
          version: '1.0.0',
        },
      },
    }

    const firstInitialize = await postJsonRpc(url, {
      ...initializePayload,
      id: 1,
    })
    const secondInitialize = await postJsonRpc(url, {
      ...initializePayload,
      id: 2,
    })

    expect(firstInitialize.status).toBe(200)
    expect(firstInitialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: expect.any(Object),
    })
    expect(secondInitialize.status).toBe(200)
    expect(secondInitialize.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: expect.any(Object),
    })
  })

  it('reports an explicit unavailable reason when the fixed port is already occupied', async () => {
    const occupiedServer = await listenOnPort(0)
    occupiedServers.push(occupiedServer)
    const occupiedAddress = occupiedServer.address()
    const occupiedPort =
      occupiedAddress && typeof occupiedAddress !== 'string' ? occupiedAddress.port : 0

    const server = createManagedServer({ port: occupiedPort })
    const state = await server.start()
    expect(state.availability).toEqual({
      status: 'unavailable',
      reason: `Port ${occupiedPort} on 127.0.0.1 is already in use.`,
    })
  })
})

const postJsonRpc = async (url: URL, payload: Record<string, unknown>) => {
  return new Promise<{ status: number; payload: Record<string, unknown> }>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            payload: parseJsonOrSse(Buffer.concat(chunks).toString('utf8')),
          })
        })
        response.on('error', reject)
      }
    )

    req.on('error', reject)
    req.end(JSON.stringify(payload))
  })
}

const parseJsonOrSse = (bodyText: string) => {
  if (!bodyText.startsWith('event:')) {
    return JSON.parse(bodyText) as Record<string, unknown>
  }

  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))

  return JSON.parse(dataLines.join('\n')) as Record<string, unknown>
}

const listenOnPort = (port: number) =>
  new Promise<Server>((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.statusCode = 200
      response.end('occupied')
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}: {
  DESKTOP_MCP_PATH: string
  DESKTOP_MCP_PORT: number
  DESKTOP_MCP_SERVER_NAME: string
  DESKTOP_MCP_TRANSPORT_LABEL: string
  createDesktopMcpServer: (
    options?: Partial<{ host: string; port: number; path: string }>
  ) => DesktopMcpServer
} = require('../../../desktop/mcpServer.cjs')

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

const createManagedServer = (
  options?: Partial<{ host: string; port: number; path: string }>
): DesktopMcpServer => {
  const server = createDesktopMcpServer(options)
  activeServers.push(server)
  return server
}

describe('desktopMcpServer', () => {
  afterEach(async () => {
    await Promise.all(activeServers.map((server) => server.stop()))
    activeServers.length = 0
    await Promise.all(occupiedServers.map(closeHttpServer))
    occupiedServers.length = 0
  })

  it('exports the fixed Desktop Arcade MCP configuration', () => {
    expect(DESKTOP_MCP_SERVER_NAME).toBe('desktop-arcade')
    expect(DESKTOP_MCP_TRANSPORT_LABEL).toBe('HTTP (MCP Streamable HTTP)')
    expect(DESKTOP_MCP_PORT).toBe(3846)
    expect(DESKTOP_MCP_PATH).toBe('/mcp')
  })

  it('reports available when the MCP endpoint is listening and serves /mcp', async () => {
    const server = createManagedServer({ port: 0 })

    const state = await server.start()

    expect(state.availability).toEqual({ status: 'available' })
    expect(state.requiresAuth).toBe(false)
    expect(state.authDescription).toBe('No token/header required.')

    const url = new URL(state.url)
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.pathname).toBe('/mcp')
    expect(Number(url.port)).toBeGreaterThan(0)

    const response = await fetch(state.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    })

    expect(response.status).toBe(501)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'not-yet-implemented',
        message: 'Desktop Arcade MCP protocol foundation is not implemented yet.',
      },
    })
  })

  it('reports a visible unavailable reason when the configured port is already in use', async () => {
    const occupiedServer = createServer((_request, response) => {
      response.statusCode = 204
      response.end()
    })
    occupiedServers.push(occupiedServer)

    await listenOnPort(occupiedServer, 0)
    const address = occupiedServer.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected occupied server to bind to a TCP port.')
    }

    const server = createManagedServer({ port: address.port })
    const state = await server.start()

    expect(state.availability).toEqual({
      status: 'unavailable',
      reason: `Port ${address.port} on 127.0.0.1 is already in use.`,
    })
    expect(new URL(state.url).port).toBe(String(address.port))
  })
})

const listenOnPort = (server: Server, port: number) =>
  new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      const closeError = error as NodeJS.ErrnoException | null
      if (closeError && closeError.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error)
        return
      }

      resolve()
    })
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  })

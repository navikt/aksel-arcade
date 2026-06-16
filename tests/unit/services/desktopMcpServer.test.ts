import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}: {
  DESKTOP_MCP_PATH: string
  DESKTOP_MCP_PORT: number
  DESKTOP_MCP_SERVER_NAME: string
  DESKTOP_MCP_SERVER_VERSION: string
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
    expect(DESKTOP_MCP_SERVER_VERSION).toBe('0.0.0')
    expect(DESKTOP_MCP_TRANSPORT_LABEL).toBe('HTTP (MCP Streamable HTTP)')
    expect(DESKTOP_MCP_PORT).toBe(3846)
    expect(DESKTOP_MCP_PATH).toBe('/mcp')
  })

  it('reports available when the MCP endpoint is listening and accepts MCP initialize', async () => {
    const server = createManagedServer({ port: 0 })

    const state = await server.start()

    expect(state.availability).toEqual({ status: 'available' })
    expect(state.requiresAuth).toBe(false)
    expect(state.authDescription).toBe('No token/header required.')

    const url = new URL(state.url)
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.pathname).toBe('/mcp')
    expect(Number(url.port)).toBeGreaterThan(0)

    const response = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: 'desktop-arcade',
          version: '0.0.0',
        },
      },
    })
  })

  it('lists only the v1 MCP tools and stable direct resources', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const toolsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {
        _meta: {
          progressToken: 'tools-progress',
        },
      },
    })
    expect(toolsResponse.status).toBe(200)

    await expect(toolsResponse.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'capture_preview_evidence',
            inputSchema: {
              additionalProperties: false,
            },
          },
          {
            name: 'apply_changes',
            inputSchema: {
              additionalProperties: false,
            },
          },
        ],
      },
    })

    const resourcesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
      params: {
        _meta: {
          progressToken: 'resources-progress',
        },
      },
    })
    const resourcesPayload = await resourcesResponse.json()

    expect(resourcesResponse.status).toBe(200)
    expect(resourcesPayload.result.resources.map((resource: { uri: string }) => resource.uri)).toEqual([
      'arcade://desktop/operating-guide',
      'arcade://desktop/authoring-guide',
      'arcade://desktop/capabilities',
      'arcade://project/manifest',
      'arcade://project/preview-context',
      'arcade://project/diagnostics',
    ])
  })

  it('returns 202 for initialized notifications and keeps unsupported MCP surfaces undiscoverable', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const notificationResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    expect(notificationResponse.status).toBe(202)
    expect(await notificationResponse.text()).toBe('')

    const malformedNotificationResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: 'unexpected',
    })
    expect(malformedNotificationResponse.status).toBe(202)
    expect(await malformedNotificationResponse.text()).toBe('')

    const promptsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 4,
      method: 'prompts/list',
    })
    expect(promptsResponse.status).toBe(200)
    await expect(promptsResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: {
        code: -32601,
        message: 'Desktop Arcade MCP method "prompts/list" is not supported in v1.',
      },
    })
  })

  it('returns structured placeholder failures for known tools and rejects unknown tools or unsupported fields', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const knownToolResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          pageId: 'page01',
          viewportSize: 'MD',
        },
        _meta: {
          progressToken: 'tool-progress',
        },
      },
    })
    expect(knownToolResponse.status).toBe(200)
    await expect(knownToolResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 5,
      result: {
        content: [
          {
            type: 'text',
            text: 'Desktop Arcade MCP tool "capture_preview_evidence" is not implemented yet.',
          },
        ],
        isError: true,
        structuredContent: {
          code: 'not-yet-implemented',
          toolName: 'capture_preview_evidence',
          message:
            'Desktop Arcade MCP tool "capture_preview_evidence" is not implemented yet.',
        },
      },
    })

    const applyChangesResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 51,
      method: 'tools/call',
      params: {
        name: 'apply_changes',
        arguments: {
          summary: 'Rename the project',
          operations: [
            {
              type: 'rename_project',
              name: 'Renamed project',
            },
          ],
        },
      },
    })
    expect(applyChangesResponse.status).toBe(200)
    await expect(applyChangesResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 51,
      result: {
        content: [
          {
            type: 'text',
            text: 'Desktop Arcade MCP tool "apply_changes" is not implemented yet.',
          },
        ],
        isError: true,
        structuredContent: {
          code: 'not-yet-implemented',
          toolName: 'apply_changes',
          message: 'Desktop Arcade MCP tool "apply_changes" is not implemented yet.',
        },
      },
    })

    const unknownToolResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
      },
    })
    expect(unknownToolResponse.status).toBe(200)
    await expect(unknownToolResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 6,
      error: {
        code: -32602,
        message: 'Unknown Desktop Arcade MCP tool "unknown_tool".',
        data: {
          code: 'unknown-tool',
          toolName: 'unknown_tool',
        },
      },
    })

    const invalidToolFieldResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'capture_preview_evidence',
        arguments: {
          surprise: true,
        },
      },
    })
    expect(invalidToolFieldResponse.status).toBe(200)
    await expect(invalidToolFieldResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 7,
      error: {
        code: -32602,
        message: 'capture_preview_evidence arguments contain unsupported fields: surprise.',
        data: {
          code: 'invalid-tool-arguments',
          toolName: 'capture_preview_evidence',
        },
      },
    })
  })

  it('returns clear JSON-RPC errors for known and unknown resources and rejects unsupported resource fields', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const knownResourceResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/operating-guide',
        _meta: {
          progressToken: 'resource-progress',
        },
      },
    })
    expect(knownResourceResponse.status).toBe(200)
    await expect(knownResourceResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 8,
      error: {
        code: -32002,
        message:
          'Desktop Arcade MCP resource "arcade://desktop/operating-guide" is not implemented yet.',
        data: {
          code: 'not-yet-implemented',
          resourceUri: 'arcade://desktop/operating-guide',
        },
      },
    })

    const unknownResourceResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 9,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/missing',
      },
    })
    expect(unknownResourceResponse.status).toBe(200)
    await expect(unknownResourceResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 9,
      error: {
        code: -32002,
        message: 'Unknown Desktop Arcade MCP resource "arcade://desktop/missing".',
        data: {
          code: 'resource-not-found',
          resourceUri: 'arcade://desktop/missing',
        },
      },
    })

    const invalidResourceFieldsResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 10,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/operating-guide',
        extra: true,
      },
    })
    expect(invalidResourceFieldsResponse.status).toBe(200)
    await expect(invalidResourceFieldsResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 10,
      error: {
        code: -32602,
        message: 'Desktop Arcade MCP resources/read params contain unsupported fields: extra.',
      },
    })
  })

  it('rejects browser-originated requests and unsupported GET or SSE entrypoints', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const browserOriginResponse = await postJson(
      state.url,
      { jsonrpc: '2.0', id: 11, method: 'initialize' },
      { Origin: 'https://example.com' }
    )
    expect(browserOriginResponse.status).toBe(403)
    expect(await browserOriginResponse.text()).toContain('Remove the Origin header')

    const getResponse = await fetch(state.url, {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
      },
    })
    expect(getResponse.status).toBe(405)
    expect(getResponse.headers.get('allow')).toBe('POST')
    expect(await getResponse.text()).toContain('does not support GET or SSE streams')
  })

  it('returns protocol errors for malformed JSON and invalid JSON-RPC envelopes', async () => {
    const server = createManagedServer({ port: 0 })
    const state = await server.start()

    const invalidJsonResponse = await fetch(state.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(invalidJsonResponse.status).toBe(400)
    await expect(invalidJsonResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Desktop Arcade MCP request body must be valid JSON.',
      },
    })

    const invalidEnvelopeResponse = await postJson(state.url, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/list',
      extra: true,
    })
    expect(invalidEnvelopeResponse.status).toBe(400)
    await expect(invalidEnvelopeResponse.json()).resolves.toEqual({
      jsonrpc: '2.0',
      id: 12,
      error: {
        code: -32600,
        message:
          'Desktop Arcade MCP requests must be single JSON-RPC 2.0 objects with a string method.',
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

const postJson = (
  url: string,
  payload: unknown,
  headers: Record<string, string> = {}
) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
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

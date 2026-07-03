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
import type { DesktopMcpProjectResourceReadHandler } from '../../../src/services/desktopMcpProjectResourceProtocol'

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

const createManagedServer = (options?: {
  port?: number
  readProjectResource?: DesktopMcpProjectResourceReadHandler
}): DesktopMcpServer => {
  const server = createDesktopMcpServer({
    port: options?.port ?? 0,
    readProjectResource: options?.readProjectResource,
  })
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

  it('lists SDK-backed resources/templates and reads representative project resources', async () => {
    const server = createManagedServer({
      readProjectResource: createStubProjectResourceReadHandler(),
    })
    const state = await server.start()
    const url = new URL(state.url)

    const resourcesList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
    })
    expect(resourcesList.status).toBe(200)
    expect(resourcesList.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        resources: expect.any(Array),
      },
    })

    const listedUris = (
      resourcesList.payload as {
        result: { resources: Array<{ uri: string }> }
      }
    ).result.resources.map((resource) => resource.uri)
    expect(listedUris).toEqual(
      expect.arrayContaining([
        'arcade://desktop/start-here',
        'arcade://desktop/operating-guide',
        'arcade://desktop/authoring-guide',
        'arcade://desktop/capabilities',
        'arcade://desktop/apply-changes-operations',
        'arcade://aksel/catalog',
        'arcade://project/manifest',
        'arcade://project/annotations',
        'arcade://project/preview-context',
        'arcade://project/diagnostics',
        'arcade://project/source/global/jsx',
        'arcade://project/source/global/hooks',
        'arcade://project/source/pages/page01/jsx',
        'arcade://project/source/pages/page01/hooks',
        'arcade://project/pages/page01/annotations',
      ])
    )

    const resourceTemplatesList = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/templates/list',
    })
    expect(resourceTemplatesList.status).toBe(200)
    expect(resourceTemplatesList.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 4,
      result: {
        resourceTemplates: expect.any(Array),
      },
    })
    expect(
      (
        resourceTemplatesList.payload as {
          result: { resourceTemplates: Array<{ uriTemplate: string }> }
        }
      ).result.resourceTemplates.map((template) => template.uriTemplate)
    ).toEqual(
      expect.arrayContaining([
        'arcade://project/source/pages/{pageId}/jsx',
        'arcade://project/source/pages/{pageId}/hooks',
        'arcade://project/pages/{pageId}/annotations',
        'arcade://aksel/components/{name}',
        'arcade://preview/captures/{captureId}/manifest',
      ])
    )

    const startHere = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/start-here',
      },
    })
    expect(startHere.status).toBe(200)
    expect(startHere.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 5,
      result: {
        contents: [
          {
            uri: 'arcade://desktop/start-here',
            mimeType: 'text/markdown',
            text: expect.stringContaining('# Desktop Arcade MCP start-here'),
          },
        ],
      },
    })

    const capabilitiesResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/read',
      params: {
        uri: 'arcade://desktop/capabilities',
      },
    })
    const capabilities = JSON.parse(
      (
        capabilitiesResponse.payload as {
          result: { contents: Array<{ text: string }> }
        }
      ).result.contents[0].text
    ) as {
      endpoint: string
      toolNames: string[]
      resourceTemplateUris: string[]
      omittedFeatures: string[]
    }
    expect(capabilities.endpoint).toBe(state.url)
    expect(capabilities.toolNames).toEqual([])
    expect(capabilities.resourceTemplateUris).toEqual(
      expect.arrayContaining([
        'arcade://project/source/pages/{pageId}/jsx',
        'arcade://project/pages/{pageId}/annotations',
        'arcade://aksel/components/{name}',
      ])
    )
    expect(capabilities.omittedFeatures).toEqual(
      expect.arrayContaining(['No prompts surface.', 'No list-changed notifications.'])
    )

    const manifestResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/manifest',
      },
    })
    const manifest = JSON.parse(
      (
        manifestResponse.payload as {
          result: { contents: Array<{ text: string }> }
        }
      ).result.contents[0].text
    ) as {
      activePageId: string
      pages: Array<{ id: string }>
    }
    expect(manifest.activePageId).toBe('page01')
    expect(manifest.pages).toEqual([{ id: 'page01', name: 'Landing', source: expect.any(Object) }])

    const pageJsxResponse = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 8,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/source/pages/page01/jsx',
      },
    })
    expect(pageJsxResponse.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 8,
      result: {
        contents: [
          {
            uri: 'arcade://project/source/pages/page01/jsx',
            mimeType: 'text/plain',
            text: '<Page>Landing</Page>',
          },
        ],
      },
    })

    const invalidPageResource = await postJsonRpc(url, {
      jsonrpc: '2.0',
      id: 9,
      method: 'resources/read',
      params: {
        uri: 'arcade://project/pages/page99/annotations',
      },
    })
    expect(invalidPageResource.status).toBe(200)
    expect(invalidPageResource.payload).toMatchObject({
      jsonrpc: '2.0',
      id: 9,
      error: {
        code: -32602,
        data: {
          code: 'invalid-resource-uri',
          resourceUri: 'arcade://project/pages/page99/annotations',
        },
      },
    })
    expect(
      (
        invalidPageResource.payload as {
          error: { message: string }
        }
      ).error.message
    ).toContain('arcade://project/pages/page99/annotations')
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

const createStubProjectResourceReadHandler = (): DesktopMcpProjectResourceReadHandler => {
  const resources = new Map<string, { mimeType: string; text: string }>([
    [
      'arcade://project/manifest',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'Resource test project',
          projectRevision: 'rev-resource-test',
          activePageId: 'page01',
          globalConfig: {
            source: {
              jsx: { uri: 'arcade://project/source/global/jsx' },
              hooks: { uri: 'arcade://project/source/global/hooks' },
            },
          },
          pages: [
            {
              id: 'page01',
              name: 'Landing',
              source: {
                jsx: { uri: 'arcade://project/source/pages/page01/jsx' },
                hooks: { uri: 'arcade://project/source/pages/page01/hooks' },
              },
            },
          ],
        }),
      },
    ],
    [
      'arcade://project/annotations',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          scope: 'project',
          annotations: [],
        }),
      },
    ],
    [
      'arcade://project/preview-context',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          viewportSize: 'MD',
          theme: 'light',
        }),
      },
    ],
    [
      'arcade://project/diagnostics',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          status: 'idle',
          issues: [],
        }),
      },
    ],
    [
      'arcade://project/source/global/jsx',
      {
        mimeType: 'text/plain',
        text: '<Theme>{children}</Theme>',
      },
    ],
    [
      'arcade://project/source/global/hooks',
      {
        mimeType: 'text/plain',
        text: 'const noop = () => {}',
      },
    ],
    [
      'arcade://project/source/pages/page01/jsx',
      {
        mimeType: 'text/plain',
        text: '<Page>Landing</Page>',
      },
    ],
    [
      'arcade://project/source/pages/page01/hooks',
      {
        mimeType: 'text/plain',
        text: 'const [open, setOpen] = useState(false)',
      },
    ],
    [
      'arcade://project/pages/page01/annotations',
      {
        mimeType: 'application/json',
        text: JSON.stringify({
          scope: 'page',
          page: {
            id: 'page01',
            name: 'Landing',
            isActive: true,
          },
          annotations: [],
        }),
      },
    ],
  ])

  return async ({ uri }) => {
    const resource = resources.get(uri)
    if (!resource) {
      return {
        ok: false,
        code: 'invalid-resource-uri',
        resourceUri: uri,
        message: `Unknown project resource "${uri}".`,
      }
    }

    return {
      ok: true,
      uri,
      mimeType: resource.mimeType,
      text: resource.text,
    }
  }
}

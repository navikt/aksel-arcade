import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentPairingHandoffCommand,
} from '@/services/agentBridge'
import type { DesktopAgentTransportSession } from '@/services/desktopAgentSessionCoordinator'

const require = createRequire(import.meta.url)
const {
  LOOPBACK_HOST,
  createAgentLoopbackJsonRpcTransport,
}: {
  LOOPBACK_HOST: string
  createAgentLoopbackJsonRpcTransport: (
    options?: AgentLoopbackJsonRpcTransportOptions
  ) => AgentLoopbackJsonRpcTransport
} = require('../../../desktop/agentLoopbackTransport.cjs')

interface AgentLoopbackJsonRpcTransport {
  startSession: (session: DesktopAgentTransportSession) => Promise<{
    endpoint: string
    sessionId: string
    authorizationHeader: string
  }>
  stopSession: (sessionId?: string) => Promise<boolean>
}

interface AgentLoopbackJsonRpcRouteRequest {
  id: string | number | null
  method: string
  params?: unknown
  session: Omit<DesktopAgentTransportSession, 'pairingCredential'>
}

interface AgentLoopbackJsonRpcTransportOptions {
  routeRequest?: (request: AgentLoopbackJsonRpcRouteRequest) => unknown | Promise<unknown>
}

const activeTransports: AgentLoopbackJsonRpcTransport[] = []

const createTransport = (options?: AgentLoopbackJsonRpcTransportOptions) => {
  const transport = createAgentLoopbackJsonRpcTransport(options)
  activeTransports.push(transport)
  return transport
}

const createSession = (
  overrides: Partial<DesktopAgentTransportSession> = {}
): DesktopAgentTransportSession => ({
  id: 'agent-session-1',
  startedAt: '2026-05-27T08:00:00.000Z',
  status: 'active',
  permissions: DEFAULT_AGENT_PERMISSIONS,
  pairingCredential: 'agent-secret-1',
  ...overrides,
})

const postJsonRpc = async (
  endpoint: string,
  body: unknown,
  authorizationHeader?: string,
  query = ''
) => {
  const response = await fetch(`${endpoint}${query}`, {
    method: 'POST',
    headers: {
      ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
      'Content-Type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

  return {
    body: await response.json(),
    status: response.status,
  }
}

describe('desktop Agent loopback JSON-RPC transport', () => {
  afterEach(async () => {
    await Promise.all(activeTransports.map((transport) => transport.stopSession()))
    activeTransports.length = 0
  })

  it('starts on a random localhost port and rejects unauthenticated or query-credential requests', async () => {
    const transport = createTransport()
    const endpoint = await transport.startSession(createSession())
    const endpointUrl = new URL(endpoint.endpoint)

    expect(endpointUrl.hostname).toBe(LOOPBACK_HOST)
    expect(Number(endpointUrl.port)).toBeGreaterThan(0)
    expect(endpoint).toMatchObject({
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer agent-secret-1',
    })

    await expect(
      postJsonRpc(endpoint.endpoint, { jsonrpc: '2.0', id: 1, method: 'getProject' })
    ).resolves.toMatchObject({
      status: 401,
      body: {
        error: {
          data: {
            code: 'missing-authorization',
          },
        },
      },
    })

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 1, method: 'getProject' },
        'Bearer wrong-secret'
      )
    ).resolves.toMatchObject({
      status: 401,
      body: {
        error: {
          data: {
            code: 'invalid-authorization',
          },
        },
      },
    })

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 1, method: 'getProject' },
        endpoint.authorizationHeader,
        '?token=agent-secret-1'
      )
    ).resolves.toMatchObject({
      status: 400,
      body: {
        error: {
          data: {
            code: 'credentials-in-query',
          },
        },
      },
    })
  })

  it('returns structured JSON-RPC errors for malformed requests and unsupported methods', async () => {
    const transport = createTransport()
    const endpoint = await transport.startSession(createSession())

    await expect(
      postJsonRpc(endpoint.endpoint, '{', endpoint.authorizationHeader)
    ).resolves.toEqual({
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Agent JSON-RPC request body must be valid JSON.',
          data: {
            code: 'parse-error',
          },
        },
      },
    })

    await expect(
      postJsonRpc(endpoint.endpoint, { jsonrpc: '2.0', id: 2 }, endpoint.authorizationHeader)
    ).resolves.toMatchObject({
      status: 400,
      body: {
        id: 2,
        error: {
          code: -32600,
          data: {
            code: 'invalid-request',
          },
        },
      },
    })

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 'read-1', method: 'getProject', params: {} },
        endpoint.authorizationHeader
      )
    ).resolves.toEqual({
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: 'read-1',
        error: {
          code: -32601,
          message: 'Unsupported Agent transport method "getProject".',
          data: {
            code: 'unsupported-method',
          },
        },
      },
    })
  })

  it('routes authenticated JSON-RPC calls without exposing pairing credentials to the route boundary', async () => {
    const routedRequests: AgentLoopbackJsonRpcRouteRequest[] = []
    const transport = createTransport({
      routeRequest: (request) => {
        routedRequests.push(request)
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            ok: true,
            command: request.method,
            data: {
              name: 'Routed project',
              jsxCode: '<Button>Routed</Button>',
              hooksCode: '',
            },
          },
        }
      },
    })
    const endpoint = await transport.startSession(createSession())

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 'read-1', method: 'getProject', params: {} },
        endpoint.authorizationHeader
      )
    ).resolves.toEqual({
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: 'read-1',
        result: {
          ok: true,
          command: 'getProject',
          data: {
            name: 'Routed project',
            jsxCode: '<Button>Routed</Button>',
            hooksCode: '',
          },
        },
      },
    })

    expect(routedRequests).toEqual([
      {
        id: 'read-1',
        method: 'getProject',
        params: {},
        session: {
          id: 'agent-session-1',
          startedAt: '2026-05-27T08:00:00.000Z',
          status: 'active',
          permissions: DEFAULT_AGENT_PERMISSIONS,
        },
      },
    ])
    expect(JSON.stringify(routedRequests)).not.toContain('agent-secret-1')
  })

  it('serves getAgentInstructions through the copied bootstrap request and fails after stop', async () => {
    const transport = createTransport({
      routeRequest: (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          ok: true,
          command: request.method,
          data: {
            sessionId: request.session.id,
            readScope: 'arcade-session',
          },
        },
      }),
    })
    const endpoint = await transport.startSession(createSession())
    const command = createAgentPairingHandoffCommand(endpoint)

    expect(command).toBe(
      `curl -sS -X POST '${endpoint.endpoint}' -H 'Authorization: ${endpoint.authorizationHeader}' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    )
    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 'agent-instructions-1', method: 'getAgentInstructions' },
        endpoint.authorizationHeader
      )
    ).resolves.toMatchObject({
      status: 200,
      body: {
        jsonrpc: '2.0',
        id: 'agent-instructions-1',
        result: {
          ok: true,
          command: 'getAgentInstructions',
          data: {
            sessionId: 'agent-session-1',
            readScope: 'arcade-session',
          },
        },
      },
    })

    await transport.stopSession('agent-session-1')

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 'agent-instructions-1', method: 'getAgentInstructions' },
        endpoint.authorizationHeader
      )
    ).rejects.toThrow()
  })

  it('redacts handoff secrets from instruction fetch failure responses', async () => {
    let endpoint: {
      endpoint: string
      sessionId: string
      authorizationHeader: string
    } | null = null
    const transport = createTransport({
      routeRequest: () => {
        if (!endpoint) {
          throw new Error('Endpoint fixture was not initialized.')
        }

        const command = createAgentPairingHandoffCommand(endpoint)
        throw new Error(
          `Instruction fetch failed for ${command} ${endpoint.endpoint} ${endpoint.authorizationHeader}.`
        )
      },
    })
    endpoint = await transport.startSession(createSession())

    const response = await postJsonRpc(
      endpoint.endpoint,
      { jsonrpc: '2.0', id: 'agent-instructions-1', method: 'getAgentInstructions' },
      endpoint.authorizationHeader
    )
    const serializedBody = JSON.stringify(response.body)

    expect(response.status).toBe(500)
    expect(response.body.error.message).toContain('[redacted Agent pairing handoff]')
    expect(serializedBody).not.toContain(endpoint.endpoint)
    expect(serializedBody).not.toContain(endpoint.authorizationHeader)
    expect(serializedBody).not.toContain('agent-secret-1')
  })

  it('shuts down the endpoint when Agent access ends', async () => {
    const transport = createTransport()
    const endpoint = await transport.startSession(createSession())

    expect(await transport.stopSession('agent-session-1')).toBe(true)

    await expect(
      postJsonRpc(
        endpoint.endpoint,
        { jsonrpc: '2.0', id: 1, method: 'getProject' },
        endpoint.authorizationHeader
      )
    ).rejects.toThrow()
  })

  it('serializes concurrent starts so the latest session owns the active endpoint', async () => {
    const transport = createTransport()

    const [firstEndpoint, secondEndpoint] = await Promise.all([
      transport.startSession(
        createSession({
          id: 'agent-session-1',
          pairingCredential: 'agent-secret-1',
        })
      ),
      transport.startSession(
        createSession({
          id: 'agent-session-2',
          pairingCredential: 'agent-secret-2',
        })
      ),
    ])

    expect(firstEndpoint).toMatchObject({
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer agent-secret-1',
    })
    expect(secondEndpoint).toMatchObject({
      sessionId: 'agent-session-2',
      authorizationHeader: 'Bearer agent-secret-2',
    })

    await expect(
      postJsonRpc(
        firstEndpoint.endpoint,
        { jsonrpc: '2.0', id: 1, method: 'getProject' },
        firstEndpoint.authorizationHeader
      )
    ).rejects.toThrow()
    await expect(
      postJsonRpc(
        secondEndpoint.endpoint,
        { jsonrpc: '2.0', id: 2, method: 'getProject' },
        secondEndpoint.authorizationHeader
      )
    ).resolves.toMatchObject({
      status: 200,
      body: {
        id: 2,
        error: {
          data: {
            code: 'unsupported-method',
          },
        },
      },
    })
  })
})

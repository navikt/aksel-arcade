import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentBridgeCommandRouter,
  type AgentBridgeCommandResult,
  type AgentBridgeController,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentSourceChangeResult,
} from '@/services/agentBridge'
import {
  routeDesktopAgentTransportRequest,
  type DesktopAgentTransportRouteRequest,
} from '@/services/desktopAgentTransportProtocol'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'

const session = {
  id: 'agent-session-1',
  startedAt: '2026-05-27T08:00:00.000Z',
  transportEndpoint: {
    endpoint: 'http://127.0.0.1:48123',
    sessionId: 'agent-session-1',
    authorizationHeader: 'Bearer agent-secret-1',
  },
}

const diagnostics: PreviewDiagnostics = {
  status: 'idle',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: [],
}

const readContext: AgentBridgeReadContext = {
  project: {
    name: 'Transport request test',
    jsxCode: '<Button>Read</Button>',
    hooksCode: 'const value = "read"',
  },
  preview: {
    theme: 'dark',
    viewportSize: 'MD',
  },
  diagnostics,
}

const createApplySuccess = (
  changedFields: AgentChangeField[] = ['jsxCode']
): AgentBridgeCommandResult<AgentSourceChangeResult> => ({
  ok: true,
  command: 'applySourceChange',
  data: {
    checkpointId: 'checkpoint-1',
    changedFields,
  },
})

const createController = (
  active = true,
  applyResult: AgentBridgeCommandResult<AgentSourceChangeResult> = createApplySuccess()
) => {
  const appliedRequests: unknown[] = []
  const controller: AgentBridgeController = {
    getReadContext: () => readContext,
    getPermissions: () => DEFAULT_AGENT_PERMISSIONS,
    isSessionActive: () => active,
    recordActivity: () => undefined,
    applySourceChange: (request) => {
      appliedRequests.push(request)
      return applyResult
    },
    getPreviewEvidence: () => ({
      ok: true,
      evidence: {
        frame: {
          rootSelector: '#root',
          viewport: {
            width: 1024,
            height: 768,
            devicePixelRatio: 1,
          },
          scroll: {
            x: 0,
            y: 0,
          },
          capturedElementCount: 0,
          truncated: false,
        },
        tree: {
          tagName: 'div',
          text: 'Read',
          boundingBox: {
            x: 0,
            y: 0,
            width: 100,
            height: 40,
            top: 0,
            right: 100,
            bottom: 40,
            left: 0,
          },
          computedStyle: {
            display: 'block',
          },
        },
      },
    }),
  }

  return { appliedRequests, controller }
}

const routeRequest = (
  request: DesktopAgentTransportRouteRequest,
  active = true,
  applyResult?: AgentBridgeCommandResult<AgentSourceChangeResult>
) => {
  const fixture = createController(active, applyResult)
  const response = routeDesktopAgentTransportRequest(request, {
    session,
    router: createAgentBridgeCommandRouter(session, fixture.controller),
  })

  return { ...fixture, response }
}

describe('desktop Agent transport protocol', () => {
  it('routes authenticated read method names through the Agent bridge router', () => {
    expect(
      routeRequest({
        id: 'read-1',
        method: 'getProject',
        params: {},
        sessionId: session.id,
      }).response
    ).toEqual({
      jsonrpc: '2.0',
      id: 'read-1',
      result: {
        ok: true,
        command: 'getProject',
        data: readContext.project,
      },
    })
  })

  it('routes authenticated getAgentInstructions without project content', () => {
    const response = routeRequest({
      id: 'instructions-1',
      method: 'getAgentInstructions',
      params: {},
      sessionId: session.id,
    }).response

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'instructions-1',
      result: {
        ok: true,
        command: 'getAgentInstructions',
        data: {
          version: 1,
          sessionId: session.id,
          endpoint: session.transportEndpoint.endpoint,
          authorizationHeader: session.transportEndpoint.authorizationHeader,
          permissions: DEFAULT_AGENT_PERMISSIONS,
          readScope: 'arcade-session',
        },
      },
    })
    expect(JSON.stringify(response)).not.toContain(readContext.project.name)
    expect(JSON.stringify(response)).not.toContain(readContext.project.jsxCode)
    expect(JSON.stringify(response)).not.toContain('sandboxConsoleMessages')
  })

  it('routes authenticated applySourceChange params through the Agent bridge router', () => {
    const params = {
      summary: 'Transport update',
      jsxCode: '<Button>Updated through transport</Button>',
      viewportSize: 'LG',
    }
    const { appliedRequests, response } = routeRequest({
      id: 'change-1',
      method: 'applySourceChange',
      params,
      sessionId: session.id,
    })

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'change-1',
      result: createApplySuccess(),
    })
    expect(appliedRequests).toEqual([params])
  })

  it('returns structured bridge validation failures for rejected Agent changes', () => {
    const params = {
      summary: '',
      jsxCode: '<Button>Invalid</Button>',
    }
    const { appliedRequests, response } = routeRequest(
      {
        id: 'change-1',
        method: 'applySourceChange',
        params,
        sessionId: session.id,
      },
      true,
      {
        ok: false,
        command: 'applySourceChange',
        error: {
          code: 'invalid-request',
          message: 'A non-empty human-readable summary is required.',
        },
      }
    )

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'change-1',
      error: {
        code: -32002,
        data: {
          code: 'invalid-request',
          command: 'applySourceChange',
          bridgeError: {
            code: 'invalid-request',
          },
        },
      },
    })
    expect(appliedRequests).toEqual([params])
  })

  it('rejects non-bridge methods from the transport surface', () => {
    expect(
      routeRequest({
        id: 'shell-1',
        method: 'openShell',
        sessionId: session.id,
      }).response
    ).toMatchObject({
      error: {
        code: -32601,
        message:
          'Unsupported Agent transport method "openShell". Supported methods: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applySourceChange.',
        data: {
          code: 'unsupported-method',
        },
      },
    })
  })

  it('does not expose Agent-triggered Checkpoint rollback methods', () => {
    for (const method of ['restoreCheckpoint', 'deleteCheckpoint']) {
      expect(
        routeRequest({
          id: `${method}-1`,
          method,
          params: {
            checkpointId: 'checkpoint-1',
          },
          sessionId: session.id,
        }).response
      ).toMatchObject({
        error: {
          code: -32601,
          message: expect.stringContaining(`Unsupported Agent transport method "${method}"`),
          data: {
            code: 'unsupported-method',
          },
        },
      })
    }
  })

  it('returns structured errors for stale renderer sessions and revoked bridge sessions', () => {
    expect(
      routeRequest({
        id: 'stale-1',
        method: 'getProject',
        sessionId: 'stale-session',
      }).response
    ).toMatchObject({
      error: {
        code: -32001,
        data: {
          code: 'session-mismatch',
        },
      },
    })

    const { appliedRequests, response } = routeRequest(
      {
        id: 'revoked-1',
        method: 'applySourceChange',
        params: {
          summary: 'Should not mutate',
          jsxCode: '<Button>Revoked</Button>',
        },
        sessionId: session.id,
      },
      false
    )

    expect(response).toMatchObject({
      error: {
        code: -32002,
        data: {
          code: 'session-revoked',
          command: 'applySourceChange',
        },
      },
    })
    expect(appliedRequests).toEqual([])

    expect(
      routeRequest(
        {
          id: 'revoked-instructions-1',
          method: 'getAgentInstructions',
          sessionId: session.id,
        },
        false
      ).response
    ).toMatchObject({
      error: {
        code: -32002,
        data: {
          code: 'session-revoked',
          command: 'getAgentInstructions',
        },
      },
    })
  })
})

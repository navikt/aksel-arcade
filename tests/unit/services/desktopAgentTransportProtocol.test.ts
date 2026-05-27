import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentBridgeCommandRouter,
  type AgentBridgeController,
  type AgentBridgeReadContext,
} from '@/services/agentBridge'
import {
  routeDesktopAgentTransportReadRequest,
  type DesktopAgentTransportRouteRequest,
} from '@/services/desktopAgentTransportProtocol'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'

const session = {
  id: 'agent-session-1',
  startedAt: '2026-05-27T08:00:00.000Z',
}

const diagnostics: PreviewDiagnostics = {
  status: 'idle',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: [],
}

const readContext: AgentBridgeReadContext = {
  project: {
    name: 'Transport read test',
    jsxCode: '<Button>Read</Button>',
    hooksCode: 'const value = "read"',
  },
  preview: {
    theme: 'dark',
    viewportSize: 'MD',
  },
  diagnostics,
}

const createController = (active = true): AgentBridgeController => ({
  getReadContext: () => readContext,
  getPermissions: () => DEFAULT_AGENT_PERMISSIONS,
  isSessionActive: () => active,
  recordActivity: () => undefined,
  applySourceChange: () => {
    throw new Error('applySourceChange must not be routed by read-only transport requests.')
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
})

const routeRequest = (request: DesktopAgentTransportRouteRequest, active = true) =>
  routeDesktopAgentTransportReadRequest(request, {
    session,
    router: createAgentBridgeCommandRouter(session, createController(active)),
  })

describe('desktop Agent transport protocol', () => {
  it('routes authenticated read method names through the Agent bridge router', () => {
    expect(
      routeRequest({
        id: 'read-1',
        method: 'getProject',
        params: {},
        sessionId: session.id,
      })
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

  it('rejects mutation and non-bridge methods from the read-only transport surface', () => {
    expect(
      routeRequest({
        id: 'change-1',
        method: 'applySourceChange',
        params: {
          summary: 'Should not mutate',
          jsxCode: '<Button>Mutated</Button>',
        },
        sessionId: session.id,
      })
    ).toMatchObject({
      jsonrpc: '2.0',
      id: 'change-1',
      error: {
        code: -32601,
        data: {
          code: 'unsupported-method',
        },
      },
    })

    expect(
      routeRequest({
        id: 'shell-1',
        method: 'openShell',
        sessionId: session.id,
      })
    ).toMatchObject({
      error: {
        data: {
          code: 'unsupported-method',
        },
      },
    })
  })

  it('returns structured errors for stale renderer sessions and revoked bridge sessions', () => {
    expect(
      routeRequest({
        id: 'stale-1',
        method: 'getProject',
        sessionId: 'stale-session',
      })
    ).toMatchObject({
      error: {
        code: -32001,
        data: {
          code: 'session-mismatch',
        },
      },
    })

    expect(
      routeRequest(
        {
          id: 'revoked-1',
          method: 'getProject',
          sessionId: session.id,
        },
        false
      )
    ).toMatchObject({
      error: {
        code: -32002,
        data: {
          code: 'session-revoked',
          command: 'getProject',
        },
      },
    })
  })
})

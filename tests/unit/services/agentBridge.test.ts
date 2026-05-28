import { describe, expect, it } from 'vitest'
import {
  AGENT_BRIDGE_COMMAND_NAMES,
  AGENT_BRIDGE_READ_COMMAND_NAMES,
  DEFAULT_AGENT_PERMISSIONS,
  createAgentInstructions,
  createAgentPairingHandoffCommand,
  createAgentBridge,
  createAgentBridgeCommandRouter,
  isAgentBridgeCommandName,
  isAgentBridgeReadCommandName,
  type AgentBridgeCommandName,
  type AgentBridgeCommandResult,
  type AgentBridgeController,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentPermissions,
  type AgentSourceChangeResult,
} from '@/services/agentBridge'
import {
  PREVIEW_EVIDENCE_ROOT_SELECTOR,
  type PreviewEvidence,
  type PreviewEvidenceCaptureResult,
} from '@/services/previewEvidence'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'

const session = {
  id: 'agent-session-1',
  startedAt: '2026-05-27T08:00:00.000Z',
}

const desktopSession = {
  ...session,
  transportEndpoint: {
    endpoint: 'http://127.0.0.1:48123',
    sessionId: session.id,
    authorizationHeader: 'Bearer copied-agent-secret',
  },
}

const createDiagnostics = (): PreviewDiagnostics => ({
  status: 'idle',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: [
    {
      level: 'log',
      message: 'ready',
      args: ['ready'],
      timestamp: '2026-05-27T08:00:00.000Z',
    },
  ],
})

const createReadContext = (): AgentBridgeReadContext => ({
  project: {
    name: 'Router test',
    jsxCode: '<Button>Test</Button>',
    hooksCode: 'const value = "test"',
  },
  preview: {
    theme: 'light',
    viewportSize: 'MD',
  },
  diagnostics: createDiagnostics(),
})

const createPreviewEvidence = (): PreviewEvidence => ({
  frame: {
    rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
    viewport: {
      width: 768,
      height: 640,
      devicePixelRatio: 1,
    },
    scroll: {
      x: 0,
      y: 0,
    },
    capturedElementCount: 1,
    truncated: false,
  },
  tree: {
    tagName: 'div',
    text: 'Test',
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
})

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
  options: {
    active?: boolean
    permissions?: Partial<AgentPermissions>
    previewEvidence?: PreviewEvidenceCaptureResult
    applyResult?: AgentBridgeCommandResult<AgentSourceChangeResult>
  } = {}
) => {
  const context = createReadContext()
  const recordedCommands: AgentBridgeCommandName[] = []
  const appliedRequests: unknown[] = []
  const permissions = {
    ...DEFAULT_AGENT_PERMISSIONS,
    ...options.permissions,
  }

  const controller: AgentBridgeController = {
    getReadContext: () => context,
    getPermissions: () => permissions,
    isSessionActive: () => options.active ?? true,
    recordActivity: (command) => {
      recordedCommands.push(command)
    },
    applySourceChange: (request) => {
      appliedRequests.push(request)
      return options.applyResult ?? createApplySuccess()
    },
    getPreviewEvidence: () =>
      options.previewEvidence ?? {
        ok: true,
        evidence: createPreviewEvidence(),
      },
  }

  return {
    appliedRequests,
    context,
    controller,
    recordedCommands,
  }
}

const expectBridgeSuccess = <TData>(result: AgentBridgeCommandResult<TData>): TData => {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data
}

describe('agent bridge command router', () => {
  it('routes supported read commands without a browser global', () => {
    const { context, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(router.commandNames).toEqual(AGENT_BRIDGE_COMMAND_NAMES)
    expect(AGENT_BRIDGE_READ_COMMAND_NAMES).toContain('getAgentInstructions')
    expect(isAgentBridgeReadCommandName('getAgentInstructions')).toBe(true)
    expect(expectBridgeSuccess(router.routeCommand('getProject'))).toEqual(context.project)
    expect(expectBridgeSuccess(router.routeCommand('getPreviewContext'))).toEqual(context.preview)
    expect(expectBridgeSuccess(router.routeCommand('getSessionState'))).toEqual({
      sessionId: session.id,
      status: 'active',
      startedAt: session.startedAt,
      permissions: DEFAULT_AGENT_PERMISSIONS,
      readScope: 'arcade-session',
      commandNames: AGENT_BRIDGE_COMMAND_NAMES,
    })
    expect(recordedCommands).toEqual(['getProject', 'getPreviewContext', 'getSessionState'])
  })

  it('returns versioned Agent instructions without Arcade project content', () => {
    const { context, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(desktopSession, controller)

    const instructions = expectBridgeSuccess(router.routeCommand('getAgentInstructions'))

    expect(instructions).toMatchObject({
      version: 1,
      sessionId: desktopSession.id,
      startedAt: desktopSession.startedAt,
      endpoint: desktopSession.transportEndpoint.endpoint,
      authorizationHeader: desktopSession.transportEndpoint.authorizationHeader,
      permissions: DEFAULT_AGENT_PERMISSIONS,
      readScope: 'arcade-session',
      commandNames: AGENT_BRIDGE_COMMAND_NAMES,
      protocol: {
        transport: 'desktop-loopback-http',
        format: 'json-rpc-2.0',
        contentType: 'application/json',
        authorizationHeaderName: 'Authorization',
      },
    })
    expect(instructions.instructionsMarkdown).toContain('Aksel Arcade Agent pairing handoff')
    expect(instructions.instructionsMarkdown).toContain(
      `Endpoint: ${desktopSession.transportEndpoint.endpoint}`
    )
    expect(instructions.instructionsMarkdown).toContain(
      `Authorization: ${desktopSession.transportEndpoint.authorizationHeader}`
    )
    expect(instructions.arcadeAuthoringContract.summary).toMatch(/active Arcade project/i)
    expect(JSON.stringify(instructions)).not.toContain(context.project.name)
    expect(JSON.stringify(instructions)).not.toContain(context.project.jsxCode)
    expect(JSON.stringify(instructions)).not.toContain(context.project.hooksCode)
    expect(JSON.stringify(instructions)).not.toContain(
      context.diagnostics.sandboxConsoleMessages[0]!.message
    )
    expect(JSON.stringify(instructions)).not.toContain('checkpoint-1')
    expect(recordedCommands).toEqual(['getAgentInstructions'])
  })

  it('requires a Desktop transport endpoint before returning Agent instructions', () => {
    const { controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(router.routeCommand('getAgentInstructions')).toMatchObject({
      ok: false,
      command: 'getAgentInstructions',
      error: {
        code: 'invalid-request',
      },
    })
    expect(recordedCommands).toEqual([])
  })

  it('keeps diagnostics routed through the existing clone semantics', () => {
    const { context, controller } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    const diagnostics = expectBridgeSuccess(router.routeCommand('getDiagnostics'))
    diagnostics.sandboxConsoleMessages[0]?.args.push('mutated')

    expect(context.diagnostics.sandboxConsoleMessages[0]?.args).toEqual(['ready'])
  })

  it('routes Preview evidence with existing permission and unavailable failures', () => {
    const evidence = createPreviewEvidence()
    const { controller, recordedCommands } = createController({
      previewEvidence: {
        ok: true,
        evidence,
      },
    })

    const router = createAgentBridgeCommandRouter(session, controller)
    expect(expectBridgeSuccess(router.routeCommand('getPreviewEvidence'))).toEqual(evidence)
    expect(recordedCommands).toEqual(['getPreviewEvidence'])

    const denied = createAgentBridgeCommandRouter(
      session,
      createController({ permissions: { previewEvidence: false } }).controller
    )
    expect(denied.routeCommand('getPreviewEvidence')).toMatchObject({
      ok: false,
      command: 'getPreviewEvidence',
      error: {
        code: 'permission-denied',
      },
    })

    const unavailable = createAgentBridgeCommandRouter(
      session,
      createController({
        previewEvidence: {
          ok: false,
          error: {
            code: 'preview-unavailable',
            message: 'Preview iframe is not mounted yet.',
          },
        },
      }).controller
    )
    expect(unavailable.routeCommand('getPreviewEvidence')).toMatchObject({
      ok: false,
      command: 'getPreviewEvidence',
      error: {
        code: 'preview-unavailable',
        message: 'Preview iframe is not mounted yet.',
      },
    })
  })

  it('routes applySourceChange requests through the existing mutation validator', () => {
    const request = {
      summary: 'Update JSX',
      jsxCode: '<Button>Updated</Button>',
    }
    const { appliedRequests, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(router.routeCommand('applySourceChange', request)).toEqual(createApplySuccess())
    expect(appliedRequests).toEqual([request])
    expect(recordedCommands).toEqual(['applySourceChange'])

    const rejected = createController({
      applyResult: {
        ok: false,
        command: 'applySourceChange',
        error: {
          code: 'invalid-request',
          message: 'A non-empty human-readable summary is required.',
        },
      },
    })
    const rejectedRouter = createAgentBridgeCommandRouter(session, rejected.controller)

    expect(rejectedRouter.routeCommand('applySourceChange', {})).toMatchObject({
      ok: false,
      command: 'applySourceChange',
      error: {
        code: 'invalid-request',
      },
    })
    expect(rejected.appliedRequests).toEqual([{}])
    expect(rejected.recordedCommands).toEqual([])
  })

  it('rejects unsupported commands with a structured router error', () => {
    const { controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(isAgentBridgeCommandName('getProject')).toBe(true)
    expect(isAgentBridgeCommandName('openShell')).toBe(false)
    expect(router.routeCommand('openShell')).toEqual({
      ok: false,
      command: 'openShell',
      error: {
        code: 'unsupported-command',
        message:
          'Unsupported Agent bridge command "openShell". Supported commands: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applySourceChange.',
      },
    })
    expect(recordedCommands).toEqual([])
  })

  it('preserves revoked-session failures for supported commands', () => {
    const { appliedRequests, controller, recordedCommands } = createController({ active: false })
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(router.routeCommand('getProject')).toMatchObject({
      ok: false,
      command: 'getProject',
      error: {
        code: 'session-revoked',
      },
    })
    expect(router.routeCommand('applySourceChange', { summary: 'No-op' })).toMatchObject({
      ok: false,
      command: 'applySourceChange',
      error: {
        code: 'session-revoked',
      },
    })
    expect(router.routeCommand('getAgentInstructions')).toMatchObject({
      ok: false,
      command: 'getAgentInstructions',
      error: {
        code: 'session-revoked',
      },
    })
    expect(appliedRequests).toEqual([])
    expect(recordedCommands).toEqual([])
  })

  it('keeps the browser bridge API as a compatibility wrapper over the router', () => {
    const request = {
      summary: 'Update JSX',
      jsxCode: '<Button>Updated</Button>',
    }
    const { controller, recordedCommands } = createController()
    const bridge = createAgentBridge(desktopSession, controller)

    expect(bridge.commandNames).toEqual(AGENT_BRIDGE_COMMAND_NAMES)
    expect(expectBridgeSuccess(bridge.getAgentInstructions())).toMatchObject({
      version: 1,
      sessionId: desktopSession.id,
    })
    expect(expectBridgeSuccess(bridge.getProject())).toEqual(createReadContext().project)
    expect(bridge.applySourceChange(request)).toEqual(createApplySuccess())
    expect(recordedCommands).toEqual(['getAgentInstructions', 'getProject', 'applySourceChange'])
  })
})

describe('agent instructions', () => {
  it('creates a one-line pure curl bootstrap command for getAgentInstructions', () => {
    const command = createAgentPairingHandoffCommand({
      endpoint: 'http://127.0.0.1:48123',
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer copied-agent-secret',
    })

    expect(command).toBe(
      `curl -sS -X POST 'http://127.0.0.1:48123' -H 'Authorization: Bearer copied-agent-secret' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    )
    expect(command).not.toContain('\n')
    expect(command).toContain('"method":"getAgentInstructions"')
    expect(command).not.toMatch(/\b(jq|mcp|helper)\b/i)
    expect(command).not.toMatch(/[?&](token|credential|authorization)=/i)
    expect(command).not.toContain('getProject')
    expect(command).not.toContain('applySourceChange')
  })

  it('includes provider-neutral Desktop transport instructions without URL credentials', () => {
    const instructions = createAgentInstructions(DEFAULT_AGENT_PERMISSIONS, {
      endpoint: 'http://127.0.0.1:48123',
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer copied-agent-secret',
    })

    expect(instructions).toContain('Desktop loopback JSON-RPC transport')
    expect(instructions).toContain('Endpoint: http://127.0.0.1:48123')
    expect(instructions).toContain('Authorization: Bearer copied-agent-secret')
    expect(instructions).toMatch(/Content-Type: application\/json and the Authorization header/i)
    expect(instructions).toContain(
      'Supported JSON-RPC methods: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applySourceChange.'
    )
    expect(instructions).toContain(
      'Full Agent bridge command names: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applySourceChange.'
    )
    expect(instructions).toContain('"method":"applySourceChange"')
    expect(instructions).toContain(
      'poll getDiagnostics() until status is no longer "transpiling" or "rendering" before final visual validation'
    )
    expect(instructions).toContain(
      'When diagnostics settle to "idle", read getPreviewEvidence() to validate the visible result.'
    )
    expect(instructions).toContain(
      'When status is "error", read diagnostics again for compile/runtime details instead.'
    )
    expect(instructions).toMatch(/GitHub Copilot app/i)
    expect(instructions).toMatch(/Copilot CLI/i)
    expect(instructions).toMatch(/Copilot in VS Code/i)
    expect(instructions).toMatch(/Other same-device External agents/i)
    expect(instructions).not.toMatch(/[?&](token|credential|authorization)=/i)
  })

  it('keeps inactive copied instructions free of transport secrets', () => {
    const instructions = createAgentInstructions(DEFAULT_AGENT_PERMISSIONS)

    expect(instructions).toContain('window.__AKSEL_ARCADE_AGENT_BRIDGE__')
    expect(instructions).not.toMatch(/Endpoint:|Authorization: Bearer|copied-agent-secret/i)
    expect(instructions).not.toMatch(/[?&](token|credential|authorization)=/i)
  })
})

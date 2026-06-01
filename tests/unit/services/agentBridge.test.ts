import { describe, expect, it } from 'vitest'
import {
  AGENT_BRIDGE_COMMAND_NAMES,
  AGENT_BRIDGE_PROTOCOL_VERSION,
  AGENT_BRIDGE_READ_COMMAND_NAMES,
  DEFAULT_AGENT_PERMISSIONS,
  createAgentPairingHandoffCommand,
  createAgentBridgeCommandRouter,
  isAgentBridgeCommandName,
  isAgentBridgeReadCommandName,
  type AgentBridgeCommandName,
  type AgentBridgeCommandResult,
  type AgentBridgeController,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentPermissions,
  type AgentChangeResult,
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
): AgentBridgeCommandResult<AgentChangeResult> => ({
  ok: true,
  command: 'applyAgentChange',
  data: {
    changedFields,
  },
})

const createController = (
  options: {
    active?: boolean
    permissions?: Partial<AgentPermissions>
    previewEvidence?: PreviewEvidenceCaptureResult
    applyResult?: AgentBridgeCommandResult<AgentChangeResult>
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
    applyAgentChange: (request) => {
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

const getMarkdownLines = (markdown: string): string[] =>
  markdown.split('\n').filter((line) => line.trim().length > 0)

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
      version: AGENT_BRIDGE_PROTOCOL_VERSION,
      sessionId: session.id,
      status: 'active',
      startedAt: session.startedAt,
      permissions: DEFAULT_AGENT_PERMISSIONS,
      readScope: 'arcade-session',
      commandNames: AGENT_BRIDGE_COMMAND_NAMES,
    })
    expect(recordedCommands).toEqual(['getProject', 'getPreviewContext', 'getSessionState'])
  })

  it('returns a compact Agent operating guide repeatedly without Arcade project content', () => {
    const { context, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(desktopSession, controller)

    const instructions = expectBridgeSuccess(router.routeCommand('getAgentInstructions'))
    const repeatedInstructions = expectBridgeSuccess(router.routeCommand('getAgentInstructions'))
    const guideLines = getMarkdownLines(instructions.instructionsMarkdown)

    expect(repeatedInstructions).toEqual(instructions)
    expect(instructions).toMatchObject({
      version: AGENT_BRIDGE_PROTOCOL_VERSION,
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
    expect(guideLines.length).toBeGreaterThanOrEqual(8)
    expect(guideLines.length).toBeLessThanOrEqual(12)
    expect(instructions.instructionsMarkdown).toMatch(/authoritative/i)
    expect(instructions.instructionsMarkdown).toMatch(/call getProject first/i)
    expect(instructions.instructionsMarkdown).toMatch(/getPreviewContext/i)
    expect(instructions.instructionsMarkdown).toMatch(/getDiagnostics/i)
    expect(instructions.instructionsMarkdown).toMatch(/getPreviewEvidence/i)
    expect(instructions.instructionsMarkdown).toMatch(/import-free Arcade JSX and Hooks/i)
    expect(instructions.instructionsMarkdown).toMatch(/full-field replacements/i)
    expect(instructions.instructionsMarkdown).toContain(
      'applyAgentChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? })'
    )
    expect(instructions.instructionsMarkdown).toMatch(
      /apply immediately to the human-visible Arcade project/i
    )
    expect(instructions.instructionsMarkdown).toMatch(/poll getDiagnostics until the preview settles/i)
    expect(instructions.instructionsMarkdown).toMatch(/Preview evidence to validate/i)
    expect(instructions.instructionsMarkdown).not.toContain(
      `Endpoint: ${desktopSession.transportEndpoint.endpoint}`
    )
    expect(instructions.instructionsMarkdown).not.toContain(
      `Authorization: ${desktopSession.transportEndpoint.authorizationHeader}`
    )
    expect(instructions.instructionsMarkdown).not.toMatch(/Copilot|provider-specific|Aksel Design System/i)
    expect(instructions.arcadeAuthoringContract.summary).toMatch(/active Arcade project/i)
    expect(instructions.commandNames).toContain('applyAgentChange')
    expect(instructions.commandNames).not.toContain('applySourceChange')
    expect(instructions).not.toHaveProperty('workflow')
    expect(instructions).not.toHaveProperty('workflowGuide')
    expect(JSON.stringify(instructions)).not.toContain(context.project.name)
    expect(JSON.stringify(instructions)).not.toContain(context.project.jsxCode)
    expect(JSON.stringify(instructions)).not.toContain(context.project.hooksCode)
    expect(JSON.stringify(instructions)).not.toContain(
      context.diagnostics.sandboxConsoleMessages[0]!.message
    )
    expect(JSON.stringify(instructions)).not.toMatch(/CONTEXT\.md|docs\/adr/i)
    expect(JSON.stringify(instructions)).not.toMatch(/checkpoint|rollback/i)
    expect(recordedCommands).toEqual(['getAgentInstructions', 'getAgentInstructions'])
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

  it('routes applyAgentChange requests through the existing mutation validator', () => {
    const request = {
      summary: 'Update JSX',
      jsxCode: '<Button>Updated</Button>',
    }
    const { appliedRequests, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(router.routeCommand('applyAgentChange', request)).toEqual(createApplySuccess())
    expect(appliedRequests).toEqual([request])
    expect(recordedCommands).toEqual(['applyAgentChange'])

    const rejected = createController({
      applyResult: {
        ok: false,
        command: 'applyAgentChange',
        error: {
          code: 'invalid-request',
          message: 'A non-empty human-readable summary is required.',
        },
      },
    })
    const rejectedRouter = createAgentBridgeCommandRouter(session, rejected.controller)

    expect(rejectedRouter.routeCommand('applyAgentChange', {})).toMatchObject({
      ok: false,
      command: 'applyAgentChange',
      error: {
        code: 'invalid-request',
      },
    })
    expect(rejected.appliedRequests).toEqual([{}])
    expect(rejected.recordedCommands).toEqual([])
  })

  it('rejects unsupported commands with a structured router error', () => {
    const { appliedRequests, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(isAgentBridgeCommandName('getProject')).toBe(true)
    expect(isAgentBridgeCommandName('applyAgentChange')).toBe(true)
    expect(isAgentBridgeCommandName('applySourceChange')).toBe(false)
    expect(isAgentBridgeCommandName('openShell')).toBe(false)
    expect(router.routeCommand('openShell')).toEqual({
      ok: false,
      command: 'openShell',
      error: {
        code: 'unsupported-command',
        message:
          'Unsupported Agent bridge command "openShell". Supported commands: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applyAgentChange.',
      },
    })
    expect(router.routeCommand('applySourceChange', { summary: 'Stale command' })).toEqual({
      ok: false,
      command: 'applySourceChange',
      error: {
        code: 'unsupported-command',
        message:
          'Unsupported Agent bridge command "applySourceChange". Supported commands: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applyAgentChange.',
      },
    })
    expect(appliedRequests).toEqual([])
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
    expect(router.routeCommand('applyAgentChange', { summary: 'No-op' })).toMatchObject({
      ok: false,
      command: 'applyAgentChange',
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

})

describe('agent pairing handoff', () => {
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
    expect(command).not.toContain('applyAgentChange')
    expect(command).not.toContain('applySourceChange')
  })

  it('shell-quotes endpoint and Authorization header metacharacters', () => {
    const command = createAgentPairingHandoffCommand({
      endpoint: "http://127.0.0.1:48123/path'with'quotes;$HOME",
      sessionId: 'agent-session-1',
      authorizationHeader: "Bearer token'with'$pecial`chars\\and spaces",
    })

    expect(command).toBe(
      `curl -sS -X POST 'http://127.0.0.1:48123/path'\\''with'\\''quotes;$HOME' -H 'Authorization: Bearer token'\\''with'\\''$pecial\`chars\\and spaces' -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'`
    )
    expect(command).not.toContain('\n')
  })
})

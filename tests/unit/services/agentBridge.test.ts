import { describe, expect, it } from 'vitest'
import {
  AGENT_BRIDGE_PROTOCOL_VERSION,
  AGENT_BRIDGE_READ_COMMAND_NAMES,
  DEFAULT_AGENT_PERMISSIONS,
  createAgentPairingHandoffCommand,
  createAgentBridgeCommandRouter,
  getAgentBridgeSessionCommandNames,
  isAgentBridgeCommandName,
  isAgentBridgeReadCommandName,
  type AgentBridgeCommandName,
  type AgentBridgeCommandResult,
  type AgentBridgeController,
  type AgentCreatePageResult,
  type AgentBridgeReadContext,
  type AgentChangeField,
  type AgentPermissions,
  type AgentChangeResult,
  type AgentPageLifecycleResult,
  type AgentProjectReadState,
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

type AgentProjectFixture = 'one-page' | 'two-page'

const createProjectReadState = (
  fixture: AgentProjectFixture = 'one-page'
): AgentProjectReadState =>
  fixture === 'two-page'
    ? {
        name: 'Router test',
        pageMode: 'multi-page',
        jsxCode: '<Button>Details</Button>',
        hooksCode: 'const details = true',
        globalConfig: {
          jsxCode: '<PageChrome />',
          hooksCode: 'const sharedValue = "shared"',
        },
        pages: [
          {
            id: 'page01',
            name: 'Start',
            jsxCode: '<Button>Start</Button>',
            hooksCode: 'const start = true',
          },
          {
            id: 'page02',
            name: 'Details',
            jsxCode: '<Button>Details</Button>',
            hooksCode: 'const details = true',
          },
        ],
        startPageId: 'page01',
        activePageId: 'page02',
      }
    : {
        name: 'Router test',
        pageMode: 'multi-page',
        jsxCode: '<Button>Test</Button>',
        hooksCode: 'const value = "test"',
        globalConfig: {
          jsxCode: '',
          hooksCode: '',
        },
        pages: [
          {
            id: 'page01',
            name: 'Page 1',
            jsxCode: '<Button>Test</Button>',
            hooksCode: 'const value = "test"',
          },
        ],
        startPageId: 'page01',
        activePageId: 'page01',
      }

const createReadContext = (fixture: AgentProjectFixture = 'one-page'): AgentBridgeReadContext => ({
  project: createProjectReadState(fixture),
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

const createPageSuccess = (
  pageId: `page${string}` = 'page03'
): AgentBridgeCommandResult<AgentCreatePageResult> => ({
  ok: true,
  command: 'createPage',
  data: {
    pageId,
  },
})

const createPageLifecycleSuccess = (
  command: 'renamePage' | 'deletePage' | 'setStartPage' | 'selectActivePage',
  pageId: `page${string}` = 'page02'
): AgentBridgeCommandResult<AgentPageLifecycleResult> => ({
  ok: true,
  command,
  data: {
    pageId,
  },
})

const createController = (
  options: {
    active?: boolean
    projectFixture?: AgentProjectFixture
    permissions?: Partial<AgentPermissions>
    previewEvidence?: PreviewEvidenceCaptureResult
    applyResult?: AgentBridgeCommandResult<AgentChangeResult>
    createPageResult?: AgentBridgeCommandResult<AgentCreatePageResult>
    renamePageResult?: AgentBridgeCommandResult<AgentPageLifecycleResult>
    deletePageResult?: AgentBridgeCommandResult<AgentPageLifecycleResult>
    setStartPageResult?: AgentBridgeCommandResult<AgentPageLifecycleResult>
    selectActivePageResult?: AgentBridgeCommandResult<AgentPageLifecycleResult>
  } = {}
) => {
  const context = createReadContext(options.projectFixture)
  const recordedCommands: AgentBridgeCommandName[] = []
  const appliedRequests: unknown[] = []
  const pageRequests: Array<{ command: string; request: unknown }> = []
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
    createPage: (request) => {
      pageRequests.push({ command: 'createPage', request })
      return options.createPageResult ?? createPageSuccess()
    },
    renamePage: (request) => {
      pageRequests.push({ command: 'renamePage', request })
      return options.renamePageResult ?? createPageLifecycleSuccess('renamePage')
    },
    deletePage: (request) => {
      pageRequests.push({ command: 'deletePage', request })
      return options.deletePageResult ?? createPageLifecycleSuccess('deletePage')
    },
    setStartPage: (request) => {
      pageRequests.push({ command: 'setStartPage', request })
      return options.setStartPageResult ?? createPageLifecycleSuccess('setStartPage')
    },
    selectActivePage: (request) => {
      pageRequests.push({ command: 'selectActivePage', request })
      return options.selectActivePageResult ?? createPageLifecycleSuccess('selectActivePage')
    },
    getPreviewEvidence: async () =>
      options.previewEvidence ?? {
        ok: true,
        evidence: createPreviewEvidence(),
      },
  }

  return {
    appliedRequests,
    context,
    controller,
    pageRequests,
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

    expect(router.commandNames).toEqual(getAgentBridgeSessionCommandNames())
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
      commandNames: getAgentBridgeSessionCommandNames(),
    })
    expect(recordedCommands).toEqual(['getProject', 'getPreviewContext', 'getSessionState'])
  })

  it('returns a compact pages-aware Agent operating guide repeatedly without Arcade project content', () => {
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
      commandNames: getAgentBridgeSessionCommandNames(),
      protocol: {
        transport: 'desktop-loopback-http',
        format: 'json-rpc-2.0',
        contentType: 'application/json',
        authorizationHeaderName: 'Authorization',
      },
    })
    expect(guideLines.length).toBeGreaterThanOrEqual(8)
    expect(guideLines.length).toBeLessThanOrEqual(13)
    expect(instructions.instructionsMarkdown).toMatch(/authoritative/i)
    expect(instructions.instructionsMarkdown).toMatch(/call getProject first/i)
    expect(instructions.instructionsMarkdown).toMatch(/getPreviewContext/i)
    expect(instructions.instructionsMarkdown).toMatch(/getDiagnostics/i)
    expect(instructions.instructionsMarkdown).toMatch(/getPreviewEvidence/i)
    expect(instructions.instructionsMarkdown).toMatch(/full pages-based Arcade project source/i)
    expect(instructions.instructionsMarkdown).not.toMatch(/single-page authoring/i)
    expect(instructions.instructionsMarkdown).not.toMatch(/experimental multi-page/i)
    expect(instructions.instructionsMarkdown).toMatch(/import-free Arcade JSX and Hooks/i)
    expect(instructions.instructionsMarkdown).toMatch(/arcadeAuthoringGuidance/i)
    expect(instructions.instructionsMarkdown).toContain(
      'applyAgentChange({ summary, target, jsxCode?, hooksCode?, viewportSize?, theme?, name? })'
    )
    expect(instructions.instructionsMarkdown).toMatch(
      /apply immediately to the human-visible Arcade project/i
    )
    expect(instructions.instructionsMarkdown).toMatch(
      /poll getDiagnostics until the preview settles/i
    )
    expect(instructions.instructionsMarkdown).toMatch(/Preview evidence to validate/i)
    expect(instructions.instructionsMarkdown).not.toContain(
      `Endpoint: ${desktopSession.transportEndpoint.endpoint}`
    )
    expect(instructions.instructionsMarkdown).not.toContain(
      `Authorization: ${desktopSession.transportEndpoint.authorizationHeader}`
    )
    expect(instructions.instructionsMarkdown).not.toMatch(
      /Copilot|provider-specific|Aksel Design System/i
    )
    expect(instructions.arcadeAuthoringContract.summary).toMatch(/active Arcade project/i)
    expect(instructions.arcadeAuthoringGuidance.summary).toMatch(/Aksel-valid Arcade JSX/i)
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/Aksel component props are safe and expected/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/bare JSX root/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/IIFE expression/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/import-free/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/goToPage\("pageNN"\)/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/currentPageId/i)
    )
    expect(instructions.arcadeAuthoringGuidance.rules).toContainEqual(
      expect.stringMatching(/Global config is shared code only/i)
    )
    expect(instructions.arcadeAuthoringGuidance.validationChecklist).toContainEqual(
      expect.stringMatching(/native HTML\/CSS mimicry/i)
    )
    expect(instructions.arcadeAuthoringGuidance.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'static-page',
          code: expect.stringContaining('<Page>'),
        }),
        expect.objectContaining({
          id: 'iife-page',
          code: expect.stringContaining('(() =>'),
        }),
      ])
    )
    expect(instructions.commandNames).toEqual(getAgentBridgeSessionCommandNames())
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

  it('clones the pages-aware project read state before returning it', () => {
    const { context, controller } = createController({ projectFixture: 'two-page' })
    const router = createAgentBridgeCommandRouter(session, controller)

    const project = expectBridgeSuccess(router.routeCommand('getProject'))
    project.globalConfig.jsxCode = '<Mutated />'
    project.pages[0]!.name = 'Mutated'
    project.pages[1]!.jsxCode = '<Broken />'

    expect(context.project.globalConfig.jsxCode).toBe('<PageChrome />')
    expect(context.project.pages[0]!.name).toBe('Start')
    expect(context.project.pages[1]!.jsxCode).toBe('<Button>Details</Button>')
  })

  it('routes Preview evidence with existing permission and unavailable failures', async () => {
    const evidence = createPreviewEvidence()
    const { controller, recordedCommands } = createController({
      previewEvidence: {
        ok: true,
        evidence,
      },
    })

    const router = createAgentBridgeCommandRouter(session, controller)
    expect(expectBridgeSuccess(await router.routeCommand('getPreviewEvidence'))).toEqual(evidence)
    expect(recordedCommands).toEqual(['getPreviewEvidence'])

    const denied = createAgentBridgeCommandRouter(
      session,
      createController({ permissions: { previewEvidence: false } }).controller
    )
    await expect(denied.routeCommand('getPreviewEvidence')).resolves.toMatchObject({
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
    await expect(unavailable.routeCommand('getPreviewEvidence')).resolves.toMatchObject({
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

  it('exposes lifecycle commands and routes them through the controller', () => {
    const { controller, pageRequests, recordedCommands } = createController({ projectFixture: 'two-page' })
    const router = createAgentBridgeCommandRouter(desktopSession, controller)

    expect(router.commandNames).toEqual(getAgentBridgeSessionCommandNames())
    expect(expectBridgeSuccess(router.routeCommand('getSessionState')).commandNames).toEqual(
      getAgentBridgeSessionCommandNames()
    )

    expect(expectBridgeSuccess(router.routeCommand('createPage', {}))).toEqual({
      pageId: 'page03',
    })
    expect(expectBridgeSuccess(router.routeCommand('renamePage', { pageId: 'page02', name: 'Details' }))).toEqual({
      pageId: 'page02',
    })
    expect(expectBridgeSuccess(router.routeCommand('deletePage', { pageId: 'page02' }))).toEqual({
      pageId: 'page02',
    })
    expect(expectBridgeSuccess(router.routeCommand('setStartPage', { pageId: 'page02' }))).toEqual({
      pageId: 'page02',
    })
    expect(expectBridgeSuccess(router.routeCommand('selectActivePage', { pageId: 'page02' }))).toEqual({
      pageId: 'page02',
    })

    expect(pageRequests).toEqual([
      { command: 'createPage', request: {} },
      { command: 'renamePage', request: { pageId: 'page02', name: 'Details' } },
      { command: 'deletePage', request: { pageId: 'page02' } },
      { command: 'setStartPage', request: { pageId: 'page02' } },
      { command: 'selectActivePage', request: { pageId: 'page02' } },
    ])

    const instructions = expectBridgeSuccess(router.routeCommand('getAgentInstructions'))
    expect(recordedCommands).toEqual([
      'getSessionState',
      'createPage',
      'renamePage',
      'deletePage',
      'setStartPage',
      'selectActivePage',
      'getAgentInstructions',
    ])

    expect(instructions.commandNames).toEqual(getAgentBridgeSessionCommandNames())
    expect(instructions.instructionsMarkdown).toMatch(
      /createPage, renamePage, deletePage, setStartPage, and selectActivePage/i
    )
  })

  it('keeps one-page projects represented as one-page Arcade project source projects', () => {
    const { controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(expectBridgeSuccess(router.routeCommand('getProject'))).toMatchObject({
      pageMode: 'multi-page',
      globalConfig: {
        jsxCode: '',
        hooksCode: '',
      },
      pages: [
        {
          id: 'page01',
          name: 'Page 1',
          jsxCode: '<Button>Test</Button>',
          hooksCode: 'const value = "test"',
        },
      ],
      startPageId: 'page01',
      activePageId: 'page01',
    })
    expect(expectBridgeSuccess(router.routeCommand('getSessionState')).commandNames).toEqual(
      getAgentBridgeSessionCommandNames()
    )
    expect(recordedCommands).toEqual(['getProject', 'getSessionState'])
  })

  it('rejects unsupported commands with a structured router error', () => {
    const { appliedRequests, controller, recordedCommands } = createController()
    const router = createAgentBridgeCommandRouter(session, controller)

    expect(isAgentBridgeCommandName('getProject')).toBe(true)
    expect(isAgentBridgeCommandName('applyAgentChange')).toBe(true)
    expect(isAgentBridgeCommandName('createPage')).toBe(true)
    expect(isAgentBridgeCommandName('applySourceChange')).toBe(false)
    expect(isAgentBridgeCommandName('openShell')).toBe(false)
    expect(router.routeCommand('openShell')).toEqual({
      ok: false,
      command: 'openShell',
      error: {
        code: 'unsupported-command',
        message:
          'Unsupported Agent bridge command "openShell". Supported commands: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applyAgentChange, createPage, renamePage, deletePage, setStartPage, selectActivePage.',
      },
    })
    expect(router.routeCommand('applySourceChange', { summary: 'Stale command' })).toEqual({
      ok: false,
      command: 'applySourceChange',
      error: {
        code: 'unsupported-command',
        message:
          'Unsupported Agent bridge command "applySourceChange". Supported commands: getAgentInstructions, getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, getSessionState, applyAgentChange, createPage, renamePage, deletePage, setStartPage, selectActivePage.',
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

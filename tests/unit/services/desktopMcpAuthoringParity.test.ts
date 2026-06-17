import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createAgentBridgeCommandRouter,
  type AgentBridgeController,
} from '@/services/agentBridge'

const require = createRequire(import.meta.url)
const { createDesktopMcpServer } = require('../../../desktop/mcpServer.cjs') as {
  createDesktopMcpServer: (options?: { port?: number }) => {
    start: () => Promise<{ url: string }>
    stop: () => Promise<boolean>
  }
}

// Canonical Arcade authoring mechanics that both guidance surfaces — the MCP
// authoring-guide resource and the legacy agentBridge guidance — must agree on,
// so the two never drift into telling agents different things.
const CANONICAL_MECHANIC_TOKENS = ['goToPage', 'currentPageId', 'Global config', 'import-free']

const desktopSession = {
  id: 'parity-session',
  startedAt: '2026-05-27T08:00:00.000Z',
  transportEndpoint: {
    endpoint: 'http://127.0.0.1:48123',
    sessionId: 'parity-session',
    authorizationHeader: 'Bearer parity-secret',
  },
}

const createMinimalController = (): AgentBridgeController =>
  ({
    getReadContext: () => {
      throw new Error('not needed for getAgentInstructions')
    },
    getPermissions: () => ({
      readProject: true,
      readPreview: true,
      applyChanges: true,
      managePages: true,
    }),
    isSessionActive: () => true,
    recordActivity: () => {},
    applyAgentChange: () => {
      throw new Error('not used')
    },
    createPage: () => {
      throw new Error('not used')
    },
    renamePage: () => {
      throw new Error('not used')
    },
    deletePage: () => {
      throw new Error('not used')
    },
    setStartPage: () => {
      throw new Error('not used')
    },
    selectActivePage: () => {
      throw new Error('not used')
    },
    getPreviewEvidence: async () => {
      throw new Error('not used')
    },
  }) as unknown as AgentBridgeController

const readAuthoringGuideText = async (): Promise<string> => {
  const server = createDesktopMcpServer({ port: 0 })
  activeStops.push(() => server.stop())
  const state = await server.start()

  const response = await fetch(`${state.url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/read',
      params: { uri: 'arcade://desktop/authoring-guide' },
    }),
  })
  const payload = await response.json()
  return payload.result.contents[0].text as string
}

const readAgentBridgeGuidanceText = (): string => {
  const router = createAgentBridgeCommandRouter(desktopSession, createMinimalController())
  const result = router.routeCommand('getAgentInstructions')
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  const guidance = result.data.arcadeAuthoringGuidance
  return [
    guidance.summary,
    ...guidance.rules,
    ...guidance.snippets.map((snippet) => snippet.code),
  ].join('\n')
}

const activeStops: Array<() => Promise<boolean>> = []

describe('Arcade authoring guidance parity (single source of truth)', () => {
  afterEach(async () => {
    await Promise.all(activeStops.map((stop) => stop()))
    activeStops.length = 0
  })

  it('teaches the same core mechanics in the MCP authoring-guide and the agentBridge guidance', async () => {
    const mcpAuthoringGuide = await readAuthoringGuideText()
    const agentBridgeGuidance = readAgentBridgeGuidanceText()

    for (const token of CANONICAL_MECHANIC_TOKENS) {
      expect(mcpAuthoringGuide, `MCP authoring-guide must mention "${token}"`).toContain(token)
      expect(agentBridgeGuidance, `agentBridge guidance must mention "${token}"`).toContain(token)
    }
  })
})

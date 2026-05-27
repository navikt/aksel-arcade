import { describe, expect, it, vi } from 'vitest'
import {
  createDesktopPreloadAgentTransportAdapter,
  registerDesktopPreloadAgentTransportRequestHandler,
} from '@/services/desktopAgentTransportAdapter'
import { DEFAULT_AGENT_PERMISSIONS } from '@/services/agentBridge'
import type { DesktopArcadePreloadApi } from '@/services/shellCapabilities'
import type { DesktopAgentTransportSession } from '@/services/desktopAgentSessionCoordinator'

const createSession = (): DesktopAgentTransportSession => ({
  id: 'agent-session-1',
  startedAt: '2026-05-27T08:00:00.000Z',
  status: 'active',
  permissions: DEFAULT_AGENT_PERMISSIONS,
  pairingCredential: 'credential-1',
})

describe('desktopAgentTransportAdapter', () => {
  it('rejects preload endpoints with an empty Bearer credential', async () => {
    const api: DesktopArcadePreloadApi = {
      getShellCapabilities: vi.fn(),
      startAgentTransportSession: vi.fn().mockResolvedValue({
        endpoint: 'http://127.0.0.1:48123',
        sessionId: 'agent-session-1',
        authorizationHeader: 'Bearer ',
      }),
      stopAgentTransportSession: vi.fn(),
    }
    const adapter = createDesktopPreloadAgentTransportAdapter(api)

    await expect(adapter?.startSession?.(createSession())).rejects.toThrow(
      /Invalid Desktop Agent transport endpoint/
    )
  })

  it('registers and clears the renderer transport request handler through preload', () => {
    const handler = vi.fn()
    const api: DesktopArcadePreloadApi = {
      getShellCapabilities: vi.fn(),
      startAgentTransportSession: vi.fn(),
      stopAgentTransportSession: vi.fn(),
      setAgentTransportRequestHandler: vi.fn(),
    }

    const unregister = registerDesktopPreloadAgentTransportRequestHandler(handler, api)

    expect(api.setAgentTransportRequestHandler).toHaveBeenCalledWith(handler)
    unregister?.()
    expect(api.setAgentTransportRequestHandler).toHaveBeenLastCalledWith(null)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AGENT_PERMISSIONS } from '@/services/agentBridge'
import {
  createDesktopAgentSessionCoordinator,
  type DesktopAgentSessionEndReason,
  type DesktopAgentTransportEndpoint,
  type DesktopAgentTransportSession,
} from '@/services/desktopAgentSessionCoordinator'

const createDeterministicCoordinator = () => {
  const ids = ['agent-session-1', 'agent-session-2']
  const credentials = ['credential-1', 'credential-2']
  const timestamps = ['2026-05-27T08:00:00.000Z', '2026-05-27T08:05:00.000Z']
  const startedSessions: DesktopAgentTransportSession[] = []
  const stoppedSessions: Array<{
    session: DesktopAgentTransportSession
    reason: DesktopAgentSessionEndReason
  }> = []

  const coordinator = createDesktopAgentSessionCoordinator({
    createSessionId: () => ids.shift() ?? 'agent-session-extra',
    createPairingCredential: () => credentials.shift() ?? 'credential-extra',
    createTimestamp: () => timestamps.shift() ?? '2026-05-27T08:10:00.000Z',
    transportAdapter: {
      startSession: (session) => {
        startedSessions.push(session)
      },
      stopSession: (session, reason) => {
        stoppedSessions.push({ session, reason })
      },
    },
  })

  return {
    coordinator,
    startedSessions,
    stoppedSessions,
  }
}

describe('desktopAgentSessionCoordinator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts inactive and creates one all-on Agent session with a hidden pairing credential', async () => {
    const { coordinator, startedSessions } = createDeterministicCoordinator()

    expect(coordinator.getStatus()).toBe('inactive')
    expect(coordinator.getActiveSession()).toBeNull()
    expect(coordinator.getActiveTransportSession()).toBeNull()

    const session = await coordinator.startSession()

    expect(session).toEqual({
      id: 'agent-session-1',
      startedAt: '2026-05-27T08:00:00.000Z',
      status: 'active',
      permissions: DEFAULT_AGENT_PERMISSIONS,
    })
    expect(session).not.toHaveProperty('pairingCredential')
    expect(coordinator.getStatus()).toBe('active')
    expect(coordinator.isSessionActive('agent-session-1')).toBe(true)
    expect(coordinator.getPermissions()).toEqual(DEFAULT_AGENT_PERMISSIONS)
    expect(startedSessions).toEqual([
      {
        ...session,
        pairingCredential: 'credential-1',
      },
    ])
  })

  it('keeps start idempotent while a session is active', async () => {
    const { coordinator, startedSessions } = createDeterministicCoordinator()

    const firstSession = await coordinator.startSession()
    const secondSession = await coordinator.startSession()

    expect(secondSession).toEqual(firstSession)
    expect(coordinator.getActiveTransportSession()).toMatchObject({
      id: 'agent-session-1',
      pairingCredential: 'credential-1',
    })
    expect(startedSessions).toHaveLength(1)
  })

  it('returns hidden transport endpoint details without exposing the pairing credential', async () => {
    const coordinator = createDesktopAgentSessionCoordinator({
      createSessionId: () => 'agent-session-1',
      createPairingCredential: () => 'credential-1',
      createTimestamp: () => '2026-05-27T08:00:00.000Z',
      transportAdapter: {
        startSession: (session) => ({
          endpoint: 'http://127.0.0.1:48123',
          sessionId: session.id,
          authorizationHeader: `Bearer ${session.pairingCredential}`,
        }),
      },
    })

    const session = await coordinator.startSession()

    expect(session).toEqual({
      id: 'agent-session-1',
      startedAt: '2026-05-27T08:00:00.000Z',
      status: 'active',
      permissions: DEFAULT_AGENT_PERMISSIONS,
      transportEndpoint: {
        endpoint: 'http://127.0.0.1:48123',
        sessionId: 'agent-session-1',
        authorizationHeader: 'Bearer credential-1',
      },
    })
    expect(session).not.toHaveProperty('pairingCredential')
    expect(coordinator.getActiveTransportSession()).toMatchObject({
      id: 'agent-session-1',
      pairingCredential: 'credential-1',
      transportEndpoint: session.transportEndpoint,
    })
  })

  it('invalidates session state and credentials on stop before allowing a new session', async () => {
    const { coordinator, stoppedSessions } = createDeterministicCoordinator()

    const firstSession = await coordinator.startSession()
    const firstTransportSession = coordinator.getActiveTransportSession()

    coordinator.stopSession('stop')

    expect(coordinator.getStatus()).toBe('inactive')
    expect(coordinator.isSessionActive(firstSession.id)).toBe(false)
    expect(coordinator.getActiveSession()).toBeNull()
    expect(coordinator.getActiveTransportSession()).toBeNull()
    expect(stoppedSessions).toEqual([
      {
        session: firstTransportSession,
        reason: 'stop',
      },
    ])

    const secondSession = await coordinator.startSession()

    expect(secondSession.id).toBe('agent-session-2')
    expect(coordinator.getActiveTransportSession()).toMatchObject({
      id: 'agent-session-2',
      pairingCredential: 'credential-2',
    })
  })

  it('uses cleanup reasons for reload and quit invalidation', async () => {
    const { coordinator, stoppedSessions } = createDeterministicCoordinator()

    await coordinator.startSession()
    coordinator.stopSession('reload')
    await coordinator.startSession()
    coordinator.stopSession('quit')

    expect(stoppedSessions.map(({ reason }) => reason)).toEqual(['reload', 'quit'])
    expect(coordinator.getStatus()).toBe('inactive')
  })

  it('rolls back active state if the transport adapter rejects session startup', async () => {
    const coordinator = createDesktopAgentSessionCoordinator({
      createSessionId: () => 'agent-session-1',
      createPairingCredential: () => 'credential-1',
      createTimestamp: () => '2026-05-27T08:00:00.000Z',
      transportAdapter: {
        startSession: () => {
          throw new Error('adapter failed')
        },
      },
    })

    await expect(coordinator.startSession()).rejects.toThrow(/adapter failed/)
    expect(coordinator.getStatus()).toBe('inactive')
    expect(coordinator.getActiveTransportSession()).toBeNull()
  })

  it('does not resurrect a session stopped before transport startup completes', async () => {
    let resolveStart!: (endpoint: DesktopAgentTransportEndpoint) => void
    const stoppedSessions: Array<{
      session: DesktopAgentTransportSession
      reason: DesktopAgentSessionEndReason
    }> = []
    const coordinator = createDesktopAgentSessionCoordinator({
      createSessionId: () => 'agent-session-1',
      createPairingCredential: () => 'credential-1',
      createTimestamp: () => '2026-05-27T08:00:00.000Z',
      transportAdapter: {
        startSession: () =>
          new Promise<DesktopAgentTransportEndpoint>((resolve) => {
            resolveStart = resolve
          }),
        stopSession: (session, reason) => {
          stoppedSessions.push({ session, reason })
        },
      },
    })

    const startPromise = coordinator.startSession()
    expect(coordinator.getStatus()).toBe('active')

    coordinator.stopSession('reload')
    resolveStart({
      endpoint: 'http://127.0.0.1:48123',
      sessionId: 'agent-session-1',
      authorizationHeader: 'Bearer credential-1',
    })

    await expect(startPromise).rejects.toThrow(/startup was cancelled/)
    expect(coordinator.getStatus()).toBe('inactive')
    expect(coordinator.getActiveSession()).toBeNull()
    expect(coordinator.getActiveTransportSession()).toBeNull()
    expect(stoppedSessions).toEqual([
      {
        session: {
          id: 'agent-session-1',
          startedAt: '2026-05-27T08:00:00.000Z',
          status: 'active',
          permissions: DEFAULT_AGENT_PERMISSIONS,
          pairingCredential: 'credential-1',
        },
        reason: 'reload',
      },
      {
        session: {
          id: 'agent-session-1',
          startedAt: '2026-05-27T08:00:00.000Z',
          status: 'active',
          permissions: DEFAULT_AGENT_PERMISSIONS,
          pairingCredential: 'credential-1',
          transportEndpoint: {
            endpoint: 'http://127.0.0.1:48123',
            sessionId: 'agent-session-1',
            authorizationHeader: 'Bearer credential-1',
          },
        },
        reason: 'reload',
      },
    ])
  })

  it('creates unguessable default pairing credentials from Web Crypto bytes', async () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues')
    getRandomValues.mockImplementation((array) => {
      const bytes = array as Uint8Array
      bytes.fill(15)
      return array
    })
    const coordinator = createDesktopAgentSessionCoordinator({
      createSessionId: () => 'agent-session-1',
      createTimestamp: () => '2026-05-27T08:00:00.000Z',
    })

    await coordinator.startSession()

    expect(coordinator.getActiveTransportSession()?.pairingCredential).toBe('0f'.repeat(32))
  })

  it('redacts handoff secrets from async transport stop failure logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const coordinator = createDesktopAgentSessionCoordinator({
      createSessionId: () => 'agent-session-1',
      createPairingCredential: () => 'credential-secret',
      createTimestamp: () => '2026-05-27T08:00:00.000Z',
      transportAdapter: {
        startSession: (session) => ({
          endpoint: 'http://127.0.0.1:48123',
          sessionId: session.id,
          authorizationHeader: `Bearer ${session.pairingCredential}`,
        }),
        stopSession: async (session) => {
          throw new Error(
            `Stop failed for ${session.transportEndpoint?.endpoint} with ${session.transportEndpoint?.authorizationHeader} and ${session.pairingCredential}.`
          )
        },
      },
    })

    await coordinator.startSession()
    coordinator.stopSession('stop')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const serializedLog = JSON.stringify(consoleError.mock.calls)
    expect(consoleError).toHaveBeenCalledWith(
      'Desktop Agent transport stop failed.',
      expect.any(String)
    )
    expect(serializedLog).not.toContain('http://127.0.0.1:48123')
    expect(serializedLog).not.toContain('Bearer credential-secret')
    expect(serializedLog).not.toContain('credential-secret')
  })
})

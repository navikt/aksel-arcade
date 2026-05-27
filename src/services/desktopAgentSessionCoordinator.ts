import {
  DEFAULT_AGENT_PERMISSIONS,
  type AgentBridgeSession,
  type AgentPermissions,
} from './agentBridge'
import { generateSecureUUID } from '@/utils/crypto'

export type DesktopAgentSessionStatus = 'inactive' | 'active'

export type DesktopAgentSessionEndReason = 'stop' | 'reload' | 'quit' | 'renderer-unmount'

export interface DesktopAgentSessionSnapshot extends AgentBridgeSession {
  status: 'active'
  permissions: AgentPermissions
  transportEndpoint?: DesktopAgentTransportEndpoint
}

export interface DesktopAgentTransportEndpoint {
  endpoint: string
  sessionId: string
  authorizationHeader: string
}

export interface DesktopAgentTransportSession extends DesktopAgentSessionSnapshot {
  pairingCredential: string
}

export interface DesktopAgentTransportAdapter {
  startSession?: (
    session: DesktopAgentTransportSession
  ) => DesktopAgentTransportEndpoint | void | Promise<DesktopAgentTransportEndpoint | void>
  stopSession?: (
    session: DesktopAgentTransportSession,
    reason: DesktopAgentSessionEndReason
  ) => void | Promise<void>
}

export interface DesktopAgentSessionCoordinatorOptions {
  createSessionId?: () => string
  createPairingCredential?: () => string
  createTimestamp?: () => string
  transportAdapter?: DesktopAgentTransportAdapter
}

export interface DesktopAgentSessionCoordinator {
  getStatus: () => DesktopAgentSessionStatus
  getActiveSession: () => DesktopAgentSessionSnapshot | null
  getActiveTransportSession: () => DesktopAgentTransportSession | null
  getPermissions: () => AgentPermissions
  isSessionActive: (sessionId?: string) => boolean
  startSession: () => Promise<DesktopAgentSessionSnapshot>
  stopSession: (reason?: DesktopAgentSessionEndReason) => void
}

const PAIRING_CREDENTIAL_BYTE_LENGTH = 32

export const createAgentPairingCredential = (): string => {
  const cryptoObj = globalThis.crypto

  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random generator unavailable (Web Crypto missing)')
  }

  const bytes = new Uint8Array(PAIRING_CREDENTIAL_BYTE_LENGTH)
  cryptoObj.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const createDesktopAgentSessionCoordinator = ({
  createSessionId = generateSecureUUID,
  createPairingCredential = createAgentPairingCredential,
  createTimestamp = () => new Date().toISOString(),
  transportAdapter,
}: DesktopAgentSessionCoordinatorOptions = {}): DesktopAgentSessionCoordinator => {
  let activeSession: DesktopAgentTransportSession | null = null
  let lifecycleVersion = 0
  let startOperation: Promise<DesktopAgentSessionSnapshot> | null = null
  let pendingStartCancellation: {
    sessionId: string
    reason: DesktopAgentSessionEndReason
  } | null = null

  const createSession = (): DesktopAgentTransportSession => ({
    id: createSessionId(),
    startedAt: createTimestamp(),
    status: 'active',
    permissions: clonePermissions(DEFAULT_AGENT_PERMISSIONS),
    pairingCredential: createPairingCredential(),
  })

  const getActiveSession = (): DesktopAgentSessionSnapshot | null =>
    activeSession ? toSessionSnapshot(activeSession) : null

  const stopSession = (reason: DesktopAgentSessionEndReason = 'stop') => {
    if (!activeSession) {
      return
    }

    const sessionToStop = activeSession
    activeSession = null
    lifecycleVersion += 1
    if (startOperation) {
      pendingStartCancellation = {
        sessionId: sessionToStop.id,
        reason,
      }
    }

    const stopResult = stopTransportSession(sessionToStop, reason)
    if (isPromiseLike(stopResult)) {
      void stopResult.catch((error) => {
        console.error('Desktop Agent transport stop failed.', error)
      })
    }
  }

  return {
    getStatus: () => (activeSession ? 'active' : 'inactive'),
    getActiveSession,
    getActiveTransportSession: () => (activeSession ? cloneTransportSession(activeSession) : null),
    getPermissions: () =>
      activeSession
        ? clonePermissions(activeSession.permissions)
        : clonePermissions(DEFAULT_AGENT_PERMISSIONS),
    isSessionActive: (sessionId?: string) =>
      Boolean(activeSession && (sessionId === undefined || activeSession.id === sessionId)),
    startSession: async () => {
      if (startOperation) {
        return startOperation
      }

      if (activeSession) {
        return toSessionSnapshot(activeSession)
      }

      const nextStartOperation = startNewSession()
      startOperation = nextStartOperation

      try {
        return await nextStartOperation
      } finally {
        if (startOperation === nextStartOperation) {
          startOperation = null
        }
      }
    },
    stopSession,
  }

  async function startNewSession(): Promise<DesktopAgentSessionSnapshot> {
    const nextSession = createSession()
    activeSession = nextSession
    const sessionVersion = (lifecycleVersion += 1)

    try {
      const transportEndpoint = await transportAdapter?.startSession?.(
        cloneTransportSession(nextSession)
      )

      if (!isCurrentSession(nextSession.id, sessionVersion)) {
        const cancellationReason =
          pendingStartCancellation?.sessionId === nextSession.id
            ? pendingStartCancellation.reason
            : 'stop'
        pendingStartCancellation = null

        if (transportEndpoint) {
          await stopTransportSession(
            {
              ...nextSession,
              transportEndpoint: cloneTransportEndpoint(transportEndpoint),
            },
            cancellationReason
          )
        }

        throw new Error(
          'Desktop Agent session startup was cancelled before the transport was ready.'
        )
      }

      if (transportEndpoint) {
        activeSession = {
          ...nextSession,
          transportEndpoint: cloneTransportEndpoint(transportEndpoint),
        }
      }

      return toSessionSnapshot(activeSession)
    } catch (error) {
      if (isCurrentSession(nextSession.id, sessionVersion)) {
        activeSession = null
        lifecycleVersion += 1
      }
      throw error
    } finally {
      if (pendingStartCancellation?.sessionId === nextSession.id) {
        pendingStartCancellation = null
      }
    }
  }

  function stopTransportSession(
    session: DesktopAgentTransportSession,
    reason: DesktopAgentSessionEndReason
  ) {
    return transportAdapter?.stopSession?.(cloneTransportSession(session), reason)
  }

  function isCurrentSession(sessionId: string, version: number): boolean {
    return activeSession?.id === sessionId && lifecycleVersion === version
  }
}

const clonePermissions = (permissions: AgentPermissions): AgentPermissions => ({ ...permissions })

const cloneTransportEndpoint = (
  endpoint: DesktopAgentTransportEndpoint
): DesktopAgentTransportEndpoint => ({
  endpoint: endpoint.endpoint,
  sessionId: endpoint.sessionId,
  authorizationHeader: endpoint.authorizationHeader,
})

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function'

const toSessionSnapshot = ({
  id,
  startedAt,
  status,
  permissions,
  transportEndpoint,
}: DesktopAgentTransportSession): DesktopAgentSessionSnapshot => ({
  id,
  startedAt,
  status,
  permissions: clonePermissions(permissions),
  ...(transportEndpoint ? { transportEndpoint: cloneTransportEndpoint(transportEndpoint) } : {}),
})

const cloneTransportSession = (
  session: DesktopAgentTransportSession
): DesktopAgentTransportSession => ({
  ...toSessionSnapshot(session),
  pairingCredential: session.pairingCredential,
})

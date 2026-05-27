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
}

export interface DesktopAgentTransportSession extends DesktopAgentSessionSnapshot {
  pairingCredential: string
}

export interface DesktopAgentTransportAdapter {
  startSession?: (session: DesktopAgentTransportSession) => void
  stopSession?: (
    session: DesktopAgentTransportSession,
    reason: DesktopAgentSessionEndReason
  ) => void
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
  startSession: () => DesktopAgentSessionSnapshot
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
    transportAdapter?.stopSession?.(cloneTransportSession(sessionToStop), reason)
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
    startSession: () => {
      if (activeSession) {
        return toSessionSnapshot(activeSession)
      }

      const nextSession = createSession()
      activeSession = nextSession

      try {
        transportAdapter?.startSession?.(cloneTransportSession(nextSession))
      } catch (error) {
        activeSession = null
        throw error
      }

      return toSessionSnapshot(nextSession)
    },
    stopSession,
  }
}

const clonePermissions = (permissions: AgentPermissions): AgentPermissions => ({ ...permissions })

const toSessionSnapshot = ({
  id,
  startedAt,
  status,
  permissions,
}: DesktopAgentTransportSession): DesktopAgentSessionSnapshot => ({
  id,
  startedAt,
  status,
  permissions: clonePermissions(permissions),
})

const cloneTransportSession = (
  session: DesktopAgentTransportSession
): DesktopAgentTransportSession => ({
  ...toSessionSnapshot(session),
  pairingCredential: session.pairingCredential,
})

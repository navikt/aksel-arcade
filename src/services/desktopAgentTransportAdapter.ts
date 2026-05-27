import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type {
  DesktopAgentTransportAdapter,
  DesktopAgentTransportEndpoint,
  DesktopAgentTransportSession,
} from './desktopAgentSessionCoordinator'

export const createDesktopPreloadAgentTransportAdapter = (
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): DesktopAgentTransportAdapter | undefined => {
  if (!api?.startAgentTransportSession || !api.stopAgentTransportSession) {
    return undefined
  }
  const { startAgentTransportSession, stopAgentTransportSession } = api

  return {
    startSession: async (session) => {
      const endpoint = await startAgentTransportSession(cloneTransportSession(session))
      if (!isValidTransportEndpoint(endpoint, session.id)) {
        throw new Error('Invalid Desktop Agent transport endpoint returned from preload IPC.')
      }
      return endpoint
    },
    stopSession: async (session, reason) => {
      await stopAgentTransportSession(session.id, reason)
    },
  }
}

const cloneTransportSession = (
  session: DesktopAgentTransportSession
): DesktopAgentTransportSession => ({
  id: session.id,
  startedAt: session.startedAt,
  status: session.status,
  permissions: { ...session.permissions },
  pairingCredential: session.pairingCredential,
})

const isValidTransportEndpoint = (
  endpoint: DesktopAgentTransportEndpoint,
  sessionId: string
): boolean => {
  if (!isRecord(endpoint) || endpoint.sessionId !== sessionId) {
    return false
  }

  if (typeof endpoint.authorizationHeader !== 'string') {
    return false
  }

  try {
    const url = new URL(endpoint.endpoint)
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
      Number(url.port) > 0 &&
      endpoint.authorizationHeader.startsWith('Bearer ') &&
      endpoint.authorizationHeader.slice('Bearer '.length).trim().length > 0
    )
  } catch {
    return false
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

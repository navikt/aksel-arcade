import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  publishAgentBridge,
  removeAgentBridge,
  type AgentBridgeSession,
  type AgentPermissionKey,
  type AgentPermissions,
} from '@/services/agentBridge'
import { generateSecureUUID } from '@/utils/crypto'

type AgentSessionActivity = 'inactive' | 'started' | 'permission-updated' | 'revoked'

interface AgentSessionEvent {
  type: AgentSessionActivity
  at: string | null
}

const createTimestamp = (): string => new Date().toISOString()

export const useAgentSession = () => {
  const [session, setSession] = useState<AgentBridgeSession | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>(DEFAULT_AGENT_PERMISSIONS)
  const [lastEvent, setLastEvent] = useState<AgentSessionEvent>({
    type: 'inactive',
    at: null,
  })

  useEffect(() => {
    if (!session) {
      removeAgentBridge()
      return
    }

    publishAgentBridge(session, permissions)

    return () => {
      removeAgentBridge(session.id)
    }
  }, [session, permissions])

  const startAgentSession = useCallback(() => {
    const startedAt = createTimestamp()
    setSession({
      id: generateSecureUUID(),
      startedAt,
    })
    setLastEvent({ type: 'started', at: startedAt })
  }, [])

  const stopAgentSession = useCallback(() => {
    removeAgentBridge(session?.id)
    setSession(null)
    setLastEvent({ type: 'revoked', at: createTimestamp() })
  }, [session?.id])

  const setPermission = useCallback((key: AgentPermissionKey, checked: boolean) => {
    setPermissions((current) => {
      if (current[key] === checked) {
        return current
      }

      return {
        ...current,
        [key]: checked,
      }
    })
    setLastEvent({ type: 'permission-updated', at: createTimestamp() })
  }, [])

  const statusText = useMemo(() => {
    if (session) {
      if (lastEvent.type === 'permission-updated') {
        return 'Status: active. Permissions changed; status reflects recent activity, not socket connectivity.'
      }

      return 'Status: active. No agent activity yet; this temporary bridge is not a durable socket.'
    }

    if (lastEvent.type === 'revoked') {
      return 'Status: access revoked. The browser bridge was removed.'
    }

    return 'Status: inactive. Agent access is off and no browser bridge is published.'
  }, [lastEvent.type, session])

  return {
    isActive: Boolean(session),
    permissions,
    statusText,
    startAgentSession,
    stopAgentSession,
    setPermission,
  }
}

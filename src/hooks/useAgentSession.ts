import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentInstructions,
  publishAgentBridge,
  removeAgentBridge,
  type AgentBridgeCommandName,
  type AgentBridgeReadContext,
  type AgentBridgeSession,
  type AgentPermissionKey,
  type AgentPermissions,
} from '@/services/agentBridge'
import type { ThemeMode } from '@/contexts/SettingsContext'
import type { Project } from '@/types/project'
import { generateSecureUUID } from '@/utils/crypto'

type AgentSessionActivity = 'inactive' | 'started' | 'permission-updated' | 'read' | 'revoked'

interface AgentSessionEvent {
  type: AgentSessionActivity
  at: string | null
  command?: AgentBridgeCommandName
}

interface UseAgentSessionOptions {
  project: Pick<Project, 'name' | 'jsxCode' | 'hooksCode' | 'viewportSize'>
  theme: ThemeMode
}

const createTimestamp = (): string => new Date().toISOString()

export const useAgentSession = ({ project, theme }: UseAgentSessionOptions) => {
  const [session, setSession] = useState<AgentBridgeSession | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>(DEFAULT_AGENT_PERMISSIONS)
  const [lastEvent, setLastEvent] = useState<AgentSessionEvent>({
    type: 'inactive',
    at: null,
  })
  const activeSessionIdRef = useRef<string | null>(null)
  const permissionsRef = useRef<AgentPermissions>(permissions)
  const readContextRef = useRef<AgentBridgeReadContext>({
    project: {
      name: project.name,
      jsxCode: project.jsxCode,
      hooksCode: project.hooksCode,
    },
    preview: {
      theme,
      viewportSize: project.viewportSize,
    },
  })

  const readContext = useMemo<AgentBridgeReadContext>(
    () => ({
      project: {
        name: project.name,
        jsxCode: project.jsxCode,
        hooksCode: project.hooksCode,
      },
      preview: {
        theme,
        viewportSize: project.viewportSize,
      },
    }),
    [project.hooksCode, project.jsxCode, project.name, project.viewportSize, theme]
  )

  permissionsRef.current = permissions
  readContextRef.current = readContext

  useEffect(() => {
    if (!session) {
      removeAgentBridge()
      return
    }

    activeSessionIdRef.current = session.id
    publishAgentBridge(session, permissions, {
      getReadContext: () => readContextRef.current,
      getPermissions: () => permissionsRef.current,
      isSessionActive: () => activeSessionIdRef.current === session.id,
      recordActivity: (command) => {
        setLastEvent({ type: 'read', at: createTimestamp(), command })
      },
    })

    return () => {
      removeAgentBridge(session.id)
    }
  }, [activeSessionIdRef, permissions, permissionsRef, readContextRef, session])

  const startAgentSession = useCallback(() => {
    const startedAt = createTimestamp()
    const nextSession = {
      id: generateSecureUUID(),
      startedAt,
    }

    activeSessionIdRef.current = nextSession.id
    setSession(nextSession)
    setLastEvent({ type: 'started', at: startedAt })
  }, [activeSessionIdRef])

  const stopAgentSession = useCallback(() => {
    const sessionId = activeSessionIdRef.current ?? session?.id
    activeSessionIdRef.current = null
    removeAgentBridge(sessionId)
    setSession(null)
    setLastEvent({ type: 'revoked', at: createTimestamp() })
  }, [activeSessionIdRef, session?.id])

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
      if (lastEvent.type === 'read' && lastEvent.command) {
        return `Status: active. Last agent read: ${lastEvent.command}; this is activity, not socket connectivity.`
      }

      if (lastEvent.type === 'permission-updated') {
        return 'Status: active. Permissions changed; status reflects recent activity, not socket connectivity.'
      }

      return 'Status: active. No agent activity yet; this temporary bridge is not a durable socket.'
    }

    if (lastEvent.type === 'revoked') {
      return 'Status: access revoked. The browser bridge was removed.'
    }

    return 'Status: inactive. Agent access is off and no browser bridge is published.'
  }, [lastEvent.command, lastEvent.type, session])

  const agentInstructions = useMemo(() => createAgentInstructions(permissions), [permissions])

  return {
    agentInstructions,
    isActive: Boolean(session),
    permissions,
    statusText,
    startAgentSession,
    stopAgentSession,
    setPermission,
  }
}

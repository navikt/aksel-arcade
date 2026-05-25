import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_AGENT_PERMISSIONS,
  createAgentInstructions,
  publishAgentBridge,
  removeAgentBridge,
  type AgentBridgeCommandResult,
  type AgentBridgeCommandName,
  type AgentBridgeReadContext,
  type AgentBridgeSession,
  type AgentPermissionKey,
  type AgentPermissions,
  type AgentSourceChangeResult,
  type AgentSourceField,
} from '@/services/agentBridge'
import type { ThemeMode } from '@/contexts/SettingsContext'
import type { Project } from '@/types/project'
import { generateSecureUUID } from '@/utils/crypto'

type AgentSessionActivity =
  | 'inactive'
  | 'started'
  | 'permission-updated'
  | 'read'
  | 'change'
  | 'rollback'
  | 'revoked'

interface AgentSessionEvent {
  type: AgentSessionActivity
  at: string | null
  command?: AgentBridgeCommandName
}

type AgentSourceUpdates = Partial<Pick<Project, 'jsxCode' | 'hooksCode'>>

interface AgentSourceCheckpoint {
  id: string
  createdAt: string
  summary: string
  changedFields: AgentSourceField[]
  previous: Pick<Project, 'jsxCode' | 'hooksCode'>
}

export type AgentSourceCheckpointListItem = Pick<
  AgentSourceCheckpoint,
  'id' | 'createdAt' | 'summary' | 'changedFields'
>

interface UseAgentSessionOptions {
  project: Pick<Project, 'name' | 'jsxCode' | 'hooksCode' | 'viewportSize'>
  theme: ThemeMode
  onSourceChange: (updates: AgentSourceUpdates) => void
}

const createTimestamp = (): string => new Date().toISOString()
const MAX_AGENT_SOURCE_CHECKPOINTS = 10

export const useAgentSession = ({ project, theme, onSourceChange }: UseAgentSessionOptions) => {
  const [session, setSession] = useState<AgentBridgeSession | null>(null)
  const [permissions, setPermissions] = useState<AgentPermissions>(DEFAULT_AGENT_PERMISSIONS)
  const [checkpoints, setCheckpoints] = useState<AgentSourceCheckpoint[]>([])
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

  const applyAgentSourceChange = useCallback(
    (request: unknown): AgentBridgeCommandResult<AgentSourceChangeResult> => {
      if (!permissionsRef.current.sourceChanges) {
        return createSourceChangeFailure(
          'permission-denied',
          'Source changes are disabled by the human in the Agent menu.'
        )
      }

      const parsedRequest = parseSourceChangeRequest(request)
      if (!parsedRequest.ok) {
        return createSourceChangeFailure('invalid-request', parsedRequest.message)
      }

      const currentSource = readContextRef.current.project
      const checkpoint = {
        id: generateSecureUUID(),
        createdAt: createTimestamp(),
        summary: parsedRequest.summary,
        changedFields: parsedRequest.changedFields,
        previous: {
          jsxCode: currentSource.jsxCode,
          hooksCode: currentSource.hooksCode,
        },
      }

      setCheckpoints((current) => [checkpoint, ...current].slice(0, MAX_AGENT_SOURCE_CHECKPOINTS))
      onSourceChange(parsedRequest.updates)

      return {
        ok: true,
        command: 'applySourceChange',
        data: {
          checkpointId: checkpoint.id,
          changedFields: checkpoint.changedFields,
        },
      }
    },
    [onSourceChange]
  )

  useEffect(() => {
    if (!session) {
      removeAgentBridge()
      return
    }

    activeSessionIdRef.current = session.id
    publishAgentBridge(session, {
      getReadContext: () => readContextRef.current,
      getPermissions: () => permissionsRef.current,
      isSessionActive: () => activeSessionIdRef.current === session.id,
      recordActivity: (command) => {
        setLastEvent({
          type: command === 'applySourceChange' ? 'change' : 'read',
          at: createTimestamp(),
          command,
        })
      },
      applySourceChange: applyAgentSourceChange,
    })

    return () => {
      removeAgentBridge(session.id)
    }
  }, [activeSessionIdRef, applyAgentSourceChange, permissionsRef, readContextRef, session])

  const startAgentSession = useCallback(() => {
    const startedAt = createTimestamp()
    const nextSession = {
      id: generateSecureUUID(),
      startedAt,
    }

    activeSessionIdRef.current = nextSession.id
    setCheckpoints([])
    setSession(nextSession)
    setLastEvent({ type: 'started', at: startedAt })
  }, [activeSessionIdRef])

  const stopAgentSession = useCallback(() => {
    const sessionId = activeSessionIdRef.current ?? session?.id
    activeSessionIdRef.current = null
    removeAgentBridge(sessionId)
    setCheckpoints([])
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

  const restoreCheckpoint = useCallback(
    (checkpointId: string) => {
      const checkpoint = checkpoints.find((entry) => entry.id === checkpointId)
      if (!checkpoint) {
        console.error(
          `Agent Checkpoint ${checkpointId} could not be restored because it is no longer available.`
        )
        return
      }

      const updates = checkpoint.changedFields.reduce<AgentSourceUpdates>((nextUpdates, field) => {
        nextUpdates[field] = checkpoint.previous[field]
        return nextUpdates
      }, {})

      onSourceChange(updates)
      setLastEvent({ type: 'rollback', at: createTimestamp() })
    },
    [checkpoints, onSourceChange]
  )

  const rollbackCheckpoints = useMemo<AgentSourceCheckpointListItem[]>(
    () =>
      checkpoints.map(({ id, createdAt, summary, changedFields }) => ({
        id,
        createdAt,
        summary,
        changedFields,
      })),
    [checkpoints]
  )

  const statusText = useMemo(() => {
    if (session) {
      if (lastEvent.type === 'read' && lastEvent.command) {
        return `Status: active. Last agent read: ${lastEvent.command}; this is activity, not socket connectivity.`
      }

      if (lastEvent.type === 'change' && lastEvent.command) {
        return `Status: active. Last agent change: ${lastEvent.command}; this is activity, not socket connectivity.`
      }

      if (lastEvent.type === 'rollback') {
        return 'Status: active. Human restored an Agent Checkpoint; status reflects recent activity, not socket connectivity.'
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
    checkpoints: rollbackCheckpoints,
    isActive: Boolean(session),
    permissions,
    restoreCheckpoint,
    statusText,
    startAgentSession,
    stopAgentSession,
    setPermission,
  }
}

interface ParsedSourceChangeRequest {
  ok: true
  summary: string
  changedFields: AgentSourceField[]
  updates: AgentSourceUpdates
}

interface InvalidSourceChangeRequest {
  ok: false
  message: string
}

type SourceChangeParseResult = ParsedSourceChangeRequest | InvalidSourceChangeRequest

const createSourceChangeFailure = (
  code: 'permission-denied' | 'invalid-request',
  message: string
): AgentBridgeCommandResult<AgentSourceChangeResult> => ({
  ok: false,
  command: 'applySourceChange',
  error: {
    code,
    message,
  },
})

const parseSourceChangeRequest = (request: unknown): SourceChangeParseResult => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, message: 'Source changes must be provided as an object.' }
  }

  const candidate = request as Record<string, unknown>
  const summary = candidate.summary
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    return { ok: false, message: 'A non-empty human-readable summary is required.' }
  }

  const updates: AgentSourceUpdates = {}
  const changedFields: AgentSourceField[] = []

  for (const field of ['jsxCode', 'hooksCode'] as const) {
    if (!(field in candidate)) {
      continue
    }

    const value = candidate[field]
    if (typeof value !== 'string') {
      return { ok: false, message: `${field} must be a full-field string replacement.` }
    }

    updates[field] = value
    changedFields.push(field)
  }

  if (changedFields.length === 0) {
    return { ok: false, message: 'Provide jsxCode and/or hooksCode to replace source.' }
  }

  return {
    ok: true,
    summary: summary.trim(),
    changedFields,
    updates,
  }
}

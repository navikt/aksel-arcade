export const AGENT_BRIDGE_GLOBAL = '__AKSEL_ARCADE_AGENT_BRIDGE__'

export type AgentPermissionKey =
  | 'sourceChanges'
  | 'previewSettings'
  | 'previewEvidence'
  | 'projectMetadata'

export interface AgentPermissions {
  sourceChanges: boolean
  previewSettings: boolean
  previewEvidence: boolean
  projectMetadata: boolean
}

export interface AgentBridgeSession {
  id: string
  startedAt: string
}

export interface AgentBridge {
  version: 1
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly string[]
}

export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  sourceChanges: true,
  previewSettings: true,
  previewEvidence: true,
  projectMetadata: false,
}

export const AGENT_BRIDGE_COMMAND_NAMES: readonly string[] = []

export const createAgentBridge = (
  session: AgentBridgeSession,
  permissions: AgentPermissions
): AgentBridge => ({
  version: 1,
  sessionId: session.id,
  status: 'active',
  startedAt: session.startedAt,
  permissions: { ...permissions },
  readScope: 'arcade-session',
  commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
})

export const publishAgentBridge = (
  session: AgentBridgeSession,
  permissions: AgentPermissions
): void => {
  if (typeof window === 'undefined') {
    return
  }

  window[AGENT_BRIDGE_GLOBAL] = createAgentBridge(session, permissions)
}

export const removeAgentBridge = (sessionId?: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  const bridge = window[AGENT_BRIDGE_GLOBAL]
  if (sessionId && bridge?.sessionId !== sessionId) {
    return
  }

  delete window[AGENT_BRIDGE_GLOBAL]
}

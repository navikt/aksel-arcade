import type { ThemeMode } from '@/contexts/SettingsContext'
import type { ViewportSize } from '@/types/project'
import { clonePreviewDiagnostics, type PreviewDiagnostics } from '@/services/previewDiagnostics'
import type { PreviewEvidence, PreviewEvidenceCaptureResult } from '@/services/previewEvidence'

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

export interface AgentProjectReadState {
  name: string
  jsxCode: string
  hooksCode: string
}

export interface AgentPreviewReadState {
  theme: ThemeMode
  viewportSize: ViewportSize
}

export interface AgentBridgeReadContext {
  project: AgentProjectReadState
  preview: AgentPreviewReadState
  diagnostics: PreviewDiagnostics
}

export type AgentSourceField = 'jsxCode' | 'hooksCode'
export type AgentPreviewField = 'viewportSize' | 'theme'
export type AgentMetadataField = 'name'
export type AgentChangeField = AgentSourceField | AgentPreviewField | AgentMetadataField

export interface AgentSourceChangeRequest {
  summary: string
  jsxCode?: string
  hooksCode?: string
  viewportSize?: ViewportSize
  theme?: ThemeMode
  name?: string
}

export interface AgentSourceChangeResult {
  checkpointId: string
  changedFields: AgentChangeField[]
}

export type AgentBridgeErrorCode =
  | 'session-revoked'
  | 'permission-denied'
  | 'invalid-request'
  | 'unsupported-field'
  | 'payload-too-large'
  | 'preview-unavailable'

export const AGENT_BRIDGE_COMMAND_NAMES = [
  'getProject',
  'getPreviewContext',
  'getDiagnostics',
  'getPreviewEvidence',
  'getSessionState',
  'applySourceChange',
] as const

export type AgentBridgeCommandName = (typeof AGENT_BRIDGE_COMMAND_NAMES)[number]

export interface AgentSessionReadState {
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
}

interface AgentBridgeCommandSuccess<TData> {
  ok: true
  command: AgentBridgeCommandName
  data: TData
}

interface AgentBridgeCommandFailure {
  ok: false
  command: AgentBridgeCommandName
  error: {
    code: AgentBridgeErrorCode
    message: string
  }
}

export type AgentBridgeCommandResult<TData> =
  | AgentBridgeCommandSuccess<TData>
  | AgentBridgeCommandFailure

export interface AgentBridgeController {
  getReadContext: () => AgentBridgeReadContext
  getPermissions: () => AgentPermissions
  isSessionActive: () => boolean
  recordActivity: (command: AgentBridgeCommandName) => void
  applySourceChange: (request: unknown) => AgentBridgeCommandResult<AgentSourceChangeResult>
  getPreviewEvidence: () => PreviewEvidenceCaptureResult
}

export interface AgentBridge {
  version: 1
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
  getProject: () => AgentBridgeCommandResult<AgentProjectReadState>
  getPreviewContext: () => AgentBridgeCommandResult<AgentPreviewReadState>
  getDiagnostics: () => AgentBridgeCommandResult<PreviewDiagnostics>
  getPreviewEvidence: () => AgentBridgeCommandResult<PreviewEvidence>
  getSessionState: () => AgentBridgeCommandResult<AgentSessionReadState>
  applySourceChange: (request: unknown) => AgentBridgeCommandResult<AgentSourceChangeResult>
}

export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  sourceChanges: true,
  previewSettings: true,
  previewEvidence: true,
  projectMetadata: true,
}

export const createAgentBridge = (
  session: AgentBridgeSession,
  controller: AgentBridgeController
): AgentBridge => {
  const createFailure = (
    command: AgentBridgeCommandName,
    code: AgentBridgeErrorCode,
    message: string
  ): AgentBridgeCommandResult<never> => ({
    ok: false,
    command,
    error: {
      code,
      message,
    },
  })

  const readCommand = <TData>(
    command: AgentBridgeCommandName,
    read: () => TData
  ): AgentBridgeCommandResult<TData> => {
    if (!controller.isSessionActive()) {
      return createFailure(
        command,
        'session-revoked',
        'Agent access has been revoked. Ask the human to start a new Agent session.'
      )
    }

    const data = read()
    controller.recordActivity(command)

    return {
      ok: true,
      command,
      data,
    }
  }

  return {
    version: 1,
    sessionId: session.id,
    status: 'active',
    startedAt: session.startedAt,
    get permissions() {
      return { ...controller.getPermissions() }
    },
    readScope: 'arcade-session',
    commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
    getProject: () =>
      readCommand('getProject', () => ({
        ...controller.getReadContext().project,
      })),
    getPreviewContext: () =>
      readCommand('getPreviewContext', () => ({
        ...controller.getReadContext().preview,
      })),
    getDiagnostics: () =>
      readCommand('getDiagnostics', () =>
        clonePreviewDiagnostics(controller.getReadContext().diagnostics)
      ),
    getPreviewEvidence: () => {
      const command: AgentBridgeCommandName = 'getPreviewEvidence'

      if (!controller.isSessionActive()) {
        return createFailure(
          command,
          'session-revoked',
          'Agent access has been revoked. Ask the human to start a new Agent session.'
        )
      }

      if (!controller.getPermissions().previewEvidence) {
        return createFailure(
          command,
          'permission-denied',
          'Preview evidence reads require the Preview evidence permission.'
        )
      }

      const result = controller.getPreviewEvidence()
      if (!result.ok) {
        return createFailure(command, result.error.code, result.error.message)
      }

      controller.recordActivity(command)

      return {
        ok: true,
        command,
        data: result.evidence,
      }
    },
    getSessionState: () =>
      readCommand('getSessionState', () => ({
        sessionId: session.id,
        status: 'active',
        startedAt: session.startedAt,
        permissions: { ...controller.getPermissions() },
        readScope: 'arcade-session',
        commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
      })),
    applySourceChange: (request) => {
      const command: AgentBridgeCommandName = 'applySourceChange'

      if (!controller.isSessionActive()) {
        return createFailure(
          command,
          'session-revoked',
          'Agent access has been revoked. Ask the human to start a new Agent session.'
        )
      }

      const result = controller.applySourceChange(request)
      if (result.ok) {
        controller.recordActivity(command)
      }

      return result
    },
  }
}
export const publishAgentBridge = (
  session: AgentBridgeSession,
  controller: AgentBridgeController
): void => {
  if (typeof window === 'undefined') {
    return
  }

  window[AGENT_BRIDGE_GLOBAL] = createAgentBridge(session, controller)
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

export const createAgentInstructions = (permissions: AgentPermissions): string => {
  const permissionLines = Object.entries(permissions).map(
    ([key, value]) => `- ${key}: ${value ? 'true' : 'false'}`
  )

  return [
    'Aksel Arcade external-agent instructions',
    '',
    `Bridge global: window.${AGENT_BRIDGE_GLOBAL}`,
    'The human must start temporary Agent access before this global exists. If it is missing, ask the human to start access from the Agent menu.',
    '',
    `Currently available command names: ${AGENT_BRIDGE_COMMAND_NAMES.map((command) => `${command}()`).join(', ')}`,
    'Use getDiagnostics() to read preview status, compile errors, runtime errors, and bounded sandbox console messages after changes.',
    'Use getPreviewEvidence() to read permission-gated, sanitized layout evidence from only the sandboxed Preview frame.',
    'To replace allowed fields, call applySourceChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? }). A non-empty human-readable summary is required, and the human controls rollback from the Agent menu.',
    '',
    'Active permission state:',
    ...permissionLines,
    '',
    'Read scope: use only Arcade-scoped state returned by the bridge. Do not read share payloads, export data, browser storage, clipboard data, cookies, or unrelated page state.',
    '',
    'Arcade authoring contract:',
    '- Work with import-free Arcade JSX and Hooks code.',
    '- The project shape is { name, jsxCode, hooksCode, viewportSize, theme, notes?, assumptions?, suggestedNextPrompts? }.',
    '- Supported copied-out imports are react, @navikt/ds-react, @navikt/ds-react/Theme, @navikt/aksel-icons, @navikt/ds-css, and local ./hooks.',
    '- Keep source changes within the current Arcade project and use the live preview/diagnostics loop for validation.',
  ].join('\n')
}

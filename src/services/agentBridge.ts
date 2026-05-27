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
  | 'unsupported-command'
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

interface AgentBridgeCommandSuccess<TData, TCommand extends string = AgentBridgeCommandName> {
  ok: true
  command: TCommand
  data: TData
}

interface AgentBridgeCommandFailure<TCommand extends string = AgentBridgeCommandName> {
  ok: false
  command: TCommand
  error: {
    code: AgentBridgeErrorCode
    message: string
  }
}

export type AgentBridgeCommandResult<TData> =
  | AgentBridgeCommandSuccess<TData>
  | AgentBridgeCommandFailure

export type AgentBridgeRoutedCommandResult =
  | AgentBridgeCommandResult<AgentProjectReadState>
  | AgentBridgeCommandResult<AgentPreviewReadState>
  | AgentBridgeCommandResult<PreviewDiagnostics>
  | AgentBridgeCommandResult<PreviewEvidence>
  | AgentBridgeCommandResult<AgentSessionReadState>
  | AgentBridgeCommandResult<AgentSourceChangeResult>
  | AgentBridgeCommandFailure<string>

export interface AgentBridgeController {
  getReadContext: () => AgentBridgeReadContext
  getPermissions: () => AgentPermissions
  isSessionActive: () => boolean
  recordActivity: (command: AgentBridgeCommandName) => void
  applySourceChange: (request: unknown) => AgentBridgeCommandResult<AgentSourceChangeResult>
  getPreviewEvidence: () => PreviewEvidenceCaptureResult
}

export interface AgentBridgeCommandRouter {
  version: 1
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
  routeCommand(command: 'getProject'): AgentBridgeCommandResult<AgentProjectReadState>
  routeCommand(command: 'getPreviewContext'): AgentBridgeCommandResult<AgentPreviewReadState>
  routeCommand(command: 'getDiagnostics'): AgentBridgeCommandResult<PreviewDiagnostics>
  routeCommand(command: 'getPreviewEvidence'): AgentBridgeCommandResult<PreviewEvidence>
  routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  routeCommand(
    command: 'applySourceChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentSourceChangeResult>
  routeCommand(command: string, request?: unknown): AgentBridgeRoutedCommandResult
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

export const isAgentBridgeCommandName = (command: string): command is AgentBridgeCommandName =>
  AGENT_BRIDGE_COMMAND_NAMES.some((supportedCommand) => supportedCommand === command)

const createCommandFailure = <TCommand extends string>(
  command: TCommand,
  code: AgentBridgeErrorCode,
  message: string
): AgentBridgeCommandFailure<TCommand> => ({
  ok: false,
  command,
  error: {
    code,
    message,
  },
})

const createSessionRevokedFailure = (
  command: AgentBridgeCommandName
): AgentBridgeCommandFailure => {
  return createCommandFailure(
    command,
    'session-revoked',
    'Agent access has been revoked. Ask the human to start a new Agent session.'
  )
}

const createUnsupportedCommandFailure = (command: string): AgentBridgeCommandFailure<string> => {
  return createCommandFailure(
    command,
    'unsupported-command',
    `Unsupported Agent bridge command "${command}". Supported commands: ${AGENT_BRIDGE_COMMAND_NAMES.join(
      ', '
    )}.`
  )
}

const createCommandSuccess = <TData>(
  command: AgentBridgeCommandName,
  data: TData
): AgentBridgeCommandSuccess<TData> => ({
  ok: true,
  command,
  data,
})

export const createAgentBridgeCommandRouter = (
  session: AgentBridgeSession,
  controller: AgentBridgeController
): AgentBridgeCommandRouter => {
  const readCommand = <TData>(
    command: AgentBridgeCommandName,
    read: () => TData
  ): AgentBridgeCommandResult<TData> => {
    if (!controller.isSessionActive()) {
      return createSessionRevokedFailure(command)
    }

    const data = read()
    controller.recordActivity(command)

    return createCommandSuccess(command, data)
  }

  function routeCommand(command: 'getProject'): AgentBridgeCommandResult<AgentProjectReadState>
  function routeCommand(
    command: 'getPreviewContext'
  ): AgentBridgeCommandResult<AgentPreviewReadState>
  function routeCommand(command: 'getDiagnostics'): AgentBridgeCommandResult<PreviewDiagnostics>
  function routeCommand(command: 'getPreviewEvidence'): AgentBridgeCommandResult<PreviewEvidence>
  function routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  function routeCommand(
    command: 'applySourceChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentSourceChangeResult>
  function routeCommand(command: string, request?: unknown): AgentBridgeRoutedCommandResult {
    if (!isAgentBridgeCommandName(command)) {
      return createUnsupportedCommandFailure(command)
    }

    switch (command) {
      case 'getProject':
        return readCommand('getProject', () => ({
          ...controller.getReadContext().project,
        }))
      case 'getPreviewContext':
        return readCommand('getPreviewContext', () => ({
          ...controller.getReadContext().preview,
        }))
      case 'getDiagnostics':
        return readCommand('getDiagnostics', () =>
          clonePreviewDiagnostics(controller.getReadContext().diagnostics)
        )
      case 'getPreviewEvidence':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        if (!controller.getPermissions().previewEvidence) {
          return createCommandFailure(
            command,
            'permission-denied',
            'Preview evidence reads require the Preview evidence permission.'
          )
        }

        {
          const result = controller.getPreviewEvidence()
          if (!result.ok) {
            return createCommandFailure(command, result.error.code, result.error.message)
          }

          controller.recordActivity(command)

          return createCommandSuccess(command, result.evidence)
        }
      case 'getSessionState':
        return readCommand('getSessionState', () => ({
          sessionId: session.id,
          status: 'active',
          startedAt: session.startedAt,
          permissions: { ...controller.getPermissions() },
          readScope: 'arcade-session',
          commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
        }))
      case 'applySourceChange':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.applySourceChange(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
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
    routeCommand,
  }
}

export const createAgentBridge = (
  session: AgentBridgeSession,
  controller: AgentBridgeController
): AgentBridge => {
  const router = createAgentBridgeCommandRouter(session, controller)

  return {
    version: router.version,
    sessionId: router.sessionId,
    status: router.status,
    startedAt: router.startedAt,
    get permissions() {
      return router.permissions
    },
    readScope: router.readScope,
    commandNames: [...router.commandNames],
    getProject: () => router.routeCommand('getProject'),
    getPreviewContext: () => router.routeCommand('getPreviewContext'),
    getDiagnostics: () => router.routeCommand('getDiagnostics'),
    getPreviewEvidence: () => router.routeCommand('getPreviewEvidence'),
    getSessionState: () => router.routeCommand('getSessionState'),
    applySourceChange: (request) => router.routeCommand('applySourceChange', request),
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

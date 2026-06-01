import type { ThemeMode } from '@/contexts/SettingsContext'
import type { ViewportSize } from '@/types/project'
import { clonePreviewDiagnostics, type PreviewDiagnostics } from '@/services/previewDiagnostics'
import type { PreviewEvidence, PreviewEvidenceCaptureResult } from '@/services/previewEvidence'
import type { DesktopAgentTransportEndpoint } from '@/services/desktopAgentSessionCoordinator'

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
  transportEndpoint?: DesktopAgentTransportEndpoint
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

export interface AgentChangeRequest {
  summary: string
  jsxCode?: string
  hooksCode?: string
  viewportSize?: ViewportSize
  theme?: ThemeMode
  name?: string
}

export interface AgentChangeResult {
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

export const AGENT_BRIDGE_PROTOCOL_VERSION = 2

export const AGENT_BRIDGE_COMMAND_NAMES = [
  'getAgentInstructions',
  'getProject',
  'getPreviewContext',
  'getDiagnostics',
  'getPreviewEvidence',
  'getSessionState',
  'applyAgentChange',
] as const

export type AgentBridgeCommandName = (typeof AGENT_BRIDGE_COMMAND_NAMES)[number]

export const AGENT_BRIDGE_READ_COMMAND_NAMES = [
  'getAgentInstructions',
  'getProject',
  'getPreviewContext',
  'getDiagnostics',
  'getPreviewEvidence',
  'getSessionState',
] as const

export type AgentBridgeReadCommandName = (typeof AGENT_BRIDGE_READ_COMMAND_NAMES)[number]

export interface AgentSessionReadState {
  version: typeof AGENT_BRIDGE_PROTOCOL_VERSION
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
}

export interface AgentInstructionsPayload {
  version: typeof AGENT_BRIDGE_PROTOCOL_VERSION
  instructionsMarkdown: string
  sessionId: string
  startedAt: string
  endpoint: string
  authorizationHeader: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
  protocol: {
    transport: 'desktop-loopback-http'
    format: 'json-rpc-2.0'
    contentType: 'application/json'
    authorizationHeaderName: 'Authorization'
  }
  arcadeAuthoringContract: {
    summary: string
    rules: readonly string[]
    supportedCopiedOutImports: readonly string[]
  }
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
  | AgentBridgeCommandResult<AgentInstructionsPayload>
  | AgentBridgeCommandResult<AgentProjectReadState>
  | AgentBridgeCommandResult<AgentPreviewReadState>
  | AgentBridgeCommandResult<PreviewDiagnostics>
  | AgentBridgeCommandResult<PreviewEvidence>
  | AgentBridgeCommandResult<AgentSessionReadState>
  | AgentBridgeCommandResult<AgentChangeResult>
  | AgentBridgeCommandFailure<string>

export interface AgentBridgeController {
  getReadContext: () => AgentBridgeReadContext
  getPermissions: () => AgentPermissions
  isSessionActive: () => boolean
  recordActivity: (command: AgentBridgeCommandName) => void
  applyAgentChange: (request: unknown) => AgentBridgeCommandResult<AgentChangeResult>
  getPreviewEvidence: () => PreviewEvidenceCaptureResult
}

export interface AgentBridgeCommandRouter {
  version: typeof AGENT_BRIDGE_PROTOCOL_VERSION
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
  routeCommand(command: 'getAgentInstructions'): AgentBridgeCommandResult<AgentInstructionsPayload>
  routeCommand(command: 'getProject'): AgentBridgeCommandResult<AgentProjectReadState>
  routeCommand(command: 'getPreviewContext'): AgentBridgeCommandResult<AgentPreviewReadState>
  routeCommand(command: 'getDiagnostics'): AgentBridgeCommandResult<PreviewDiagnostics>
  routeCommand(command: 'getPreviewEvidence'): AgentBridgeCommandResult<PreviewEvidence>
  routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  routeCommand(
    command: 'applyAgentChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentChangeResult>
  routeCommand(command: string, request?: unknown): AgentBridgeRoutedCommandResult
}

export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  sourceChanges: true,
  previewSettings: true,
  previewEvidence: true,
  projectMetadata: true,
}

export const isAgentBridgeCommandName = (command: string): command is AgentBridgeCommandName =>
  AGENT_BRIDGE_COMMAND_NAMES.some((supportedCommand) => supportedCommand === command)

export const isAgentBridgeReadCommandName = (
  command: string
): command is AgentBridgeReadCommandName =>
  AGENT_BRIDGE_READ_COMMAND_NAMES.some((supportedCommand) => supportedCommand === command)

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

const SUPPORTED_COPIED_OUT_IMPORTS = [
  'react',
  '@navikt/ds-react',
  '@navikt/ds-react/Theme',
  '@navikt/aksel-icons',
  '@navikt/ds-css',
  './hooks',
] as const

const ARCADE_AUTHORING_CONTRACT_RULES = [
  'Work with import-free Arcade JSX and Hooks code.',
  'Keep source changes within the active Arcade project.',
  'Use preview diagnostics and Preview evidence to validate visible results after changes.',
  'Do not read share payloads, export data, browser storage, clipboard data, cookies, or unrelated page state.',
] as const

const ARCADE_AUTHORING_CONTRACT_SUMMARY =
  'Author only the active Arcade project through the Agent bridge: import-free JSX and Hooks source, preview settings, and permitted metadata.'

const createAgentInstructionsMarkdown = (): string =>
  [
    'Aksel Arcade Agent operating guide',
    '1. Treat this returned guide as authoritative for this active Desktop Arcade Agent session.',
    '2. Call getProject first, then use getPreviewContext and getSessionState when you need preview or session state.',
    '3. Author import-free Arcade JSX and Hooks only; do not edit files or add imports inside Arcade source.',
    '4. Use getDiagnostics for compile/runtime status and getPreviewEvidence only for permitted sandbox Preview evidence.',
    '5. Submit full-field replacements with applyAgentChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? }).',
    '6. Accepted Agent changes apply immediately to the human-visible Arcade project.',
    '7. After each change, poll getDiagnostics until the preview settles to idle or reports an error.',
    '8. When diagnostics are idle and permission allows, use Preview evidence to validate the visible result.',
    '9. Do not read active source from share payloads, Arcade project packages, repository docs, browser storage, clipboard, cookies, unrelated page state, or host UI.',
  ].join('\n')

const createAgentInstructionsPayload = (
  session: AgentBridgeSession,
  transportEndpoint: DesktopAgentTransportEndpoint,
  permissions: AgentPermissions
): AgentInstructionsPayload => ({
  version: AGENT_BRIDGE_PROTOCOL_VERSION,
  instructionsMarkdown: createAgentInstructionsMarkdown(),
  sessionId: session.id,
  startedAt: session.startedAt,
  endpoint: transportEndpoint.endpoint,
  authorizationHeader: transportEndpoint.authorizationHeader,
  permissions: { ...permissions },
  readScope: 'arcade-session',
  commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
  protocol: {
    transport: 'desktop-loopback-http',
    format: 'json-rpc-2.0',
    contentType: 'application/json',
    authorizationHeaderName: 'Authorization',
  },
  arcadeAuthoringContract: {
    summary: ARCADE_AUTHORING_CONTRACT_SUMMARY,
    rules: [...ARCADE_AUTHORING_CONTRACT_RULES],
    supportedCopiedOutImports: [...SUPPORTED_COPIED_OUT_IMPORTS],
  },
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

  function routeCommand(
    command: 'getAgentInstructions'
  ): AgentBridgeCommandResult<AgentInstructionsPayload>
  function routeCommand(command: 'getProject'): AgentBridgeCommandResult<AgentProjectReadState>
  function routeCommand(
    command: 'getPreviewContext'
  ): AgentBridgeCommandResult<AgentPreviewReadState>
  function routeCommand(command: 'getDiagnostics'): AgentBridgeCommandResult<PreviewDiagnostics>
  function routeCommand(command: 'getPreviewEvidence'): AgentBridgeCommandResult<PreviewEvidence>
  function routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  function routeCommand(
    command: 'applyAgentChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentChangeResult>
  function routeCommand(command: string, request?: unknown): AgentBridgeRoutedCommandResult {
    if (!isAgentBridgeCommandName(command)) {
      return createUnsupportedCommandFailure(command)
    }

    switch (command) {
      case 'getAgentInstructions':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        if (!session.transportEndpoint) {
          return createCommandFailure(
            command,
            'invalid-request',
            'Agent instructions require an active Desktop Agent transport endpoint.'
          )
        }

        {
          const permissions = controller.getPermissions()
          controller.recordActivity(command)

          return createCommandSuccess(
            command,
            createAgentInstructionsPayload(session, session.transportEndpoint, permissions)
          )
        }
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
        return readCommand(
          'getSessionState',
          (): AgentSessionReadState => ({
            version: AGENT_BRIDGE_PROTOCOL_VERSION,
            sessionId: session.id,
            status: 'active',
            startedAt: session.startedAt,
            permissions: { ...controller.getPermissions() },
            readScope: 'arcade-session',
            commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
          })
        )
      case 'applyAgentChange':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.applyAgentChange(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
    }
  }

  return {
    version: AGENT_BRIDGE_PROTOCOL_VERSION,
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

const GET_AGENT_INSTRUCTIONS_JSON_RPC_REQUEST =
  '{"jsonrpc":"2.0","id":"agent-instructions-1","method":"getAgentInstructions"}'

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

export const createAgentPairingHandoffCommand = (
  transportEndpoint: DesktopAgentTransportEndpoint
): string =>
  [
    'curl',
    '-sS',
    '-X',
    'POST',
    shellQuote(transportEndpoint.endpoint),
    '-H',
    shellQuote(`Authorization: ${transportEndpoint.authorizationHeader}`),
    '-H',
    shellQuote('Content-Type: application/json'),
    '--data',
    shellQuote(GET_AGENT_INSTRUCTIONS_JSON_RPC_REQUEST),
  ].join(' ')

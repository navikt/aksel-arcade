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

export interface AgentSourceChangeRequest {
  summary: string
  jsxCode?: string
  hooksCode?: string
  viewportSize?: ViewportSize
  theme?: ThemeMode
  name?: string
}

export interface AgentSourceChangeResult {
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
  'getAgentInstructions',
  'getProject',
  'getPreviewContext',
  'getDiagnostics',
  'getPreviewEvidence',
  'getSessionState',
  'applySourceChange',
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
  sessionId: string
  status: 'active'
  startedAt: string
  permissions: AgentPermissions
  readScope: 'arcade-session'
  commandNames: readonly AgentBridgeCommandName[]
}

export interface AgentInstructionsPayload {
  version: 1
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
  routeCommand(command: 'getAgentInstructions'): AgentBridgeCommandResult<AgentInstructionsPayload>
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

const createAgentInstructionsMarkdown = (
  session: AgentBridgeSession,
  transportEndpoint: DesktopAgentTransportEndpoint,
  permissions: AgentPermissions
): string => {
  const permissionLines = Object.entries(permissions).map(
    ([key, value]) => `- ${key}: ${value ? 'true' : 'false'}`
  )

  return [
    'Aksel Arcade Agent pairing handoff',
    '',
    `Session id: ${session.id}`,
    `Started at: ${session.startedAt}`,
    '',
    'Use this active Desktop Arcade Agent session only. Send JSON-RPC 2.0 POST requests to the endpoint with Content-Type: application/json and the Authorization header below.',
    `Endpoint: ${transportEndpoint.endpoint}`,
    `Authorization: ${transportEndpoint.authorizationHeader}`,
    `Supported command names: ${AGENT_BRIDGE_COMMAND_NAMES.join(', ')}`,
    '',
    'Read Arcade-scoped state with getProject, getPreviewContext, getDiagnostics, getPreviewEvidence, and getSessionState. Submit allowed changes with applySourceChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? }).',
    'After changes, poll getDiagnostics until the preview is idle or reports an error, then use Preview evidence for visual validation when permitted.',
    '',
    'Active permission state:',
    ...permissionLines,
    '',
    'Read scope: arcade-session. Do not read project packages, share payloads, browser storage, clipboard data, cookies, unrelated page state, or host application UI state.',
    '',
    'Arcade authoring contract summary:',
    ARCADE_AUTHORING_CONTRACT_SUMMARY,
    ...ARCADE_AUTHORING_CONTRACT_RULES.map((rule) => `- ${rule}`),
  ].join('\n')
}

const createAgentInstructionsPayload = (
  session: AgentBridgeSession,
  transportEndpoint: DesktopAgentTransportEndpoint,
  permissions: AgentPermissions
): AgentInstructionsPayload => ({
  version: 1,
  instructionsMarkdown: createAgentInstructionsMarkdown(session, transportEndpoint, permissions),
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
    command: 'applySourceChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentSourceChangeResult>
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
            sessionId: session.id,
            status: 'active',
            startedAt: session.startedAt,
            permissions: { ...controller.getPermissions() },
            readScope: 'arcade-session',
            commandNames: [...AGENT_BRIDGE_COMMAND_NAMES],
          })
        )
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

export const createAgentInstructions = (
  permissions: AgentPermissions,
  transportEndpoint?: DesktopAgentTransportEndpoint
): string => {
  const permissionLines = Object.entries(permissions).map(
    ([key, value]) => `- ${key}: ${value ? 'true' : 'false'}`
  )
  const transportLines = transportEndpoint
    ? [
        '',
        'Desktop loopback JSON-RPC transport:',
        `Endpoint: ${transportEndpoint.endpoint}`,
        `Authorization: ${transportEndpoint.authorizationHeader}`,
        'Send JSON-RPC 2.0 POST requests with Content-Type: application/json and the Authorization header above.',
        `Supported JSON-RPC methods: ${AGENT_BRIDGE_COMMAND_NAMES.join(', ')}.`,
        `Full Agent bridge command names: ${AGENT_BRIDGE_COMMAND_NAMES.join(', ')}.`,
        'Read example:',
        `curl -sS -X POST '${transportEndpoint.endpoint}' \\`,
        `  -H 'Authorization: ${transportEndpoint.authorizationHeader}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  --data '{"jsonrpc":"2.0","id":"agent-request-1","method":"getProject","params":{}}'`,
        'Change example:',
        `curl -sS -X POST '${transportEndpoint.endpoint}' \\`,
        `  -H 'Authorization: ${transportEndpoint.authorizationHeader}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  --data '{"jsonrpc":"2.0","id":"agent-request-2","method":"applySourceChange","params":{"summary":"Describe the change","jsxCode":"export default function App() { return <Heading>Agent update</Heading> }"}}'`,
        'Do not put the credential in the URL or query parameters; those requests are rejected.',
        '',
        'Provider-neutral usage examples:',
        '- GitHub Copilot app: paste these instructions into the agent conversation after Agent access is active, then ask it to call the JSON-RPC endpoint with the Authorization header.',
        '- Copilot CLI: paste these instructions into a local CLI session so it can read Arcade-scoped state and submit validated Agent changes through the endpoint.',
        '- Copilot in VS Code: paste these instructions into chat for the current workspace and ask it to use the same JSON-RPC method names and Authorization header.',
        '- Other same-device External agents: use the endpoint, Authorization header, and method names above without any provider-specific SDK.',
      ]
    : []

  return [
    'Aksel Arcade external-agent instructions',
    '',
    'Agent access is available only in Desktop Arcade. The human must start temporary Agent access and copy the Desktop loopback JSON-RPC handoff before an external agent can connect.',
    '',
    `Currently available command names: ${AGENT_BRIDGE_COMMAND_NAMES.map((command) => `${command}()`).join(', ')}`,
    'Use getDiagnostics() to read preview status, compile errors, runtime errors, and bounded sandbox console messages after changes.',
    'Use getPreviewEvidence() to read permission-gated, sanitized layout evidence from only the sandboxed Preview frame.',
    'To replace allowed fields, call applySourceChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? }). A non-empty human-readable summary is required. Accepted changes apply immediately as normal Arcade project edits.',
    'After applySourceChange() returns ok, treat immediate Preview evidence as provisional: poll getDiagnostics() until status is no longer "transpiling" or "rendering" before final visual validation.',
    'When diagnostics settle to "idle", read getPreviewEvidence() to validate the visible result. When status is "error", read diagnostics again for compile/runtime details instead.',
    ...transportLines,
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

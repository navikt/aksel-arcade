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

export interface ArcadeAuthoringGuidanceSnippet {
  id: string
  description: string
  code: string
}

export interface ArcadeAuthoringGuidancePayload {
  summary: string
  rules: readonly string[]
  validationChecklist: readonly string[]
  snippets: readonly ArcadeAuthoringGuidanceSnippet[]
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
  arcadeAuthoringGuidance: ArcadeAuthoringGuidancePayload
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

export type AgentBridgeMaybeAsyncRoutedCommandResult =
  | AgentBridgeRoutedCommandResult
  | Promise<AgentBridgeRoutedCommandResult>

export interface AgentBridgeController {
  getReadContext: () => AgentBridgeReadContext
  getPermissions: () => AgentPermissions
  isSessionActive: () => boolean
  recordActivity: (command: AgentBridgeCommandName) => void
  applyAgentChange: (request: unknown) => AgentBridgeCommandResult<AgentChangeResult>
  getPreviewEvidence: () => Promise<PreviewEvidenceCaptureResult>
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
  routeCommand(command: 'getPreviewEvidence'): Promise<AgentBridgeCommandResult<PreviewEvidence>>
  routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  routeCommand(
    command: 'applyAgentChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentChangeResult>
  routeCommand(command: string, request?: unknown): AgentBridgeMaybeAsyncRoutedCommandResult
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

const ARCADE_AUTHORING_GUIDANCE_SUMMARY =
  'Produce Aksel-valid Arcade JSX: use injected Aksel components, layout primitives, props, icons, and --ax tokens before native HTML or custom CSS fallbacks.'

const ARCADE_AUTHORING_GUIDANCE_RULES = [
  'For static pages, write a bare JSX root such as <Page>...</Page>; do not wrap static source in a component unless needed.',
  'When local JavaScript is needed before returning JSX, wrap the page in an IIFE expression; use the Hooks tab for reusable hooks.',
  'Arcade source is import-free: convert normal Aksel examples by removing imports and relying on injected React, Aksel components, Aksel icons, and supported hooks.',
  'Aksel component props are safe and expected in Arcade source; do not replace Aksel components with prop-free native HTML or CSS because of a generic diagnostics error.',
  'Use Aksel layout and content components first: Page, Page.Block, Box, VStack, HStack, HGrid, Heading, BodyLong, BodyShort, GuidePanel, List, Accordion, Checkbox, Button, Link, Tag, and Aksel icons when they match the UI.',
  'Native elements are acceptable for semantic wrappers/content, inline artwork, or asChild composition, but not as replacements for available Aksel components.',
  'Keep custom CSS small and scoped to gaps after Aksel components, props, and tokens; use --ax design tokens for colors, spacing, borders, and typography.',
] as const

const ARCADE_AUTHORING_GUIDANCE_CHECKLIST = [
  'The main UI is expressed with Aksel components/primitives rather than native HTML/CSS mimicry.',
  'Aksel props are used directly where they describe spacing, layout, typography, variants, icons, or responsive behavior.',
  'Native elements and custom CSS are limited to wrappers, content, artwork, or details not covered by Aksel APIs.',
  'Diagnostics are checked after applying, and Preview evidence is used when permitted to validate visible results.',
] as const

const ARCADE_AUTHORING_GUIDANCE_SNIPPETS: readonly ArcadeAuthoringGuidanceSnippet[] = [
  {
    id: 'static-page',
    description: 'Preferred shape for a static Arcade page.',
    code: `<Page>
  <Page.Block width="text" gutters>
    <VStack as="main" gap="space-32">
      <Heading level="1" size="xlarge">
        Page title
      </Heading>
      <BodyLong>Page introduction.</BodyLong>
    </VStack>
  </Page.Block>
</Page>`,
  },
  {
    id: 'iife-page',
    description: 'Preferred shape when local JavaScript is needed before returning JSX.',
    code: `(() => {
  const items = ["First item", "Second item"];

  return (
    <VStack gap="space-16">
      <List>
        {items.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
    </VStack>
  );
})()`,
  },
] as const

const createAgentInstructionsMarkdown = (): string =>
  [
    'Aksel Arcade Agent operating guide',
    '1. Treat this returned guide as authoritative for this active Desktop Arcade Agent session.',
    '2. Call getProject first, then use getPreviewContext and getSessionState when you need preview or session state.',
    '3. Author import-free Arcade JSX and Hooks only; do not edit files or add imports inside Arcade source.',
    '4. When changing source, follow the returned arcadeAuthoringGuidance before applying.',
    '5. Use getDiagnostics for compile/runtime status and getPreviewEvidence only for permitted sandbox Preview evidence.',
    '6. Submit full-field replacements with applyAgentChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? }).',
    '7. Accepted Agent changes apply immediately to the human-visible Arcade project.',
    '8. After each change, poll getDiagnostics until the preview settles to idle or reports an error.',
    '9. When diagnostics are idle and permission allows, use Preview evidence to validate the visible result.',
    '10. Do not read active source from share payloads, Arcade project packages, repository docs, browser storage, clipboard, cookies, unrelated page state, or host UI.',
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
  arcadeAuthoringGuidance: {
    summary: ARCADE_AUTHORING_GUIDANCE_SUMMARY,
    rules: [...ARCADE_AUTHORING_GUIDANCE_RULES],
    validationChecklist: [...ARCADE_AUTHORING_GUIDANCE_CHECKLIST],
    snippets: ARCADE_AUTHORING_GUIDANCE_SNIPPETS.map((snippet) => ({ ...snippet })),
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

  const routePreviewEvidenceCommand = async (): Promise<
    AgentBridgeCommandResult<PreviewEvidence>
  > => {
    const command = 'getPreviewEvidence'
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

    const result = await controller.getPreviewEvidence()
    if (!result.ok) {
      return createCommandFailure(command, result.error.code, result.error.message)
    }

    controller.recordActivity(command)

    return createCommandSuccess(command, result.evidence)
  }

  function routeCommand(
    command: 'getAgentInstructions'
  ): AgentBridgeCommandResult<AgentInstructionsPayload>
  function routeCommand(command: 'getProject'): AgentBridgeCommandResult<AgentProjectReadState>
  function routeCommand(
    command: 'getPreviewContext'
  ): AgentBridgeCommandResult<AgentPreviewReadState>
  function routeCommand(command: 'getDiagnostics'): AgentBridgeCommandResult<PreviewDiagnostics>
  function routeCommand(
    command: 'getPreviewEvidence'
  ): Promise<AgentBridgeCommandResult<PreviewEvidence>>
  function routeCommand(command: 'getSessionState'): AgentBridgeCommandResult<AgentSessionReadState>
  function routeCommand(
    command: 'applyAgentChange',
    request: unknown
  ): AgentBridgeCommandResult<AgentChangeResult>
  function routeCommand(
    command: string,
    request?: unknown
  ): AgentBridgeMaybeAsyncRoutedCommandResult {
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
        return routePreviewEvidenceCommand()
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

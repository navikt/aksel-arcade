import type { ThemeMode } from '@/contexts/SettingsContext'
import type { ArcadePageId, Project, ProjectSourceTarget, ViewportSize } from '@/types/project'
import { getActivePage, getStartPage } from '@/services/projectSource'
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

export type AgentProjectPageMode = 'single-page' | 'multi-page'

export interface AgentSourceFileReadState {
  jsxCode: string
  hooksCode: string
}

export interface AgentProjectPageReadState extends AgentSourceFileReadState {
  id: ArcadePageId
  name: string
}

export interface AgentProjectReadState extends AgentSourceFileReadState {
  name: string
  pageMode: AgentProjectPageMode
  globalConfig: AgentSourceFileReadState
  pages: AgentProjectPageReadState[]
  startPageId: ArcadePageId
  activePageId: ArcadePageId
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
export type AgentSourceTarget = ProjectSourceTarget

export interface AgentChangeRequest {
  summary: string
  target?: AgentSourceTarget
  jsxCode?: string
  hooksCode?: string
  viewportSize?: ViewportSize
  theme?: ThemeMode
  name?: string
}

export interface AgentChangeResult {
  changedFields: AgentChangeField[]
}

export interface AgentCreatePageResult {
  pageId: ArcadePageId
}

export interface AgentPageLifecycleResult {
  pageId: ArcadePageId
}

export type AgentBridgeErrorCode =
  | 'session-revoked'
  | 'permission-denied'
  | 'invalid-request'
  | 'unsupported-field'
  | 'unsupported-command'
  | 'payload-too-large'
  | 'preview-unavailable'

export const AGENT_BRIDGE_PROTOCOL_VERSION = 3

export const AGENT_BRIDGE_PAGE_LIFECYCLE_COMMAND_NAMES = [
  'createPage',
  'renamePage',
  'deletePage',
  'setStartPage',
  'selectActivePage',
] as const

export type AgentBridgePageLifecycleCommandName =
  (typeof AGENT_BRIDGE_PAGE_LIFECYCLE_COMMAND_NAMES)[number]

export const AGENT_BRIDGE_COMMAND_NAMES = [
  'getAgentInstructions',
  'getProject',
  'getPreviewContext',
  'getDiagnostics',
  'getPreviewEvidence',
  'getSessionState',
  'applyAgentChange',
  ...AGENT_BRIDGE_PAGE_LIFECYCLE_COMMAND_NAMES,
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

export const AGENT_BRIDGE_BASE_COMMAND_NAMES = [
  ...AGENT_BRIDGE_READ_COMMAND_NAMES,
  'applyAgentChange',
] as const satisfies readonly AgentBridgeCommandName[]

export const getAgentBridgeSessionCommandNames = (
  pageMode: AgentProjectPageMode
): readonly AgentBridgeCommandName[] =>
  pageMode === 'multi-page'
    ? [...AGENT_BRIDGE_COMMAND_NAMES]
    : [...AGENT_BRIDGE_BASE_COMMAND_NAMES]

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
  | AgentBridgeCommandResult<AgentCreatePageResult>
  | AgentBridgeCommandResult<AgentPageLifecycleResult>
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
  createPage: (request?: unknown) => AgentBridgeCommandResult<AgentCreatePageResult>
  renamePage: (request: unknown) => AgentBridgeCommandResult<AgentPageLifecycleResult>
  deletePage: (request: unknown) => AgentBridgeCommandResult<AgentPageLifecycleResult>
  setStartPage: (request: unknown) => AgentBridgeCommandResult<AgentPageLifecycleResult>
  selectActivePage: (request: unknown) => AgentBridgeCommandResult<AgentPageLifecycleResult>
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
  routeCommand(
    command: 'createPage',
    request?: unknown
  ): AgentBridgeCommandResult<AgentCreatePageResult>
  routeCommand(
    command: 'renamePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  routeCommand(
    command: 'deletePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  routeCommand(
    command: 'setStartPage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  routeCommand(
    command: 'selectActivePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
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

const EMPTY_AGENT_SOURCE_FILE: AgentSourceFileReadState = {
  jsxCode: '',
  hooksCode: '',
}

const createAgentSourceFileReadState = (source: {
  jsx: string
  hooks: string
}): AgentSourceFileReadState => ({
  jsxCode: source.jsx,
  hooksCode: source.hooks,
})

const cloneAgentSourceFileReadState = (
  source: AgentSourceFileReadState
): AgentSourceFileReadState => ({
  jsxCode: source.jsxCode,
  hooksCode: source.hooksCode,
})

const createAgentProjectPageReadState = (page: ReturnType<typeof getActivePage>): AgentProjectPageReadState => ({
  id: page.id,
  name: page.name,
  jsxCode: page.source.jsx,
  hooksCode: page.source.hooks,
})

export const cloneAgentProjectReadState = (
  project: AgentProjectReadState
): AgentProjectReadState => ({
  name: project.name,
  pageMode: project.pageMode,
  jsxCode: project.jsxCode,
  hooksCode: project.hooksCode,
  globalConfig: cloneAgentSourceFileReadState(project.globalConfig),
  pages: project.pages.map((page) => ({
    id: page.id,
    name: page.name,
    jsxCode: page.jsxCode,
    hooksCode: page.hooksCode,
  })),
  startPageId: project.startPageId,
  activePageId: project.activePageId,
})

export const createAgentProjectReadState = (
  project: Project,
  multiPageEnabled: boolean
): AgentProjectReadState => {
  const activePage = getActivePage(project)

  if (!multiPageEnabled) {
    const exposedPage = createAgentProjectPageReadState(activePage)

    return {
      name: project.name,
      pageMode: 'single-page',
      jsxCode: exposedPage.jsxCode,
      hooksCode: exposedPage.hooksCode,
      globalConfig: cloneAgentSourceFileReadState(EMPTY_AGENT_SOURCE_FILE),
      pages: [exposedPage],
      startPageId: exposedPage.id,
      activePageId: exposedPage.id,
    }
  }

  const startPage = getStartPage(project)

  return {
    name: project.name,
    pageMode: 'multi-page',
    jsxCode: activePage.source.jsx,
    hooksCode: activePage.source.hooks,
    globalConfig: createAgentSourceFileReadState(project.source.globalConfig),
    pages: project.source.pages.map(createAgentProjectPageReadState),
    startPageId: startPage.id,
    activePageId: activePage.id,
  }
}

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
  'For multi-page prototypes, navigate with goToPage("pageNN") or Aksel Link/LinkCard href/to values that equal a stable page id.',
  'Treat page ids as app-assigned stable references: never invent, renumber, or rename page ids manually in source.',
  'Global config is shared code only: define shared helpers/components there, and do not treat it as a renderable page.',
  'Use the injected read-only currentPageId when shared navigation or chrome needs to know which page is active.',
  'If a page id becomes stale after deletion, replace it with a current page id instead of suppressing the warning.',
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

const createAgentInstructionsMarkdown = (
  project: AgentProjectReadState,
  commandNames: readonly AgentBridgeCommandName[]
): string => {
  const lines = [
    'Aksel Arcade Agent operating guide',
    '1. Treat this returned guide as authoritative for this active Desktop Arcade Agent session.',
    `2. Call getProject first, then use getPreviewContext and getSessionState when you need preview or session state; this session currently exposes ${project.pageMode} authoring.`,
    '3. Author import-free Arcade JSX and Hooks only; do not edit files or add imports inside Arcade source.',
    '4. When changing source, follow the returned arcadeAuthoringGuidance before applying.',
    '5. Use getDiagnostics for compile/runtime status and getPreviewEvidence only for permitted sandbox Preview evidence.',
  ]

  if (commandNames.includes('createPage')) {
    lines.push(
      '6. Use createPage, renamePage, deletePage, setStartPage, and selectActivePage for page lifecycle changes.',
      '7. Submit full-field replacements with applyAgentChange({ summary, target, jsxCode?, hooksCode?, viewportSize?, theme?, name? }).',
      '8. Set target to { type: "page", pageId } for a page or { type: "global-config" } for shared code.',
      '9. Accepted Agent changes apply immediately to the human-visible Arcade project.',
      '10. After each change, poll getDiagnostics until the preview settles to idle or reports an error.',
      '11. When diagnostics are idle and permission allows, use Preview evidence to validate the visible result.',
      '12. Do not read active source from share payloads, Arcade project packages, repository docs, browser storage, clipboard, cookies, unrelated page state, or host UI.'
    )
  } else {
    lines.push(
      '6. Multi-page authoring is disabled for this session; ask the human to enable experimental multi-page authoring before creating pages, targeting other pages, or editing Global config.',
      '7. Submit full-field replacements with applyAgentChange({ summary, target, jsxCode?, hooksCode?, viewportSize?, theme?, name? }) only against the currently exposed single page.',
      '8. Accepted Agent changes apply immediately to the human-visible Arcade project.',
      '9. After each change, poll getDiagnostics until the preview settles to idle or reports an error.',
      '10. When diagnostics are idle and permission allows, use Preview evidence to validate the visible result.',
      '11. Do not read active source from share payloads, Arcade project packages, repository docs, browser storage, clipboard, cookies, unrelated page state, or host UI.'
    )
  }

  return lines.join('\n')
}

const createAgentInstructionsPayload = (
  session: AgentBridgeSession,
  transportEndpoint: DesktopAgentTransportEndpoint,
  permissions: AgentPermissions,
  project: AgentProjectReadState,
  commandNames: readonly AgentBridgeCommandName[]
): AgentInstructionsPayload => ({
  version: AGENT_BRIDGE_PROTOCOL_VERSION,
  instructionsMarkdown: createAgentInstructionsMarkdown(project, commandNames),
  sessionId: session.id,
  startedAt: session.startedAt,
  endpoint: transportEndpoint.endpoint,
  authorizationHeader: transportEndpoint.authorizationHeader,
  permissions: { ...permissions },
  readScope: 'arcade-session',
  commandNames: [...commandNames],
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
  const getSessionCommandNames = (): readonly AgentBridgeCommandName[] =>
    getAgentBridgeSessionCommandNames(controller.getReadContext().project.pageMode)

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
    command: 'createPage',
    request?: unknown
  ): AgentBridgeCommandResult<AgentCreatePageResult>
  function routeCommand(
    command: 'renamePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  function routeCommand(
    command: 'deletePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  function routeCommand(
    command: 'setStartPage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  function routeCommand(
    command: 'selectActivePage',
    request: unknown
  ): AgentBridgeCommandResult<AgentPageLifecycleResult>
  function routeCommand(
    command: string,
    request?: unknown
  ): AgentBridgeMaybeAsyncRoutedCommandResult {
    if (!isAgentBridgeCommandName(command)) {
      return createUnsupportedCommandFailure(command)
    }

    const sessionCommandNames = getSessionCommandNames()
    if (!sessionCommandNames.includes(command)) {
      return createCommandFailure(
        command,
        'unsupported-command',
        `Agent bridge command "${command}" is unavailable while multi-page authoring is disabled for this session. Ask the human to enable experimental multi-page authoring. Supported commands: ${sessionCommandNames.join(
          ', '
        )}.`
      )
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
          const project = controller.getReadContext().project
          controller.recordActivity(command)

          return createCommandSuccess(
            command,
            createAgentInstructionsPayload(
              session,
              session.transportEndpoint,
              permissions,
              project,
              sessionCommandNames
            )
          )
        }
      case 'getProject':
        return readCommand('getProject', () =>
          cloneAgentProjectReadState(controller.getReadContext().project)
        )
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
            commandNames: [...getSessionCommandNames()],
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
      case 'createPage':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.createPage(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
      case 'renamePage':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.renamePage(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
      case 'deletePage':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.deletePage(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
      case 'setStartPage':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.setStartPage(request)
          if (result.ok) {
            controller.recordActivity(command)
          }

          return result
        }
      case 'selectActivePage':
        if (!controller.isSessionActive()) {
          return createSessionRevokedFailure(command)
        }

        {
          const result = controller.selectActivePage(request)
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
    get commandNames() {
      return [...getSessionCommandNames()]
    },
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

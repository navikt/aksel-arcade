import path from 'node:path'
import { createRequire } from 'node:module'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ErrorCode, McpError, type ReadResourceResult, type Resource } from '@modelcontextprotocol/sdk/types.js'
import type {
  DesktopMcpPreviewCaptureResource,
  DesktopMcpPreviewCaptureSuccess,
} from '../src/services/desktopMcpPreviewCaptureProtocol'
import type {
  DesktopMcpProjectResourceReadFailure,
  DesktopMcpProjectResourceReadHandler,
  DesktopMcpProjectResourceReadResult,
} from '../src/services/desktopMcpProjectResourceProtocol'
import {
  AKSEL_COMPONENT_RESOURCE_URI_PREFIX,
  akselComponentResourceUri,
  type DesktopMcpAkselCatalogData,
  type DesktopMcpAkselComponentIndexEntry,
  type DesktopMcpAkselComponentDetail,
  type DesktopMcpAkselHiddenRootMigrationRule,
} from '../src/shared/desktopMcp/akselCatalog'
import { AKSEL_MCP_CATALOG_DATA } from '../src/shared/desktopMcp/akselCatalogData.generated'

const require = createRequire(__filename)
const desktopRuntimeDir =
  path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname

const { MCP_GUIDANCE_RESOURCE_DEFINITIONS, createMcpGuidanceResourceText } = require(
  path.join(desktopRuntimeDir, 'mcpGuidanceResources.cjs')
) as {
  MCP_GUIDANCE_RESOURCE_DEFINITIONS: readonly DesktopMcpStableResourceDefinition[]
  createMcpGuidanceResourceText: (uri: string) => string | null
}

const DEFAULT_PREVIEW_CAPTURE_TTL_MS = 5 * 60 * 1000
const MAX_PREVIEW_INTERACTION_STEPS = 10
const MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS = 10_000
const MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 5_000
const MAX_AKSEL_COMPONENT_SUGGESTIONS = 5
const MAX_MCP_BODY_BYTES = 1024 * 1024
const PROJECT_PAGE_ID_PATTERN = /^page\d+$/
const PREVIEW_CAPTURE_RESOURCE_URI_PATTERN =
  /^arcade:\/\/preview\/captures\/([a-z0-9-]+)\/(manifest|screenshot|frame|accessibility|dom-layout-style)$/
const AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE = `${AKSEL_COMPONENT_RESOURCE_URI_PREFIX}{name}`
const AKSEL_COMPONENT_RESOURCE_URI_PATTERN = /^arcade:\/\/aksel\/components\/([A-Za-z0-9.%\- ]+)$/
const AKSEL_CATALOG_RESOURCE_URI = 'arcade://aksel/catalog'
const PROJECT_MANIFEST_URI = 'arcade://project/manifest'
const PROJECT_ANNOTATIONS_URI = 'arcade://project/annotations'
const PROJECT_PREVIEW_CONTEXT_URI = 'arcade://project/preview-context'
const PROJECT_DIAGNOSTICS_URI = 'arcade://project/diagnostics'
const PROJECT_SOURCE_GLOBAL_JSX_URI = 'arcade://project/source/global/jsx'
const PROJECT_SOURCE_GLOBAL_HOOKS_URI = 'arcade://project/source/global/hooks'
const DESKTOP_CAPABILITIES_URI = 'arcade://desktop/capabilities'
const DESKTOP_OPERATING_GUIDE_URI = 'arcade://desktop/operating-guide'
const DESKTOP_AUTHORING_GUIDE_URI = 'arcade://desktop/authoring-guide'
const DESKTOP_APPLY_CHANGES_OPERATIONS_URI = 'arcade://desktop/apply-changes-operations'

const CAPABILITY_SOURCE_URI_TEMPLATES = Object.freeze([
  PROJECT_SOURCE_GLOBAL_JSX_URI,
  PROJECT_SOURCE_GLOBAL_HOOKS_URI,
  'arcade://project/source/pages/{pageId}/jsx',
  'arcade://project/source/pages/{pageId}/hooks',
])

const CAPABILITY_PREVIEW_EVIDENCE_URI_TEMPLATES = Object.freeze([
  'arcade://preview/captures/{captureId}/manifest',
  'arcade://preview/captures/{captureId}/screenshot',
  'arcade://preview/captures/{captureId}/frame',
  'arcade://preview/captures/{captureId}/accessibility',
  'arcade://preview/captures/{captureId}/dom-layout-style',
])

const CAPABILITY_PREVIEW_CAPTURE_LAYERS = Object.freeze([
  'screenshot',
  'accessibility',
  'dom_layout_style',
  'frame',
])

const CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES = Object.freeze({
  screenshot: 'visual appearance and spatial gestalt',
  accessibility:
    'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
  dom_layout_style:
    'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
  frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
})

const CAPABILITY_V1_OMISSIONS = Object.freeze([
  'No prompts surface.',
  'No resource subscriptions.',
  'No list-changed notifications.',
  'No general filesystem, network, shell, or clipboard access.',
  'No import, export, Share URL, or Arcade project package tools.',
  'No arbitrary JavaScript execution.',
  'No visual diff API.',
  'No Web Arcade MCP endpoint.',
])

const AKSEL_COMPONENT_USAGE =
  'Import-free, version-matched Arcade snippet. Paste the JSX into a page; if `hooks` is present, put it in the page Hooks tab. Global config `hooks` is only for defining shared custom hooks, helpers, constants, and components, never for top-level hook calls. Do not add import statements.'

interface DesktopMcpStableResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
}

interface DesktopMcpResourceTemplateDefinition {
  name: string
  uriTemplate: string
  description: string
  mimeType: string
  list?: () => Promise<Resource[]>
  read: (resourceUri: string) => Promise<ReadResourceResult>
}

export interface DesktopMcpPreviewCaptureStore {
  store: (captureResult: DesktopMcpPreviewCaptureSuccess) => void
  read: (resourceUri: string) => DesktopMcpPreviewCaptureResource | null
}

export interface DesktopMcpResourceReadSuccess {
  ok: true
  uri: string
  mimeType: string
  text: string
}

export interface DesktopMcpResourceReadFailure {
  ok: false
  code: string
  message: string
  resourceUri: string
}

export type DesktopMcpResourceReadResult =
  | DesktopMcpResourceReadSuccess
  | DesktopMcpResourceReadFailure

export interface DesktopMcpResourceRegistrationOptions {
  host: string
  port: number
  path: string
  serverName: string
  serverVersion: string
  transportLabel: string
  authDescription: string
  readProjectResource: DesktopMcpProjectResourceReadHandler
  previewCaptureStore: DesktopMcpPreviewCaptureStore
  toolNames?: readonly string[]
}

interface DesktopMcpProjectManifestPageEntry {
  id: string
  name: string
  source?: {
    jsx?: { uri?: string }
    hooks?: { uri?: string }
  }
}

interface DesktopMcpProjectManifestPayload {
  activePageId?: string
  globalConfig?: {
    source?: {
      jsx?: { uri?: string }
      hooks?: { uri?: string }
    }
  }
  pages?: DesktopMcpProjectManifestPageEntry[]
}

type AkselCatalogMigrationRule = DesktopMcpAkselHiddenRootMigrationRule
type AkselResolvedMigrationRule = Omit<AkselCatalogMigrationRule, 'target'> & {
  target: DesktopMcpAkselComponentIndexEntry
}

type AkselComponentResolution =
  | {
      kind: 'exact'
      requestedName: string
      matchedName: string
      resourceUri: string
      component: DesktopMcpAkselComponentDetail
    }
  | {
      kind: 'alias'
      requestedName: string
      aliasName: string
      matchedName: string
      resourceUri: string
      component: DesktopMcpAkselComponentDetail
    }
  | {
      kind: 'replacement'
      requestedName: string
      hiddenRootName: string
      reason: string
      replacements: Array<{ name: string; resourceUri: string }>
      migrationRules?: AkselResolvedMigrationRule[]
    }
  | {
      kind: 'did-you-mean'
      requestedName: string
      suggestions: Array<{ name: string; resourceUri: string }>
    }

const ADDITIONAL_STABLE_RESOURCE_DEFINITIONS = Object.freeze([
  {
    uri: DESKTOP_OPERATING_GUIDE_URI,
    name: 'Desktop Arcade MCP operating guide',
    description: 'Short operating instructions for the Desktop Arcade MCP server.',
    mimeType: 'text/markdown',
  },
  {
    uri: DESKTOP_AUTHORING_GUIDE_URI,
    name: 'Desktop Arcade MCP authoring guide',
    description: 'Short Arcade authoring guidance for MCP clients.',
    mimeType: 'text/markdown',
  },
  {
    uri: DESKTOP_CAPABILITIES_URI,
    name: 'Desktop Arcade MCP capabilities',
    description: 'Machine-readable Desktop Arcade MCP contract and omissions.',
    mimeType: 'application/json',
  },
  {
    uri: DESKTOP_APPLY_CHANGES_OPERATIONS_URI,
    name: 'Desktop Arcade apply_changes operations reference',
    description: 'Per-operation field matrix and batch ordering rules for apply_changes.',
    mimeType: 'text/markdown',
  },
  {
    uri: AKSEL_CATALOG_RESOURCE_URI,
    name: 'Aksel component catalog (version-matched)',
    description:
      'On-demand index of Aksel components available in Arcade, each with a snippet-resource URI. Pull one component at a time.',
    mimeType: 'application/json',
  },
  {
    uri: PROJECT_MANIFEST_URI,
    name: 'Active Arcade project manifest',
    description: 'Primary discovery resource for the active Arcade project.',
    mimeType: 'application/json',
  },
  {
    uri: PROJECT_ANNOTATIONS_URI,
    name: 'Active Arcade project annotations',
    description:
      'Project-wide non-dead annotations, including resolved and dismissed history plus per-status counts.',
    mimeType: 'application/json',
  },
  {
    uri: PROJECT_PREVIEW_CONTEXT_URI,
    name: 'Active Arcade project preview context',
    description: 'Saved preview theme and viewport preferences for the active Arcade project.',
    mimeType: 'application/json',
  },
  {
    uri: PROJECT_DIAGNOSTICS_URI,
    name: 'Active Arcade project diagnostics',
    description: 'Compact Arcade-scoped diagnostics for the active Arcade project.',
    mimeType: 'application/json',
  },
  {
    uri: PROJECT_SOURCE_GLOBAL_JSX_URI,
    name: 'Active Arcade global JSX source',
    description: 'Editable JSX source for the active Arcade global config.',
    mimeType: 'text/plain',
  },
  {
    uri: PROJECT_SOURCE_GLOBAL_HOOKS_URI,
    name: 'Active Arcade global Hooks source',
    description: 'Editable Hooks source for the active Arcade global config.',
    mimeType: 'text/plain',
  },
] satisfies readonly DesktopMcpStableResourceDefinition[])

const DESKTOP_RESOURCE_TEMPLATES = Object.freeze([
  {
    name: 'Arcade page JSX source',
    uriTemplate: 'arcade://project/source/pages/{pageId}/jsx',
    description: 'Editable JSX source for an Arcade page.',
    mimeType: 'text/plain',
  },
  {
    name: 'Arcade page Hooks source',
    uriTemplate: 'arcade://project/source/pages/{pageId}/hooks',
    description: 'Editable Hooks source for an Arcade page.',
    mimeType: 'text/plain',
  },
  {
    name: 'Arcade page annotations',
    uriTemplate: 'arcade://project/pages/{pageId}/annotations',
    description: 'Non-dead annotations for one Arcade page.',
    mimeType: 'application/json',
  },
  {
    name: 'Aksel component detail',
    uriTemplate: AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE,
    description: 'Import-free, version-matched component guidance and snippets for one Aksel component.',
    mimeType: 'application/json',
  },
  {
    name: 'Preview capture manifest',
    uriTemplate: 'arcade://preview/captures/{captureId}/manifest',
    description: 'Metadata for one Preview evidence capture.',
    mimeType: 'application/json',
  },
  {
    name: 'Preview capture screenshot',
    uriTemplate: 'arcade://preview/captures/{captureId}/screenshot',
    description: 'Screenshot layer for one Preview evidence capture.',
    mimeType: 'image/png',
  },
  {
    name: 'Preview capture frame metadata',
    uriTemplate: 'arcade://preview/captures/{captureId}/frame',
    description: 'Frame metadata layer for one Preview evidence capture.',
    mimeType: 'application/json',
  },
  {
    name: 'Preview capture accessibility tree',
    uriTemplate: 'arcade://preview/captures/{captureId}/accessibility',
    description: 'Accessibility layer for one Preview evidence capture.',
    mimeType: 'application/json',
  },
  {
    name: 'Preview capture DOM layout style snapshot',
    uriTemplate: 'arcade://preview/captures/{captureId}/dom-layout-style',
    description: 'DOM layout/style layer for one Preview evidence capture.',
    mimeType: 'application/json',
  },
] satisfies readonly Omit<DesktopMcpResourceTemplateDefinition, 'list' | 'read'>[])

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const AKSEL_CATALOG_DATA: DesktopMcpAkselCatalogData = AKSEL_MCP_CATALOG_DATA

export const createDesktopMcpPreviewCaptureStore = (
  ttlMs = DEFAULT_PREVIEW_CAPTURE_TTL_MS
): DesktopMcpPreviewCaptureStore => {
  const captures = new Map<
    string,
    {
      expiresAt: number
      resources: Map<string, DesktopMcpPreviewCaptureResource>
    }
  >()

  const cleanupExpired = () => {
    const now = Date.now()
    for (const [captureId, capture] of captures.entries()) {
      if (capture.expiresAt <= now) {
        captures.delete(captureId)
      }
    }
  }

  return {
    store(captureResult) {
      cleanupExpired()
      captures.set(captureResult.captureId, {
        expiresAt: Date.now() + ttlMs,
        resources: new Map(captureResult.resources.map((resource) => [resource.uri, resource])),
      })
    },
    read(resourceUri) {
      cleanupExpired()
      const match = resourceUri.match(PREVIEW_CAPTURE_RESOURCE_URI_PATTERN)
      if (!match) {
        return null
      }

      const [, captureId] = match
      const capture = captures.get(captureId)
      return capture?.resources.get(resourceUri) ?? null
    },
  }
}

export const readDesktopMcpResource = async (
  uri: string,
  {
    previewCaptureStore,
    readProjectResource,
    stableResourceOptions,
  }: {
    previewCaptureStore: DesktopMcpPreviewCaptureStore
    readProjectResource: DesktopMcpProjectResourceReadHandler
    stableResourceOptions?: DesktopMcpResourceRegistrationOptions
  }
): Promise<DesktopMcpResourceReadResult> => {
  if (PREVIEW_CAPTURE_RESOURCE_URI_PATTERN.test(uri)) {
    const resource = previewCaptureStore.read(uri)
    if (!resource) {
      return {
        ok: false,
        code: 'resource-not-found',
        resourceUri: uri,
        message: `Desktop Arcade MCP resource "${uri}" is unavailable because the Preview capture does not exist or has expired.`,
      }
    }

    return {
      ok: true,
      uri: resource.uri,
      mimeType: resource.mimeType,
      text: resource.text,
    }
  }

  if (isKnownProjectResourceUri(uri)) {
    let resourceResult: DesktopMcpProjectResourceReadResult
    try {
      resourceResult = await readProjectResource({ uri })
    } catch (error) {
      return {
        ok: false,
        code: 'project-unavailable',
        resourceUri: uri,
        message:
          error instanceof Error
            ? error.message
            : `Desktop Arcade MCP resource "${uri}" is unavailable.`,
      }
    }

    if (!isDesktopMcpProjectResourceReadResult(resourceResult, uri)) {
      return {
        ok: false,
        code: 'project-unavailable',
        resourceUri: uri,
        message: `Desktop Arcade MCP resource "${uri}" returned an invalid project resource response.`,
      }
    }

    if (!resourceResult.ok) {
      return {
        ok: false,
        code: resourceResult.code,
        resourceUri: resourceResult.resourceUri,
        message: resourceResult.message,
      }
    }

    return {
      ok: true,
      uri: resourceResult.uri,
      mimeType: resourceResult.mimeType,
      text: resourceResult.text,
    }
  }

  if (stableResourceOptions) {
    try {
      const text = await readStableResourceText(uri, stableResourceOptions)
      const mimeType = [
        ...MCP_GUIDANCE_RESOURCE_DEFINITIONS,
        ...ADDITIONAL_STABLE_RESOURCE_DEFINITIONS,
      ].find((resourceDefinition) => resourceDefinition.uri === uri)?.mimeType

      return {
        ok: true,
        uri,
        mimeType: mimeType ?? 'text/plain',
        text,
      }
    } catch {
      // Fall through to the shared resource-not-found shape below.
    }
  }

  return {
    ok: false,
    code: 'resource-not-found',
    resourceUri: uri,
    message: `Unknown Desktop Arcade MCP resource "${uri}".`,
  }
}

export const registerDesktopMcpResources = (
  server: McpServer,
  options: DesktopMcpResourceRegistrationOptions
) => {
  const stableResources = [
    ...MCP_GUIDANCE_RESOURCE_DEFINITIONS,
    ...ADDITIONAL_STABLE_RESOURCE_DEFINITIONS,
  ]

  for (const resourceDefinition of stableResources) {
    server.registerResource(
      resourceDefinition.name,
      resourceDefinition.uri,
      {
        description: resourceDefinition.description,
        mimeType: resourceDefinition.mimeType,
      },
      async () => {
        const text = await readStableResourceText(resourceDefinition.uri, options)
        return createTextResourceResult(resourceDefinition.uri, resourceDefinition.mimeType, text)
      }
    )
  }

  const templateDefinitions: readonly DesktopMcpResourceTemplateDefinition[] = [
    {
      ...DESKTOP_RESOURCE_TEMPLATES[0],
      list: async () => listProjectSourceResources(options.readProjectResource, 'jsx'),
      read: async (resourceUri) => readProjectResourceAsMcpResult(options.readProjectResource, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[1],
      list: async () => listProjectSourceResources(options.readProjectResource, 'hooks'),
      read: async (resourceUri) => readProjectResourceAsMcpResult(options.readProjectResource, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[2],
      list: async () => listPageAnnotationResources(options.readProjectResource),
      read: async (resourceUri) => readProjectResourceAsMcpResult(options.readProjectResource, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[3],
      read: async (resourceUri) =>
        createTextResourceResult(
          resourceUri,
          'application/json',
          createAkselComponentResourceText(resolveAkselComponentRequest(getAkselComponentName(resourceUri)))
        ),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[4],
      read: async (resourceUri) => readPreviewCaptureResource(options.previewCaptureStore, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[5],
      read: async (resourceUri) => readPreviewCaptureResource(options.previewCaptureStore, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[6],
      read: async (resourceUri) => readPreviewCaptureResource(options.previewCaptureStore, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[7],
      read: async (resourceUri) => readPreviewCaptureResource(options.previewCaptureStore, resourceUri),
    },
    {
      ...DESKTOP_RESOURCE_TEMPLATES[8],
      read: async (resourceUri) => readPreviewCaptureResource(options.previewCaptureStore, resourceUri),
    },
  ]

  for (const templateDefinition of templateDefinitions) {
    const listResources = templateDefinition.list
    server.registerResource(
      templateDefinition.name,
      new ResourceTemplate(templateDefinition.uriTemplate, {
        list: listResources
          ? async () => ({
              resources: await listResources(),
            })
          : undefined,
      }),
      {
        description: templateDefinition.description,
        mimeType: templateDefinition.mimeType,
      },
      async (uri) => templateDefinition.read(uri.toString())
    )
  }

  server.server.registerCapabilities({
    resources: {
      subscribe: false,
      listChanged: false,
    },
  })
}

const readStableResourceText = async (
  uri: string,
  options: DesktopMcpResourceRegistrationOptions
): Promise<string> => {
  const guidanceText = createMcpGuidanceResourceText(uri)
  if (guidanceText !== null) {
    return guidanceText
  }

  switch (uri) {
    case DESKTOP_OPERATING_GUIDE_URI:
      return createDesktopOperatingGuide()
    case DESKTOP_AUTHORING_GUIDE_URI:
      return createDesktopAuthoringGuide()
    case DESKTOP_APPLY_CHANGES_OPERATIONS_URI:
      return createDesktopApplyChangesOperationsGuide()
    case AKSEL_CATALOG_RESOURCE_URI:
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        description:
          'On-demand index of Aksel components available in this Arcade runtime. Read one component resource at a time, only for components you are about to use. Each snippet is import-free and version-matched.',
        componentResourceUriTemplate: AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE,
        iconDiscovery:
          'Aksel icons are injected globals (e.g. <PersonIcon />) and are not listed here. Browse names at https://aksel.nav.no/ikoner, or use the Aksel MCP aksel_find_icons tool if your client has it.',
        components: AKSEL_CATALOG_DATA.components,
      })
    case DESKTOP_CAPABILITIES_URI:
      return JSON.stringify(
        createDesktopCapabilitiesPayload({
          ...options,
          stableResourceUris: [
            ...MCP_GUIDANCE_RESOURCE_DEFINITIONS.map((resourceDefinition) => resourceDefinition.uri),
            ...ADDITIONAL_STABLE_RESOURCE_DEFINITIONS.map((resourceDefinition) => resourceDefinition.uri),
          ],
          resourceTemplateUris: DESKTOP_RESOURCE_TEMPLATES.map(
            (resourceTemplateDefinition) => resourceTemplateDefinition.uriTemplate
          ),
        })
      )
    case PROJECT_MANIFEST_URI:
    case PROJECT_ANNOTATIONS_URI:
    case PROJECT_PREVIEW_CONTEXT_URI:
    case PROJECT_DIAGNOSTICS_URI:
    case PROJECT_SOURCE_GLOBAL_JSX_URI:
    case PROJECT_SOURCE_GLOBAL_HOOKS_URI:
      return (await readProjectResourceOrThrow(options.readProjectResource, uri)).text
    default:
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown Desktop Arcade MCP resource "${uri}".`,
        createResourceErrorData('resource-not-found', uri)
      )
  }
}

const createDesktopCapabilitiesPayload = ({
  host,
  port,
  path,
  serverName,
  serverVersion,
  transportLabel,
  authDescription,
  toolNames = [],
  stableResourceUris,
  resourceTemplateUris,
}: DesktopMcpResourceRegistrationOptions & {
  stableResourceUris: string[]
  resourceTemplateUris: string[]
}) => ({
  serverName,
  serverVersion,
  endpoint: `http://${host}:${port}${path}`,
  transport: transportLabel,
  protocol: {
    lifecycle: 'Official TypeScript MCP SDK',
    versionNegotiation: 'sdk-managed negotiation against the latest supported MCP protocol version',
  },
  requiresAuth: false,
  authDescription,
  scope: 'Active Desktop Arcade project only.',
  discoveryAdvice: {
    preferredFirstResourceUri: 'arcade://desktop/start-here',
    preferredDiscoveryMethods: ['resources/list', 'resources/templates/list', 'resources/read', 'tools/list'],
    toolOnlyFallback:
      toolNames.length > 0
        ? 'In tool-only clients, call read_resource({ uri }) for the same resources.'
        : 'read_resource is not registered in this slice yet.',
  },
  toolNames,
  stableResourceUris,
  resourceTemplateUris,
  dynamicSourceUriTemplates: CAPABILITY_SOURCE_URI_TEMPLATES,
  akselSnippetResources: {
    akselVersion: AKSEL_CATALOG_DATA.akselVersion,
    catalogUri: AKSEL_CATALOG_RESOURCE_URI,
    componentUriTemplate: AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE,
  },
  previewEvidenceUriTemplates: CAPABILITY_PREVIEW_EVIDENCE_URI_TEMPLATES,
  captureLayers: CAPABILITY_PREVIEW_CAPTURE_LAYERS,
  captureLayerPurposes: CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES,
  interactionActions: ['click', 'fill', 'select', 'press', 'scroll', 'waitFor'],
  interactionWaitModes: ['text', 'target', 'renderIdle'],
  limits: {
    requestBodyBytes: MAX_MCP_BODY_BYTES,
    previewInteractionSteps: MAX_PREVIEW_INTERACTION_STEPS,
    previewInteractionTotalTimeMs: MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS,
    previewInteractionWaitTimeoutMs: MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS,
  },
  omittedFeatures: CAPABILITY_V1_OMISSIONS,
  implementationStatus: {
    resourcesList: 'available',
    resourcesTemplatesList: 'available',
    resourcesRead: 'available',
    toolsList: toolNames.length > 0 ? 'available for registered SDK tools' : 'not registered in this slice',
    toolsCall: toolNames.length > 0 ? 'available for registered SDK tools' : 'not registered in this slice',
  },
})

const createDesktopOperatingGuide = () =>
  [
    '# Desktop Arcade MCP operating guide',
    '',
    '- Work through `arcade://` resources and MCP tools only; do not edit repository files, package metadata, or the local filesystem.',
    '- `arcade://desktop/start-here` is the self-sufficient on-ramp and carries the default loop: read `arcade://project/manifest`, read the relevant source resources, use annotation resources when review data matters, `apply_changes` for durable edits, read `arcade://project/diagnostics`, then capture Preview evidence.',
    '- Start with `resources/list`, `resources/templates/list`, `resources/read`, or `read_resource({ uri })` when your MCP host is tool-only.',
    '- `arcade://desktop/capabilities` is the shortest single place to inspect the published contract.',
    '- Read-only MCP tools are available for resource reads, annotation discovery, pending-annotation watches, and isolated Preview evidence capture.',
    '- Durable project edits happen through `apply_changes`, not by patching files outside the active Arcade project.',
    '- Saved Preview preferences live in `arcade://project/preview-context`; capture-only overrides must not mutate them.',
    '- If a project resource returns `project-unavailable`, wait for an active Desktop Arcade window instead of falling back to repository or filesystem edits.',
  ].join('\n')

const createDesktopAuthoringGuide = () =>
  [
    '# Desktop Arcade authoring guide',
    '',
    'Arcade is a live sandbox for prototyping **any** UI with the Aksel design system. Build whatever the task calls for and choose Aksel components to fit it — nothing here narrows what you can make.',
    '',
    '## Arcade mechanics (specific to this sandbox)',
    '- Source is **import-free**: React, Aksel components, Aksel icons, and hooks are injected globals. Never write `import` statements.',
    '- **Each page has two source tabs: `jsx` and `hooks`** (Global config has them too). The `jsx` source is inlined into `return ( … )`, so it must be a single JSX element/fragment or a parenthesized expression — **never wrap it in `{ … }`**. In a page `hooks` tab, top-level hook bindings such as `const { … } = useThing()` or `const [x, setX] = useState()` are hoisted into that page component, and the `jsx` tab references the values directly. Global config `hooks` stays at module scope: define shared custom hooks, helpers, constants, and components there, but never call hooks at its top level.',
    '- Use **real Aksel components and props** — current components, layout primitives (`Page`, `Box`, `HStack`, `VStack`, `HGrid`), Aksel icons, and `--ax` design tokens — before reaching for raw HTML or custom CSS.',
    '- **Navigate** with `goToPage("pageNN")`, or an Aksel `Link`/`LinkCard` whose `href`/`to` is a bare page id. The current page id is injected read-only as `currentPageId`. There is no router and no `<a href>` navigation.',
    '- **Page ids are assigned by the app.** Within one `apply_changes` batch, link pages with `{{pageRef:name}}` placeholders targeting any matching `create_page.newPageRef` in the same batch.',
    '- **Feedback loop:** `apply_changes` → read `arcade://project/diagnostics` → `capture_preview_evidence`.',
    '',
    '## Getting Aksel component usage (on demand — fetch only the components you need)',
    `1. **\`${AKSEL_CATALOG_RESOURCE_URI}\`** — a compact index of the components available here, each with its own \`${AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE}\` snippet resource. These snippets are import-free, version-matched to this Arcade runtime (Aksel ${AKSEL_CATALOG_DATA.akselVersion}), and guaranteed to run. Prefer this path.`,
    '2. **`https://aksel.nav.no/llm.md`** — the public docs index; fetch the individual component `.md` article when you need more than the snippet.',
    '3. **Aksel MCP tools** (`aksel_find_docs`, `aksel_get_component_info`, `aksel_find_icons`, `aksel_get_token_details`) — use them only if your client already has that server connected.',
    '- `Alert` is deprecated. If old code or a guessed component name lands on `Alert`, translate it instead of writing `Alert` back into Arcade.',
  ].join('\n')

const createDesktopApplyChangesOperationsGuide = () =>
  [
    '# apply_changes operations reference',
    '',
    'Every entry in `operations[]` is an object with a `type`. The other fields it accepts depend on that `type`.',
    '',
    '| type | fields | notes |',
    '| --- | --- | --- |',
    '| `replace_source` | `resourceUri` (required), `content` (required) | `resourceUri` must be an existing source resource from `arcade://project/manifest`. |',
    '| `create_page` | `newPageRef`, `name`, `jsxCode`, `hooksCode` (all optional) | `newPageRef` declares a temporary ref later lifecycle operations and same-batch `{{pageRef:name}}` placeholders can target. |',
    '| `rename_page` | `name` (required) + target | Target the page with either `pageId` or `tempPageRef`. |',
    '| `delete_page` | target | Target with `pageId` or `tempPageRef`. |',
    '| `set_start_page` | target | Target with `pageId` or `tempPageRef`. |',
    '| `select_active_page` | target | Target with `pageId` or `tempPageRef`. Changes the human-visible Active page. |',
    '| `set_preview_context` | `viewportSize`, `theme` (at least one) | Saved preview preferences. |',
    '| `rename_project` | `name` (required) | New project name. |',
    '',
    'Final-state assertions support `pageCount`, `startPage`, `activePage`, and `forbidImports`.',
  ].join('\n')

const createTextResourceResult = (
  uri: string,
  mimeType: string,
  text: string
): ReadResourceResult => ({
  contents: [
    {
      uri,
      mimeType,
      text,
    },
  ],
})

const readProjectResourceAsMcpResult = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler,
  resourceUri: string
): Promise<ReadResourceResult> => {
  const resourceResult = await readProjectResourceOrThrow(readProjectResource, resourceUri)
  return createTextResourceResult(resourceResult.uri, resourceResult.mimeType, resourceResult.text)
}

const readProjectResourceOrThrow = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler,
  resourceUri: string
) => {
  let resourceResult: DesktopMcpProjectResourceReadResult
  try {
    resourceResult = await readProjectResource({ uri: resourceUri })
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      error instanceof Error
        ? error.message
        : `Desktop Arcade MCP resource "${resourceUri}" is unavailable.`,
      createResourceErrorData('project-unavailable', resourceUri)
    )
  }

  if (!isDesktopMcpProjectResourceReadResult(resourceResult, resourceUri)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Desktop Arcade MCP resource "${resourceUri}" returned an invalid project resource response.`,
      createResourceErrorData('project-unavailable', resourceUri)
    )
  }

  if (!resourceResult.ok) {
    throw new McpError(
      ErrorCode.InvalidParams,
      resourceResult.message,
      createResourceErrorData(resourceResult.code, resourceResult.resourceUri)
    )
  }

  return resourceResult
}

const readPreviewCaptureResource = async (
  previewCaptureStore: DesktopMcpPreviewCaptureStore,
  resourceUri: string
): Promise<ReadResourceResult> => {
  const resource = previewCaptureStore.read(resourceUri)
  if (!resource) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Desktop Arcade MCP resource "${resourceUri}" is unavailable because the Preview capture does not exist or has expired.`,
      createResourceErrorData('resource-not-found', resourceUri)
    )
  }

  return createTextResourceResult(resource.uri, resource.mimeType, resource.text)
}

const readProjectJsonResource = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler,
  resourceUri: string
): Promise<Record<string, unknown> | null> => {
  try {
    const resourceResult = await readProjectResourceOrThrow(readProjectResource, resourceUri)
    const parsed = JSON.parse(resourceResult.text) as unknown
    return isObjectRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const listProjectSourceResources = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler,
  sourceKind: 'jsx' | 'hooks'
): Promise<Resource[]> => {
  const manifest = (await readProjectJsonResource(
    readProjectResource,
    PROJECT_MANIFEST_URI
  )) as DesktopMcpProjectManifestPayload | null
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : []

  return pages
    .filter(
      (page): page is DesktopMcpProjectManifestPageEntry =>
        isObjectRecord(page) &&
        typeof page.id === 'string' &&
        PROJECT_PAGE_ID_PATTERN.test(page.id) &&
        typeof page.name === 'string'
    )
    .map((page) => ({
      uri: `arcade://project/source/pages/${page.id}/${sourceKind}`,
      name: `Arcade page ${sourceKind.toUpperCase()} source: ${page.name}`,
      description: `Editable ${sourceKind.toUpperCase()} source for Arcade page ${page.name} (${page.id}).`,
      mimeType: 'text/plain',
    }))
}

const listPageAnnotationResources = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler
): Promise<Resource[]> => {
  const manifest = (await readProjectJsonResource(
    readProjectResource,
    PROJECT_MANIFEST_URI
  )) as DesktopMcpProjectManifestPayload | null
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : []

  return pages
    .filter(
      (page): page is DesktopMcpProjectManifestPageEntry =>
        isObjectRecord(page) &&
        typeof page.id === 'string' &&
        PROJECT_PAGE_ID_PATTERN.test(page.id) &&
        typeof page.name === 'string'
    )
    .map((page) => ({
      uri: `arcade://project/pages/${page.id}/annotations`,
      name: `Arcade page annotations: ${page.name}`,
      description: `Non-dead annotations for Arcade page ${page.name} (${page.id}).`,
      mimeType: 'application/json',
    }))
}

const createAkselComponentLink = (name: string): DesktopMcpAkselComponentIndexEntry => ({
  name,
  resourceUri: akselComponentResourceUri(name),
})

const getAkselComponentRootName = (name: string) => name.split('.')[0] ?? name

const decodeAkselComponentName = (rawName: string) => {
  try {
    return decodeURIComponent(rawName)
  } catch {
    return rawName
  }
}

const getAkselComponentName = (resourceUri: string) => {
  const match = resourceUri.match(AKSEL_COMPONENT_RESOURCE_URI_PATTERN)
  return decodeAkselComponentName(match?.[1] ?? '')
}

const findCaseInsensitiveCatalogValue = <T>(record: Record<string, T>, name: string) => {
  if (Object.prototype.hasOwnProperty.call(record, name)) {
    return { key: name, value: record[name] }
  }

  const lowered = name.toLowerCase()
  const matchKey = Object.keys(record).find((key) => key.toLowerCase() === lowered)
  return matchKey ? { key: matchKey, value: record[matchKey] } : null
}

const findAkselComponentDetail = (name: string) =>
  findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.componentsByName, name)

const findAkselComponentAlias = (name: string) =>
  findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.componentAliases, name)

const findAkselHiddenRootReplacement = (name: string) => {
  const exactMatch = findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.hiddenRootReplacements, name)
  if (exactMatch) {
    return exactMatch
  }

  const rootName = getAkselComponentRootName(name)
  if (rootName === name) {
    return null
  }

  return findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.hiddenRootReplacements, rootName)
}

const normalizeAkselComponentName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const calculateEditDistance = (source: string, target: string) => {
  if (source === target) {
    return 0
  }
  if (source.length === 0) {
    return target.length
  }
  if (target.length === 0) {
    return source.length
  }

  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    let nextDiagonal = sourceIndex
    previousRow[0] = sourceIndex + 1
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      const oldValue = previousRow[targetIndex + 1]
      const substitutionCost = source[sourceIndex] === target[targetIndex] ? 0 : 1
      previousRow[targetIndex + 1] = Math.min(
        previousRow[targetIndex + 1] + 1,
        previousRow[targetIndex] + 1,
        nextDiagonal + substitutionCost
      )
      nextDiagonal = oldValue
    }
  }

  return previousRow[target.length]
}

const listAkselComponentSuggestions = (requestedName: string) => {
  const requestedLowered = requestedName.toLowerCase()
  const requestedNormalized = normalizeAkselComponentName(requestedName)
  const ranked = AKSEL_CATALOG_DATA.components.map((component) => {
    const candidateName = component.name
    const candidateLowered = candidateName.toLowerCase()
    const candidateNormalized = normalizeAkselComponentName(candidateName)
    let score = calculateEditDistance(
      requestedNormalized || requestedLowered,
      candidateNormalized || candidateLowered
    )

    if (
      requestedNormalized &&
      (candidateNormalized.startsWith(requestedNormalized) ||
        requestedNormalized.startsWith(candidateNormalized))
    ) {
      score -= 2
    }
    if (
      requestedNormalized &&
      (candidateNormalized.includes(requestedNormalized) ||
        requestedNormalized.includes(candidateNormalized))
    ) {
      score -= 1
    }
    if (
      candidateLowered.includes(requestedLowered) ||
      requestedLowered.includes(candidateLowered)
    ) {
      score -= 1
    }

    return { name: candidateName, score }
  })

  return ranked
    .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name))
    .slice(0, MAX_AKSEL_COMPONENT_SUGGESTIONS)
    .map((entry) => createAkselComponentLink(entry.name))
}

const createAkselMigrationRule = (rule: AkselCatalogMigrationRule) => ({
  when: rule.when,
  target: createAkselComponentLink(rule.target),
  ...(rule.match ? { match: rule.match } : {}),
  ...(rule.propMappings
    ? {
        propMappings: rule.propMappings.map((mapping) => ({
          sourceProp: mapping.sourceProp,
          targetProp: mapping.targetProp,
          valueMap: { ...mapping.valueMap },
        })),
      }
    : {}),
  ...(rule.preservesCloseButton ? { preservesCloseButton: true } : {}),
  ...(rule.note ? { note: rule.note } : {}),
})

const resolveAkselComponentRequest = (requestedName: string): AkselComponentResolution => {
  const exactMatch = findAkselComponentDetail(requestedName)
  if (exactMatch) {
    return {
      kind: 'exact',
      requestedName,
      matchedName: exactMatch.key,
      resourceUri: createAkselComponentLink(exactMatch.key).resourceUri,
      component: exactMatch.value,
    }
  }

  const aliasMatch = findAkselComponentAlias(requestedName)
  if (aliasMatch) {
    const aliasedComponent = findAkselComponentDetail(aliasMatch.value)
    if (aliasedComponent) {
      return {
        kind: 'alias',
        requestedName,
        aliasName: aliasMatch.key,
        matchedName: aliasedComponent.key,
        resourceUri: createAkselComponentLink(aliasedComponent.key).resourceUri,
        component: aliasedComponent.value,
      }
    }
  }

  const hiddenRootMatch = findAkselHiddenRootReplacement(requestedName)
  if (hiddenRootMatch) {
    return {
      kind: 'replacement',
      requestedName,
      hiddenRootName: hiddenRootMatch.key,
      reason: hiddenRootMatch.value.reason,
      replacements: hiddenRootMatch.value.replacements.map(createAkselComponentLink),
      ...(Array.isArray(hiddenRootMatch.value.migrationRules)
        ? {
            migrationRules: hiddenRootMatch.value.migrationRules.map((rule) =>
              createAkselMigrationRule(rule)
            ),
          }
        : {}),
    }
  }

  return {
    kind: 'did-you-mean',
    requestedName,
    suggestions: listAkselComponentSuggestions(requestedName),
  }
}

const createAkselComponentResourceText = (resolution: AkselComponentResolution) => {
  switch (resolution.kind) {
    case 'exact':
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        usage: AKSEL_COMPONENT_USAGE,
        resolution: {
          kind: 'exact',
          requestedName: resolution.requestedName,
          matchedName: resolution.matchedName,
          resourceUri: resolution.resourceUri,
        },
        component: resolution.component,
      })
    case 'alias':
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        usage: AKSEL_COMPONENT_USAGE,
        resolution: {
          kind: 'alias',
          requestedName: resolution.requestedName,
          aliasName: resolution.aliasName,
          matchedName: resolution.matchedName,
          resourceUri: resolution.resourceUri,
          message: `${resolution.requestedName} resolves to the ${resolution.matchedName} snippet in Arcade. Use ${resolution.matchedName} for the runnable example.`,
        },
        component: resolution.component,
      })
    case 'replacement':
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        resolution: {
          kind: 'replacement',
          requestedName: resolution.requestedName,
          hiddenRootName: resolution.hiddenRootName,
          reason: resolution.reason,
          message: Array.isArray(resolution.migrationRules)
            ? `${resolution.hiddenRootName} is intentionally hidden from new authoring. Use the migration guidance below to choose the sanctioned replacement.`
            : `${resolution.hiddenRootName} is intentionally hidden from new authoring. Use one of these sanctioned replacements instead.`,
          replacements: resolution.replacements,
          ...(Array.isArray(resolution.migrationRules)
            ? { migrationRules: resolution.migrationRules }
            : {}),
        },
      })
    case 'did-you-mean':
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        resolution: {
          kind: 'did-you-mean',
          requestedName: resolution.requestedName,
          message:
            resolution.suggestions.length > 0
              ? `Unknown Aksel component "${resolution.requestedName}". Read ${AKSEL_CATALOG_RESOURCE_URI} first, then try one of these near matches.`
              : `Unknown Aksel component "${resolution.requestedName}". Read ${AKSEL_CATALOG_RESOURCE_URI} first.`,
          suggestions: resolution.suggestions,
        },
      })
  }
}

const isDesktopMcpProjectResourceReadResult = (
  value: unknown,
  requestedUri: string
): value is DesktopMcpProjectResourceReadResult => {
  if (!isObjectRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.uri === 'string' &&
      value.uri === requestedUri &&
      typeof value.mimeType === 'string' &&
      typeof value.text === 'string'
    )
  }

  return isDesktopMcpProjectResourceReadFailure(value, requestedUri)
}

const isDesktopMcpProjectResourceReadFailure = (
  value: unknown,
  requestedUri: string
): value is DesktopMcpProjectResourceReadFailure =>
  isObjectRecord(value) &&
  typeof value.code === 'string' &&
  typeof value.message === 'string' &&
  typeof value.resourceUri === 'string' &&
  value.resourceUri === requestedUri

const createResourceErrorData = (code: string, resourceUri: string) => ({
  code,
  resourceUri,
})

const isKnownProjectResourceUri = (uri: string) =>
  uri === PROJECT_MANIFEST_URI ||
  uri === PROJECT_ANNOTATIONS_URI ||
  uri === PROJECT_PREVIEW_CONTEXT_URI ||
  uri === PROJECT_DIAGNOSTICS_URI ||
  uri === PROJECT_SOURCE_GLOBAL_JSX_URI ||
  uri === PROJECT_SOURCE_GLOBAL_HOOKS_URI ||
  /^arcade:\/\/project\/pages\/page\d+\/annotations$/.test(uri) ||
  /^arcade:\/\/project\/source\/pages\/page\d+\/(jsx|hooks)$/.test(uri)

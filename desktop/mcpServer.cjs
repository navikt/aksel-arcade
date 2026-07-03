const http = require('node:http')
const {
  MCP_GUIDANCE_RESOURCE_DEFINITIONS,
  createMcpGuidanceResourceText,
} = require('./mcpGuidanceResources.cjs')

const DESKTOP_MCP_HOST = '127.0.0.1'
const DESKTOP_MCP_PORT = 3846
const DESKTOP_MCP_PATH = '/mcp'
const DESKTOP_MCP_SERVER_NAME = 'aksel-arcade'
const DESKTOP_MCP_SERVER_VERSION = '0.0.0'
const DESKTOP_MCP_TRANSPORT_LABEL = 'HTTP (MCP Streamable HTTP)'
const DESKTOP_MCP_AUTH_DESCRIPTION = 'No token/header required.'
const DESKTOP_MCP_PROTOCOL_VERSION = '2024-11-05'
const MAX_MCP_BODY_BYTES = 1024 * 1024
const DEFAULT_PREVIEW_CAPTURE_TTL_MS = 5 * 60 * 1000
const VALID_VIEWPORT_SIZES = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS']
const VALID_THEMES = ['light', 'dark']
const VALID_PREVIEW_CAPTURE_LAYERS = ['screenshot', 'accessibility', 'dom_layout_style', 'frame']
const VALID_PREVIEW_SCREENSHOT_SCOPES = ['viewport', 'full_page', 'region']
const VALID_PREVIEW_INTERACTION_ACTIONS = ['click', 'fill', 'select', 'press', 'scroll', 'waitFor']
const VALID_ANNOTATION_MUTATION_TOOL_NAMES = [
  'acknowledge_annotation',
  'resolve_annotation',
  'dismiss_annotation',
  'reply_to_annotation',
]
const MAX_PREVIEW_INTERACTION_STEPS = 10
const MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS = 10_000
const MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 5_000
const VALID_PREVIEW_PRESS_KEYS = [
  'Enter',
  'Escape',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Space',
  ' ',
]
const APPLY_CHANGES_OPERATION_TYPES = [
  'replace_source',
  'create_page',
  'rename_page',
  'delete_page',
  'set_start_page',
  'select_active_page',
  'set_preview_context',
  'rename_project',
]
const DEFAULT_LIST_ANNOTATIONS_STATUS = 'open'
const LIST_ANNOTATIONS_STATUSES = ['pending', 'acknowledged', 'resolved', 'dismissed', 'all']
const PAGE_REF_PLACEHOLDER_SYNTAX = '{{pageRef:name}}'
const CAPABILITY_PREVIEW_CAPTURE_LAYERS = [
  'screenshot',
  'accessibility',
  'dom_layout_style',
  'frame',
]
const CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES = Object.freeze({
  screenshot: 'visual appearance and spatial gestalt',
  accessibility:
    'semantic roles, accessible names, landmarks, focusable controls, and semantic hierarchy',
  dom_layout_style:
    'actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow',
  frame: 'viewport, theme, page, scroll, diagnostics, truncation, and capture metadata',
})
const CAPABILITY_PREVIEW_INTERACTION_ACTIONS = [
  'click',
  'fill',
  'select',
  'press',
  'scroll',
  'waitFor',
]
const CAPABILITY_SOURCE_URI_TEMPLATES = Object.freeze([
  'arcade://project/source/global/jsx',
  'arcade://project/source/global/hooks',
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
const CAPABILITY_V1_OMISSIONS = Object.freeze([
  'No prompts surface.',
  'No SSE subscriptions or list-changed notifications.',
  'No general filesystem, network, shell, or clipboard access.',
  'No import, export, Share URL, or Arcade project package tools.',
  'No arbitrary JavaScript execution.',
  'No visual diff API.',
  'No Web Arcade MCP endpoint.',
])
const PROJECT_SOURCE_PAGE_URI_PATTERN = /^arcade:\/\/project\/source\/pages\/(page\d+)\/(jsx|hooks)$/
const PROJECT_ANNOTATIONS_RESOURCE_URI = 'arcade://project/annotations'
const PROJECT_PAGE_ANNOTATIONS_URI_PATTERN = /^arcade:\/\/project\/pages\/(page\d+)\/annotations$/
const PREVIEW_CAPTURE_RESOURCE_URI_PATTERN =
  /^arcade:\/\/preview\/captures\/([a-z0-9-]+)\/(manifest|screenshot|frame|accessibility|dom-layout-style)$/

const AKSEL_CATALOG_RESOURCE_URI = 'arcade://aksel/catalog'
const AKSEL_COMPONENT_RESOURCE_URI_PREFIX = 'arcade://aksel/components/'
const AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE = `${AKSEL_COMPONENT_RESOURCE_URI_PREFIX}{name}`
const AKSEL_COMPONENT_RESOURCE_URI_PATTERN = /^arcade:\/\/aksel\/components\/([A-Za-z0-9.%\- ]+)$/
const APPLY_CHANGES_OPERATIONS_RESOURCE_URI = 'arcade://desktop/apply-changes-operations'
const MAX_AKSEL_COMPONENT_SUGGESTIONS = 5

const APPLY_CHANGES_NEXT_STEPS = Object.freeze([
  'Read arcade://project/diagnostics to confirm the batch is healthy.',
  'Run capture_preview_evidence({ pageId }) to inspect the rendered result.',
])

// The single auto-surfaced string every MCP host shows the model on connect.
// Teaches only the Arcade-specific mechanics the agent cannot infer, and points
// to the self-sufficient start-here on-ramp for the rest. Deliberately carries no
// component list and no worked example so it never narrows what Arcade is for.
const DESKTOP_MCP_INSTRUCTIONS = [
  'Desktop Arcade is a live sandbox for prototyping any UI with the Aksel design system. Build whatever the task needs — it is not limited to any one kind of screen.',
  'Start by reading arcade://desktop/start-here — it is self-sufficient: one read plus arcade://project/manifest is enough to author. If your MCP host exposes only tools, call read_resource({ uri: "arcade://desktop/start-here" }).',
  'Source is import-free: React, Aksel components, Aksel icons, and hooks are injected globals — never add import statements.',
  'Each Arcade page (and Global config) has two source tabs: jsx and hooks. The jsx source is inlined into return ( … ), so it must be a single JSX element/expression and must never be wrapped in { … }; put page-level top-level hook bindings such as const [value, setValue] = useState(...) in the page Hooks tab, and treat Global config hooks as module scope where you define shared custom hooks, helpers, constants, and components and never call hooks at the top level.',
  'Use real Aksel components and props; do not hand-roll raw HTML or guess prop names. If an Aksel component resource resolves to a replacement payload, follow the sanctioned replacement instead of authoring the hidden/deprecated component. Per-component usage and runnable, version-matched snippets are available on demand — do not load them until you reach for a given component.',
  'Navigate between pages with goToPage("pageNN"), or an Aksel Link/LinkCard whose href/to is a bare page id; the current page id is injected read-only as currentPageId. There is no router and no <a href> navigation.',
  'Page ids are assigned by the app. Within one apply_changes batch, link pages with {{pageRef:name}} placeholders targeting any create_page.newPageRef declared in that batch.',
  'Annotation work is Arcade-native: list open work with list_annotations, read arcade://project/annotations or arcade://project/pages/{pageId}/annotations for non-dead history, and treat hidden targets as real work even when they are outside the current viewport.',
  'Working loop: apply_changes, then read arcade://project/diagnostics, then capture_preview_evidence to inspect. Capture is an isolated throwaway render — it never changes the durable Active page.',
  'Deeper references are on demand, not required before authoring: arcade://desktop/authoring-guide (depth + Aksel snippet reach paths), arcade://desktop/apply-changes-operations, the workflow guides, and the Aksel catalog.',
].join('\n')

// Version-matched Aksel snippet data generated from src/data/akselCatalog.ts by
// `npm run aksel:refresh-mcp-catalog`. Served on demand through the
// arcade://aksel/catalog and arcade://aksel/components/{name} resources so the
// agent never loads component data into context until it reaches for a component.
const isObjectRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const createEmptyAkselCatalogData = () => ({
  akselVersion: 'unknown',
  components: [],
  componentsByName: {},
  componentAliases: {},
  hiddenRootReplacements: {},
})

const loadAkselCatalogData = () => {
  try {
    const data = require('./akselCatalogData.generated.cjs')
    if (
      data &&
      typeof data === 'object' &&
      typeof data.akselVersion === 'string' &&
      Array.isArray(data.components) &&
      data.componentsByName &&
      typeof data.componentsByName === 'object'
    ) {
      return {
        akselVersion: data.akselVersion,
        components: data.components,
        componentsByName: data.componentsByName,
        componentAliases: isObjectRecord(data.componentAliases) ? data.componentAliases : {},
        hiddenRootReplacements: isObjectRecord(data.hiddenRootReplacements)
          ? data.hiddenRootReplacements
          : {},
      }
    }
  } catch {
    // Artifact is generated at build time; fall back to an empty catalog in
    // environments where it has not been generated yet.
  }
  return createEmptyAkselCatalogData()
}

const AKSEL_CATALOG_DATA = loadAkselCatalogData()

const isAkselComponentResourceUri = (uri) => AKSEL_COMPONENT_RESOURCE_URI_PATTERN.test(uri)

// Component names are percent-encoded in their resource URIs (e.g. "Chips Toggle"
// -> "Chips%20Toggle"), so decode before looking them up. Tolerate a raw,
// unencoded name too, and never throw on a malformed escape sequence.
const decodeAkselComponentName = (rawName) => {
  try {
    return decodeURIComponent(rawName)
  } catch {
    return rawName
  }
}

const findCaseInsensitiveCatalogValue = (record, name) => {
  if (Object.prototype.hasOwnProperty.call(record, name)) {
    return { key: name, value: record[name] }
  }

  const lowered = name.toLowerCase()
  const matchKey = Object.keys(record).find((key) => key.toLowerCase() === lowered)
  return matchKey ? { key: matchKey, value: record[matchKey] } : null
}

const findAkselComponentDetail = (name) =>
  findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.componentsByName, name)

const findAkselComponentAlias = (name) =>
  findCaseInsensitiveCatalogValue(AKSEL_CATALOG_DATA.componentAliases, name)

const getAkselComponentRootName = (name) => name.split('.')[0] ?? name

const findAkselHiddenRootReplacement = (name) => {
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

const normalizeAkselComponentName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const calculateEditDistance = (source, target) => {
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

const listAkselComponentSuggestions = (requestedName) => {
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
    .map((entry) => entry.name)
}

const createAkselComponentLink = (name) => ({
  name,
  resourceUri: `${AKSEL_COMPONENT_RESOURCE_URI_PREFIX}${encodeURIComponent(name)}`,
})

const createAkselMigrationRule = (rule) => ({
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

const resolveAkselComponentRequest = (requestedName) => {
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
            migrationRules: hiddenRootMatch.value.migrationRules.map(createAkselMigrationRule),
          }
        : {}),
    }
  }

  return {
    kind: 'did-you-mean',
    requestedName,
    suggestions: listAkselComponentSuggestions(requestedName).map(createAkselComponentLink),
  }
}

const MCP_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: 'read_resource',
    description:
      'Read a Desktop Arcade MCP resource by URI. Use this first in tool-only MCP clients to fetch arcade://desktop/start-here, the project manifest, annotation resources, diagnostics, source resources, Aksel snippets, and Preview evidence resources.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['uri']),
      properties: Object.freeze({
        uri: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Resource URI to read, e.g. arcade://desktop/start-here.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'list_annotations',
    description:
      'List non-dead annotations for the active Arcade page by default. Supports explicit page or whole-project scope plus status filters for open, pending, acknowledged, resolved, dismissed, or all.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        scope: Object.freeze({
          type: 'string',
          enum: ['page', 'project'],
          description: 'Optional annotation scope. Defaults to the active Arcade page.',
        }),
        pageId: Object.freeze({
          type: 'string',
          description: 'Optional Arcade page id. Omit to use the active page when scope is "page".',
        }),
        status: Object.freeze({
          type: 'string',
          enum: LIST_ANNOTATIONS_STATUSES,
          description:
            'Optional status filter. Defaults to "open" (pending + acknowledged). Use "all" for full non-dead history.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'watch_annotations',
    description:
      'Watch for pending annotations on the active Arcade page by default. Supports explicit page or whole-project scope, returns existing pending annotations immediately, waits for the first pending annotation for up to 120 seconds by default, then batches for 10 seconds after the first hit. Maximum wait is 300 seconds and maximum batch window is 60 seconds.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        scope: Object.freeze({
          type: 'string',
          enum: ['page', 'project'],
          description: 'Optional annotation scope. Defaults to the active Arcade page.',
        }),
        pageId: Object.freeze({
          type: 'string',
          description: 'Optional Arcade page id. Omit to use the active page when scope is "page".',
        }),
        waitTimeoutSeconds: Object.freeze({
          type: 'integer',
          minimum: 1,
          maximum: 300,
          description:
            'Optional upper bound, in seconds, for waiting for the first pending annotation. Defaults to 120 seconds.',
        }),
        batchWindowSeconds: Object.freeze({
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description:
            'Optional batching window, in seconds, after the first pending annotation appears. Defaults to 10 seconds.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'acknowledge_annotation',
    description:
      'Acknowledge a single non-dead annotation by annotationId. Updates status, timestamps, and agent actor metadata only.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['annotationId']),
      properties: Object.freeze({
        annotationId: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'resolve_annotation',
    description:
      'Resolve a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata, and may append an optional summary thread message.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['annotationId']),
      properties: Object.freeze({
        annotationId: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        }),
        summary: Object.freeze({
          type: 'string',
          description: 'Optional summary thread message to append before resolving.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'dismiss_annotation',
    description:
      'Dismiss a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata and requires a reason thread message.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['annotationId', 'reason']),
      properties: Object.freeze({
        annotationId: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        }),
        reason: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Reason thread message to append before dismissing.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'reply_to_annotation',
    description:
      'Append an agent thread message to a single non-dead annotation by annotationId without changing status.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['annotationId', 'message']),
      properties: Object.freeze({
        annotationId: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Globally unique annotation id.',
        }),
        message: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Agent reply text to append to the annotation thread.',
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'capture_preview_evidence',
    description:
      'Capture targeted Preview evidence for the active Arcade project across screenshot, accessibility, DOM/layout/style, and frame layers. Captures run in an isolated, throwaway render: in-capture interactions and goToPage navigation never change the human-visible Active page or durable source, so no restore is needed afterward. When interactions navigate, the frame/manifest add page.navigatedToId/navigatedToName so all layers agree. For Arcade authoring rules and how to fetch Aksel component usage on demand, read arcade://desktop/authoring-guide.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        pageId: Object.freeze({
          type: 'string',
          description: 'Optional Arcade page id to capture.',
        }),
        viewportSize: Object.freeze({
          type: 'string',
          enum: VALID_VIEWPORT_SIZES,
          description: 'Optional capture-only viewport override.',
        }),
        theme: Object.freeze({
          type: 'string',
          enum: VALID_THEMES,
          description: 'Optional capture-only theme override.',
        }),
        layers: Object.freeze({
          type: 'array',
          uniqueItems: true,
          items: Object.freeze({
            type: 'string',
            enum: VALID_PREVIEW_CAPTURE_LAYERS,
          }),
          description:
            'Optional requested evidence layers. screenshot = visual appearance and spatial gestalt; accessibility = roles, names, landmarks, focusable controls, and semantic hierarchy; dom_layout_style = actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow; frame = viewport, theme, page, scroll, diagnostics, truncation, and capture metadata. Omit to capture all available layers.',
        }),
        screenshotScope: Object.freeze({
          type: 'string',
          enum: VALID_PREVIEW_SCREENSHOT_SCOPES,
          description: 'Optional screenshot scope for the capture.',
        }),
        includeAnnotationOverlays: Object.freeze({
          type: 'boolean',
          description:
            'When true, screenshot evidence includes visible Annotation mode markers/outlines for the captured page and viewport. Durable annotation history still lives in annotation resources.',
        }),
        target: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            selector: Object.freeze({
              type: 'string',
              description: 'Preview-root-scoped CSS selector for region screenshots.',
            }),
            role: Object.freeze({
              type: 'string',
              description: 'Accessibility role filter for region screenshots.',
            }),
            name: Object.freeze({
              type: 'string',
              description: 'Accessible name filter for region screenshots.',
            }),
            text: Object.freeze({
              type: 'string',
              description: 'Visible text filter for region screenshots.',
            }),
            label: Object.freeze({
              type: 'string',
              description: 'Associated label filter for region screenshots.',
            }),
          }),
          description:
            'Optional preview-root selector or accessibility target for region screenshots.',
        }),
        interactions: Object.freeze({
          type: 'array',
          maxItems: MAX_PREVIEW_INTERACTION_STEPS,
          description:
            'Optional bounded, capture-only Preview interaction sequence. Each step must use one of click, fill, select, press, scroll, or waitFor. Accessibility targets are preferred; selector fallback is scoped to the Preview root only. Interactions are ephemeral and do not mutate durable project or host UI state.',
          items: Object.freeze({
            type: 'object',
            additionalProperties: false,
            required: ['action'],
            properties: Object.freeze({
              action: Object.freeze({
                type: 'string',
                enum: VALID_PREVIEW_INTERACTION_ACTIONS,
              }),
              target: Object.freeze({
                type: 'object',
                additionalProperties: false,
                properties: Object.freeze({
                  selector: Object.freeze({
                    type: 'string',
                    description: 'Preview-root-scoped CSS selector fallback.',
                  }),
                  role: Object.freeze({
                    type: 'string',
                    description: 'Accessibility role filter.',
                  }),
                  name: Object.freeze({
                    type: 'string',
                    description: 'Accessible name filter.',
                  }),
                  text: Object.freeze({
                    type: 'string',
                    description: 'Visible text filter.',
                  }),
                  label: Object.freeze({
                    type: 'string',
                    description: 'Associated label filter.',
                  }),
                }),
              }),
              value: Object.freeze({
                type: 'string',
                description: 'Fill/select value when the action requires a string value.',
              }),
              checked: Object.freeze({
                type: 'boolean',
                description: 'Checkbox/radio state for select interactions.',
              }),
              key: Object.freeze({
                type: 'string',
                description:
                  'Bounded press key such as Enter, Escape, Tab, Arrow keys, Backspace, Delete, Home, End, PageUp, PageDown, Space, or a single printable character.',
              }),
              x: Object.freeze({
                type: 'number',
                description: 'Horizontal scroll delta for scroll interactions.',
              }),
              y: Object.freeze({
                type: 'number',
                description: 'Vertical scroll delta for scroll interactions.',
              }),
              text: Object.freeze({
                type: 'string',
                description: 'Visible Preview text to wait for during waitFor interactions.',
              }),
              renderIdle: Object.freeze({
                type: 'boolean',
                description: 'Wait for the Preview render to settle.',
              }),
              timeoutMs: Object.freeze({
                type: 'number',
                description: `Optional bounded waitFor timeout in milliseconds (max ${MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS}).`,
              }),
            }),
          }),
        }),
      }),
    }),
  }),
  Object.freeze({
    name: 'apply_changes',
    description:
      'Apply a validated, durable batch of Arcade project changes. Read arcade://desktop/start-here and arcade://desktop/apply-changes-operations before editing. Use assertions to keep replacements scoped.',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['summary', 'operations']),
      properties: Object.freeze({
        summary: Object.freeze({
          type: 'string',
          minLength: 1,
          description: 'Required human-readable summary for the batch.',
        }),
        expectedProjectRevision: Object.freeze({
          type: 'string',
          description: 'Optional stale-state protection revision.',
        }),
        operations: Object.freeze({
          type: 'array',
          minItems: 1,
          description: 'Ordered batch operations for source, page lifecycle, preview, or project metadata.',
          items: Object.freeze({
            type: 'object',
            additionalProperties: false,
            required: Object.freeze(['type']),
            properties: Object.freeze({
              type: Object.freeze({
                type: 'string',
                enum: Object.freeze(APPLY_CHANGES_OPERATION_TYPES),
              }),
              resourceUri: Object.freeze({
                type: 'string',
                description: 'Existing source resource URI from the project manifest.',
              }),
              content: Object.freeze({
                type: 'string',
                description:
                  'Full source replacement content for replace_source operations. Supports {{pageRef:name}} placeholders for create_page.newPageRef values declared anywhere in the same batch.',
              }),
              pageId: Object.freeze({
                type: 'string',
                description: 'Existing permanent Arcade page id for page lifecycle operations.',
              }),
              tempPageRef: Object.freeze({
                type: 'string',
                description:
                  'Temporary page ref declared by create_page.newPageRef earlier in the same batch.',
              }),
              newPageRef: Object.freeze({
                type: 'string',
                description:
                  'Optional temporary page ref that later operations and {{pageRef:name}} placeholders can use inside the same batch.',
              }),
              jsxCode: Object.freeze({
                type: 'string',
                description:
                  'Optional initial JSX source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.',
              }),
              hooksCode: Object.freeze({
                type: 'string',
                description:
                  'Optional initial Hooks source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.',
              }),
              viewportSize: Object.freeze({
                type: 'string',
                enum: VALID_VIEWPORT_SIZES,
              }),
              theme: Object.freeze({
                type: 'string',
                enum: VALID_THEMES,
              }),
              name: Object.freeze({
                type: 'string',
                description: 'Replacement project name for rename_project operations.',
              }),
            }),
          }),
        }),
        assertions: Object.freeze({
          type: 'object',
          additionalProperties: false,
          description:
            'Optional final-state assertions. Use for replacement tasks to prevent wasteful or incoherent output.',
          properties: Object.freeze({
            pageCount: Object.freeze({
              type: 'number',
              description: 'Expected final number of Arcade pages.',
            }),
            startPage: Object.freeze({
              type: 'string',
              description: 'Expected final Start page id, or "first" for the first ordered page.',
            }),
            activePage: Object.freeze({
              type: 'string',
              description: 'Expected final Active page id, or "first" for the first ordered page.',
            }),
            forbidImports: Object.freeze({
              type: 'boolean',
              description: 'When true, reject final source containing import statements.',
            }),
          }),
        }),
      }),
    }),
  }),
])

const findCallableToolDefinition = (toolName) =>
  MCP_TOOL_DEFINITIONS.find((tool) => tool.name === toolName) ?? null

const MCP_STABLE_RESOURCE_DEFINITIONS = Object.freeze([
  ...MCP_GUIDANCE_RESOURCE_DEFINITIONS,
  Object.freeze({
    uri: 'arcade://desktop/operating-guide',
    name: 'Desktop Arcade MCP operating guide',
    description: 'Short operating instructions for the Desktop Arcade MCP server.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/authoring-guide',
    name: 'Desktop Arcade MCP authoring guide',
    description: 'Short Arcade authoring guidance for MCP clients.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/capabilities',
    name: 'Desktop Arcade MCP capabilities',
    description: 'Machine-readable Desktop Arcade MCP contract and omissions.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: APPLY_CHANGES_OPERATIONS_RESOURCE_URI,
    name: 'Desktop Arcade apply_changes operations reference',
    description: 'Per-operation field matrix and batch ordering rules for apply_changes.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: AKSEL_CATALOG_RESOURCE_URI,
    name: 'Aksel component catalog (version-matched)',
    description:
      'On-demand index of Aksel components available in Arcade, each with a snippet-resource URI. Pull one component at a time.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/manifest',
    name: 'Active Arcade project manifest',
    description: 'Primary discovery resource for the active Arcade project.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: PROJECT_ANNOTATIONS_RESOURCE_URI,
    name: 'Active Arcade project annotations',
    description:
      'Project-wide non-dead annotations, including resolved and dismissed history plus per-status counts.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/preview-context',
    name: 'Active Arcade project preview context',
    description: 'Saved preview theme and viewport preferences for the active Arcade project.',
    mimeType: 'application/json',
  }),
  Object.freeze({
    uri: 'arcade://project/diagnostics',
    name: 'Active Arcade project diagnostics',
    description: 'Compact Arcade-scoped diagnostics for the active Arcade project.',
    mimeType: 'application/json',
  }),
])

const TOOL_EXECUTION_STATUS = Object.freeze({
  list_annotations: 'available when an active project reader is connected',
  watch_annotations: 'available when an active project reader is connected',
  acknowledge_annotation: 'available when an active project writer is connected',
  resolve_annotation: 'available when an active project writer is connected',
  dismiss_annotation: 'available when an active project writer is connected',
  reply_to_annotation: 'available when an active project writer is connected',
  capture_preview_evidence: 'available when an active preview capture bridge is connected',
  apply_changes: 'available when an active project writer is connected',
})

const PREVIEW_EVIDENCE_URI_TEMPLATE_STATUS = Object.freeze({
  'arcade://preview/captures/{captureId}/manifest':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/screenshot':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/frame':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/accessibility':
    'available after a successful capture until the capture expires',
  'arcade://preview/captures/{captureId}/dom-layout-style':
    'available after a successful capture until the capture expires',
})

const CAPTURE_LAYER_STATUS = Object.freeze({
  screenshot: 'available',
  accessibility: 'available',
  dom_layout_style: 'available',
  frame: 'available',
})

const SCREENSHOT_SCOPE_STATUS = Object.freeze({
  viewport: 'available',
  full_page: 'available',
  region: 'available',
})

const INTERACTION_ACTION_STATUS = Object.freeze(
  CAPABILITY_PREVIEW_INTERACTION_ACTIONS.reduce((status, action) => {
    status[action] = 'available'
    return status
  }, {})
)

const createDesktopMcpServer = ({
  host = DESKTOP_MCP_HOST,
  port = DESKTOP_MCP_PORT,
  path = DESKTOP_MCP_PATH,
  readProjectResource = createProjectUnavailableResourceResult,
  mutateAnnotation = createProjectUnavailableAnnotationMutationResult,
  applyChanges = createProjectUnavailableApplyChangesResult,
  capturePreviewEvidence = createProjectUnavailableCapturePreviewResult,
  previewCaptureTtlMs = DEFAULT_PREVIEW_CAPTURE_TTL_MS,
} = {}) => {
  let activeServer = null
  let startOperation = null
  const previewCaptureStore = createPreviewCaptureStore({ ttlMs: previewCaptureTtlMs })
  let availability = {
    status: 'unavailable',
    reason: 'Desktop Arcade MCP has not started yet.',
  }

  const getPort = () => {
    const address = activeServer?.address()
    return address && typeof address !== 'string' ? address.port : port
  }

  const getState = () => ({
    serverName: DESKTOP_MCP_SERVER_NAME,
    transportLabel: DESKTOP_MCP_TRANSPORT_LABEL,
    url: `http://${host}:${getPort()}${path}`,
    requiresAuth: false,
    authDescription: DESKTOP_MCP_AUTH_DESCRIPTION,
    availability:
      availability.status === 'available'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: availability.reason,
          },
  })

  const start = async () => {
    if (activeServer?.listening) {
      availability = { status: 'available' }
      return getState()
    }

    if (startOperation) {
      return startOperation
    }

    const nextServer = http.createServer((request, response) => {
      handleDesktopMcpRequest(request, response, {
        host,
        path,
        port: getPort(),
        previewCaptureStore,
        readProjectResource,
        mutateAnnotation: async (requestPayload) => mutateAnnotation(requestPayload),
        applyChanges: async (requestPayload) => {
          return applyChanges(requestPayload)
        },
        capturePreviewEvidence: async (requestPayload) => {
          const captureResult = await capturePreviewEvidence(requestPayload)
          if (isCapturePreviewResult(captureResult) && captureResult.ok) {
            previewCaptureStore.store(captureResult)
          }
          return captureResult
        },
      })
    })

    startOperation = new Promise((resolve) => {
      const handleListening = () => {
        cleanupListeners()
        activeServer = nextServer
        availability = { status: 'available' }
        resolve(getState())
      }

      const handleError = (error) => {
        cleanupListeners()
        activeServer = null
        availability = {
          status: 'unavailable',
          reason: formatServerErrorReason(error, { host, port }),
        }
        void closeServer(nextServer)
        resolve(getState())
      }

      const cleanupListeners = () => {
        nextServer.off('error', handleError)
        nextServer.off('listening', handleListening)
      }

      nextServer.once('error', handleError)
      nextServer.once('listening', handleListening)
      nextServer.listen(port, host)
    }).finally(() => {
      startOperation = null
    })

    return startOperation
  }

  const stop = async () => {
    if (!activeServer) {
      return false
    }

    const serverToClose = activeServer
    activeServer = null
    availability = {
      status: 'unavailable',
      reason: 'Desktop Arcade MCP is not available.',
    }
    await closeServer(serverToClose)
    return true
  }

  return {
    getState,
    start,
    stop,
  }
}

const validateApplyChangesPageTarget = (operation, index, operationType, extraAllowedKeys = []) => {
  const extraKeys = getUnexpectedKeys(operation, [
    'type',
    'pageId',
    'tempPageRef',
    ...extraAllowedKeys,
  ])
  if (extraKeys.length > 0) {
    return `apply_changes ${operationType} operation ${index} contains unsupported fields: ${extraKeys.join(
      ', '
    )}.`
  }

  const hasPageId = operation.pageId !== undefined
  const hasTempPageRef = operation.tempPageRef !== undefined
  if ((hasPageId && hasTempPageRef) || (!hasPageId && !hasTempPageRef)) {
    return `apply_changes ${operationType} operation ${index} must provide exactly one of pageId or tempPageRef.`
  }

  if (
    hasPageId &&
    (typeof operation.pageId !== 'string' || operation.pageId.trim().length === 0)
  ) {
    return `apply_changes ${operationType} operation ${index} pageId must be a non-empty string.`
  }

  if (
    hasTempPageRef &&
    (typeof operation.tempPageRef !== 'string' || operation.tempPageRef.trim().length === 0)
  ) {
    return `apply_changes ${operationType} operation ${index} tempPageRef must be a non-empty string.`
  }

  return null
}

const handleDesktopMcpRequest = (
  request,
  response,
  {
    host,
    path,
    port,
    previewCaptureStore,
    readProjectResource,
    mutateAnnotation,
    applyChanges,
    capturePreviewEvidence,
  }
) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)
  if (requestUrl.pathname !== path) {
    sendText(response, 404, 'Desktop Arcade MCP endpoint not found.')
    return
  }

  const requestOrigin = getRequestOrigin(request)
  if (requestOrigin) {
    sendText(
      response,
      403,
      'Desktop Arcade MCP accepts only non-browser local MCP clients. Remove the Origin header and use POST JSON-RPC requests.'
    )
    return
  }

  if (request.method !== 'POST') {
    sendMethodNotAllowed(
      response,
      'Desktop Arcade MCP v1 supports POST JSON-RPC requests only and does not support GET or SSE streams.'
    )
    return
  }

  void routeDesktopMcpRequest(request, response, {
    previewCaptureStore,
    readProjectResource,
    mutateAnnotation,
    applyChanges,
    capturePreviewEvidence,
  }).catch((error) => {
    if (response.writableEnded) {
      return
    }

    sendJsonRpcError(response, {
      httpStatus: 500,
      id: null,
      code: -32603,
      message:
        error instanceof Error
          ? error.message
          : 'Desktop Arcade MCP request handling failed unexpectedly.',
    })
  })
}

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const sendJsonRpcError = (response, { httpStatus = 200, id, code, message, data }) => {
  sendJson(response, httpStatus, {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  })
}

const sendText = (response, statusCode, message) => {
  response.statusCode = statusCode
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendMethodNotAllowed = (response, message) => {
  response.statusCode = 405
  response.setHeader('allow', 'POST')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.end(message)
}

const sendNoContent = (response, statusCode = 204) => {
  response.statusCode = statusCode
  response.end()
}

const routeDesktopMcpRequest = async (
  request,
  response,
  { previewCaptureStore, readProjectResource, mutateAnnotation, applyChanges, capturePreviewEvidence }
) => {
  let bodyText
  try {
    bodyText = await readRequestBody(request)
  } catch (error) {
    sendJsonRpcError(response, {
      httpStatus: 413,
      id: null,
      code: -32000,
      message:
        error instanceof Error
          ? error.message
          : 'Desktop Arcade MCP request body exceeds the 1MB limit.',
    })
    return
  }

  let payload
  try {
    payload = JSON.parse(bodyText)
  } catch {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32700,
      message: 'Desktop Arcade MCP request body must be valid JSON.',
    })
    return
  }

  if (!isJsonRpcRequest(payload)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: getJsonRpcId(payload),
      code: -32600,
      message:
        'Desktop Arcade MCP requests must be single JSON-RPC 2.0 objects with a string method.',
    })
    return
  }

  await routeDesktopMcpJsonRpcRequest(payload, response, {
    previewCaptureStore,
    readProjectResource,
    mutateAnnotation,
    applyChanges,
    capturePreviewEvidence,
  })
}

const routeDesktopMcpJsonRpcRequest = async (
  payload,
  response,
  { previewCaptureStore, readProjectResource, mutateAnnotation, applyChanges, capturePreviewEvidence }
) => {
  switch (payload.method) {
    case 'initialize':
      routeInitializeRequest(payload, response)
      return
    case 'notifications/initialized':
      routeInitializedNotification(payload, response)
      return
    case 'tools/list':
      routeToolsListRequest(payload, response)
      return
    case 'resources/list':
      await routeResourcesListRequest(payload, response, { readProjectResource })
      return
    case 'tools/call':
      await routeToolsCallRequest(payload, response, {
        applyChanges,
        capturePreviewEvidence,
        previewCaptureStore,
        mutateAnnotation,
        readProjectResource,
      })
      return
    case 'resources/read':
      await routeResourcesReadRequest(payload, response, {
        previewCaptureStore,
        readProjectResource,
      })
      return
    default:
      sendJsonRpcError(response, {
        httpStatus: 200,
        id: getJsonRpcId(payload),
        code: -32601,
        message: `Desktop Arcade MCP method "${payload.method}" is not supported in v1.`,
      })
  }
}

const routeInitializeRequest = (payload, response) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP initialize requests must include a JSON-RPC id.',
    })
    return
  }

  if (payload.params !== undefined && !isPlainObject(payload.params)) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP initialize params must be an object when provided.',
    })
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      protocolVersion: DESKTOP_MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: DESKTOP_MCP_SERVER_NAME,
        version: DESKTOP_MCP_SERVER_VERSION,
      },
      instructions: DESKTOP_MCP_INSTRUCTIONS,
    },
  })
}

const routeInitializedNotification = (payload, response) => {
  sendNoContent(response, 202)
}

const routeToolsListRequest = (payload, response) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP tools/list requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['_meta'],
    id: payload.id,
    method: 'tools/list',
    response,
  })
  if (!params) {
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      tools: MCP_TOOL_DEFINITIONS,
    },
  })
}

const routeResourcesListRequest = async (payload, response, { readProjectResource }) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP resources/list requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['_meta'],
    id: payload.id,
    method: 'resources/list',
    response,
  })
  if (!params) {
    return
  }

  const dynamicResources = await listDynamicProjectResources(readProjectResource)

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      resources: [...MCP_STABLE_RESOURCE_DEFINITIONS, ...dynamicResources],
    },
  })
}

const routeToolsCallRequest = async (
  payload,
  response,
  { applyChanges, capturePreviewEvidence, previewCaptureStore, readProjectResource, mutateAnnotation }
) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP tools/call requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['name', 'arguments', '_meta'],
    id: payload.id,
    method: 'tools/call',
    response,
  })
  if (!params) {
    return
  }

  if (typeof params.name !== 'string' || params.name.trim().length === 0) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP tools/call params.name must be a non-empty string.',
    })
    return
  }

  const toolDefinition = findCallableToolDefinition(params.name)
  if (!toolDefinition) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: `Unknown Desktop Arcade MCP tool "${params.name}".`,
      data: {
        code: 'unknown-tool',
        toolName: params.name,
      },
    })
    return
  }

  const argumentsPayload = params.arguments === undefined ? {} : params.arguments
  if (!isPlainObject(argumentsPayload)) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: `Desktop Arcade MCP tool "${toolDefinition.name}" arguments must be an object when provided.`,
      data: {
        code: 'invalid-tool-arguments',
        toolName: toolDefinition.name,
      },
    })
    return
  }

  const validationMessage = validateToolArguments(toolDefinition.name, argumentsPayload)
  if (validationMessage) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: validationMessage,
      data: {
        code: 'invalid-tool-arguments',
        toolName: toolDefinition.name,
      },
    })
    return
  }

  try {
    if (toolDefinition.name === 'read_resource') {
      const resourceResult = await readDesktopResource(argumentsPayload.uri, {
        previewCaptureStore,
        readProjectResource,
      })

      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: resourceResult.ok
          ? createToolExecutionSuccessResult(
              resourceResult.text,
              {
                ok: true,
                uri: resourceResult.uri,
                mimeType: resourceResult.mimeType,
                text: resourceResult.text,
              }
            )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              resourceResult.code,
              resourceResult.message,
              {
                resourceUri: resourceResult.resourceUri,
              }
            ),
      })
      return
    }

    if (toolDefinition.name === 'list_annotations') {
      const listAnnotationsResult = await listAnnotations(argumentsPayload, { readProjectResource })
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: listAnnotationsResult.ok
          ? createToolExecutionSuccessResult(
              `Listed ${listAnnotationsResult.annotations.length} annotations from ${listAnnotationsResult.resourceUri}.`,
              listAnnotationsResult
            )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              listAnnotationsResult.code,
              listAnnotationsResult.message,
              {
                ...(listAnnotationsResult.resourceUri !== undefined
                  ? { resourceUri: listAnnotationsResult.resourceUri }
                  : {}),
                ...(listAnnotationsResult.manifestResourceUri !== undefined
                  ? { manifestResourceUri: listAnnotationsResult.manifestResourceUri }
                  : {}),
              }
            ),
      })
      return
    }

    if (toolDefinition.name === 'watch_annotations') {
      const watchAnnotationsResult = await watchAnnotations(argumentsPayload, { readProjectResource })
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: watchAnnotationsResult.ok
          ? createToolExecutionSuccessResult(
              watchAnnotationsResult.timedOut
                ? 'No pending annotations appeared before the watch timed out.'
                : `Watched ${watchAnnotationsResult.annotations.length} annotations from ${watchAnnotationsResult.resourceUri}.`,
              watchAnnotationsResult
            )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              watchAnnotationsResult.code,
              watchAnnotationsResult.message,
              {
                ...(watchAnnotationsResult.resourceUri !== undefined
                  ? { resourceUri: watchAnnotationsResult.resourceUri }
                  : {}),
                ...(watchAnnotationsResult.manifestResourceUri !== undefined
                  ? { manifestResourceUri: watchAnnotationsResult.manifestResourceUri }
                  : {}),
              }
            ),
      })
      return
    }

    if (
      toolDefinition.name === 'acknowledge_annotation' ||
      toolDefinition.name === 'resolve_annotation' ||
      toolDefinition.name === 'dismiss_annotation' ||
      toolDefinition.name === 'reply_to_annotation'
    ) {
      const mutationResult = await mutateAnnotation({
        toolName: toolDefinition.name,
        ...argumentsPayload,
      })
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: isDesktopMcpAnnotationMutationResult(mutationResult)
          ? mutationResult.ok
            ? createToolExecutionSuccessResult(mutationResult.message, mutationResult)
            : createToolExecutionErrorResult(
                toolDefinition.name,
                mutationResult.code,
                mutationResult.message,
                {
                  annotationId: mutationResult.annotationId,
                }
              )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              'project-unavailable',
              'Desktop Arcade MCP annotation mutation returned an invalid renderer response.'
            ),
      })
      return
    }

    if (toolDefinition.name === 'capture_preview_evidence') {
      const captureResult = await capturePreviewEvidence(argumentsPayload)
      if (!isCapturePreviewResult(captureResult)) {
        sendJson(response, 200, {
          jsonrpc: '2.0',
          id: payload.id,
          result: createToolExecutionErrorResult(
            toolDefinition.name,
            'project-unavailable',
            'Desktop Arcade MCP capture_preview_evidence returned an invalid renderer response.'
          ),
        })
        return
      }

      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: captureResult.ok
          ? createToolExecutionSuccessResult(
              `Captured Preview evidence: ${captureResult.summary}`,
              toPublicCapturePreviewResult(captureResult)
            )
          : createToolExecutionErrorResult(
              toolDefinition.name,
              captureResult.code,
              captureResult.message,
              {
                ...(captureResult.manifestResourceUri !== undefined
                  ? { manifestResourceUri: captureResult.manifestResourceUri }
                  : {}),
                ...(captureResult.interactions !== undefined
                    ? { interactions: redactCapturePreviewFailureInteractions(captureResult.interactions) }
                  : {}),
                ...(captureResult.currentPageId !== undefined
                  ? { currentPageId: captureResult.currentPageId }
                  : {}),
              }
            ),
      })
      return
    }

    const applyChangesResult = await applyChanges(argumentsPayload)
    if (!isApplyChangesResult(applyChangesResult)) {
      sendJson(response, 200, {
        jsonrpc: '2.0',
        id: payload.id,
        result: createToolExecutionErrorResult(
          toolDefinition.name,
          'project-unavailable',
          'Desktop Arcade MCP apply_changes returned an invalid renderer response.'
        ),
      })
      return
    }

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: applyChangesResult.ok
        ? createToolExecutionSuccessResult(
            `Applied changes: ${applyChangesResult.summary}`,
            { ...applyChangesResult, nextSteps: APPLY_CHANGES_NEXT_STEPS }
          )
        : createToolExecutionErrorResult(
            toolDefinition.name,
            applyChangesResult.code,
            applyChangesResult.message,
            {
              ...(applyChangesResult.manifestResourceUri !== undefined
                ? { manifestResourceUri: applyChangesResult.manifestResourceUri }
                : {}),
              ...(applyChangesResult.resourceUri !== undefined
                ? { resourceUri: applyChangesResult.resourceUri }
                : {}),
              ...(applyChangesResult.expectedProjectRevision !== undefined
                ? { expectedProjectRevision: applyChangesResult.expectedProjectRevision }
                : {}),
              ...(applyChangesResult.currentProjectRevision !== undefined
                ? { currentProjectRevision: applyChangesResult.currentProjectRevision }
                : {}),
            }
          ),
    })
  } catch (error) {
    const unexpectedMessage =
      toolDefinition.name === 'list_annotations'
        ? 'Desktop Arcade MCP list_annotations failed unexpectedly.'
        : toolDefinition.name === 'watch_annotations'
        ? 'Desktop Arcade MCP watch_annotations failed unexpectedly.'
        : VALID_ANNOTATION_MUTATION_TOOL_NAMES.includes(toolDefinition.name)
        ? `Desktop Arcade MCP ${toolDefinition.name} failed unexpectedly.`
        : toolDefinition.name === 'capture_preview_evidence'
        ? 'Desktop Arcade MCP capture_preview_evidence failed unexpectedly.'
        : 'Desktop Arcade MCP apply_changes failed unexpectedly.'

    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: payload.id,
      result: createToolExecutionErrorResult(
        toolDefinition.name,
        'project-unavailable',
        error instanceof Error ? error.message : unexpectedMessage
      ),
    })
  }
}

const readDesktopResource = async (uri, { previewCaptureStore, readProjectResource }) => {
  if (isPreviewCaptureResourceUri(uri)) {
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
    let resourceResult
    try {
      resourceResult = await readProjectResource({ uri })
    } catch (error) {
      return {
        ok: false,
        code: 'project-unavailable',
        resourceUri: uri,
        message:
          error instanceof Error ? error.message : `Desktop Arcade MCP resource "${uri}" is unavailable.`,
      }
    }

    if (!isProjectResourceReadResult(resourceResult, uri)) {
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

  if (isAkselComponentResourceUri(uri)) {
    const match = uri.match(AKSEL_COMPONENT_RESOURCE_URI_PATTERN)
    const requestedName = decodeAkselComponentName(match ? match[1] : '')
    return {
      ok: true,
      uri,
      mimeType: 'application/json',
      text: createAkselComponentResourceText(resolveAkselComponentRequest(requestedName)),
    }
  }

  const resourceDefinition = MCP_STABLE_RESOURCE_DEFINITIONS.find((resource) => resource.uri === uri)
  if (!resourceDefinition) {
    return {
      ok: false,
      code: 'resource-not-found',
      resourceUri: uri,
      message: `Unknown Desktop Arcade MCP resource "${uri}".`,
    }
  }

  const desktopResourceText = createDesktopStableResourceText(resourceDefinition.uri)
  if (desktopResourceText !== null) {
    return {
      ok: true,
      uri: resourceDefinition.uri,
      mimeType: resourceDefinition.mimeType,
      text: desktopResourceText,
    }
  }

  return {
    ok: false,
    code: 'not-yet-implemented',
    resourceUri: resourceDefinition.uri,
    message: `Desktop Arcade MCP resource "${resourceDefinition.uri}" is not implemented yet.`,
  }
}

const listDynamicProjectResources = async (readProjectResource) => {
  const manifestResult = await readProjectJsonResource(readProjectResource, 'arcade://project/manifest')
  if (!manifestResult.ok) {
    return []
  }

  const pages = Array.isArray(manifestResult.value?.pages) ? manifestResult.value.pages : []
  return pages
    .filter(
      (page) =>
        isPlainObject(page) &&
        typeof page.id === 'string' &&
        /^page\d+$/.test(page.id) &&
        typeof page.name === 'string'
    )
    .map((page) =>
      Object.freeze({
        uri: `arcade://project/pages/${page.id}/annotations`,
        name: `Arcade page annotations: ${page.name}`,
        description: `Non-dead annotations for Arcade page ${page.name} (${page.id}).`,
        mimeType: 'application/json',
      })
    )
}

const listAnnotations = async (argumentsPayload, { readProjectResource }) => {
  const manifestResourceUri = 'arcade://project/manifest'
  const scope = argumentsPayload.scope ?? 'page'
  const status = argumentsPayload.status ?? DEFAULT_LIST_ANNOTATIONS_STATUS
  const manifestResult = await readProjectJsonResource(readProjectResource, manifestResourceUri)
  if (!manifestResult.ok) {
    return manifestResult
  }

  const manifest = manifestResult.value
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : []
  const activePageId =
    typeof manifest?.activePageId === 'string' && /^page\d+$/.test(manifest.activePageId)
      ? manifest.activePageId
      : null

  if (scope === 'project') {
    const resourceUri = PROJECT_ANNOTATIONS_RESOURCE_URI
    const annotationsResult = await readProjectJsonResource(readProjectResource, resourceUri)
    if (!annotationsResult.ok) {
      return annotationsResult
    }

    const annotations = filterListedAnnotations(annotationsResult.value?.annotations, status)
    if (!annotations) {
      return {
        ok: false,
        code: 'project-unavailable',
        resourceUri,
        manifestResourceUri,
        message: `Desktop Arcade MCP resource "${resourceUri}" returned malformed annotation data.`,
      }
    }

    return {
      ok: true,
      scope,
      status,
      resourceUri,
      manifestResourceUri,
      counts: {
        ...(isPlainObject(annotationsResult.value?.counts) ? annotationsResult.value.counts : {}),
        matching: annotations.length,
      },
      annotations,
    }
  }

  const pageId = argumentsPayload.pageId ?? activePageId
  if (typeof pageId !== 'string') {
    return {
      ok: false,
      code: 'project-unavailable',
      manifestResourceUri,
      message: 'Desktop Arcade MCP could not determine an active Arcade page for list_annotations.',
    }
  }

  const pageExists = pages.some((page) => isPlainObject(page) && page.id === pageId)
  if (!pageExists) {
    return {
      ok: false,
      code: 'invalid-page-id',
      resourceUri: manifestResourceUri,
      manifestResourceUri,
      message: `list_annotations could not find Arcade page "${pageId}". Re-read arcade://project/manifest before retrying.`,
    }
  }

  const resourceUri = `arcade://project/pages/${pageId}/annotations`
  const annotationsResult = await readProjectJsonResource(readProjectResource, resourceUri)
  if (!annotationsResult.ok) {
    return annotationsResult
  }

  const annotations = filterListedAnnotations(annotationsResult.value?.annotations, status)
  if (!annotations) {
    return {
      ok: false,
      code: 'project-unavailable',
      resourceUri,
      manifestResourceUri,
      message: `Desktop Arcade MCP resource "${resourceUri}" returned malformed annotation data.`,
    }
  }

  return {
    ok: true,
    scope,
    status,
    resourceUri,
    manifestResourceUri,
    page: isPlainObject(annotationsResult.value?.page) ? annotationsResult.value.page : undefined,
    counts: {
      ...(isPlainObject(annotationsResult.value?.counts) ? annotationsResult.value.counts : {}),
      matching: annotations.length,
    },
    annotations,
  }
}

const watchAnnotations = async (argumentsPayload, { readProjectResource }) => {
  const scope = argumentsPayload.scope ?? 'page'
  const waitTimeoutSeconds = argumentsPayload.waitTimeoutSeconds ?? 120
  const batchWindowSeconds = argumentsPayload.batchWindowSeconds ?? 10
  const resourceArguments = {
    scope,
    ...(argumentsPayload.pageId !== undefined ? { pageId: argumentsPayload.pageId } : {}),
    status: 'pending',
  }
  const firstSnapshot = await listAnnotations(resourceArguments, { readProjectResource })
  if (!firstSnapshot.ok) {
    return firstSnapshot
  }

  if (firstSnapshot.annotations.length > 0) {
    return {
      ...firstSnapshot,
      timedOut: false,
    }
  }

  const observedAnnotations = new Map()
  let currentSnapshot = firstSnapshot
  const deadline = Date.now() + waitTimeoutSeconds * 1000

  while (Date.now() < deadline) {
    await sleep(Math.min(250, Math.max(50, deadline - Date.now())))
    currentSnapshot = await listAnnotations(resourceArguments, { readProjectResource })
    if (!currentSnapshot.ok) {
      return currentSnapshot
    }

    if (currentSnapshot.annotations.length === 0) {
      continue
    }

    for (const annotation of currentSnapshot.annotations) {
      observedAnnotations.set(annotation.id, annotation)
    }

    const batchDeadline = Date.now() + batchWindowSeconds * 1000
    while (Date.now() < batchDeadline) {
      await sleep(Math.min(250, Math.max(50, batchDeadline - Date.now())))
      const batchSnapshot = await listAnnotations(resourceArguments, { readProjectResource })
      if (!batchSnapshot.ok) {
        return batchSnapshot
      }

      for (const annotation of batchSnapshot.annotations) {
        observedAnnotations.set(annotation.id, annotation)
      }
    }

    const finalAnnotations = Array.from(observedAnnotations.values())
    return {
      ...currentSnapshot,
      annotations: finalAnnotations,
      counts: {
        ...(currentSnapshot.counts ?? {}),
        matching: finalAnnotations.length,
      },
      timedOut: false,
      waitTimeoutSeconds,
      batchWindowSeconds,
    }
  }

  return {
    ...currentSnapshot,
    timedOut: true,
    waitTimeoutSeconds,
    batchWindowSeconds,
    annotations: [],
    counts: {
      ...(currentSnapshot.counts ?? {}),
      matching: 0,
    },
  }
}

const readProjectJsonResource = async (readProjectResource, resourceUri) => {
  let resourceResult
  try {
    resourceResult = await readProjectResource({ uri: resourceUri })
  } catch (error) {
    return {
      ok: false,
      code: 'project-unavailable',
      resourceUri,
      message: error instanceof Error ? error.message : `Desktop Arcade MCP resource "${resourceUri}" is unavailable.`,
    }
  }

  if (!isProjectResourceReadResult(resourceResult, resourceUri)) {
    return {
      ok: false,
      code: 'project-unavailable',
      resourceUri,
      message: `Desktop Arcade MCP resource "${resourceUri}" returned an invalid project resource response.`,
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

  try {
    return {
      ok: true,
      resourceUri: resourceResult.uri,
      value: JSON.parse(resourceResult.text),
    }
  } catch {
    return {
      ok: false,
      code: 'project-unavailable',
      resourceUri: resourceResult.uri,
      message: `Desktop Arcade MCP resource "${resourceUri}" did not return valid JSON.`,
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const filterListedAnnotations = (annotations, status) => {
  if (!Array.isArray(annotations)) {
    return null
  }

  return annotations.filter((annotation) => {
    if (!isPlainObject(annotation)) {
      return false
    }

    const annotationStatus = annotation.status ?? 'pending'
    switch (status) {
      case 'open':
        return annotationStatus === 'pending' || annotationStatus === 'acknowledged'
      case 'all':
        return true
      default:
        return annotationStatus === status
    }
  })
}

const routeResourcesReadRequest = async (
  payload,
  response,
  { previewCaptureStore, readProjectResource }
) => {
  if (!isJsonRpcResponseId(payload.id)) {
    sendJsonRpcError(response, {
      httpStatus: 400,
      id: null,
      code: -32600,
      message: 'Desktop Arcade MCP resources/read requests must include a JSON-RPC id.',
    })
    return
  }

  const params = readStrictParamsObject(payload, {
    allowedKeys: ['uri', '_meta'],
    id: payload.id,
    method: 'resources/read',
    response,
  })
  if (!params) {
    return
  }

  if (typeof params.uri !== 'string' || params.uri.trim().length === 0) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32602,
      message: 'Desktop Arcade MCP resources/read params.uri must be a non-empty string.',
      data: {
        code: 'invalid-resource-uri',
      },
    })
    return
  }

  const resourceResult = await readDesktopResource(params.uri, {
    previewCaptureStore,
    readProjectResource,
  })
  if (!resourceResult.ok) {
    sendJsonRpcError(response, {
      id: payload.id,
      code: -32002,
      message: resourceResult.message,
      data: {
        code: resourceResult.code,
        resourceUri: resourceResult.resourceUri,
      },
    })
    return
  }

  sendJson(response, 200, {
    jsonrpc: '2.0',
    id: payload.id,
    result: {
      contents: [
        {
          uri: resourceResult.uri,
          mimeType: resourceResult.mimeType,
          text: resourceResult.text,
        },
      ],
    },
  })
}

const isKnownProjectResourceUri = (uri) =>
  uri === 'arcade://project/manifest' ||
  uri === PROJECT_ANNOTATIONS_RESOURCE_URI ||
  uri === 'arcade://project/preview-context' ||
  uri === 'arcade://project/diagnostics' ||
  uri === 'arcade://project/source/global/jsx' ||
  uri === 'arcade://project/source/global/hooks' ||
  PROJECT_PAGE_ANNOTATIONS_URI_PATTERN.test(uri) ||
  PROJECT_SOURCE_PAGE_URI_PATTERN.test(uri)

const isPreviewCaptureResourceUri = (uri) => PREVIEW_CAPTURE_RESOURCE_URI_PATTERN.test(uri)

const readStrictParamsObject = (payload, { allowedKeys, id, method, response }) => {
  const params = payload.params === undefined ? {} : payload.params
  if (!isPlainObject(params)) {
    sendJsonRpcError(response, {
      id,
      code: -32602,
      message: `Desktop Arcade MCP ${method} params must be an object when provided.`,
    })
    return null
  }

  const extraKeys = getUnexpectedKeys(params, allowedKeys)
  if (extraKeys.length > 0) {
    sendJsonRpcError(response, {
      id,
      code: -32602,
      message: `Desktop Arcade MCP ${method} params contain unsupported fields: ${extraKeys.join(', ')}.`,
    })
    return null
  }

  return params
}

const validateToolArguments = (toolName, argumentsPayload) => {
  switch (toolName) {
    case 'read_resource':
      return validateReadResourceArguments(argumentsPayload)
    case 'list_annotations':
      return validateListAnnotationsArguments(argumentsPayload)
    case 'watch_annotations':
      return validateWatchAnnotationsArguments(argumentsPayload)
    case 'acknowledge_annotation':
      return validateAcknowledgeAnnotationArguments(argumentsPayload)
    case 'resolve_annotation':
      return validateResolveAnnotationArguments(argumentsPayload)
    case 'dismiss_annotation':
      return validateDismissAnnotationArguments(argumentsPayload)
    case 'reply_to_annotation':
      return validateReplyToAnnotationArguments(argumentsPayload)
    case 'capture_preview_evidence':
      return validateCapturePreviewEvidenceArguments(argumentsPayload)
    case 'apply_changes':
      return validateApplyChangesArguments(argumentsPayload)
    default:
      return `Unknown Desktop Arcade MCP tool "${toolName}".`
  }
}

const validateReadResourceArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, ['uri'])
  if (extraKeys.length > 0) {
    return `read_resource arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (typeof argumentsPayload.uri !== 'string' || argumentsPayload.uri.trim().length === 0) {
    return 'read_resource uri must be a non-empty string.'
  }

  return null
}

const validateListAnnotationsArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, ['scope', 'pageId', 'status'])
  if (extraKeys.length > 0) {
    return `list_annotations arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    'scope' in argumentsPayload &&
    (typeof argumentsPayload.scope !== 'string' ||
      !['page', 'project'].includes(argumentsPayload.scope))
  ) {
    return 'list_annotations scope must be "page" or "project" when provided.'
  }

  if (
    'pageId' in argumentsPayload &&
    (typeof argumentsPayload.pageId !== 'string' || !/^page\d+$/.test(argumentsPayload.pageId))
  ) {
    return 'list_annotations pageId must be an Arcade page id like "page01" when provided.'
  }

  if (
    'status' in argumentsPayload &&
    (typeof argumentsPayload.status !== 'string' ||
      !LIST_ANNOTATIONS_STATUSES.includes(argumentsPayload.status))
  ) {
    return `list_annotations status must be one of ${LIST_ANNOTATIONS_STATUSES.join(', ')}.`
  }

  if (argumentsPayload.scope === 'project' && argumentsPayload.pageId !== undefined) {
    return 'list_annotations pageId may be provided only when scope is "page".'
  }

  return null
}

const validateWatchAnnotationsArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, ['scope', 'pageId', 'waitTimeoutSeconds', 'batchWindowSeconds'])
  if (extraKeys.length > 0) {
    return `watch_annotations arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    'scope' in argumentsPayload &&
    (typeof argumentsPayload.scope !== 'string' ||
      !['page', 'project'].includes(argumentsPayload.scope))
  ) {
    return 'watch_annotations scope must be "page" or "project" when provided.'
  }

  if (
    'pageId' in argumentsPayload &&
    (typeof argumentsPayload.pageId !== 'string' || !/^page\d+$/.test(argumentsPayload.pageId))
  ) {
    return 'watch_annotations pageId must be an Arcade page id like "page01" when provided.'
  }

  if (
    'waitTimeoutSeconds' in argumentsPayload &&
    (!Number.isInteger(argumentsPayload.waitTimeoutSeconds) ||
      argumentsPayload.waitTimeoutSeconds < 1 ||
      argumentsPayload.waitTimeoutSeconds > 300)
  ) {
    return 'watch_annotations waitTimeoutSeconds must be an integer between 1 and 300 when provided.'
  }

  if (
    'batchWindowSeconds' in argumentsPayload &&
    (!Number.isInteger(argumentsPayload.batchWindowSeconds) ||
      argumentsPayload.batchWindowSeconds < 1 ||
      argumentsPayload.batchWindowSeconds > 60)
  ) {
    return 'watch_annotations batchWindowSeconds must be an integer between 1 and 60 when provided.'
  }

  if (argumentsPayload.scope === 'project' && argumentsPayload.pageId !== undefined) {
    return 'watch_annotations pageId may be provided only when scope is "page".'
  }

  return null
}

const validateAnnotationMutationArguments = (argumentsPayload, toolName, allowedFields, requiredField) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, allowedFields)
  if (extraKeys.length > 0) {
    return `${toolName} arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    typeof argumentsPayload.annotationId !== 'string' ||
    argumentsPayload.annotationId.trim().length === 0
  ) {
    return `${toolName} annotationId must be a non-empty string.`
  }

  if (requiredField === 'message') {
    if (
      typeof argumentsPayload.message !== 'string' ||
      argumentsPayload.message.trim().length === 0
    ) {
      return 'reply_to_annotation message must be a non-empty string.'
    }
  }

  if (requiredField === 'reason') {
    if (
      typeof argumentsPayload.reason !== 'string' ||
      argumentsPayload.reason.trim().length === 0
    ) {
      return 'dismiss_annotation reason must be a non-empty string.'
    }
  }

  if (
    requiredField === 'summary' &&
    'summary' in argumentsPayload &&
    typeof argumentsPayload.summary !== 'string'
  ) {
    return 'resolve_annotation summary must be a string when provided.'
  }

  return null
}

const validateAcknowledgeAnnotationArguments = (argumentsPayload) =>
  validateAnnotationMutationArguments(argumentsPayload, 'acknowledge_annotation', ['annotationId'], null)

const validateResolveAnnotationArguments = (argumentsPayload) =>
  validateAnnotationMutationArguments(argumentsPayload, 'resolve_annotation', ['annotationId', 'summary'], 'summary')

const validateDismissAnnotationArguments = (argumentsPayload) =>
  validateAnnotationMutationArguments(argumentsPayload, 'dismiss_annotation', ['annotationId', 'reason'], 'reason')

const validateReplyToAnnotationArguments = (argumentsPayload) =>
  validateAnnotationMutationArguments(argumentsPayload, 'reply_to_annotation', ['annotationId', 'message'], 'message')

const validateCapturePreviewEvidenceArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, [
    'pageId',
    'viewportSize',
    'theme',
    'layers',
    'screenshotScope',
    'includeAnnotationOverlays',
    'target',
    'interactions',
  ])
  if (extraKeys.length > 0) {
    return `capture_preview_evidence arguments contain unsupported fields: ${extraKeys.join(
      ', '
    )}.`
  }

  if (
    'pageId' in argumentsPayload &&
    (typeof argumentsPayload.pageId !== 'string' || argumentsPayload.pageId.trim().length === 0)
  ) {
    return 'capture_preview_evidence pageId must be a non-empty string.'
  }

  if (
    'viewportSize' in argumentsPayload &&
    !VALID_VIEWPORT_SIZES.includes(argumentsPayload.viewportSize)
  ) {
    return `capture_preview_evidence viewportSize must be one of ${VALID_VIEWPORT_SIZES.join(
      ', '
    )}.`
  }

  if ('theme' in argumentsPayload && !VALID_THEMES.includes(argumentsPayload.theme)) {
    return `capture_preview_evidence theme must be one of ${VALID_THEMES.join(', ')}.`
  }

  if (
    'includeAnnotationOverlays' in argumentsPayload &&
    typeof argumentsPayload.includeAnnotationOverlays !== 'boolean'
  ) {
    return 'capture_preview_evidence includeAnnotationOverlays must be a boolean when provided.'
  }

  if ('layers' in argumentsPayload) {
    if (!Array.isArray(argumentsPayload.layers)) {
      return 'capture_preview_evidence layers must be an array when provided.'
    }

    if (argumentsPayload.layers.length === 0) {
      return 'capture_preview_evidence layers must include at least one requested layer.'
    }

    const invalidLayer = argumentsPayload.layers.find(
      (layer) => typeof layer !== 'string' || !VALID_PREVIEW_CAPTURE_LAYERS.includes(layer)
    )
    if (invalidLayer !== undefined) {
      return `capture_preview_evidence layers must be drawn from ${VALID_PREVIEW_CAPTURE_LAYERS.join(
        ', '
      )}.`
    }

    if (new Set(argumentsPayload.layers).size !== argumentsPayload.layers.length) {
      return 'capture_preview_evidence layers must not contain duplicate values.'
    }
  }

  if (
    'screenshotScope' in argumentsPayload &&
    !VALID_PREVIEW_SCREENSHOT_SCOPES.includes(argumentsPayload.screenshotScope)
  ) {
    return `capture_preview_evidence screenshotScope must be one of ${VALID_PREVIEW_SCREENSHOT_SCOPES.join(
      ', '
    )}.`
  }

  if ('target' in argumentsPayload) {
    const targetValidationError = validatePreviewCaptureTarget(argumentsPayload.target, {
      context: 'capture_preview_evidence target',
    })
    if (targetValidationError) {
      return targetValidationError
    }
  }

  if (argumentsPayload.screenshotScope === 'region' && argumentsPayload.target === undefined) {
    return 'capture_preview_evidence screenshotScope "region" requires a target.'
  }

  if (argumentsPayload.screenshotScope !== 'region' && argumentsPayload.target !== undefined) {
    return 'capture_preview_evidence target may be provided only when screenshotScope is "region".'
  }

  if (
    argumentsPayload.includeAnnotationOverlays === true &&
    Array.isArray(argumentsPayload.layers) &&
    !argumentsPayload.layers.includes('screenshot')
  ) {
    return 'capture_preview_evidence includeAnnotationOverlays requires the screenshot layer.'
  }

  if ('interactions' in argumentsPayload) {
    if (!Array.isArray(argumentsPayload.interactions)) {
      return 'capture_preview_evidence interactions must be an array when provided.'
    }

    if (argumentsPayload.interactions.length === 0) {
      return 'capture_preview_evidence interactions must include at least one step when provided.'
    }

    if (argumentsPayload.interactions.length > MAX_PREVIEW_INTERACTION_STEPS) {
      return `capture_preview_evidence interactions must not exceed ${MAX_PREVIEW_INTERACTION_STEPS} steps.`
    }

    for (const [index, interaction] of argumentsPayload.interactions.entries()) {
      const interactionError = validatePreviewInteractionStep(interaction, index)
      if (interactionError) {
        return interactionError
      }
    }
  }

  return null
}

const validatePreviewCaptureTarget = (value, { context }) => {
  if (!isPlainObject(value)) {
    return `${context} must be an object when provided.`
  }

  const extraTargetKeys = getUnexpectedKeys(value, ['selector', 'role', 'name', 'text', 'label'])
  if (extraTargetKeys.length > 0) {
    return `${context} contains unsupported fields: ${extraTargetKeys.join(', ')}.`
  }

  const targetFields = ['selector', 'role', 'name', 'text', 'label'].filter((key) => {
    const targetValue = value[key]
    return targetValue !== undefined
  })
  if (targetFields.length === 0) {
    return `${context} must include at least one selector or accessibility field.`
  }

  for (const key of targetFields) {
    const targetValue = value[key]
    if (typeof targetValue !== 'string' || targetValue.trim().length === 0) {
      return `${context}.${key} must be a non-empty string when provided.`
    }
  }

  return null
}

const validatePreviewInteractionStep = (value, index) => {
  if (!isPlainObject(value)) {
    return `capture_preview_evidence interactions[${index}] must be an object.`
  }

  const extraKeys = getUnexpectedKeys(value, [
    'action',
    'target',
    'value',
    'checked',
    'key',
    'x',
    'y',
    'text',
    'renderIdle',
    'timeoutMs',
  ])
  if (extraKeys.length > 0) {
    return `capture_preview_evidence interactions[${index}] contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    typeof value.action !== 'string' ||
    !VALID_PREVIEW_INTERACTION_ACTIONS.includes(value.action)
  ) {
    return `capture_preview_evidence interactions[${index}].action must be one of ${VALID_PREVIEW_INTERACTION_ACTIONS.join(', ')}.`
  }

  if (value.target !== undefined) {
    const targetError = validatePreviewCaptureTarget(value.target, {
      context: `capture_preview_evidence interactions[${index}].target`,
    })
    if (targetError) {
      return targetError
    }
  }

  if ('value' in value && typeof value.value !== 'string') {
    return `capture_preview_evidence interactions[${index}].value must be a string when provided.`
  }

  if ('checked' in value && typeof value.checked !== 'boolean') {
    return `capture_preview_evidence interactions[${index}].checked must be a boolean when provided.`
  }

  if ('key' in value && typeof value.key !== 'string') {
    return `capture_preview_evidence interactions[${index}].key must be a string when provided.`
  }

  if (
    typeof value.key === 'string' &&
    !VALID_PREVIEW_PRESS_KEYS.includes(value.key.trim()) &&
    !/^[^\s]$/.test(value.key.trim())
  ) {
    return `capture_preview_evidence interactions[${index}].key must be a supported bounded key or a single printable character.`
  }

  if ('text' in value && (typeof value.text !== 'string' || value.text.trim().length === 0)) {
    return `capture_preview_evidence interactions[${index}].text must be a non-empty string when provided.`
  }

  if ('renderIdle' in value && value.renderIdle !== true) {
    return `capture_preview_evidence interactions[${index}].renderIdle must be true when provided.`
  }

  for (const key of ['x', 'y']) {
    if (key in value && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      return `capture_preview_evidence interactions[${index}].${key} must be a finite number when provided.`
    }
  }

  if (
    'timeoutMs' in value &&
    (typeof value.timeoutMs !== 'number' ||
      !Number.isFinite(value.timeoutMs) ||
      value.timeoutMs <= 0 ||
      value.timeoutMs > MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS)
  ) {
    return `capture_preview_evidence interactions[${index}].timeoutMs must be a positive number no greater than ${MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS}.`
  }

  switch (value.action) {
    case 'click':
      if (value.target === undefined) {
        return `capture_preview_evidence interactions[${index}] click steps require a target.`
      }
      return null
    case 'fill':
      if (value.target === undefined) {
        return `capture_preview_evidence interactions[${index}] fill steps require a target.`
      }
      if (typeof value.value !== 'string') {
        return `capture_preview_evidence interactions[${index}] fill steps require a string value.`
      }
      return null
    case 'select':
      if (value.target === undefined) {
        return `capture_preview_evidence interactions[${index}] select steps require a target.`
      }
      if ((typeof value.value === 'string') === (typeof value.checked === 'boolean')) {
        return `capture_preview_evidence interactions[${index}] select steps require exactly one of value or checked.`
      }
      return null
    case 'press':
      if (typeof value.key !== 'string' || value.key.trim().length === 0) {
        return `capture_preview_evidence interactions[${index}] press steps require a key.`
      }
      return null
    case 'scroll':
      if (
        (typeof value.x !== 'number' || !Number.isFinite(value.x)) &&
        (typeof value.y !== 'number' || !Number.isFinite(value.y))
      ) {
        return `capture_preview_evidence interactions[${index}] scroll steps require an x or y delta.`
      }
      return null
    case 'waitFor': {
      const waitConditions = Number(typeof value.text === 'string') +
        Number(value.target !== undefined) +
        Number(value.renderIdle === true)
      if (waitConditions !== 1) {
        return `capture_preview_evidence interactions[${index}] waitFor steps require exactly one of text, target, or renderIdle.`
      }
      return null
    }
    default:
      return `capture_preview_evidence interactions[${index}].action is not supported.`
  }
}

const validateApplyChangesArguments = (argumentsPayload) => {
  const extraKeys = getUnexpectedKeys(argumentsPayload, [
    'summary',
    'expectedProjectRevision',
    'operations',
    'assertions',
  ])
  if (extraKeys.length > 0) {
    return `apply_changes arguments contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    typeof argumentsPayload.summary !== 'string' ||
    argumentsPayload.summary.trim().length === 0
  ) {
    return 'apply_changes summary must be a non-empty string.'
  }

  if (
    'expectedProjectRevision' in argumentsPayload &&
    (typeof argumentsPayload.expectedProjectRevision !== 'string' ||
      argumentsPayload.expectedProjectRevision.trim().length === 0)
  ) {
    return 'apply_changes expectedProjectRevision must be a non-empty string when provided.'
  }

  if (!Array.isArray(argumentsPayload.operations)) {
    return 'apply_changes operations must be an array.'
  }

  if (argumentsPayload.operations.length === 0) {
    return 'apply_changes operations must include at least one operation.'
  }

  for (const [index, operation] of argumentsPayload.operations.entries()) {
    const operationValidationMessage = validateApplyChangesOperation(operation, index)
    if (operationValidationMessage) {
      return operationValidationMessage
    }
  }

  if ('assertions' in argumentsPayload) {
    const assertionsValidationMessage = validateApplyChangesAssertions(argumentsPayload.assertions)
    if (assertionsValidationMessage) {
      return assertionsValidationMessage
    }
  }

  return null
}

const validateApplyChangesAssertions = (assertions) => {
  if (!isPlainObject(assertions)) {
    return 'apply_changes assertions must be an object when provided.'
  }

  const extraKeys = getUnexpectedKeys(assertions, [
    'pageCount',
    'startPage',
    'activePage',
    'forbidImports',
  ])
  if (extraKeys.length > 0) {
    return `apply_changes assertions contain unsupported fields: ${extraKeys.join(', ')}.`
  }

  if (
    'pageCount' in assertions &&
    (!Number.isInteger(assertions.pageCount) || assertions.pageCount < 1)
  ) {
    return 'apply_changes assertions.pageCount must be a positive integer when provided.'
  }

  for (const fieldName of ['startPage', 'activePage']) {
    if (
      fieldName in assertions &&
      (typeof assertions[fieldName] !== 'string' ||
        (assertions[fieldName] !== 'first' && !/^page\d+$/.test(assertions[fieldName])))
    ) {
      return `apply_changes assertions.${fieldName} must be "first" or an Arcade page id when provided.`
    }
  }

  if ('forbidImports' in assertions && typeof assertions.forbidImports !== 'boolean') {
    return 'apply_changes assertions.forbidImports must be a boolean when provided.'
  }

  return null
}

const validateApplyChangesOperation = (operation, index) => {
  if (!isPlainObject(operation)) {
    return `apply_changes operation ${index} must be an object.`
  }

  if (typeof operation.type !== 'string' || operation.type.trim().length === 0) {
    return `apply_changes operation ${index} type must be a non-empty string.`
  }

  switch (operation.type) {
    case 'replace_source': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'resourceUri', 'content'])
      if (extraKeys.length > 0) {
        return `apply_changes replace_source operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.resourceUri !== 'string' || operation.resourceUri.trim().length === 0) {
        return `apply_changes replace_source operation ${index} resourceUri must be a non-empty string.`
      }

      if (typeof operation.content !== 'string') {
        return `apply_changes replace_source operation ${index} content must be a string.`
      }

      return null
    }
    case 'create_page': {
      const extraKeys = getUnexpectedKeys(operation, [
        'type',
        'name',
        'newPageRef',
        'jsxCode',
        'hooksCode',
      ])
      if (extraKeys.length > 0) {
        return `apply_changes create_page operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (
        operation.name !== undefined &&
        (typeof operation.name !== 'string' || operation.name.trim().length === 0)
      ) {
        return `apply_changes create_page operation ${index} name must be a non-empty string when provided.`
      }

      if (
        operation.newPageRef !== undefined &&
        (typeof operation.newPageRef !== 'string' || operation.newPageRef.trim().length === 0)
      ) {
        return `apply_changes create_page operation ${index} newPageRef must be a non-empty string when provided.`
      }

      if (operation.jsxCode !== undefined && typeof operation.jsxCode !== 'string') {
        return `apply_changes create_page operation ${index} jsxCode must be a string when provided.`
      }

      if (operation.hooksCode !== undefined && typeof operation.hooksCode !== 'string') {
        return `apply_changes create_page operation ${index} hooksCode must be a string when provided.`
      }

      return null
    }
    case 'rename_page': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'name', 'pageId', 'tempPageRef'])
      if (extraKeys.length > 0) {
        return `apply_changes rename_page operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.name !== 'string' || operation.name.trim().length === 0) {
        return `apply_changes rename_page operation ${index} name must be a non-empty string.`
      }

      return validateApplyChangesPageTarget(operation, index, 'rename_page', ['name'])
    }
    case 'delete_page':
      return validateApplyChangesPageTarget(operation, index, 'delete_page')
    case 'set_start_page':
      return validateApplyChangesPageTarget(operation, index, 'set_start_page')
    case 'select_active_page':
      return validateApplyChangesPageTarget(operation, index, 'select_active_page')
    case 'set_preview_context': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'viewportSize', 'theme'])
      if (extraKeys.length > 0) {
        return `apply_changes set_preview_context operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (operation.viewportSize === undefined && operation.theme === undefined) {
        return `apply_changes set_preview_context operation ${index} must set viewportSize and/or theme.`
      }

      if (
        operation.viewportSize !== undefined &&
        !VALID_VIEWPORT_SIZES.includes(operation.viewportSize)
      ) {
        return `apply_changes set_preview_context operation ${index} viewportSize must be one of ${VALID_VIEWPORT_SIZES.join(
          ', '
        )}.`
      }

      if (operation.theme !== undefined && !VALID_THEMES.includes(operation.theme)) {
        return `apply_changes set_preview_context operation ${index} theme must be one of ${VALID_THEMES.join(
          ', '
        )}.`
      }

      return null
    }
    case 'rename_project': {
      const extraKeys = getUnexpectedKeys(operation, ['type', 'name'])
      if (extraKeys.length > 0) {
        return `apply_changes rename_project operation ${index} contains unsupported fields: ${extraKeys.join(
          ', '
        )}.`
      }

      if (typeof operation.name !== 'string' || operation.name.trim().length === 0) {
        return `apply_changes rename_project operation ${index} name must be a non-empty string.`
      }

      return null
    }
    default:
      return `apply_changes operation ${index} uses unsupported type "${operation.type}".`
  }
}

const createToolExecutionSuccessResult = (message, structuredContent) => ({
  content: [
    {
      type: 'text',
      text: message,
    },
  ],
  structuredContent,
})

const createToolExecutionErrorResult = (toolName, code, message, extras = {}) => ({
  content: [
    {
      type: 'text',
      text: message,
    },
  ],
  isError: true,
  structuredContent: {
    code,
    toolName,
    message,
    ...extras,
  },
})

const AKSEL_COMPONENT_USAGE =
  'Import-free, version-matched Arcade snippet. Paste the JSX into a page; if `hooks` is present, put it in the page Hooks tab. Global config `hooks` is only for defining shared custom hooks, helpers, constants, and components, never for top-level hook calls. Do not add import statements.'

const createAkselComponentResourceText = (resolution) => {
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
          message: `Unknown Aksel component "${resolution.requestedName}". Read ${AKSEL_CATALOG_RESOURCE_URI} first, then try one of these near matches.`,
          suggestions: resolution.suggestions,
        },
      })
    default:
      return JSON.stringify({
        akselVersion: AKSEL_CATALOG_DATA.akselVersion,
        resolution: {
          kind: 'did-you-mean',
          requestedName: resolution.requestedName,
          message: `Unknown Aksel component "${resolution.requestedName}". Read ${AKSEL_CATALOG_RESOURCE_URI} first.`,
          suggestions: [],
        },
      })
  }
}

const createDesktopStableResourceText = (uri) => {
  const guidanceText = createMcpGuidanceResourceText(uri)
  if (guidanceText !== null) {
    return guidanceText
  }

  switch (uri) {
    case 'arcade://desktop/operating-guide':
      return [
        '# Desktop Arcade MCP operating guide',
        '',
        '- Work through `arcade://` resources and MCP tools only; do not edit repository files, package metadata, or the local filesystem.',
        '- `arcade://desktop/start-here` is the self-sufficient on-ramp and carries the default loop: read `arcade://project/manifest`, read the relevant source resources, use `list_annotations` / annotation resources / annotation mutation tools when review data matters, `apply_changes` for durable edits, read `arcade://project/diagnostics`, then capture Preview evidence. This guide only adds the finer operating details below.',
        '- Start with `tools/list`, `resources/list`, and `resources/read`; tool-only clients can call `read_resource({ uri })` for the same resources.',
        '- `arcade://desktop/capabilities` is the shortest single place to inspect the published contract.',
        '- Durable project edits happen through `apply_changes`, not by patching files outside the active Arcade project.',
        '- `list_annotations` defaults to open annotations on the active page. Read `arcade://project/annotations` for project-wide non-dead history, or `arcade://project/pages/{pageId}/annotations` for one page. Use `watch_annotations` for pending-only long-polling and `acknowledge_annotation` / `resolve_annotation` / `dismiss_annotation` / `reply_to_annotation` to mutate annotation status or thread state.',
        '- Use `create_page.newPageRef`, later lifecycle `tempPageRef` targets, and `{{pageRef:name}}` placeholders when one batch must create a page and link to it.',
        '- If the human asks to replace content, read `arcade://desktop/workflows/replace-project` and use `apply_changes.assertions` to keep the final shape scoped.',
        '- `capture_preview_evidence({ pageId })` is the normal autonomous inspection path for pages and targeted visual states.',
        '- Use `select_active_page` only when you intentionally want the human-visible Active page to change; ordinary inspection should keep using `capture_preview_evidence({ pageId })`.',
        '- Saved Preview preferences live in `arcade://project/preview-context`; capture-only overrides must not mutate them.',
        '- If `apply_changes` returns `project-unavailable`, wait for an active Desktop Arcade window instead of falling back to repository or filesystem edits.',
        '- Product-chrome checks such as Desktop Settings copy, Web/Desktop UI boundaries, portable share/package contents, host-process logs, and window-close lifecycle are intentionally outside the MCP surface; use the capabilities resource as the authoritative contract for those boundaries and rely on app-side or human checks when you must verify them directly.',
        '- Preview capture supports `screenshot`, `accessibility`, `dom_layout_style`, and `frame` layers, with `viewport`, `full_page`, and `region` screenshot scopes. Omit `layers` to capture all available layers.',
        `- Preview capture interactions support ${VALID_PREVIEW_INTERACTION_ACTIONS.join(', ')} with at most ${MAX_PREVIEW_INTERACTION_STEPS} steps and ${MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS} ms total interaction time per capture.`,
        '- Interaction targets prefer accessibility fields (`role`, `name`, `text`, `label`) and allow Preview-root-scoped CSS selector fallback only.',
        '- Preview interactions are isolated to the hidden Preview render: they must not touch Desktop Arcade host UI, durable source, saved Preview preferences, or the human-visible Active page.',
        '- Because capture is a throwaway isolated render, an in-capture `goToPage` does not move the human-visible Active page — do not call `select_active_page` to "restore" it afterward. When interactions navigate, the frame/manifest report `page.navigatedToId`/`page.navigatedToName` (the destination the accessibility and screenshot layers show) next to the `page.id` the capture started on.',
        '- Preview interactions block browser/external navigation targets; only in-prototype Arcade page references are allowed.',
        '- When state is unclear, re-read the manifest before making another durable change.',
      ].join('\n')
    case 'arcade://desktop/authoring-guide':
      return [
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
        '- **Global config** is shared code in scope for every page; it does not render as a page, and its `hooks` tab stays at module scope rather than becoming a page component.',
        '- **Sandbox constraints:** the preview runs in an opaque sandbox origin, so `localStorage`/`sessionStorage` are unavailable and external network/`fetch` is blocked; keep state in memory only.',
        '- **Feedback loop:** `apply_changes` → read `arcade://project/diagnostics` → `capture_preview_evidence`. Capture renders in an isolated throwaway frame, so in-capture interactions/`goToPage` never change the durable Active page — never "restore" it after a capture.',
        '- `apply_changes` operations are heterogeneous; see `arcade://desktop/apply-changes-operations` for the per-operation fields.',
        '',
        '## Getting Aksel component usage (on demand — fetch only the components you need)',
        'Read `arcade://aksel/catalog` before guessing a component name, then pull usage one component at a time in this priority order:',
        `1. **\`${AKSEL_CATALOG_RESOURCE_URI}\`** — a compact index of the components available here, each with its own \`${AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE}\` snippet resource. These snippets are import-free, version-matched to this Arcade runtime (Aksel ${AKSEL_CATALOG_DATA.akselVersion}), and guaranteed to run. Prefer this path.`,
        '2. **`https://aksel.nav.no/llm.md`** — the public docs index; fetch the individual component `.md` article when you need more than the snippet.',
        '3. **Aksel MCP tools** (`aksel_find_docs`, `aksel_get_component_info`, `aksel_find_icons`, `aksel_get_token_details`) — use them only if your client already has that server connected.',
        '- `Alert` is deprecated. If old code or a guessed component name lands on `Alert`, translate it instead of writing `Alert` back into Arcade: `fullWidth -> GlobalAlert`, `closeButton` local alerts -> LocalAlert, `inline -> InlineMessage`, `variant="info" -> InfoCard`, `variant="success" | "warning" | "error" -> LocalAlert`. `Alert variant="info" fullWidth` becomes `GlobalAlert status="announcement"`.',
        '',
        '## Mechanic snippets (illustrate wiring, not a use case)',
        'These show how Arcade plumbing fits together. They are intentionally generic — put whatever content the task needs inside.',
        '',
        'Preferred page shape — the `jsx` source can start **directly** with an Aksel component or primitive. No preamble, wrapper function, `function`/`return`, or imports go before it; the page supplies the component wrapper for you, so a static page is just the markup:',
        '```jsx',
        '<Page>',
        '  <Page.Block width="text" gutters>',
        '    {/* your content */}',
        '  </Page.Block>',
        '</Page>',
        '```',
        '',
        'You only add code *before* the JSX in the two cases below (state → `hooks` tab; non-hook local JS → a bare IIFE). Otherwise lead with the component.',
        '',
        'When a page needs state, put the hook call in its `hooks` tab and reference the value from the `jsx` tab — do not inline hooks in JSX:',
        '`hooks` source:',
        '```jsx',
        'const [name, setName] = useState("")',
        '```',
        '`jsx` source (plain markup, no wrapping braces):',
        '```jsx',
        '<Page>',
        '  <Page.Block width="text" gutters>',
        '    <VStack gap="space-16">',
        '      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} />',
        '      <BodyShort>Hello {name || "there"}</BodyShort>',
        '    </VStack>',
        '  </Page.Block>',
        '</Page>',
        '```',
        '',
        'For a stateful step flow, keep every step on one page and drive both the current step and the shared data from page-local `useState`. Arcade pages do not share React state, so reserve multi-page navigation for genuinely distinct screens.',
        '`hooks` source:',
        '```jsx',
        'const stepLabels = ["Start", "Details", "Review"]',
        'const [activeStep, setActiveStep] = useState(1)',
        'const [formValues, setFormValues] = useState({ title: "", owner: "" })',
        'const nextStep = () => setActiveStep((step) => Math.min(step + 1, stepLabels.length))',
        'const previousStep = () => setActiveStep((step) => Math.max(step - 1, 1))',
        '```',
        '`jsx` source (wiring only — swap in whatever fields/content the task needs):',
        '```jsx',
        '<Page>',
        '  <Page.Block width="text" gutters>',
        '    <VStack gap="space-24">',
        '      <FormProgress',
        '        totalSteps={stepLabels.length}',
        '        activeStep={activeStep}',
        '        onStepChange={setActiveStep}',
        '      >',
        '        <FormProgress.Step>Start</FormProgress.Step>',
        '        <FormProgress.Step>Details</FormProgress.Step>',
        '        <FormProgress.Step>Review</FormProgress.Step>',
        '      </FormProgress>',
        '      {activeStep === 1 ? (',
        '        <TextField',
        '          label="Title"',
        '          value={formValues.title}',
        '          onChange={(event) =>',
        '            setFormValues((current) => ({ ...current, title: event.target.value }))',
        '          }',
        '        />',
        '      ) : activeStep === 2 ? (',
        '        <TextField',
        '          label="Owner"',
        '          value={formValues.owner}',
        '          onChange={(event) =>',
        '            setFormValues((current) => ({ ...current, owner: event.target.value }))',
        '          }',
        '        />',
        '      ) : (',
        '        <FormSummary>',
        '          <FormSummary.Header>',
        '            <FormSummary.Heading level="2">Review</FormSummary.Heading>',
        '          </FormSummary.Header>',
        '          <FormSummary.Answers>',
        '            <FormSummary.Answer>',
        '              <FormSummary.Label>Title</FormSummary.Label>',
        '              <FormSummary.Value>{formValues.title || "Not provided yet"}</FormSummary.Value>',
        '            </FormSummary.Answer>',
        '            <FormSummary.Answer>',
        '              <FormSummary.Label>Owner</FormSummary.Label>',
        '              <FormSummary.Value>{formValues.owner || "Not provided yet"}</FormSummary.Value>',
        '            </FormSummary.Answer>',
        '          </FormSummary.Answers>',
        '        </FormSummary>',
        '      )}',
        '      <HStack gap="space-12">',
        '        <Button variant="secondary" onClick={previousStep} disabled={activeStep === 1}>',
        '          Back',
        '        </Button>',
        '        {activeStep < stepLabels.length ? (',
        '          <Button onClick={nextStep}>Next step</Button>',
        '        ) : (',
        '          <Button>Send</Button>',
        '        )}',
        '      </HStack>',
        '    </VStack>',
        '  </Page.Block>',
        '</Page>',
        '```',
        'If the task needs the full step list always visible, swap the compact `FormProgress` block for `Stepper` wired to the same `activeStep` / `setActiveStep` state instead of rendering both at once.',
        '',
        'Only **non-hook** local JS belongs in the `jsx` tab, and only via a bare IIFE (no surrounding `{ }`):',
        '```jsx',
        '(() => {',
        '  const items = ["a", "b", "c"]',
        '  return (',
        '    <Page>',
        '      <Page.Block width="text" gutters>',
        '        <VStack gap="space-16">',
        '          {items.map((item) => (',
        '            <Box key={item}>{item}</Box>',
        '          ))}',
        '        </VStack>',
        '      </Page.Block>',
        '    </Page>',
        '  )',
        '})()',
        '```',
        '',
        '> ⚠️ Never wrap a `jsx` source in `{ … }` (e.g. `{(() => { … })()}`). It is placed inside `return ( … )`, so a leading `{` parses as an object literal and the **whole** preview fails to compile. Keep hook calls in the `hooks` tab, not inside a JSX IIFE.',
        '',
        'Page-to-page navigation with `goToPage` (two generic pages — the same wiring scales to any number of screens and any content):',
        '```jsx',
        '// On "Page A": move to another page by its id',
        '<Button onClick={() => goToPage("{{pageRef:pageB}}")}>Continue</Button>',
        '',
        '// Equivalent with an Aksel Link (href is a bare page id, not a URL)',
        '<Link href="{{pageRef:pageB}}">Continue</Link>',
        '```',
        '',
        'For replacement tasks, read `arcade://desktop/workflows/replace-project` before applying changes.',
        '',
        'Keep output context-light: no broad Aksel training dumps, no package edits, no repository or filesystem edits.',
      ].join('\n')
    case APPLY_CHANGES_OPERATIONS_RESOURCE_URI:
      return [
        '# apply_changes operations reference',
        '',
        'Every entry in `operations[]` is an object with a `type`. The other fields it accepts depend on that `type` — the shared input schema lists every field, but each operation only uses the ones below.',
        '',
        '| type | fields | notes |',
        '| --- | --- | --- |',
        '| `replace_source` | `resourceUri` (required), `content` (required) | `resourceUri` must be an existing source resource from `arcade://project/manifest`. `content` is the full replacement and may contain `{{pageRef:name}}` placeholders. |',
        '| `create_page` | `newPageRef`, `name`, `jsxCode`, `hooksCode` (all optional) | `newPageRef` declares a temporary ref later lifecycle operations and same-batch `{{pageRef:name}}` placeholders can target. `jsxCode`/`hooksCode` seed the page source. |',
        '| `rename_page` | `name` (required) + target | Target the page with either `pageId` or `tempPageRef`. |',
        '| `delete_page` | target | Target with `pageId` or `tempPageRef`. |',
        '| `set_start_page` | target | Target with `pageId` or `tempPageRef`. |',
        '| `select_active_page` | target | Target with `pageId` or `tempPageRef`. Changes the human-visible Active page. |',
        '| `set_preview_context` | `viewportSize`, `theme` (at least one) | Saved preview preferences. Not accepted by `create_page`. |',
        '| `rename_project` | `name` (required) | New project name. |',
        '',
        '## Page targets',
        'Page-lifecycle operations (`rename_page`, `delete_page`, `set_start_page`, `select_active_page`) target a page with **either** `pageId` (an existing app-assigned id) **or** `tempPageRef` (a ref declared by an earlier `create_page.newPageRef` in the same batch).',
        '',
        '## {{pageRef:name}} same-batch rule',
        `A \`${PAGE_REF_PLACEHOLDER_SYNTAX}\` placeholder (in \`content\`/\`jsxCode\`/\`hooksCode\`) may target any matching \`create_page.newPageRef\` declared in the same batch. Lifecycle \`tempPageRef\` targets still require the matching \`create_page\` to appear earlier because those operations act on a page at that step.`,
        '',
        '## Final-state assertions',
        '`apply_changes` accepts optional `assertions` with `pageCount`, `startPage`, `activePage`, and `forbidImports`. Use them for replacement tasks, e.g. `{"pageCount":3,"startPage":"first","activePage":"first","forbidImports":true}`.',
      ].join('\n')
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
    case 'arcade://desktop/capabilities':
      return JSON.stringify({
        serverName: DESKTOP_MCP_SERVER_NAME,
        serverVersion: DESKTOP_MCP_SERVER_VERSION,
        endpoint: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}${DESKTOP_MCP_PATH}`,
        transport: DESKTOP_MCP_TRANSPORT_LABEL,
        requiresAuth: false,
        authDescription: DESKTOP_MCP_AUTH_DESCRIPTION,
        contractNote:
          'This resource lists the stable v1 MCP contract, omissions, and current implementation status for the published tools and resource families.',
        discoveryAdvice: {
          preferredFirstResourceUri: 'arcade://desktop/start-here',
          preferredDiscoveryMethods: ['tools/list', 'resources/list', 'resources/read', 'read_resource'],
          note: 'Use tools/list plus resources/list/resources/read to discover the published surface. In tool-only clients, call read_resource({ uri }) for the same resources. Read arcade://desktop/start-here before authoring.',
        },
        smokeChecklistRequirements: {
          requiresClientResourceReads: true,
          note: 'Use resources/list/resources/read when available. Tool-only hosts can call read_resource for stable resources, annotation resources, diagnostics, source, Aksel snippets, and capture-produced evidence resources.',
        },
        toolNames: MCP_TOOL_DEFINITIONS.map((toolDefinition) => toolDefinition.name),
        stableResourceUris: MCP_STABLE_RESOURCE_DEFINITIONS.map(
          (resourceDefinition) => resourceDefinition.uri
        ),
        applyChangesOperationTypes: APPLY_CHANGES_OPERATION_TYPES,
        applyChangesOperationsReferenceUri: APPLY_CHANGES_OPERATIONS_RESOURCE_URI,
        pageRefPlaceholderSyntax: PAGE_REF_PLACEHOLDER_SYNTAX,
        dynamicSourceUriTemplates: CAPABILITY_SOURCE_URI_TEMPLATES,
        annotationResources: {
          projectUri: PROJECT_ANNOTATIONS_RESOURCE_URI,
          pageUriTemplate: 'arcade://project/pages/{pageId}/annotations',
          toolName: 'list_annotations',
          defaultStatus: DEFAULT_LIST_ANNOTATIONS_STATUS,
          supportedStatuses: LIST_ANNOTATIONS_STATUSES,
          note: 'Annotation resources return non-dead annotations. Hidden-but-resolved targets stay visible to MCP and still count as work.',
        },
        akselSnippetResources: {
          akselVersion: AKSEL_CATALOG_DATA.akselVersion,
          catalogUri: AKSEL_CATALOG_RESOURCE_URI,
          componentUriTemplate: AKSEL_COMPONENT_RESOURCE_URI_TEMPLATE,
          note: 'On-demand, version-matched, import-free Aksel component snippets. Read the catalog index, then read one component resource at a time.',
        },
        previewEvidenceUriTemplates: CAPABILITY_PREVIEW_EVIDENCE_URI_TEMPLATES,
        captureLayers: CAPABILITY_PREVIEW_CAPTURE_LAYERS,
        captureLayerPurposes: CAPABILITY_PREVIEW_CAPTURE_LAYER_PURPOSES,
        screenshotScopes: VALID_PREVIEW_SCREENSHOT_SCOPES,
        interactionActions: CAPABILITY_PREVIEW_INTERACTION_ACTIONS,
        interactionWaitModes: ['text', 'target', 'renderIdle'],
        limits: {
          requestBodyBytes: MAX_MCP_BODY_BYTES,
          previewInteractionSteps: MAX_PREVIEW_INTERACTION_STEPS,
          previewInteractionTotalTimeMs: MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS,
          previewInteractionWaitTimeoutMs: MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS,
        },
        implementationStatus: {
          stableDesktopResourceReads: 'available',
          projectResourceReads: 'available when an active project reader is connected',
          toolExecution: TOOL_EXECUTION_STATUS,
          previewEvidenceUriTemplates: PREVIEW_EVIDENCE_URI_TEMPLATE_STATUS,
          captureLayers: CAPTURE_LAYER_STATUS,
          screenshotScopes: SCREENSHOT_SCOPE_STATUS,
          interactionActions: INTERACTION_ACTION_STATUS,
        },
        verificationBoundaries: {
          mcpVerifiable: [
            'No token/header is required for the aksel-arcade MCP endpoint.',
            'The published v1 tool/resource contract and omissions are discoverable from MCP itself.',
            'Business failures stay structured and redacted in MCP tool/resource responses.',
            'Unknown browser Origins are rejected and GET/SSE entrypoints stay unsupported.',
            'Safe activity metadata in MCP results contains tool/resource names, timestamps, status/error codes, and bounded safe metadata only.',
          ],
          hostOnly: [
            'Desktop Settings shows MCP configuration instead of a pairing handoff.',
            'Desktop Arcade shows no public Agent access toggle, pairing credential, or pairing handoff UI.',
            'Web Arcade shows no MCP or Agent UI and exposes no Web MCP endpoint.',
            'Desktop Settings renders last activity with safe metadata only.',
            'Technical host logs redact source, evidence, screenshot, and request payload contents.',
            'Portable Web share URLs and Arcade project packages exclude MCP resources, evidence, diagnostics, instructions, and activity data.',
            'Closing Desktop Arcade windows leaves MCP project calls failing clearly without auto-opening or focusing UI.',
          ],
          note: 'hostOnly items are intentionally outside the MCP surface; verify them through Desktop/Web UI checks, host-process tests, or human validation rather than expecting MCP resources/tools to introspect product chrome or logs.',
        },
        v1Omissions: CAPABILITY_V1_OMISSIONS,
      })
    default:
      return null
  }
}

const createProjectUnavailableResourceResult = async ({ uri }) => ({
  ok: false,
  code: 'project-unavailable',
  resourceUri: uri,
  message: `Desktop Arcade MCP resource "${uri}" is unavailable because no project reader is connected.`,
})

const createProjectUnavailableApplyChangesResult = async () => ({
  ok: false,
  code: 'project-unavailable',
  message:
    'Desktop Arcade MCP apply_changes is unavailable because no active project writer is connected.',
})

const createProjectUnavailableAnnotationMutationResult = async ({ annotationId }) => ({
  ok: false,
  code: 'project-unavailable',
  annotationId,
  message:
    'Desktop Arcade MCP annotation mutations are unavailable because no active project writer is connected.',
})

const createProjectUnavailableCapturePreviewResult = async () => ({
  ok: false,
  code: 'project-unavailable',
  message:
    'Desktop Arcade MCP capture_preview_evidence is unavailable because no active preview capture bridge is connected.',
})

const createPreviewCaptureStore = ({ ttlMs }) => {
  const captures = new Map()

  const cleanupExpired = () => {
    const now = Date.now()
    for (const [captureId, capture] of captures) {
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

const formatServerErrorReason = (error, { host, port }) => {
  if (isPlainObject(error) && error.code === 'EADDRINUSE') {
    return `Port ${port} on ${host} is already in use.`
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return `Desktop Arcade could not start MCP on ${host}:${port}.`
}

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    const closeActiveConnections = () => {
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections()
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections()
      }
    }

    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error)
        return
      }

      resolve()
    })
    closeActiveConnections()
  })

const readRequestBody = async (request) => {
  const chunks = []
  let bodyBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bodyBytes += buffer.length
    if (bodyBytes > MAX_MCP_BODY_BYTES) {
      throw new Error('Desktop Arcade MCP request body exceeds the 1MB limit.')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const getJsonRpcId = (value) =>
  isPlainObject(value) && value.id !== undefined && isJsonRpcId(value.id) ? value.id : null

const isJsonRpcRequest = (value) =>
  isPlainObject(value) &&
  getUnexpectedKeys(value, ['jsonrpc', 'id', 'method', 'params']).length === 0 &&
  value.jsonrpc === '2.0' &&
  typeof value.method === 'string' &&
  value.method.trim().length > 0 &&
  isJsonRpcId(value.id)

const isJsonRpcId = (value) =>
  value === undefined || value === null || typeof value === 'string' || typeof value === 'number'

const isJsonRpcResponseId = (value) => typeof value === 'string' || typeof value === 'number'

const getUnexpectedKeys = (value, allowedKeys) =>
  Object.keys(value).filter((key) => !allowedKeys.includes(key))

const getRequestOrigin = (request) =>
  typeof request.headers.origin === 'string' && request.headers.origin.trim().length > 0
    ? request.headers.origin.trim()
    : null

const isProjectResourceReadResult = (value, expectedUri) =>
  isPlainObject(value) &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? value.uri === expectedUri &&
      typeof value.mimeType === 'string' &&
      value.mimeType.trim().length > 0 &&
      typeof value.text === 'string'
    : value.resourceUri === expectedUri &&
      (value.code === 'project-unavailable' ||
        value.code === 'source-not-found' ||
        value.code === 'invalid-resource-uri') &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0)

const isPreviewInteractionState = (value) =>
  isPlainObject(value) &&
  Array.isArray(value.requested) &&
  Array.isArray(value.executed) &&
  value.requested.every((step) => isPlainObject(step) && typeof step.action === 'string') &&
  value.executed.every(
    (entry) =>
      isPlainObject(entry) &&
      typeof entry.index === 'number' &&
      isPlainObject(entry.step) &&
      typeof entry.step.action === 'string' &&
      (entry.targetDescription === undefined || typeof entry.targetDescription === 'string')
  ) &&
  (value.failedStep === undefined ||
    (isPlainObject(value.failedStep) &&
      typeof value.failedStep.index === 'number' &&
      typeof value.failedStep.reason === 'string' &&
      isPlainObject(value.failedStep.step) &&
      typeof value.failedStep.step.action === 'string' &&
      (value.failedStep.targetDescription === undefined ||
        typeof value.failedStep.targetDescription === 'string')))

const isCapturePreviewResult = (value) => {
  if (!isPlainObject(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.summary === 'string' &&
      typeof value.captureId === 'string' &&
      typeof value.manifestResourceUri === 'string' &&
      Array.isArray(value.producedResources) &&
      Array.isArray(value.requestedLayers) &&
      Array.isArray(value.producedLayers) &&
      isPlainObject(value.page) &&
      typeof value.page.id === 'string' &&
      typeof value.page.name === 'string' &&
      isPlainObject(value.layerResources) &&
      (value.layerResources.accessibility === undefined ||
        typeof value.layerResources.accessibility === 'string') &&
      (value.layerResources.dom_layout_style === undefined ||
        typeof value.layerResources.dom_layout_style === 'string') &&
      (value.layerResources.frame === undefined || typeof value.layerResources.frame === 'string') &&
      (value.layerResources.screenshot === undefined ||
        typeof value.layerResources.screenshot === 'string') &&
      (value.interactions === undefined || isPreviewInteractionState(value.interactions)) &&
      Array.isArray(value.resources) &&
      value.resources.every(
        (resource) =>
          isPlainObject(resource) &&
          typeof resource.uri === 'string' &&
          typeof resource.mimeType === 'string' &&
          typeof resource.text === 'string'
      ) &&
      isPlainObject(value.safeActivity) &&
      value.safeActivity.toolName === 'capture_preview_evidence' &&
      typeof value.safeActivity.timestamp === 'string'
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'invalid-page-id' ||
      value.code === 'invalid-capture-target' ||
      value.code === 'render-timeout' ||
      value.code === 'render-failed') &&
    typeof value.message === 'string' &&
    (value.manifestResourceUri === undefined || typeof value.manifestResourceUri === 'string') &&
    (value.interactions === undefined || isPreviewInteractionState(value.interactions)) &&
    (value.currentPageId === undefined ||
      value.currentPageId === null ||
      typeof value.currentPageId === 'string')
  )
}

const toPublicCapturePreviewResult = (captureResult) => ({
  ok: true,
  summary: captureResult.summary,
  captureId: captureResult.captureId,
  manifestResourceUri: captureResult.manifestResourceUri,
  producedResources: captureResult.producedResources,
  page: captureResult.page,
  requestedLayers: captureResult.requestedLayers,
  producedLayers: captureResult.producedLayers,
  layerResources: captureResult.layerResources,
  ...(captureResult.interactions !== undefined ? { interactions: captureResult.interactions } : {}),
  safeActivity: captureResult.safeActivity,
})

const redactCapturePreviewFailureInteractions = (interactionState) => ({
  requested: interactionState.requested.map((step) => ({
    action: step.action,
  })),
  executed: interactionState.executed.map((entry) => ({
    index: entry.index,
    step: {
      action: entry.step.action,
    },
  })),
  ...(interactionState.failedStep !== undefined
    ? {
        failedStep: {
          index: interactionState.failedStep.index,
          step: {
            action: interactionState.failedStep.step.action,
          },
          reason: interactionState.failedStep.reason,
        },
      }
    : {}),
})

const isApplyChangesResult = (value) =>
  isPlainObject(value) &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      typeof value.projectRevision === 'string' &&
      value.projectRevision.trim().length > 0 &&
      Array.isArray(value.changedResources) &&
      value.changedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.nextRecommendedResources) &&
      value.nextRecommendedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.operationResults) &&
      isApplyChangesPostChangeSummary(value.postChangeSummary) &&
      isPlainObject(value.safeActivity) &&
      typeof value.safeActivity.toolName === 'string' &&
      typeof value.safeActivity.timestamp === 'string' &&
      (value.safeActivity.operationTypes === undefined ||
        (Array.isArray(value.safeActivity.operationTypes) &&
          value.safeActivity.operationTypes.every((operationType) => typeof operationType === 'string')))
    : (value.code === 'project-unavailable' ||
        value.code === 'invalid-operation' ||
        value.code === 'stale-project-revision' ||
        value.code === 'invalid-operation-target' ||
        value.code === 'invalid-project-name' ||
        value.code === 'assertion-failed' ||
        value.code === 'payload-too-large' ||
        value.code === 'persistence-failed') &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0 &&
      (value.manifestResourceUri === undefined ||
        typeof value.manifestResourceUri === 'string') &&
      (value.resourceUri === undefined || typeof value.resourceUri === 'string') &&
      (value.expectedProjectRevision === undefined ||
        typeof value.expectedProjectRevision === 'string') &&
      (value.currentProjectRevision === undefined ||
        typeof value.currentProjectRevision === 'string'))

const isDesktopMcpAnnotationMutationResult = (value) => {
  if (!isPlainObject(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.toolName === 'string' &&
      value.toolName.trim().length > 0 &&
      typeof value.annotationId === 'string' &&
      value.annotationId.trim().length > 0 &&
      typeof value.pageId === 'string' &&
      value.pageId.trim().length > 0 &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0 &&
      isPlainObject(value.annotation) &&
      Array.isArray(value.annotations)
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'annotation-not-found' ||
      value.code === 'dead-target-annotation' ||
      value.code === 'invalid-annotation-payload') &&
    typeof value.annotationId === 'string' &&
    value.annotationId.trim().length > 0 &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0
  )
}

const isApplyChangesPostChangeSummary = (value) =>
  isPlainObject(value) &&
  Number.isInteger(value.pageCount) &&
  value.pageCount >= 1 &&
  typeof value.startPageId === 'string' &&
  typeof value.activePageId === 'string' &&
  Array.isArray(value.pages) &&
  value.pages.every(
    (page) =>
      isPlainObject(page) &&
      typeof page.id === 'string' &&
      typeof page.name === 'string' &&
      isPlainObject(page.sourceResources) &&
      typeof page.sourceResources.jsxResourceUri === 'string' &&
      typeof page.sourceResources.hooksResourceUri === 'string'
  ) &&
  Array.isArray(value.warnings) &&
  value.warnings.every((warning) => typeof warning === 'string')

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

module.exports = {
  DESKTOP_MCP_AUTH_DESCRIPTION,
  DESKTOP_MCP_HOST,
  DESKTOP_MCP_PATH,
  DESKTOP_MCP_PORT,
  DESKTOP_MCP_SERVER_NAME,
  DESKTOP_MCP_SERVER_VERSION,
  DESKTOP_MCP_TRANSPORT_LABEL,
  createDesktopMcpServer,
}

import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod'
import type {
  DesktopMcpPreviewCaptureFailure,
  DesktopMcpPreviewCaptureHandler,
  DesktopMcpPreviewCaptureRequest,
  DesktopMcpPreviewCaptureResult,
  DesktopMcpPreviewCaptureSuccess,
} from '../src/services/desktopMcpPreviewCaptureProtocol'
import type {
  DesktopMcpProjectResourceReadFailure,
  DesktopMcpProjectResourceReadHandler,
  DesktopMcpProjectResourceReadResult,
} from '../src/services/desktopMcpProjectResourceProtocol'
import type {
  PreviewEvidenceCaptureTarget,
  PreviewInteractionStep,
} from '../src/services/previewEvidence'
import {
  type DesktopMcpPreviewCaptureStore,
  type DesktopMcpResourceRegistrationOptions,
  readDesktopMcpResource,
} from './mcpSdkResources'

const VALID_VIEWPORT_SIZES = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS'] as const
const VALID_THEMES = ['light', 'dark'] as const
const VALID_PREVIEW_CAPTURE_LAYERS = [
  'screenshot',
  'accessibility',
  'dom_layout_style',
  'frame',
] as const
const VALID_PREVIEW_SCREENSHOT_SCOPES = ['viewport', 'full_page', 'region'] as const
const VALID_PREVIEW_INTERACTION_ACTIONS = [
  'click',
  'fill',
  'select',
  'press',
  'scroll',
  'waitFor',
] as const
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
] as const
const DEFAULT_LIST_ANNOTATIONS_STATUS = 'open'
const LIST_ANNOTATIONS_STATUSES = [
  'pending',
  'acknowledged',
  'resolved',
  'dismissed',
  'all',
] as const
const PROJECT_MANIFEST_URI = 'arcade://project/manifest'
const PROJECT_ANNOTATIONS_URI = 'arcade://project/annotations'
const MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 5_000
const PROJECT_PAGE_ID_PATTERN = /^page\d+$/

export const DESKTOP_MCP_READ_ONLY_TOOL_NAMES = [
  'read_resource',
  'list_annotations',
  'watch_annotations',
  'capture_preview_evidence',
] as const

type DesktopMcpReadOnlyToolName = (typeof DESKTOP_MCP_READ_ONLY_TOOL_NAMES)[number]
type ListAnnotationsStatus = (typeof LIST_ANNOTATIONS_STATUSES)[number] | typeof DEFAULT_LIST_ANNOTATIONS_STATUS

interface DesktopMcpReadOnlyToolOptions {
  readProjectResource: DesktopMcpProjectResourceReadHandler
  capturePreviewEvidence: DesktopMcpPreviewCaptureHandler
  previewCaptureStore: DesktopMcpPreviewCaptureStore
  stableResourceOptions: DesktopMcpResourceRegistrationOptions
}

interface DesktopMcpToolErrorContent {
  code: string
  toolName: DesktopMcpReadOnlyToolName
  message: string
  [key: string]: unknown
}

interface DesktopMcpListAnnotationsSuccess extends Record<string, unknown> {
  ok: true
  scope: 'page' | 'project'
  status: ListAnnotationsStatus
  resourceUri: string
  manifestResourceUri?: string
  page?: Record<string, unknown>
  counts?: Record<string, unknown>
  annotations: Array<Record<string, unknown>>
}

interface DesktopMcpListAnnotationsFailure extends Record<string, unknown> {
  ok: false
  code: string
  message: string
  resourceUri?: string
  manifestResourceUri?: string
}

type DesktopMcpListAnnotationsResult =
  | DesktopMcpListAnnotationsSuccess
  | DesktopMcpListAnnotationsFailure

interface DesktopMcpWatchAnnotationsSuccess extends DesktopMcpListAnnotationsSuccess {
  timedOut: boolean
  waitTimeoutSeconds?: number
  batchWindowSeconds?: number
}

type DesktopMcpWatchAnnotationsResult =
  | DesktopMcpWatchAnnotationsSuccess
  | DesktopMcpListAnnotationsFailure

const targetSchema = z
  .object({
    selector: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const targetFields = ['selector', 'role', 'name', 'text', 'label'].filter((key) => {
      const targetValue = value[key as keyof typeof value]
      return targetValue !== undefined
    })
    if (targetFields.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'capture_preview_evidence target must include at least one selector or accessibility field.',
      })
    }
  })

const interactionStepSchema = z
  .object({
    action: z.enum(VALID_PREVIEW_INTERACTION_ACTIONS),
    target: targetSchema.optional(),
    value: z.string().optional(),
    checked: z.boolean().optional(),
    key: z.string().optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    text: z.string().trim().min(1).optional(),
    renderIdle: z.boolean().optional(),
    timeoutMs: z.number().positive().max(MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS).optional(),
  })
  .strict()

const readResourceInputSchema = z
  .object({
    uri: z.string().trim().min(1).describe('Resource URI to read, e.g. arcade://desktop/start-here.'),
  })
  .strict()

const listAnnotationsInputSchema = z
  .object({
    scope: z.enum(['page', 'project']).optional().describe('Optional annotation scope. Defaults to the active Arcade page.'),
    pageId: z
      .string()
      .optional()
      .describe('Optional Arcade page id. Omit to use the active page when scope is "page".'),
    status: z
      .enum(LIST_ANNOTATIONS_STATUSES)
      .optional()
      .describe(
        'Optional status filter. Defaults to "open" (pending + acknowledged). Use "all" for full non-dead history.'
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.pageId !== undefined && !PROJECT_PAGE_ID_PATTERN.test(value.pageId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pageId'],
        message: 'list_annotations pageId must be an Arcade page id like "page01" when provided.',
      })
    }
    if (value.scope === 'project' && value.pageId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['pageId'],
        message: 'list_annotations pageId may be provided only when scope is "page".',
      })
    }
  })

const watchAnnotationsInputSchema = z
  .object({
    scope: z.enum(['page', 'project']).optional().describe('Optional annotation scope. Defaults to the active Arcade page.'),
    pageId: z
      .string()
      .optional()
      .describe('Optional Arcade page id. Omit to use the active page when scope is "page".'),
    waitTimeoutSeconds: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .describe('Optional upper bound, in seconds, for waiting for the first pending annotation. Defaults to 120 seconds.'),
    batchWindowSeconds: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe('Optional batching window, in seconds, after the first pending annotation appears. Defaults to 10 seconds.'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.pageId !== undefined && !PROJECT_PAGE_ID_PATTERN.test(value.pageId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pageId'],
        message: 'watch_annotations pageId must be an Arcade page id like "page01" when provided.',
      })
    }
    if (value.scope === 'project' && value.pageId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['pageId'],
        message: 'watch_annotations pageId may be provided only when scope is "page".',
      })
    }
  })

const capturePreviewEvidenceInputSchema = z
  .object({
    pageId: z.string().trim().min(1).optional().describe('Optional Arcade page id to capture.'),
    viewportSize: z.enum(VALID_VIEWPORT_SIZES).optional().describe('Optional capture-only viewport override.'),
    theme: z.enum(VALID_THEMES).optional().describe('Optional capture-only theme override.'),
    layers: z
      .array(z.enum(VALID_PREVIEW_CAPTURE_LAYERS))
      .min(1)
      .optional()
      .describe(
        'Optional requested evidence layers. screenshot = visual appearance and spatial gestalt; accessibility = roles, names, landmarks, focusable controls, and semantic hierarchy; dom_layout_style = actionable hierarchy, bounds, styles, spacing, colors, typography, and overflow; frame = viewport, theme, page, scroll, diagnostics, truncation, and capture metadata. Omit to capture all available layers.'
      ),
    screenshotScope: z
      .enum(VALID_PREVIEW_SCREENSHOT_SCOPES)
      .optional()
      .describe('Optional screenshot scope for the capture.'),
    includeAnnotationOverlays: z
      .boolean()
      .optional()
      .describe(
        'When true, screenshot evidence includes visible Annotation mode markers/outlines for the captured page and viewport. Durable annotation history still lives in annotation resources.'
      ),
    target: targetSchema
      .optional()
      .describe('Optional preview-root selector or accessibility target for region screenshots.'),
    interactions: z
      .array(interactionStepSchema)
      .max(10)
      .optional()
      .describe(
        'Optional bounded, capture-only Preview interaction sequence. Each step must use one of click, fill, select, press, scroll, or waitFor. Accessibility targets are preferred; selector fallback is scoped to the Preview root only. Interactions are ephemeral and do not mutate durable project or host UI state.'
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Array.isArray(value.layers) && new Set(value.layers).size !== value.layers.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['layers'],
        message: 'capture_preview_evidence layers must not contain duplicate values.',
      })
    }
    if (value.screenshotScope === 'region' && value.target === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'capture_preview_evidence screenshotScope "region" requires a target.',
      })
    }
    if (value.screenshotScope !== 'region' && value.target !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'capture_preview_evidence target may be provided only when screenshotScope is "region".',
      })
    }
    if (
      value.includeAnnotationOverlays === true &&
      Array.isArray(value.layers) &&
      !value.layers.includes('screenshot')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['includeAnnotationOverlays'],
        message: 'capture_preview_evidence includeAnnotationOverlays requires the screenshot layer.',
      })
    }
    value.interactions?.forEach((step, index) => {
      const error = validatePreviewInteractionStep(step, index)
      if (error) {
        ctx.addIssue({
          code: 'custom',
          path: ['interactions', index],
          message: error,
        })
      }
    })
  })

const readResourceOutputSchema = z.object({
  ok: z.literal(true),
  uri: z.string(),
  mimeType: z.string(),
  text: z.string(),
})

const listAnnotationsOutputSchema = z.object({
  ok: z.literal(true),
  scope: z.enum(['page', 'project']),
  status: z.string(),
  resourceUri: z.string(),
  manifestResourceUri: z.string().optional(),
  page: z.record(z.string(), z.unknown()).optional(),
  counts: z.record(z.string(), z.unknown()).optional(),
  annotations: z.array(z.record(z.string(), z.unknown())),
})

const watchAnnotationsOutputSchema = listAnnotationsOutputSchema.extend({
  timedOut: z.boolean(),
  waitTimeoutSeconds: z.number().int().optional(),
  batchWindowSeconds: z.number().int().optional(),
})

const capturePreviewEvidenceOutputSchema = z.object({
  ok: z.literal(true),
  summary: z.string(),
  captureId: z.string(),
  manifestResourceUri: z.string(),
  producedResources: z.array(z.string()),
  page: z.object({
    id: z.string(),
    name: z.string(),
    navigatedToId: z.string().optional(),
    navigatedToName: z.string().optional(),
  }),
  requestedLayers: z.array(z.enum(VALID_PREVIEW_CAPTURE_LAYERS)),
  producedLayers: z.array(z.enum(VALID_PREVIEW_CAPTURE_LAYERS)),
  layerResources: z.object({
    screenshot: z.string().optional(),
    accessibility: z.string().optional(),
    dom_layout_style: z.string().optional(),
    frame: z.string().optional(),
  }),
  interactions: z.unknown().optional(),
  safeActivity: z.object({
    toolName: z.literal('capture_preview_evidence'),
    timestamp: z.string(),
    operationTypes: z.array(z.string()).optional(),
  }),
})

export const registerDesktopMcpReadOnlyTools = (
  server: McpServer,
  options: DesktopMcpReadOnlyToolOptions
) => {
  server.registerTool(
    'read_resource',
    {
      description:
        'Read a Desktop Arcade MCP resource by URI. Use this first in tool-only MCP clients to fetch arcade://desktop/start-here, the project manifest, annotation resources, diagnostics, source resources, Aksel snippets, and Preview evidence resources.',
      inputSchema: readResourceInputSchema,
      outputSchema: readResourceOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ uri }) => {
      const resourceResult = await readDesktopMcpResource(uri, {
        previewCaptureStore: options.previewCaptureStore,
        readProjectResource: options.readProjectResource,
        stableResourceOptions: options.stableResourceOptions,
      })

      return resourceResult.ok
        ? createToolSuccessResult(resourceResult.text, {
            ok: true,
            uri: resourceResult.uri,
            mimeType: resourceResult.mimeType,
            text: resourceResult.text,
          })
        : createToolErrorResult('read_resource', resourceResult.code, resourceResult.message, {
            resourceUri: resourceResult.resourceUri,
          })
    }
  )

  server.registerTool(
    'list_annotations',
    {
      description:
        'List non-dead annotations for the active Arcade page by default. Supports explicit page or whole-project scope plus status filters for open, pending, acknowledged, resolved, dismissed, or all.',
      inputSchema: listAnnotationsInputSchema,
      outputSchema: listAnnotationsOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (argumentsPayload) => {
      const listAnnotationsResult = await listAnnotations(argumentsPayload, {
        readProjectResource: options.readProjectResource,
      })

      return listAnnotationsResult.ok
        ? createToolSuccessResult(
            `Listed ${listAnnotationsResult.annotations.length} annotations from ${listAnnotationsResult.resourceUri}.`,
            listAnnotationsResult
          )
        : createToolErrorResult(
            'list_annotations',
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
          )
    }
  )

  server.registerTool(
    'watch_annotations',
    {
      description:
        'Watch for pending annotations on the active Arcade page by default. Supports explicit page or whole-project scope, returns existing pending annotations immediately, waits for the first pending annotation for up to 120 seconds by default, then batches for 10 seconds after the first hit. Maximum wait is 300 seconds and maximum batch window is 60 seconds.',
      inputSchema: watchAnnotationsInputSchema,
      outputSchema: watchAnnotationsOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (argumentsPayload) => {
      const watchAnnotationsResult = await watchAnnotations(argumentsPayload, {
        readProjectResource: options.readProjectResource,
      })

      return watchAnnotationsResult.ok
        ? createToolSuccessResult(
            watchAnnotationsResult.timedOut
              ? 'No pending annotations appeared before the watch timed out.'
              : `Watched ${watchAnnotationsResult.annotations.length} annotations from ${watchAnnotationsResult.resourceUri}.`,
            watchAnnotationsResult
          )
        : createToolErrorResult(
            'watch_annotations',
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
          )
    }
  )

  server.registerTool(
    'capture_preview_evidence',
    {
      description:
        'Capture targeted Preview evidence for the active Arcade project across screenshot, accessibility, DOM/layout/style, and frame layers. Captures run in an isolated, throwaway render: in-capture interactions and goToPage navigation never change the human-visible Active page or durable source, so no restore is needed afterward. When interactions navigate, the frame/manifest add page.navigatedToId/navigatedToName so all layers agree. For Arcade authoring rules and how to fetch Aksel component usage on demand, read arcade://desktop/authoring-guide.',
      inputSchema: capturePreviewEvidenceInputSchema,
      outputSchema: capturePreviewEvidenceOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (argumentsPayload) => {
      const captureRequest = toCapturePreviewRequest(argumentsPayload)
      const captureResult = await options.capturePreviewEvidence(captureRequest)
      if (!isCapturePreviewResult(captureResult)) {
        return createToolErrorResult(
          'capture_preview_evidence',
          'project-unavailable',
          'Desktop Arcade MCP capture_preview_evidence returned an invalid renderer response.'
        )
      }

      if (captureResult.ok) {
        options.previewCaptureStore.store(captureResult)
        return createToolSuccessResult(
          `Captured Preview evidence: ${captureResult.summary}`,
          toPublicCapturePreviewResult(captureResult)
        )
      }

      return createToolErrorResult(
        'capture_preview_evidence',
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
      )
    }
  )

  server.server.registerCapabilities({
    tools: {
      listChanged: false,
    },
  })
}

const createToolSuccessResult = <T extends object>(message: string, structuredContent: T) => ({
  content: [
    {
      type: 'text' as const,
      text: message,
    },
  ],
  structuredContent,
})

const createToolErrorResult = (
  toolName: DesktopMcpReadOnlyToolName,
  code: string,
  message: string,
  extras: Record<string, unknown> = {}
) => ({
  content: [
    {
      type: 'text' as const,
      text: message,
    },
  ],
  isError: true,
  structuredContent: {
    code,
    toolName,
    message,
    ...extras,
  } satisfies DesktopMcpToolErrorContent,
})

const listAnnotations = async (
  argumentsPayload: z.infer<typeof listAnnotationsInputSchema>,
  {
    readProjectResource,
  }: {
    readProjectResource: DesktopMcpProjectResourceReadHandler
  }
): Promise<DesktopMcpListAnnotationsResult> => {
  const scope = argumentsPayload.scope ?? 'page'
  const status = argumentsPayload.status ?? DEFAULT_LIST_ANNOTATIONS_STATUS
  const manifestResourceUri = PROJECT_MANIFEST_URI

  if (scope === 'project') {
    const annotationsResult = await readProjectJsonResource(readProjectResource, PROJECT_ANNOTATIONS_URI)
    if (!annotationsResult.ok) {
      return annotationsResult
    }

    const annotations = filterListedAnnotations(annotationsResult.value?.annotations, status)
    if (!annotations) {
      return {
        ok: false,
        code: 'project-unavailable',
        resourceUri: PROJECT_ANNOTATIONS_URI,
        manifestResourceUri,
        message: `Desktop Arcade MCP resource "${PROJECT_ANNOTATIONS_URI}" returned malformed annotation data.`,
      }
    }

    return {
      ok: true,
      scope,
      status,
      resourceUri: PROJECT_ANNOTATIONS_URI,
      manifestResourceUri,
      counts: isObjectRecord(annotationsResult.value?.counts)
        ? annotationsResult.value.counts
        : undefined,
      annotations,
    }
  }

  const manifestResult = await readProjectJsonResource(readProjectResource, manifestResourceUri)
  if (!manifestResult.ok) {
    return manifestResult
  }

  const activePageId = manifestResult.value?.activePageId
  const pages = Array.isArray(manifestResult.value?.pages) ? manifestResult.value.pages : []
  const pageId = argumentsPayload.pageId ?? activePageId
  if (typeof pageId !== 'string') {
    return {
      ok: false,
      code: 'project-unavailable',
      manifestResourceUri,
      message: 'Desktop Arcade MCP could not determine an active Arcade page for list_annotations.',
    }
  }

  const pageExists = pages.some((page) => isObjectRecord(page) && page.id === pageId)
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
    page: isObjectRecord(annotationsResult.value?.page) ? annotationsResult.value.page : undefined,
    counts: {
      ...(isObjectRecord(annotationsResult.value?.counts) ? annotationsResult.value.counts : {}),
      matching: annotations.length,
    },
    annotations,
  }
}

const watchAnnotations = async (
  argumentsPayload: z.infer<typeof watchAnnotationsInputSchema>,
  {
    readProjectResource,
  }: {
    readProjectResource: DesktopMcpProjectResourceReadHandler
  }
): Promise<DesktopMcpWatchAnnotationsResult> => {
  const scope = argumentsPayload.scope ?? 'page'
  const waitTimeoutSeconds = argumentsPayload.waitTimeoutSeconds ?? 120
  const batchWindowSeconds = argumentsPayload.batchWindowSeconds ?? 10
  const resourceArguments = {
    scope,
    ...(argumentsPayload.pageId !== undefined ? { pageId: argumentsPayload.pageId } : {}),
    status: 'pending' as const,
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

  const observedAnnotations = new Map<string, Record<string, unknown>>()
  let currentSnapshot: DesktopMcpListAnnotationsSuccess = firstSnapshot
  const deadline = Date.now() + waitTimeoutSeconds * 1000

  while (Date.now() < deadline) {
    await sleep(Math.min(250, Math.max(50, deadline - Date.now())))
    const nextSnapshot = await listAnnotations(resourceArguments, { readProjectResource })
    if (!nextSnapshot.ok) {
      return nextSnapshot
    }
    currentSnapshot = nextSnapshot

    if (currentSnapshot.annotations.length === 0) {
      continue
    }

    for (const annotation of currentSnapshot.annotations) {
      if (typeof annotation.id === 'string') {
        observedAnnotations.set(annotation.id, annotation)
      }
    }

    const batchDeadline = Date.now() + batchWindowSeconds * 1000
    while (Date.now() < batchDeadline) {
      await sleep(Math.min(250, Math.max(50, batchDeadline - Date.now())))
      const batchSnapshot = await listAnnotations(resourceArguments, { readProjectResource })
      if (!batchSnapshot.ok) {
        return batchSnapshot
      }

      for (const annotation of batchSnapshot.annotations) {
        if (typeof annotation.id === 'string') {
          observedAnnotations.set(annotation.id, annotation)
        }
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

const readProjectJsonResource = async (
  readProjectResource: DesktopMcpProjectResourceReadHandler,
  resourceUri: string
): Promise<
  | {
      ok: true
      resourceUri: string
      value: Record<string, unknown> | null
    }
  | (DesktopMcpListAnnotationsFailure & {
      resourceUri: string
    })
> => {
  let resourceResult: DesktopMcpProjectResourceReadResult
  try {
    resourceResult = await readProjectResource({ uri: resourceUri })
  } catch (error) {
    return {
      ok: false,
      code: 'project-unavailable',
      resourceUri,
      message:
        error instanceof Error ? error.message : `Desktop Arcade MCP resource "${resourceUri}" is unavailable.`,
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
    const parsed = JSON.parse(resourceResult.text) as unknown
    return {
      ok: true,
      resourceUri: resourceResult.uri,
      value: isObjectRecord(parsed) ? parsed : null,
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

const filterListedAnnotations = (
  annotations: unknown,
  status: ListAnnotationsStatus
): Array<Record<string, unknown>> | null => {
  if (!Array.isArray(annotations)) {
    return null
  }

  return annotations.filter((annotation): annotation is Record<string, unknown> => {
    if (!isObjectRecord(annotation)) {
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

const validatePreviewInteractionStep = (
  value: z.infer<typeof interactionStepSchema>,
  index: number
): string | null => {
  if (
    typeof value.key === 'string' &&
    !VALID_PREVIEW_PRESS_KEYS.includes(value.key.trim() as (typeof VALID_PREVIEW_PRESS_KEYS)[number]) &&
    !/^[^\s]$/.test(value.key.trim())
  ) {
    return `capture_preview_evidence interactions[${index}].key must be a supported bounded key or a single printable character.`
  }

  if ('renderIdle' in value && value.renderIdle !== undefined && value.renderIdle !== true) {
    return `capture_preview_evidence interactions[${index}].renderIdle must be true when provided.`
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
      const waitConditions =
        Number(typeof value.text === 'string') +
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

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isProjectResourceReadResult = (
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

  return isProjectResourceReadFailure(value, requestedUri)
}

const isProjectResourceReadFailure = (
  value: unknown,
  requestedUri: string
): value is DesktopMcpProjectResourceReadFailure =>
  isObjectRecord(value) &&
  typeof value.code === 'string' &&
  typeof value.message === 'string' &&
  typeof value.resourceUri === 'string' &&
  value.resourceUri === requestedUri

const isPreviewInteractionState = (value: unknown): value is Record<string, unknown> =>
  isObjectRecord(value) &&
  Array.isArray(value.requested) &&
  Array.isArray(value.executed) &&
  value.requested.every((step) => isObjectRecord(step) && typeof step.action === 'string') &&
  value.executed.every(
    (entry) =>
      isObjectRecord(entry) &&
      typeof entry.index === 'number' &&
      isObjectRecord(entry.step) &&
      typeof entry.step.action === 'string' &&
      (entry.targetDescription === undefined || typeof entry.targetDescription === 'string')
  ) &&
  (value.failedStep === undefined ||
    (isObjectRecord(value.failedStep) &&
      typeof value.failedStep.index === 'number' &&
      typeof value.failedStep.reason === 'string' &&
      isObjectRecord(value.failedStep.step) &&
      typeof value.failedStep.step.action === 'string' &&
      (value.failedStep.targetDescription === undefined ||
        typeof value.failedStep.targetDescription === 'string')))

const isCapturePreviewResult = (value: unknown): value is DesktopMcpPreviewCaptureResult => {
  if (!isObjectRecord(value) || typeof value.ok !== 'boolean') {
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
      isObjectRecord(value.page) &&
      typeof value.page.id === 'string' &&
      typeof value.page.name === 'string' &&
      isObjectRecord(value.layerResources) &&
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
          isObjectRecord(resource) &&
          typeof resource.uri === 'string' &&
          typeof resource.mimeType === 'string' &&
          typeof resource.text === 'string'
      ) &&
      isObjectRecord(value.safeActivity) &&
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

const toPublicCapturePreviewResult = (captureResult: DesktopMcpPreviewCaptureSuccess) => ({
  ok: true as const,
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

const redactCapturePreviewFailureInteractions = (
  interactionState: NonNullable<DesktopMcpPreviewCaptureFailure['interactions']>
) => ({
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

const isArcadePageId = (value: string): value is `page${string}` => PROJECT_PAGE_ID_PATTERN.test(value)

const toCapturePreviewRequest = (
  argumentsPayload: z.infer<typeof capturePreviewEvidenceInputSchema>
): DesktopMcpPreviewCaptureRequest => {
  const { pageId, target, interactions, ...rest } = argumentsPayload
  return {
    ...rest,
    ...(target !== undefined ? { target: toPreviewTarget(target) } : {}),
    ...(interactions !== undefined ? { interactions: toPreviewInteractions(interactions) } : {}),
    ...(pageId !== undefined && isArcadePageId(pageId) ? { pageId } : {}),
  }
}

const toPreviewTarget = (
  target: z.infer<typeof targetSchema> | undefined
): PreviewEvidenceCaptureTarget => ({
  ...(target?.selector !== undefined ? { selector: target.selector } : {}),
  ...(target?.role !== undefined ? { role: target.role } : {}),
  ...(target?.name !== undefined ? { name: target.name } : {}),
  ...(target?.text !== undefined ? { text: target.text } : {}),
  ...(target?.label !== undefined ? { label: target.label } : {}),
})

const toPreviewInteractions = (
  interactions: z.infer<typeof capturePreviewEvidenceInputSchema>['interactions']
): PreviewInteractionStep[] =>
  (interactions ?? []).map((interaction) => {
    switch (interaction.action) {
      case 'click':
        return {
          action: 'click',
          target: toPreviewTarget(interaction.target),
        }
      case 'fill':
        return {
          action: 'fill',
          target: toPreviewTarget(interaction.target),
          value: interaction.value ?? '',
        }
      case 'select':
        return {
          action: 'select',
          target: toPreviewTarget(interaction.target),
          ...(interaction.value !== undefined ? { value: interaction.value } : {}),
          ...(interaction.checked !== undefined ? { checked: interaction.checked } : {}),
        }
      case 'press':
        return {
          action: 'press',
          key: interaction.key ?? 'Enter',
          ...(interaction.target !== undefined ? { target: toPreviewTarget(interaction.target) } : {}),
        }
      case 'scroll':
        return {
          action: 'scroll',
          ...(interaction.target !== undefined ? { target: toPreviewTarget(interaction.target) } : {}),
          ...(interaction.x !== undefined ? { x: interaction.x } : {}),
          ...(interaction.y !== undefined ? { y: interaction.y } : {}),
        }
      case 'waitFor':
        return {
          action: 'waitFor',
          ...(interaction.text !== undefined ? { text: interaction.text } : {}),
          ...(interaction.target !== undefined ? { target: toPreviewTarget(interaction.target) } : {}),
          ...(interaction.renderIdle !== undefined ? { renderIdle: interaction.renderIdle } : {}),
          ...(interaction.timeoutMs !== undefined ? { timeoutMs: interaction.timeoutMs } : {}),
        }
    }
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

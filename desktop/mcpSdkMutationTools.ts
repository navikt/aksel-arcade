import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod'
import type {
  DesktopMcpApplyChangesHandler,
  DesktopMcpApplyChangesOperation,
  DesktopMcpApplyChangesRequest,
  DesktopMcpApplyChangesResult,
} from '../src/services/desktopMcpApplyChangesProtocol'
import type {
  DesktopMcpAnnotationMutationHandler,
  DesktopMcpAnnotationMutationRequest,
  DesktopMcpAnnotationMutationResult,
} from '../src/services/desktopMcpAnnotationProtocol'
import { createToolErrorResult, createToolSuccessResult } from './mcpSdkToolResults'

const VALID_VIEWPORT_SIZES = ['2XL', 'XL', 'LG', 'MD', 'SM', 'XS'] as const
const VALID_THEMES = ['light', 'dark'] as const
const APPLY_CHANGES_OPERATION_TYPES = [
  'replace_source',
  'create_page',
  'rename_page',
  'delete_page',
  'set_start_page',
  'select_active_page',
  'set_preview_context',
  'rename_project',
] as const
const ANNOTATION_MUTATION_TOOL_NAMES = [
  'acknowledge_annotation',
  'resolve_annotation',
  'dismiss_annotation',
  'reply_to_annotation',
] as const
const PROJECT_PAGE_ID_PATTERN = /^page\d+$/
type DesktopMcpApplyChangesPageTarget = { pageId: `page${string}` } | { tempPageRef: string }

const APPLY_CHANGES_NEXT_STEPS = Object.freeze([
  'Read arcade://project/diagnostics to confirm the batch is healthy.',
  'Run capture_preview_evidence({ pageId }) to inspect the rendered result.',
])

export const DESKTOP_MCP_MUTATION_TOOL_NAMES = [
  'acknowledge_annotation',
  'resolve_annotation',
  'dismiss_annotation',
  'reply_to_annotation',
  'apply_changes',
] as const

interface DesktopMcpMutationToolOptions {
  mutateAnnotation: DesktopMcpAnnotationMutationHandler
  applyChanges: DesktopMcpApplyChangesHandler
}

const annotationIdSchema = z.string().trim().min(1).describe('Globally unique annotation id.')
const pageTargetSchema = z
  .object({
    pageId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Existing permanent Arcade page id for page lifecycle operations.'),
    tempPageRef: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Temporary page ref declared by create_page.newPageRef earlier in the same batch.'),
  })
  .strict()

const acknowledgeAnnotationInputSchema = z
  .object({
    annotationId: annotationIdSchema,
  })
  .strict()

const resolveAnnotationInputSchema = z
  .object({
    annotationId: annotationIdSchema,
    summary: z
      .string()
      .optional()
      .describe('Optional summary thread message to append before resolving.'),
  })
  .strict()

const dismissAnnotationInputSchema = z
  .object({
    annotationId: annotationIdSchema,
    reason: z.string().trim().min(1).describe('Reason thread message to append before dismissing.'),
  })
  .strict()

const replyToAnnotationInputSchema = z
  .object({
    annotationId: annotationIdSchema,
    message: z.string().trim().min(1).describe('Agent reply text to append to the annotation thread.'),
  })
  .strict()

const applyChangesOperationSchema = z
  .object({
    type: z.enum(APPLY_CHANGES_OPERATION_TYPES),
    resourceUri: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Existing source resource URI from the project manifest.'),
    content: z
      .string()
      .optional()
      .describe(
        'Full source replacement content for replace_source operations. Supports {{pageRef:name}} placeholders for create_page.newPageRef values declared anywhere in the same batch.'
      ),
    pageId: pageTargetSchema.shape.pageId,
    tempPageRef: pageTargetSchema.shape.tempPageRef,
    newPageRef: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Optional temporary page ref that later operations and {{pageRef:name}} placeholders can use inside the same batch.'
      ),
    jsxCode: z
      .string()
      .optional()
      .describe(
        'Optional initial JSX source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.'
      ),
    hooksCode: z
      .string()
      .optional()
      .describe(
        'Optional initial Hooks source for create_page operations. Supports {{pageRef:name}} placeholders for same-batch create_page.newPageRef values.'
      ),
    viewportSize: z.enum(VALID_VIEWPORT_SIZES).optional(),
    theme: z.enum(VALID_THEMES).optional(),
    name: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    switch (value.type) {
      case 'replace_source':
        if (value.resourceUri === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['resourceUri'],
            message: 'apply_changes replace_source operations require resourceUri.',
          })
        }
        if (value.content === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['content'],
            message: 'apply_changes replace_source operations require content.',
          })
        }
        break
      case 'create_page':
        break
      case 'rename_page':
        if (value.name === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['name'],
            message: 'apply_changes rename_page operations require name.',
          })
        }
        requireExactlyOnePageTarget(value, ctx)
        break
      case 'delete_page':
      case 'set_start_page':
      case 'select_active_page':
        requireExactlyOnePageTarget(value, ctx)
        break
      case 'set_preview_context':
        if (value.viewportSize === undefined && value.theme === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['type'],
            message:
              'apply_changes set_preview_context operations require viewportSize and/or theme.',
          })
        }
        break
      case 'rename_project':
        if (value.name === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['name'],
            message: 'apply_changes rename_project operations require name.',
          })
        }
        break
    }
  })

const applyChangesAssertionsSchema = z
  .object({
    pageCount: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional final page-count assertion.'),
    startPage: z
      .string()
      .optional()
      .describe('Optional final Start page assertion. Use "first" or a permanent Arcade page id.'),
    activePage: z
      .string()
      .optional()
      .describe('Optional final Active page assertion. Use "first" or a permanent Arcade page id.'),
    forbidImports: z
      .boolean()
      .optional()
      .describe('When true, fail if the resulting Arcade project source contains import statements.'),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const fieldName of ['startPage', 'activePage'] as const) {
      const fieldValue = value[fieldName]
      if (
        fieldValue !== undefined &&
        fieldValue !== 'first' &&
        !PROJECT_PAGE_ID_PATTERN.test(fieldValue)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [fieldName],
          message: `apply_changes assertions.${fieldName} must be "first" or an Arcade page id when provided.`,
        })
      }
    }
  })

const applyChangesInputSchema = z
  .object({
    summary: z.string().trim().min(1).describe('Required human-readable summary for the batch.'),
    expectedProjectRevision: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Optional stale-state protection revision.'),
    operations: z
      .array(applyChangesOperationSchema)
      .min(1)
      .describe(
        'Ordered batch operations for source, page lifecycle, preview, or project metadata.'
      ),
    assertions: applyChangesAssertionsSchema.optional(),
  })
  .strict()

const annotationMutationOutputSchema = z.object({
  ok: z.literal(true),
  toolName: z.enum(ANNOTATION_MUTATION_TOOL_NAMES),
  annotationId: z.string(),
  pageId: z.string(),
  message: z.string(),
  annotation: z.record(z.string(), z.unknown()),
  annotations: z.array(z.record(z.string(), z.unknown())),
})

const applyChangesOutputSchema = z.object({
  ok: z.literal(true),
  summary: z.string(),
  projectRevision: z.string(),
  changedResources: z.array(z.string()),
  nextRecommendedResources: z.array(z.string()),
  operationResults: z.array(z.record(z.string(), z.unknown())),
  postChangeSummary: z.object({
    pageCount: z.number().int().positive(),
    startPageId: z.string(),
    activePageId: z.string(),
    pages: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        sourceResources: z.object({
          jsxResourceUri: z.string(),
          hooksResourceUri: z.string(),
        }),
      })
    ),
    warnings: z.array(z.string()),
  }),
  tempPageRefMappings: z
    .record(
      z.string(),
      z.object({
        pageId: z.string(),
        sourceResources: z.object({
          jsxResourceUri: z.string(),
          hooksResourceUri: z.string(),
        }),
      })
    )
    .optional(),
  safeActivity: z.object({
    toolName: z.literal('apply_changes'),
    timestamp: z.string(),
    operationTypes: z.array(z.string()).optional(),
  }),
  nextSteps: z.array(z.string()),
})

export const registerDesktopMcpMutationTools = (
  server: McpServer,
  options: DesktopMcpMutationToolOptions
) => {
  server.registerTool(
    'acknowledge_annotation',
    {
      description:
        'Acknowledge a single non-dead annotation by annotationId. Updates status, timestamps, and agent actor metadata only.',
      inputSchema: acknowledgeAnnotationInputSchema,
      outputSchema: annotationMutationOutputSchema,
      annotations: { idempotentHint: true },
    },
    async ({ annotationId }) =>
      callAnnotationMutationTool(
        { toolName: 'acknowledge_annotation', annotationId },
        options.mutateAnnotation
      )
  )

  server.registerTool(
    'resolve_annotation',
    {
      description:
        'Resolve a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata, and may append an optional summary thread message.',
      inputSchema: resolveAnnotationInputSchema,
      outputSchema: annotationMutationOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ annotationId, summary }) =>
      callAnnotationMutationTool(
        {
          toolName: 'resolve_annotation',
          annotationId,
          ...(summary !== undefined ? { summary } : {}),
        },
        options.mutateAnnotation
      )
  )

  server.registerTool(
    'dismiss_annotation',
    {
      description:
        'Dismiss a single non-dead annotation by annotationId. Updates status, timestamps, and agent metadata and requires a reason thread message.',
      inputSchema: dismissAnnotationInputSchema,
      outputSchema: annotationMutationOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ annotationId, reason }) =>
      callAnnotationMutationTool(
        { toolName: 'dismiss_annotation', annotationId, reason },
        options.mutateAnnotation
      )
  )

  server.registerTool(
    'reply_to_annotation',
    {
      description:
        'Append an agent thread message to a single non-dead annotation by annotationId without changing status.',
      inputSchema: replyToAnnotationInputSchema,
      outputSchema: annotationMutationOutputSchema,
      annotations: {},
    },
    async ({ annotationId, message }) =>
      callAnnotationMutationTool(
        { toolName: 'reply_to_annotation', annotationId, message },
        options.mutateAnnotation
      )
  )

}

export const registerDesktopMcpApplyChangesTool = (
  server: McpServer,
  options: Pick<DesktopMcpMutationToolOptions, 'applyChanges'>
) => {
  server.registerTool(
    'apply_changes',
    {
      description:
        'Apply a validated, durable batch of Arcade project changes. Read arcade://desktop/start-here and arcade://desktop/apply-changes-operations before editing. Use assertions to keep replacements scoped.',
      inputSchema: applyChangesInputSchema,
      outputSchema: applyChangesOutputSchema,
      annotations: { destructiveHint: true },
    },
    async (argumentsPayload) => {
      const applyChangesRequest = toApplyChangesRequest(argumentsPayload)
      const applyChangesResult = await options.applyChanges(applyChangesRequest)
      if (!isApplyChangesResult(applyChangesResult)) {
        return createToolErrorResult(
          'apply_changes',
          'project-unavailable',
          'Desktop Arcade MCP apply_changes returned an invalid renderer response.'
        )
      }

      if (applyChangesResult.ok) {
        return createToolSuccessResult(`Applied changes: ${applyChangesResult.summary}`, {
          ...applyChangesResult,
          nextSteps: APPLY_CHANGES_NEXT_STEPS,
        })
      }

      return createToolErrorResult('apply_changes', applyChangesResult.code, applyChangesResult.message, {
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
      })
    }
  )
}

const callAnnotationMutationTool = async (
  request: DesktopMcpAnnotationMutationRequest,
  handler: DesktopMcpAnnotationMutationHandler
) => {
  const mutationResult = await handler(request)

  if (!isAnnotationMutationResult(mutationResult)) {
    return createToolErrorResult(
      request.toolName,
      'project-unavailable',
      'Desktop Arcade MCP annotation mutation returned an invalid renderer response.'
    )
  }

  return mutationResult.ok
    ? createToolSuccessResult(mutationResult.message, { ...mutationResult })
    : createToolErrorResult(request.toolName, mutationResult.code, mutationResult.message, {
        annotationId: mutationResult.annotationId,
      })
}

const requireExactlyOnePageTarget = (
  value: Pick<z.infer<typeof applyChangesOperationSchema>, 'pageId' | 'tempPageRef'>,
  ctx: z.RefinementCtx
) => {
  const targetCount = Number(value.pageId !== undefined) + Number(value.tempPageRef !== undefined)
  if (targetCount !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['pageId'],
      message: 'apply_changes page lifecycle operations require exactly one of pageId or tempPageRef.',
    })
  }
}

const toApplyChangesRequest = (
  argumentsPayload: z.infer<typeof applyChangesInputSchema>
): DesktopMcpApplyChangesRequest => ({
  summary: argumentsPayload.summary,
  ...(argumentsPayload.expectedProjectRevision !== undefined
    ? { expectedProjectRevision: argumentsPayload.expectedProjectRevision }
    : {}),
  operations: argumentsPayload.operations.map((operation) => {
    switch (operation.type) {
      case 'replace_source':
        return {
          type: operation.type,
          resourceUri: operation.resourceUri ?? '',
          content: operation.content ?? '',
        } satisfies DesktopMcpApplyChangesOperation
      case 'create_page':
        return {
          type: operation.type,
          ...(operation.name !== undefined ? { name: operation.name } : {}),
          ...(operation.newPageRef !== undefined ? { newPageRef: operation.newPageRef } : {}),
          ...(operation.jsxCode !== undefined ? { jsxCode: operation.jsxCode } : {}),
          ...(operation.hooksCode !== undefined ? { hooksCode: operation.hooksCode } : {}),
        } satisfies DesktopMcpApplyChangesOperation
      case 'rename_page':
        return {
          type: operation.type,
          name: operation.name ?? '',
          ...toApplyChangesPageTarget(operation),
        } satisfies DesktopMcpApplyChangesOperation
      case 'delete_page':
      case 'set_start_page':
      case 'select_active_page':
        return {
          type: operation.type,
          ...toApplyChangesPageTarget(operation),
        } satisfies DesktopMcpApplyChangesOperation
      case 'set_preview_context':
        return {
          type: operation.type,
          ...(operation.viewportSize !== undefined ? { viewportSize: operation.viewportSize } : {}),
          ...(operation.theme !== undefined ? { theme: operation.theme } : {}),
        } satisfies DesktopMcpApplyChangesOperation
      case 'rename_project':
        return {
          type: operation.type,
          name: operation.name ?? '',
        } satisfies DesktopMcpApplyChangesOperation
    }
  }),
  ...(argumentsPayload.assertions !== undefined
    ? { assertions: toApplyChangesAssertions(argumentsPayload.assertions) }
    : {}),
})

const toApplyChangesPageTarget = (
  operation: Pick<z.infer<typeof applyChangesOperationSchema>, 'pageId' | 'tempPageRef'>
): DesktopMcpApplyChangesPageTarget =>
  operation.pageId !== undefined
    ? {
        pageId: isProjectPageId(operation.pageId)
          ? operation.pageId
          : (operation.pageId as `page${string}`),
      }
    : { tempPageRef: operation.tempPageRef ?? '' }

const toApplyChangesAssertions = (
  assertions: NonNullable<z.infer<typeof applyChangesInputSchema>['assertions']>
): NonNullable<DesktopMcpApplyChangesRequest['assertions']> => ({
  ...(assertions.pageCount !== undefined ? { pageCount: assertions.pageCount } : {}),
  ...(assertions.startPage !== undefined
    ? { startPage: toAssertionPageId(assertions.startPage) }
    : {}),
  ...(assertions.activePage !== undefined
    ? { activePage: toAssertionPageId(assertions.activePage) }
    : {}),
  ...(assertions.forbidImports !== undefined ? { forbidImports: assertions.forbidImports } : {}),
})

const toAssertionPageId = (
  value: string
): NonNullable<DesktopMcpApplyChangesRequest['assertions']>['startPage'] =>
  value === 'first' ? value : isProjectPageId(value) ? value : (value as `page${string}`)

const isProjectPageId = (value: string): value is `page${string}` => PROJECT_PAGE_ID_PATTERN.test(value)

const isAnnotationMutationResult = (
  value: unknown
): value is DesktopMcpAnnotationMutationResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.toolName === 'string' &&
      typeof value.annotationId === 'string' &&
      value.annotationId.trim().length > 0 &&
      typeof value.pageId === 'string' &&
      value.pageId.trim().length > 0 &&
      typeof value.message === 'string' &&
      value.message.trim().length > 0 &&
      isRecord(value.annotation) &&
      Array.isArray(value.annotations)
    )
  }

  return (
    ((value.code === 'project-unavailable' ||
      value.code === 'annotation-not-found' ||
      value.code === 'dead-target-annotation' ||
      value.code === 'invalid-annotation-payload' ||
      value.code === 'persistence-failed')) &&
    typeof value.annotationId === 'string' &&
    value.annotationId.trim().length > 0 &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0
  )
}

const isApplyChangesResult = (value: unknown): value is DesktopMcpApplyChangesResult => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return (
      typeof value.summary === 'string' &&
      value.summary.trim().length > 0 &&
      typeof value.projectRevision === 'string' &&
      value.projectRevision.trim().length > 0 &&
      Array.isArray(value.changedResources) &&
      value.changedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.nextRecommendedResources) &&
      value.nextRecommendedResources.every((resourceUri) => typeof resourceUri === 'string') &&
      Array.isArray(value.operationResults) &&
      isRecord(value.safeActivity) &&
      value.safeActivity.toolName === 'apply_changes' &&
      typeof value.safeActivity.timestamp === 'string' &&
      (value.safeActivity.operationTypes === undefined ||
        (Array.isArray(value.safeActivity.operationTypes) &&
          value.safeActivity.operationTypes.every((operationType) => typeof operationType === 'string')))
    )
  }

  return (
    (value.code === 'project-unavailable' ||
      value.code === 'invalid-operation' ||
      value.code === 'stale-project-revision' ||
      value.code === 'invalid-operation-target' ||
      value.code === 'invalid-project-name' ||
      value.code === 'assertion-failed' ||
      value.code === 'payload-too-large' ||
      value.code === 'persistence-failed') &&
    typeof value.message === 'string' &&
    value.message.trim().length > 0 &&
    (value.manifestResourceUri === undefined || typeof value.manifestResourceUri === 'string') &&
    (value.resourceUri === undefined || typeof value.resourceUri === 'string') &&
    (value.expectedProjectRevision === undefined || typeof value.expectedProjectRevision === 'string') &&
    (value.currentProjectRevision === undefined || typeof value.currentProjectRevision === 'string')
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

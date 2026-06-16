import type { Project, ProjectSourceTarget, ThemeMode } from '@/types/project'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import { clonePreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  createDesktopMcpProjectRevision,
} from '@/services/desktopMcpProjectResources'
import {
  parseDesktopMcpProjectSourceUri,
  type DesktopMcpProjectSourceKind,
} from '@/services/desktopMcpProjectSourceUris'
import { getPageById, normalizeProjectSelection, updateSourceForTarget } from '@/services/projectSource'
import { validateProjectSize } from '@/services/storage'
import type {
  DesktopMcpApplyChangesFailure,
  DesktopMcpApplyChangesOperation,
  DesktopMcpApplyChangesOperationResult,
  DesktopMcpApplyChangesRequest,
  DesktopMcpApplyChangesSuccess,
} from './desktopMcpApplyChangesProtocol'

const MAX_PROJECT_NAME_LENGTH = 100

interface DesktopMcpApplyChangesContext {
  project: Project
  theme: ThemeMode
  diagnostics: PreviewDiagnostics
}

type PreparedDesktopMcpApplyChangesOperation =
  | {
      type: 'replace_source'
      index: number
      resourceUri: string
      sourceTarget: ProjectSourceTarget
      sourceKind: DesktopMcpProjectSourceKind
      content: string
    }
  | {
      type: 'set_preview_context'
      index: number
      viewportSize?: Project['viewportSize']
      theme?: ThemeMode
    }
  | {
      type: 'rename_project'
      index: number
      name: string
    }

export interface PreparedDesktopMcpApplyChangesSuccess {
  ok: true
  nextProject: Project
  nextTheme: ThemeMode
  nextDiagnostics: PreviewDiagnostics
  appliedOperations: PreparedDesktopMcpApplyChangesOperation[]
  result: DesktopMcpApplyChangesSuccess
}

export type PreparedDesktopMcpApplyChangesResult =
  | PreparedDesktopMcpApplyChangesSuccess
  | DesktopMcpApplyChangesFailure

export const prepareDesktopMcpApplyChanges = (
  request: DesktopMcpApplyChangesRequest,
  context: DesktopMcpApplyChangesContext,
  timestamp = new Date().toISOString()
): PreparedDesktopMcpApplyChangesResult => {
  const currentProjectRevision = createDesktopMcpProjectRevision({
    project: context.project,
    theme: context.theme,
  })

  if (
    request.expectedProjectRevision !== undefined &&
    request.expectedProjectRevision !== currentProjectRevision
  ) {
    return createApplyChangesFailure(
      'stale-project-revision',
      `apply_changes expected project revision "${request.expectedProjectRevision}" but the active project is now "${currentProjectRevision}". Re-read arcade://project/manifest before retrying.`,
      {
        manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
        expectedProjectRevision: request.expectedProjectRevision,
        currentProjectRevision,
      }
    )
  }

  const appliedOperations: PreparedDesktopMcpApplyChangesOperation[] = []
  const operationResults: DesktopMcpApplyChangesOperationResult[] = []
  const changedResources = new Set<string>([DESKTOP_MCP_PROJECT_MANIFEST_URI])
  let nextProject = context.project
  let nextTheme = context.theme
  let hasSourceChanges = false

  for (const [index, operation] of request.operations.entries()) {
    switch (operation.type) {
      case 'replace_source': {
        const resolvedSource = resolveDesktopMcpApplyChangesSource(operation.resourceUri, nextProject)
        if (!resolvedSource.ok) {
          return resolvedSource.failure
        }

        nextProject = updateSourceForTarget(nextProject, resolvedSource.target, {
          [resolvedSource.sourceKind]: operation.content,
        })
        hasSourceChanges = true
        changedResources.add(operation.resourceUri)
        appliedOperations.push({
          type: 'replace_source',
          index,
          resourceUri: operation.resourceUri,
          sourceTarget: resolvedSource.target,
          sourceKind: resolvedSource.sourceKind,
          content: operation.content,
        })
        operationResults.push({
          index,
          type: 'replace_source',
          resourceUri: operation.resourceUri,
        })
        break
      }
      case 'set_preview_context': {
        if (operation.viewportSize !== undefined) {
          nextProject = {
            ...nextProject,
            viewportSize: operation.viewportSize,
          }
        }
        if (operation.theme !== undefined) {
          nextTheme = operation.theme
        }
        changedResources.add(DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI)
        appliedOperations.push({
          type: 'set_preview_context',
          index,
          ...(operation.viewportSize !== undefined
            ? { viewportSize: operation.viewportSize }
            : {}),
          ...(operation.theme !== undefined ? { theme: operation.theme } : {}),
        })
        operationResults.push({
          index,
          type: 'set_preview_context',
          ...(operation.viewportSize !== undefined
            ? { viewportSize: operation.viewportSize }
            : {}),
          ...(operation.theme !== undefined ? { theme: operation.theme } : {}),
        })
        break
      }
      case 'rename_project': {
        const normalizedName = operation.name.trim()
        if (normalizedName.length === 0 || normalizedName.length > MAX_PROJECT_NAME_LENGTH) {
          return createApplyChangesFailure(
            'invalid-project-name',
            `apply_changes rename_project operation ${index} must set a project name with 1-${MAX_PROJECT_NAME_LENGTH} non-whitespace characters.`
          )
        }

        nextProject = {
          ...nextProject,
          name: normalizedName,
        }
        appliedOperations.push({
          type: 'rename_project',
          index,
          name: normalizedName,
        })
        operationResults.push({
          index,
          type: 'rename_project',
          name: normalizedName,
        })
        break
      }
    }
  }

  nextProject = normalizeProjectSelection({
    ...nextProject,
    lastModified: timestamp,
  })

  const sizeStatus = validateProjectSize(nextProject)
  if (!sizeStatus.valid) {
    return createApplyChangesFailure(
      'payload-too-large',
      sizeStatus.message ?? 'apply_changes would exceed the 5MB Arcade project size limit.'
    )
  }

  const projectRevision = createDesktopMcpProjectRevision({
    project: nextProject,
    theme: nextTheme,
  })
  const changedResourceList = [...changedResources]
  const nextRecommendedResources = dedupeResourceUris([
    DESKTOP_MCP_PROJECT_MANIFEST_URI,
    DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
    ...changedResourceList,
  ])

  return {
    ok: true,
    nextProject,
    nextTheme,
    nextDiagnostics: hasSourceChanges
      ? createPendingSourceDiagnostics(context.diagnostics)
      : clonePreviewDiagnostics(context.diagnostics),
    appliedOperations,
    result: {
      ok: true,
      summary: request.summary.trim(),
      projectRevision,
      changedResources: changedResourceList,
      nextRecommendedResources,
      operationResults,
      safeActivity: {
        toolName: 'apply_changes',
        operationTypes: getOrderedUniqueOperationTypes(request.operations),
        timestamp,
      },
    },
  }
}

const resolveDesktopMcpApplyChangesSource = (
  resourceUri: string,
  project: Project
):
  | {
      ok: true
      target: ProjectSourceTarget
      sourceKind: DesktopMcpProjectSourceKind
    }
  | {
      ok: false
      failure: DesktopMcpApplyChangesFailure
    } => {
  const parsedSourceUri = parseDesktopMcpProjectSourceUri(resourceUri)
  if (!parsedSourceUri) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes replace_source can target only existing Arcade source resources from the manifest. "${resourceUri}" is not supported.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          resourceUri,
        }
      ),
    }
  }

  if (
    parsedSourceUri.target.type === 'page' &&
    !getPageById(project.source, parsedSourceUri.target.pageId)
  ) {
    return {
      ok: false,
      failure: createApplyChangesFailure(
        'invalid-operation-target',
        `apply_changes replace_source could not find Arcade page "${parsedSourceUri.target.pageId}" for "${resourceUri}". Re-read arcade://project/manifest before retrying.`,
        {
          manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
          resourceUri,
        }
      ),
    }
  }

  return {
    ok: true,
    target: parsedSourceUri.target,
    sourceKind: parsedSourceUri.sourceKind,
  }
}

const createPendingSourceDiagnostics = (diagnostics: PreviewDiagnostics): PreviewDiagnostics => ({
  status: 'transpiling',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: diagnostics.sandboxConsoleMessages.map((message) => ({
    ...message,
    args: [...message.args],
  })),
})

const getOrderedUniqueOperationTypes = (
  operations: DesktopMcpApplyChangesOperation[]
): Array<DesktopMcpApplyChangesOperation['type']> => {
  const seen = new Set<DesktopMcpApplyChangesOperation['type']>()
  const operationTypes: Array<DesktopMcpApplyChangesOperation['type']> = []

  for (const operation of operations) {
    if (seen.has(operation.type)) {
      continue
    }
    seen.add(operation.type)
    operationTypes.push(operation.type)
  }

  return operationTypes
}

const dedupeResourceUris = (resourceUris: string[]): string[] => {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const resourceUri of resourceUris) {
    if (seen.has(resourceUri)) {
      continue
    }
    seen.add(resourceUri)
    deduped.push(resourceUri)
  }

  return deduped
}

const createApplyChangesFailure = (
  code: DesktopMcpApplyChangesFailure['code'],
  message: string,
  extras: Omit<DesktopMcpApplyChangesFailure, 'ok' | 'code' | 'message'> = {}
): DesktopMcpApplyChangesFailure => ({
  ok: false,
  code,
  message,
  ...extras,
})

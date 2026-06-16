import { useCallback, useLayoutEffect, useRef } from 'react'
import type { ThemeMode, Project, ProjectSourceTarget } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { collectPreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  saveProject,
  type SaveResult,
  type WebArcadeWorkingCopyPreferences,
} from '@/services/storage'
import {
  prepareDesktopMcpApplyChanges,
  type PreparedDesktopMcpApplyChangesSuccess,
} from '@/services/desktopMcpApplyChanges'
import { registerDesktopPreloadMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesAdapter'
import type {
  DesktopMcpApplyChangesFailure,
  DesktopMcpApplyChangesRequest,
  DesktopMcpLastActivity,
} from '@/services/desktopMcpApplyChangesProtocol'
import { readDesktopMcpProjectResource } from '@/services/desktopMcpProjectResources'
import { registerDesktopPreloadMcpProjectResourceReadHandler } from '@/services/desktopMcpProjectResourceAdapter'
import type { DesktopMcpProjectResourceReadRequest } from '@/services/desktopMcpProjectResourceProtocol'

interface UseDesktopMcpProjectResourceBridgeOptions {
  project: Project
  previewState: PreviewState
  theme: ThemeMode
  workingCopyPreferences: WebArcadeWorkingCopyPreferences
  setTheme: (theme: ThemeMode) => void
  updateProject: (updates: DesktopMcpProjectUpdates) => void
  updatePreviewState: (updates: Partial<PreviewState>) => void
  onDesktopMcpActivity?: (activity: DesktopMcpLastActivity) => void
}

type DesktopMcpProjectUpdates = Partial<Pick<Project, 'name' | 'viewportSize'>> & {
  jsxCode?: string
  hooksCode?: string
  sourceTarget?: ProjectSourceTarget
}

export const useDesktopMcpProjectResourceBridge = ({
  project,
  previewState,
  theme,
  workingCopyPreferences,
  setTheme,
  updateProject,
  updatePreviewState,
  onDesktopMcpActivity,
}: UseDesktopMcpProjectResourceBridgeOptions): void => {
  const resourceContextRef = useRef({
    project,
    theme,
    diagnostics: collectPreviewDiagnostics(previewState),
  })

  useLayoutEffect(() => {
    resourceContextRef.current = {
      project,
      theme,
      diagnostics: collectPreviewDiagnostics(previewState),
    }
  }, [previewState, project, theme])

  const workingCopyPreferencesRef = useRef(workingCopyPreferences)

  useLayoutEffect(() => {
    workingCopyPreferencesRef.current = workingCopyPreferences
  }, [workingCopyPreferences])

  const handleProjectResourceRead = useCallback(
    (request: DesktopMcpProjectResourceReadRequest) =>
      readDesktopMcpProjectResource(request, resourceContextRef.current),
    []
  )

  const handleApplyChanges = useCallback(
    (request: DesktopMcpApplyChangesRequest) => {
      const currentContext = resourceContextRef.current
      const preparedResult = prepareDesktopMcpApplyChanges(request, currentContext)
      if (!preparedResult.ok) {
        return preparedResult
      }

      const nextWorkingCopyPreferences: WebArcadeWorkingCopyPreferences = {
        ...workingCopyPreferencesRef.current,
        theme: preparedResult.nextTheme,
      }
      const saveResult = saveProject(preparedResult.nextProject, {
        preferences: nextWorkingCopyPreferences,
        updateLastModified: false,
      })
      if (!saveResult.success) {
        return createApplyChangesPersistenceFailure(saveResult)
      }

      if (saveResult.warning) {
        console.warn(saveResult.warning)
      }

      resourceContextRef.current = {
        project: preparedResult.nextProject,
        theme: preparedResult.nextTheme,
        diagnostics: preparedResult.nextDiagnostics,
      }
      workingCopyPreferencesRef.current = nextWorkingCopyPreferences

      if (preparedResult.appliedOperations.some((operation) => operation.type === 'replace_source')) {
        updatePreviewState({
          status: 'transpiling',
          compileError: null,
          pendingCompileError: null,
          runtimeError: null,
        })
      }

      for (const operation of preparedResult.appliedOperations) {
        applyPreparedOperation(operation, {
          setTheme,
          updateProject,
        })
      }

      onDesktopMcpActivity?.(preparedResult.result.safeActivity)
      return preparedResult.result
    },
    [onDesktopMcpActivity, setTheme, updateProject, updatePreviewState]
  )

  useLayoutEffect(() => {
    const unregisterProjectRead =
      registerDesktopPreloadMcpProjectResourceReadHandler(handleProjectResourceRead)
    const unregisterApplyChanges = registerDesktopPreloadMcpApplyChangesHandler(handleApplyChanges)

    return () => {
      unregisterApplyChanges?.()
      unregisterProjectRead?.()
    }
  }, [handleApplyChanges, handleProjectResourceRead])
}

const createApplyChangesPersistenceFailure = ({
  error,
}: Pick<SaveResult, 'error'>): DesktopMcpApplyChangesFailure => {
  const baseMessage = 'apply_changes could not persist the updated Arcade project.'
  const detail = error?.trim()
  const message = detail ? `${baseMessage} ${detail}` : baseMessage

  return {
    ok: false,
    code: detail && /exceeds 5MB limit/i.test(detail) ? 'payload-too-large' : 'persistence-failed',
    message,
  }
}

const applyPreparedOperation = (
  operation: PreparedDesktopMcpApplyChangesSuccess['appliedOperations'][number],
  {
    setTheme,
    updateProject,
  }: {
    setTheme: (theme: ThemeMode) => void
    updateProject: (updates: DesktopMcpProjectUpdates) => void
  }
) => {
  switch (operation.type) {
    case 'replace_source':
      updateProject({
        sourceTarget: operation.sourceTarget,
        ...(operation.sourceKind === 'jsx'
          ? { jsxCode: operation.content }
          : { hooksCode: operation.content }),
      })
      return
    case 'set_preview_context':
      if (operation.viewportSize !== undefined) {
        updateProject({ viewportSize: operation.viewportSize })
      }
      if (operation.theme !== undefined) {
        setTheme(operation.theme)
      }
      return
    case 'rename_project':
      updateProject({ name: operation.name })
      return
  }
}

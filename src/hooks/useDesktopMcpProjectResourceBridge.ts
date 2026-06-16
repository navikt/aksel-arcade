import { useCallback, useEffect, useRef } from 'react'
import type { ThemeMode, Project, ProjectSourceTarget } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { collectPreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  prepareDesktopMcpApplyChanges,
  type PreparedDesktopMcpApplyChangesSuccess,
} from '@/services/desktopMcpApplyChanges'
import { registerDesktopPreloadMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesAdapter'
import type {
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

  useEffect(() => {
    resourceContextRef.current = {
      project,
      theme,
      diagnostics: collectPreviewDiagnostics(previewState),
    }
  }, [previewState, project, theme])

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

      resourceContextRef.current = {
        project: preparedResult.nextProject,
        theme: preparedResult.nextTheme,
        diagnostics: preparedResult.nextDiagnostics,
      }

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

  useEffect(() => {
    const unregisterProjectRead =
      registerDesktopPreloadMcpProjectResourceReadHandler(handleProjectResourceRead)
    const unregisterApplyChanges = registerDesktopPreloadMcpApplyChangesHandler(handleApplyChanges)

    return () => {
      unregisterApplyChanges?.()
      unregisterProjectRead?.()
    }
  }, [handleApplyChanges, handleProjectResourceRead])
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

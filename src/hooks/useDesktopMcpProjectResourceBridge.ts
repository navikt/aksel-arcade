import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import type { ThemeMode, Project, ProjectSourceTarget } from '@/types/project'
import type { PreviewState } from '@/types/preview'
import { getViewportWidth } from '@/types/viewports'
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
import {
  finalizeDesktopMcpPreviewCapture,
  prepareDesktopMcpPreviewCapture,
} from '@/services/desktopMcpPreviewCapture'
import { registerDesktopPreloadMcpPreviewCaptureHandler } from '@/services/desktopMcpPreviewCaptureAdapter'
import { capturePreviewInIsolatedSandbox } from '@/services/desktopMcpPreviewCaptureSandbox'
import type {
  DesktopMcpPreviewCaptureRequest,
  DesktopMcpPreviewCaptureResult,
} from '@/services/desktopMcpPreviewCaptureProtocol'
import { readDesktopMcpProjectResource } from '@/services/desktopMcpProjectResources'
import { registerDesktopPreloadMcpProjectResourceReadHandler } from '@/services/desktopMcpProjectResourceAdapter'
import type { DesktopMcpProjectResourceReadRequest } from '@/services/desktopMcpProjectResourceProtocol'

interface UseDesktopMcpProjectResourceBridgeOptions {
  project: Project
  previewState: PreviewState
  previewIframeRef: RefObject<HTMLIFrameElement | null>
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
  previewIframeRef,
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
    transpiledCode: previewState.transpiledCode,
    compileError: previewState.compileError ?? previewState.pendingCompileError,
  })

  useLayoutEffect(() => {
    resourceContextRef.current = {
      project,
      theme,
      diagnostics: collectPreviewDiagnostics(previewState),
      transpiledCode: previewState.transpiledCode,
      compileError: previewState.compileError ?? previewState.pendingCompileError,
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
        transpiledCode: preparedResult.appliedOperations.some(
          (operation) => operation.type === 'replace_source'
        )
          ? null
          : currentContext.transpiledCode,
        compileError: preparedResult.appliedOperations.some(
          (operation) => operation.type === 'replace_source'
        )
          ? null
          : currentContext.compileError,
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

  const handleCapturePreviewEvidence = useCallback(
    async (
      request: DesktopMcpPreviewCaptureRequest
    ): Promise<DesktopMcpPreviewCaptureResult> => {
      const currentContext = resourceContextRef.current
      const prepared = prepareDesktopMcpPreviewCapture(request, currentContext)
      if (!prepared.ok) {
        return prepared
      }

      if (currentContext.compileError || !currentContext.transpiledCode) {
        return {
          ok: false as const,
          code: 'render-failed' as const,
          message:
            'capture_preview_evidence is unavailable because the current Arcade project source does not render cleanly yet. Read arcade://project/diagnostics before retrying.',
          manifestResourceUri: 'arcade://project/manifest',
        }
      }

      const captureResult = await capturePreviewInIsolatedSandbox({
        transpiledCode: currentContext.transpiledCode,
        pageId: prepared.pageId,
        startPageId: currentContext.project.source.startPageId,
        viewportWidth: getViewportWidth(prepared.viewportSize),
        viewportHeight: Math.max(1, previewIframeRef.current?.clientHeight ?? 900),
        theme: prepared.theme,
        layers: prepared.requestedLayers,
        screenshotScope: prepared.screenshotScope,
        ...(prepared.target ? { target: prepared.target } : {}),
      })

      if (!captureResult.ok) {
        return captureResult
      }

      const finalized = finalizeDesktopMcpPreviewCapture(prepared, captureResult, currentContext)
      if (finalized.ok) {
        onDesktopMcpActivity?.(finalized.safeActivity)
      }
      return finalized
    },
    [onDesktopMcpActivity, previewIframeRef]
  )

  useLayoutEffect(() => {
    const unregisterProjectRead =
      registerDesktopPreloadMcpProjectResourceReadHandler(handleProjectResourceRead)
    const unregisterApplyChanges = registerDesktopPreloadMcpApplyChangesHandler(handleApplyChanges)
    const unregisterPreviewCapture =
      registerDesktopPreloadMcpPreviewCaptureHandler(handleCapturePreviewEvidence)

    return () => {
      unregisterPreviewCapture?.()
      unregisterApplyChanges?.()
      unregisterProjectRead?.()
    }
  }, [handleApplyChanges, handleCapturePreviewEvidence, handleProjectResourceRead])
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

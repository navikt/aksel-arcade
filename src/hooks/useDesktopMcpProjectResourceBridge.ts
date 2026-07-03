import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import type { ThemeMode, Project } from '@/types/project'
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
} from '@/services/desktopMcpApplyChanges'
import { registerDesktopPreloadMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesAdapter'
import type {
  DesktopMcpApplyChangesFailure,
  DesktopMcpApplyChangesRequest,
} from '@/services/desktopMcpApplyChangesProtocol'
import { registerDesktopPreloadMcpAnnotationHandler } from '@/services/desktopMcpAnnotationAdapter'
import {
  mutateDesktopMcpAnnotation,
  type DesktopMcpAnnotationMutationHandler,
} from '@/services/desktopMcpAnnotations'
import {
  finalizeDesktopMcpPreviewCapture,
  prepareDesktopMcpPreviewCapture,
} from '@/services/desktopMcpPreviewCapture'
import { registerDesktopPreloadMcpPreviewCaptureHandler } from '@/services/desktopMcpPreviewCaptureAdapter'
import { resolveDesktopMcpAnnotationVisibilitiesInSandbox } from '@/services/desktopMcpAnnotations'
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
  replaceProjectState: (project: Project) => void
  updateProject: (updates: Partial<Pick<Project, 'annotations' | 'name' | 'viewportSize' | 'panelLayout' | 'activePageId'>> & {
    jsxCode?: string
    hooksCode?: string
  }) => void
  updatePreviewState: (updates: Partial<PreviewState>) => void
}

interface DesktopMcpResourceBridgeContext {
  project: Project
  theme: ThemeMode
  diagnostics: ReturnType<typeof collectPreviewDiagnostics>
  transpiledCode: string | null
  compileError: PreviewState['compileError']
}

export const useDesktopMcpProjectResourceBridge = ({
  project,
  previewState,
  previewIframeRef,
  theme,
  workingCopyPreferences,
  setTheme,
  replaceProjectState,
  updateProject,
  updatePreviewState,
}: UseDesktopMcpProjectResourceBridgeOptions): void => {
  const resourceContextRef = useRef<DesktopMcpResourceBridgeContext>({
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
    async (request: DesktopMcpProjectResourceReadRequest) =>
      readDesktopMcpProjectResource(request, resourceContextRef.current, {
        resolvePageAnnotationVisibilities: async (pageId, annotations) => {
          const currentContext = resourceContextRef.current
          return resolveDesktopMcpAnnotationVisibilitiesInSandbox({
            annotations,
            transpiledCode:
              currentContext.compileError === null ? currentContext.transpiledCode : null,
            pageId,
            startPageId: currentContext.project.source.startPageId,
            theme: currentContext.theme,
            viewportWidth: getViewportWidth(currentContext.project.viewportSize),
            viewportHeight: Math.max(1, previewIframeRef.current?.clientHeight ?? 900),
          })
        },
      }),
    [previewIframeRef]
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
        transpiledCode: preparedResult.previewRefreshRequired ? null : currentContext.transpiledCode,
        compileError: preparedResult.previewRefreshRequired ? null : currentContext.compileError,
      }
      workingCopyPreferencesRef.current = nextWorkingCopyPreferences

      if (preparedResult.previewRefreshRequired) {
        updatePreviewState({
          status: 'transpiling',
          compileError: null,
          pendingCompileError: null,
          runtimeError: null,
        })
      }

      replaceProjectState(preparedResult.nextProject)
      if (preparedResult.nextTheme !== currentContext.theme) {
        setTheme(preparedResult.nextTheme)
      }

      return preparedResult.result
    },
    [replaceProjectState, setTheme, updatePreviewState]
  )

  const handleAnnotationMutation = useCallback<DesktopMcpAnnotationMutationHandler>(
    async (request) => {
      const currentContext = resourceContextRef.current
      const annotation = currentContext.project.annotations.find(
        (item) => item.id === request.annotationId
      )
      if (!annotation) {
        return mutateDesktopMcpAnnotation(currentContext.project, request)
      }

      const visibility = await resolveDesktopMcpAnnotationVisibilitiesInSandbox({
        annotations: [annotation],
        transpiledCode: currentContext.compileError === null ? currentContext.transpiledCode : null,
        pageId: annotation.pageId,
        startPageId: currentContext.project.source.startPageId,
        theme: currentContext.theme,
        viewportWidth: getViewportWidth(currentContext.project.viewportSize),
        viewportHeight: Math.max(1, previewIframeRef.current?.clientHeight ?? 900),
      })

      const result = mutateDesktopMcpAnnotation(currentContext.project, request, {
        isDeadTarget: (item) => visibility.get(item.id) === 'dead',
      })

      if (result.ok) {
        resourceContextRef.current = {
          ...currentContext,
          project: {
            ...currentContext.project,
            annotations: result.annotations,
            lastModified: new Date().toISOString(),
          },
        }
        updateProject({ annotations: result.annotations })
      }

      return result
    },
    [previewIframeRef, updateProject]
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
        interactions: prepared.requestedInteractions,
        screenshotScope: prepared.screenshotScope,
        includeAnnotationOverlays: prepared.includeAnnotationOverlays,
        annotations: currentContext.project.annotations,
        ...(prepared.target ? { target: prepared.target } : {}),
      })

      if (!captureResult.ok) {
        return captureResult
      }

      return finalizeDesktopMcpPreviewCapture(prepared, captureResult, currentContext)
    },
    [previewIframeRef]
  )

  useLayoutEffect(() => {
    const unregisterProjectRead =
      registerDesktopPreloadMcpProjectResourceReadHandler(handleProjectResourceRead)
    const unregisterAnnotationMutation =
      registerDesktopPreloadMcpAnnotationHandler(handleAnnotationMutation)
    const unregisterApplyChanges = registerDesktopPreloadMcpApplyChangesHandler(handleApplyChanges)
    const unregisterPreviewCapture =
      registerDesktopPreloadMcpPreviewCaptureHandler(handleCapturePreviewEvidence)

    return () => {
      unregisterPreviewCapture?.()
      unregisterApplyChanges?.()
      unregisterAnnotationMutation?.()
      unregisterProjectRead?.()
    }
  }, [
    handleAnnotationMutation,
    handleApplyChanges,
    handleCapturePreviewEvidence,
    handleProjectResourceRead,
  ])
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

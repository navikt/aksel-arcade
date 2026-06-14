import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Alert, BodyShort, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { ExpandIcon, ShrinkIcon } from '@navikt/aksel-icons'
import { AppContext } from '@/hooks/useProject'
import { transpileCode, transpileProjectSource } from '@/services/transpiler'
import { getActiveSource, resolveSelectedEditTarget } from '@/services/projectSource'
import { useSettings } from '@/contexts/SettingsContext'
import { LivePreview } from './LivePreview'
import { ViewportToggle } from './ViewportToggle'
import { InspectMode } from './InspectMode'
import type { CompileError, RuntimeError } from '@/types/preview'
import {
  createSandboxConsoleMessage,
  type SandboxConsolePayload,
} from '@/services/previewDiagnostics'
import './PreviewPane.css'

export const PreviewPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('PreviewPane must be used within AppProvider')

  const {
    project,
    editorState,
    previewState,
    previewIframeRef,
    updatePreviewState,
    recordSandboxConsoleMessage,
    updateProject,
  } = context
  const {
    multiPageEnabled,
    theme,
    selectedEditTarget,
    previewFullscreen,
    setPreviewFullscreen,
  } = useSettings()
  const effectiveEditTarget = resolveSelectedEditTarget(multiPageEnabled, selectedEditTarget)
  const activeSource = getActiveSource(project)
  const singlePagePreviewJsx = multiPageEnabled ? null : activeSource.jsx
  const singlePagePreviewHooks = multiPageEnabled ? null : activeSource.hooks
  const multiPagePreviewSource = multiPageEnabled ? project.source : null
  const showGlobalConfigPlaceholder =
    multiPageEnabled && effectiveEditTarget === 'global-config'
  const [transpiledCode, setTranspiledCode] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<CompileError | null>(null)
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null)
  const [isInspectMode, setIsInspectMode] = useState(false)
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const pendingCompileErrorRef = useRef<CompileError | null>(null)
  const isCodeEditorFocusedRef = useRef(editorState.isCodeEditorFocused)
  const fullscreenToggleRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFullscreenToggleFocusRef = useRef(false)

  const revealCompileError = useCallback(
    (error: CompileError) => {
      console.error('❌ Compile error:', error)
      setCompileError(error)
      updatePreviewState({
        status: 'error',
        compileError: error,
        runtimeError: null,
      })
    },
    [updatePreviewState]
  )

  const queueCompileError = useCallback(
    (error: CompileError) => {
      pendingCompileErrorRef.current = error
      if (isCodeEditorFocusedRef.current) {
        return
      }

      pendingCompileErrorRef.current = null
      revealCompileError(error)
    },
    [revealCompileError]
  )

  useEffect(() => {
    isCodeEditorFocusedRef.current = editorState.isCodeEditorFocused
  }, [editorState.isCodeEditorFocused])

  const isErrorRelevantToCurrentView = (
    error: Pick<CompileError, 'pageId'> | Pick<RuntimeError, 'pageId'> | null
  ) => {
    if (!error) {
      return false
    }

    if (error.pageId == null) {
      return true
    }

    return effectiveEditTarget === 'page' && error.pageId === project.activePageId
  }

  const visibleCompileError =
    previewState.status === 'transpiling' || !isErrorRelevantToCurrentView(compileError)
      ? null
      : compileError
  const visibleRuntimeError =
    previewState.status === 'transpiling' || !isErrorRelevantToCurrentView(runtimeError)
      ? null
      : runtimeError

  // Transpile code when JSX or hooks code changes (debounced to avoid errors while typing)
  useEffect(() => {
    let isCancelled = false

    // Clear previous timer
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
    }

    pendingCompileErrorRef.current = null
    setCompileError(null)
    setRuntimeError(null)
    updatePreviewState({
      status: 'transpiling',
      compileError: null,
      runtimeError: null,
    })

    // Debounce transpilation by 500ms to avoid showing errors while typing
    debounceTimerRef.current = window.setTimeout(() => {
      const transpilePromise = multiPagePreviewSource
        ? transpileProjectSource(multiPagePreviewSource, { previewSessionKey: project.id })
        : transpileCode(singlePagePreviewJsx ?? '', singlePagePreviewHooks ?? '')

      transpilePromise
        .then((result) => {
          if (isCancelled) return

          if (result.success && result.code) {
            pendingCompileErrorRef.current = null
            setTranspiledCode(result.code)
            setCompileError(null)
            setRuntimeError(null)
            updatePreviewState({
              status: 'rendering',
              transpiledCode: result.code,
              compileError: null,
              runtimeError: null,
            })
          } else if (result.error) {
            queueCompileError(result.error)
          }
        })
        .catch((err) => {
          if (isCancelled) return
          console.error('❌ Transpilation error:', err)
          const error = {
            message: err.message || 'Unknown transpilation error',
            line: null,
            column: null,
            stack: null,
            pageId: null,
          }
          queueCompileError(error)
        })
    }, 500)

    return () => {
      isCancelled = true
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [
    project.id,
    multiPagePreviewSource,
    multiPageEnabled,
    queueCompileError,
    singlePagePreviewHooks,
    singlePagePreviewJsx,
    updatePreviewState,
  ])

  useEffect(() => {
    if (editorState.isCodeEditorFocused) {
      return
    }

    const pendingCompileError = pendingCompileErrorRef.current
    if (!pendingCompileError) {
      return
    }

    pendingCompileErrorRef.current = null
    revealCompileError(pendingCompileError)
  }, [editorState.isCodeEditorFocused, revealCompileError])

  const handleRenderSuccess = () => {
    pendingCompileErrorRef.current = null
    setCompileError(null)
    setRuntimeError(null)
    updatePreviewState({
      status: 'idle',
      lastRenderTime: Date.now(),
      compileError: null,
      runtimeError: null,
    })
  }

  const handleCompileError = (error: CompileError) => {
    queueCompileError(error)
  }

  const handleRuntimeError = (error: RuntimeError) => {
    setRuntimeError(error)
    updatePreviewState({
      status: 'error',
      runtimeError: error,
    })
  }

  const handleConsoleMessage = (payload: SandboxConsolePayload) => {
    recordSandboxConsoleMessage(createSandboxConsoleMessage(payload))
  }

  const handlePreviewPageChange = (pageId: (typeof project.source.pages)[number]['id']) => {
    if (effectiveEditTarget === 'global-config') {
      return
    }

    if (pageId !== project.activePageId) {
      updateProject({ activePageId: pageId })
    }
  }

  const handleInspectToggle = (enabled: boolean) => {
    setIsInspectMode(enabled)
  }

  const exitPreviewFullscreen = useCallback(() => {
    if (!previewFullscreen) {
      return
    }

    shouldRestoreFullscreenToggleFocusRef.current = true
    setPreviewFullscreen(false)
  }, [previewFullscreen, setPreviewFullscreen])

  const handlePreviewFullscreenToggle = useCallback(() => {
    if (previewFullscreen) {
      exitPreviewFullscreen()
      return
    }

    shouldRestoreFullscreenToggleFocusRef.current = false
    setPreviewFullscreen(true)
  }, [exitPreviewFullscreen, previewFullscreen, setPreviewFullscreen])

  const handlePreviewPaneKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!previewFullscreen || event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      event.preventDefault()
      exitPreviewFullscreen()
    },
    [exitPreviewFullscreen, previewFullscreen]
  )

  useEffect(() => {
    if (previewFullscreen) {
      fullscreenToggleRef.current?.focus()
      return
    }

    if (!shouldRestoreFullscreenToggleFocusRef.current) {
      return
    }

    shouldRestoreFullscreenToggleFocusRef.current = false
    fullscreenToggleRef.current?.focus()
  }, [previewFullscreen])

  const fullscreenToggleLabel = previewFullscreen
    ? 'Exit preview fullscreen'
    : 'Enter preview fullscreen'

  return (
    <Box
      as="section"
      className={previewFullscreen ? 'preview-pane preview-pane--fullscreen' : 'preview-pane'}
      onKeyDown={handlePreviewPaneKeyDown}
    >
      <Box
        data-name="Preview Header"
        data-testid="preview-header"
        className={
          previewFullscreen
            ? 'preview-pane__header preview-pane__header--fullscreen'
            : 'preview-pane__header'
        }
        borderWidth="0 0 1 0"
        borderColor="neutral-subtleA"
        paddingInline="space-20"
        paddingBlock="space-8"
      >
        <div className="preview-pane__header-controls">
          <div className="preview-pane__header-controls-left">
            <Button
              ref={fullscreenToggleRef}
              variant="tertiary"
              data-color="neutral"
              size="small"
              aria-label={fullscreenToggleLabel}
              aria-pressed={previewFullscreen}
              icon={previewFullscreen ? <ShrinkIcon aria-hidden /> : <ExpandIcon aria-hidden />}
              onClick={handlePreviewFullscreenToggle}
            />
          </div>
          <div
            className="preview-pane__header-controls-right"
            data-testid="preview-header-controls-right"
          >
            <InspectMode onInspectToggle={handleInspectToggle} />
            <div className="preview-pane__viewport-toggle">
              <ViewportToggle />
            </div>
          </div>
        </div>
      </Box>

      <Box
        data-name="Preview"
        paddingBlock={previewFullscreen ? 'space-0' : 'space-16'}
        paddingInline={previewFullscreen ? 'space-0' : 'space-16'}
        background="default"
        className={`preview-pane__surface${previewFullscreen ? ' preview-pane__surface--fullscreen' : ''} ${theme}`}
      >
        {(visibleCompileError || visibleRuntimeError) && (
          <div className="preview-pane__error error-overlay">
            <Alert
              variant="error"
              closeButton
              onClose={() => {
                setCompileError(null)
                setRuntimeError(null)
              }}
            >
              <strong>
                {visibleCompileError ? 'Compile Error' : 'Runtime Error'}
                {visibleCompileError &&
                  visibleCompileError.line !== null &&
                  ` (line ${(visibleCompileError.line || 0) + 1})`}
              </strong>
              <pre className="preview-pane__error-message">
                {(visibleCompileError || visibleRuntimeError)?.message}
              </pre>
              {visibleRuntimeError?.componentStack && (
                <details className="preview-pane__error-details">
                  <summary className="preview-pane__error-summary">Component Stack</summary>
                  <pre className="preview-pane__component-stack">
                    {visibleRuntimeError.componentStack}
                  </pre>
                </details>
              )}
            </Alert>
          </div>
        )}

        <LivePreview
          iframeRef={previewIframeRef}
          transpiledCode={transpiledCode}
          onRenderSuccess={handleRenderSuccess}
          onCompileError={handleCompileError}
          onRuntimeError={handleRuntimeError}
          onConsoleMessage={handleConsoleMessage}
          onPreviewPageChange={handlePreviewPageChange}
          previewPageId={multiPageEnabled ? project.activePageId : null}
          viewportWidth={project.viewportSize}
          isInspectMode={isInspectMode}
          theme={theme}
        />

        {showGlobalConfigPlaceholder && (
          <Box
            className="preview-pane__placeholder preview-pane__placeholder--overlay"
            borderWidth="1"
            borderColor="neutral-subtleA"
            background="default"
            padding="space-24"
          >
            <VStack gap="space-8">
              <BodyShort weight="semibold">Global config has no preview</BodyShort>
              <Detail size="small">
                Shared JSX and Hooks stay in scope for every page. Select a page in the panel to
                preview the running prototype.
              </Detail>
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  )
}

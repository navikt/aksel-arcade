import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Alert, BodyShort, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { ChatElipsisIcon, ExpandIcon, ShrinkIcon, TrashIcon } from '@navikt/aksel-icons'
import { SharePopoverButton } from '@/components/Share/SharePopoverButton'
import { AppContext } from '@/hooks/useProject'
import { countOpenAnnotationsByPage } from '@/services/annotations'
import { transpileProjectSource } from '@/services/transpiler'
import { resolveSelectedEditTarget } from '@/services/projectSource'
import { WEB_ARCADE_CAPABILITIES, type ShellCapabilities } from '@/services/shellCapabilities'
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

interface PreviewPaneProps {
  shellCapabilities?: ShellCapabilities
}

export const PreviewPane = ({
  shellCapabilities = WEB_ARCADE_CAPABILITIES,
}: PreviewPaneProps = {}) => {
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
  const { theme, selectedEditTarget, previewFullscreen, setPreviewFullscreen } = useSettings()
  const canUseShareUrl = shellCapabilities.shareUrl.enabled
  const effectiveEditTarget = resolveSelectedEditTarget(selectedEditTarget)
  const showGlobalConfigPlaceholder = effectiveEditTarget === 'global-config'
  const [transpiledCode, setTranspiledCode] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<CompileError | null>(null)
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null)
  const [isInspectMode, setIsInspectMode] = useState(false)
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const pendingCompileErrorRef = useRef<CompileError | null>(null)
  const isCodeEditorFocusedRef = useRef(editorState.isCodeEditorFocused)
  const lastTranspileProjectIdRef = useRef<string | null>(null)
  const fullscreenToggleRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFullscreenToggleFocusRef = useRef(false)

  const revealCompileError = useCallback(
    (error: CompileError) => {
      console.error('❌ Compile error:', error)
      setCompileError(error)
      setRuntimeError(null)
      updatePreviewState({
        status: 'error',
        compileError: error,
        pendingCompileError: null,
        runtimeError: null,
      })
    },
    [updatePreviewState]
  )

  const queueCompileError = useCallback(
    (error: CompileError) => {
      pendingCompileErrorRef.current = error
      if (isCodeEditorFocusedRef.current) {
        setRuntimeError(null)
        updatePreviewState({
          status: 'error',
          compileError: null,
          pendingCompileError: error,
          runtimeError: null,
        })
        return
      }

      pendingCompileErrorRef.current = null
      revealCompileError(error)
    },
    [revealCompileError, updatePreviewState]
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
    previewState.status === 'transpiling' ? null : compileError
  const visibleRuntimeError =
    previewState.status === 'transpiling' || !isErrorRelevantToCurrentView(runtimeError)
      ? null
      : runtimeError

  const compileErrorPageName =
    visibleCompileError?.pageId && visibleCompileError.pageId !== project.activePageId
      ? (project.source.pages.find((page) => page.id === visibleCompileError.pageId)?.name ?? null)
      : null

  // Transpile code when JSX or hooks code changes (debounced to avoid errors while typing)
  useEffect(() => {
    let isCancelled = false
    const shouldDebounceTranspilation =
      lastTranspileProjectIdRef.current === project.id && isCodeEditorFocusedRef.current

    lastTranspileProjectIdRef.current = project.id

    const runTranspilation = () => {
      const transpilePromise = transpileProjectSource(project.source, {
        previewSessionKey: project.id,
      })

      transpilePromise
        .then((result) => {
          if (isCancelled) return

          if (result.success && result.code) {
            pendingCompileErrorRef.current = null
            setTranspiledCode(result.code)
            setCompileError(null)
            updatePreviewState({
              status: 'rendering',
              transpiledCode: result.code,
              compileError: null,
              pendingCompileError: null,
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
    }

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
      pendingCompileError: null,
      runtimeError: null,
    })

    if (shouldDebounceTranspilation) {
      debounceTimerRef.current = window.setTimeout(runTranspilation, 500)
    } else {
      runTranspilation()
    }

    return () => {
      isCancelled = true
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [
    project.id,
    project.source,
    queueCompileError,
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
      pendingCompileError: null,
      runtimeError: null,
    })
  }

  const handleCompileError = (error: CompileError) => {
    queueCompileError(error)
  }

  const handleRuntimeError = (error: RuntimeError) => {
    pendingCompileErrorRef.current = null
    setCompileError(null)
    setRuntimeError(error)
    updatePreviewState({
      status: 'error',
      compileError: null,
      pendingCompileError: null,
      runtimeError: error,
    })
  }

  const handleConsoleMessage = (payload: SandboxConsolePayload) => {
    recordSandboxConsoleMessage(createSandboxConsoleMessage(payload))
  }

  const handlePreviewPageChange = (pageId: (typeof project.source.pages)[number]['id']) => {
    if (pageId !== project.activePageId) {
      updateProject({ activePageId: pageId })
    }
  }

  const handleInspectToggle = (enabled: boolean) => {
    if (enabled) {
      setIsAnnotationMode(false)
    }
    setIsInspectMode(enabled)
  }

  const handleAnnotationToggle = () => {
    setIsAnnotationMode((current) => {
      const nextMode = !current
      if (nextMode) {
        setIsInspectMode(false)
      }
      return nextMode
    })
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
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      if (
        event.target instanceof Element &&
        event.target.closest('[data-share-popover-content="true"]')
      ) {
        return
      }

      if (isAnnotationMode) {
        event.preventDefault()
        setIsAnnotationMode(false)
        return
      }

      if (!previewFullscreen) {
        return
      }

      event.preventDefault()
      exitPreviewFullscreen()
    },
    [exitPreviewFullscreen, isAnnotationMode, previewFullscreen]
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
  const activePageOpenAnnotationCount =
    countOpenAnnotationsByPage(project.annotations).get(project.activePageId) ?? 0
  const annotationToggleLabel = isAnnotationMode
    ? `Exit annotation mode, ${activePageOpenAnnotationCount} open annotations on this page`
    : `Enter annotation mode, ${activePageOpenAnnotationCount} open annotations on this page`
  const visibleAnnotationCount =
    activePageOpenAnnotationCount > 99 ? '99+' : String(activePageOpenAnnotationCount)

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
              size="xsmall"
              aria-label={fullscreenToggleLabel}
              aria-pressed={previewFullscreen}
              icon={previewFullscreen ? <ShrinkIcon aria-hidden /> : <ExpandIcon aria-hidden />}
              onClick={handlePreviewFullscreenToggle}
              className="preview-pane__icon-button"
            />
          </div>
          <div
            className="preview-pane__header-controls-right"
            data-testid="preview-header-controls-right"
          >
            <div className="preview-pane__annotation-controls">
              {isAnnotationMode && (
                <Button
                  type="button"
                  variant="tertiary"
                  data-color="danger"
                  size="xsmall"
                  aria-label="Clear all annotations on this page"
                  icon={<TrashIcon aria-hidden />}
                  className="preview-pane__icon-button"
                />
              )}
              <div className="preview-pane__annotation-toggle-wrapper">
                <Button
                  type="button"
                  variant="tertiary"
                  data-color="neutral"
                  size="xsmall"
                  aria-label={annotationToggleLabel}
                  aria-pressed={isAnnotationMode}
                  icon={<ChatElipsisIcon aria-hidden />}
                  onClick={handleAnnotationToggle}
                  className={
                    isAnnotationMode
                      ? 'preview-pane__icon-button preview-pane__annotation-toggle preview-pane__annotation-toggle--active'
                      : 'preview-pane__icon-button preview-pane__annotation-toggle'
                  }
                />
                <span
                  className="preview-pane__annotation-badge"
                  data-testid="annotation-count-badge"
                  aria-hidden="true"
                >
                  <span className="preview-pane__annotation-badge-text">{visibleAnnotationCount}</span>
                </span>
              </div>
            </div>
            <InspectMode isInspectMode={isInspectMode} onInspectToggle={handleInspectToggle} />
            <div className="preview-pane__viewport-toggle">
              <ViewportToggle />
            </div>
            {previewFullscreen && canUseShareUrl && (
              <SharePopoverButton
                ariaLabel="Share fullscreen preview"
                note="opens in fullscreen"
                shareOptions={{ openingIntent: { previewFullscreen: true } }}
              />
            )}
          </div>
        </div>
      </Box>

      <Box
        data-name="Preview"
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
                {compileErrorPageName && ` in "${compileErrorPageName}"`}
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
          previewPageId={project.activePageId}
          viewportWidth={project.viewportSize}
          isInspectMode={isInspectMode}
          isAnnotationMode={isAnnotationMode}
          annotations={project.annotations}
          onAnnotationsChange={(annotations) => updateProject({ annotations })}
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

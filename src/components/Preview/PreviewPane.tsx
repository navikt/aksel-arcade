import { useContext, useEffect, useState, useRef } from 'react'
import { Alert, Box, HStack } from '@navikt/ds-react'
import { AppContext } from '@/hooks/useProject'
import { transpileCode, transpileProjectSource } from '@/services/transpiler'
import { getActiveSource } from '@/services/projectSource'
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

  const { project, previewIframeRef, updatePreviewState, recordSandboxConsoleMessage } = context
  const { multiPageEnabled, theme } = useSettings() // Use centralized theme from Settings
  const activeSource = getActiveSource(project)
  const singlePagePreviewJsx = multiPageEnabled ? null : activeSource.jsx
  const singlePagePreviewHooks = multiPageEnabled ? null : activeSource.hooks
  const multiPagePreviewSource = multiPageEnabled ? project.source : null
  const [transpiledCode, setTranspiledCode] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<CompileError | null>(null)
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null)
  const [isInspectMode, setIsInspectMode] = useState(false)
  const debounceTimerRef = useRef<number | undefined>(undefined)

  // Transpile code when JSX or hooks code changes (debounced to avoid errors while typing)
  useEffect(() => {
    let isCancelled = false

    // Clear previous timer
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
    }

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
            console.error('❌ Compile error:', result.error)
            setCompileError(result.error)
            setTranspiledCode(null)
            updatePreviewState({
              status: 'error',
              transpiledCode: null,
              compileError: result.error,
              runtimeError: null,
            })
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
          }
          setCompileError(error)
          setTranspiledCode(null)
          updatePreviewState({
            status: 'error',
            transpiledCode: null,
            compileError: error,
            runtimeError: null,
          })
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
    singlePagePreviewHooks,
    singlePagePreviewJsx,
    updatePreviewState,
  ])

  const handleRenderSuccess = () => {
    setRuntimeError(null)
    updatePreviewState({
      status: 'idle',
      lastRenderTime: Date.now(),
      compileError: null,
      runtimeError: null,
    })
  }

  const handleCompileError = (error: CompileError) => {
    setCompileError(error)
    updatePreviewState({
      status: 'error',
      compileError: error,
      runtimeError: null,
    })
  }

  const handleRuntimeError = (error: RuntimeError) => {
    setRuntimeError(error)
    updatePreviewState({
      status: 'error',
      compileError: null,
      runtimeError: error,
    })
  }

  const handleConsoleMessage = (payload: SandboxConsolePayload) => {
    recordSandboxConsoleMessage(createSandboxConsoleMessage(payload))
  }

  const handleInspectToggle = (enabled: boolean) => {
    setIsInspectMode(enabled)
  }

  return (
    <Box as="section" className="preview-pane">
      <Box
        data-name="Preview Header"
        borderWidth="0 0 1 0"
        borderColor="neutral-subtleA"
        paddingInline="space-20"
        paddingBlock="space-8"
      >
        <HStack gap="space-12" justify="end" align="center">
          <InspectMode onInspectToggle={handleInspectToggle} />
          <ViewportToggle />
        </HStack>
      </Box>

      <Box
        data-name="Preview"
        paddingBlock="space-16"
        paddingInline="space-16"
        background="default"
        className={`preview-pane__surface ${theme}`}
      >
        {(compileError || runtimeError) && (
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
                {compileError ? 'Compile Error' : 'Runtime Error'}
                {compileError &&
                  compileError.line !== null &&
                  ` (line ${(compileError.line || 0) + 1})`}
              </strong>
              <pre className="preview-pane__error-message">
                {(compileError || runtimeError)?.message}
              </pre>
              {runtimeError?.componentStack && (
                <details className="preview-pane__error-details">
                  <summary className="preview-pane__error-summary">Component Stack</summary>
                  <pre className="preview-pane__component-stack">{runtimeError.componentStack}</pre>
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
          viewportWidth={project.viewportSize}
          isInspectMode={isInspectMode}
          theme={theme}
        />
      </Box>
    </Box>
  )
}

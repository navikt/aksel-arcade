import { useContext, useEffect, useState, useRef } from 'react'
import { HStack, VStack, BoxNew, Alert } from '@navikt/ds-react'
import { AppContext } from '@/hooks/useProject'
import { transpileCode } from '@/services/transpiler'
import { useSettings } from '@/contexts/SettingsContext'
import { LivePreview } from './LivePreview'
import { ViewportToggle } from './ViewportToggle'
import { InspectMode } from './InspectMode'
import type { CompileError, RuntimeError } from '@/types/preview'
import './PreviewPane.css'

export const PreviewPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('PreviewPane must be used within AppProvider')

  const { project, updatePreviewState } = context
  const { theme } = useSettings() // Use centralized theme from Settings
  const [transpiledCode, setTranspiledCode] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<CompileError | null>(null)
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null)
  const [isInspectMode, setIsInspectMode] = useState(false)
  const debounceTimerRef = useRef<number | undefined>(undefined)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Transpile code when JSX or hooks code changes (debounced to avoid errors while typing)
  useEffect(() => {
    let isCancelled = false

    // Clear previous timer
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce transpilation by 500ms to avoid showing errors while typing
    debounceTimerRef.current = window.setTimeout(() => {
      transpileCode(project.jsxCode, project.hooksCode)
        .then((result) => {
          if (isCancelled) return
          
          if (result.success && result.code) {
            console.log('✅ Transpilation successful')
            console.log('📝 Transpiled code:', result.code)
            setTranspiledCode(result.code)
            setCompileError(null)
          } else if (result.error) {
            console.error('❌ Compile error:', result.error)
            setCompileError(result.error)
            setTranspiledCode(null)
          }
        })
        .catch((err) => {
          if (isCancelled) return
          console.error('❌ Transpilation error:', err)
          setCompileError({
            message: err.message || 'Unknown transpilation error',
            line: null,
            column: null,
            stack: null,
          })
        })
    }, 500)

    return () => {
      isCancelled = true
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [project.jsxCode, project.hooksCode])

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
    })
  }

  const handleRuntimeError = (error: RuntimeError) => {
    setRuntimeError(error)
    updatePreviewState({
      status: 'error',
      runtimeError: error,
    })
  }

  const handleInspectToggle = (enabled: boolean) => {
    setIsInspectMode(enabled)
  }

  return (
    <>
      <HStack gap="space-12" justify="end" align="center" asChild>
        <BoxNew
          data-name="Preview Header"
          borderWidth="0 0 1 0"
          borderColor="neutral-subtleA"
          paddingInline="space-20"
          paddingBlock="space-8"
        >
          <InspectMode 
            iframeRef={iframeRef}
            onInspectToggle={handleInspectToggle}
          />
          <ViewportToggle />
        </BoxNew>
      </HStack>

      <VStack asChild style={{ flex: 1, minHeight: 0 }}>
        <BoxNew 
          data-name="Preview" 
          paddingBlock="space-16" 
          paddingInline="space-16" 
          background="sunken"
          className={theme}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
        >
          {/* Error Display - Using Aksel Alert */}
          {(compileError || runtimeError) && (
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              zIndex: 1000,
            }}>
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
                  {compileError && compileError.line !== null && ` (line ${(compileError.line || 0) + 1})`}
                </strong>
                <pre style={{
                  marginTop: '0.5rem',
                  marginBottom: 0,
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {(compileError || runtimeError)?.message}
                </pre>
                {runtimeError?.componentStack && (
                  <details style={{ marginTop: '0.75rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      Component Stack
                    </summary>
                    <pre style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: 'var(--ax-bg-neutral-moderate)',
                      borderRadius: 'var(--ax-radius-4)',
                      fontSize: '0.75rem',
                      overflowX: 'auto',
                    }}>
                      {runtimeError.componentStack}
                    </pre>
                  </details>
                )}
              </Alert>
            </div>
          )}

          <LivePreview
            iframeRef={iframeRef}
            transpiledCode={transpiledCode}
            onRenderSuccess={handleRenderSuccess}
            onCompileError={handleCompileError}
            onRuntimeError={handleRuntimeError}
            viewportWidth={project.viewportSize}
            isInspectMode={isInspectMode}
            theme={theme}
          />
        </BoxNew>
      </VStack>
    </>
  )
}

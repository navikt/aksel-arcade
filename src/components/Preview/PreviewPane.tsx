import { useContext, useEffect, useState, useRef } from 'react'
import { HStack, VStack, BoxNew, Button } from '@navikt/ds-react'
import { XMarkIcon } from '@navikt/aksel-icons'
import { AppContext } from '@/hooks/useProject'
import { transpileCode } from '@/services/transpiler'
import { LivePreview } from './LivePreview'
import { ViewportToggle } from './ViewportToggle'
import { InspectMode } from './InspectMode'
import { ThemeToggle } from './ThemeToggle'
import type { CompileError, RuntimeError } from '@/types/preview'
import './PreviewPane.css'

export const PreviewPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('PreviewPane must be used within AppProvider')

  const { project, updatePreviewState } = context
  const [transpiledCode, setTranspiledCode] = useState<string | null>(null)
  const [compileError, setCompileError] = useState<CompileError | null>(null)
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null)
  const [isInspectMode, setIsInspectMode] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
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

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setPreviewTheme(theme)
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
          <ThemeToggle
            iframeRef={iframeRef}
            onThemeChange={handleThemeChange}
          />
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
          className={previewTheme}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
        >
          {/* Error Display - Simple and Direct */}
          {(compileError || runtimeError) && (
            <BoxNew
              borderWidth="1"
              borderColor="danger-moderate"
              paddingBlock="space-12"
              paddingInline="space-16"
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                right: '16px',
                zIndex: 1000,
                borderRadius: 'var(--ax-radius-8)',
                background: 'var(--ax-bg-raised)',
              }}
            >
              <HStack gap="space-12" justify="space-between" align="start">
                <VStack gap="space-4" style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--ax-text-neutral)', fontSize: '1rem' }}>
                    {compileError ? 'Compile Error' : 'Runtime Error'}
                    {compileError && compileError.line !== null && ` (line ${(compileError.line || 0) + 1})`}
                  </strong>
                  <pre style={{
                    margin: 0,
                    color: 'var(--ax-text-neutral)',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {(compileError || runtimeError)?.message}
                  </pre>
                  {runtimeError?.componentStack && (
                    <details style={{ marginTop: '8px', color: 'var(--ax-text-neutral)' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Component Stack
                      </summary>
                      <pre style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 'var(--ax-radius-4)',
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                      }}>
                        {runtimeError.componentStack}
                      </pre>
                    </details>
                  )}
                </VStack>
                <Button
                  variant="tertiary"
                  size="small"
                  icon={<XMarkIcon aria-hidden />}
                  onClick={() => {
                    setCompileError(null)
                    setRuntimeError(null)
                  }}
                  style={{ flexShrink: 0 }}
                >
                  Close
                </Button>
              </HStack>
            </BoxNew>
          )}

          <LivePreview
            iframeRef={iframeRef}
            transpiledCode={transpiledCode}
            onRenderSuccess={handleRenderSuccess}
            onCompileError={handleCompileError}
            onRuntimeError={handleRuntimeError}
            viewportWidth={project.viewportSize}
            isInspectMode={isInspectMode}
          />
        </BoxNew>
      </VStack>
    </>
  )
}

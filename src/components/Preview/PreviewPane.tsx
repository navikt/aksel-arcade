import { useContext, useEffect, useState, useRef } from 'react'
import { AppContext } from '@/hooks/useProject'
import { transpileCode } from '@/services/transpiler'
import { LivePreview } from './LivePreview'
import { ErrorOverlay } from './ErrorOverlay'
import { ViewportToggle } from './ViewportToggle'
import { InspectMode } from './InspectMode'
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
    <div className="preview-pane">
      <div className="preview-pane__header">
        <InspectMode 
          iframeRef={iframeRef}
          onInspectToggle={handleInspectToggle}
        />
        <ViewportToggle />
      </div>

      <ErrorOverlay
        compileError={compileError}
        runtimeError={runtimeError}
        onClose={() => {
          setCompileError(null)
          setRuntimeError(null)
        }}
      />
      
      <LivePreview
        iframeRef={iframeRef}
        transpiledCode={transpiledCode}
        onRenderSuccess={handleRenderSuccess}
        onCompileError={handleCompileError}
        onRuntimeError={handleRuntimeError}
        viewportWidth={project.viewportSize}
        isInspectMode={isInspectMode}
      />
    </div>
  )
}

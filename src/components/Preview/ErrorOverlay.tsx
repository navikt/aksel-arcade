import { Alert } from '@navikt/ds-react'
import type { CompileError, RuntimeError } from '@/types/preview'
import './ErrorOverlay.css'

interface ErrorOverlayProps {
  compileError?: CompileError | null
  runtimeError?: RuntimeError | null
  onClose: () => void
}

export const ErrorOverlay = ({ compileError, runtimeError, onClose }: ErrorOverlayProps) => {
  if (!compileError && !runtimeError) return null

  const error = compileError || runtimeError

  if (!error) return null

  const title = compileError ? 'Compile Error' : 'Runtime Error'
  const location = compileError && compileError.line !== null ? ` (line ${(compileError.line || 0) + 1})` : ''

  return (
    <div className="error-overlay">
      <Alert variant="error" closeButton onClose={onClose}>
        <strong>{title}{location}</strong>
        <div className="error-overlay__message">{error.message}</div>
        {runtimeError?.componentStack && (
          <details className="error-overlay__stack">
            <summary>Component Stack</summary>
            <pre>{runtimeError.componentStack}</pre>
          </details>
        )}
      </Alert>
    </div>
  )
}

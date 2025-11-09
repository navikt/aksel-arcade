import { useRef, useEffect, useState } from 'react'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import { validateSandboxToMainMessage } from '@/utils/security'
import './LivePreview.css'

interface LivePreviewProps {
  transpiledCode: string | null
  onRenderSuccess: () => void
  onCompileError: (error: { message: string; line: number | null; column: number | null; stack: string | null }) => void
  onRuntimeError: (error: { message: string; componentStack: string | null; stack: string }) => void
}

export const LivePreview = ({
  transpiledCode,
  onRenderSuccess,
  onCompileError,
  onRuntimeError,
}: LivePreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [sandboxReady, setSandboxReady] = useState(false)
  const pendingCodeRef = useRef<string | null>(null)

  // Listen for messages from sandbox
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate source
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      // Check for SANDBOX_READY message (not in type-safe messages yet)
      if (event.data?.type === 'SANDBOX_READY') {
        console.log('✅ Sandbox is ready')
        setSandboxReady(true)
        
        // Send pending code if any
        if (pendingCodeRef.current && iframeRef.current?.contentWindow) {
          const message: MainToSandboxMessage = {
            type: 'EXECUTE_CODE',
            payload: { jsxCode: pendingCodeRef.current, hooksCode: '' },
          }
          console.log('📤 Sending pending code to sandbox')
          iframeRef.current.contentWindow.postMessage(message, '*')
          pendingCodeRef.current = null
        }
        return
      }

      // Validate message structure
      if (!validateSandboxToMainMessage(event.data)) {
        console.warn('Invalid message from sandbox:', event.data)
        return
      }

      const message = event.data as SandboxToMainMessage

      switch (message.type) {
        case 'RENDER_SUCCESS':
          onRenderSuccess()
          break
        case 'COMPILE_ERROR':
          onCompileError(message.payload)
          break
        case 'RUNTIME_ERROR':
          onRuntimeError(message.payload)
          break
        case 'CONSOLE_LOG':
          // Forward console logs to main console
          console[message.payload.level](...message.payload.args)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onRenderSuccess, onCompileError, onRuntimeError])

  // Send code to sandbox when it changes
  useEffect(() => {
    if (!transpiledCode || !iframeRef.current?.contentWindow) {
      console.log('⏸️ Skipping execution - no code or iframe not ready')
      return
    }

    // If sandbox isn't ready yet, store code to send later
    if (!sandboxReady) {
      console.log('⏸️ Sandbox not ready, storing code for later')
      pendingCodeRef.current = transpiledCode
      return
    }

    const message: MainToSandboxMessage = {
      type: 'EXECUTE_CODE',
      payload: { jsxCode: transpiledCode, hooksCode: '' },
    }

    console.log('📤 Sending EXECUTE_CODE to sandbox')
    iframeRef.current.contentWindow.postMessage(message, '*')
  }, [transpiledCode, sandboxReady])

  return (
    <div className="live-preview" data-testid="live-preview">
      <iframe
        ref={iframeRef}
        className="live-preview__iframe"
        src="/sandbox.html"
        sandbox="allow-scripts allow-same-origin"
        title="Live Preview Sandbox"
        data-testid="preview-iframe"
      />
    </div>
  )
}

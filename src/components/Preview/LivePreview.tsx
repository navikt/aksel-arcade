import { useRef, useEffect, useState } from 'react'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import type { ViewportSize } from '@/types/project'
import type { InspectionData } from '@/types/inspection'
import { getViewportWidth } from '@/types/viewports'
import { validateSandboxToMainMessage } from '@/utils/security'
import { InspectionPopover } from './InspectionPopover'
import './LivePreview.css'

interface LivePreviewProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  transpiledCode: string | null
  onRenderSuccess: () => void
  onCompileError: (error: { message: string; line: number | null; column: number | null; stack: string | null }) => void
  onRuntimeError: (error: { message: string; componentStack: string | null; stack: string }) => void
  viewportWidth: ViewportSize
  isInspectMode: boolean
  theme: 'light' | 'dark'
}

export const LivePreview = ({
  iframeRef,
  transpiledCode,
  onRenderSuccess,
  onCompileError,
  onRuntimeError,
  viewportWidth,
  isInspectMode,
  theme,
}: LivePreviewProps) => {
  const [sandboxReady, setSandboxReady] = useState(false)
  const pendingCodeRef = useRef<string | null>(null)
  
  // T082: Inspection state
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null)

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
        case 'INSPECTION_DATA':
          // T082: Update popover position and content
          if (message.payload) {
            setInspectionData(message.payload)
            // Position is based on mouse cursor (will be updated from mouse events)
          } else {
            // T083: Clear inspection popover when no element
            setInspectionData(null)
          }
          break
        case 'CONSOLE_LOG':
          // Forward console logs to main console
          console[message.payload.level](...message.payload.args)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onRenderSuccess, onCompileError, onRuntimeError, iframeRef])

  // T083: Clear inspection popover when inspect mode disabled
  useEffect(() => {
    if (!isInspectMode) {
      setInspectionData(null)
    }
  }, [isInspectMode])

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
  }, [transpiledCode, sandboxReady, iframeRef])

  // Send viewport update when viewport changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !sandboxReady) {
      return
    }

    const width = getViewportWidth(viewportWidth)
    const message: MainToSandboxMessage = {
      type: 'UPDATE_VIEWPORT',
      payload: { width },
    }

    console.log(`📤 Sending UPDATE_VIEWPORT to sandbox: ${width}px`)
    iframeRef.current.contentWindow.postMessage(message, '*')
  }, [viewportWidth, sandboxReady, iframeRef])

  // Send theme update when theme changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !sandboxReady) {
      return
    }

    const message: MainToSandboxMessage = {
      type: 'UPDATE_THEME',
      payload: { theme },
    }

    console.log(`📤 Sending UPDATE_THEME to sandbox: ${theme}`)
    iframeRef.current.contentWindow.postMessage(message, '*')
  }, [theme, sandboxReady, iframeRef])

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
      
      {inspectionData && iframeRef.current && (
        <InspectionPopover
          data={inspectionData}
          iframeRef={iframeRef}
          isVisible={isInspectMode}
        />
      )}
    </div>
  )
}

import { useRef, useEffect, useState } from 'react'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import type { ViewportSize } from '@/types/project'
import type { InspectionData } from '@/types/inspection'
import type { SandboxConsolePayload } from '@/services/previewDiagnostics'
import { getViewportWidth } from '@/types/viewports'
import { validateSandboxToMainMessage } from '@/utils/security'
import { postMessageToSandbox } from '@/utils/sandboxMessaging'
import { InspectionPopover } from './InspectionPopover'
import './LivePreview.css'

interface LivePreviewProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  transpiledCode: string | null
  onRenderSuccess: () => void
  onCompileError: (error: { message: string; line: number | null; column: number | null; stack: string | null }) => void
  onRuntimeError: (error: { message: string; componentStack: string | null; stack: string }) => void
  onConsoleMessage: (message: SandboxConsolePayload) => void
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
  onConsoleMessage,
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
        setSandboxReady(true)
        
        // Send pending code if any
        if (pendingCodeRef.current && iframeRef.current?.contentWindow) {
          const message: MainToSandboxMessage = {
            type: 'EXECUTE_CODE',
            payload: { jsxCode: pendingCodeRef.current, hooksCode: '' },
          }
          postMessageToSandbox(iframeRef.current.contentWindow, message)
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
        case 'THEME_UPDATED':
          break
        case 'CONSOLE_LOG':
          // Forward console logs to main console
          if (message.payload.level === 'warn') {
            console.warn(...message.payload.args)
          } else if (message.payload.level === 'error') {
            console.error(...message.payload.args)
          } else {
            console.log(...message.payload.args)
          }
          onConsoleMessage(message.payload)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onRenderSuccess, onCompileError, onRuntimeError, onConsoleMessage, iframeRef])

  // T083: Clear inspection popover when inspect mode disabled
  useEffect(() => {
    if (!isInspectMode) {
      setInspectionData(null)
    }
  }, [isInspectMode])

  // Send code to sandbox when it changes
  useEffect(() => {
    if (!transpiledCode || !iframeRef.current?.contentWindow) {
      return
    }

    // If sandbox isn't ready yet, store code to send later
    if (!sandboxReady) {
      pendingCodeRef.current = transpiledCode
      return
    }

    const message: MainToSandboxMessage = {
      type: 'EXECUTE_CODE',
      payload: { jsxCode: transpiledCode, hooksCode: '' },
    }

    postMessageToSandbox(iframeRef.current.contentWindow, message)
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

    postMessageToSandbox(iframeRef.current.contentWindow, message)
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

    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [theme, sandboxReady, iframeRef])

  return (
    <div className="live-preview" data-testid="live-preview">
      <iframe
        ref={iframeRef}
        className="live-preview__iframe"
        src={import.meta.env.BASE_URL + 'sandbox.html'}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
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

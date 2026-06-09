import { useCallback, useRef, useEffect, useState } from 'react'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import type { ArcadePageId, ViewportSize } from '@/types/project'
import type { InspectionData } from '@/types/inspection'
import type { SandboxConsolePayload } from '@/services/previewDiagnostics'
import type { CompileError, RuntimeError } from '@/types/preview'
import {
  registerPreviewEvidenceRequestHandler,
  type PreviewEvidenceCaptureResult,
} from '@/services/previewEvidence'
import { getViewportWidth } from '@/types/viewports'
import { validateSandboxToMainMessage } from '@/utils/security'
import {
  postMessageToSandbox,
  registerSandboxMessagePort,
  unregisterSandboxMessagePort,
} from '@/utils/sandboxMessaging'
import { InspectionPopover } from './InspectionPopover'
import './LivePreview.css'

const PREVIEW_EVIDENCE_REQUEST_TIMEOUT_MS = 5_000
const SANDBOX_IFRAME_SRC =
  import.meta.env.MODE === 'test' ? 'about:blank' : import.meta.env.BASE_URL + 'sandbox.html'

interface LivePreviewProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  transpiledCode: string | null
  onRenderSuccess: () => void
  onCompileError: (error: CompileError) => void
  onRuntimeError: (error: RuntimeError) => void
  onConsoleMessage: (message: SandboxConsolePayload) => void
  onPreviewPageChange: (pageId: ArcadePageId) => void
  previewPageId: ArcadePageId | null
  viewportWidth: ViewportSize
  isInspectMode: boolean
  theme: 'light' | 'dark'
}

interface PendingPreviewEvidenceRequest {
  resolve: (result: PreviewEvidenceCaptureResult) => void
  timeoutId: number
}

export const LivePreview = ({
  iframeRef,
  transpiledCode,
  onRenderSuccess,
  onCompileError,
  onRuntimeError,
  onConsoleMessage,
  onPreviewPageChange,
  previewPageId,
  viewportWidth,
  isInspectMode,
  theme,
}: LivePreviewProps) => {
  const [sandboxReady, setSandboxReady] = useState(false)
  const pendingCodeRef = useRef<string | null>(null)
  const latestTranspiledCodeRef = useRef(transpiledCode)
  const sandboxPortRef = useRef<MessagePort | null>(null)
  const previewEvidenceRequestIdRef = useRef(0)
  const previewEvidenceRequestsRef = useRef(new Map<string, PendingPreviewEvidenceRequest>())
  const previewEvidenceUnregisterRef = useRef<(() => void) | null>(null)
  const sandboxConnectedRef = useRef(false)
  const sandboxRetiredRef = useRef(false)
  const lastReportedPageIdRef = useRef<ArcadePageId | null>(null)
  const handlersRef = useRef({
    onRenderSuccess,
    onCompileError,
    onRuntimeError,
    onConsoleMessage,
    onPreviewPageChange,
  })
  const previewPageIdRef = useRef(previewPageId)
  
  // T082: Inspection state
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null)

  useEffect(() => {
    latestTranspiledCodeRef.current = transpiledCode
  }, [transpiledCode])

  useEffect(() => {
    previewPageIdRef.current = previewPageId
  }, [previewPageId])

  useEffect(() => {
    handlersRef.current = {
      onRenderSuccess,
      onCompileError,
      onRuntimeError,
      onConsoleMessage,
      onPreviewPageChange,
    }
  }, [onRenderSuccess, onCompileError, onRuntimeError, onConsoleMessage, onPreviewPageChange])

  const postNavigateToPage = useCallback((pageId: ArcadePageId) => {
    if (!iframeRef.current?.contentWindow) {
      return
    }

    const message: MainToSandboxMessage = {
      type: 'NAVIGATE_TO_PAGE',
      payload: { pageId },
    }

    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [iframeRef])

  // Listen for messages from sandbox
  useEffect(() => {
    let connectedWindow: Window | null = null

    const sendPendingCode = () => {
      if (!pendingCodeRef.current || !iframeRef.current?.contentWindow) {
        return
      }

      const message: MainToSandboxMessage = {
        type: 'EXECUTE_CODE',
        payload: { jsxCode: pendingCodeRef.current, hooksCode: '' },
      }
      postMessageToSandbox(iframeRef.current.contentWindow, message)
      pendingCodeRef.current = null
    }

    const createPreviewUnavailableResult = (message: string): PreviewEvidenceCaptureResult => ({
      ok: false,
      error: {
        code: 'preview-unavailable',
        message,
      },
    })

    const resolvePendingPreviewEvidenceRequest = (
      requestId: string,
      result: PreviewEvidenceCaptureResult
    ) => {
      const pendingRequest = previewEvidenceRequestsRef.current.get(requestId)
      if (!pendingRequest) {
        return
      }

      clearTimeout(pendingRequest.timeoutId)
      previewEvidenceRequestsRef.current.delete(requestId)
      pendingRequest.resolve(result)
    }

    const resolveAllPendingPreviewEvidenceRequests = (message: string) => {
      const result = createPreviewUnavailableResult(message)
      for (const [requestId, pendingRequest] of previewEvidenceRequestsRef.current) {
        clearTimeout(pendingRequest.timeoutId)
        pendingRequest.resolve(result)
        previewEvidenceRequestsRef.current.delete(requestId)
      }
    }

    const requestPreviewEvidence = (): Promise<PreviewEvidenceCaptureResult> => {
      const port = sandboxPortRef.current
      if (!port) {
        return Promise.resolve(
          createPreviewUnavailableResult('Preview iframe is not connected to the sandbox yet.')
        )
      }

      const requestId = `preview-evidence-${++previewEvidenceRequestIdRef.current}`
      return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
          resolvePendingPreviewEvidenceRequest(
            requestId,
            createPreviewUnavailableResult('Preview evidence request timed out.')
          )
        }, PREVIEW_EVIDENCE_REQUEST_TIMEOUT_MS)

        previewEvidenceRequestsRef.current.set(requestId, {
          resolve,
          timeoutId,
        })
        port.postMessage({
          type: 'CAPTURE_PREVIEW_EVIDENCE',
          payload: { requestId },
        } satisfies MainToSandboxMessage)
      })
    }

    const disconnectSandbox = (resetReady: boolean) => {
      if (connectedWindow) {
        unregisterSandboxMessagePort(connectedWindow)
        connectedWindow = null
      }
      previewEvidenceUnregisterRef.current?.()
      previewEvidenceUnregisterRef.current = null
      resolveAllPendingPreviewEvidenceRequests('Preview iframe disconnected before evidence settled.')
      sandboxPortRef.current?.close()
      sandboxPortRef.current = null
      sandboxConnectedRef.current = false
      if (resetReady) {
        setSandboxReady(false)
      }
    }

    const handleSandboxMessage = (data: unknown) => {
      if (!validateSandboxToMainMessage(data)) {
        console.warn('Invalid message from sandbox:', data)
        return
      }

      const message = data as SandboxToMainMessage

      switch (message.type) {
        case 'SANDBOX_CONNECTED':
          setSandboxReady(true)
          sendPendingCode()
          break
        case 'RENDER_SUCCESS':
          handlersRef.current.onRenderSuccess()
          if (
            previewPageIdRef.current &&
            previewPageIdRef.current !== lastReportedPageIdRef.current
          ) {
            postNavigateToPage(previewPageIdRef.current)
          }
          break
        case 'COMPILE_ERROR':
          handlersRef.current.onCompileError(message.payload)
          break
        case 'RUNTIME_ERROR':
          handlersRef.current.onRuntimeError(message.payload)
          break
        case 'PREVIEW_PAGE_CHANGED':
          lastReportedPageIdRef.current = message.payload.pageId
          handlersRef.current.onPreviewPageChange(message.payload.pageId)
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
        case 'PREVIEW_EVIDENCE_CAPTURED':
          resolvePendingPreviewEvidenceRequest(
            message.payload.requestId,
            message.payload.result
          )
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
          handlersRef.current.onConsoleMessage(message.payload)
          break
      }
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate source
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      if (sandboxRetiredRef.current) {
        console.warn('Ignored sandbox message after iframe navigation')
        return
      }

      // Check for SANDBOX_READY message (not in type-safe messages yet)
      if (event.data?.type === 'SANDBOX_READY') {
        if (sandboxConnectedRef.current || !iframeRef.current?.contentWindow) {
          return
        }

        const channel = new MessageChannel()
        sandboxPortRef.current = channel.port1
        sandboxPortRef.current.onmessage = (messageEvent) => handleSandboxMessage(messageEvent.data)
        sandboxPortRef.current.start()
        connectedWindow = iframeRef.current.contentWindow
        registerSandboxMessagePort(connectedWindow, sandboxPortRef.current)
        previewEvidenceUnregisterRef.current?.()
        previewEvidenceUnregisterRef.current = registerPreviewEvidenceRequestHandler(
          iframeRef.current,
          requestPreviewEvidence
        )

        const connectMessage: MainToSandboxMessage = { type: 'CONNECT_SANDBOX' }
        postMessageToSandbox(iframeRef.current.contentWindow, connectMessage, window.location, [
          channel.port2,
        ])

        sandboxConnectedRef.current = true
        return
      }

      if (!sandboxConnectedRef.current) {
        handleSandboxMessage(event.data)
      }
    }

    const handleLoad = () => {
      const hadActiveChannel = sandboxConnectedRef.current || sandboxPortRef.current
      if (hadActiveChannel) {
        sandboxRetiredRef.current = true
      }

      disconnectSandbox(true)
      setInspectionData(null)
      if (!sandboxRetiredRef.current && latestTranspiledCodeRef.current) {
        pendingCodeRef.current = latestTranspiledCodeRef.current
      }
    }

    const iframe = iframeRef.current
    iframe?.addEventListener('load', handleLoad)
    window.addEventListener('message', handleMessage)
    return () => {
      iframe?.removeEventListener('load', handleLoad)
      window.removeEventListener('message', handleMessage)
      disconnectSandbox(false)
    }
  }, [iframeRef, postNavigateToPage])

  // T083: Clear inspection popover when inspect mode disabled
  useEffect(() => {
    if (!isInspectMode) {
      setInspectionData(null)
    }

    if (!iframeRef.current?.contentWindow || !sandboxReady) {
      return
    }

    const message: MainToSandboxMessage = {
      type: 'TOGGLE_INSPECT',
      payload: { enabled: isInspectMode },
    }

    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [isInspectMode, sandboxReady, iframeRef])

  // Send preview navigation requests when host selection changes
  useEffect(() => {
    if (!previewPageId || !sandboxReady) {
      return
    }

    if (previewPageId === lastReportedPageIdRef.current) {
      return
    }

    postNavigateToPage(previewPageId)
  }, [postNavigateToPage, previewPageId, sandboxReady])

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
        src={SANDBOX_IFRAME_SRC}
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

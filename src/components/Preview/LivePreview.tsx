import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { BodyShort, Button, Detail, HStack, Popover, Textarea, VStack } from '@navikt/ds-react'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import type { ArcadePageId, ViewportSize } from '@/types/project'
import type { InspectionData } from '@/types/inspection'
import type { ArcadeAnnotation } from '@/types/annotations'
import type { SandboxConsolePayload } from '@/services/previewDiagnostics'
import type { CompileError, RuntimeError } from '@/types/preview'
import { createAnnotation, getOpenAnnotations } from '@/services/annotations'
import {
  registerPreviewEvidenceRequestHandler,
  type PreviewEvidenceCaptureResult,
} from '@/services/previewEvidence'
import type { ResolvedAnnotationTarget } from '@/services/annotationTargets'
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
const ANNOTATION_TARGET_TEXT_MAX_LENGTH = 24
const ANNOTATION_MARKER_SIZE_PX = 24
const ANNOTATION_MARKER_SAFE_INSET_PX = ANNOTATION_MARKER_SIZE_PX / 2

const AKSEL_TARGET_LABELS: Array<[className: string, label: string]> = [
  ['aksel-inline-message', 'InlineMessage'],
  ['aksel-button', 'Button'],
  ['aksel-checkbox', 'Checkbox'],
  ['aksel-text-field', 'TextField'],
  ['aksel-textarea', 'Textarea'],
  ['aksel-select', 'Select'],
  ['aksel-box', 'Box'],
  ['aksel-vstack', 'VStack'],
  ['aksel-hstack', 'HStack'],
  ['aksel-hgrid', 'HGrid'],
]

const getSandboxIframeSrc = (recoveryRevision: number) => {
  if (SANDBOX_IFRAME_SRC === 'about:blank' || recoveryRevision === 0) {
    return SANDBOX_IFRAME_SRC
  }

  const separator = SANDBOX_IFRAME_SRC.includes('?') ? '&' : '?'
  return `${SANDBOX_IFRAME_SRC}${separator}sandboxRecovery=${recoveryRevision}`
}

const getSandboxIframeHref = (src: string) => new URL(src, window.location.href).href

const getAnnotationTargetLabel = (target: ResolvedAnnotationTarget): string => {
  const targetName = getAnnotationTargetName(target)
  const targetText = getAnnotationTargetText(target)

  return targetText ? `${targetName}: ${targetText}` : targetName
}

const getAnnotationTargetName = (target: ResolvedAnnotationTarget): string => {
  const classes = target.identity.cssClasses?.split(/\s+/) ?? []
  const akselLabel = AKSEL_TARGET_LABELS.find(([className]) => classes.includes(className))?.[1]
  if (akselLabel) {
    return akselLabel
  }

  if (target.identity.role && target.identity.role !== target.identity.tagName) {
    return capitalizeTargetName(target.identity.role)
  }

  return target.identity.tagName
}

const getAnnotationTargetText = (target: ResolvedAnnotationTarget): string => {
  const text = stripAkselStatusPrefix(
    target.identity.accessibleName || target.identity.text || extractQuotedElementText(target.snapshot.element)
  )
  return truncateTargetText(text, ANNOTATION_TARGET_TEXT_MAX_LENGTH)
}

const stripAkselStatusPrefix = (text: string | undefined): string =>
  (text ?? '').replace(/^(informasjon|info|suksess|success|advarsel|warning|feil|error):\s*/i, '').trim()

const extractQuotedElementText = (elementLabel: string): string => {
  const match = elementLabel.match(/"([^"]+)"/)
  return match?.[1] ?? ''
}

const truncateTargetText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }

  const candidate = text.slice(0, maxLength)
  const lastSpace = candidate.lastIndexOf(' ')
  const truncated = (lastSpace > 0 ? candidate.slice(0, lastSpace) : candidate).trim()
  return `${truncated}...`
}

const capitalizeTargetName = (value: string): string =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

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
  isAnnotationMode: boolean
  annotations: ArcadeAnnotation[]
  onAnnotationsChange: (annotations: ArcadeAnnotation[]) => void
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
  isAnnotationMode,
  annotations,
  onAnnotationsChange,
  theme,
}: LivePreviewProps) => {
  const [sandboxReady, setSandboxReady] = useState(false)
  const [viewportBounds, setViewportBounds] = useState({ width: 0, height: 0 })
  const pendingCodeRef = useRef<string | null>(null)
  const latestTranspiledCodeRef = useRef(transpiledCode)
  const viewportStageRef = useRef<HTMLDivElement | null>(null)
  const sandboxPortRef = useRef<MessagePort | null>(null)
  const previewEvidenceRequestIdRef = useRef(0)
  const previewEvidenceRequestsRef = useRef(new Map<string, PendingPreviewEvidenceRequest>())
  const previewEvidenceUnregisterRef = useRef<(() => void) | null>(null)
  const sandboxConnectedRef = useRef(false)
  const sandboxRetiredRef = useRef(false)
  const sandboxRecoveryRevisionRef = useRef(0)
  const expectedSandboxLoadSrcRef = useRef<string | null>(null)
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
  const [hoveredAnnotationTarget, setHoveredAnnotationTarget] =
    useState<ResolvedAnnotationTarget | null>(null)
  const [selectedAnnotationTarget, setSelectedAnnotationTarget] =
    useState<ResolvedAnnotationTarget | null>(null)
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [addAnnotationAnchorEl, setAddAnnotationAnchorEl] = useState<HTMLElement | null>(null)
  const annotationTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const selectedViewportWidth = getViewportWidth(viewportWidth)
  const effectiveViewportWidth =
    viewportBounds.width > 0 ? Math.min(selectedViewportWidth, viewportBounds.width) : selectedViewportWidth
  const viewportIntrinsicHeight = viewportBounds.height > 0 ? viewportBounds.height : 1

  useEffect(() => {
    const stage = viewportStageRef.current
    if (!stage) {
      return
    }

    const measureStage = () => {
      const rect = stage.getBoundingClientRect()
      setViewportBounds((prev) => {
        const nextWidth = Math.max(0, Math.floor(rect.width))
        const nextHeight = Math.max(0, Math.floor(rect.height))
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev
        }

        return {
          width: nextWidth,
          height: nextHeight,
        }
      })
    }

    measureStage()

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measureStage())
    resizeObserver?.observe(stage)
    window.addEventListener('resize', measureStage)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureStage)
    }
  }, [])

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
        case 'ANNOTATION_TARGET_HOVERED':
          setHoveredAnnotationTarget(
            message.payload?.status === 'resolved' && message.payload.target
              ? message.payload.target
              : null
          )
          break
        case 'ANNOTATION_TARGET_SELECTED':
          if (message.payload.status === 'resolved' && message.payload.target) {
            setSelectedAnnotationTarget(message.payload.target)
            setAnnotationDraft('')
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

      // Check for SANDBOX_READY message (not in type-safe messages yet)
      if (event.data?.type === 'SANDBOX_READY') {
        const expectedSandboxLoadSrc = expectedSandboxLoadSrcRef.current
        if (expectedSandboxLoadSrc) {
          const readyHref =
            typeof event.data?.payload?.href === 'string' ? event.data.payload.href : null
          if (readyHref !== getSandboxIframeHref(expectedSandboxLoadSrc)) {
            return
          }
        }

        if (sandboxConnectedRef.current || !iframeRef.current?.contentWindow) {
          return
        }

        sandboxRetiredRef.current = false
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

      if (sandboxRetiredRef.current) {
        console.warn('Ignored sandbox message after iframe navigation')
        return
      }

      if (!sandboxConnectedRef.current) {
        handleSandboxMessage(event.data)
      }
    }

    const handleLoad = () => {
      const iframe = iframeRef.current
      if (iframe && expectedSandboxLoadSrcRef.current === iframe.getAttribute('src')) {
        expectedSandboxLoadSrcRef.current = null
        sandboxRetiredRef.current = false
        return
      }

      const hadActiveChannel = sandboxConnectedRef.current || sandboxPortRef.current
      if (hadActiveChannel) {
        sandboxRetiredRef.current = true
        lastReportedPageIdRef.current = null
      }

      disconnectSandbox(true)
      setInspectionData(null)
      if (latestTranspiledCodeRef.current) {
        pendingCodeRef.current = latestTranspiledCodeRef.current
      }

      if (hadActiveChannel && iframeRef.current) {
        sandboxRecoveryRevisionRef.current += 1
        const recoverySrc = getSandboxIframeSrc(sandboxRecoveryRevisionRef.current)
        expectedSandboxLoadSrcRef.current = recoverySrc
        iframeRef.current.src = recoverySrc
        return
      }

      sandboxRetiredRef.current = false
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

  useEffect(() => {
    if (!isAnnotationMode) {
      setHoveredAnnotationTarget(null)
      setSelectedAnnotationTarget(null)
      setAnnotationDraft('')
    }

    if (!iframeRef.current?.contentWindow || !sandboxReady) {
      return
    }

    const message: MainToSandboxMessage = {
      type: 'TOGGLE_ANNOTATION_MODE',
      payload: { enabled: isAnnotationMode },
    }

    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [isAnnotationMode, sandboxReady, iframeRef])

  useEffect(() => {
    if (selectedAnnotationTarget || !iframeRef.current?.contentWindow || !sandboxReady) {
      return
    }

    const message: MainToSandboxMessage = { type: 'CLEAR_ANNOTATION_SELECTION' }
    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [selectedAnnotationTarget, sandboxReady, iframeRef])

  useEffect(() => {
    if (selectedAnnotationTarget) {
      window.setTimeout(() => annotationTextareaRef.current?.focus(), 0)
    }
  }, [selectedAnnotationTarget])

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

    const message: MainToSandboxMessage = {
      type: 'UPDATE_VIEWPORT',
      payload: { width: effectiveViewportWidth },
    }

    postMessageToSandbox(iframeRef.current.contentWindow, message)
  }, [effectiveViewportWidth, sandboxReady, iframeRef])

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

  const activePageOpenAnnotations = useMemo(
    () =>
      previewPageId
        ? getOpenAnnotations(annotations, {
            pageId: previewPageId,
          })
        : [],
    [annotations, previewPageId]
  )

  const saveSelectedAnnotation = useCallback(() => {
    if (!previewPageId || !selectedAnnotationTarget || annotationDraft.trim().length === 0) {
      return
    }

    const nextAnnotation = createAnnotation({
      pageId: previewPageId,
      comment: annotationDraft.trim(),
      target: selectedAnnotationTarget.snapshot,
    })
    onAnnotationsChange([...annotations, nextAnnotation])
    setSelectedAnnotationTarget(null)
    setAnnotationDraft('')
  }, [annotationDraft, annotations, onAnnotationsChange, previewPageId, selectedAnnotationTarget])

  const cancelSelectedAnnotation = useCallback(() => {
    setSelectedAnnotationTarget(null)
    setAnnotationDraft('')
  }, [])

  const handleAnnotationTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      saveSelectedAnnotation()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelSelectedAnnotation()
    }
  }

  const getOverlayPosition = (target: ResolvedAnnotationTarget | ArcadeAnnotation) => {
    const isResolvedTarget = 'snapshot' in target
    const box = isResolvedTarget ? target.snapshot.boundingBox : target.boundingBox
    const clickX = isResolvedTarget ? target.snapshot.x : target.x
    const clickY = isResolvedTarget ? target.snapshot.y : target.y
    const viewportWidthPx = Math.max(1, effectiveViewportWidth)
    const viewportHeightPx = Math.max(1, viewportIntrinsicHeight)
    const rawLeft =
      typeof clickX === 'number' && Number.isFinite(clickX)
        ? (clickX / 100) * viewportWidthPx
        : box && Number.isFinite(box.x)
          ? box.x + box.width
          : 0
    const rawTop =
      typeof clickY === 'number' && Number.isFinite(clickY)
        ? clickY
        : box && Number.isFinite(box.y)
          ? Math.max(0, box.y)
          : 0
    const left = clampNumber(
      rawLeft,
      ANNOTATION_MARKER_SAFE_INSET_PX,
      Math.max(ANNOTATION_MARKER_SAFE_INSET_PX, viewportWidthPx - ANNOTATION_MARKER_SAFE_INSET_PX)
    )
    const top = clampNumber(
      rawTop,
      ANNOTATION_MARKER_SAFE_INSET_PX,
      Math.max(ANNOTATION_MARKER_SAFE_INSET_PX, viewportHeightPx - ANNOTATION_MARKER_SAFE_INSET_PX)
    )

    return {
      left: `${left}px`,
      top: `${top}px`,
    }
  }

  const selectedAnchorPosition = selectedAnnotationTarget
    ? getOverlayPosition(selectedAnnotationTarget)
    : hoveredAnnotationTarget
      ? getOverlayPosition(hoveredAnnotationTarget)
      : { left: '-9999px', top: '-9999px' }

  return (
    <div className="live-preview" data-testid="live-preview">
      <div
        ref={viewportStageRef}
        className="live-preview__stage"
        data-testid="preview-viewport-stage"
      >
        <div
          className="live-preview__viewport-shell"
          data-testid="preview-viewport-shell"
          style={{
            width: `${effectiveViewportWidth}px`,
            height: `${viewportIntrinsicHeight}px`,
          }}
        >
          <iframe
            ref={iframeRef}
            className="live-preview__iframe"
            style={{
              width: `${effectiveViewportWidth}px`,
              height: `${viewportIntrinsicHeight}px`,
            }}
            src={getSandboxIframeSrc(0)}
            allow="clipboard-write"
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            title="Live Preview Sandbox"
            data-testid="preview-iframe"
          />
          {isAnnotationMode && (
            <div className="live-preview__annotation-layer" data-testid="annotation-overlay-layer">
              {activePageOpenAnnotations.map((annotation, index) => (
                <Button
                  key={annotation.id}
                  type="button"
                  size="xsmall"
                  variant="primary"
                  className="live-preview__annotation-marker"
                  style={getOverlayPosition(annotation)}
                  aria-label={`Annotation ${index + 1}: ${annotation.comment}`}
                >
                  {index + 1}
                </Button>
              ))}
              <span
                ref={setAddAnnotationAnchorEl}
                className="live-preview__annotation-add-anchor"
                style={selectedAnchorPosition}
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </div>

      <Popover
        open={isAnnotationMode && Boolean(selectedAnnotationTarget)}
        anchorEl={addAnnotationAnchorEl}
        onClose={cancelSelectedAnnotation}
        placement="right-start"
        className="live-preview__annotation-popover"
      >
        <Popover.Content className="live-preview__annotation-popover-content">
          <VStack gap="space-12">
            <VStack gap="space-4">
              <BodyShort weight="semibold">Add annotation</BodyShort>
              {selectedAnnotationTarget && (
                <Detail className="live-preview__annotation-target-metadata">
                  {getAnnotationTargetLabel(selectedAnnotationTarget)}
                </Detail>
              )}
            </VStack>
            <Textarea
              ref={annotationTextareaRef}
              label="Annotation text"
              hideLabel
              size="small"
              minRows={3}
              resize={false}
              value={annotationDraft}
              onChange={(event) => setAnnotationDraft(event.target.value)}
              onKeyDown={handleAnnotationTextareaKeyDown}
            />
            <HStack gap="space-8" justify="end">
              <Button type="button" variant="secondary" size="small" onClick={cancelSelectedAnnotation}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="small"
                disabled={annotationDraft.trim().length === 0}
                onClick={saveSelectedAnnotation}
              >
                Save
              </Button>
            </HStack>
          </VStack>
        </Popover.Content>
      </Popover>
       
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

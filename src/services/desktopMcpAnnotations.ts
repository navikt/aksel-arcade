import type { ArcadeAnnotation } from '@/types/annotations'
import type { ArcadePageId, ThemeMode } from '@/types/project'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import { buildAnnotationTargetResolutionRequest } from './annotationTargetRequests'

const SANDBOX_IFRAME_SRC =
  import.meta.env.MODE === 'test' ? 'about:blank' : `${import.meta.env.BASE_URL}sandbox.html`
const RESOLUTION_REQUEST_PREFIX = 'desktop-mcp-annotation-resolution'
const RESOLUTION_SETTLE_DELAY_MS = 32
const RESOLUTION_TIMEOUT_MS = 20_000

export type DesktopMcpAnnotationVisibility = 'visible' | 'hidden' | 'dead'

interface ResolveDesktopMcpAnnotationVisibilitiesOptions {
  annotations: readonly ArcadeAnnotation[]
  transpiledCode: string | null
  pageId: ArcadePageId
  startPageId: ArcadePageId
  theme: ThemeMode
  viewportWidth: number
  viewportHeight: number
  timeoutMs?: number
}

export const resolveDesktopMcpAnnotationVisibilitiesInSandbox = async ({
  annotations,
  transpiledCode,
  pageId,
  startPageId,
  theme,
  viewportWidth,
  viewportHeight,
  timeoutMs = RESOLUTION_TIMEOUT_MS,
}: ResolveDesktopMcpAnnotationVisibilitiesOptions): Promise<Map<string, DesktopMcpAnnotationVisibility>> => {
  const fallback = createFallbackVisibilityMap(annotations)
  if (annotations.length === 0 || !transpiledCode) {
    return fallback
  }

  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.body) {
    return fallback
  }

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.src = SANDBOX_IFRAME_SRC
    iframe.name = 'desktop-mcp-annotation-resolution'
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('referrerpolicy', 'no-referrer')
    iframe.style.position = 'fixed'
    iframe.style.left = '-200vw'
    iframe.style.top = '0'
    iframe.style.width = `${Math.max(1, viewportWidth)}px`
    iframe.style.height = `${Math.max(1, viewportHeight)}px`
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.background = 'transparent'

    let port: MessagePort | null = null
    let didFinish = false
    let didDispatchRequests = false
    let navigationRequested = false
    let dispatchTimeoutId: number | null = null
    let requestCounter = 0
    const pendingByRequestId = new Map<string, string>()
    const timeoutId = window.setTimeout(() => finish(), timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      if (dispatchTimeoutId !== null) {
        window.clearTimeout(dispatchTimeoutId)
      }
      window.removeEventListener('message', handleWindowMessage)
      if (port) {
        port.onmessage = null
        port.close()
      }
      iframe.remove()
    }

    const finish = () => {
      if (didFinish) {
        return
      }

      didFinish = true
      cleanup()
      resolve(fallback)
    }

    const scheduleDispatchRequests = () => {
      if (didDispatchRequests || dispatchTimeoutId !== null) {
        return
      }

      dispatchTimeoutId = window.setTimeout(() => {
        dispatchTimeoutId = null
        dispatchRequests()
      }, RESOLUTION_SETTLE_DELAY_MS)
    }

    const dispatchRequests = () => {
      if (didDispatchRequests || !port) {
        return
      }

      didDispatchRequests = true
      pendingByRequestId.clear()

      for (const annotation of annotations) {
        const request = buildAnnotationTargetResolutionRequest(annotation)
        if (!request) {
          fallback.set(annotation.id, 'dead')
          continue
        }

        const requestId = `${RESOLUTION_REQUEST_PREFIX}-${++requestCounter}`
        pendingByRequestId.set(requestId, annotation.id)
        const message: MainToSandboxMessage = {
          type: 'RESOLVE_ANNOTATION_TARGET',
          payload: {
            requestId,
            request,
          },
        }
        port.postMessage(message)
      }

      if (pendingByRequestId.size === 0) {
        finish()
      }
    }

    const handleSandboxMessage = (message: SandboxToMainMessage) => {
      switch (message.type) {
        case 'SANDBOX_CONNECTED': {
          if (!port) {
            break
          }

          port.postMessage({
            type: 'UPDATE_VIEWPORT',
            payload: { width: viewportWidth },
          } satisfies MainToSandboxMessage)
          port.postMessage({
            type: 'UPDATE_THEME',
            payload: { theme },
          } satisfies MainToSandboxMessage)
          port.postMessage({
            type: 'EXECUTE_CODE',
            payload: { jsxCode: transpiledCode, hooksCode: '' },
          } satisfies MainToSandboxMessage)
          break
        }
        case 'RENDER_SUCCESS':
          if (pageId !== startPageId && !navigationRequested) {
            navigationRequested = true
            port?.postMessage({
              type: 'NAVIGATE_TO_PAGE',
              payload: { pageId },
            } satisfies MainToSandboxMessage)
            break
          }

          scheduleDispatchRequests()
          break
        case 'PREVIEW_PAGE_CHANGED':
          if (message.payload.pageId === pageId) {
            scheduleDispatchRequests()
          }
          break
        case 'ANNOTATION_TARGET_RESOLVED': {
          const annotationId = pendingByRequestId.get(message.payload.requestId)
          if (!annotationId) {
            break
          }

          pendingByRequestId.delete(message.payload.requestId)
          fallback.set(annotationId, normalizeResolutionVisibility(message.payload.result.status))
          if (didDispatchRequests && pendingByRequestId.size === 0) {
            finish()
          }
          break
        }
        case 'COMPILE_ERROR':
        case 'RUNTIME_ERROR':
          finish()
          break
        default:
          break
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.data?.type !== 'SANDBOX_READY') {
        return
      }

      const channel = new MessageChannel()
      port = channel.port1
      port.onmessage = (messageEvent) =>
        handleSandboxMessage(messageEvent.data as SandboxToMainMessage)
      port.start()
      iframe.contentWindow?.postMessage({ type: 'CONNECT_SANDBOX' }, '*', [channel.port2])
    }

    window.addEventListener('message', handleWindowMessage)
    document.body.appendChild(iframe)
  })
}

const createFallbackVisibilityMap = (
  annotations: readonly ArcadeAnnotation[]
): Map<string, DesktopMcpAnnotationVisibility> => {
  const visibility = new Map<string, DesktopMcpAnnotationVisibility>()
  for (const annotation of annotations) {
    visibility.set(annotation.id, buildAnnotationTargetResolutionRequest(annotation) ? 'visible' : 'dead')
  }
  return visibility
}

const normalizeResolutionVisibility = (
  status: 'resolved' | 'hidden' | 'dead' | 'no-target'
): DesktopMcpAnnotationVisibility => {
  switch (status) {
    case 'resolved':
      return 'visible'
    case 'hidden':
      return 'hidden'
    default:
      return 'dead'
  }
}

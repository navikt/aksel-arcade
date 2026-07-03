import type { AnnotationAuthorRole, ArcadeAnnotation } from '@/types/annotations'
import type { ArcadePageId, ThemeMode } from '@/types/project'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import type { Project } from '@/types/project'
import {
  validateSandboxReadyMessage,
  validateSandboxToMainMessage,
} from '@/utils/security'
import { buildAnnotationTargetResolutionRequest } from './annotationTargetRequests'
import {
  appendAnnotationThreadMessage,
  setAnnotationStatus,
} from './annotations'
import type {
  DesktopMcpAnnotationMutationRequest,
  DesktopMcpAnnotationMutationResult,
} from './desktopMcpAnnotationProtocol'

const SANDBOX_IFRAME_SRC =
  import.meta.env.MODE === 'test' ? 'about:blank' : `${import.meta.env.BASE_URL}sandbox.html`
const RESOLUTION_REQUEST_PREFIX = 'desktop-mcp-annotation-resolution'
const RESOLUTION_SETTLE_DELAY_MS = 32
const RESOLUTION_TIMEOUT_MS = 20_000
const getSandboxIframeHref = (src: string) => new URL(src, window.location.href).href

export type DesktopMcpAnnotationVisibility = 'visible' | 'hidden' | 'dead'

export type DesktopMcpAnnotationMutationHandler = (
  request: DesktopMcpAnnotationMutationRequest
) => DesktopMcpAnnotationMutationResult | Promise<DesktopMcpAnnotationMutationResult>

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
      if (
        event.source !== iframe.contentWindow ||
        !validateSandboxReadyMessage(event.data) ||
        event.data.payload.href !== getSandboxIframeHref(SANDBOX_IFRAME_SRC)
      ) {
        return
      }

      const channel = new MessageChannel()
      port = channel.port1
      port.onmessage = (messageEvent) => {
        if (validateSandboxToMainMessage(messageEvent.data)) {
          handleSandboxMessage(messageEvent.data as SandboxToMainMessage)
        }
      }
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

interface DesktopMcpAnnotationMutationOptions {
  isDeadTarget?: (annotation: ArcadeAnnotation) => boolean
  now?: number
  nowIso?: string
}

export const mutateDesktopMcpAnnotation = (
  project: Project,
  request: DesktopMcpAnnotationMutationRequest,
  options: DesktopMcpAnnotationMutationOptions = {}
): DesktopMcpAnnotationMutationResult => {
  const annotation = project.annotations.find((item) => item.id === request.annotationId)
  if (!annotation) {
    return {
      ok: false,
      code: 'annotation-not-found',
      annotationId: request.annotationId,
      message: `Desktop MCP annotation "${request.annotationId}" was not found.`,
    }
  }

  if (options.isDeadTarget?.(annotation)) {
    return {
      ok: false,
      code: 'dead-target-annotation',
      annotationId: request.annotationId,
      message: `Desktop MCP annotation "${request.annotationId}" cannot be changed because its target is dead.`,
    }
  }

  const now = options.now ?? Date.now()
  const nowIso = options.nowIso ?? new Date(now).toISOString()
  const resolvedBy: AnnotationAuthorRole = 'agent'

  switch (request.toolName) {
    case 'acknowledge_annotation': {
      const annotations = setAnnotationStatus(project.annotations, annotation.id, 'acknowledged', {
        acknowledgedBy: resolvedBy,
        nowIso,
      })
      return {
        ok: true,
        toolName: request.toolName,
        annotationId: annotation.id,
        pageId: annotation.pageId,
        message: `Acknowledged annotation ${annotation.id}.`,
        annotation: findAnnotation(annotations, annotation.id) ?? annotation,
        annotations,
      }
    }
    case 'reply_to_annotation': {
      const message = request.message.trim()
      if (!message) {
        return {
          ok: false,
          code: 'invalid-annotation-payload',
          annotationId: annotation.id,
          message: 'reply_to_annotation message must be a non-empty string.',
        }
      }

      const annotations = appendAnnotationThreadMessage(
        project.annotations,
        annotation.id,
        {
          id: undefined,
          role: resolvedBy,
          content: message,
          timestamp: now,
        },
        { nowIso }
      )
      return {
        ok: true,
        toolName: request.toolName,
        annotationId: annotation.id,
        pageId: annotation.pageId,
        message: `Replied to annotation ${annotation.id}.`,
        annotation: findAnnotation(annotations, annotation.id) ?? annotation,
        annotations,
      }
    }
    case 'resolve_annotation': {
      const annotationsWithReply =
        request.summary && request.summary.trim().length > 0
          ? appendAnnotationThreadMessage(
              project.annotations,
              annotation.id,
              {
                id: undefined,
                role: resolvedBy,
                content: request.summary.trim(),
                timestamp: now,
              },
              { nowIso }
            )
          : project.annotations.map((item) => ({ ...item }))

      const annotations = setAnnotationStatus(annotationsWithReply, annotation.id, 'resolved', {
        nowIso,
        resolvedBy,
      })
      return {
        ok: true,
        toolName: request.toolName,
        annotationId: annotation.id,
        pageId: annotation.pageId,
        message: `Resolved annotation ${annotation.id}.`,
        annotation: findAnnotation(annotations, annotation.id) ?? annotation,
        annotations,
      }
    }
    case 'dismiss_annotation': {
      const reason = request.reason.trim()
      if (!reason) {
        return {
          ok: false,
          code: 'invalid-annotation-payload',
          annotationId: annotation.id,
          message: 'dismiss_annotation reason must be a non-empty string.',
        }
      }

      const annotationsWithReason = appendAnnotationThreadMessage(
        project.annotations,
        annotation.id,
        {
          id: undefined,
          role: resolvedBy,
          content: reason,
          timestamp: now,
        },
        { nowIso }
      )
      const annotations = setAnnotationStatus(annotationsWithReason, annotation.id, 'dismissed', {
        nowIso,
        resolvedBy,
      })
      return {
        ok: true,
        toolName: request.toolName,
        annotationId: annotation.id,
        pageId: annotation.pageId,
        message: `Dismissed annotation ${annotation.id}.`,
        annotation: findAnnotation(annotations, annotation.id) ?? annotation,
        annotations,
      }
    }
  }
}

const findAnnotation = (annotations: readonly ArcadeAnnotation[], annotationId: string) =>
  annotations.find((annotation) => annotation.id === annotationId)

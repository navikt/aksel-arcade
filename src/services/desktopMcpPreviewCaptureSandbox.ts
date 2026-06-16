import type { ArcadePageId, ThemeMode } from '@/types/project'
import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import {
  DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
  type DesktopMcpSandboxCaptureResult,
} from './desktopMcpPreviewCapture'
import type {
  DesktopMcpPreviewCaptureLayer,
  DesktopMcpPreviewCaptureFailure,
} from './desktopMcpPreviewCaptureProtocol'
import type {
  PreviewEvidenceCaptureTarget,
  PreviewEvidenceCaptureErrorCode,
  PreviewEvidenceCaptureResult,
  PreviewEvidenceScreenshotScope,
} from './previewEvidence'

const SANDBOX_IFRAME_SRC =
  import.meta.env.MODE === 'test' ? 'about:blank' : `${import.meta.env.BASE_URL}sandbox.html`

interface CapturePreviewInSandboxOptions {
  transpiledCode: string
  pageId: ArcadePageId
  startPageId: ArcadePageId
  viewportWidth: number
  viewportHeight: number
  theme: ThemeMode
  layers: DesktopMcpPreviewCaptureLayer[]
  screenshotScope: PreviewEvidenceScreenshotScope
  target?: PreviewEvidenceCaptureTarget
  timeoutMs?: number
}

const PREVIEW_CAPTURE_REQUEST_ID = 'desktop-mcp-preview-capture'

export const capturePreviewInIsolatedSandbox = async ({
  transpiledCode,
  pageId,
  startPageId,
  viewportWidth,
  viewportHeight,
  theme,
  layers,
  screenshotScope,
  target,
  timeoutMs = DESKTOP_MCP_PREVIEW_CAPTURE_TIMEOUT_MS,
}: CapturePreviewInSandboxOptions): Promise<DesktopMcpSandboxCaptureResult> => {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.body) {
    return createSandboxCaptureFailure(
      'project-unavailable',
      'capture_preview_evidence is unavailable because the Desktop Arcade renderer DOM is not ready.'
    )
  }
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.src = SANDBOX_IFRAME_SRC
    iframe.name = 'desktop-mcp-preview-capture'
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
    const timeoutId = window.setTimeout(() => {
      finish(
        createSandboxCaptureFailure(
          'render-timeout',
          'capture_preview_evidence timed out before the isolated Preview render settled.'
        )
      )
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('message', handleWindowMessage)
      if (port) {
        port.onmessage = null
        port.close()
      }
      iframe.remove()
    }

    const finish = (result: DesktopMcpSandboxCaptureResult) => {
      if (didFinish) {
        return
      }

      didFinish = true
      cleanup()
      resolve(result)
    }

    const requestCapture = () => {
      if (!port) {
        finish(
          createSandboxCaptureFailure(
            'project-unavailable',
            'capture_preview_evidence could not connect to the isolated Preview sandbox.'
          )
        )
        return
      }

      const message: MainToSandboxMessage = {
        type: 'CAPTURE_PREVIEW_EVIDENCE',
        payload: {
          requestId: PREVIEW_CAPTURE_REQUEST_ID,
          layers,
          screenshotScope,
          viewportWidth,
          viewportHeight,
          ...(target ? { target } : {}),
          expectedPageId: pageId,
        },
      }
      port.postMessage(message)
    }

    const handleCaptureResult = (result: PreviewEvidenceCaptureResult) => {
      if (!result.ok) {
        finish(mapPreviewEvidenceFailure(result.error.code, result.error.message))
        return
      }

      finish({
        ok: true,
        frame: result.evidence.frame,
        ...(result.screenshot ? { screenshot: result.screenshot } : {}),
        ...(result.captureMeta?.targetDescription
          ? { targetDescription: result.captureMeta.targetDescription }
          : {}),
      })
    }

    const handleSandboxMessage = (message: SandboxToMainMessage) => {
      switch (message.type) {
        case 'SANDBOX_CONNECTED': {
          if (!port) {
            break
          }

          const viewportMessage: MainToSandboxMessage = {
            type: 'UPDATE_VIEWPORT',
            payload: { width: viewportWidth },
          }
          const themeMessage: MainToSandboxMessage = {
            type: 'UPDATE_THEME',
            payload: { theme },
          }
          const executeMessage: MainToSandboxMessage = {
            type: 'EXECUTE_CODE',
            payload: { jsxCode: transpiledCode, hooksCode: '' },
          }

          port.postMessage(viewportMessage)
          port.postMessage(themeMessage)
          port.postMessage(executeMessage)
          break
        }
        case 'RENDER_SUCCESS': {
          if (pageId !== startPageId && port) {
            const navigateMessage: MainToSandboxMessage = {
              type: 'NAVIGATE_TO_PAGE',
              payload: { pageId },
            }
            port.postMessage(navigateMessage)
          }

          requestCapture()
          break
        }
        case 'COMPILE_ERROR':
          finish(
            createSandboxCaptureFailure(
              'render-failed',
              `capture_preview_evidence could not render the isolated Preview: ${message.payload.message}`
            )
          )
          break
        case 'RUNTIME_ERROR':
          finish(
            createSandboxCaptureFailure(
              'render-failed',
              `capture_preview_evidence hit a runtime error in the isolated Preview: ${message.payload.message}`
            )
          )
          break
        case 'PREVIEW_EVIDENCE_CAPTURED':
          if (message.payload.requestId === PREVIEW_CAPTURE_REQUEST_ID) {
            handleCaptureResult(message.payload.result)
          }
          break
        default:
          break
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) {
        return
      }

      if (event.data?.type !== 'SANDBOX_READY') {
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

const mapPreviewEvidenceFailure = (
  code: PreviewEvidenceCaptureErrorCode,
  message: string
): DesktopMcpPreviewCaptureFailure => {
  switch (code) {
    case 'invalid-capture-target':
      return createSandboxCaptureFailure('invalid-capture-target', message)
    case 'render-timeout':
      return createSandboxCaptureFailure('render-timeout', message)
    default:
      return createSandboxCaptureFailure('render-failed', message)
  }
}

const createSandboxCaptureFailure = (
  code: DesktopMcpPreviewCaptureFailure['code'],
  message: string
): DesktopMcpPreviewCaptureFailure => ({
  ok: false,
  code,
  message,
})

import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type { DesktopMcpPreviewCaptureHandler } from './desktopMcpPreviewCaptureProtocol'

export const registerDesktopPreloadMcpPreviewCaptureHandler = (
  handler: DesktopMcpPreviewCaptureHandler,
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): (() => void) | undefined => {
  if (!api?.setDesktopMcpPreviewCaptureHandler) {
    return undefined
  }

  api.setDesktopMcpPreviewCaptureHandler(handler)
  return () => api.setDesktopMcpPreviewCaptureHandler?.(null)
}

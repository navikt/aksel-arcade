import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type { DesktopMcpAnnotationMutationHandler } from './desktopMcpAnnotationProtocol'

export const registerDesktopPreloadMcpAnnotationHandler = (
  handler: DesktopMcpAnnotationMutationHandler,
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): (() => void) | undefined => {
  if (!api?.setDesktopMcpAnnotationHandler) {
    return undefined
  }

  api.setDesktopMcpAnnotationHandler(handler)
  return () => api.setDesktopMcpAnnotationHandler?.(null)
}

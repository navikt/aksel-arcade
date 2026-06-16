import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type { DesktopMcpProjectResourceReadHandler } from './desktopMcpProjectResourceProtocol'

export const registerDesktopPreloadMcpProjectResourceReadHandler = (
  handler: DesktopMcpProjectResourceReadHandler,
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): (() => void) | undefined => {
  if (!api?.setDesktopMcpProjectResourceReadHandler) {
    return undefined
  }

  api.setDesktopMcpProjectResourceReadHandler(handler)
  return () => api.setDesktopMcpProjectResourceReadHandler?.(null)
}

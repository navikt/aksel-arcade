import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type { DesktopMcpApplyChangesHandler } from './desktopMcpApplyChangesProtocol'

export const registerDesktopPreloadMcpApplyChangesHandler = (
  handler: DesktopMcpApplyChangesHandler,
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): (() => void) | undefined => {
  if (!api?.setDesktopMcpApplyChangesHandler) {
    return undefined
  }

  api.setDesktopMcpApplyChangesHandler(handler)
  return () => api.setDesktopMcpApplyChangesHandler?.(null)
}

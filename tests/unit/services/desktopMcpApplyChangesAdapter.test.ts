import { describe, expect, it, vi } from 'vitest'
import { registerDesktopPreloadMcpApplyChangesHandler } from '@/services/desktopMcpApplyChangesAdapter'
import type { DesktopArcadePreloadApi } from '@/services/shellCapabilities'

describe('desktopMcpApplyChangesAdapter', () => {
  it('registers and clears the renderer apply_changes handler through preload', () => {
    const handler = vi.fn()
    const api: DesktopArcadePreloadApi = {
      getShellCapabilities: vi.fn(),
      setDesktopMcpApplyChangesHandler: vi.fn(),
    }

    const unregister = registerDesktopPreloadMcpApplyChangesHandler(handler, api)

    expect(api.setDesktopMcpApplyChangesHandler).toHaveBeenCalledWith(handler)
    unregister?.()
    expect(api.setDesktopMcpApplyChangesHandler).toHaveBeenLastCalledWith(null)
  })
})

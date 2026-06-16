import { describe, expect, it, vi } from 'vitest'
import { registerDesktopPreloadMcpProjectResourceReadHandler } from '@/services/desktopMcpProjectResourceAdapter'
import type { DesktopArcadePreloadApi } from '@/services/shellCapabilities'

describe('desktopMcpProjectResourceAdapter', () => {
  it('registers and clears the renderer project resource read handler through preload', () => {
    const handler = vi.fn()
    const api: DesktopArcadePreloadApi = {
      getShellCapabilities: vi.fn(),
      setDesktopMcpProjectResourceReadHandler: vi.fn(),
    }

    const unregister = registerDesktopPreloadMcpProjectResourceReadHandler(handler, api)

    expect(api.setDesktopMcpProjectResourceReadHandler).toHaveBeenCalledWith(handler)
    unregister?.()
    expect(api.setDesktopMcpProjectResourceReadHandler).toHaveBeenLastCalledWith(null)
  })
})

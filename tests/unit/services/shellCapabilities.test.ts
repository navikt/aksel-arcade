import { describe, expect, it, vi } from 'vitest'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  resolveInitialShellCapabilities,
  resolvePreloadedShellCapabilities,
  resolveShellCapabilities,
  resolveShellSurface,
} from '@/services/shellCapabilities'

describe('shellCapabilities', () => {
  it('defines Web Arcade capabilities with Share URL enabled and Agent sessions disabled', () => {
    expect(WEB_ARCADE_CAPABILITIES).toMatchObject({
      surface: 'web',
      shareUrl: { enabled: true },
      agentSessions: { enabled: false },
      projectPackages: {
        enabled: true,
        defaultExtension: '.akselarcade',
        legacyJsonImport: true,
      },
    })
  })

  it('defines Desktop Arcade capabilities with Agent sessions enabled and Share URL disabled', () => {
    expect(DESKTOP_ARCADE_CAPABILITIES).toMatchObject({
      surface: 'desktop',
      shareUrl: { enabled: false },
      agentSessions: { enabled: true },
      projectPackages: {
        enabled: true,
        defaultExtension: '.akselarcade',
        legacyJsonImport: true,
      },
    })
  })

  it('resolves configured surfaces to a reusable capability set', () => {
    expect(resolveShellCapabilities()).toBe(WEB_ARCADE_CAPABILITIES)
    expect(resolveShellCapabilities('web')).toBe(WEB_ARCADE_CAPABILITIES)
    expect(resolveShellCapabilities('desktop')).toBe(DESKTOP_ARCADE_CAPABILITIES)
    expect(resolveShellSurface('')).toBe('web')
  })

  it('rejects unsupported shell surfaces instead of guessing a capability set', () => {
    expect(() => resolveShellCapabilities('electron')).toThrow(/Unsupported Aksel Arcade shell/)
  })

  it('resolves Desktop Arcade capabilities from the narrow preload IPC bridge', async () => {
    const getShellCapabilities = vi.fn().mockResolvedValue(DESKTOP_ARCADE_CAPABILITIES)

    await expect(resolvePreloadedShellCapabilities({ getShellCapabilities })).resolves.toBe(
      DESKTOP_ARCADE_CAPABILITIES
    )
    expect(getShellCapabilities).toHaveBeenCalledTimes(1)
  })

  it('falls back to configured capabilities when no desktop preload bridge is present', async () => {
    await expect(resolvePreloadedShellCapabilities(undefined)).resolves.toBeNull()
    await expect(resolveInitialShellCapabilities(undefined)).resolves.toBe(WEB_ARCADE_CAPABILITIES)
  })

  it('rejects malformed preload capabilities instead of accepting arbitrary desktop state', async () => {
    const getShellCapabilities = vi.fn().mockResolvedValue({
      ...DESKTOP_ARCADE_CAPABILITIES,
      shareUrl: { enabled: true },
    })

    await expect(resolvePreloadedShellCapabilities({ getShellCapabilities })).rejects.toThrow(
      /Invalid Desktop Arcade preload capabilities/
    )
  })
})

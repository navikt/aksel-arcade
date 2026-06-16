import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
  resolveInitialShellCapabilities,
  resolvePreloadedShellCapabilities,
  resolveShellCapabilities,
  resolveShellSurface,
} from '@/services/shellCapabilities'

describe('shellCapabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AKSEL_ARCADE_DESKTOP__
  })

  it('defines Web Arcade capabilities with Share URL enabled and Agent sessions disabled', () => {
    expect(WEB_ARCADE_CAPABILITIES).toMatchObject({
      surface: 'web',
      shareUrl: { enabled: true },
      agentSessions: { enabled: false },
      projectPackages: {
        enabled: true,
        defaultExtension: '.akselarcade',
        legacyJsonImport: false,
      },
    })
  })

  it('defines Desktop Arcade capabilities with the legacy Agent-session UI disabled and Share URL disabled', () => {
    expect(DESKTOP_ARCADE_CAPABILITIES).toMatchObject({
      surface: 'desktop',
      shareUrl: { enabled: false },
      agentSessions: { enabled: false },
      projectPackages: {
        enabled: true,
        defaultExtension: '.akselarcade',
        legacyJsonImport: false,
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

  it('uses Web Arcade on webpages even if a Desktop-looking global exists', async () => {
    window.__AKSEL_ARCADE_DESKTOP__ = {
      getShellCapabilities: vi.fn().mockResolvedValue(DESKTOP_ARCADE_CAPABILITIES),
    }

    await expect(resolveInitialShellCapabilities({ isElectron: false })).resolves.toBe(
      WEB_ARCADE_CAPABILITIES
    )
  })

  it('refuses to show Web Arcade inside Electron when no desktop preload bridge is present', async () => {
    await expect(resolvePreloadedShellCapabilities(undefined)).resolves.toBeNull()
    await expect(resolveInitialShellCapabilities({ isElectron: true })).rejects.toThrow(
      /Refusing to show Web Arcade inside Electron/
    )
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

  it('rejects Web Arcade capabilities from the Desktop preload bridge', async () => {
    const getShellCapabilities = vi.fn().mockResolvedValue(WEB_ARCADE_CAPABILITIES)

    await expect(
      resolveInitialShellCapabilities({
        preloadApi: { getShellCapabilities },
        isElectron: true,
      })
    ).rejects.toThrow(/Invalid Desktop Arcade preload capabilities/)
  })
})

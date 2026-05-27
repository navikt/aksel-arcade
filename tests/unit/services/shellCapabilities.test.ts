import { describe, expect, it } from 'vitest'
import {
  DESKTOP_ARCADE_CAPABILITIES,
  WEB_ARCADE_CAPABILITIES,
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
})

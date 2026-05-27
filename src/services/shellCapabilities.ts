export type ArcadeShellSurface = 'web' | 'desktop'

export interface ShellCapabilityToggle {
  enabled: boolean
}

export interface ProjectPackageCapabilities extends ShellCapabilityToggle {
  defaultExtension: '.akselarcade'
  legacyJsonImport: boolean
}

export interface ShellCapabilities {
  surface: ArcadeShellSurface
  shareUrl: ShellCapabilityToggle
  agentSessions: ShellCapabilityToggle
  projectPackages: ProjectPackageCapabilities
}

export interface DesktopArcadePreloadApi {
  getShellCapabilities: () => Promise<unknown>
}

export const WEB_ARCADE_CAPABILITIES: ShellCapabilities = Object.freeze({
  surface: 'web',
  shareUrl: Object.freeze({ enabled: true }),
  agentSessions: Object.freeze({ enabled: false }),
  projectPackages: Object.freeze({
    enabled: true,
    defaultExtension: '.akselarcade',
    legacyJsonImport: true,
  }),
})

export const DESKTOP_ARCADE_CAPABILITIES: ShellCapabilities = Object.freeze({
  surface: 'desktop',
  shareUrl: Object.freeze({ enabled: false }),
  agentSessions: Object.freeze({ enabled: true }),
  projectPackages: Object.freeze({
    enabled: true,
    defaultExtension: '.akselarcade',
    legacyJsonImport: true,
  }),
})

export const SHELL_CAPABILITY_SETS: Readonly<Record<ArcadeShellSurface, ShellCapabilities>> =
  Object.freeze({
    web: WEB_ARCADE_CAPABILITIES,
    desktop: DESKTOP_ARCADE_CAPABILITIES,
  })

export const resolveShellCapabilities = (surface: unknown = 'web'): ShellCapabilities =>
  SHELL_CAPABILITY_SETS[resolveShellSurface(surface)]

export const getConfiguredShellCapabilities = (): ShellCapabilities =>
  resolveShellCapabilities(import.meta.env.VITE_AKSEL_ARCADE_SURFACE)

export const getDesktopPreloadApi = (): DesktopArcadePreloadApi | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const api = window.__AKSEL_ARCADE_DESKTOP__
  if (api === undefined) {
    return undefined
  }

  if (!isRecord(api) || typeof api.getShellCapabilities !== 'function') {
    throw new Error(
      'Invalid Desktop Arcade preload API. Expected a narrow getShellCapabilities IPC bridge.'
    )
  }

  return api
}

export const resolvePreloadedShellCapabilities = async (
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): Promise<ShellCapabilities | null> => {
  if (!api) {
    return null
  }

  const payload = await api.getShellCapabilities()
  if (!isShellCapabilitiesPayload(payload)) {
    throw new Error(
      'Invalid Desktop Arcade preload capabilities. Expected a known shell capability set.'
    )
  }

  return resolveShellCapabilities(payload.surface)
}

export const resolveInitialShellCapabilities = async (
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): Promise<ShellCapabilities> =>
  (await resolvePreloadedShellCapabilities(api)) ?? getConfiguredShellCapabilities()

export const resolveShellSurface = (surface: unknown = 'web'): ArcadeShellSurface => {
  if (surface === undefined || surface === null || surface === '' || surface === 'web') {
    return 'web'
  }

  if (surface === 'desktop') {
    return 'desktop'
  }

  throw new Error(
    `Unsupported Aksel Arcade shell surface "${String(surface)}". Expected "web" or "desktop".`
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasCapabilityToggle = (value: unknown, expectedEnabled: boolean): boolean =>
  isRecord(value) && value.enabled === expectedEnabled

const hasProjectPackageCapabilities = (
  value: unknown,
  expected: ProjectPackageCapabilities
): boolean =>
  isRecord(value) &&
  value.enabled === expected.enabled &&
  value.defaultExtension === expected.defaultExtension &&
  value.legacyJsonImport === expected.legacyJsonImport

const isShellCapabilitiesPayload = (value: unknown): value is ShellCapabilities => {
  if (!isRecord(value) || (value.surface !== 'web' && value.surface !== 'desktop')) {
    return false
  }

  const expected = SHELL_CAPABILITY_SETS[value.surface]
  return (
    hasCapabilityToggle(value.shareUrl, expected.shareUrl.enabled) &&
    hasCapabilityToggle(value.agentSessions, expected.agentSessions.enabled) &&
    hasProjectPackageCapabilities(value.projectPackages, expected.projectPackages)
  )
}

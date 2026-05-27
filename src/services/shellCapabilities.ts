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

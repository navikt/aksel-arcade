import type {
  DesktopAgentSessionEndReason,
  DesktopAgentTransportEndpoint,
  DesktopAgentTransportSession,
} from './desktopAgentSessionCoordinator'
import type { DesktopAgentTransportRequestHandler } from './desktopAgentTransportProtocol'

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
  startAgentTransportSession?: (
    session: DesktopAgentTransportSession
  ) => Promise<DesktopAgentTransportEndpoint>
  stopAgentTransportSession?: (
    sessionId: string,
    reason: DesktopAgentSessionEndReason
  ) => Promise<unknown>
  setAgentTransportRequestHandler?: (handler: DesktopAgentTransportRequestHandler | null) => void
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

interface ResolveInitialShellCapabilitiesOptions {
  preloadApi?: DesktopArcadePreloadApi
  isElectron?: boolean
}

export const resolveShellCapabilities = (surface: unknown = 'web'): ShellCapabilities =>
  SHELL_CAPABILITY_SETS[resolveShellSurface(surface)]

export const getDesktopPreloadApi = (): DesktopArcadePreloadApi | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  const api = window.__AKSEL_ARCADE_DESKTOP__
  if (api === undefined) {
    return undefined
  }

  if (
    !isRecord(api) ||
    typeof api.getShellCapabilities !== 'function' ||
    !hasOptionalFunction(api, 'startAgentTransportSession') ||
    !hasOptionalFunction(api, 'stopAgentTransportSession') ||
    !hasOptionalFunction(api, 'setAgentTransportRequestHandler')
  ) {
    throw new Error(
      'Invalid Desktop Arcade preload API. Expected narrow shell capability and Agent transport IPC bridges.'
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
  if (!isShellCapabilitiesPayload(payload) || payload.surface !== 'desktop') {
    throw new Error(
      'Invalid Desktop Arcade preload capabilities. Expected the Desktop Arcade capability set.'
    )
  }

  return DESKTOP_ARCADE_CAPABILITIES
}

export const resolveInitialShellCapabilities = async ({
  preloadApi,
  isElectron = isElectronRenderer(),
}: ResolveInitialShellCapabilitiesOptions = {}): Promise<ShellCapabilities> => {
  if (!isElectron) {
    return WEB_ARCADE_CAPABILITIES
  }

  const api = preloadApi ?? getDesktopPreloadApi()
  if (!api) {
    throw new Error(
      'Desktop Arcade preload bridge is unavailable. Refusing to show Web Arcade inside Electron.'
    )
  }

  const capabilities = await resolvePreloadedShellCapabilities(api)
  if (!capabilities) {
    throw new Error('Desktop Arcade preload bridge did not return capabilities.')
  }

  return capabilities
}

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

const isElectronRenderer = (): boolean =>
  typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent)

const hasOptionalFunction = (value: Record<string, unknown>, key: string): boolean =>
  value[key] === undefined || typeof value[key] === 'function'

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

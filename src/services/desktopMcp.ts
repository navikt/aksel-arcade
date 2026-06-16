import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'

export type DesktopMcpServerAvailability =
  | { status: 'available' }
  | { status: 'unavailable'; reason: string }

export interface DesktopMcpServerState {
  serverName: string
  transportLabel: string
  url: string
  requiresAuth: false
  authDescription: string
  availability: DesktopMcpServerAvailability
}

export const DESKTOP_MCP_LAST_ACTIVITY_PLACEHOLDER = 'Last activity: No MCP activity yet.'

export const readDesktopMcpServerState = async (
  api: DesktopArcadePreloadApi | undefined = getDesktopPreloadApi()
): Promise<DesktopMcpServerState | null> => {
  if (!api?.getDesktopMcpServerState) {
    return null
  }

  const payload = await api.getDesktopMcpServerState()
  if (!isDesktopMcpServerState(payload)) {
    throw new Error('Invalid Desktop Arcade MCP server state returned from preload IPC.')
  }

  return payload
}

export const formatDesktopMcpAvailability = (
  availability: DesktopMcpServerAvailability
): string =>
  availability.status === 'available'
    ? 'Status: Available'
    : `Status: Unavailable: ${availability.reason}`

const isDesktopMcpServerState = (value: unknown): value is DesktopMcpServerState => {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.serverName !== 'string' ||
    value.serverName.length === 0 ||
    typeof value.transportLabel !== 'string' ||
    value.transportLabel.length === 0 ||
    typeof value.url !== 'string' ||
    value.requiresAuth !== false ||
    typeof value.authDescription !== 'string' ||
    value.authDescription.length === 0
  ) {
    return false
  }

  try {
    const url = new URL(value.url)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/mcp') {
      return false
    }
  } catch {
    return false
  }

  return isDesktopMcpServerAvailability(value.availability)
}

const isDesktopMcpServerAvailability = (
  value: unknown
): value is DesktopMcpServerAvailability => {
  if (!isRecord(value)) {
    return false
  }

  if (value.status === 'available') {
    return true
  }

  return (
    value.status === 'unavailable' &&
    typeof value.reason === 'string' &&
    value.reason.trim().length > 0
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

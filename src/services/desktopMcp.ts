import { getDesktopPreloadApi, type DesktopArcadePreloadApi } from './shellCapabilities'
import type { DesktopMcpLastActivity } from './desktopMcpApplyChangesProtocol'

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
  lastActivity?: DesktopMcpLastActivity | null
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

export const formatDesktopMcpLastActivity = (
  activity: DesktopMcpLastActivity | null | undefined
): string => {
  if (!activity) {
    return DESKTOP_MCP_LAST_ACTIVITY_PLACEHOLDER
  }

  const operationSuffix =
    activity.operationTypes && activity.operationTypes.length > 0
      ? ` (${activity.operationTypes.join(', ')})`
      : ''

  return `Last activity: ${activity.toolName}${operationSuffix} at ${activity.timestamp}`
}

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

  return (
    isDesktopMcpServerAvailability(value.availability) &&
    (value.lastActivity === undefined ||
      value.lastActivity === null ||
      isDesktopMcpLastActivity(value.lastActivity))
  )
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

const isDesktopMcpLastActivity = (value: unknown): value is DesktopMcpLastActivity => {
  if (!isRecord(value)) {
    return false
  }

  if (
    (value.toolName !== 'apply_changes' && value.toolName !== 'capture_preview_evidence') ||
    typeof value.timestamp !== 'string' ||
    value.timestamp.trim().length === 0
  ) {
    return false
  }

  return (
    value.operationTypes === undefined ||
    (Array.isArray(value.operationTypes) &&
      value.operationTypes.every((operationType) => typeof operationType === 'string'))
  )
}

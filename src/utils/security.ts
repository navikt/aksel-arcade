import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'
import { isAnnotationTargetResolutionRequest } from '@/services/annotationTargets'

/**
 * Validates that a message is from the expected sandbox iframe
 */
export const isValidMessageSource = (
  event: MessageEvent,
  expectedSource: Window | null
): boolean => {
  return event.source === expectedSource
}

/**
 * Validates message structure for main-to-sandbox messages
 */
export const validateMainToSandboxMessage = (data: unknown): data is MainToSandboxMessage => {
  if (!isRecord(data) || typeof data.type !== 'string') return false

  switch (data.type) {
    case 'CONNECT_SANDBOX':
    case 'EXECUTE_CODE':
    case 'NAVIGATE_TO_PAGE':
    case 'UPDATE_VIEWPORT':
    case 'TOGGLE_INSPECT':
    case 'TOGGLE_ANNOTATION_MODE':
    case 'CLEAR_ANNOTATION_SELECTION':
    case 'GET_INSPECTION_DATA':
    case 'UPDATE_THEME':
    case 'CAPTURE_PREVIEW_EVIDENCE':
      return true
    case 'RESOLVE_ANNOTATION_TARGET':
      return (
        isRecord(data.payload) &&
        typeof data.payload.requestId === 'string' &&
        data.payload.requestId.length > 0 &&
        isAnnotationTargetResolutionRequest(data.payload.request)
      )
    default:
      return false
  }
}

/**
 * Validates message structure for sandbox-to-main messages
 */
export const validateSandboxToMainMessage = (data: unknown): data is SandboxToMainMessage => {
  if (!data || typeof data !== 'object') return false
  if (!('type' in data)) return false

  const validTypes = [
    'SANDBOX_CONNECTED',
    'RENDER_SUCCESS',
    'COMPILE_ERROR',
    'RUNTIME_ERROR',
    'PREVIEW_PAGE_CHANGED',
    'INSPECTION_DATA',
    'ANNOTATION_TARGET_HOVERED',
    'ANNOTATION_TARGET_SELECTED',
    'THEME_UPDATED',
    'CONSOLE_LOG',
    'PREVIEW_EVIDENCE_CAPTURED',
    'ANNOTATION_TARGET_RESOLVED',
  ]
  const type = (data as { type: string }).type
  if (!validTypes.includes(type)) return false

  if (type === 'ANNOTATION_TARGET_HOVERED') {
    const payload = (data as { payload?: unknown }).payload
    return payload === null || isAnnotationTargetResolutionResult(payload)
  }

  if (type === 'ANNOTATION_TARGET_SELECTED') {
    return isAnnotationTargetResolutionResult((data as { payload?: unknown }).payload)
  }

  if (type === 'ANNOTATION_TARGET_RESOLVED') {
    const payload = (data as { payload?: unknown }).payload
    return (
      isRecord(payload) &&
      typeof payload.requestId === 'string' &&
      isAnnotationTargetResolutionResult(payload.result)
    )
  }

  return true
}

const isAnnotationTargetResolutionResult = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false
  }

  if (!['resolved', 'hidden', 'dead', 'no-target'].includes(value.status)) {
    return false
  }

  if ('matchCount' in value && typeof value.matchCount !== 'number') {
    return false
  }

  if ('target' in value && value.target !== undefined && !isResolvedAnnotationTarget(value.target)) {
    return false
  }

  if ('targets' in value) {
    if (!Array.isArray(value.targets)) {
      return false
    }
    if (!value.targets.every(isResolvedAnnotationTarget)) {
      return false
    }
  }

  return true
}

const isResolvedAnnotationTarget = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false
  }

  return (
    isAnnotationTargetIdentity(value.identity) &&
    isAnnotationTargetSnapshot(value.snapshot) &&
    (value.visibility === 'visible' || value.visibility === 'hidden')
  )
}

const isAnnotationTargetIdentity = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.signature === 'string' &&
  typeof value.tagName === 'string' &&
  typeof value.elementPath === 'string' &&
  typeof value.fullPath === 'string' &&
  optionalString(value.role) &&
  optionalString(value.accessibleName) &&
  optionalString(value.text) &&
  optionalString(value.cssClasses)

const isAnnotationTargetSnapshot = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.element !== 'string' ||
    typeof value.elementPath !== 'string'
  ) {
    return false
  }

  return (
    optionalRect(value.boundingBox) &&
    optionalString(value.nearbyText) &&
    optionalString(value.cssClasses) &&
    optionalString(value.fullPath) &&
    optionalString(value.accessibility) &&
    optionalBoolean(value.isFixed) &&
    optionalBoolean(value.isMultiSelect)
  )
}

const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string'
const optionalBoolean = (value: unknown): boolean => value === undefined || typeof value === 'boolean'

const optionalRect = (value: unknown): boolean =>
  value === undefined ||
  (isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Sanitizes props to remove non-serializable values
 */
export const sanitizeProps = (props: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function' || key === 'children') {
      continue
    }

    try {
      JSON.stringify(value) // Test serializability
      sanitized[key] = value
    } catch {
      sanitized[key] = '[Non-serializable]'
    }
  }

  return sanitized
}

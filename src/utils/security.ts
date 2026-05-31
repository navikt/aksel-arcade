import type { MainToSandboxMessage, SandboxToMainMessage } from '@/types/messages'

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
  if (!data || typeof data !== 'object') return false
  if (!('type' in data)) return false

  const validTypes = [
    'CONNECT_SANDBOX',
    'EXECUTE_CODE',
    'UPDATE_VIEWPORT',
    'TOGGLE_INSPECT',
    'GET_INSPECTION_DATA',
    'UPDATE_THEME',
  ]
  return validTypes.includes((data as { type: string }).type)
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
    'INSPECTION_DATA',
    'THEME_UPDATED',
    'CONSOLE_LOG',
  ]
  return validTypes.includes((data as { type: string }).type)
}

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

import type { RuntimeError } from '@/types/preview'

const INVALID_HOOK_CALL_PATTERN = /invalid hook call/i

export const INVALID_HOOK_CALL_ARCADE_HINT =
  'Hooks cannot run at Global config/module scope. Move state into the page Hooks tab, or define a custom hook function in Global config and call it from a page.'

export const getArcadeRuntimeDiagnosticHint = (
  error: Pick<RuntimeError, 'message'>
): string | null => {
  if (!INVALID_HOOK_CALL_PATTERN.test(error.message)) {
    return null
  }

  return INVALID_HOOK_CALL_ARCADE_HINT
}

import type { RuntimeError } from '@/types/preview'

const INVALID_HOOK_CALL_PATTERN = /invalid hook call/i

export const INVALID_HOOK_CALL_ARCADE_HINT =
  'This often means a hook is still running at module scope (for example Global config, or a bare page Hooks statement) instead of inside a page component. In Arcade, keep page state in top-level bindings in the page Hooks tab (for example `const [value, setValue] = useState(...)`), or define a custom hook function in Global config and call it from a page.'

export const getArcadeRuntimeDiagnosticHint = (
  error: Pick<RuntimeError, 'message'>
): string | null => {
  if (!INVALID_HOOK_CALL_PATTERN.test(error.message)) {
    return null
  }

  return INVALID_HOOK_CALL_ARCADE_HINT
}

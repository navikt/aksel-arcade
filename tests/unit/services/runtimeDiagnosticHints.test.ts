import { describe, expect, it } from 'vitest'
import {
  getArcadeRuntimeDiagnosticHint,
  INVALID_HOOK_CALL_ARCADE_HINT,
} from '@/services/runtimeDiagnosticHints'

describe('runtimeDiagnosticHints', () => {
  it('returns an Arcade-specific hint for invalid hook call errors', () => {
    expect(
      getArcadeRuntimeDiagnosticHint({
        message:
          'Invalid hook call. Hooks can only be called inside of the body of a function component.',
      })
    ).toBe(INVALID_HOOK_CALL_ARCADE_HINT)
  })

  it('returns null for unrelated runtime errors', () => {
    expect(getArcadeRuntimeDiagnosticHint({ message: 'Boom' })).toBeNull()
  })
})

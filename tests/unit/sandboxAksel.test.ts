import { describe, expect, it } from 'vitest'
import {
  AKSEL_SAFE_COMPATIBILITY_ALIASES,
  AKSEL_UNSUPPORTED_LEGACY_GUIDANCE,
  applyAkselRuntimeCompatibility,
} from '../../src/sandboxAksel'

describe('sandbox Aksel runtime compatibility', () => {
  it('maps only safe aliases to current runtime components', () => {
    const Box = Symbol('Box')
    const UnsafeCombobox = Symbol('UNSAFE_Combobox')

    const runtimeComponents = applyAkselRuntimeCompatibility({
      Box,
      UNSAFE_Combobox: UnsafeCombobox,
    })

    expect(AKSEL_SAFE_COMPATIBILITY_ALIASES.BoxNew).toBe('Box')
    expect(runtimeComponents.BoxNew).toBe(Box)
    expect(runtimeComponents.Combobox).toBe(UnsafeCombobox)
  })

  it('keeps ambiguous legacy layouts as guidance errors instead of aliases', () => {
    const HGrid = Symbol('HGrid')
    const runtimeComponents = applyAkselRuntimeCompatibility({ HGrid })

    expect(runtimeComponents.Grid).not.toBe(HGrid)
    expect(runtimeComponents.Stack).not.toBe(HGrid)

    const Grid = runtimeComponents.Grid
    const Stack = runtimeComponents.Stack

    expect(Grid).toBeTypeOf('function')
    expect(Stack).toBeTypeOf('function')

    if (typeof Grid !== 'function' || typeof Stack !== 'function') {
      throw new Error('Expected legacy guidance components to be functions')
    }

    expect(() => Grid()).toThrow(AKSEL_UNSUPPORTED_LEGACY_GUIDANCE.Grid)
    expect(() => Stack()).toThrow(AKSEL_UNSUPPORTED_LEGACY_GUIDANCE.Stack)
  })
})

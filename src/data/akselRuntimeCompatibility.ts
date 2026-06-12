export const AKSEL_SAFE_COMPATIBILITY_ALIASES = {
  BoxNew: 'Box',
} as const

export const AKSEL_RUNTIME_NAME_ALIASES = {
  Combobox: 'UNSAFE_Combobox',
} as const

export const AKSEL_UNSUPPORTED_LEGACY_GUIDANCE = {
  Grid:
    'Grid is a legacy Aksel layout name and is not automatically aliased because grid migration can change layout behavior. Use HGrid with current v8 props instead.',
  Stack:
    'Stack is a legacy Aksel layout name and is not automatically aliased because direction and spacing migration can change layout behavior. Use HStack or VStack with current v8 props instead.',
} as const

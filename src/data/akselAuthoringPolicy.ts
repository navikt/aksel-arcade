const HIDDEN_NEW_AUTHORING_ROOTS = {
  Alert: {
    reason: 'deprecated',
    replacements: ['InlineMessage', 'LocalAlert', 'GlobalAlert'],
  },
  Modal: {
    reason: 'replaced',
    replacements: ['Dialog'],
  },
} as const

function hasHiddenNewAuthoringRoot(componentName: string): componentName is HiddenNewAuthoringRoot {
  return Object.prototype.hasOwnProperty.call(HIDDEN_NEW_AUTHORING_ROOTS, componentName)
}

export type HiddenNewAuthoringRoot = keyof typeof HIDDEN_NEW_AUTHORING_ROOTS

export function listHiddenNewAuthoringRoots(): HiddenNewAuthoringRoot[] {
  return Object.keys(HIDDEN_NEW_AUTHORING_ROOTS) as HiddenNewAuthoringRoot[]
}

export function getNewAuthoringRootName(componentName: string): string {
  return componentName.split('.')[0] ?? componentName
}

export function isHiddenFromNewAuthoring(componentName: string): boolean {
  return hasHiddenNewAuthoringRoot(getNewAuthoringRootName(componentName))
}

export function filterNewAuthoringEntries<T extends { name: string }>(entries: readonly T[]): T[] {
  return entries.filter((entry) => !isHiddenFromNewAuthoring(entry.name))
}

export function getNewAuthoringPolicy(componentName: string) {
  const rootName = getNewAuthoringRootName(componentName)

  if (!hasHiddenNewAuthoringRoot(rootName)) {
    return undefined
  }

  return HIDDEN_NEW_AUTHORING_ROOTS[rootName]
}

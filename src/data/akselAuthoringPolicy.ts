export interface HiddenNewAuthoringMigrationMatch {
  fullWidth?: true
  closeButton?: true
  inline?: true
  variants?: readonly string[]
}

export interface HiddenNewAuthoringPropMapping {
  sourceProp: 'variant'
  targetProp: 'status' | 'data-color'
  valueMap: Readonly<Record<string, string>>
}

export interface HiddenNewAuthoringMigrationRule {
  when: string
  target: string
  match?: HiddenNewAuthoringMigrationMatch
  propMappings?: readonly HiddenNewAuthoringPropMapping[]
  preservesCloseButton?: boolean
  note?: string
}

export interface HiddenNewAuthoringPolicy {
  reason: 'deprecated' | 'replaced'
  replacements: readonly string[]
  migrationRules?: readonly HiddenNewAuthoringMigrationRule[]
}

const ALERT_VARIANT_TO_STATUS = Object.freeze({
  info: 'announcement',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const)

const ALERT_VARIANT_TO_DATA_COLOR = Object.freeze({
  info: 'info',
} as const)

const ALERT_MIGRATION_RULES = Object.freeze([
  Object.freeze<HiddenNewAuthoringMigrationRule>({
    when: 'Alert with fullWidth',
    target: 'GlobalAlert',
    match: Object.freeze({
      fullWidth: true,
      variants: Object.freeze(['info', 'success', 'warning', 'error']),
    }),
    propMappings: Object.freeze([
      Object.freeze({
        sourceProp: 'variant',
        targetProp: 'status',
        valueMap: ALERT_VARIANT_TO_STATUS,
      }),
    ]),
    preservesCloseButton: true,
    note: 'Use GlobalAlert for page-wide banners. variant="info" becomes status="announcement".',
  }),
  Object.freeze<HiddenNewAuthoringMigrationRule>({
    when: 'Alert with inline',
    target: 'InlineMessage',
    match: Object.freeze({
      inline: true,
      variants: Object.freeze(['info', 'success', 'warning', 'error']),
    }),
    propMappings: Object.freeze([
      Object.freeze({
        sourceProp: 'variant',
        targetProp: 'status',
        valueMap: Object.freeze({
          info: 'info',
          success: 'success',
          warning: 'warning',
          error: 'error',
        }),
      }),
    ]),
  }),
  Object.freeze<HiddenNewAuthoringMigrationRule>({
    when: 'Alert with closeButton but without fullWidth or inline',
    target: 'LocalAlert',
    match: Object.freeze({
      closeButton: true,
      variants: Object.freeze(['info', 'success', 'warning', 'error']),
    }),
    propMappings: Object.freeze([
      Object.freeze({
        sourceProp: 'variant',
        targetProp: 'status',
        valueMap: ALERT_VARIANT_TO_STATUS,
      }),
    ]),
    preservesCloseButton: true,
    note: 'Dismissible local alerts stay on the close-capable LocalAlert branch. variant="info" becomes status="announcement".',
  }),
  Object.freeze<HiddenNewAuthoringMigrationRule>({
    when: 'Alert variant="info"',
    target: 'InfoCard',
    match: Object.freeze({
      variants: Object.freeze(['info']),
    }),
    propMappings: Object.freeze([
      Object.freeze({
        sourceProp: 'variant',
        targetProp: 'data-color',
        valueMap: ALERT_VARIANT_TO_DATA_COLOR,
      }),
    ]),
    note: 'Use InfoCard for non-inline informational alerts that do not need the close-capable alert shell.',
  }),
  Object.freeze<HiddenNewAuthoringMigrationRule>({
    when: 'Alert variant="success" | "warning" | "error"',
    target: 'LocalAlert',
    match: Object.freeze({
      variants: Object.freeze(['success', 'warning', 'error']),
    }),
    propMappings: Object.freeze([
      Object.freeze({
        sourceProp: 'variant',
        targetProp: 'status',
        valueMap: ALERT_VARIANT_TO_STATUS,
      }),
    ]),
  }),
] as const)

const HIDDEN_NEW_AUTHORING_ROOTS = {
  Alert: {
    reason: 'deprecated',
    replacements: ['InfoCard', 'InlineMessage', 'LocalAlert', 'GlobalAlert'],
    migrationRules: ALERT_MIGRATION_RULES,
  },
  Modal: {
    reason: 'replaced',
    replacements: ['Dialog'],
  },
  // Keep Dropdown available as a legacy compatibility entry, but intentionally
  // hide it from all new authoring paths so future catalog refreshes do not
  // steer authors back to it instead of ActionMenu.
  Dropdown: {
    reason: 'replaced',
    replacements: ['ActionMenu'],
  },
} satisfies Record<string, HiddenNewAuthoringPolicy>

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

export function getNewAuthoringPolicy(componentName: string): HiddenNewAuthoringPolicy | undefined {
  const rootName = getNewAuthoringRootName(componentName)

  if (!hasHiddenNewAuthoringRoot(rootName)) {
    return undefined
  }

  return HIDDEN_NEW_AUTHORING_ROOTS[rootName]
}

export interface AlertMigrationInput {
  variant?: string
  inline?: boolean
  fullWidth?: boolean
  closeButton?: boolean
}

export interface AlertMigrationResult {
  target: 'InfoCard' | 'InlineMessage' | 'LocalAlert' | 'GlobalAlert'
  targetProp: 'status' | 'data-color'
  targetValue: string
  preservesCloseButton: boolean
}

const matchesAlertMigrationRule = (
  rule: HiddenNewAuthoringMigrationRule,
  input: AlertMigrationInput
): boolean => {
  const match = rule.match
  if (!match) {
    return false
  }
  if (match.fullWidth && !input.fullWidth) {
    return false
  }
  if (match.closeButton && !input.closeButton) {
    return false
  }
  if (match.inline && !input.inline) {
    return false
  }
  if (match.variants && (!input.variant || !match.variants.includes(input.variant))) {
    return false
  }
  return true
}

export function resolveAlertMigration(input: AlertMigrationInput): AlertMigrationResult | undefined {
  const alertPolicy = getNewAuthoringPolicy('Alert')
  const migrationRule = alertPolicy?.migrationRules?.find((rule) => matchesAlertMigrationRule(rule, input))
  const propMapping = migrationRule?.propMappings?.find((mapping) => mapping.sourceProp === 'variant')
  const targetValue = input.variant ? propMapping?.valueMap[input.variant] : undefined

  if (!migrationRule || !propMapping || !targetValue) {
    return undefined
  }

  return {
    target: migrationRule.target as AlertMigrationResult['target'],
    targetProp: propMapping.targetProp,
    targetValue,
    preservesCloseButton: migrationRule.preservesCloseButton ?? false,
  }
}

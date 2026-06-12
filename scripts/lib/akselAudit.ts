import type {
  AkselAutocompleteEntry,
  AkselAutocompleteProp,
} from './akselDocs'

export type AuditCatalogGroup = 'layout' | 'component' | 'icon'
export type AuditCatalogStatus = 'current' | 'experimental' | 'legacy'
export type AuditExceptionItemType = 'component' | 'primitive' | 'icon'
export type AuditExceptionMatchKind =
  | 'catalog-coverage'
  | 'catalog-stale'
  | 'runtime-alias'
  | 'runtime-compat'
  | 'docs-noise'
export type AuditExceptionSurface =
  | 'components'
  | 'primitives'
  | 'icons'
  | 'props'
  | 'prop-values'
  | 'snippets'
  | 'aliases'
  | 'replacement-policy'

export interface AuditDocsException {
  id: string
  docsName: string
  reason: string
  matchKinds: AuditExceptionMatchKind[]
  affects: AuditExceptionSurface[]
  itemType: AuditExceptionItemType
  runtimeName?: string
}

export interface AuditCatalogException {
  id: string
  catalogEntryName: string
  reason: string
  matchKinds: AuditExceptionMatchKind[]
  affects: AuditExceptionSurface[]
  itemType: AuditExceptionItemType
  docsName?: string
  runtimeName?: string
}

export interface AuditCatalogProp {
  name: string
  type: string
  values?: string[]
  required?: boolean
  default?: string
  description: string
  valueKind?: string
}

export interface AuditCatalogEntry {
  name: string
  group: AuditCatalogGroup
  status: AuditCatalogStatus
  package: '@navikt/ds-react' | '@navikt/aksel-icons'
  importName: string
  importGuidance: string
  docs: string
  description: string
  props: AuditCatalogProp[]
  snippet: {
    code: string
    description: string
  }
}

export interface AuditFinding {
  category:
    | 'versions'
    | 'catalog'
    | 'runtime'
    | 'icons'
    | 'generated-docs'
    | 'authoring'
    | 'discovery'
    | 'metadata'
  status: 'accepted' | 'potential'
  name: string
  message: string
  exceptionId?: string
  exceptionReason?: string
}

export interface AkselAuditInput {
  targetVersion: string
  packageJsonVersions: Record<string, string | undefined>
  lockfileVersions: Record<string, string | undefined>
  metadataVersions: Record<string, string | undefined>
  catalogVersion: string
  runtimeAliases: Record<string, string>
  safeCompatibilityAliases: Record<string, string>
  runtimeComponentExports: string[]
  runtimeIconExports: string[]
  freshDocsEntries: AkselAutocompleteEntry[]
  docsCoverageEntries: AkselAutocompleteEntry[]
  generatedDocsEntries: AkselAutocompleteEntry[]
  catalogEntries: AuditCatalogEntry[]
  addMenuNames: string[]
  snippetNames: string[]
  autocompleteNames: string[]
  iconCatalogNames: string[]
  hiddenNewAuthoringRoots: string[]
  authoringPropsByComponent: Record<string, AuditCatalogProp[]>
  acceptedDocsExceptions: AuditDocsException[]
  acceptedCatalogExceptions: AuditCatalogException[]
}

export interface AkselAuditReport {
  targetVersion: string
  potentialFindings: AuditFinding[]
  acceptedFindings: AuditFinding[]
}

interface AuditExceptionContext {
  itemType: AuditExceptionItemType
  surface: AuditExceptionSurface
  runtimeName?: string
}

const TRACKED_PACKAGES = ['@navikt/ds-react', '@navikt/ds-css', '@navikt/aksel-icons'] as const
const CURRENT_DISCOVERY_STATUSES = new Set(['current', 'experimental'])

function byName<T extends { name: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.name, entry]))
}

function propByName<T extends { name: string }>(props: T[]): Map<string, T> {
  return new Map(props.map((prop) => [prop.name, prop]))
}

function normalizeValues(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).filter((value) => value.trim().length > 0 && !/\s/.test(value)))
  ).sort((a, b) => a.localeCompare(b))
}

function shouldCompareLiteralValues(typeText: string): boolean {
  const normalizedType = typeText.replace(/`/g, '')

  if (/\bboolean(?:ish)?\b/i.test(normalizedType)) {
    return true
  }

  if (!normalizedType.includes('"')) {
    return false
  }

  return (
    !normalizedType.includes('ResponsiveProp') &&
    !normalizedType.includes('[') &&
    !normalizedType.includes(']') &&
    !normalizedType.includes('{') &&
    !normalizedType.includes('}') &&
    !normalizedType.includes('<') &&
    !normalizedType.includes('>')
  )
}

function rootName(componentName: string): string {
  return componentName.split('.')[0] ?? componentName
}

function resolveRuntimeSupport(
  componentName: string,
  runtimeExports: Set<string>,
  runtimeAliases: Record<string, string>,
  safeCompatibilityAliases: Record<string, string>
): { supported: boolean; aliasTarget?: string } {
  const lookupName = rootName(componentName)
  if (runtimeExports.has(lookupName)) {
    return { supported: true }
  }

  const aliasTarget = runtimeAliases[lookupName] ?? safeCompatibilityAliases[lookupName]
  if (aliasTarget && runtimeExports.has(aliasTarget)) {
    return { supported: true, aliasTarget }
  }

  return { supported: false }
}

function isVariantCatalogEntry(entry: AuditCatalogEntry): boolean {
  return entry.name.includes(' ') && entry.name !== entry.importName
}

function matchesCatalogCoverageEntry(entry: AuditCatalogEntry, docsName: string): boolean {
  return entry.name === docsName || (isVariantCatalogEntry(entry) && entry.importName === docsName)
}

function matchesCatalogStatusEntry(entry: AuditCatalogEntry, docsName: string): boolean {
  return entry.name === docsName || (isVariantCatalogEntry(entry) && entry.importName === docsName)
}

function getDocsEntryContext(entry: AkselAutocompleteEntry): AuditExceptionContext {
  return {
    itemType: entry.group === 'primitive' ? 'primitive' : 'component',
    surface: entry.group === 'primitive' ? 'primitives' : 'components',
  }
}

function getCatalogEntryContext(
  entry: AuditCatalogEntry,
  runtimeName?: string
): AuditExceptionContext {
  const itemType: AuditExceptionItemType =
    entry.group === 'layout' ? 'primitive' : entry.group === 'icon' ? 'icon' : 'component'
  const surface: AuditExceptionSurface =
    entry.group === 'layout' ? 'primitives' : entry.group === 'icon' ? 'icons' : 'components'

  return { itemType, surface, runtimeName }
}

function withDocsException(
  finding: Omit<AuditFinding, 'status'>,
  docsName: string,
  matchKind: AuditExceptionMatchKind,
  exceptions: AuditDocsException[],
  context: AuditExceptionContext
): AuditFinding {
  const exception = exceptions.find(
    (entry) =>
      entry.docsName === docsName &&
      entry.matchKinds.includes(matchKind) &&
      entry.itemType === context.itemType &&
      entry.affects.includes(context.surface) &&
      (entry.runtimeName === undefined || entry.runtimeName === context.runtimeName)
  )

  return exception
    ? {
        ...finding,
        status: 'accepted',
        exceptionId: exception.id,
        exceptionReason: exception.reason,
      }
    : {
        ...finding,
        status: 'potential',
      }
}

function withCatalogException(
  finding: Omit<AuditFinding, 'status'>,
  catalogEntryName: string,
  matchKind: AuditExceptionMatchKind,
  exceptions: AuditCatalogException[],
  context: AuditExceptionContext
): AuditFinding {
  const exception = exceptions.find(
    (entry) =>
      entry.catalogEntryName === catalogEntryName &&
      entry.matchKinds.includes(matchKind) &&
      entry.itemType === context.itemType &&
      entry.affects.includes(context.surface) &&
      (entry.runtimeName === undefined || entry.runtimeName === context.runtimeName)
  )

  return exception
    ? {
        ...finding,
        status: 'accepted',
        exceptionId: exception.id,
        exceptionReason: exception.reason,
      }
    : {
        ...finding,
        status: 'potential',
      }
}

function buildVersionFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const packageName of TRACKED_PACKAGES) {
    const packageJsonVersion = input.packageJsonVersions[packageName]
    const lockfileVersion = input.lockfileVersions[packageName]
    const metadataVersion = input.metadataVersions[packageName]

    if (packageJsonVersion !== input.targetVersion) {
      findings.push({
        category: 'versions',
        status: 'potential',
        name: packageName,
        message: `package.json pins ${packageName}@${packageJsonVersion ?? 'missing'} instead of ${input.targetVersion}.`,
      })
    }

    if (lockfileVersion !== input.targetVersion) {
      findings.push({
        category: 'versions',
        status: 'potential',
        name: packageName,
        message: `package-lock.json resolves ${packageName}@${lockfileVersion ?? 'missing'} instead of ${input.targetVersion}.`,
      })
    }

    if (metadataVersion !== input.targetVersion) {
      findings.push({
        category: 'versions',
        status: 'potential',
        name: packageName,
        message: `AKSEL_METADATA still reports ${packageName}@${metadataVersion ?? 'missing'} instead of ${input.targetVersion}.`,
      })
    }
  }

  if (input.catalogVersion !== input.targetVersion) {
    findings.push({
      category: 'versions',
      status: 'potential',
      name: 'AKSEL_CATALOG_VERSION',
      message: `AKSEL_CATALOG_VERSION is ${input.catalogVersion} instead of ${input.targetVersion}.`,
    })
  }

  return findings
}

function buildCatalogFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  const catalogEntries = input.catalogEntries.filter((entry) => entry.group !== 'icon')
  const docsCoverageEntries = input.docsCoverageEntries
  const runtimeExports = new Set(input.runtimeComponentExports)

  for (const docsEntry of docsCoverageEntries) {
    const covered = catalogEntries.some((entry) => matchesCatalogCoverageEntry(entry, docsEntry.name))
    if (!covered) {
      const context = getDocsEntryContext(docsEntry)
      findings.push(
        withDocsException(
          {
            category: 'catalog',
            name: docsEntry.name,
            message: `${docsEntry.name} is documented for current authoring but missing from the curated insertion catalog.`,
          },
          docsEntry.name,
          'catalog-coverage',
          input.acceptedDocsExceptions,
          context
        )
      )
    }
  }

  for (const entry of catalogEntries) {
    const runtimeSupport = resolveRuntimeSupport(
      entry.importName,
      runtimeExports,
      input.runtimeAliases,
      input.safeCompatibilityAliases
    )
    const runtimeName = runtimeSupport.aliasTarget ?? rootName(entry.importName)
    const context = getCatalogEntryContext(entry, runtimeName)
    const matchingDocsEntry = input.freshDocsEntries.find((docsEntry) =>
      matchesCatalogStatusEntry(entry, docsEntry.name)
    )
    if (!matchingDocsEntry) {
      findings.push(
        withCatalogException(
          {
            category: 'catalog',
            name: entry.name,
            message: `${entry.name} is cataloged but no longer appears in fresh Aksel docs.`,
          },
          entry.name,
          'catalog-stale',
          input.acceptedCatalogExceptions,
          context
        )
      )
      continue
    }

    if (
      entry.status !== 'legacy' &&
      !CURRENT_DISCOVERY_STATUSES.has(matchingDocsEntry.status)
    ) {
      findings.push(
        withCatalogException(
          {
            category: 'catalog',
            name: entry.name,
            message: `${entry.name} is cataloged as ${entry.status}, but fresh docs now report status ${matchingDocsEntry.status}.`,
          },
          entry.name,
          'catalog-stale',
          input.acceptedCatalogExceptions,
          context
        )
      )
    }
  }

  return findings
}

function buildRuntimeFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  const runtimeExports = new Set(input.runtimeComponentExports)

  for (const docsEntry of input.docsCoverageEntries) {
    const support = resolveRuntimeSupport(
      docsEntry.name,
      runtimeExports,
      input.runtimeAliases,
      input.safeCompatibilityAliases
    )

    if (!support.supported) {
      const context = getDocsEntryContext(docsEntry)
      findings.push(
        withDocsException(
          {
            category: 'runtime',
            name: docsEntry.name,
            message: `${docsEntry.name} is documented but not exported by the pinned @navikt/ds-react runtime.`,
          },
          docsEntry.name,
          'docs-noise',
          input.acceptedDocsExceptions,
          context
        )
      )
      continue
    }

    if (support.aliasTarget) {
      const context = {
        ...getDocsEntryContext(docsEntry),
        surface: 'aliases' as const,
        runtimeName: support.aliasTarget,
      }
      findings.push(
        withDocsException(
          {
            category: 'runtime',
            name: docsEntry.name,
            message: `${docsEntry.name} is only runtime-supported through the alias ${support.aliasTarget}.`,
          },
          docsEntry.name,
          'runtime-alias',
          input.acceptedDocsExceptions,
          context
        )
      )
    }
  }

  for (const entry of input.catalogEntries.filter((catalogEntry) => catalogEntry.group !== 'icon')) {
    const support = resolveRuntimeSupport(
      entry.importName,
      runtimeExports,
      input.runtimeAliases,
      input.safeCompatibilityAliases
    )
    const context = getCatalogEntryContext(
      entry,
      support.aliasTarget ?? rootName(entry.importName)
    )
    if (!support.supported) {
      findings.push(
        withCatalogException(
          {
            category: 'runtime',
            name: entry.name,
            message: `${entry.name} expects runtime support through ${entry.importName}, but that export is missing from @navikt/ds-react.`,
          },
          entry.name,
          'runtime-compat',
          input.acceptedCatalogExceptions,
          context
        )
      )
    }
  }

  return findings
}

function buildIconFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  const runtimeIconExports = new Set(input.runtimeIconExports)
  const catalogIconNames = new Set(input.iconCatalogNames)

  for (const runtimeIcon of runtimeIconExports) {
    if (!catalogIconNames.has(runtimeIcon)) {
      findings.push({
        category: 'icons',
        status: 'potential',
        name: runtimeIcon,
        message: `${runtimeIcon} is exported by @navikt/aksel-icons but missing from the Arcade icon catalog.`,
      })
    }
  }

  for (const catalogIcon of catalogIconNames) {
    if (!runtimeIconExports.has(catalogIcon)) {
      findings.push({
        category: 'icons',
        status: 'potential',
        name: catalogIcon,
        message: `${catalogIcon} is cataloged for Arcade but no longer exported by @navikt/aksel-icons.`,
      })
    }
  }

  return findings
}

function comparePropCoverage(
  category: 'generated-docs' | 'authoring',
  componentName: string,
  freshProps: Array<Pick<AkselAutocompleteProp, 'name' | 'type' | 'values'>>,
  currentProps: Array<Pick<AuditCatalogProp, 'name' | 'type' | 'values'>>,
  includeExtras: boolean
): AuditFinding[] {
  const findings: AuditFinding[] = []
  const freshByName = propByName(freshProps)
  const currentByName = propByName(currentProps)

  for (const [propName, freshProp] of freshByName) {
    const currentProp = currentByName.get(propName)
    if (!currentProp) {
      findings.push({
        category,
        status: 'potential',
        name: `${componentName}.${propName}`,
        message: `${componentName} is missing the ${propName} prop in the ${category === 'generated-docs' ? 'generated docs metadata' : 'current authoring prop surface'}.`,
      })
      continue
    }

    if (shouldCompareLiteralValues(freshProp.type) && shouldCompareLiteralValues(currentProp.type)) {
      const missingValues = normalizeValues(freshProp.values).filter(
        (value) => !normalizeValues(currentProp.values).includes(value)
      )
      if (missingValues.length > 0) {
        findings.push({
          category,
          status: 'potential',
          name: `${componentName}.${propName}`,
          message: `${componentName}.${propName} is missing documented values: ${missingValues.join(', ')}.`,
        })
      }
    }
  }

  if (!includeExtras) {
    return findings
  }

  for (const [propName, currentProp] of currentByName) {
    const freshProp = freshByName.get(propName)
    if (!freshProp) {
      findings.push({
        category,
        status: 'potential',
        name: `${componentName}.${propName}`,
        message: `${componentName}.${propName} exists in the generated docs metadata but no longer appears in fresh docs.`,
      })
      continue
    }

    if (shouldCompareLiteralValues(freshProp.type) && shouldCompareLiteralValues(currentProp.type)) {
      const extraValues = normalizeValues(currentProp.values).filter(
        (value) => !normalizeValues(freshProp.values).includes(value)
      )
      if (extraValues.length > 0) {
        findings.push({
          category,
          status: 'potential',
          name: `${componentName}.${propName}`,
          message: `${componentName}.${propName} has stale values in the generated docs metadata: ${extraValues.join(', ')}.`,
        })
      }
    }
  }

  return findings
}

function buildGeneratedDocsFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  const freshByName = byName(input.freshDocsEntries)
  const generatedByName = byName(input.generatedDocsEntries)

  for (const [name, freshEntry] of freshByName) {
    const generatedEntry = generatedByName.get(name)
    if (!generatedEntry) {
      findings.push({
        category: 'generated-docs',
        status: 'potential',
        name,
        message: `${name} appears in fresh docs but is missing from the checked-in generated docs metadata.`,
      })
      continue
    }

    findings.push(...comparePropCoverage('generated-docs', name, freshEntry.props, generatedEntry.props, true))
  }

  for (const name of generatedByName.keys()) {
    if (!freshByName.has(name)) {
      findings.push({
        category: 'generated-docs',
        status: 'potential',
        name,
        message: `${name} still exists in the checked-in generated docs metadata but no longer appears in fresh docs.`,
      })
    }
  }

  return findings
}

function buildAuthoringCoverageFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const docsEntry of input.freshDocsEntries) {
    if (input.hiddenNewAuthoringRoots.includes(rootName(docsEntry.name))) {
      continue
    }

    const currentProps = input.authoringPropsByComponent[docsEntry.name] ?? []
    findings.push(...comparePropCoverage('authoring', docsEntry.name, docsEntry.props, currentProps, false))
  }

  return findings
}

function buildDiscoveryFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []
  const docsByName = byName(input.freshDocsEntries)
  const surfaces = [
    { label: 'Add menu', names: input.addMenuNames },
    { label: 'snippet library', names: input.snippetNames },
    { label: 'autocomplete', names: input.autocompleteNames },
  ]

  for (const surface of surfaces) {
    for (const name of surface.names) {
      const docsEntry = docsByName.get(name)
      const root = rootName(name)

      if (input.hiddenNewAuthoringRoots.includes(root)) {
        findings.push({
          category: 'discovery',
          status: 'potential',
          name,
          message: `${name} is still exposed through ${surface.label} even though ${root} is hidden from new authoring.`,
        })
        continue
      }

      if (docsEntry && !CURRENT_DISCOVERY_STATUSES.has(docsEntry.status)) {
        findings.push({
          category: 'discovery',
          status: 'potential',
          name,
          message: `${name} is still exposed through ${surface.label} even though fresh docs now mark it as ${docsEntry.status}.`,
        })
      }
    }
  }

  return findings
}

function buildMetadataFindings(input: AkselAuditInput): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (const entry of input.catalogEntries.filter((catalogEntry) => catalogEntry.group !== 'icon')) {
    if (!entry.docs.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing a docs reference in the curated catalog.`,
      })
    }

    if (!entry.importName.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing importName metadata in the curated catalog.`,
      })
    }

    if (!entry.importGuidance.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing import guidance in the curated catalog.`,
      })
    }

    if (!entry.description.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing its catalog description.`,
      })
    }

    if (!entry.snippet.code.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing snippet JSX in the curated catalog.`,
      })
    }

    if (!entry.snippet.description.trim()) {
      findings.push({
        category: 'metadata',
        status: 'potential',
        name: entry.name,
        message: `${entry.name} is missing snippet description metadata in the curated catalog.`,
      })
    }
  }

  return findings
}

export function runAkselAudit(input: AkselAuditInput): AkselAuditReport {
  const findings = [
    ...buildVersionFindings(input),
    ...buildCatalogFindings(input),
    ...buildRuntimeFindings(input),
    ...buildIconFindings(input),
    ...buildGeneratedDocsFindings(input),
    ...buildAuthoringCoverageFindings(input),
    ...buildDiscoveryFindings(input),
    ...buildMetadataFindings(input),
  ]

  return {
    targetVersion: input.targetVersion,
    potentialFindings: findings.filter((finding) => finding.status === 'potential'),
    acceptedFindings: findings.filter((finding) => finding.status === 'accepted'),
  }
}

function formatFinding(finding: AuditFinding): string {
  const exceptionSuffix =
    finding.status === 'accepted'
      ? ` (${finding.exceptionId}: ${finding.exceptionReason})`
      : ''

  return `- ${finding.name}: ${finding.message}${exceptionSuffix}`
}

function formatFindingGroup(title: string, findings: AuditFinding[]): string[] {
  if (findings.length === 0) {
    return []
  }

  return [title, ...findings.map(formatFinding), '']
}

export function formatAkselAuditReport(report: AkselAuditReport): string {
  const potentialByCategory = new Map<AuditFinding['category'], AuditFinding[]>()
  const acceptedByCategory = new Map<AuditFinding['category'], AuditFinding[]>()

  for (const finding of report.potentialFindings) {
    potentialByCategory.set(finding.category, [
      ...(potentialByCategory.get(finding.category) ?? []),
      finding,
    ])
  }

  for (const finding of report.acceptedFindings) {
    acceptedByCategory.set(finding.category, [
      ...(acceptedByCategory.get(finding.category) ?? []),
      finding,
    ])
  }

  const lines = [
    `Aksel audit target: ${report.targetVersion}`,
    `Potential findings: ${report.potentialFindings.length}`,
    `Accepted exceptions: ${report.acceptedFindings.length}`,
    '',
  ]

  for (const category of [
    'versions',
    'catalog',
    'runtime',
    'icons',
    'generated-docs',
    'authoring',
    'discovery',
    'metadata',
  ] as const) {
    lines.push(
      ...formatFindingGroup(`Potential ${category} drift`, potentialByCategory.get(category) ?? []),
      ...formatFindingGroup(
        `Accepted ${category} exceptions`,
        acceptedByCategory.get(category) ?? []
      )
    )
  }

  if (report.potentialFindings.length > 0) {
    lines.push(
      'The audit found new or changed potential exceptions. Review the report and ask the user before encoding them as accepted Arcade policy.'
    )
  } else {
    lines.push('No new or changed potential exceptions found.')
  }

  return lines.join('\n').trim()
}

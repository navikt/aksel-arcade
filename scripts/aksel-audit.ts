import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import * as RawAkselComponents from '@navikt/ds-react'
import * as AkselIcons from '@navikt/aksel-icons'
import {
  ACCEPTED_CATALOG_EXCEPTIONS,
  ACCEPTED_DOCS_EXCEPTIONS,
} from '../src/data/akselAuditExceptions.ts'
import {
  filterNewAuthoringEntries,
  isHiddenFromNewAuthoring,
  listHiddenNewAuthoringRoots,
} from '../src/data/akselAuthoringPolicy.ts'
import {
  AKSEL_AUTOCOMPLETE_ENTRIES,
  type AkselAutocompleteProp,
  type AkselAutocompleteEntry,
} from '../src/data/akselAutocompleteData.ts'
import {
  AKSEL_CATALOG,
  AKSEL_CATALOG_VERSION,
  getCatalogComponent,
  isContextualOnlyAutocompleteEntry,
} from '../src/data/akselCatalog.ts'
import { allComponents } from '../src/data/akselComponents.ts'
import { AKSEL_METADATA } from '../src/data/akselMetadata.ts'
import {
  AKSEL_RUNTIME_NAME_ALIASES,
  AKSEL_SAFE_COMPATIBILITY_ALIASES,
} from '../src/data/akselRuntimeCompatibility.ts'
import { AKSEL_SNIPPETS } from '../src/services/componentLibrary.ts'
import { fetchDocsEntries } from './lib/akselDocs'
import { formatAkselAuditReport, runAkselAudit } from './lib/akselAudit'

const COMPONENT_NAME_PATTERN = /^[A-Z][\w.]*$/
const CURRENT_DISCOVERY_STATUSES = new Set(['current', 'experimental'])
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')) as T
}

function getLockfileVersion(
  packageLock: {
    packages?: Record<string, { version?: string }>
    dependencies?: Record<string, { version?: string }>
  },
  packageName: string
): string | undefined {
  return (
    packageLock.packages?.[`node_modules/${packageName}`]?.version ??
    packageLock.dependencies?.[packageName]?.version
  )
}

function dedupeValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b)
  )
}

function mergeCatalogPropValues(
  existingValues: string[] | undefined,
  catalogValues: string[] | undefined,
  valueKind?: string
): string[] {
  if (valueKind === 'spacing-token') {
    return catalogValues ? [...catalogValues] : []
  }

  return dedupeValues([...(existingValues ?? []), ...(catalogValues ?? [])])
}

function buildAuthoringPropsByComponent(
  freshDocsEntries: AkselAutocompleteEntry[]
): Record<string, AkselAutocompleteProp[]> {
  const generatedDocsEntriesByName = new Map(
    AKSEL_AUTOCOMPLETE_ENTRIES.map((entry) => [entry.name, entry] as const)
  )

  return Object.fromEntries(
    freshDocsEntries.map((entry) => {
      if (isHiddenFromNewAuthoring(entry.name)) {
        return [entry.name, []]
      }

      const generatedEntry = generatedDocsEntriesByName.get(entry.name)
      const catalogEntry = getCatalogComponent(entry.name)
      const propsByName = new Map(
        (generatedEntry?.props ?? []).map((prop) => [prop.name, { ...prop }])
      )

      for (const prop of catalogEntry?.props ?? []) {
        const existingProp = propsByName.get(prop.name)
        propsByName.set(prop.name, {
          ...prop,
          ...existingProp,
          required: prop.required ?? existingProp?.required ?? false,
          values: mergeCatalogPropValues(existingProp?.values, prop.values, prop.valueKind),
          description: existingProp?.description || prop.description,
        })
      }

      return [entry.name, Array.from(propsByName.values())]
    })
  )
}

function listTopLevelAutocompleteNames(): string[] {
  const catalogEntries = AKSEL_CATALOG.filter(
    (entry) =>
      entry.group !== 'icon' && CURRENT_DISCOVERY_STATUSES.has(entry.status)
  )
  const catalogEntryNames = new Set(catalogEntries.map((entry) => entry.name))
  const catalogImportNames = new Set(catalogEntries.map((entry) => entry.importName))
  const fallbackDocsEntries = filterNewAuthoringEntries(
    AKSEL_AUTOCOMPLETE_ENTRIES.filter(
      (entry) => !catalogEntryNames.has(entry.name) && !catalogImportNames.has(entry.name)
    )
  )

  return [
    ...filterNewAuthoringEntries(catalogEntries),
    ...fallbackDocsEntries,
  ]
    .filter((entry) => {
      if (isContextualOnlyAutocompleteEntry(entry.name)) {
        return false
      }

      if ('importName' in entry) {
        return [entry.name, entry.importName, entry.name.replace(/\s+/g, '')].some((alias) =>
          COMPONENT_NAME_PATTERN.test(alias)
        )
      }

      return COMPONENT_NAME_PATTERN.test(entry.name) && !entry.name.includes('.')
    })
    .map((entry) => entry.name)
}

function isCatalogCoverageCandidate(entry: AkselAutocompleteEntry): boolean {
  return (
    CURRENT_DISCOVERY_STATUSES.has(entry.status) &&
    (COMPONENT_NAME_PATTERN.test(entry.name) || AKSEL_CATALOG.some((catalogEntry) => catalogEntry.name === entry.name)) &&
    (!entry.name.includes('.') || AKSEL_CATALOG.some((catalogEntry) => catalogEntry.name === entry.name))
  )
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      target: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: false,
  })

  const targetVersion = values.target
  if (!targetVersion) {
    throw new Error('Missing required --target <version> argument.')
  }

  const packageJson = readJson<{
    dependencies?: Record<string, string>
  }>('package.json')
  const packageLock = readJson<{
    packages?: Record<string, { version?: string }>
    dependencies?: Record<string, { version?: string }>
  }>('package-lock.json')
  const freshDocsEntries = await fetchDocsEntries()
  const docsCoverageEntries = freshDocsEntries.filter(
    (entry) => isCatalogCoverageCandidate(entry) && !isContextualOnlyAutocompleteEntry(entry.name)
  )

  const report = runAkselAudit({
    targetVersion,
    packageJsonVersions: {
      '@navikt/ds-react': packageJson.dependencies?.['@navikt/ds-react'],
      '@navikt/ds-css': packageJson.dependencies?.['@navikt/ds-css'],
      '@navikt/aksel-icons': packageJson.dependencies?.['@navikt/aksel-icons'],
    },
    lockfileVersions: {
      '@navikt/ds-react': getLockfileVersion(packageLock, '@navikt/ds-react'),
      '@navikt/ds-css': getLockfileVersion(packageLock, '@navikt/ds-css'),
      '@navikt/aksel-icons': getLockfileVersion(packageLock, '@navikt/aksel-icons'),
    },
    metadataVersions: {
      '@navikt/ds-react': AKSEL_METADATA.packageVersions['@navikt/ds-react'],
      '@navikt/ds-css': AKSEL_METADATA.packageVersions['@navikt/ds-css'],
      '@navikt/aksel-icons': AKSEL_METADATA.packageVersions['@navikt/aksel-icons'],
    },
    catalogVersion: AKSEL_CATALOG_VERSION,
    runtimeAliases: AKSEL_RUNTIME_NAME_ALIASES,
    safeCompatibilityAliases: AKSEL_SAFE_COMPATIBILITY_ALIASES,
    runtimeComponentExports: Object.keys(RawAkselComponents),
    runtimeIconExports: Object.keys(AkselIcons).filter((name) => name.endsWith('Icon')),
    freshDocsEntries,
    docsCoverageEntries,
    generatedDocsEntries: AKSEL_AUTOCOMPLETE_ENTRIES,
    catalogEntries: AKSEL_CATALOG,
    addMenuNames: allComponents.map((component) => component.name),
    snippetNames: AKSEL_SNIPPETS.map((snippet) => snippet.name),
    autocompleteNames: listTopLevelAutocompleteNames(),
    iconCatalogNames: AKSEL_CATALOG.filter((entry) => entry.group === 'icon').map(
      (entry) => entry.name
    ),
    hiddenNewAuthoringRoots: listHiddenNewAuthoringRoots(),
    authoringPropsByComponent: buildAuthoringPropsByComponent(freshDocsEntries),
    acceptedDocsExceptions: ACCEPTED_DOCS_EXCEPTIONS,
    acceptedCatalogExceptions: ACCEPTED_CATALOG_EXCEPTIONS,
  })

  const installCommand =
    `npm install --save-exact ` +
    `@navikt/ds-react@${targetVersion} @navikt/ds-css@${targetVersion} @navikt/aksel-icons@${targetVersion}`

  process.stdout.write(
    [
      `Suggested package update command: ${installCommand}`,
      '',
      formatAkselAuditReport(report),
      '',
    ].join('\n')
  )

  if (report.potentialFindings.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})

export type AkselAuditExceptionMatchKind =
  | 'catalog-coverage'
  | 'catalog-stale'
  | 'runtime-alias'
  | 'runtime-compat'
  | 'docs-noise'

export type AkselAuditExceptionSurface =
  | 'components'
  | 'primitives'
  | 'icons'
  | 'props'
  | 'prop-values'
  | 'snippets'
  | 'aliases'
  | 'replacement-policy'

interface AkselAuditExceptionBase {
  id: string
  reason: string
  affects: AkselAuditExceptionSurface[]
  matchKinds: AkselAuditExceptionMatchKind[]
}

export interface AcceptedDocsException extends AkselAuditExceptionBase {
  docsName: string
  itemType: 'component' | 'primitive' | 'icon'
  runtimeName?: string
}

export interface AcceptedCatalogException extends AkselAuditExceptionBase {
  catalogEntryName: string
  itemType: 'component' | 'primitive' | 'icon'
  docsName?: string
  runtimeName?: string
}

export const ACCEPTED_DOCS_EXCEPTIONS: AcceptedDocsException[] = [
  {
    id: 'combobox-runtime-alias',
    docsName: 'Combobox',
    itemType: 'component',
    runtimeName: 'UNSAFE_Combobox',
    affects: ['components', 'aliases'],
    matchKinds: ['runtime-alias'],
    reason:
      'Arcade authors with the public Combobox name, but the pinned runtime still exports UNSAFE_Combobox and the sandbox maps the public name internally.',
  },
  {
    id: 'navpoleonskake-docs-noise',
    docsName: 'Navpoleonskake',
    itemType: 'component',
    affects: ['components'],
    matchKinds: ['catalog-coverage', 'docs-noise'],
    reason:
      'Navpoleonskake is treated as a docs-only artifact and is not part of the curated Arcade authoring surface.',
  },
  {
    id: 'modal-replacement-policy',
    docsName: 'Modal',
    itemType: 'component',
    affects: ['components', 'replacement-policy'],
    matchKinds: ['catalog-coverage'],
    reason:
      'Modal is intentionally excluded from new Arcade authoring because Dialog is the supported replacement, even though older hand-written Modal code can still render.',
  },
]

export const ACCEPTED_CATALOG_EXCEPTIONS: AcceptedCatalogException[] = [
  {
    id: 'alert-legacy-compatibility',
    catalogEntryName: 'Alert',
    itemType: 'component',
    docsName: 'Alert',
    runtimeName: 'Alert',
    affects: ['components', 'snippets', 'replacement-policy'],
    matchKinds: ['catalog-stale'],
    reason:
      'Alert stays cataloged as a legacy compatibility surface for older Arcade projects even though new authoring must stay on InlineMessage, LocalAlert, or GlobalAlert.',
  },
  {
    id: 'boxnew-safe-alias',
    catalogEntryName: 'BoxNew',
    itemType: 'primitive',
    docsName: 'Box',
    runtimeName: 'Box',
    affects: ['primitives', 'aliases'],
    matchKinds: ['catalog-stale', 'runtime-compat'],
    reason:
      'BoxNew remains as a legacy compatibility entry while the sandbox safely aliases it to the current Box runtime export.',
  },
  {
    id: 'stack-legacy-guidance',
    catalogEntryName: 'Stack',
    itemType: 'primitive',
    affects: ['primitives', 'snippets'],
    matchKinds: ['catalog-stale', 'runtime-compat'],
    reason:
      'Stack remains cataloged only as a legacy guidance placeholder; new authoring must use HStack or VStack instead of a runtime alias.',
  },
  {
    id: 'grid-legacy-guidance',
    catalogEntryName: 'Grid',
    itemType: 'primitive',
    affects: ['primitives', 'snippets'],
    matchKinds: ['catalog-stale', 'runtime-compat'],
    reason:
      'Grid remains cataloged only as a legacy guidance placeholder; new authoring must use HGrid instead of a runtime alias.',
  },
]

export function getAcceptedDocsException(
  docsName: string
): AcceptedDocsException | undefined {
  return ACCEPTED_DOCS_EXCEPTIONS.find((entry) => entry.docsName === docsName)
}

export function getAcceptedCatalogException(
  catalogEntryName: string
): AcceptedCatalogException | undefined {
  return ACCEPTED_CATALOG_EXCEPTIONS.find((entry) => entry.catalogEntryName === catalogEntryName)
}

import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import {
  getCatalogComponent,
  listCatalogEntries,
  type AkselCatalogEntry,
  type AkselCatalogProp,
} from '@/data/akselCatalog'
import {
  AKSEL_AUTOCOMPLETE_ENTRIES,
  AKSEL_ICON_PROPS,
  type AkselAutocompleteEntry,
  type AkselAutocompleteProp,
} from '@/data/akselAutocompleteData'

const COMPONENT_NAME_PATTERN = /^[A-Z][\w.]*$/
const TAG_NAME_VALID_FOR = /^[\w.]*$/
const PROP_NAME_VALID_FOR = /^[\w-]*$/
const PROP_VALUE_VALID_FOR = /^[\w\s./%-]*$/

type CompletionEntry =
  | (AkselAutocompleteEntry & { source: 'docs' })
  | (AkselCatalogEntry & { source: 'catalog' })

type CompletionProp = (AkselAutocompleteProp | AkselCatalogProp) & {
  values?: string[]
}

const catalogEntries = listCatalogEntries({
  groups: ['layout', 'component', 'icon'],
  statuses: ['current', 'experimental'],
})
const catalogEntriesByName = new Map(catalogEntries.map((entry) => [entry.name, entry]))
const docsEntries = AKSEL_AUTOCOMPLETE_ENTRIES.map((entry) => ({
  ...entry,
  source: 'docs' as const,
}))
const comboboxAliasEntry = docsEntries.find((entry) => entry.name === 'Combobox')
const docsAliasEntries = comboboxAliasEntry
  ? [{ ...comboboxAliasEntry, name: 'UNSAFE_Combobox' }]
  : []
const iconEntries = catalogEntries
  .filter((entry) => entry.group === 'icon')
  .map((entry) => ({ ...entry, source: 'catalog' as const }))
const docsEntryNames = new Set([...docsEntries, ...docsAliasEntries].map((entry) => entry.name))
const extraCatalogEntries = catalogEntries
  .filter((entry) => entry.group !== 'icon' && !docsEntryNames.has(entry.name))
  .map((entry) => ({ ...entry, source: 'catalog' as const }))
const completionEntries: CompletionEntry[] = [
  ...docsEntries,
  ...docsAliasEntries,
  ...extraCatalogEntries,
  ...iconEntries,
]
const docsEntriesByName = new Map(docsEntries.map((entry) => [entry.name, entry]))

interface OpenTagContext {
  tagStart: number
  fragment: string
  componentName?: string
}

function stripSnippetPlaceholders(template: string): string {
  return template.replace(
    /\$\{(\d+):([^}]+)\}/g,
    (_match, _num, placeholder: string) => placeholder
  )
}

function getOpenTagContext(source: string, pos: number): OpenTagContext | null {
  const beforeCursor = source.slice(0, pos)
  const tagStart = beforeCursor.lastIndexOf('<')
  const lastTagEnd = beforeCursor.lastIndexOf('>')

  if (tagStart === -1 || tagStart <= lastTagEnd) {
    return null
  }

  const fragment = beforeCursor.slice(tagStart)

  if (fragment.startsWith('</') || fragment.startsWith('<!')) {
    return null
  }

  const componentMatch = fragment.match(/^<([A-Z][\w.]*)/)

  return {
    tagStart,
    fragment,
    componentName: componentMatch?.[1],
  }
}

function isInsideQuotedValue(text: string): boolean {
  let quote: '"' | "'" | null = null
  let isEscaped = false

  for (const char of text) {
    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (char === '\\') {
      isEscaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
    }
  }

  return quote !== null
}

function getPropValueContext(openTag: OpenTagContext): {
  componentName: string
  propName: string
  partialValue: string
} | null {
  const componentName = openTag.componentName
  if (!componentName) {
    return null
  }

  const propValueMatch = openTag.fragment.match(/(?:^|\s)([\w-]+)\s*=\s*(["'])([^"']*)$/)
  if (!propValueMatch) {
    return null
  }

  return {
    componentName,
    propName: propValueMatch[1],
    partialValue: propValueMatch[3],
  }
}

function getPropNameContext(openTag: OpenTagContext): {
  componentName: string
  partialProp: string
} | null {
  const componentName = openTag.componentName
  if (!componentName) {
    return null
  }

  const rest = openTag.fragment.slice(componentName.length + 1)
  if (!rest || isInsideQuotedValue(rest)) {
    return null
  }

  const propNameMatch = rest.match(/(?:^|\s)([\w-]*)$/)
  if (!propNameMatch) {
    return null
  }

  return {
    componentName,
    partialProp: propNameMatch[1],
  }
}

function getTagNameContext(openTag: OpenTagContext): {
  query: string
  from: number
} | null {
  const tagText = openTag.fragment.slice(1)
  if (/\s/.test(tagText)) {
    return null
  }

  if (tagText.length > 0 && !COMPONENT_NAME_PATTERN.test(tagText)) {
    return null
  }

  return {
    query: tagText,
    from: openTag.tagStart + 1,
  }
}

function matchesPartial(value: string, partial: string): boolean {
  return value.toLowerCase().startsWith(partial.toLowerCase())
}

function dedupeValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (a, b) => a.localeCompare(b)
  )
}

function normalizeComponentName(componentName: string): string {
  if (componentName === 'UNSAFE_Combobox') {
    return 'Combobox'
  }

  return componentName
}

function isIconComponent(componentName: string): boolean {
  return catalogEntriesByName.get(componentName)?.group === 'icon'
}

function getComponentProps(componentName: string): CompletionProp[] {
  const normalizedComponentName = normalizeComponentName(componentName)
  if (isIconComponent(normalizedComponentName)) {
    return AKSEL_ICON_PROPS
  }

  const docsEntry = docsEntriesByName.get(normalizedComponentName)
  const catalogEntry = getCatalogComponent(normalizedComponentName)
  const propsByName = new Map<string, CompletionProp>()

  for (const prop of docsEntry?.props ?? []) {
    propsByName.set(prop.name, prop)
  }

  for (const prop of catalogEntry?.props ?? []) {
    const existingProp = propsByName.get(prop.name)
    propsByName.set(prop.name, {
      ...prop,
      ...existingProp,
      values: dedupeValues([...(existingProp?.values ?? []), ...(prop.values ?? [])]),
      description: existingProp?.description || prop.description,
    })
  }

  return Array.from(propsByName.values())
}

function getPropDefinition(componentName: string, propName: string): CompletionProp | undefined {
  return getComponentProps(componentName).find((prop) => prop.name === propName)
}

function getEntryDescription(entry: CompletionEntry): string {
  if (entry.source === 'catalog') {
    return entry.description
  }

  if (entry.group === 'legacy') {
    return 'Documented legacy Aksel component.'
  }

  if (entry.group === 'primitive') {
    return 'Documented Aksel layout primitive.'
  }

  return 'Documented Aksel component.'
}

function getEntryApply(entry: CompletionEntry): string {
  const catalogEntry = catalogEntriesByName.get(entry.name)
  let apply = catalogEntry ? stripSnippetPlaceholders(catalogEntry.snippet.code) : entry.name
  if (apply.startsWith('<')) {
    apply = apply.slice(1)
  }

  if (entry.name === 'Combobox') {
    return apply === 'Combobox' ? 'UNSAFE_Combobox' : apply.replace(/^Combobox/, 'UNSAFE_Combobox')
  }

  return apply
}

function componentOption(entry: CompletionEntry): Completion {
  return {
    label: entry.name,
    type: entry.name.includes('.')
      ? 'namespace'
      : entry.source === 'catalog' && entry.group === 'icon'
        ? 'function'
        : 'class',
    detail: getEntryDescription(entry),
    apply: getEntryApply(entry),
  }
}

function propOption(componentName: string, prop: CompletionProp): Completion {
  const hasValues = Boolean(prop.values?.length)

  return {
    label: prop.name,
    type: 'property',
    detail: prop.description || `${componentName} prop`,
    apply: hasValues ? `${prop.name}=""` : prop.name,
    boost: prop.required ? 10 : 0,
  }
}

function valueOption(prop: CompletionProp, value: string): Completion {
  return {
    label: value,
    type: 'value',
    detail: prop.description || `${prop.name} value`,
    apply: value,
  }
}

export function getAkselCompletionForSource(source: string, pos: number): CompletionResult | null {
  const openTag = getOpenTagContext(source, pos)
  if (!openTag) {
    return null
  }

  const propValueContext = getPropValueContext(openTag)
  if (propValueContext) {
    const { componentName, propName, partialValue } = propValueContext
    const prop = getPropDefinition(componentName, propName)
    const options =
      prop?.values
        ?.filter((value) => matchesPartial(value, partialValue))
        .map((value) => valueOption(prop, value)) ?? []

    if (options.length > 0) {
      return {
        from: pos - partialValue.length,
        options,
        filter: false,
        validFor: PROP_VALUE_VALID_FOR,
      }
    }
  }

  const propNameContext = getPropNameContext(openTag)
  if (propNameContext) {
    const { componentName, partialProp } = propNameContext
    const options = getComponentProps(componentName)
      .filter((prop) => matchesPartial(prop.name, partialProp))
      .map((prop) => propOption(componentName, prop))

    if (options.length > 0) {
      return {
        from: pos - partialProp.length,
        options,
        validFor: PROP_NAME_VALID_FOR,
      }
    }
  }

  const tagNameContext = getTagNameContext(openTag)
  if (tagNameContext) {
    const options = completionEntries
      .filter((entry) => matchesPartial(entry.name, tagNameContext.query))
      .map(componentOption)

    if (options.length > 0) {
      return {
        from: tagNameContext.from,
        options,
        validFor: TAG_NAME_VALID_FOR,
      }
    }
  }

  return null
}

export function getAkselCompletionForContext(context: CompletionContext): CompletionResult | null {
  return getAkselCompletionForSource(context.state.doc.toString(), context.pos)
}

export function isAkselPropValueCompletionContext(source: string, pos: number): boolean {
  const openTag = getOpenTagContext(source, pos)
  if (!openTag) {
    return false
  }

  const propValueContext = getPropValueContext(openTag)
  if (!propValueContext) {
    return false
  }

  return Boolean(
    getPropDefinition(propValueContext.componentName, propValueContext.propName)?.values?.length
  )
}

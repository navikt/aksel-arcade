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
import type { ArcadePage } from '@/types/project'

const COMPONENT_NAME_PATTERN = /^[A-Z][\w.]*$/
const TAG_NAME_PATTERN = /^[A-Za-z][\w.]*$/
const TAG_NAME_VALID_FOR = /^[\w.]*$/
const PROP_NAME_VALID_FOR = /^[\w-]*$/

type CompletionEntry =
  | (AkselAutocompleteEntry & { source: 'docs' })
  | (AkselCatalogEntry & { source: 'catalog' })

type CompletionProp = (AkselAutocompleteProp | AkselCatalogProp) & {
  values?: string[]
  valueKind?: AkselCatalogProp['valueKind']
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
]
const docsEntriesByName = new Map(docsEntries.map((entry) => [entry.name, entry]))

interface OpenTagContext {
  tagStart: number
  fragment: string
  componentName?: string
}

export type PageNavigationCompletionTarget = Pick<ArcadePage, 'id' | 'name'>

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

function getPageNavigationContext(source: string, pos: number): {
  partialValue: string
} | null {
  const beforeCursor = source.slice(0, pos)
  const goToPageMatch = beforeCursor.match(/\bgoToPage\s*\(\s*(["'`])([^"'`]*)$/)
  if (goToPageMatch) {
    return {
      partialValue: goToPageMatch[2],
    }
  }

  const openTag = getOpenTagContext(source, pos)
  if (!openTag) {
    return null
  }

  const propValueMatch = openTag.fragment.match(
    /(?:^|\s)(href|to)\s*=\s*(?:(["'])([^"']*)$|\{\s*(["'`])([^"'`]*)$)/
  )
  if (!propValueMatch) {
    return null
  }

  return {
    partialValue: propValueMatch[3] ?? propValueMatch[5] ?? '',
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

function getPropExpressionValueContext(openTag: OpenTagContext): {
  componentName: string
  propName: string
  partialValue: string
} | null {
  const componentName = openTag.componentName
  if (!componentName) {
    return null
  }

  const propExpressionMatch = openTag.fragment.match(
    /(?:^|\s)([\w-]+)\s*=\s*\{\s*([A-Z][\w.]*)?$/
  )
  if (!propExpressionMatch) {
    return null
  }

  return {
    componentName,
    propName: propExpressionMatch[1],
    partialValue: propExpressionMatch[2] ?? '',
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

  if (tagText.length > 0 && !TAG_NAME_PATTERN.test(tagText)) {
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

function matchesCaseSensitivePrefix(value: string, partial: string): boolean {
  return value.startsWith(partial)
}

function hasComponentPrefix(query: string): boolean {
  return completionEntries.some((entry) => matchesCaseSensitivePrefix(entry.name, query))
}

function componentTagValidFor(text: string): boolean {
  return TAG_NAME_VALID_FOR.test(text) && (text === '' || hasComponentPrefix(text))
}

function iconTagValidFor(text: string): boolean {
  return (
    TAG_NAME_VALID_FOR.test(text) &&
    isIconLikeTagQuery(text, hasComponentPrefix(text)) &&
    iconEntries.some((entry) => matchesPartial(entry.name, text))
  )
}

function dedupeValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (a, b) => a.localeCompare(b)
  )
}

function mergeCatalogPropValues(
  existingProp: CompletionProp | undefined,
  catalogProp: AkselCatalogProp
): string[] {
  if (catalogProp.valueKind === 'spacing-token') {
    return catalogProp.values ? [...catalogProp.values] : []
  }

  return dedupeValues([...(existingProp?.values ?? []), ...(catalogProp.values ?? [])])
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

function isIconProp(componentName: string, propName: string): boolean {
  const normalizedPropName = propName.toLowerCase()
  if (normalizedPropName === 'icon' || normalizedPropName.endsWith('icon')) {
    return true
  }

  const prop = getPropDefinition(componentName, propName)
  return Boolean(
    prop &&
      prop.type.toLowerCase().includes('reactnode') &&
      prop.description.toLowerCase().includes('icon')
  )
}

function isInsideIconPropExpression(source: string, tagStart: number): boolean {
  const beforeTag = source.slice(0, tagStart)
  const propExpressionMatch = beforeTag.match(/(?:^|\s)([\w-]+)\s*=\s*\{\s*$/)
  return Boolean(propExpressionMatch && isIconProp('', propExpressionMatch[1]))
}

function isIconLikeTagQuery(query: string, hasComponentMatches: boolean): boolean {
  if (!query) {
    return false
  }

  const normalizedQuery = query.toLowerCase()
  if (normalizedQuery.includes('icon')) {
    return true
  }

  if (query.length < 3) {
    return false
  }

  return (
    !hasComponentMatches &&
    iconEntries.some((entry) => entry.name.toLowerCase().startsWith(normalizedQuery))
  )
}

function compareIconEntries(
  first: AkselCatalogEntry & { source: 'catalog' },
  second: AkselCatalogEntry & { source: 'catalog' }
): number {
  const firstBaseName = first.name.replace(/FillIcon$/, 'Icon')
  const secondBaseName = second.name.replace(/FillIcon$/, 'Icon')
  const baseNameComparison = firstBaseName.localeCompare(secondBaseName)
  if (baseNameComparison !== 0) {
    return baseNameComparison
  }

  const firstIsFill = first.name.endsWith('FillIcon')
  const secondIsFill = second.name.endsWith('FillIcon')
  if (firstIsFill !== secondIsFill) {
    return firstIsFill ? 1 : -1
  }

  return first.name.localeCompare(second.name)
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
      values: mergeCatalogPropValues(existingProp, prop),
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

function accessibleIconSnippet(iconName: string): string {
  return `<${iconName} title="a11y-title" fontSize="1.5rem" />`
}

function iconComponentOption(
  entry: AkselCatalogEntry & { source: 'catalog' },
  context: 'tag' | 'icon-prop-tag' | 'icon-prop-expression'
): Completion {
  const option = componentOption(entry)
  const snippet = accessibleIconSnippet(entry.name)
  const boost = entry.name.endsWith('FillIcon') ? 0 : 5

  if (context === 'tag') {
    return {
      ...option,
      boost,
      apply: snippet.slice(1),
    }
  }

  if (context === 'icon-prop-tag') {
    return {
      ...option,
      boost,
      apply: `${snippet.slice(1)}}`,
    }
  }

  if (context === 'icon-prop-expression') {
    return {
      ...option,
      boost,
      apply: `${snippet}}`,
    }
  }

  return option
}

function iconComponentOptions(
  query: string,
  context: 'tag' | 'icon-prop-tag' | 'icon-prop-expression'
): Completion[] {
  return iconEntries
    .filter((entry) => matchesPartial(entry.name, query))
    .sort(compareIconEntries)
    .map((entry) => iconComponentOption(entry, context))
}

const BOOLEAN_PROP_VALUES = new Set(['true', 'false'])

function isBooleanLikeProp(prop: CompletionProp): boolean {
  const hasNonBooleanValues = prop.values?.some((value) => !BOOLEAN_PROP_VALUES.has(value)) ?? false

  return !hasNonBooleanValues && /\bboolean(?:ish)?\b/i.test(prop.type.replace(/`/g, ''))
}

function propOption(componentName: string, prop: CompletionProp): Completion {
  const hasValues = Boolean(prop.values?.length)
  const shouldApplyBareProp = !hasValues || isBooleanLikeProp(prop)

  return {
    label: prop.name,
    type: 'property',
    detail: prop.description || `${componentName} prop`,
    apply: shouldApplyBareProp ? prop.name : `${prop.name}=""`,
    boost: prop.required ? 10 : 0,
  }
}

function isBackgroundTokenProp(prop: CompletionProp): boolean {
  return prop.valueKind === 'background-token'
}

function backgroundTokenName(value: string): string {
  return `bg-${value}`
}

function matchesPropValue(prop: CompletionProp, value: string, partialValue: string): boolean {
  return (
    matchesPartial(value, partialValue) ||
    (isBackgroundTokenProp(prop) && matchesPartial(backgroundTokenName(value), partialValue))
  )
}

function valueOption(prop: CompletionProp, value: string, label = value, boost = 0): Completion {
  return {
    label,
    type: 'value',
    detail: prop.description || `${prop.name} value`,
    apply: value,
    boost,
  }
}

function valueOptions(prop: CompletionProp, partialValue: string): Completion[] {
  return (
    prop.values
      ?.map((value, index, values) => ({ value, index, values }))
      .filter(({ value }) => matchesPropValue(prop, value, partialValue))
      .map(({ value, index, values }) => {
        const boost = values.length - index
        if (isBackgroundTokenProp(prop) && partialValue.toLowerCase().startsWith('bg-')) {
          return valueOption(prop, value, backgroundTokenName(value), boost)
        }

        return valueOption(prop, value, value, boost)
      }) ?? []
  )
}

function pageNavigationMatches(
  target: PageNavigationCompletionTarget,
  partialValue: string
): boolean {
  if (!partialValue) {
    return true
  }

  return (
    matchesPartial(target.name, partialValue) ||
    matchesPartial(target.id, partialValue)
  )
}

function pageNavigationOption(target: PageNavigationCompletionTarget): Completion {
  return {
    label: target.name,
    detail: target.id,
    type: 'constant',
    apply: target.id,
  }
}

function pageNavigationOptions(
  targets: readonly PageNavigationCompletionTarget[],
  partialValue: string
): Completion[] {
  return targets
    .filter((target) => pageNavigationMatches(target, partialValue))
    .map(pageNavigationOption)
}

export function getAkselCompletionForSource(
  source: string,
  pos: number,
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[]
): CompletionResult | null {
  const pageNavigationContext = getPageNavigationContext(source, pos)
  if (pageNavigationContext && pageNavigationTargets && pageNavigationTargets.length > 0) {
    const options = pageNavigationOptions(pageNavigationTargets, pageNavigationContext.partialValue)

    if (options.length > 0) {
      return {
        from: pos - pageNavigationContext.partialValue.length,
        options,
        filter: false,
      }
    }
  }

  const openTag = getOpenTagContext(source, pos)
  if (!openTag) {
    return null
  }

  const propValueContext = getPropValueContext(openTag)
  if (propValueContext) {
    const { componentName, propName, partialValue } = propValueContext
    const prop = getPropDefinition(componentName, propName)
    const options = prop ? valueOptions(prop, partialValue) : []

    if (options.length > 0) {
      return {
        from: pos - partialValue.length,
        options,
      }
    }
  }

  const propExpressionValueContext = getPropExpressionValueContext(openTag)
  if (
    propExpressionValueContext &&
    isIconProp(propExpressionValueContext.componentName, propExpressionValueContext.propName)
  ) {
    const { partialValue } = propExpressionValueContext
    const options = iconComponentOptions(partialValue, 'icon-prop-expression')

    if (options.length > 0) {
      return {
        from: pos - partialValue.length,
        options,
        validFor: TAG_NAME_VALID_FOR,
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
    const isIconPropTagContext = isInsideIconPropExpression(source, openTag.tagStart)
    const shouldSuggestComponents =
      tagNameContext.query === '' || COMPONENT_NAME_PATTERN.test(tagNameContext.query)
    const componentOptions = isIconPropTagContext || !shouldSuggestComponents
      ? []
      : completionEntries
          .filter((entry) => matchesPartial(entry.name, tagNameContext.query))
          .map(componentOption)
    const iconOptions =
      isIconPropTagContext || isIconLikeTagQuery(tagNameContext.query, componentOptions.length > 0)
        ? iconComponentOptions(tagNameContext.query, isIconPropTagContext ? 'icon-prop-tag' : 'tag')
        : []
    const options = [...componentOptions, ...iconOptions]

    if (options.length > 0) {
      const validFor =
        iconOptions.length > 0 && componentOptions.length === 0
          ? iconTagValidFor
          : componentTagValidFor

      return {
        from: tagNameContext.from,
        options,
        validFor,
      }
    }
  }

  return null
}

export function getAkselCompletionForContext(
  context: CompletionContext,
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[]
): CompletionResult | null {
  return getAkselCompletionForSource(context.state.doc.toString(), context.pos, pageNavigationTargets)
}

export function isAkselPropValueCompletionContext(
  source: string,
  pos: number,
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[]
): boolean {
  if (pageNavigationTargets && pageNavigationTargets.length > 0 && getPageNavigationContext(source, pos)) {
    return true
  }

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

import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { filterNewAuthoringEntries, isHiddenFromNewAuthoring } from '@/data/akselAuthoringPolicy'
import {
  getCatalogComponent,
  getContextualAutocompleteRule,
  isContextualOnlyAutocompleteEntry,
  listCatalogEntries,
  resolveContextualAutocompleteEntryName,
  type AkselCatalogEntry,
  type AkselCatalogProp,
} from '@/data/akselCatalog'
import {
  AKSEL_AUTOCOMPLETE_ENTRIES,
  AKSEL_ICON_PROPS,
  type AkselAutocompleteEntry,
  type AkselAutocompleteProp,
} from '@/data/akselAutocompleteData'
import { insertionNeedsEditorApply } from '@/services/componentInsertion'
import type { ArcadePage } from '@/types/project'
import type { ComponentInsertion } from '@/types/snippets'

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
const catalogCompletionEntries = catalogEntries
  .filter((entry) => entry.group !== 'icon')
  .map((entry) => ({ ...entry, source: 'catalog' as const }))
const catalogEntryNames = new Set(catalogCompletionEntries.map((entry) => entry.name))
const catalogImportNames = new Set(catalogCompletionEntries.map((entry) => entry.importName))
const docsEntries = AKSEL_AUTOCOMPLETE_ENTRIES.map((entry) => ({
  ...entry,
  source: 'docs' as const,
}))
const iconEntries = catalogEntries
  .filter((entry) => entry.group === 'icon')
  .map((entry) => ({ ...entry, source: 'catalog' as const }))
const fallbackDocsEntries = filterNewAuthoringEntries(
  docsEntries.filter(
    (entry) => !catalogEntryNames.has(entry.name) && !catalogImportNames.has(entry.name)
  )
)
const allCompletionEntries: CompletionEntry[] = [
  ...filterNewAuthoringEntries(catalogCompletionEntries),
  ...fallbackDocsEntries,
]
const topLevelCompletionEntries = allCompletionEntries.filter((entry) => {
  if (isContextualOnlyAutocompleteEntry(entry.name)) {
    return false
  }

  if (entry.source === 'catalog') {
    return getCompletionAliases(entry).some((alias) => COMPONENT_NAME_PATTERN.test(alias))
  }

  return COMPONENT_NAME_PATTERN.test(entry.name) && !entry.name.includes('.')
})
const completionEntriesByName = new Map(allCompletionEntries.map((entry) => [entry.name, entry]))
const docsEntriesByName = new Map(docsEntries.map((entry) => [entry.name, entry]))

interface OpenTagContext {
  tagStart: number
  fragment: string
  componentName?: string
}

export type PageNavigationCompletionTarget = Pick<ArcadePage, 'id' | 'name'>

export interface ApplyCatalogInsertionArgs {
  insertion: ComponentInsertion
  from: number
  to: number
}

export type ApplyCatalogInsertion = (args: ApplyCatalogInsertionArgs) => void

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

function getPageNavigationContext(
  source: string,
  pos: number
): {
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

  const propExpressionMatch = openTag.fragment.match(/(?:^|\s)([\w-]+)\s*=\s*\{\s*([A-Z][\w.]*)?$/)
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

function getCompletionAliases(entry: CompletionEntry): string[] {
  if (entry.source !== 'catalog') {
    return [entry.name]
  }

  return Array.from(
    new Set(
      [
        entry.name,
        entry.importName,
        entry.name.includes(' ') ? entry.name.replace(/\s+/g, '') : undefined,
      ].filter((alias): alias is string => Boolean(alias))
    )
  )
}

function matchesCompletionEntry(entry: CompletionEntry, partial: string): boolean {
  return getCompletionAliases(entry).some((alias) => matchesPartial(alias, partial))
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

function isTagNameStart(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z]/.test(char))
}

function isLikelyJsxTagStart(source: string, index: number): boolean {
  const next = source[index + 1]
  return next === '/' || next === '>' || isTagNameStart(next)
}

function skipQuotedText(source: string, start: number, quote: '"' | "'" | '`'): number {
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]
    if (char === '\\') {
      index += 1
      continue
    }

    if (quote === '`' && char === '$' && source[index + 1] === '{') {
      index = skipBraceExpression(source, index + 2) - 1
      continue
    }

    if (char === quote) {
      return index + 1
    }
  }

  return source.length
}

function skipBalancedComment(source: string, start: number): number {
  if (source[start + 1] === '/') {
    for (let index = start + 2; index < source.length; index += 1) {
      if (source[index] === '\n') {
        return index
      }
    }
    return source.length
  }

  for (let index = start + 2; index < source.length; index += 1) {
    if (source[index] === '*' && source[index + 1] === '/') {
      return index + 2
    }
  }

  return source.length
}

interface JsxTagToken {
  name?: string
  closing: boolean
  selfClosing: boolean
  end: number
}

function readJsxTagToken(source: string, start: number): JsxTagToken | null {
  if (source[start] !== '<' || !isLikelyJsxTagStart(source, start)) {
    return null
  }

  let index = start + 1
  let closing = false

  if (source[index] === '/') {
    closing = true
    index += 1
  }

  if (source[index] === '>') {
    return {
      closing,
      selfClosing: false,
      end: index + 1,
    }
  }

  const nameStart = index
  while (index < source.length && /[\w.:-]/.test(source[index])) {
    index += 1
  }

  if (index === nameStart) {
    return null
  }

  const name = source.slice(nameStart, index)
  let selfClosing = false

  while (index < source.length) {
    const char = source[index]

    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedText(source, index, char as '"' | "'" | '`')
      continue
    }

    if (char === '{') {
      index = skipBraceExpression(source, index + 1)
      continue
    }

    if (char === '/' && source[index + 1] === '>') {
      selfClosing = true
      return {
        name,
        closing,
        selfClosing,
        end: index + 2,
      }
    }

    if (char === '>') {
      return {
        name,
        closing,
        selfClosing,
        end: index + 1,
      }
    }

    index += 1
  }

  return null
}

function skipJsxSubtree(source: string, start: number): number {
  const openingToken = readJsxTagToken(source, start)
  if (!openingToken || openingToken.closing || openingToken.selfClosing) {
    return openingToken?.end ?? start + 1
  }

  const targetName = openingToken.name
  let index = openingToken.end

  while (index < source.length) {
    if (source[index] === '<' && isLikelyJsxTagStart(source, index)) {
      const token = readJsxTagToken(source, index)
      if (!token) {
        index += 1
        continue
      }

      if (token.name === targetName && token.closing) {
        return token.end
      }

      if (!token.closing && !token.selfClosing) {
        index = skipJsxSubtree(source, index)
        continue
      }

      index = token.end
      continue
    }

    if (source[index] === '{') {
      index = skipBraceExpression(source, index + 1)
      continue
    }

    if (source[index] === '"' || source[index] === "'" || source[index] === '`') {
      index = skipQuotedText(source, index, source[index] as '"' | "'" | '`')
      continue
    }

    index += 1
  }

  return source.length
}

function skipBraceExpression(source: string, start: number): number {
  let depth = 1

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (char === '"' || char === "'" || char === '`') {
      index = skipQuotedText(source, index, char as '"' | "'" | '`') - 1
      continue
    }

    if (char === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipBalancedComment(source, index) - 1
      continue
    }

    if (char === '<' && isLikelyJsxTagStart(source, index)) {
      index = skipJsxSubtree(source, index) - 1
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index + 1
      }
    }
  }

  return source.length
}

function getJsxAncestorStack(source: string, end: number): string[] {
  const stack: string[] = []

  for (let index = 0; index < end; ) {
    if (source[index] !== '<' || !isLikelyJsxTagStart(source, index)) {
      index += 1
      continue
    }

    const token = readJsxTagToken(source, index)
    if (!token) {
      index += 1
      continue
    }

    if (!token.name) {
      index = token.end
      continue
    }

    if (token.closing) {
      const lastMatchIndex = [...stack].reverse().findIndex((name) => name === token.name)
      if (lastMatchIndex !== -1) {
        stack.length = stack.length - lastMatchIndex - 1
      }
    } else if (!token.selfClosing) {
      stack.push(token.name)
    }

    index = token.end
  }

  return stack
}

function getContextualRelativeName(parentName: string, componentName: string): string {
  if (componentName.startsWith(`${parentName}.`)) {
    return componentName.slice(parentName.length + 1)
  }

  const segments = componentName.split('.')
  return segments[segments.length - 1] ?? componentName
}

function matchesContextualName(parentName: string, componentName: string, query: string): boolean {
  const relativeName = getContextualRelativeName(parentName, componentName)
  return matchesPartial(componentName, query) || matchesPartial(relativeName, query)
}

function getCompletionEntry(componentName: string): CompletionEntry | undefined {
  const resolvedName = resolveContextualAutocompleteEntryName(componentName)
  const entry = completionEntriesByName.get(resolvedName)

  return entry && resolvedName !== componentName ? { ...entry, name: componentName } : entry
}

function contextualComponentOptions(
  parentName: string,
  query: string,
  onApplyCatalogInsertion?: ApplyCatalogInsertion
): {
  options: Completion[]
  exclusive: boolean
  names: Array<{ name: string; aliases: string[] }>
} {
  const rule = getContextualAutocompleteRule(parentName)
  if (!rule) {
    return {
      options: [],
      exclusive: false,
      names: [],
    }
  }

  const contextualEntries = rule.children
    .map((child) => {
      const entry = getCompletionEntry(child.name)
      if (!entry || !supportsCatalogInsertion(entry, onApplyCatalogInsertion, child.insertion)) {
        return null
      }

      return {
        entry,
        insertion: child.insertion,
        name: child.name,
        aliases: [child.name, getContextualRelativeName(parentName, child.name)],
      }
    })
    .filter((child): child is NonNullable<typeof child> => Boolean(child))
    .filter((child) => matchesContextualName(parentName, child.name, query))

  return {
    exclusive: Boolean(rule.exclusive),
    names: contextualEntries.map((child) => ({
      name: child.name,
      aliases: child.aliases,
    })),
    options: contextualEntries.map((child, index) => ({
      ...componentOption(child.entry, onApplyCatalogInsertion, child.insertion),
      boost: 100 - index,
    })),
  }
}

function createTagValidFor(
  componentNames: Array<{ name: string; aliases: string[] }>,
  allowIcons: boolean
): (text: string) => boolean {
  return (text) => {
    if (!TAG_NAME_VALID_FOR.test(text)) {
      return false
    }

    if (text === '') {
      return true
    }

    const hasComponentMatches = componentNames.some((entry) =>
      entry.aliases.some((alias) => matchesCaseSensitivePrefix(alias, text))
    )

    if (hasComponentMatches) {
      return true
    }

    if (!allowIcons) {
      return false
    }

    return (
      isIconLikeTagQuery(text, hasComponentMatches) &&
      iconEntries.some((entry) => matchesPartial(entry.name, text))
    )
  }
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

function normalizeComponentLookupName(componentName: string): string {
  if (componentName === 'UNSAFE_Combobox') {
    return 'Combobox'
  }

  return componentName
}

function getComponentProps(componentName: string): CompletionProp[] {
  const normalizedComponentName = normalizeComponentLookupName(
    resolveContextualAutocompleteEntryName(componentName)
  )

  if (isHiddenFromNewAuthoring(normalizedComponentName)) {
    return []
  }

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

  return ''
}

function getEntryApply(entry: CompletionEntry): string {
  const resolvedName = resolveContextualAutocompleteEntryName(entry.name)
  const catalogEntry = catalogEntriesByName.get(resolvedName)
  let apply = catalogEntry ? stripSnippetPlaceholders(catalogEntry.snippet.code) : resolvedName
  if (apply.startsWith('<')) {
    apply = apply.slice(1)
  }

  return apply
}

function getCatalogInsertion(
  entry: AkselCatalogEntry,
  insertionOverride?: ComponentInsertion
): ComponentInsertion {
  return (
    insertionOverride ?? {
      jsx: entry.snippet.code,
      hooks: entry.snippet.hooksCode,
    }
  )
}

function getAutocompleteCatalogInsertion(
  entry: AkselCatalogEntry,
  insertionOverride?: ComponentInsertion
): ComponentInsertion {
  const insertion = getCatalogInsertion(entry, insertionOverride)

  return {
    ...insertion,
    jsx: insertion.jsx.startsWith('<') ? insertion.jsx.slice(1) : insertion.jsx,
  }
}

function supportsCatalogInsertion(
  entry: CompletionEntry,
  onApplyCatalogInsertion?: ApplyCatalogInsertion,
  insertionOverride?: ComponentInsertion
): boolean {
  const insertion =
    entry.source === 'catalog' ? getCatalogInsertion(entry, insertionOverride) : insertionOverride
  const needsEditorApply = insertion ? insertionNeedsEditorApply(insertion) : false

  return !(needsEditorApply && !onApplyCatalogInsertion)
}

function componentOption(
  entry: CompletionEntry,
  onApplyCatalogInsertion?: ApplyCatalogInsertion,
  insertionOverride?: ComponentInsertion
): Completion {
  const catalogInsertion =
    entry.source === 'catalog'
      ? getAutocompleteCatalogInsertion(entry, insertionOverride)
      : undefined
  const overrideApply = insertionOverride
    ? insertionOverride.jsx.startsWith('<')
      ? insertionOverride.jsx.slice(1)
      : insertionOverride.jsx
    : undefined
  const editorAppliedInsertion =
    catalogInsertion ??
    (insertionOverride
      ? {
          ...insertionOverride,
          jsx: overrideApply ?? insertionOverride.jsx,
        }
      : undefined)
  let apply: Completion['apply'] = getEntryApply(entry)

  if (
    editorAppliedInsertion &&
    onApplyCatalogInsertion &&
    insertionNeedsEditorApply(editorAppliedInsertion)
  ) {
    const applyCatalogInsertion: NonNullable<Exclude<Completion['apply'], string>> = (
      _view,
      _completion,
      from,
      to
    ) => {
      onApplyCatalogInsertion({
        insertion: editorAppliedInsertion,
        from,
        to,
      })
    }
    apply = applyCatalogInsertion
  } else if (catalogInsertion) {
    apply = catalogInsertion.jsx
  } else if (overrideApply) {
    apply = overrideApply
  }

  return {
    label: entry.name,
    type: entry.name.includes('.')
      ? 'namespace'
      : entry.source === 'catalog' && entry.group === 'icon'
        ? 'function'
        : 'class',
    detail: getEntryDescription(entry),
    apply,
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

  return matchesPartial(target.name, partialValue) || matchesPartial(target.id, partialValue)
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
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[],
  onApplyCatalogInsertion?: ApplyCatalogInsertion
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
    const parentStack = getJsxAncestorStack(source, openTag.tagStart)
    const directParent = parentStack[parentStack.length - 1]
    const contextualOptions = directParent
      ? contextualComponentOptions(directParent, tagNameContext.query, onApplyCatalogInsertion)
      : { options: [], exclusive: false, names: [] as Array<{ name: string; aliases: string[] }> }
    const allowIconTagSuggestions = !contextualOptions.exclusive
    const shouldSuggestComponents =
      tagNameContext.query === '' || COMPONENT_NAME_PATTERN.test(tagNameContext.query)
    const topLevelOptions =
      isIconPropTagContext || !shouldSuggestComponents
        ? []
        : topLevelCompletionEntries
            .filter((entry) => matchesCompletionEntry(entry, tagNameContext.query))
            .filter((entry) => supportsCatalogInsertion(entry, onApplyCatalogInsertion))
            .map((entry) => componentOption(entry, onApplyCatalogInsertion))
    const componentOptions =
      contextualOptions.exclusive || !shouldSuggestComponents
        ? contextualOptions.options
        : [...contextualOptions.options, ...topLevelOptions]
    const componentNames =
      contextualOptions.exclusive || !shouldSuggestComponents
        ? contextualOptions.names
        : [
            ...contextualOptions.names,
            ...topLevelCompletionEntries.map((entry) => ({
              name: entry.name,
              aliases: getCompletionAliases(entry),
            })),
          ]
    const iconOptions =
      isIconPropTagContext ||
      (allowIconTagSuggestions &&
        isIconLikeTagQuery(tagNameContext.query, componentOptions.length > 0))
        ? iconComponentOptions(tagNameContext.query, isIconPropTagContext ? 'icon-prop-tag' : 'tag')
        : []
    const options = [...componentOptions, ...iconOptions]

    if (options.length > 0) {
      const validFor =
        iconOptions.length > 0 && componentOptions.length === 0
          ? createTagValidFor([], true)
          : createTagValidFor(componentNames, !isIconPropTagContext && allowIconTagSuggestions)

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
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[],
  onApplyCatalogInsertion?: ApplyCatalogInsertion
): CompletionResult | null {
  return getAkselCompletionForSource(
    context.state.doc.toString(),
    context.pos,
    pageNavigationTargets,
    onApplyCatalogInsertion
  )
}

export function isAkselPropValueCompletionContext(
  source: string,
  pos: number,
  pageNavigationTargets?: readonly PageNavigationCompletionTarget[]
): boolean {
  if (
    pageNavigationTargets &&
    pageNavigationTargets.length > 0 &&
    getPageNavigationContext(source, pos)
  ) {
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

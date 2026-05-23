import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete'
import {
  getCatalogComponent,
  getCatalogPropDefinition,
  listCatalogEntries,
  type AkselCatalogEntry,
  type AkselCatalogProp,
} from '@/data/akselCatalog'

const COMPONENT_NAME_PATTERN = /^[A-Z][\w.]*$/
const TAG_NAME_VALID_FOR = /^[\w.]*$/
const PROP_NAME_VALID_FOR = /^[\w-]*$/
const PROP_VALUE_VALID_FOR = /^[\w-]*$/

const COMPLETION_ENTRIES = listCatalogEntries({
  groups: ['layout', 'component'],
  statuses: ['current', 'experimental'],
})

interface OpenTagContext {
  tagStart: number
  fragment: string
  componentName?: string
}

function stripSnippetPlaceholders(template: string): string {
  return template.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder: string) => placeholder)
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

function getPropValueContext(openTag: OpenTagContext):
  | {
      componentName: string
      propName: string
      partialValue: string
    }
  | null {
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

function getPropNameContext(openTag: OpenTagContext):
  | {
      componentName: string
      partialProp: string
    }
  | null {
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

function getTagNameContext(openTag: OpenTagContext):
  | {
      query: string
      from: number
    }
  | null {
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

function componentOption(entry: AkselCatalogEntry): Completion {
  let apply = stripSnippetPlaceholders(entry.snippet.code)
  if (apply.startsWith('<')) {
    apply = apply.slice(1)
  }

  return {
    label: entry.name,
    type: entry.name.includes('.') ? 'namespace' : 'class',
    detail:
      entry.status === 'experimental'
        ? `${entry.snippet.description} Experimental.`
        : entry.snippet.description,
    apply,
  }
}

function propOption(componentName: string, prop: AkselCatalogProp): Completion {
  const hasValues = Boolean(prop.values?.length)

  return {
    label: prop.name,
    type: 'property',
    detail: prop.description || `${componentName} prop`,
    apply: hasValues ? `${prop.name}=""` : prop.name,
    boost: prop.required ? 10 : 0,
  }
}

function valueOption(prop: AkselCatalogProp, value: string): Completion {
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
    const prop = getCatalogPropDefinition(componentName, propName)
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
    const component = getCatalogComponent(componentName)
    const options =
      component?.props
        .filter((prop) => matchesPartial(prop.name, partialProp))
        .map((prop) => propOption(componentName, prop)) ?? []

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
    const options = COMPLETION_ENTRIES.filter((entry) =>
      matchesPartial(entry.name, tagNameContext.query)
    ).map(componentOption)

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

export function getAkselCompletionForContext(
  context: CompletionContext
): CompletionResult | null {
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
    getCatalogPropDefinition(propValueContext.componentName, propValueContext.propName)?.values
      ?.length
  )
}

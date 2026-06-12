import type { EditorTab, CursorPosition } from '@/types/editor'
import type { ArcadeSourceFile } from '@/types/project'
import type { ComponentInsertion } from '@/types/snippets'

const SNIPPET_PLACEHOLDER_PATTERN = /\$\{(\d+):([^}]+)\}/g
const COLLISION_TOKEN_PATTERN = /\{\{[\w]+\}\}/g
const IDENTIFIER_PREFIX = /[A-Za-z_$][\w$]*/
const IDENTIFIER_PART = /[\w$]/
const TABS_VALUE_PLACEHOLDER = '__AX_TAB_VALUE__'
const TABS_LABEL_PLACEHOLDER = '__AX_TAB_LABEL__'
const TABS_CONTENT_PLACEHOLDER = '__AX_TAB_CONTENT__'
const TABS_ROOT_TAG_PATTERN = /<\/?Tabs(?!\.)\b[^>]*>/g
const TABS_TAB_TAG_PATTERN = /<Tabs\.Tab\b([^>]*)\/?>/g
const TABS_PANEL_TAG_PATTERN = /<Tabs\.Panel\b([^>]*)>/g

interface PaletteInsertionLocation {
  kind: 'palette'
  activeTab: EditorTab
  jsxCursor: CursorPosition
  hooksCursor: CursorPosition
}

interface AutocompleteInsertionLocation {
  kind: 'autocomplete'
  from: number
  to: number
}

export type ComponentInsertionLocation = PaletteInsertionLocation | AutocompleteInsertionLocation

function stripSnippetPlaceholders(template: string): string {
  return template.replace(
    SNIPPET_PLACEHOLDER_PATTERN,
    (_match, _num, placeholder: string) => placeholder
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceAllOccurrences(source: string, target: string, replacement: string): string {
  return source.split(target).join(replacement)
}

function getCollisionTokens(templates: string[]): string[] {
  return Array.from(
    new Set(
      templates.flatMap((template) => {
        const matches = template.match(COLLISION_TOKEN_PATTERN)
        return matches ?? []
      })
    )
  )
}

function getIdentifierTemplatesForToken(template: string, token: string): string[] {
  const pattern = new RegExp(`${IDENTIFIER_PREFIX.source}${escapeRegExp(token)}[\\w$]*`, 'g')
  return Array.from(
    new Set(
      Array.from(template.matchAll(pattern))
        .filter((match) => {
          const start = match.index ?? 0
          const precedingCharacter = template[start - 1]
          return precedingCharacter !== '-' && !IDENTIFIER_PART.test(precedingCharacter ?? '')
        })
        .map((match) => match[0])
    )
  )
}

function sourceContainsIdentifier(source: string, identifier: string): boolean {
  return new RegExp(`\\b${escapeRegExp(identifier)}\\b`).test(source)
}

function getTokenReplacements(
  insertion: ComponentInsertion,
  source: ArcadeSourceFile
): Map<string, string> {
  const templates = [insertion.jsx, insertion.hooks ?? '']
  const existingSource = `${source.jsx}\n${source.hooks}`
  const replacements = new Map<string, string>()

  for (const token of getCollisionTokens(templates)) {
    const identifierTemplates = Array.from(
      new Set(templates.flatMap((template) => getIdentifierTemplatesForToken(template, token)))
    )

    if (identifierTemplates.length === 0) {
      replacements.set(token, '')
      continue
    }

    let suffix = ''
    let counter = 1

    while (
      identifierTemplates
        .map((identifierTemplate) => replaceAllOccurrences(identifierTemplate, token, suffix))
        .some((identifier) => sourceContainsIdentifier(existingSource, identifier))
    ) {
      counter += 1
      suffix = String(counter)
    }

    replacements.set(token, suffix)
  }

  return replacements
}

function applyTokenReplacements(template: string, replacements: Map<string, string>): string {
  let nextTemplate = stripSnippetPlaceholders(template)

  for (const [token, replacement] of replacements.entries()) {
    nextTemplate = replaceAllOccurrences(nextTemplate, token, replacement)
  }

  return nextTemplate
}

function insertBlockAtLine(source: string, line: number, block: string): string {
  if (!source) {
    return block
  }

  const lines = source.split('\n')
  const insertIndex = Math.max(0, Math.min(line, lines.length))
  lines.splice(insertIndex, 0, block)
  return lines.join('\n')
}

function appendBlock(source: string, block: string): string {
  if (!source.trim()) {
    return block
  }

  return `${source.trimEnd()}\n\n${block}`
}

function replaceRange(source: string, from: number, to: number, block: string): string {
  return `${source.slice(0, from)}${block}${source.slice(to)}`
}

export function createJsxOnlyInsertion(jsx: string): ComponentInsertion {
  return { jsx }
}

export function insertionNeedsEditorApply(insertion: ComponentInsertion): boolean {
  return Boolean(
    insertion.hooks ||
    insertion.jsx.includes(TABS_VALUE_PLACEHOLDER) ||
    insertion.jsx.includes(TABS_LABEL_PLACEHOLDER) ||
    insertion.jsx.includes(TABS_CONTENT_PLACEHOLDER)
  )
}

function extractAttributeValue(attributes: string, attributeName: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${attributeName}="([^"]+)"`))
  return match?.[1]
}

function getContainingTabsBlock(source: string, position: number): string | undefined {
  const ranges: Array<{ start: number; end: number }> = []
  const stack: number[] = []

  for (const match of source.matchAll(TABS_ROOT_TAG_PATTERN)) {
    const tag = match[0]
    const start = match.index ?? 0

    if (tag.startsWith('</')) {
      const openStart = stack.pop()
      if (openStart !== undefined) {
        ranges.push({ start: openStart, end: start + tag.length })
      }
      continue
    }

    if (!tag.endsWith('/>')) {
      stack.push(start)
    }
  }

  const containingRanges = ranges
    .filter((range) => range.start <= position && position <= range.end)
    .sort((first, second) => first.start - second.start)
  const containingRange = containingRanges[containingRanges.length - 1]

  return containingRange ? source.slice(containingRange.start, containingRange.end) : undefined
}

function formatTabsLabel(value: string): string {
  const sequentialTabMatch = value.match(/^tab(\d+)$/)
  if (sequentialTabMatch) {
    return `Tab ${sequentialTabMatch[1]}`
  }

  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getNextTabsValue(usedValues: Set<string>): string {
  let counter = 1
  while (usedValues.has(`tab${counter}`)) {
    counter += 1
  }

  return `tab${counter}`
}

function resolveTabsAutocompletePlaceholders(
  source: string,
  position: number,
  jsxBlock: string
): string {
  if (!jsxBlock.includes(TABS_VALUE_PLACEHOLDER)) {
    return jsxBlock
  }

  const tabsBlock = getContainingTabsBlock(source, position) ?? source
  const tabValues: string[] = []
  const panelValues: string[] = []
  const tabLabelsByValue = new Map<string, string>()

  for (const match of tabsBlock.matchAll(TABS_TAB_TAG_PATTERN)) {
    const attributes = match[1] ?? ''
    const value = extractAttributeValue(attributes, 'value')

    if (!value) {
      continue
    }

    tabValues.push(value)
    tabLabelsByValue.set(
      value,
      extractAttributeValue(attributes, 'label') ?? formatTabsLabel(value)
    )
  }

  for (const match of tabsBlock.matchAll(TABS_PANEL_TAG_PATTERN)) {
    const attributes = match[1] ?? ''
    const value = extractAttributeValue(attributes, 'value')

    if (value) {
      panelValues.push(value)
    }
  }

  const tabValueSet = new Set(tabValues)
  const panelValueSet = new Set(panelValues)
  const usedValues = new Set([...tabValueSet, ...panelValueSet])
  const isPanelInsertion = jsxBlock.includes('Tabs.Panel')
  const matchingUnpairedValue = isPanelInsertion
    ? tabValues.find((value) => !panelValueSet.has(value))
    : panelValues.find((value) => !tabValueSet.has(value))
  const value = matchingUnpairedValue ?? getNextTabsValue(usedValues)
  const label = tabLabelsByValue.get(value) ?? formatTabsLabel(value)

  return replaceAllOccurrences(
    replaceAllOccurrences(
      replaceAllOccurrences(jsxBlock, TABS_VALUE_PLACEHOLDER, value),
      TABS_LABEL_PLACEHOLDER,
      label
    ),
    TABS_CONTENT_PLACEHOLDER,
    `${label} content.`
  )
}

export function applyComponentInsertion(
  source: ArcadeSourceFile,
  insertion: ComponentInsertion,
  location: ComponentInsertionLocation
): ArcadeSourceFile {
  const replacements = getTokenReplacements(insertion, source)
  let jsxBlock = applyTokenReplacements(insertion.jsx, replacements)
  const hooksBlock = insertion.hooks
    ? applyTokenReplacements(insertion.hooks, replacements)
    : undefined

  if (location.kind === 'autocomplete') {
    jsxBlock = resolveTabsAutocompletePlaceholders(source.jsx, location.from, jsxBlock)

    return {
      jsx: replaceRange(source.jsx, location.from, location.to, jsxBlock),
      hooks: hooksBlock ? appendBlock(source.hooks, hooksBlock) : source.hooks,
    }
  }

  if (hooksBlock) {
    return {
      jsx: insertBlockAtLine(source.jsx, location.jsxCursor.line, jsxBlock),
      hooks: appendBlock(source.hooks, hooksBlock),
    }
  }

  if (location.activeTab === 'Hooks') {
    return {
      jsx: source.jsx,
      hooks: insertBlockAtLine(source.hooks, location.hooksCursor.line, jsxBlock),
    }
  }

  return {
    jsx: insertBlockAtLine(source.jsx, location.jsxCursor.line, jsxBlock),
    hooks: source.hooks,
  }
}

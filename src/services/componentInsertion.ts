import type { EditorTab, CursorPosition } from '@/types/editor'
import type { ArcadeSourceFile } from '@/types/project'
import type { ComponentInsertion } from '@/types/snippets'

const SNIPPET_PLACEHOLDER_PATTERN = /\$\{(\d+):([^}]+)\}/g
const COLLISION_TOKEN_PATTERN = /\{\{[\w]+\}\}/g
const IDENTIFIER_PREFIX = /[A-Za-z_$][\w$]*/

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

const COMPONENT_SETUP_MARKER = '// __AKSEL_ARCADE_COMPONENT_SETUP__'
const COMPONENT_SETUP_WRAPPER_PATTERN = new RegExp(
  String.raw`^\(\(\) => \{\n {2}\/\/ __AKSEL_ARCADE_COMPONENT_SETUP__\n([\s\S]*?)\n\n {2}return \(\n {4}<>\n([\s\S]*?)\n {4}<\/>\n {2}\)\n\}\)\(\)$`
)

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
  return Array.from(new Set(template.match(pattern) ?? []))
}

function sourceContainsIdentifier(source: string, identifier: string): boolean {
  return new RegExp(`\\b${escapeRegExp(identifier)}\\b`).test(source)
}

function getTokenReplacements(
  insertion: ComponentInsertion,
  source: ArcadeSourceFile
): Map<string, string> {
  const templates = [insertion.jsx, insertion.hooks ?? '', insertion.componentSetup ?? '']
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

function getOffsetForCursor(source: string, cursor: CursorPosition): number {
  const lines = source.split('\n')
  const targetLine = Math.max(0, Math.min(cursor.line, lines.length - 1))
  const targetColumn = Math.max(0, Math.min(cursor.column, lines[targetLine]?.length ?? 0))
  let offset = 0

  for (let index = 0; index < targetLine; index += 1) {
    offset += lines[index].length + 1
  }

  return offset + targetColumn
}

function insertBlockAtCursor(source: string, cursor: CursorPosition, block: string): string {
  if (!source) {
    return block
  }

  const lines = source.split('\n')
  const offset = getOffsetForCursor(source, cursor)
  const currentLine = lines[Math.max(0, Math.min(cursor.line, lines.length - 1))] ?? ''
  const isLineBoundary = cursor.column === 0 || cursor.column === currentLine.length
  const prefix =
    isLineBoundary && offset > 0 && source[offset - 1] !== '\n' ? '\n' : ''
  const suffix =
    isLineBoundary && offset < source.length && source[offset] !== '\n' ? '\n' : ''

  return `${source.slice(0, offset)}${prefix}${block}${suffix}${source.slice(offset)}`
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

function indentBlock(source: string, prefix: string): string {
  return source
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
}

function unindentBlock(source: string, prefix: string): string {
  return source
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .join('\n')
}

function buildComponentSetupWrappedSource(body: string, setup: string): string {
  return `(() => {\n  ${COMPONENT_SETUP_MARKER}\n${indentBlock(setup, '  ')}\n\n  return (\n    <>\n${indentBlock(body, '      ')}\n    </>\n  )\n})()`
}

function parseComponentSetupWrappedSource(source: string): { setup: string; body: string } | null {
  const match = source.match(COMPONENT_SETUP_WRAPPER_PATTERN)

  if (!match) {
    return null
  }

  return {
    setup: unindentBlock(match[1], '  '),
    body: unindentBlock(match[2], '      '),
  }
}

function applyComponentSetup(source: string, setupBlock: string): string {
  const existingWrapper = parseComponentSetupWrappedSource(source)

  if (!existingWrapper) {
    return buildComponentSetupWrappedSource(source, setupBlock)
  }

  return buildComponentSetupWrappedSource(
    existingWrapper.body,
    `${existingWrapper.setup}\n${setupBlock}`
  )
}

export function createJsxOnlyInsertion(jsx: string): ComponentInsertion {
  return { jsx }
}

export function applyComponentInsertion(
  source: ArcadeSourceFile,
  insertion: ComponentInsertion,
  location: ComponentInsertionLocation
): ArcadeSourceFile {
  const replacements = getTokenReplacements(insertion, source)
  const jsxBlock = applyTokenReplacements(insertion.jsx, replacements)
  const hooksBlock = insertion.hooks
    ? applyTokenReplacements(insertion.hooks, replacements)
    : undefined
  const componentSetupBlock = insertion.componentSetup
    ? applyTokenReplacements(insertion.componentSetup, replacements)
    : undefined

  const applyJsxSetup = (jsxSource: string) =>
    componentSetupBlock ? applyComponentSetup(jsxSource, componentSetupBlock) : jsxSource

  if (location.kind === 'autocomplete') {
    return {
      jsx: applyJsxSetup(replaceRange(source.jsx, location.from, location.to, jsxBlock)),
      hooks: hooksBlock ? appendBlock(source.hooks, hooksBlock) : source.hooks,
    }
  }

  if (hooksBlock) {
    return {
      jsx: applyJsxSetup(insertBlockAtCursor(source.jsx, location.jsxCursor, jsxBlock)),
      hooks: appendBlock(source.hooks, hooksBlock),
    }
  }

  if (componentSetupBlock) {
    return {
      jsx: applyJsxSetup(insertBlockAtCursor(source.jsx, location.jsxCursor, jsxBlock)),
      hooks: source.hooks,
    }
  }

  if (location.activeTab === 'Hooks') {
    return {
      jsx: source.jsx,
      hooks: insertBlockAtCursor(source.hooks, location.hooksCursor, jsxBlock),
    }
  }

  return {
    jsx: applyJsxSetup(insertBlockAtCursor(source.jsx, location.jsxCursor, jsxBlock)),
    hooks: source.hooks,
  }
}

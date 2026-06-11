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

  if (location.kind === 'autocomplete') {
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

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export const LLM_DOCS_URL = 'https://aksel.nav.no/llm.md'

const COMPONENT_LINK_PATTERN =
  /- \[([^\]]+)\]\((https:\/\/aksel\.nav\.no\/komponenter\/(?:primitives|core|legacy)\/[^)]+\.md)\)/g

function isNonComponentLinkTitle(title: string): boolean {
  return title.startsWith('Eksperimenter') || title === 'Typografi-komponenter'
}

const htmlEntityMap: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
}

export interface AkselAutocompleteProp {
  name: string
  type: string
  values: string[]
  required: boolean
  default?: string
  description: string
}

export interface AkselAutocompleteEntry {
  name: string
  group: 'primitive' | 'component' | 'legacy'
  status: string
  docs: string
  props: AkselAutocompleteProp[]
}

export interface AkselDocsLink {
  title: string
  url: string
}

function decodeHtml(value: string): string {
  return value.replace(/&(quot|apos|amp|lt|gt);/g, (entity) => htmlEntityMap[entity] ?? entity)
}

function toAscii(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\t\n\r -~]/g, '')
}

function normalizeCell(value: string): string {
  return toAscii(decodeHtml(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim())
}

function splitMarkdownTableRow(row: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inCode = false
  let escaped = false

  for (let index = 1; index < row.length; index += 1) {
    const char = row[index]

    if (escaped) {
      cell += char
      escaped = false
      continue
    }

    if (char === '\\') {
      cell += char
      escaped = true
      continue
    }

    if (char === '`') {
      inCode = !inCode
      cell += char
      continue
    }

    if (char === '|' && !inCode) {
      cells.push(normalizeCell(cell))
      cell = ''
      continue
    }

    cell += char
  }

  return cells
}

function stripMarkdownCode(value: string): string {
  const codeMatch = value.match(/`([^`]+)`/)
  return codeMatch ? codeMatch[1] : value
}

function extractLiteralValues(typeText: string): string[] {
  const values = new Set<string>()
  for (const match of typeText.matchAll(/"([^"`]+)"/g)) {
    values.add(match[1])
  }

  if (/\bboolean\b|Booleanish/.test(typeText)) {
    values.add('false')
    values.add('true')
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export function normalizeStatus(status?: string): string {
  if (!status) {
    return 'current'
  }

  return status === 'ready' || status === 'new' ? 'current' : status
}

function getDocsGroup(url: string): 'primitive' | 'component' | 'legacy' {
  if (url.includes('/primitives/')) {
    return 'primitive'
  }

  if (url.includes('/legacy/')) {
    return 'legacy'
  }

  return 'component'
}

export async function fetchText(
  url: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<string> {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

export function extractComponentLinks(markdown: string): AkselDocsLink[] {
  return Array.from(markdown.matchAll(COMPONENT_LINK_PATTERN), ([, title, url]) => ({ title, url }))
}

export function extractDocsEntries(markdown: string, docsUrl: string): AkselAutocompleteEntry[] {
  const status = normalizeStatus(markdown.match(/status="([^"]+)"/)?.[1])
  const group = getDocsGroup(docsUrl)
  const sections = [
    ...markdown.matchAll(
      /\*\*([^*]+)\*\*\n\nComponent:\s*`([^`]+)`[\s\S]*?\n\| Prop \| Type \| Default \| Required \| Description \|\n\| --- \| --- \| --- \| --- \| --- \|\n([\s\S]*?)(?=\n\n\*\*|\n## Tokens|\n<\/component>|$)/g
    ),
  ]

  return sections.map((section) => {
    const heading = section[1].trim()
    const componentName = section[2].trim()
    const name =
      heading === 'Props' || heading.toLowerCase() === componentName.toLowerCase()
        ? componentName
        : heading
    const props = section[3]
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .map((row) => {
        const cells = splitMarkdownTableRow(row)
        const nameCell = stripMarkdownCode(cells[0] ?? '').replace(/^Deprecated:\s*/, '')
        const type = normalizeCell(cells[1] ?? '')
        const defaultValue = stripMarkdownCode(cells[2] ?? '')
        const required = normalizeCell(cells[3] ?? '').toLowerCase() === 'true'
        const description = normalizeCell(cells[4] ?? '')

        return {
          name: nameCell,
          type,
          values: extractLiteralValues(type),
          required,
          default: defaultValue === '-' ? undefined : defaultValue,
          description,
        }
      })
      .filter((prop) => prop.name)

    return {
      name,
      group,
      status,
      docs: docsUrl.replace(/\.md$/, ''),
      props,
    }
  })
}

function typeLiteralValues(checker: ts.TypeChecker, type: ts.Type): string[] {
  const candidates = type.isUnion()
    ? type.types.filter(
        (candidate) =>
          (candidate.flags &
            (ts.TypeFlags.Undefined |
              ts.TypeFlags.Null |
              ts.TypeFlags.Void |
              ts.TypeFlags.Never)) ===
          0
      )
    : [type]

  const values = new Set<string>()
  for (const candidate of candidates) {
    if (candidate.isStringLiteral()) {
      values.add(candidate.value)
    } else if (candidate.isNumberLiteral()) {
      values.add(String(candidate.value))
    } else if (candidate.flags & ts.TypeFlags.BooleanLiteral) {
      values.add(checker.typeToString(candidate))
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export function extractIconProps(): AkselAutocompleteProp[] {
  const fixturePath = path.resolve('.tmp-aksel-icon-props.tsx')
  fs.writeFileSync(fixturePath, "import * as Icons from '@navikt/aksel-icons';\n", 'utf8')

  try {
    const program = ts.createProgram([fixturePath], {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      strict: false,
      target: ts.ScriptTarget.ES2022,
    })
    const checker = program.getTypeChecker()
    const sourceFile = program.getSourceFile(fixturePath)
    let iconsNamespace: ts.Identifier | undefined

    if (!sourceFile) {
      throw new Error('Failed to build icon prop fixture program.')
    }

    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isImportDeclaration(node) &&
        node.importClause?.namedBindings &&
        ts.isNamespaceImport(node.importClause.namedBindings)
      ) {
        iconsNamespace = node.importClause.namedBindings.name
      }
    })

    if (!iconsNamespace) {
      throw new Error('Failed to locate icon namespace import.')
    }

    const namespaceSymbol = checker.getSymbolAtLocation(iconsNamespace)
    const namespaceType = checker.getTypeOfSymbolAtLocation(namespaceSymbol!, iconsNamespace)
    const sampleIconSymbol = namespaceType
      .getProperties()
      .find((symbol) => symbol.name === 'AirplaneIcon')

    if (!sampleIconSymbol) {
      throw new Error('Failed to locate AirplaneIcon export in @navikt/aksel-icons.')
    }

    const sampleIconType = checker.getTypeOfSymbolAtLocation(sampleIconSymbol, sourceFile)
    const signature = checker.getSignaturesOfType(sampleIconType, ts.SignatureKind.Call)[0]

    if (!signature?.parameters[0]) {
      throw new Error('Failed to locate icon props signature for @navikt/aksel-icons.')
    }

    const propsType = checker.getTypeOfSymbolAtLocation(signature.parameters[0], sourceFile)

    return checker
      .getPropertiesOfType(propsType)
      .map((prop) => {
        const propType = checker.getTypeOfSymbolAtLocation(prop, sourceFile)
        return {
          name: prop.name,
          type: checker.typeToString(propType),
          values: typeLiteralValues(checker, propType),
          required: false,
          default: undefined,
          description: 'SVG icon prop.',
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  } finally {
    fs.rmSync(fixturePath, { force: true })
  }
}

export function mergeDuplicateEntries(entries: AkselAutocompleteEntry[]): AkselAutocompleteEntry[] {
  const merged = new Map<string, AkselAutocompleteEntry>()

  for (const entry of entries) {
    const existing = merged.get(entry.name)
    if (!existing) {
      merged.set(entry.name, entry)
      continue
    }

    const propMap = new Map(existing.props.map((prop) => [prop.name, prop]))
    for (const prop of entry.props) {
      propMap.set(prop.name, prop)
    }

    merged.set(entry.name, {
      ...existing,
      group: existing.group === 'legacy' ? entry.group : existing.group,
      status: existing.status === 'current' ? existing.status : entry.status,
      props: Array.from(propMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function collectDocsEntries(
  llmDocs: string,
  loadMarkdown: (link: AkselDocsLink) => Promise<string>
): Promise<AkselAutocompleteEntry[]> {
  const docsEntries: AkselAutocompleteEntry[] = []

  for (const link of extractComponentLinks(llmDocs)) {
    const markdown = await loadMarkdown(link)
    const entries = extractDocsEntries(markdown, link.url)
    docsEntries.push(...entries)

    if (entries.length === 0 && !isNonComponentLinkTitle(link.title)) {
      docsEntries.push({
        name: link.title,
        group: getDocsGroup(link.url),
        status: normalizeStatus(markdown.match(/status="([^"]+)"/)?.[1]),
        docs: link.url.replace(/\.md$/, ''),
        props: [],
      })
    }

    if (link.title === 'Typografi-komponenter' && markdown.includes('## Ingress')) {
      docsEntries.push({
        name: 'Ingress',
        group: 'legacy',
        status: 'deprecated',
        docs: `${link.url.replace(/\.md$/, '')}#ingress`,
        props: [],
      })
    }
  }

  return mergeDuplicateEntries(docsEntries)
}

export async function fetchDocsEntries(
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<AkselAutocompleteEntry[]> {
  const llmDocs = await fetchText(LLM_DOCS_URL, fetchImpl)
  return collectDocsEntries(llmDocs, (link) => fetchText(link.url, fetchImpl))
}

function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function renderAutocompleteDataFile(
  entries: AkselAutocompleteEntry[],
  iconProps: AkselAutocompleteProp[]
): string {
  return `// Generated by scripts/generate-aksel-autocomplete-data.ts from ${LLM_DOCS_URL}.
// Do not edit this file manually; regenerate it when Aksel docs or package types change.

export interface AkselAutocompleteProp {
  name: string
  type: string
  values: string[]
  required: boolean
  default?: string
  description: string
}

export interface AkselAutocompleteEntry {
  name: string
  group: 'primitive' | 'component' | 'legacy'
  status: string
  docs: string
  props: AkselAutocompleteProp[]
}

export const AKSEL_AUTOCOMPLETE_ENTRIES: AkselAutocompleteEntry[] = ${serialize(entries)}

export const AKSEL_ICON_PROPS: AkselAutocompleteProp[] = ${serialize(iconProps)}
`
}

export async function generateAutocompleteDataFile(
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<string> {
  const docsEntries = await fetchDocsEntries(fetchImpl)
  return renderAutocompleteDataFile(docsEntries, extractIconProps())
}

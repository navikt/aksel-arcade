import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const LLM_DOCS_URL = 'https://aksel.nav.no/llm.md'
const OUTPUT_PATH = path.resolve('src/data/akselAutocompleteData.ts')
const COMPONENT_LINK_PATTERN =
  /- \[([^\]]+)\]\((https:\/\/aksel\.nav\.no\/komponenter\/(?:primitives|core|legacy)\/[^)]+\.md)\)/g

function isNonComponentLinkTitle(title) {
  return title.startsWith('Eksperimenter') || title === 'Typografi-komponenter'
}

const htmlEntityMap = {
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
}

function decodeHtml(value) {
  return value.replace(/&(quot|apos|amp|lt|gt);/g, (entity) => htmlEntityMap[entity] ?? entity)
}

function toAscii(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\t\n\r -~]/g, '')
}

function normalizeCell(value) {
  return toAscii(
    decodeHtml(
      value
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
  )
}

function splitMarkdownTableRow(row) {
  const cells = []
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

function stripMarkdownCode(value) {
  const codeMatch = value.match(/`([^`]+)`/)
  return codeMatch ? codeMatch[1] : value
}

function extractLiteralValues(typeText) {
  const values = new Set()
  for (const match of typeText.matchAll(/"([^"`]+)"/g)) {
    values.add(match[1])
  }

  if (/\bboolean\b|Booleanish/.test(typeText)) {
    values.add('false')
    values.add('true')
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

function normalizeStatus(status) {
  if (!status) {
    return 'current'
  }

  return status === 'ready' ? 'current' : status
}

function getDocsGroup(url) {
  if (url.includes('/primitives/')) {
    return 'primitive'
  }

  if (url.includes('/legacy/')) {
    return 'legacy'
  }

  return 'component'
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

function extractDocsEntries(markdown, docsUrl) {
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

function typeLiteralValues(checker, type) {
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

  const values = new Set()
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

function extractIconProps() {
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
    let iconsNamespace

    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isImportDeclaration(node) &&
        node.importClause?.namedBindings &&
        ts.isNamespaceImport(node.importClause.namedBindings)
      ) {
        iconsNamespace = node.importClause.namedBindings.name
      }
    })

    const namespaceSymbol = checker.getSymbolAtLocation(iconsNamespace)
    const namespaceType = checker.getTypeOfSymbolAtLocation(namespaceSymbol, iconsNamespace)
    const sampleIconSymbol = namespaceType
      .getProperties()
      .find((symbol) => symbol.name === 'AirplaneIcon')
    const sampleIconType = checker.getTypeOfSymbolAtLocation(sampleIconSymbol, sourceFile)
    const signature = checker.getSignaturesOfType(sampleIconType, ts.SignatureKind.Call)[0]
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

function mergeDuplicateEntries(entries) {
  const merged = new Map()

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

function serialize(value) {
  return JSON.stringify(value, null, 2)
}

const llmDocs = await fetchText(LLM_DOCS_URL)
const componentLinks = Array.from(llmDocs.matchAll(COMPONENT_LINK_PATTERN), ([, title, url]) => ({
  title,
  url,
}))

const docsEntries = []
for (const link of componentLinks) {
  const markdown = await fetchText(link.url)
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

const fileContents = `// Generated by scripts/generate-aksel-autocomplete-data.mjs from ${LLM_DOCS_URL}.
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

export const AKSEL_AUTOCOMPLETE_ENTRIES: AkselAutocompleteEntry[] = ${serialize(
  mergeDuplicateEntries(docsEntries)
)}

export const AKSEL_ICON_PROPS: AkselAutocompleteProp[] = ${serialize(extractIconProps())}
`

fs.writeFileSync(OUTPUT_PATH, fileContents, 'utf8')
console.log(`Wrote ${OUTPUT_PATH}`)

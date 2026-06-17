import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  akselComponentResourceUri,
  buildMcpAkselCatalog,
  listMcpAuthoringEntries,
  renderMcpAkselCatalogModule,
  resolveSnippetCode,
} from '../../scripts/lib/akselMcpCatalog'

const require = createRequire(import.meta.url)
const generatedArtifactPath = path.resolve(process.cwd(), 'desktop/akselCatalogData.generated.cjs')

describe('akselMcpCatalog builder', () => {
  it('resolves editor insertion placeholders to clean, runnable code', () => {
    expect(resolveSnippetCode('<Button>${1:Button text}</Button>')).toBe('<Button>Button text</Button>')
    expect(resolveSnippetCode('const id{{idSuffix}} = useId()')).toBe('const id = useId()')
    expect(resolveSnippetCode('${1:value}{{collision}}')).toBe('value')
  })

  it('builds a version-matched catalog of import-free, placeholder-free snippets', () => {
    const catalog = buildMcpAkselCatalog()

    expect(typeof catalog.akselVersion).toBe('string')
    expect(catalog.akselVersion).not.toBe('unknown')
    expect(catalog.components.length).toBeGreaterThan(0)

    const button = catalog.components.find((component) => component.name === 'Button')
    expect(button).toMatchObject({
      name: 'Button',
      resourceUri: akselComponentResourceUri('Button'),
    })

    for (const indexEntry of catalog.components) {
      const detail = catalog.componentsByName[indexEntry.name]
      expect(detail).toBeDefined()
      expect(detail.snippet.jsx).not.toMatch(/\bimport\b/)
      expect(detail.snippet.jsx).not.toContain('${')
      expect(detail.snippet.jsx).not.toMatch(/\{\{[\w]+\}\}/)
      if (detail.snippet.hooks) {
        expect(detail.snippet.hooks).not.toMatch(/\bimport\b/)
        expect(detail.snippet.hooks).not.toContain('${')
        expect(detail.snippet.hooks).not.toMatch(/\{\{[\w]+\}\}/)
      }
    }
  })

  it('encodes component resource URIs so names with spaces round-trip and stay dispatchable', () => {
    const componentDispatchPattern = /^arcade:\/\/aksel\/components\/([A-Za-z0-9.%\- ]+)$/
    const catalog = buildMcpAkselCatalog()

    expect(akselComponentResourceUri('Chips Toggle')).toBe(
      'arcade://aksel/components/Chips%20Toggle'
    )

    for (const indexEntry of catalog.components) {
      const match = indexEntry.resourceUri.match(componentDispatchPattern)
      expect(match, `unreachable resource URI for "${indexEntry.name}"`).not.toBeNull()
      expect(decodeURIComponent(match![1])).toBe(indexEntry.name)
    }
  })

  it('excludes deprecated component roots and icons from the authoring set', () => {
    const names = listMcpAuthoringEntries().map((entry) => entry.name)

    expect(names).toContain('Button')
    expect(names).toContain('Page')
    expect(names).not.toContain('Modal')
    expect(names).not.toContain('Alert')
    expect(listMcpAuthoringEntries().every((entry) => entry.group !== 'icon')).toBe(true)
  })

  it('keeps the committed desktop artifact in sync with the builder (no drift)', () => {
    const fileContents = fs.readFileSync(generatedArtifactPath, 'utf8')
    expect(fileContents).toBe(renderMcpAkselCatalogModule())

    const generated = require(generatedArtifactPath)
    expect(generated).toEqual(buildMcpAkselCatalog())
  })
})

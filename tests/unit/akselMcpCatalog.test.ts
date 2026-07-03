import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getNewAuthoringPolicy } from '../../src/data/akselAuthoringPolicy'
import { AKSEL_MCP_CATALOG_DATA } from '../../src/shared/desktopMcp/akselCatalogData.generated'
import {
  akselComponentResourceUri,
  buildMcpAkselCatalog,
  listMcpAuthoringEntries,
  renderSharedMcpAkselCatalogModule,
  resolveSnippetCode,
} from '../../scripts/lib/akselMcpCatalog'

const sharedGeneratedArtifactPath = path.resolve(
  process.cwd(),
  'src/shared/desktopMcp/akselCatalogData.generated.ts'
)

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
    expect(catalog.components.every((component) => !('keywords' in component))).toBe(true)
    expect(catalog.componentAliases).toMatchObject({
      RadioGroup: 'Radio',
    })
    expect(catalog.hiddenRootReplacements).toMatchObject({
      Alert: getNewAuthoringPolicy('Alert'),
      Modal: getNewAuthoringPolicy('Modal'),
      Dropdown: getNewAuthoringPolicy('Dropdown'),
    })

    const button = catalog.components.find((component) => component.name === 'Button')
    const infoCard = catalog.components.find((component) => component.name === 'InfoCard')
    expect(button).toMatchObject({
      name: 'Button',
      resourceUri: akselComponentResourceUri('Button'),
    })
    expect(infoCard).toMatchObject({
      name: 'InfoCard',
      resourceUri: akselComponentResourceUri('InfoCard'),
    })
    expect(catalog.componentsByName.InfoCard?.snippet.jsx).toContain(
      '<InfoCard data-color="info">'
    )

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
    expect(names).toContain('InfoCard')
    expect(names).toContain('Page')
    expect(names).not.toContain('Modal')
    expect(names).not.toContain('Alert')
    expect(listMcpAuthoringEntries().every((entry) => entry.group !== 'icon')).toBe(true)
  })

  it('keeps the committed shared artifact in sync with the builder (no drift)', () => {
    const sharedFileContents = fs.readFileSync(sharedGeneratedArtifactPath, 'utf8')
    expect(sharedFileContents).toBe(renderSharedMcpAkselCatalogModule())
    expect(AKSEL_MCP_CATALOG_DATA).toEqual(buildMcpAkselCatalog())
  })
})

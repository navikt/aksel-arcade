import { describe, expect, it } from 'vitest'
import iconMetadata from '@navikt/aksel-icons/metadata'
import {
  AKSEL_CATALOG,
  AKSEL_CATALOG_VERSION,
  getCatalogPaletteComponents,
  getCatalogPropValues,
  getCatalogSnippets,
  getCatalogTokenValues,
  listCatalogEntries,
} from '../../src/data/akselCatalog'
import { getComponentsByCategory } from '../../src/data/akselComponents'
import {
  AI_INSTRUCTIONS,
  AKSEL_METADATA,
  extractUsedComponents,
} from '../../src/data/akselMetadata'
import { getComponentProps, getPropValues } from '../../src/services/akselMetadata'
import { AKSEL_SNIPPETS, searchSnippets } from '../../src/services/componentLibrary'

describe('Aksel catalog starter path', () => {
  it('exposes checked-in v8 starter entries with docs, props, token metadata, and status', () => {
    expect(AKSEL_CATALOG_VERSION).toBe('8.11.0')
    expect(AKSEL_CATALOG.length).toBeGreaterThan(0)

    const currentLayout = listCatalogEntries({ groups: ['layout'], statuses: ['current'] })
    const currentComponents = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const iconEntries = listCatalogEntries({ groups: ['icon'], statuses: ['current'] })
    const experimentalComponents = listCatalogEntries({
      groups: ['component'],
      statuses: ['experimental'],
    })
    const legacyEntries = listCatalogEntries({ statuses: ['legacy'] })

    expect(currentLayout.some((entry) => entry.name === 'HStack')).toBe(true)
    expect(currentComponents.some((entry) => entry.name === 'Button')).toBe(true)
    expect(iconEntries.some((entry) => entry.name === 'PlusIcon')).toBe(true)
    expect(experimentalComponents.some((entry) => entry.name === 'FormProgress')).toBe(true)
    expect(legacyEntries.some((entry) => entry.name === 'BoxNew')).toBe(true)

    const hstack = currentLayout.find((entry) => entry.name === 'HStack')
    const plusIcon = iconEntries.find((entry) => entry.name === 'PlusIcon')
    expect(hstack?.docs).toContain('aksel.nav.no')
    expect(plusIcon?.docs).toContain('aksel.nav.no')
    expect(hstack?.props.find((prop) => prop.name === 'gap')?.values).toContain('space-16')
    expect(getCatalogTokenValues('spacing')).toContain('space-16')
  })

  it('adapts catalog entries into import-free snippets for palette and editor completions', () => {
    const snippets = getCatalogSnippets()
    const paletteComponents = getCatalogPaletteComponents()

    const hstackSnippet = snippets.find((snippet) => snippet.name === 'HStack')
    const buttonPaletteEntry = paletteComponents.find((component) => component.name === 'Button')

    expect(hstackSnippet?.template).toContain('gap="space-16"')
    expect(hstackSnippet?.template).not.toContain('${')
    expect(hstackSnippet?.template).not.toMatch(/^import\s/m)
    expect(buttonPaletteEntry?.snippet).toContain('<Button variant="primary">')
    expect(buttonPaletteEntry?.snippet).not.toContain('${')
    expect(buttonPaletteEntry?.snippet).not.toMatch(/^import\s/m)
  })

  it('exposes palette groups, experimental statuses, docs links, and icon snippets from the catalog', () => {
    const paletteComponents = getCatalogPaletteComponents()
    const layoutEntry = paletteComponents.find((component) => component.name === 'HStack')
    const experimentalEntry = paletteComponents.find(
      (component) => component.name === 'FormProgress'
    )
    const iconEntry = paletteComponents.find((component) => component.name === 'PlusIcon')

    expect(getComponentsByCategory('layout')).toContainEqual(
      expect.objectContaining({ name: 'HStack' })
    )
    expect(getComponentsByCategory('component')).toContainEqual(
      expect.objectContaining({ name: 'FormProgress', status: 'experimental' })
    )
    expect(getComponentsByCategory('icon')).toContainEqual(
      expect.objectContaining({ name: 'PlusIcon', category: 'icon' })
    )
    expect(layoutEntry?.docs).toContain('aksel.nav.no')
    expect(experimentalEntry?.status).toBe('experimental')
    expect(iconEntry?.snippet).toBe('<PlusIcon aria-hidden />')
  })

  it('mirrors the installed Aksel icon metadata in the Icons palette group', () => {
    const expectedIconNames = Object.values(iconMetadata)
      .map((icon) => `${icon.name}Icon`)
      .sort()
    const paletteIconNames = getComponentsByCategory('icon')
      .map((component) => component.name)
      .sort()

    expect(paletteIconNames).toHaveLength(expectedIconNames.length)
    expect(paletteIconNames).toEqual(expectedIconNames)
    expect(paletteIconNames).toContain('AirplaneIcon')
    expect(paletteIconNames).toContain('PlusIcon')
    expect(paletteIconNames).toContain('XMarkIcon')
  })

  it('keeps legacy entries cataloged but hidden from default palette and autocomplete discovery', () => {
    const legacyEntries = listCatalogEntries({ statuses: ['legacy'] })
    const paletteComponents = getCatalogPaletteComponents()

    expect(legacyEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['BoxNew', 'Stack', 'Grid'])
    )
    expect(paletteComponents.some((component) => component.name === 'BoxNew')).toBe(false)
    expect(getComponentsByCategory('layout').some((component) => component.name === 'Stack')).toBe(
      false
    )
    expect(AKSEL_SNIPPETS.some((snippet) => snippet.name === 'Grid')).toBe(false)
    expect(searchSnippets('boxnew')).toHaveLength(0)
  })

  it('makes the active palette helpers prefer catalog data for the starter subset', () => {
    const layoutComponents = getComponentsByCategory('layout')
    const hstack = layoutComponents.find((component) => component.name === 'HStack')

    expect(hstack?.snippet).toContain('gap="space-16"')
    expect(hstack?.snippet).not.toContain('gap="4"')
  })

  it('makes the editor snippet and prop metadata paths prefer the same catalog source', () => {
    const hstackSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'HStack')
    const searchResult = searchSnippets('button').find((snippet) => snippet.name === 'Button')

    expect(hstackSnippet?.template).toContain('gap="space-16"')
    expect(searchResult?.template).toContain('<Button variant="primary">')
    expect(getComponentProps('HStack')).toContain('gap')
    expect(getPropValues('HStack', 'gap')).toContain('space-16')
    expect(getPropValues('HStack', 'gap')).not.toContain('4')
    expect(getCatalogPropValues('Button', 'variant')).toContain('primary-neutral')
    expect(getPropValues('Button', 'variant')).toContain('primary-neutral')
    expect(getComponentProps('Button')).toContain('type')
    expect(getPropValues('Button', 'type')).toContain('submit')
  })

  it('uses catalog docs metadata when exporting detected components and icons', () => {
    const usedComponents = extractUsedComponents('<HStack><PlusIcon aria-hidden /></HStack>')
    const hstack = usedComponents.find((component) => component.name === 'HStack')
    const plusIcon = usedComponents.find((component) => component.name === 'PlusIcon')

    expect(hstack?.docs).toContain('/hstack')
    expect(plusIcon?.import).toBe('@navikt/aksel-icons')
    expect(plusIcon?.docs).toContain('/ikoner')
  })

  it('keeps exported Aksel metadata current for v8 setup and breakpoint guidance', () => {
    expect(AKSEL_METADATA.designSystem).toBe('Aksel v8')
    expect(AKSEL_METADATA.packageVersions['@navikt/ds-react']).toBe('8.11.0')
    expect(AKSEL_METADATA.packageVersions['@navikt/ds-css']).toBe('8.11.0')
    expect(AKSEL_METADATA.packageVersions['@navikt/aksel-icons']).toBe('8.11.0')
    expect(AKSEL_METADATA.setup.cssImport).toBe("import '@navikt/ds-css';")
    expect(AKSEL_METADATA.setup.install).toContain('--save-exact')
    expect(AKSEL_METADATA.breakpoints['2xl']).toBe('1440px')
    expect(AKSEL_METADATA.documentation.setup).toContain('kom-i-gang-med-kodepakkene')
    expect(AKSEL_METADATA.authoring.playground).toContain('import-free')
    expect(AI_INSTRUCTIONS).toContain('Arcade source code is intentionally import-free')
    expect(AI_INSTRUCTIONS).toContain('@navikt/ds-react@8.11.0')
  })
})

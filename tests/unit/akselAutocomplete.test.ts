import { describe, expect, it } from 'vitest'
import iconMetadata from '@navikt/aksel-icons/metadata'
import { AKSEL_AUTOCOMPLETE_ENTRIES } from '../../src/data/akselAutocompleteData'
import { getAkselCompletionForSource } from '../../src/services/akselAutocomplete'

function labelsFor(source: string): string[] {
  const result = getAkselCompletionForSource(source, source.length)
  return result?.options.map((option) => option.label) ?? []
}

describe('Aksel-aware autocomplete contract', () => {
  it('suggests every documented Aksel primitive and component tag', () => {
    const labels = labelsFor('<')
    const documentedNames = AKSEL_AUTOCOMPLETE_ENTRIES.map((entry) => entry.name)

    expect(labels).toEqual(expect.arrayContaining(documentedNames))
    expect(labels).toEqual(
      expect.arrayContaining([
        'Page',
        'Box',
        'Accordion',
        'ActionMenu',
        'Combobox',
        'DataGrid',
        'Dialog',
        'GlobalAlert',
        'InfoCard',
        'LocalAlert',
        'Navpoleonskake',
        'Panel',
        'Ingress',
      ])
    )
  })

  it('keeps Aksel icons out of default component tag suggestions', () => {
    const labels = labelsFor('<')
    const iconNames = Object.values(iconMetadata).map((icon) => `${icon.name}Icon`)

    expect(iconNames).toHaveLength(949)
    expect(labels).not.toEqual(expect.arrayContaining(['AirplaneIcon', 'PlusIcon', 'XMarkIcon']))
  })

  it('suggests every Aksel icon tag in icon prop contexts', () => {
    const labels = labelsFor('<Button icon={<')
    const iconNames = Object.values(iconMetadata).map((icon) => `${icon.name}Icon`)

    expect(iconNames).toHaveLength(949)
    expect(labels).toEqual(expect.arrayContaining(iconNames))
    expect(labels).not.toContain('Button')
  })

  it('suggests icons for icon-looking JSX tag identifiers', () => {
    expect(labelsFor('<Pl')).not.toContain('PlusIcon')
    expect(labelsFor('<Plus')).toContain('PlusIcon')
    expect(labelsFor('<PlusIcon')).toContain('PlusIcon')
    expect(labelsFor('<Link')).toContain('Link')
    expect(labelsFor('<Link')).not.toContain('LinkIcon')
    expect(labelsFor('<LinkIcon')).toContain('LinkIcon')
  })

  it('suggests catalog subcomponents in JSX tag context', () => {
    expect(labelsFor('<Page.')).toContain('Page.Block')
    expect(labelsFor('<Accordion.')).toEqual(
      expect.arrayContaining(['Accordion.Item', 'Accordion.Header', 'Accordion.Content'])
    )
  })

  it('suggests props for formatted multi-line JSX opening tags', () => {
    const labels = labelsFor('<Button\n  variant="primary"\n  d')

    expect(labels).toContain('disabled')
  })

  it('suggests props for catalog subcomponents', () => {
    const labels = labelsFor('<Page.Block\n  w')

    expect(labels).toContain('width')
  })

  it('suggests docs-backed props for all documented components', () => {
    expect(labelsFor('<Box a')).toContain('asChild')
    expect(labelsFor('<Accordion s')).toContain('size')
    expect(labelsFor('<DataGrid c')).toContain('columns')
    expect(labelsFor('<UNSAFE_Combobox l')).toContain('label')
    expect(labelsFor('<PlusIcon aria-')).toContain('aria-hidden')
  })

  it('does not mix icon tags into normal prop suggestions', () => {
    const labels = labelsFor('<Button i')

    expect(labels).toContain('icon')
    expect(labels).not.toContain('PlusIcon')
  })

  it('suggests enum values for component props', () => {
    const labels = labelsFor('<Button variant="secondary-')

    expect(labels).toContain('secondary-neutral')
  })

  it('suggests v8 spacing token values for layout spacing props', () => {
    const labels = labelsFor('<HStack gap="space-1')

    expect(labels).toContain('space-12')
    expect(labels).toContain('space-16')
    expect(labels).not.toContain('4')
  })

  it('suggests Box styling values from the catalog', () => {
    expect(labelsFor('<Box background="neutral-')).toContain('neutral-soft')
    expect(labelsFor('<Box background="brand-beige-')).toContain('brand-beige-soft')
    expect(labelsFor('<Box borderColor="neutral-')).toContain('neutral-subtle')
    expect(labelsFor('<Box borderRadius="')).toContain('full')
    expect(labelsFor('<Box borderWidth="')).toContain('1')
    expect(labelsFor('<Box borderWidth="0 0 0 ')).toContain('0 0 0 1')
    expect(labelsFor('<Box shadow="')).toContain('dialog')
  })

  it('suggests data-color values in relevant prop contexts', () => {
    const labels = labelsFor('<Page data-color="brand-')

    expect(labels).toContain('brand-magenta')
    expect(labels).toContain('brand-beige')
    expect(labels).toContain('brand-blue')
  })

  it('suggests SVG prop values for icons', () => {
    expect(labelsFor('<PlusIcon aria-hidden="t')).toContain('true')
    expect(labelsFor('<PlusIcon role="im')).toContain('img')
  })

  it('suggests icons for icon prop expression values', () => {
    expect(labelsFor('<Button icon={Pl')).toContain('PlusIcon')
    expect(labelsFor('<Button icon={<Pl')).toContain('PlusIcon')
  })
})

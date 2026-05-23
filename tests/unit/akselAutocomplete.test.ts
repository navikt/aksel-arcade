import { describe, expect, it } from 'vitest'
import { getAkselCompletionForSource } from '../../src/services/akselAutocomplete'

function labelsFor(source: string): string[] {
  const result = getAkselCompletionForSource(source, source.length)
  return result?.options.map((option) => option.label) ?? []
}

describe('Aksel-aware autocomplete contract', () => {
  it('suggests current catalog component tags without legacy entries or icons', () => {
    const labels = labelsFor('<B')

    expect(labels).toContain('Button')
    expect(labels).toContain('Box')
    expect(labels).not.toContain('BoxNew')
    expect(labels).not.toContain('PlusIcon')
  })

  it('suggests catalog subcomponents in JSX tag context', () => {
    expect(labelsFor('<Page.')).toContain('Page.Block')
  })

  it('suggests props for formatted multi-line JSX opening tags', () => {
    const labels = labelsFor('<Button\n  variant="primary"\n  d')

    expect(labels).toContain('disabled')
  })

  it('suggests props for catalog subcomponents', () => {
    const labels = labelsFor('<Page.Block\n  w')

    expect(labels).toContain('width')
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
    expect(labelsFor('<Box borderColor="neutral-')).toContain('neutral-subtle')
    expect(labelsFor('<Box borderRadius="')).toContain('full')
    expect(labelsFor('<Box borderWidth="')).toContain('1')
    expect(labelsFor('<Box shadow="')).toContain('dialog')
  })

  it('suggests data-color values in relevant prop contexts', () => {
    const labels = labelsFor('<Page data-color="brand-')

    expect(labels).toContain('brand-magenta')
    expect(labels).toContain('brand-beige')
    expect(labels).toContain('brand-blue')
  })
})

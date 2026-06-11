import { describe, expect, it } from 'vitest'
import iconMetadata from '@navikt/aksel-icons/metadata'
import { filterNewAuthoringEntries } from '../../src/data/akselAuthoringPolicy'
import { AKSEL_AUTOCOMPLETE_ENTRIES, AKSEL_ICON_PROPS } from '../../src/data/akselAutocompleteData'
import { listCatalogEntries } from '../../src/data/akselCatalog'
import { getAkselCompletionForSource } from '../../src/services/akselAutocomplete'

interface PropWithCompletionMetadata {
  name: string
  type: string
  values?: string[]
}

const PAGE_NAVIGATION_TARGETS = [
  { id: 'page01', name: 'Start' },
  { id: 'page02', name: 'Details' },
  { id: 'page03', name: 'Summary' },
] as const

function completionFor(
  source: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2]
) {
  return getAkselCompletionForSource(source, source.length, pageNavigationTargets)
}

function labelsFor(
  source: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2]
): string[] {
  const result = completionFor(source, pageNavigationTargets)
  return result?.options.map((option) => option.label) ?? []
}

function applyFor(
  source: string,
  label: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2]
): string | undefined {
  const apply = completionFor(source, pageNavigationTargets)?.options.find(
    (option) => option.label === label
  )?.apply
  return typeof apply === 'string' ? apply : undefined
}

function optionFor(
  source: string,
  label: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2]
) {
  return completionFor(source, pageNavigationTargets)?.options.find(
    (option) => option.label === label
  )
}

const BOOLEAN_COMPLETION_VALUES = new Set(['true', 'false'])
const COMPONENT_COMPLETION_NAME = /^[A-Z][\w.]*$/
const SPACING_TOKEN_LABELS = [
  'space-0',
  'space-1',
  'space-2',
  'space-4',
  'space-6',
  'space-8',
  'space-12',
  'space-16',
  'space-20',
  'space-24',
  'space-28',
  'space-32',
  'space-36',
  'space-40',
  'space-44',
  'space-48',
  'space-56',
  'space-64',
  'space-72',
  'space-80',
  'space-96',
  'space-128',
]

function isBooleanLikeProp(prop: PropWithCompletionMetadata): boolean {
  const values = prop.values ?? []
  const hasNonBooleanValues = values.some((value) => !BOOLEAN_COMPLETION_VALUES.has(value))

  return !hasNonBooleanValues && /\bboolean(?:ish)?\b/i.test(prop.type.replace(/`/g, ''))
}

function booleanLikePropCases(): Array<[componentName: string, propName: string]> {
  const cases = new Map<string, [componentName: string, propName: string]>()
  const addProp = (componentName: string, prop: PropWithCompletionMetadata) => {
    if (
      !COMPONENT_COMPLETION_NAME.test(componentName) ||
      !/^[\w-]+$/.test(prop.name) ||
      !isBooleanLikeProp(prop)
    ) {
      return
    }

    cases.set(`${componentName}.${prop.name}`, [componentName, prop.name])
  }

  for (const entry of filterNewAuthoringEntries(AKSEL_AUTOCOMPLETE_ENTRIES)) {
    for (const prop of entry.props) {
      addProp(entry.name, prop)
    }
  }

  for (const entry of listCatalogEntries({
    groups: ['layout', 'component'],
    statuses: ['current', 'experimental'],
  })) {
    for (const prop of entry.props) {
      addProp(entry.name, prop)
    }
  }

  for (const prop of AKSEL_ICON_PROPS) {
    addProp('PlusIcon', prop)
  }

  return Array.from(cases.values())
}

describe('Aksel-aware autocomplete contract', () => {
  it('suggests every documented Aksel primitive and component tag still valid for new authoring', () => {
    const labels = labelsFor('<')
    const documentedNames = filterNewAuthoringEntries(AKSEL_AUTOCOMPLETE_ENTRIES).map(
      (entry) => entry.name
    )

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
    expect(labels).not.toContain('UNSAFE_Combobox')
  })

  it('hides deprecated Alert and replaced Modal from new authoring autocomplete surfaces', () => {
    expect(labelsFor('<A')).toContain('ActionMenu')
    expect(labelsFor('<A')).not.toContain('Alert')
    expect(labelsFor('<M')).toContain('MonthPicker')
    expect(labelsFor('<M')).not.toContain('Modal')
    expect(labelsFor('<Modal.')).toEqual([])
    expect(labelsFor('<Alert v')).toEqual([])
    expect(labelsFor('<Alert variant="i')).toEqual([])
    expect(labelsFor('<Modal o')).toEqual([])
  })

  it('prefers catalog-backed tracer details and insertions for top-level BodyShort, Heading, and Tag', () => {
    expect(optionFor('<Body', 'BodyShort')?.detail).toBe(
      'Short body text with compact line height.'
    )
    expect(applyFor('<Body', 'BodyShort')).toBe('BodyShort>Short text</BodyShort>')
    expect(optionFor('<Head', 'Heading')?.detail).toBe('Heading text.')
    expect(applyFor('<Head', 'Heading')).toBe(
      'Heading level="1" size="large">Heading text</Heading>'
    )
    expect(optionFor('<Tag', 'Tag')?.detail).toBe('Tag label component.')
    expect(applyFor('<Tag', 'Tag')).toBe(
      'Tag variant="moderate" data-color="info">In progress</Tag>'
    )
  })

  it('keeps Combobox as the only author-facing autocomplete name', () => {
    expect(labelsFor('<Comb')).toContain('Combobox')
    expect(applyFor('<Comb', 'Combobox')).toBe('Combobox')
    expect(labelsFor('<UNSAFE')).not.toContain('UNSAFE_Combobox')
  })

  it('keeps legacy UNSAFE_Combobox prop and value completions working for stored source', () => {
    expect(labelsFor('<UNSAFE_Combobox l')).toContain('label')
    expect(labelsFor('<UNSAFE_Combobox readOnly="t')).toContain('true')
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
    expect(labelsFor('<dogh')[0]).toBe('DogHarnessIcon')
    expect(labelsFor('<DogH')[0]).toBe('DogHarnessIcon')
    expect(labelsFor('<Dogh')[0]).toBe('DogHarnessIcon')
    expect(labelsFor('<DOGH')[0]).toBe('DogHarnessIcon')
    expect(applyFor('<DogHarnessIcon', 'DogHarnessIcon')).toBe(
      'DogHarnessIcon title="a11y-title" fontSize="1.5rem" />'
    )
    expect(labelsFor('<Box><dogh')[0]).toBe('DogHarnessIcon')
    expect(labelsFor('<Box><DogH')[0]).toBe('DogHarnessIcon')
    expect(labelsFor('<Box>DogH')).not.toContain('DogHarnessIcon')
    expect(labelsFor('<div')).not.toContain('Dialog')
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
    expect(labelsFor('<Combobox l')).toContain('label')
    expect(labelsFor('<PlusIcon aria-')).toContain('aria-hidden')
  })

  it('applies boolean-like props as JSX shorthand instead of empty strings', () => {
    const booleanProps = booleanLikePropCases()

    expect(booleanProps.length).toBeGreaterThan(0)
    expect(applyFor('<Box a', 'asChild')).toBe('asChild')
    expect(applyFor('<Button d', 'disabled')).toBe('disabled')
    expect(applyFor('<PlusIcon aria-h', 'aria-hidden')).toBe('aria-hidden')
    expect(applyFor('<Button v', 'variant')).toBe('variant=""')

    for (const [componentName, propName] of booleanProps) {
      expect(
        applyFor(`<${componentName} ${propName}`, propName),
        `${componentName}.${propName}`
      ).toBe(propName)
    }
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

  it('shows primitive spacing values in chronological order without compound duplicates', () => {
    expect(labelsFor('<HStack gap="')).toEqual(SPACING_TOKEN_LABELS)
    expect(labelsFor('<Box padding="')).toEqual(SPACING_TOKEN_LABELS)
  })

  it('suggests Box styling values from the catalog', () => {
    expect(labelsFor('<Box background="')).toContain('default')
    expect(labelsFor('<Box background="neutral-')).toContain('neutral-soft')
    expect(labelsFor('<Box background="brand-beige-')).toContain('brand-beige-soft')
    expect(labelsFor('<Box background="bg-')).toContain('bg-default')
    expect(applyFor('<Box background="bg-', 'bg-default')).toBe('default')
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
    expect(applyFor('<Button icon={<DogH', 'DogHarnessIcon')).toBe(
      'DogHarnessIcon title="a11y-title" fontSize="1.5rem" />}'
    )
  })

  it('suggests page navigation targets inside goToPage calls', () => {
    const option = optionFor(
      "const handleClick = () => goToPage('Det",
      'Details',
      PAGE_NAVIGATION_TARGETS
    )

    expect(labelsFor("const handleClick = () => goToPage('", PAGE_NAVIGATION_TARGETS)).toEqual([
      'Start',
      'Details',
      'Summary',
    ])
    expect(labelsFor("const handleClick = () => goToPage('page0", PAGE_NAVIGATION_TARGETS)).toEqual(
      ['Start', 'Details', 'Summary']
    )
    expect(option?.detail).toBe('page02')
    expect(
      applyFor("const handleClick = () => goToPage('Det", 'Details', PAGE_NAVIGATION_TARGETS)
    ).toBe('page02')
  })

  it('suggests page navigation targets inside href and to values', () => {
    const hrefOption = optionFor('<Link href="Su', 'Summary', PAGE_NAVIGATION_TARGETS)
    const toOption = optionFor('<Link to={"page02', 'Details', PAGE_NAVIGATION_TARGETS)

    expect(hrefOption?.detail).toBe('page03')
    expect(applyFor('<Link href="Su', 'Summary', PAGE_NAVIGATION_TARGETS)).toBe('page03')
    expect(toOption?.detail).toBe('page02')
    expect(applyFor('<Link to={"page02', 'Details', PAGE_NAVIGATION_TARGETS)).toBe('page02')
  })

  it('does not suggest page navigation targets outside supported contexts', () => {
    expect(completionFor("const target = 'page0", PAGE_NAVIGATION_TARGETS)).toBeNull()
    expect(completionFor('<Link id="page0', PAGE_NAVIGATION_TARGETS)).toBeNull()
    expect(completionFor('<Link href="https://', PAGE_NAVIGATION_TARGETS)).toBeNull()
    expect(completionFor('goToPage(page0', PAGE_NAVIGATION_TARGETS)).toBeNull()
  })
})

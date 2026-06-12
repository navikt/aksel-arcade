import { describe, expect, it, vi } from 'vitest'
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
const NOOP_APPLY_CATALOG_INSERTION = () => {}

function completionFor(
  source: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2],
  onApplyCatalogInsertion?: Parameters<typeof getAkselCompletionForSource>[3]
) {
  return getAkselCompletionForSource(
    source,
    source.length,
    pageNavigationTargets,
    onApplyCatalogInsertion ?? NOOP_APPLY_CATALOG_INSERTION
  )
}

function labelsFor(
  source: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2],
  onApplyCatalogInsertion?: Parameters<typeof getAkselCompletionForSource>[3]
): string[] {
  const result = completionFor(source, pageNavigationTargets, onApplyCatalogInsertion)
  return result?.options.map((option) => option.label) ?? []
}

function applyFor(
  source: string,
  label: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2],
  onApplyCatalogInsertion?: Parameters<typeof getAkselCompletionForSource>[3]
): string | undefined {
  const apply = completionFor(source, pageNavigationTargets, onApplyCatalogInsertion)?.options.find(
    (option) => option.label === label
  )?.apply
  return typeof apply === 'string' ? apply : undefined
}

function optionFor(
  source: string,
  label: string,
  pageNavigationTargets?: Parameters<typeof getAkselCompletionForSource>[2],
  onApplyCatalogInsertion?: Parameters<typeof getAkselCompletionForSource>[3]
) {
  return completionFor(source, pageNavigationTargets, onApplyCatalogInsertion)?.options.find(
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
    const variantImportNames = new Set(
      listCatalogEntries({
        groups: ['layout', 'component'],
        statuses: ['current', 'experimental'],
      })
        .filter((entry) => entry.name.includes(' '))
        .map((entry) => entry.importName)
    )
    const documentedNames = filterNewAuthoringEntries(AKSEL_AUTOCOMPLETE_ENTRIES).map(
      (entry) => entry.name
    )
    const topLevelDocumentedNames = documentedNames.filter(
      (name) =>
        COMPONENT_COMPLETION_NAME.test(name) && !name.includes('.') && !variantImportNames.has(name)
    )

    expect(labels).toEqual(expect.arrayContaining(topLevelDocumentedNames))
    expect(labels).toEqual(
      expect.arrayContaining([
        'Page',
        'Box',
        'Accordion',
        'ActionMenu',
        'Chips Toggle',
        'Chips Removable',
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

  it('prefers catalog-backed Issue 209 details and insertions for top-level targets', () => {
    expect(labelsFor('<Chips')).toEqual(expect.arrayContaining(['Chips Toggle', 'Chips Removable']))
    expect(labelsFor('<Chips')).not.toContain('Chips')
    expect(labelsFor('<ChipsT')).toContain('Chips Toggle')
    expect(labelsFor('<ChipsR')).toContain('Chips Removable')
    expect(optionFor('<Load', 'Loader')?.detail).toBe('Loading spinner with visible status text.')
    expect(applyFor('<Load', 'Loader')).toContain(
      '<Loader size="xlarge" title="Loading case details" />'
    )
    expect(optionFor('<Prog', 'ProgressBar')?.detail).toBe(
      'Progress bar with a visible accessible label.'
    )
    expect(applyFor('<Prog', 'ProgressBar')).toContain(
      'ProgressBar value={5} valueMax={7} aria-labelledby="application-progress-label"'
    )
    expect(optionFor('<Skel', 'Skeleton')?.detail).toBe(
      'Skeleton stack for a loading card placeholder.'
    )
    expect(applyFor('<Skel', 'Skeleton')).toContain('<Skeleton variant="rounded" height={80} />')
    expect(optionFor('<Tabl', 'Table')?.detail).toBe(
      'Complete table with headers and visible data rows.'
    )
    expect(applyFor('<Tabl', 'Table')).toContain(
      '<Table.HeaderCell scope="row">Payments</Table.HeaderCell>'
    )
  })

  it('prefers catalog-backed form control details and insertions for top-level targets', () => {
    expect(optionFor('<Check', 'Checkbox')?.detail).toBe('Checkbox input with a visible label.')
    expect(applyFor('<Check', 'Checkbox')).toContain('description="You can change this later."')
    expect(applyFor('<Check', 'Checkbox')).toContain('name="emailUpdates"')
    expect(optionFor('<Radio', 'Radio')?.detail).toBe(
      'Single-choice radio group with a visible legend.'
    )
    expect(applyFor('<Radio', 'Radio')).toContain(
      'RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">'
    )
    expect(optionFor('<Sear', 'Search')?.detail).toBe(
      'Search field inside an accessible search form.'
    )
    expect(applyFor('<Sear', 'Search')).toContain(
      'form role="search" onSubmit={(event) => event.preventDefault()}'
    )
    expect(applyFor('<Sele', 'Select')).toContain('defaultValue=""')
    expect(applyFor('<Swit', 'Switch')).toContain('defaultChecked')
    expect(applyFor('<Texta', 'Textarea')).toContain('minRows={4}')
  })

  it('prefers catalog-backed feedback and form-shell details and insertions for top-level targets', () => {
    expect(optionFor('<Inline', 'InlineMessage')?.detail).toBe(
      'Inline status message for short feedback.'
    )
    expect(applyFor('<Inline', 'InlineMessage')).toBe(
      'InlineMessage status="success">Draft saved at 14:35</InlineMessage>'
    )
    expect(optionFor('<Global', 'GlobalAlert')?.detail).toBe(
      'Page-wide alert banner for important updates.'
    )
    expect(applyFor('<Global', 'GlobalAlert')).toContain('GlobalAlert status="announcement">')
    expect(optionFor('<Local', 'LocalAlert')?.detail).toBe(
      'Section-level alert for nearby feedback.'
    )
    expect(applyFor('<Local', 'LocalAlert')).toContain('LocalAlert status="warning">')
    expect(applyFor('<Field', 'Fieldset')).toContain('Fieldset legend="Employer phone number">')
    expect(applyFor('<CheckboxG', 'CheckboxGroup')).toContain('defaultValue={["email"]}')
    expect(applyFor('<ErrorM', 'ErrorMessage')).toContain('showIcon')
    expect(applyFor('<ErrorS', 'ErrorSummary')).toContain(
      'ErrorSummary heading="You must fix these errors before continuing:"'
    )
    expect(applyFor('<FileU', 'FileUpload')).toContain('FileUpload.Dropzone')
    expect(applyFor('<FormS', 'FormSummary')).toContain('<FormSummary.Footer>')
    expect(optionFor('<FormP', 'FormProgress')?.detail).toBe(
      'Experimental step indicator for multi-step forms.'
    )
  })

  it('prefers catalog-backed menu, overlay, and help details and insertions for top-level targets', () => {
    expect(optionFor('<Action', 'ActionMenu')?.detail).toBe(
      'Action menu with trigger button and grouped actions.'
    )
    expect(applyFor('<Action', 'ActionMenu')).toContain('<ActionMenu.Trigger>')
    expect(applyFor('<Action', 'ActionMenu')).toContain('<ActionMenu.Group label="Case actions">')
    expect(optionFor('<Drop', 'Dropdown')?.detail).toBe(
      'Dropdown menu with grouped and simple item lists.'
    )
    expect(applyFor('<Drop', 'Dropdown')).toContain('<Dropdown.Menu.GroupedList>')
    expect(applyFor('<Drop', 'Dropdown')).toContain('<Dropdown.Menu.Divider />')
    expect(optionFor('<Help', 'HelpText')?.detail).toBe(
      'Inline help trigger with explanatory text.'
    )
    expect(applyFor('<Help', 'HelpText')).toContain('HStack gap="space-4" align="center">')
    expect(optionFor('<Tool', 'Tooltip')?.detail).toBe('Tooltip around a visible trigger button.')
    expect(applyFor('<Tool', 'Tooltip')).toContain('describesChild')
  })

  it('prefers catalog-backed compound workflow details and insertions for top-level targets', () => {
    expect(optionFor('<Acco', 'Accordion')?.detail).toBe(
      'Accordion with related questions and one answer expanded.'
    )
    expect(applyFor('<Acco', 'Accordion')).toContain('<Accordion.Item defaultOpen>')
    expect(applyFor('<Acco', 'Accordion')).toContain(
      '<Accordion.Header>How do I change my meeting time?</Accordion.Header>'
    )
    expect(optionFor('<Expa', 'ExpansionCard')?.detail).toBe(
      'Expansion card with visible summary and expanded details.'
    )
    expect(applyFor('<Expa', 'ExpansionCard')).toContain('<ExpansionCard.Description>')
    expect(applyFor('<Proc', 'Process')).toContain('<Process.Event status="completed"')
    expect(applyFor('<Proc', 'Process')).not.toContain('Process.Step')
    expect(optionFor('<Read', 'ReadMore')?.detail).toBe(
      'Expandable explanation text with a visible header.'
    )
    expect(applyFor('<Read', 'ReadMore')).toContain('header="Why we ask about income"')
    expect(optionFor('<Step', 'Stepper')?.detail).toBe(
      'Stepper with a valid current step and visible navigation labels.'
    )
    expect(applyFor('<Step', 'Stepper')).toContain('activeStep={2}')
    expect(applyFor('<Step', 'Stepper')).not.toContain('activeStep={0}')
    expect(optionFor('<Time', 'Timeline')?.detail).toBe(
      'Timeline with rows, dated periods, and a visible pin.'
    )
    expect(applyFor('<Time', 'Timeline')).toContain('<Timeline.Pin date={new Date("2025-05-12")}>')
    expect(applyFor('<Time', 'Timeline')).not.toContain('Timeline.Content')
  })

  it('routes Pagination through the catalog insertion callback with composable JSX', () => {
    const onApplyCatalogInsertion = vi.fn()
    const option = optionFor('<Pagi', 'Pagination', undefined, onApplyCatalogInsertion)

    expect(option?.detail).toBe('Pagination controls with Hooks-tab state.')
    expect(typeof option?.apply).toBe('function')

    if (typeof option?.apply !== 'function') {
      throw new Error('Expected Pagination completion to use a custom apply callback')
    }

    option.apply({} as never, option as never, 0, 5)

    expect(onApplyCatalogInsertion).toHaveBeenCalledWith({
      from: 0,
      to: 5,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining(
          'Pagination\n  {...usePaginationState{{paginationSuffix}}()}\n  count={9}'
        ),
        hooks: expect.stringContaining(
          'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {'
        ),
      }),
    })
  })

  it('routes Popover through the catalog insertion callback with composable JSX', () => {
    const onApplyCatalogInsertion = vi.fn()
    const option = optionFor('<Pop', 'Popover', undefined, onApplyCatalogInsertion)

    expect(option?.detail).toBe('Controlled popover with trigger, anchor, and close behavior.')
    expect(typeof option?.apply).toBe('function')

    if (typeof option?.apply !== 'function') {
      throw new Error('Expected Popover completion to use a custom apply callback')
    }

    option.apply({} as never, option as never, 0, '<Pop'.length)

    expect(onApplyCatalogInsertion).toHaveBeenCalledWith({
      from: 0,
      to: '<Pop'.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('Button\n  ref={setAnchorEl{{popoverSuffix}}}'),
        hooks: expect.stringContaining('const popoverId{{popoverSuffix}} = useId()'),
      }),
    })
  })

  it('routes DatePicker, MonthPicker, and ToggleGroup through the catalog insertion callback', () => {
    const onApplyCatalogInsertion = vi.fn()
    const cases = [
      {
        source: '<DateP',
        label: 'DatePicker',
        expectedJsx: '<DatePickerField{{datePickerFieldSuffix}} />',
        expectedHooks: 'useDatepicker({',
      },
      {
        source: '<MonthP',
        label: 'MonthPicker',
        expectedJsx: '<MonthPickerField{{monthPickerFieldSuffix}} />',
        expectedHooks: 'useMonthpicker({',
      },
      {
        source: '<ToggleG',
        label: 'ToggleGroup',
        expectedJsx: '<ToggleGroup\n  {...useToggleGroupState{{toggleGroupSuffix}}()}',
        expectedHooks:
          'export const useToggleGroupState{{toggleGroupSuffix}} = (initialValue = "list") => {',
      },
    ] as const

    for (const { source, label } of cases) {
      const option = optionFor(source, label, undefined, onApplyCatalogInsertion)

      expect(option?.detail).not.toBeUndefined()
      expect(typeof option?.apply).toBe('function')

      if (typeof option?.apply !== 'function') {
        throw new Error(`Expected ${label} completion to use a custom apply callback`)
      }

      option.apply({} as never, option as never, 0, source.length)
    }

    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(1, {
      from: 0,
      to: '<DateP'.length,
      insertion: expect.objectContaining({
        jsx: 'DatePickerField{{datePickerFieldSuffix}} />',
        hooks: expect.stringContaining('useDatepicker({'),
      }),
    })
    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(2, {
      from: 0,
      to: '<MonthP'.length,
      insertion: expect.objectContaining({
        jsx: 'MonthPickerField{{monthPickerFieldSuffix}} />',
        hooks: expect.stringContaining('useMonthpicker({'),
      }),
    })
    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(3, {
      from: 0,
      to: '<ToggleG'.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('{...useToggleGroupState{{toggleGroupSuffix}}()}'),
        hooks: expect.stringContaining(
          'export const useToggleGroupState{{toggleGroupSuffix}} = (initialValue = "list") => {'
        ),
      }),
    })
  })

  it('routes Chips Toggle and Chips Removable through the catalog insertion callback', () => {
    const onApplyCatalogInsertion = vi.fn()
    const cases = [
      {
        source: '<ChipsT',
        label: 'Chips Toggle',
      },
      {
        source: '<ChipsR',
        label: 'Chips Removable',
      },
    ] as const

    for (const { source, label } of cases) {
      const option = optionFor(source, label, undefined, onApplyCatalogInsertion)

      expect(option?.detail).not.toBeUndefined()
      expect(typeof option?.apply).toBe('function')

      if (typeof option?.apply !== 'function') {
        throw new Error(`Expected ${label} completion to use a custom apply callback`)
      }

      option.apply({} as never, option as never, 0, source.length)
    }

    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(1, {
      from: 0,
      to: '<ChipsT'.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('selected={selected{{chipsToggleSuffix}} === id}'),
        hooks: expect.stringContaining(
          'const [selected{{chipsToggleSuffix}}, setSelected{{chipsToggleSuffix}}] = useState(0)'
        ),
      }),
    })
    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(2, {
      from: 0,
      to: '<ChipsR'.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('setFilter{{chipsRemovableSuffix}}((x) =>'),
        hooks: expect.stringContaining(
          'const [filter{{chipsRemovableSuffix}}, setFilter{{chipsRemovableSuffix}}] = useState(options{{chipsRemovableSuffix}})'
        ),
      }),
    })
    expect(onApplyCatalogInsertion.mock.calls[0]?.[0]?.insertion.jsx).not.toContain(
      'ChipsToggleExample'
    )
    expect(onApplyCatalogInsertion.mock.calls[1]?.[0]?.insertion.jsx).not.toContain(
      'ChipsRemovableExample'
    )
  })

  it('routes Dialog through the catalog insertion callback with trigger and close support', () => {
    const onApplyCatalogInsertion = vi.fn()
    const option = optionFor('<Dial', 'Dialog', undefined, onApplyCatalogInsertion)

    expect(option?.detail).toBe('Controlled dialog with trigger and close actions.')
    expect(typeof option?.apply).toBe('function')

    if (typeof option?.apply !== 'function') {
      throw new Error('Expected Dialog completion to use a custom apply callback')
    }

    option.apply({} as never, option as never, 0, '<Dial'.length)

    const [call] = onApplyCatalogInsertion.mock.calls
    expect(call?.[0]).toMatchObject({
      from: 0,
      to: '<Dial'.length,
      insertion: expect.objectContaining({
        jsx: 'ReviewDialog{{dialogSuffix}} />',
      }),
    })
    expect(call?.[0]?.insertion.hooks).toContain(
      'export const ReviewDialog{{dialogSuffix}} = () => {'
    )
    expect(call?.[0]?.insertion.hooks).toContain('Dialog.CloseTrigger')
    expect(call?.[0]?.insertion.hooks).toContain('review-dialog-popup{{dialogSuffix}}')
  })

  it('routes Tabs through the catalog insertion callback with controlled state', () => {
    const onApplyCatalogInsertion = vi.fn()
    const option = optionFor('<Tabs', 'Tabs', undefined, onApplyCatalogInsertion)

    expect(option?.detail).toBe('Controlled tabs with Hooks-tab state and three panels.')
    expect(typeof option?.apply).toBe('function')

    if (typeof option?.apply !== 'function') {
      throw new Error('Expected Tabs completion to use a custom apply callback')
    }

    option.apply({} as never, option as never, 0, '<Tabs'.length)

    expect(onApplyCatalogInsertion).toHaveBeenCalledWith({
      from: 0,
      to: '<Tabs'.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('{...useTabsState{{tabsSuffix}}()}'),
        hooks: expect.stringContaining(
          'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {'
        ),
      }),
    })
  })

  it('hides multi-part catalog insertions when the editor cannot apply them safely', () => {
    const cases = [
      ['<DateP', 'DatePicker'],
      ['<Dial', 'Dialog'],
      ['<MonthP', 'MonthPicker'],
      ['<Pagi', 'Pagination'],
      ['<Tabs', 'Tabs'],
      ['<ToggleG', 'ToggleGroup'],
    ] as const

    for (const [source, label] of cases) {
      const result = getAkselCompletionForSource(source, source.length, undefined, undefined)
      expect(result?.options.find((option) => option.label === label)).toBeUndefined()
    }
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

  it('keeps curated dotted top-level entries while hiding contextual-only subcomponents at top level', () => {
    expect(labelsFor('<Page.')).toContain('Page.Block')
    expect(labelsFor('<Accordion.')).toEqual([])
    expect(labelsFor('<ActionMenu.')).toEqual([])
    expect(labelsFor('<Dropdown.')).toEqual([])
    expect(labelsFor('<ExpansionCard.')).toEqual([])
    expect(labelsFor('<Process.')).toEqual([])
    expect(labelsFor('<Stepper.')).toEqual([])
    expect(labelsFor('<Tabs.')).toEqual([])
    expect(labelsFor('<Timeline.')).toEqual([])
  })

  it('shows contextual subcomponents inside matching parent ancestry', () => {
    expect(labelsFor('<Accordion>\n  <')).toEqual(['Accordion.Item'])
    expect(labelsFor('<Accordion>\n  <Accordion.Item>\n    <')).toEqual([
      'Accordion.Header',
      'Accordion.Content',
    ])
    expect(labelsFor('<ActionMenu>\n  <')).toEqual(['ActionMenu.Trigger', 'ActionMenu.Content'])
    expect(labelsFor('<Dropdown>\n  <')).toEqual(['Dropdown.Toggle', 'Dropdown.Menu'])
    expect(labelsFor('<ExpansionCard>\n  <')).toEqual([
      'ExpansionCard.Header',
      'ExpansionCard.Content',
    ])
    expect(labelsFor('<ExpansionCard>\n  <ExpansionCard.Header>\n    <')).toEqual([
      'ExpansionCard.Title',
      'ExpansionCard.Description',
    ])
    expect(labelsFor('<Process>\n  <')).toEqual(['Process.Event'])
    expect(labelsFor('<Stepper>\n  <')).toEqual(['Stepper.Step'])
    expect(labelsFor('<Tabs>\n  <')).toEqual(['Tabs.List', 'Tabs.Panel'])
    expect(labelsFor('<Timeline>\n  <')).toEqual(['Timeline.Pin', 'Timeline.Row'])
    expect(labelsFor('<Timeline>\n  <Timeline.Row label="Sick leave">\n    <')).toEqual([
      'Timeline.Period',
    ])
  })

  it('matches contextual subcomponents by their relative child name', () => {
    expect(labelsFor('<Accordion>\n  <Accordion.Item>\n    <H')).toContain('Accordion.Header')
    expect(labelsFor('<ActionMenu>\n  <ActionMenu.Content>\n    <I')).toContain('ActionMenu.Item')
    expect(labelsFor('<ExpansionCard>\n  <ExpansionCard.Header>\n    <T')).toContain(
      'ExpansionCard.Title'
    )
    expect(labelsFor('<Process>\n  <E')).toContain('Process.Event')
    expect(labelsFor('<Stepper>\n  <S')).toContain('Stepper.Step')
    expect(labelsFor('<Tabs>\n  <Tabs.List>\n    <T')).toContain('Tabs.Tab')
    expect(labelsFor('<Timeline>\n  <R')).toContain('Timeline.Row')
    expect(labelsFor('<Timeline>\n  <Timeline.Row label="Payments">\n    <P')).toContain(
      'Timeline.Period'
    )
  })

  it('keeps contextual Dropdown divider suggestions aligned with the runtime subcomponent name', () => {
    expect(labelsFor('<Dropdown>\n  <Dropdown.Menu>\n    <')).toEqual([
      'Dropdown.Menu.List',
      'Dropdown.Menu.GroupedList',
      'Dropdown.Menu.Divider',
    ])
    expect(applyFor('<Dropdown>\n  <Dropdown.Menu>\n    <D', 'Dropdown.Menu.Divider')).toBe(
      'Dropdown.Menu.Divider />'
    )
  })

  it('shows parent-bound child suggestions only inside useful group contexts', () => {
    expect(labelsFor('<RadioGroup legend="Pick one">\n  <')).toEqual(['Radio'])
    expect(labelsFor('<CheckboxGroup legend="Select">\n  <')).toEqual(['Checkbox'])
  })

  it('applies child-safe contextual snippets inside RadioGroup and CheckboxGroup', () => {
    expect(applyFor('<RadioGroup legend="Pick one">\n  <', 'Radio')).toBe(
      'Radio value="option1">Option 1</Radio>'
    )
    expect(applyFor('<CheckboxGroup legend="Select">\n  <', 'Checkbox')).toBe(
      'Checkbox value="option1">Option 1</Checkbox>'
    )
  })

  it('applies compound-safe contextual snippets inside workflow and navigation parents', () => {
    expect(applyFor('<Accordion>\n  <', 'Accordion.Item')).toContain(
      'Accordion.Header>When will I get an answer?</Accordion.Header>'
    )
    expect(applyFor('<ExpansionCard>\n  <', 'ExpansionCard.Header')).toContain(
      'ExpansionCard.Title>Payment for June</ExpansionCard.Title>'
    )
    expect(applyFor('<Process>\n  <', 'Process.Event')).toContain(
      'Process.Event\n  status="active"'
    )
    expect(applyFor('<Stepper>\n  <', 'Stepper.Step')).toBe(
      'Stepper.Step href="#">Choose support</Stepper.Step>'
    )
    expect(applyFor('<Timeline>\n  <', 'Timeline.Pin')).toContain(
      'Timeline.Pin date={new Date("2025-05-12")}'
    )
    expect(applyFor('<Timeline>\n  <', 'Timeline.Row')).toContain('Timeline.Period')
    expect(
      applyFor('<Timeline>\n  <Timeline.Row label="Sick leave">\n    <', 'Timeline.Period')
    ).toContain('statusLabel="Sick leave"')
  })

  it('routes contextual Tabs child insertions through the catalog apply callback', () => {
    const onApplyCatalogInsertion = vi.fn()
    const tabsRootSource = '<Tabs>\n  <'
    const tabsListSource = '<Tabs>\n  <Tabs.List>\n    <T'
    const tabsListOption = optionFor(
      tabsRootSource,
      'Tabs.List',
      undefined,
      onApplyCatalogInsertion
    )
    const tabsPanelOption = optionFor(
      tabsRootSource,
      'Tabs.Panel',
      undefined,
      onApplyCatalogInsertion
    )
    const tabsTabOption = optionFor(tabsListSource, 'Tabs.Tab', undefined, onApplyCatalogInsertion)

    expect(typeof tabsListOption?.apply).toBe('function')
    expect(typeof tabsPanelOption?.apply).toBe('function')
    expect(typeof tabsTabOption?.apply).toBe('function')

    if (
      typeof tabsListOption?.apply !== 'function' ||
      typeof tabsPanelOption?.apply !== 'function' ||
      typeof tabsTabOption?.apply !== 'function'
    ) {
      throw new Error('Expected contextual Tabs completions to use a custom apply callback')
    }

    tabsListOption.apply({} as never, tabsListOption as never, 0, tabsRootSource.length)
    tabsPanelOption.apply({} as never, tabsPanelOption as never, 0, tabsRootSource.length)
    tabsTabOption.apply({} as never, tabsTabOption as never, 0, tabsListSource.length)

    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(1, {
      from: 0,
      to: tabsRootSource.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('Tabs.Tab value="__AX_TAB_VALUE__"'),
      }),
    })
    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(2, {
      from: 0,
      to: tabsRootSource.length,
      insertion: expect.objectContaining({
        jsx: expect.stringContaining('Tabs.Panel value="__AX_TAB_VALUE__"'),
      }),
    })
    expect(onApplyCatalogInsertion).toHaveBeenNthCalledWith(3, {
      from: 0,
      to: tabsListSource.length,
      insertion: expect.objectContaining({
        jsx: 'Tabs.Tab value="__AX_TAB_VALUE__" label="__AX_TAB_LABEL__" />',
      }),
    })
  })

  it('suppresses generic child-level suggestions in constrained compound positions', () => {
    expect(labelsFor('<Accordion>\n  <')).not.toContain('Box')
    expect(labelsFor('<ActionMenu>\n  <ActionMenu.Content>\n    <')).not.toContain('Button')
    expect(labelsFor('<Tabs>\n  <Tabs.List>\n    <')).not.toContain('Box')
    expect(labelsFor('<Dropdown>\n  <Dropdown.Menu.List>\n    <')).toEqual([
      'Dropdown.Menu.List.Item',
    ])
  })

  it('removes generic docs-only detail text from autocomplete options', () => {
    expect(optionFor('<Accordion', 'Accordion')?.detail).toBe(
      'Accordion with related questions and one answer expanded.'
    )
    expect(optionFor('<ActionMenu', 'ActionMenu')?.detail).toBe(
      'Action menu with trigger button and grouped actions.'
    )
    expect(optionFor('<Box', 'Box')?.detail).toBe(
      'Generic container with spacing, color, border, radius, and shadow tokens.'
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

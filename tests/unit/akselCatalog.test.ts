import { describe, expect, it } from 'vitest'
import iconMetadata from '@navikt/aksel-icons/metadata'
import {
  AKSEL_CATALOG,
  AKSEL_CATALOG_VERSION,
  getCatalogComponent,
  getCatalogPaletteComponents,
  getCatalogPropValues,
  getCatalogSnippets,
  getCatalogTokenValues,
  listCatalogEntries,
} from '../../src/data/akselCatalog'
import { getComponentsByCategory, searchComponents } from '../../src/data/akselComponents'
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

  it('keeps Alert and Modal available for compatibility but hides them from new authoring discovery', () => {
    const legacyEntries = listCatalogEntries({ statuses: ['legacy'] })
    const paletteComponents = getCatalogPaletteComponents()

    expect(legacyEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['Alert'])
    )
    expect(getCatalogComponent('Alert')?.status).toBe('legacy')
    expect(paletteComponents.some((component) => component.name === 'Alert')).toBe(false)
    expect(paletteComponents.some((component) => component.name === 'Modal')).toBe(false)
    expect(getComponentsByCategory('component').some((component) => component.name === 'Alert')).toBe(
      false
    )
    expect(getComponentsByCategory('component').some((component) => component.name === 'Modal')).toBe(
      false
    )
    expect(AKSEL_SNIPPETS.some((snippet) => snippet.name === 'Alert')).toBe(false)
    expect(AKSEL_SNIPPETS.some((snippet) => snippet.name === 'Modal')).toBe(false)
    expect(searchComponents('alert')).not.toContainEqual(expect.objectContaining({ name: 'Alert' }))
    expect(searchComponents('modal')).not.toContainEqual(expect.objectContaining({ name: 'Modal' }))
  })

  it('makes the active palette helpers prefer catalog data for the starter subset', () => {
    const layoutComponents = getComponentsByCategory('layout')
    const hstack = layoutComponents.find((component) => component.name === 'HStack')

    expect(hstack?.snippet).toContain('gap="space-16"')
    expect(hstack?.snippet).not.toContain('gap="4"')
  })

  it('routes BodyShort, Heading, and Tag through the shared catalog for Add menu data', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const bodyShortEntry = getCatalogComponent('BodyShort')
    const headingEntry = getCatalogComponent('Heading')
    const tagEntry = getCatalogComponent('Tag')
    const tagPaletteEntry = paletteComponents.find((component) => component.name === 'Tag')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['BodyShort', 'Heading', 'Tag'])
    )
    expect(bodyShortEntry?.snippet.code).toBe('<BodyShort>Short text</BodyShort>')
    expect(headingEntry?.snippet.code).toBe(
      '<Heading level="1" size="large">Heading text</Heading>'
    )
    expect(tagEntry?.snippet.code).toBe(
      '<Tag variant="moderate" data-color="info">In progress</Tag>'
    )
    expect(tagPaletteEntry).toEqual(
      expect.objectContaining({
        snippet: '<Tag variant="moderate" data-color="info">In progress</Tag>',
        description: 'Tag label component.',
        keywords: expect.arrayContaining(['badge', 'status']),
      })
    )
    expect(searchComponents('badge')).toContainEqual(expect.objectContaining({ name: 'Tag' }))
    expect(AKSEL_SNIPPETS.find((snippet) => snippet.name === 'Tag')?.template).toBe(
      '<Tag variant="moderate" data-color="info">In progress</Tag>'
    )
  })

  it('routes form and input examples through the shared catalog for Add menu data', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const checkboxEntry = getCatalogComponent('Checkbox')
    const radioEntry = getCatalogComponent('Radio')
    const searchEntry = getCatalogComponent('Search')
    const selectEntry = getCatalogComponent('Select')
    const switchEntry = getCatalogComponent('Switch')
    const textareaEntry = getCatalogComponent('Textarea')
    const toggleGroupEntry = getCatalogComponent('ToggleGroup')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'Checkbox',
        'Radio',
        'Search',
        'Select',
        'Switch',
        'Textarea',
        'ToggleGroup',
      ])
    )
    expect(checkboxEntry?.snippet.code).toContain('description="You can change this later."')
    expect(checkboxEntry?.snippet.code).toContain('name="emailUpdates"')
    expect(radioEntry?.snippet.code).toContain(
      '<RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">'
    )
    expect(searchEntry?.snippet.code).toContain(
      '<form role="search" onSubmit={(event) => event.preventDefault()}>'
    )
    expect(selectEntry?.snippet.code).toContain('label="Choose delivery window"')
    expect(selectEntry?.snippet.code).toContain('defaultValue=""')
    expect(selectEntry?.snippet.code).toContain('name="deliveryWindow"')
    expect(switchEntry?.snippet.code).toContain('<Switch defaultChecked')
    expect(textareaEntry?.snippet.code).toContain('minRows={4}')
    expect(toggleGroupEntry?.snippet.code).toContain(
      '{...useToggleGroupState{{toggleGroupSuffix}}()}'
    )
    expect(toggleGroupEntry?.snippet.hooksCode).toContain(
      'export const useToggleGroupState{{toggleGroupSuffix}} = (initialValue = "list") => {'
    )
    expect(
      paletteComponents.find((component) => component.name === 'Radio')?.snippet
    ).toContain('<RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">')
    expect(
      paletteComponents.find((component) => component.name === 'ToggleGroup')?.insertion
    ).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('{...useToggleGroupState{{toggleGroupSuffix}}()}'),
        hooks: expect.stringContaining(
          'export const useToggleGroupState{{toggleGroupSuffix}} = (initialValue = "list") => {'
        ),
      })
    )
    expect(searchComponents('radiogroup')).toContainEqual(expect.objectContaining({ name: 'Radio' }))
    expect(searchComponents('segmented')).toContainEqual(
      expect.objectContaining({ name: 'ToggleGroup' })
    )
  })

  it('routes feedback, dialog, and form-shell examples through the shared catalog for Add menu data', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const inlineMessageEntry = getCatalogComponent('InlineMessage')
    const globalAlertEntry = getCatalogComponent('GlobalAlert')
    const localAlertEntry = getCatalogComponent('LocalAlert')
    const dialogEntry = getCatalogComponent('Dialog')
    const fieldsetEntry = getCatalogComponent('Fieldset')
    const checkboxGroupEntry = getCatalogComponent('CheckboxGroup')
    const errorMessageEntry = getCatalogComponent('ErrorMessage')
    const errorSummaryEntry = getCatalogComponent('ErrorSummary')
    const fileUploadEntry = getCatalogComponent('FileUpload')
    const formSummaryEntry = getCatalogComponent('FormSummary')
    const formProgressEntry = getCatalogComponent('FormProgress')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'InlineMessage',
        'GlobalAlert',
        'LocalAlert',
        'Dialog',
        'Fieldset',
        'CheckboxGroup',
        'ErrorMessage',
        'ErrorSummary',
        'FileUpload',
        'FormSummary',
      ])
    )
    expect(inlineMessageEntry?.snippet.code).toBe(
      '<InlineMessage status="success">Draft saved at 14:35</InlineMessage>'
    )
    expect(globalAlertEntry?.snippet.code).toContain('<GlobalAlert status="announcement">')
    expect(localAlertEntry?.snippet.code).toContain('<LocalAlert status="warning">')
    expect(dialogEntry?.snippet.code).toBe('<ReviewDialog{{dialogSuffix}} />')
    expect(dialogEntry?.snippet.hooksCode).toContain(
      'export const ReviewDialog{{dialogSuffix}} = () => {'
    )
    expect(dialogEntry?.snippet.hooksCode).toContain('Dialog.CloseTrigger')
    expect(fieldsetEntry?.snippet.code).toContain('<Fieldset legend="Employer phone number">')
    expect(checkboxGroupEntry?.snippet.code).toContain(
      '<CheckboxGroup\n  legend="How should we notify you?"'
    )
    expect(errorMessageEntry?.snippet.code).toBe(
      '<ErrorMessage showIcon>Enter a valid email address.</ErrorMessage>'
    )
    expect(errorSummaryEntry?.snippet.code).toContain(
      '<ErrorSummary heading="You must fix these errors before continuing:">'
    )
    expect(fileUploadEntry?.snippet.code).toContain('<FileUpload.Dropzone')
    expect(fileUploadEntry?.snippet.code).toContain(
      'button={{ action: "delete", onClick: () => {} }}'
    )
    expect(formSummaryEntry?.snippet.code).toContain('<FormSummary.Footer>')
    expect(formProgressEntry?.snippet.code).toContain(
      '<FormProgress totalSteps={3} activeStep={1}>'
    )
    expect(paletteComponents.find((component) => component.name === 'Dialog')?.insertion).toEqual(
      expect.objectContaining({
        jsx: '<ReviewDialog{{dialogSuffix}} />',
        hooks: expect.stringContaining('export const ReviewDialog{{dialogSuffix}} = () => {'),
      })
    )
    expect(
      paletteComponents.find((component) => component.name === 'InlineMessage')?.snippet
    ).toBe('<InlineMessage status="success">Draft saved at 14:35</InlineMessage>')
    expect(searchComponents('modal replacement')).toContainEqual(
      expect.objectContaining({ name: 'Dialog' })
    )
    expect(searchComponents('attachment')).toContainEqual(
      expect.objectContaining({ name: 'FileUpload' })
    )
  })

  it('exposes Pagination as a catalog-backed multi-part insertion', () => {
    const paginationEntry = getCatalogComponent('Pagination')
    const paginationPaletteEntry = getComponentsByCategory('component').find(
      (component) => component.name === 'Pagination'
    )
    const paginationSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'Pagination')

    expect(paginationEntry?.description).toBe('Pagination controls with Hooks-tab state.')
    expect(paginationEntry?.snippet.code).toContain(
      '{...usePaginationState{{paginationSuffix}}()}'
    )
    expect(paginationEntry?.snippet.code).not.toContain('{(() => {')
    expect(paginationEntry?.snippet.code).toContain(
      'srHeading={{ tag: "h2", text: "Result pages" }}'
    )
    expect(paginationEntry?.snippet.hooksCode).toContain(
      'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {'
    )
    expect(paginationEntry?.snippet.hooksCode).toContain(
      'const [pageState, setPageState] = useState(initialPage)'
    )
    expect(paginationPaletteEntry).toEqual(
      expect.objectContaining({
        snippet: expect.stringContaining('{...usePaginationState{{paginationSuffix}}()}'),
        insertion: expect.objectContaining({
          jsx: expect.stringContaining('{...usePaginationState{{paginationSuffix}}()}'),
          hooks: expect.stringContaining(
            'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {'
          ),
        }),
      })
    )
    expect(paginationSnippet?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('{...usePaginationState{{paginationSuffix}}()}'),
        hooks: expect.stringContaining(
          'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {'
        ),
      })
    )
    expect(searchComponents('pager')).toContainEqual(expect.objectContaining({ name: 'Pagination' }))
  })

  it('exposes DatePicker, MonthPicker, and ToggleGroup as catalog-backed stateful insertions', () => {
    const datePickerEntry = getCatalogComponent('DatePicker')
    const monthPickerEntry = getCatalogComponent('MonthPicker')
    const toggleGroupEntry = getCatalogComponent('ToggleGroup')
    const datePickerSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'DatePicker')
    const monthPickerSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'MonthPicker')
    const toggleGroupSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'ToggleGroup')

    expect(datePickerEntry?.snippet.code).toBe('<DatePickerField{{datePickerFieldSuffix}} />')
    expect(datePickerEntry?.snippet.hooksCode).toContain(
      'const { datepickerProps, inputProps } = useDatepicker({'
    )
    expect(datePickerEntry?.snippet.hooksCode).toContain('label="Choose meeting date"')
    expect(datePickerEntry?.snippet.hooksCode).toContain('name="meetingDate"')
    expect(monthPickerEntry?.snippet.code).toBe('<MonthPickerField{{monthPickerFieldSuffix}} />')
    expect(monthPickerEntry?.snippet.hooksCode).toContain(
      'const { monthpickerProps, inputProps } = useMonthpicker({'
    )
    expect(monthPickerEntry?.snippet.hooksCode).toContain('label="Choose reporting month"')
    expect(monthPickerEntry?.snippet.hooksCode).toContain('name="reportingMonth"')
    expect(toggleGroupEntry?.snippet.code).toContain(
      '{...useToggleGroupState{{toggleGroupSuffix}}()}'
    )
    expect(datePickerSnippet?.insertion).toEqual(
      expect.objectContaining({
        jsx: '<DatePickerField{{datePickerFieldSuffix}} />',
        hooks: expect.stringContaining('useDatepicker({'),
      })
    )
    expect(monthPickerSnippet?.insertion).toEqual(
      expect.objectContaining({
        jsx: '<MonthPickerField{{monthPickerFieldSuffix}} />',
        hooks: expect.stringContaining('useMonthpicker({'),
      })
    )
    expect(toggleGroupSnippet?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('{...useToggleGroupState{{toggleGroupSuffix}}()}'),
        hooks: expect.stringContaining('const [selectedView, setSelectedView] = useState'),
      })
    )
  })

  it('keeps every Hooks-backed catalog snippet composable in JSX', () => {
    const hooksBackedEntries = listCatalogEntries({
      groups: ['layout', 'component'],
      statuses: ['current', 'experimental'],
    }).filter((entry) => entry.snippet.hooksCode)

    expect(hooksBackedEntries.map((entry) => entry.name).sort()).toEqual([
      'DatePicker',
      'Dialog',
      'MonthPicker',
      'Pagination',
      'ToggleGroup',
    ])

    for (const entry of hooksBackedEntries) {
      expect(entry.snippet.code.trim().startsWith('<')).toBe(true)
      expect(entry.snippet.code).not.toContain('{(() => {')
      expect(entry.snippet.code.trim().startsWith('<>')).toBe(false)
    }
  })

  it('keeps Tabs snippets uncontrolled so preview clicks can switch panels', () => {
    const tabsPaletteEntry = getComponentsByCategory('component').find(
      (component) => component.name === 'Tabs'
    )
    const tabsSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'Tabs')

    expect(tabsPaletteEntry?.snippet).toContain('<Tabs defaultValue="tab1">')
    expect(tabsPaletteEntry?.snippet).not.toContain('<Tabs value="tab1">')
    expect(tabsSnippet?.template).toContain('<Tabs defaultValue="tab1">')
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

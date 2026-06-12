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

    expect(legacyEntries.map((entry) => entry.name)).toEqual(expect.arrayContaining(['Alert']))
    expect(getCatalogComponent('Alert')?.status).toBe('legacy')
    expect(paletteComponents.some((component) => component.name === 'Alert')).toBe(false)
    expect(paletteComponents.some((component) => component.name === 'Modal')).toBe(false)
    expect(
      getComponentsByCategory('component').some((component) => component.name === 'Alert')
    ).toBe(false)
    expect(
      getComponentsByCategory('component').some((component) => component.name === 'Modal')
    ).toBe(false)
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
    expect(bodyShortEntry?.snippet.code).toBe(
      '<BodyShort>You need to choose a filter before we can show results.</BodyShort>'
    )
    expect(headingEntry?.snippet.code).toBe(
      '<Heading level="2" size="medium">Application overview</Heading>'
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

  it('routes Issue 212 content, typography, and link examples through the shared catalog', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const bodyLongEntry = getCatalogComponent('BodyLong')
    const labelEntry = getCatalogComponent('Label')
    const detailEntry = getCatalogComponent('Detail')
    const chatEntry = getCatalogComponent('Chat')
    const copyButtonEntry = getCatalogComponent('CopyButton')
    const guidePanelEntry = getCatalogComponent('GuidePanel')
    const internalHeaderEntry = getCatalogComponent('InternalHeader')
    const linkEntry = getCatalogComponent('Link')
    const linkCardEntry = getCatalogComponent('LinkCard')
    const listEntry = getCatalogComponent('List')
    const copyButtonPaletteEntry = paletteComponents.find((component) => component.name === 'CopyButton')
    const linkCardPaletteEntry = paletteComponents.find((component) => component.name === 'LinkCard')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'BodyLong',
        'BodyShort',
        'Chat',
        'CopyButton',
        'Detail',
        'GuidePanel',
        'Heading',
        'InternalHeader',
        'Label',
        'Link',
        'LinkCard',
        'List',
      ])
    )
    expect(bodyLongEntry?.snippet.code).toBe(
      '<BodyLong spacing>Remember to attach the most recent payslip before you continue.</BodyLong>'
    )
    expect(labelEntry?.snippet.code).toBe('<Label as="p" spacing>Employer phone number</Label>')
    expect(detailEntry?.snippet.code).toBe('<Detail uppercase>Application details</Detail>')
    expect(chatEntry?.snippet.code).toContain('avatar={<span aria-hidden>SS</span>}')
    expect(chatEntry?.snippet.code).toContain(
      '<Chat.Bubble>You can upload it here as soon as it is ready.</Chat.Bubble>'
    )
    expect(copyButtonEntry?.snippet.code).toBe(
      '<CopyButton copyText="CASE-2048" text="Copy case number" activeText="Case number copied" />'
    )
    expect(guidePanelEntry?.snippet.code).toContain(
      '<Heading level="2" size="small" spacing>Need help before you send the application?</Heading>'
    )
    expect(internalHeaderEntry?.snippet.code).toContain(
      '<InternalHeader.UserButton name="Ola N." description="Enhet: Skien" />'
    )
    expect(internalHeaderEntry?.snippet.code).toContain(
      '<Theme theme={resolvedTheme{{internalHeaderSuffix}} as "light" | "dark"}>'
    )
    expect(internalHeaderEntry?.snippet.hooksCode).toBe(
      "const resolvedTheme{{internalHeaderSuffix}} = 'light'"
    )
    expect(linkEntry?.snippet.code).toBe(
      '<Link href="#">Read the guide to sick leave follow-up</Link>'
    )
    expect(linkCardEntry?.snippet.code).toContain(
      '<LinkCard.Anchor href="#">Review sick pay application</LinkCard.Anchor>'
    )
    expect(listEntry?.snippet.code).toContain(
      '<List.Item>Send the application for review</List.Item>'
    )
    expect(copyButtonPaletteEntry).toEqual(
      expect.objectContaining({
        snippet:
          '<CopyButton copyText="CASE-2048" text="Copy case number" activeText="Case number copied" />',
        description: 'Copy button with visible button text and copied state.',
        keywords: expect.arrayContaining(['clipboard', 'utility']),
      })
    )
    expect(linkCardPaletteEntry).toEqual(
      expect.objectContaining({
        snippet: expect.stringContaining(
          '<LinkCard.Anchor href="#">Review sick pay application</LinkCard.Anchor>'
        ),
        description: 'Clickable card link with title and description.',
      })
    )
    expect(searchComponents('clipboard')).toContainEqual(
      expect.objectContaining({ name: 'CopyButton' })
    )
    expect(searchComponents('conversation')).toContainEqual(
      expect.objectContaining({ name: 'Chat' })
    )
    expect(AKSEL_SNIPPETS.find((snippet) => snippet.name === 'LinkCard')?.template).toContain(
      '<LinkCard.Anchor href="#">Review sick pay application</LinkCard.Anchor>'
    )
  })

  it('routes Issue 209 chips and status/data display examples through the shared catalog', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const chipsToggleEntry = getCatalogComponent('Chips Toggle')
    const chipsRemovableEntry = getCatalogComponent('Chips Removable')
    const loaderEntry = getCatalogComponent('Loader')
    const progressBarEntry = getCatalogComponent('ProgressBar')
    const skeletonEntry = getCatalogComponent('Skeleton')
    const tableEntry = getCatalogComponent('Table')
    const chipsTogglePaletteEntry = paletteComponents.find(
      (component) => component.name === 'Chips Toggle'
    )
    const chipsRemovablePaletteEntry = paletteComponents.find(
      (component) => component.name === 'Chips Removable'
    )

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'Chips Toggle',
        'Chips Removable',
        'Loader',
        'ProgressBar',
        'Skeleton',
        'Table',
        'Tag',
      ])
    )
    expect(chipsToggleEntry?.snippet.code).toContain('<Chips>')
    expect(chipsToggleEntry?.snippet.code).toContain('<Chips.Toggle')
    expect(chipsToggleEntry?.snippet.code).toContain('data-color="neutral"')
    expect(chipsToggleEntry?.snippet.code).not.toContain('<Chips data-color="neutral">')
    expect(chipsToggleEntry?.snippet.code).toContain(
      '{options{{chipsToggleSuffix}}.map((label, id) => ('
    )
    expect(chipsToggleEntry?.snippet.code).toContain(
      'selected={selected{{chipsToggleSuffix}} === id}'
    )
    expect(chipsToggleEntry?.snippet.code).not.toContain('ChipsToggleExample')
    expect(chipsToggleEntry?.snippet.hooksCode).toContain(
      'const [selected{{chipsToggleSuffix}}, setSelected{{chipsToggleSuffix}}] = useState(0)'
    )
    expect(chipsToggleEntry?.snippet.hooksCode).toContain('const options{{chipsToggleSuffix}} = [')
    expect(chipsRemovableEntry?.snippet.code).toContain(
      '{filter{{chipsRemovableSuffix}}.map((c) => ('
    )
    expect(chipsRemovableEntry?.snippet.code).toContain('<Chips.Removable')
    expect(chipsRemovableEntry?.snippet.code).toContain('data-color="neutral"')
    expect(chipsRemovableEntry?.snippet.code).not.toContain('<Chips data-color="neutral">')
    expect(chipsRemovableEntry?.snippet.code).toContain('setFilter{{chipsRemovableSuffix}}((x) =>')
    expect(chipsRemovableEntry?.snippet.code).toContain('x.length === 1')
    expect(chipsRemovableEntry?.snippet.code).toContain('? options{{chipsRemovableSuffix}}')
    expect(chipsRemovableEntry?.snippet.code).toContain(': x.filter((y) => y !== c)')
    expect(chipsRemovableEntry?.snippet.code).not.toContain('ChipsRemovableExample')
    expect(chipsRemovableEntry?.snippet.hooksCode).toContain(
      'const [filter{{chipsRemovableSuffix}}, setFilter{{chipsRemovableSuffix}}] = useState(options{{chipsRemovableSuffix}})'
    )
    expect(chipsRemovableEntry?.snippet.hooksCode).toContain(
      'const options{{chipsRemovableSuffix}} = ["Housing", "Income", "Work"]'
    )
    expect(loaderEntry?.snippet.code).toContain(
      '<Loader size="xlarge" title="Loading case details" />'
    )
    expect(progressBarEntry?.snippet.code).toContain(
      'id="applicationProgressLabel{{progressBarLabelSuffix}}"'
    )
    expect(progressBarEntry?.snippet.code).toContain(
      'aria-labelledby="applicationProgressLabel{{progressBarLabelSuffix}}"'
    )
    expect(skeletonEntry?.snippet.code).toContain('<Skeleton variant="rounded" height={80} />')
    expect(tableEntry?.snippet.code).toContain(
      '<Table.HeaderCell scope="row">Payments</Table.HeaderCell>'
    )
    expect(chipsTogglePaletteEntry?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('<Chips.Toggle'),
        hooks: expect.stringContaining(
          'const [selected{{chipsToggleSuffix}}, setSelected{{chipsToggleSuffix}}] = useState(0)'
        ),
      })
    )
    expect(chipsRemovablePaletteEntry?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('{filter{{chipsRemovableSuffix}}.map((c) => ('),
        hooks: expect.stringContaining(
          'const [filter{{chipsRemovableSuffix}}, setFilter{{chipsRemovableSuffix}}] = useState(options{{chipsRemovableSuffix}})'
        ),
      })
    )
    expect(chipsTogglePaletteEntry?.insertion?.jsx).not.toContain('ChipsToggleExample')
    expect(chipsRemovablePaletteEntry?.insertion?.jsx).not.toContain('ChipsRemovableExample')
    expect(searchComponents('chips')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Chips Toggle' }),
        expect.objectContaining({ name: 'Chips Removable' }),
      ])
    )
    expect(searchComponents('remove')).toContainEqual(
      expect.objectContaining({ name: 'Chips Removable' })
    )
    expect(searchComponents('loading')).toContainEqual(expect.objectContaining({ name: 'Loader' }))
    expect(searchComponents('progress')).toContainEqual(
      expect.objectContaining({ name: 'ProgressBar' })
    )
    expect(searchComponents('skeleton')).toContainEqual(
      expect.objectContaining({ name: 'Skeleton' })
    )
    expect(searchComponents('table')).toContainEqual(expect.objectContaining({ name: 'Table' }))
    expect(
      getComponentsByCategory('component').some((component) => component.name === 'Chips')
    ).toBe(false)
    expect(AKSEL_SNIPPETS.some((snippet) => snippet.name === 'Chips')).toBe(false)
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
    expect(paletteComponents.find((component) => component.name === 'Radio')?.snippet).toContain(
      '<RadioGroup legend="Choose delivery speed" defaultValue="standard" name="deliverySpeed">'
    )
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
    expect(searchComponents('radiogroup')).toContainEqual(
      expect.objectContaining({ name: 'Radio' })
    )
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
    expect(paletteComponents.find((component) => component.name === 'InlineMessage')?.snippet).toBe(
      '<InlineMessage status="success">Draft saved at 14:35</InlineMessage>'
    )
    expect(searchComponents('modal replacement')).toContainEqual(
      expect.objectContaining({ name: 'Dialog' })
    )
    expect(searchComponents('attachment')).toContainEqual(
      expect.objectContaining({ name: 'FileUpload' })
    )
  })

  it('routes menu, overlay, and help examples through the shared catalog for Add menu data', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const actionMenuEntry = getCatalogComponent('ActionMenu')
    const dropdownEntry = getCatalogComponent('Dropdown')
    const helpTextEntry = getCatalogComponent('HelpText')
    const popoverEntry = getCatalogComponent('Popover')
    const tooltipEntry = getCatalogComponent('Tooltip')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['ActionMenu', 'Dropdown', 'HelpText', 'Popover', 'Tooltip'])
    )
    expect(actionMenuEntry?.snippet.code).toContain('<ActionMenu.Trigger>')
    expect(actionMenuEntry?.snippet.code).toContain('<ActionMenu.Group label="Case actions">')
    expect(dropdownEntry?.snippet.code).toContain('<Dropdown.Menu.GroupedList>')
    expect(dropdownEntry?.snippet.code).toContain('<Dropdown.Menu.Divider />')
    expect(helpTextEntry?.snippet.code).toContain('<HStack gap="space-4" align="center">')
    expect(helpTextEntry?.snippet.code).toContain('<HelpText title="How is this calculated?">')
    expect(popoverEntry?.snippet.code).toContain('<Button')
    expect(popoverEntry?.snippet.code).toContain('ref={setAnchorEl{{popoverSuffix}}}')
    expect(popoverEntry?.snippet.code).toContain('Åpne popover')
    expect(popoverEntry?.snippet.code).toContain('<Popover.Content>Innhold her!</Popover.Content>')
    expect(popoverEntry?.snippet.hooksCode).toContain(
      'const [openState{{popoverSuffix}}, setOpenState{{popoverSuffix}}] = useState(false)'
    )
    expect(popoverEntry?.snippet.hooksCode).toContain('const popoverId{{popoverSuffix}} = useId()')
    expect(tooltipEntry?.snippet.code).toContain('describesChild')
    expect(paletteComponents.find((component) => component.name === 'Popover')?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('<Button'),
        hooks: expect.stringContaining('const popoverId{{popoverSuffix}} = useId()'),
      })
    )
    expect(
      paletteComponents.find((component) => component.name === 'ActionMenu')?.snippet
    ).toContain('<ActionMenu.Trigger>')
    expect(searchComponents('overflow')).toContainEqual(
      expect.objectContaining({ name: 'ActionMenu' })
    )
    expect(searchComponents('anchor')).toContainEqual(expect.objectContaining({ name: 'Popover' }))
  })

  it('routes compound workflow and navigation examples through the shared catalog for Add menu data', () => {
    const componentEntries = listCatalogEntries({ groups: ['component'], statuses: ['current'] })
    const paletteComponents = getComponentsByCategory('component')
    const accordionEntry = getCatalogComponent('Accordion')
    const expansionCardEntry = getCatalogComponent('ExpansionCard')
    const processEntry = getCatalogComponent('Process')
    const readMoreEntry = getCatalogComponent('ReadMore')
    const stepperEntry = getCatalogComponent('Stepper')
    const tabsEntry = getCatalogComponent('Tabs')
    const timelineEntry = getCatalogComponent('Timeline')

    expect(componentEntries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'Accordion',
        'ExpansionCard',
        'Process',
        'ReadMore',
        'Stepper',
        'Tabs',
        'Timeline',
      ])
    )
    expect(accordionEntry?.snippet.code).toContain('<Accordion.Item defaultOpen>')
    expect(accordionEntry?.snippet.code).toContain(
      '<Accordion.Header>How do I change my meeting time?</Accordion.Header>'
    )
    expect(expansionCardEntry?.snippet.code).toContain('<ExpansionCard.Description>')
    expect(expansionCardEntry?.snippet.code).toContain('defaultOpen')
    expect(processEntry?.snippet.code).toContain('<Process.Event status="completed"')
    expect(processEntry?.snippet.code).not.toContain('Process.Step')
    expect(readMoreEntry?.snippet.code).toContain('header="Why we ask about income"')
    expect(stepperEntry?.snippet.code).toContain('activeStep={2}')
    expect(stepperEntry?.snippet.code).toContain(
      '<Stepper.Step href="#">Choose support</Stepper.Step>'
    )
    expect(stepperEntry?.snippet.code).not.toContain('activeStep={0}')
    expect(tabsEntry?.snippet.code).toContain('{...useTabsState{{tabsSuffix}}()}')
    expect(tabsEntry?.snippet.hooksCode).toContain(
      'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {'
    )
    expect(timelineEntry?.snippet.code).toContain('<Timeline.Pin date={new Date("2025-05-12")}>')
    expect(timelineEntry?.snippet.code).toContain('<Timeline.Row label="Sick leave">')
    expect(timelineEntry?.snippet.code).not.toContain('Timeline.Content')
    expect(paletteComponents.find((component) => component.name === 'Tabs')?.insertion).toEqual(
      expect.objectContaining({
        jsx: expect.stringContaining('{...useTabsState{{tabsSuffix}}()}'),
        hooks: expect.stringContaining(
          'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {'
        ),
      })
    )
    expect(searchComponents('faq')).toContainEqual(expect.objectContaining({ name: 'Accordion' }))
    expect(searchComponents('workflow')).toContainEqual(
      expect.objectContaining({ name: 'Process' })
    )
    expect(searchComponents('chronology')).toContainEqual(
      expect.objectContaining({ name: 'Timeline' })
    )
  })

  it('exposes Pagination as a catalog-backed multi-part insertion', () => {
    const paginationEntry = getCatalogComponent('Pagination')
    const paginationPaletteEntry = getComponentsByCategory('component').find(
      (component) => component.name === 'Pagination'
    )
    const paginationSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'Pagination')

    expect(paginationEntry?.description).toBe('Pagination controls with Hooks-tab state.')
    expect(paginationEntry?.snippet.code).toContain('{...usePaginationState{{paginationSuffix}}()}')
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
    expect(searchComponents('pager')).toContainEqual(
      expect.objectContaining({ name: 'Pagination' })
    )
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
      'Chips Removable',
      'Chips Toggle',
      'DatePicker',
      'Dialog',
      'InternalHeader',
      'MonthPicker',
      'Pagination',
      'Popover',
      'Tabs',
      'ToggleGroup',
    ])

    for (const entry of hooksBackedEntries) {
      expect(entry.snippet.code.trim().startsWith('<')).toBe(true)
      expect(entry.snippet.code).not.toContain('{(() => {')
      expect(entry.snippet.code.trim().startsWith('<>')).toBe(false)
    }
  })

  it('keeps Tabs snippets composable while routing state through Hooks', () => {
    const tabsCatalogEntry = getCatalogComponent('Tabs')
    const tabsPaletteEntry = getComponentsByCategory('component').find(
      (component) => component.name === 'Tabs'
    )
    const tabsSnippet = AKSEL_SNIPPETS.find((snippet) => snippet.name === 'Tabs')

    expect(tabsCatalogEntry?.snippet.hooksCode).toContain(
      'export const useTabsState{{tabsSuffix}} = (initialValue = "overview") => {'
    )
    expect(tabsPaletteEntry?.snippet).toContain('<Tabs {...useTabsState{{tabsSuffix}}()}>')
    expect(tabsSnippet?.template).toContain('<Tabs {...useTabsState{{tabsSuffix}}()}>')
    expect(tabsPaletteEntry?.insertion).toEqual(
      expect.objectContaining({
        hooks: expect.stringContaining(
          'const [selectedTab, setSelectedTab] = useState(initialValue)'
        ),
      })
    )
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

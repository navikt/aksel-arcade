import { describe, expect, it } from 'vitest'
import { getCatalogComponent } from '@/data/akselCatalog'
import { createArcadeSourceFile } from '@/services/projectSource'
import { applyComponentInsertion, createJsxOnlyInsertion } from '@/services/componentInsertion'

const paginationInsertion = {
  jsx:
    '<Pagination\n' +
    '  {...usePaginationState{{paginationSuffix}}()}\n' +
    '  count={9}\n' +
    '  boundaryCount={1}\n' +
    '  siblingCount={1}\n' +
    '  srHeading={{ tag: "h2", text: "Result pages" }}\n' +
    '/>',
  hooks:
    'export const usePaginationState{{paginationSuffix}} = (initialPage = 1) => {\n' +
    '  const [pageState, setPageState] = useState(initialPage)\n' +
    '\n' +
    '  return {\n' +
    '    page: pageState,\n' +
    '    onPageChange: setPageState,\n' +
    '  }\n' +
    '}',
}

const datePickerInsertion = {
  jsx: '<DatePickerField{{datePickerFieldSuffix}} />',
  hooks:
    'export const DatePickerField{{datePickerFieldSuffix}} = () => {\n' +
    '  const { datepickerProps, inputProps } = useDatepicker({\n' +
    '    defaultSelected: new Date("2025-06-15"),\n' +
    '    fromDate: new Date("2025-01-01"),\n' +
    '    toDate: new Date("2025-12-31"),\n' +
    '  })\n' +
    '\n' +
    '  return (\n' +
    '    <DatePicker {...datepickerProps}>\n' +
    '      <DatePicker.Input\n' +
    '        {...inputProps}\n' +
    '        label="Choose meeting date"\n' +
    '        description="Pick a date in 2025."\n' +
    '      />\n' +
    '    </DatePicker>\n' +
    '  )\n' +
    '}',
}

const dialogInsertion = {
  jsx: '<ReviewDialog{{dialogSuffix}} />',
  hooks:
    'export const ReviewDialog{{dialogSuffix}} = () => {\n' +
    '  const [dialogOpen{{dialogSuffix}}, setDialogOpen{{dialogSuffix}}] = useState(false)\n' +
    '\n' +
    '  return (\n' +
    '    <>\n' +
    '      <Button type="button" onClick={() => setDialogOpen{{dialogSuffix}}(true)}>\n' +
    '        Review summary\n' +
    '      </Button>\n' +
    '      <Dialog open={dialogOpen{{dialogSuffix}}} onOpenChange={setDialogOpen{{dialogSuffix}}}>\n' +
    '        <Dialog.Popup id="review-dialog-popup{{dialogSuffix}}">\n' +
    '          <Dialog.Header>\n' +
    '            <Dialog.Title>Ready to send?</Dialog.Title>\n' +
    '          </Dialog.Header>\n' +
    '          <Dialog.Body>\n' +
    '            <BodyShort>Confirm when attachments are ready.</BodyShort>\n' +
    '          </Dialog.Body>\n' +
    '          <Dialog.Footer>\n' +
    '            <Dialog.CloseTrigger>\n' +
    '              <Button type="button" variant="secondary">Go back</Button>\n' +
    '            </Dialog.CloseTrigger>\n' +
    '            <Button type="button" onClick={() => setDialogOpen{{dialogSuffix}}(false)}>\n' +
    '              Confirm\n' +
    '            </Button>\n' +
    '          </Dialog.Footer>\n' +
    '        </Dialog.Popup>\n' +
    '      </Dialog>\n' +
    '    </>\n' +
    '  )\n' +
    '}',
}

const popoverInsertion = {
  jsx:
    '<Button\n' +
    '  ref={setAnchorEl{{popoverSuffix}}}\n' +
    '  onClick={() => setOpenState{{popoverSuffix}}(!openState{{popoverSuffix}})}\n' +
    '  aria-expanded={openState{{popoverSuffix}}}\n' +
    '  aria-controls={openState{{popoverSuffix}} ? popoverId{{popoverSuffix}} : undefined}\n' +
    '>\n' +
    '  Åpne popover\n' +
    '</Button>\n' +
    '\n' +
    '<Popover\n' +
    '  open={openState{{popoverSuffix}}}\n' +
    '  onClose={() => setOpenState{{popoverSuffix}}(false)}\n' +
    '  anchorEl={anchorEl{{popoverSuffix}}}\n' +
    '  id={popoverId{{popoverSuffix}}}\n' +
    '>\n' +
    '  <Popover.Content>Innhold her!</Popover.Content>\n' +
    '</Popover>',
  hooks:
    'const [anchorEl{{popoverSuffix}}, setAnchorEl{{popoverSuffix}}] = useState<HTMLButtonElement | null>(null)\n' +
    'const [openState{{popoverSuffix}}, setOpenState{{popoverSuffix}}] = useState(false)\n' +
    'const popoverId{{popoverSuffix}} = useId()',
}

const tabsListAutocompleteInsertion = {
  jsx:
    'Tabs.List>\n' +
    '  <Tabs.Tab value="__AX_TAB_VALUE__" label="__AX_TAB_LABEL__" />\n' +
    '</Tabs.List>',
}

const tabsTabAutocompleteInsertion = {
  jsx: 'Tabs.Tab value="__AX_TAB_VALUE__" label="__AX_TAB_LABEL__" />',
}

const tabsPanelAutocompleteInsertion = {
  jsx: 'Tabs.Panel value="__AX_TAB_VALUE__">\n' + '  __AX_TAB_CONTENT__\n' + '</Tabs.Panel>',
}

function applyAutocompleteInsertionWithMarker(jsx: string, insertion: { jsx: string }) {
  const marker = '__CURSOR__'
  const from = jsx.indexOf(marker)

  if (from === -1) {
    throw new Error('Expected JSX fixture to include __CURSOR__ marker')
  }

  return applyComponentInsertion(createArcadeSourceFile(jsx.replace(marker, ''), ''), insertion, {
    kind: 'autocomplete',
    from,
    to: from,
  })
}

describe('component insertion service', () => {
  it('preserves JSX-only Add menu insertion on the active JSX tab', () => {
    const source = createArcadeSourceFile('<Box>First</Box>\n<Box>Second</Box>', '')

    const nextSource = applyComponentInsertion(
      source,
      createJsxOnlyInsertion('<Button>Save</Button>'),
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: 1, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    expect(nextSource).toEqual(
      createArcadeSourceFile('<Box>First</Box>\n<Button>Save</Button>\n<Box>Second</Box>', '')
    )
  })

  it('applies multi-part insertions to JSX and Hooks together', () => {
    const source = createArcadeSourceFile('<BodyShort>Results</BodyShort>', 'const existing = true')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(nextSource.jsx).toContain('<BodyShort>Results</BodyShort>')
    expect(nextSource.jsx).toContain('{...usePaginationState()}')
    expect(nextSource.jsx).not.toContain('{(() => {')
    expect(nextSource.jsx).toContain('srHeading={{ tag: "h2", text: "Result pages" }}')
    expect(nextSource.hooks).toBe(
      'const existing = true\n\n' +
        'export const usePaginationState = (initialPage = 1) => {\n' +
        '  const [pageState, setPageState] = useState(initialPage)\n' +
        '\n' +
        '  return {\n' +
        '    page: pageState,\n' +
        '    onPageChange: setPageState,\n' +
        '  }\n' +
        '}'
    )
  })

  it('keeps Chips insertion JSX visible while moving support code into Hooks', () => {
    const chipsToggleEntry = getCatalogComponent('Chips Toggle')
    const chipsRemovableEntry = getCatalogComponent('Chips Removable')

    if (!chipsToggleEntry?.snippet.hooksCode || !chipsRemovableEntry?.snippet.hooksCode) {
      throw new Error('Expected Chips catalog entries to expose hooks-backed insertion snippets')
    }

    const toggleSource = applyComponentInsertion(
      createArcadeSourceFile('<BodyShort>Results</BodyShort>', ''),
      {
        jsx: chipsToggleEntry.snippet.code,
        hooks: chipsToggleEntry.snippet.hooksCode,
      },
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: 0, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    expect(toggleSource.jsx).toContain('<Chips>')
    expect(toggleSource.jsx).toContain('<Chips.Toggle')
    expect(toggleSource.jsx).toContain('data-color="neutral"')
    expect(toggleSource.jsx).toContain('{options.map((label, id) => (')
    expect(toggleSource.jsx).toContain('selected={selected === id}')
    expect(toggleSource.jsx).toContain('onClick={() => setSelected(id)}')
    expect(toggleSource.jsx).not.toContain('ChipsToggleExample')
    expect(toggleSource.hooks).toContain('const options = [')
    expect(toggleSource.hooks).toContain('const [selected, setSelected] = useState(0)')
    expect(toggleSource.hooks).not.toContain('ChipsToggleExample')

    const removableSource = applyComponentInsertion(
      toggleSource,
      {
        jsx: chipsRemovableEntry.snippet.code,
        hooks: chipsRemovableEntry.snippet.hooksCode,
      },
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: toggleSource.jsx.split('\n').length, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    expect(removableSource.jsx).toContain('{filter2.map((c) => (')
    expect(removableSource.jsx).toContain('<Chips.Removable')
    expect(removableSource.jsx).toContain('data-color="neutral"')
    expect(removableSource.jsx).toContain('setFilter2((x) =>')
    expect(removableSource.jsx).toContain('x.length === 1')
    expect(removableSource.jsx).toContain('? options2')
    expect(removableSource.jsx).toContain(': x.filter((y) => y !== c)')
    expect(removableSource.jsx).not.toContain('ChipsRemovableExample')
    expect(removableSource.hooks).toContain('const options2 = ["Housing", "Income", "Work"]')
    expect(removableSource.hooks).toContain('const [filter2, setFilter2] = useState(options2)')
    expect(removableSource.hooks).not.toContain('ChipsRemovableExample')
  })

  it('deconflicts ProgressBar label ids when the snippet is inserted more than once', () => {
    const progressBarEntry = getCatalogComponent('ProgressBar')

    if (!progressBarEntry) {
      throw new Error('Expected ProgressBar catalog entry to exist')
    }

    const firstSource = applyComponentInsertion(
      createArcadeSourceFile('', ''),
      { jsx: progressBarEntry.snippet.code },
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: 0, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    const secondSource = applyComponentInsertion(
      firstSource,
      { jsx: progressBarEntry.snippet.code },
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: firstSource.jsx.split('\n').length, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    expect(secondSource.jsx).toContain('id="applicationProgressLabel"')
    expect(secondSource.jsx).toContain('aria-labelledby="applicationProgressLabel"')
    expect(secondSource.jsx).toContain('id="applicationProgressLabel2"')
    expect(secondSource.jsx).toContain('aria-labelledby="applicationProgressLabel2"')
    expect(secondSource.jsx).not.toContain('{{progressBarLabelSuffix}}')
  })

  it('avoids support-name collisions when the same multi-part insertion is repeated', () => {
    const firstSource = applyComponentInsertion(
      createArcadeSourceFile('', ''),
      paginationInsertion,
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: 0, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    const secondSource = applyComponentInsertion(firstSource, paginationInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(secondSource.jsx).toContain('{...usePaginationState()}')
    expect(secondSource.jsx).toContain('{...usePaginationState2()}')
    expect(secondSource.hooks).toContain('export const usePaginationState = (initialPage = 1) => {')
    expect(secondSource.hooks).toContain(
      'export const usePaginationState2 = (initialPage = 1) => {'
    )
  })

  it('avoids helper-component name collisions for picker insertions', () => {
    const firstSource = applyComponentInsertion(
      createArcadeSourceFile('', ''),
      datePickerInsertion,
      {
        kind: 'palette',
        activeTab: 'JSX',
        jsxCursor: { line: 0, column: 0 },
        hooksCursor: { line: 0, column: 0 },
      }
    )

    const secondSource = applyComponentInsertion(firstSource, datePickerInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(secondSource.jsx).toContain('<DatePickerField />')
    expect(secondSource.jsx).toContain('<DatePickerField2 />')
    expect(secondSource.hooks).toContain('export const DatePickerField = () => {')
    expect(secondSource.hooks).toContain('export const DatePickerField2 = () => {')
  })

  it('avoids helper-component and popup id collisions for dialog insertions', () => {
    const firstSource = applyComponentInsertion(createArcadeSourceFile('', ''), dialogInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    const secondSource = applyComponentInsertion(firstSource, dialogInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(secondSource.jsx).toContain('<ReviewDialog />')
    expect(secondSource.jsx).toContain('<ReviewDialog2 />')
    expect(secondSource.hooks).toContain('export const ReviewDialog = () => {')
    expect(secondSource.hooks).toContain('export const ReviewDialog2 = () => {')
    expect(secondSource.hooks).toContain('id="review-dialog-popup"')
    expect(secondSource.hooks).toContain('id="review-dialog-popup2"')
  })

  it('avoids helper-component and anchor/id collisions for popover insertions', () => {
    const firstSource = applyComponentInsertion(createArcadeSourceFile('', ''), popoverInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    const secondSource = applyComponentInsertion(firstSource, popoverInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(secondSource.jsx).toContain('ref={setAnchorEl}')
    expect(secondSource.jsx).toContain('ref={setAnchorEl2}')
    expect(secondSource.hooks).toContain(
      'const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)'
    )
    expect(secondSource.hooks).toContain(
      'const [anchorEl2, setAnchorEl2] = useState<HTMLButtonElement | null>(null)'
    )
    expect(secondSource.hooks).toContain('const [openState, setOpenState] = useState(false)')
    expect(secondSource.hooks).toContain('const [openState2, setOpenState2] = useState(false)')
    expect(secondSource.hooks).toContain('const popoverId = useId()')
    expect(secondSource.hooks).toContain('const popoverId2 = useId()')
  })

  it('ignores unrelated popup identifiers when inserting the first dialog helper', () => {
    const source = createArcadeSourceFile('', 'const popup = true')

    const nextSource = applyComponentInsertion(source, dialogInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(nextSource.jsx).toBe('<ReviewDialog />')
    expect(nextSource.hooks).toContain('const popup = true')
    expect(nextSource.hooks).toContain('export const ReviewDialog = () => {')
    expect(nextSource.hooks).toContain('const [dialogOpen, setDialogOpen] = useState(false)')
    expect(nextSource.hooks).toContain('id="review-dialog-popup"')
    expect(nextSource.hooks).not.toContain('ReviewDialog2')
    expect(nextSource.hooks).not.toContain('dialogOpen2')
    expect(nextSource.hooks).not.toContain('review-dialog-popup2')
  })

  it('pairs contextual Tabs.Panel insertions with the next unpaired tab value', () => {
    const nextSource = applyAutocompleteInsertionWithMarker(
      '<Tabs>\n' +
        '  <Tabs.List>\n' +
        '    <Tabs.Tab value="overview" label="Overview" />\n' +
        '    <Tabs.Tab value="timeline" label="Timeline" />\n' +
        '  </Tabs.List>\n' +
        '  <Tabs.Panel value="overview">Overview of the application.</Tabs.Panel>\n' +
        '  <__CURSOR__\n' +
        '</Tabs>',
      tabsPanelAutocompleteInsertion
    )

    expect(nextSource.jsx).toContain(
      '<Tabs.Panel value="timeline">\n  Timeline content.\n</Tabs.Panel>'
    )
  })

  it('pairs contextual Tabs.Tab insertions with the next unpaired panel value', () => {
    const nextSource = applyAutocompleteInsertionWithMarker(
      '<Tabs>\n' +
        '  <Tabs.List>\n' +
        '    <Tabs.Tab value="overview" label="Overview" />\n' +
        '    <__CURSOR__\n' +
        '  </Tabs.List>\n' +
        '  <Tabs.Panel value="overview">Overview of the application.</Tabs.Panel>\n' +
        '  <Tabs.Panel value="tab1">Tab 1 content.</Tabs.Panel>\n' +
        '</Tabs>',
      tabsTabAutocompleteInsertion
    )

    expect(nextSource.jsx).toContain('<Tabs.Tab value="tab1" label="Tab 1" />')
  })

  it('reuses unpaired panel values when inserting a contextual Tabs.List scaffold', () => {
    const nextSource = applyAutocompleteInsertionWithMarker(
      '<Tabs>\n' +
        '  <Tabs.Panel value="tab1">Tab 1 content.</Tabs.Panel>\n' +
        '  <__CURSOR__\n' +
        '</Tabs>',
      tabsListAutocompleteInsertion
    )

    expect(nextSource.jsx).toContain(
      '<Tabs.List>\n  <Tabs.Tab value="tab1" label="Tab 1" />\n</Tabs.List>'
    )
  })

  it('generates the next sequential tab value when all existing Tabs values are already paired', () => {
    const nextSource = applyAutocompleteInsertionWithMarker(
      '<Tabs>\n' +
        '  <Tabs.List>\n' +
        '    <Tabs.Tab value="overview" label="Overview" />\n' +
        '  </Tabs.List>\n' +
        '  <Tabs.Panel value="overview">Overview of the application.</Tabs.Panel>\n' +
        '  <__CURSOR__\n' +
        '</Tabs>',
      tabsPanelAutocompleteInsertion
    )

    expect(nextSource.jsx).toContain('<Tabs.Panel value="tab1">\n  Tab 1 content.\n</Tabs.Panel>')
  })

  it('replaces JSX completion ranges and preserves existing Hooks code', () => {
    const source = createArcadeSourceFile('<Pagi', 'const selectedFilter = "all"')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'autocomplete',
      from: 0,
      to: 5,
    })

    expect(nextSource.jsx).toContain('<Pagination')
    expect(nextSource.jsx).toContain('{...usePaginationState()}')
    expect(nextSource.jsx).not.toContain('{(() => {')
    expect(nextSource.hooks).toBe(
      'const selectedFilter = "all"\n\n' +
        'export const usePaginationState = (initialPage = 1) => {\n' +
        '  const [pageState, setPageState] = useState(initialPage)\n' +
        '\n' +
        '  return {\n' +
        '    page: pageState,\n' +
        '    onPageChange: setPageState,\n' +
        '  }\n' +
        '}'
    )
  })
})

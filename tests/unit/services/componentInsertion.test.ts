import { describe, expect, it } from 'vitest'
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

describe('component insertion service', () => {
  it('preserves JSX-only Add menu insertion on the active JSX tab', () => {
    const source = createArcadeSourceFile('<Box>First</Box>\n<Box>Second</Box>', '')

    const nextSource = applyComponentInsertion(source, createJsxOnlyInsertion('<Button>Save</Button>'), {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

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

  it('avoids support-name collisions when the same multi-part insertion is repeated', () => {
    const firstSource = applyComponentInsertion(createArcadeSourceFile('', ''), paginationInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

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
    const firstSource = applyComponentInsertion(createArcadeSourceFile('', ''), datePickerInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

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

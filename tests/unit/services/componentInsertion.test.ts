import { describe, expect, it } from 'vitest'
import { createArcadeSourceFile } from '@/services/projectSource'
import { applyComponentInsertion, createJsxOnlyInsertion } from '@/services/componentInsertion'
import { transpileCode } from '@/services/transpiler'

const paginationInsertion = {
  jsx:
    '<Pagination\n' +
    '  page={pageState{{paginationSuffix}}}\n' +
    '  onPageChange={setPageState{{paginationSuffix}}}\n' +
    '  count={9}\n' +
    '  boundaryCount={1}\n' +
    '  siblingCount={1}\n' +
    '/>',
  componentSetup:
    'const [pageState{{paginationSuffix}}, setPageState{{paginationSuffix}}] = useState(1)',
}

const hookBackedInsertion = {
  jsx: '<BodyShort>{statusLabel}</BodyShort>',
  hooks:
    'export const useStatusLabel = () => {\n' +
    '  return "Ready"\n' +
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

  it('applies hook-backed insertions to JSX and Hooks together', () => {
    const source = createArcadeSourceFile('<BodyShort>Results</BodyShort>', 'const existing = true')

    const nextSource = applyComponentInsertion(source, hookBackedInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 1, column: 0 },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(nextSource.jsx).toContain('<BodyShort>Results</BodyShort>')
    expect(nextSource.jsx).toContain('{statusLabel}')
    expect(nextSource.hooks).toBe(
      'const existing = true\n\n' +
        'export const useStatusLabel = () => {\n' +
        '  return "Ready"\n' +
        '}'
    )
  })

  it('wraps the page once and keeps Pagination insertions composable inside primitives', () => {
    const source = createArcadeSourceFile('<VStack><BodyShort>Before</BodyShort></VStack>', '')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'palette',
      activeTab: 'JSX',
      jsxCursor: { line: 0, column: '<VStack><BodyShort>Before</BodyShort>'.length },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(nextSource.jsx).toContain('const [pageState, setPageState] = useState(1)')
    expect(nextSource.jsx).toContain(
      '<VStack><BodyShort>Before</BodyShort><Pagination'
    )
    expect(nextSource.jsx).toContain('page={pageState}')
    expect(nextSource.jsx).toContain('onPageChange={setPageState}')
    expect(nextSource.hooks).toBe('')
  })

  it('avoids setup-name collisions when the same Pagination insertion is repeated', () => {
    const firstSource = applyComponentInsertion(
      createArcadeSourceFile('<VStack></VStack>', ''),
      paginationInsertion,
      {
        kind: 'autocomplete',
        from: '<VStack>'.length,
        to: '<VStack>'.length,
      }
    )

    const secondInsertionPoint = firstSource.jsx.indexOf('</VStack>')

    const secondSource = applyComponentInsertion(firstSource, paginationInsertion, {
      kind: 'autocomplete',
      from: secondInsertionPoint,
      to: secondInsertionPoint,
    })

    expect(secondSource.jsx).toContain('const [pageState, setPageState] = useState(1)')
    expect(secondSource.jsx).toContain('const [pageState2, setPageState2] = useState(1)')
    expect(secondSource.jsx).toContain('page={pageState}')
    expect(secondSource.jsx).toContain('page={pageState2}')
  })

  it('routes component-setup insertions into JSX even when the Hooks tab is active', () => {
    const source = createArcadeSourceFile('<VStack></VStack>', 'const existing = true')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'palette',
      activeTab: 'Hooks',
      jsxCursor: { line: 0, column: '<VStack>'.length },
      hooksCursor: { line: 0, column: 0 },
    })

    expect(nextSource.jsx).toContain('const [pageState, setPageState] = useState(1)')
    expect(nextSource.jsx).toContain('<VStack><Pagination')
    expect(nextSource.hooks).toBe('const existing = true')
  })

  it('injects component setup into exported function components instead of wrapping the whole file', async () => {
    const source = createArcadeSourceFile(
      'export default function App() {\n  return <VStack></VStack>\n}',
      ''
    )
    const insertionPoint = source.jsx.indexOf('</VStack>')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'autocomplete',
      from: insertionPoint,
      to: insertionPoint,
    })

    expect(nextSource.jsx).toContain('export default function App() {\n  // __AKSEL_ARCADE_COMPONENT_SETUP__')
    expect(nextSource.jsx).toContain('const [pageState, setPageState] = useState(1)')
    expect(nextSource.jsx).toContain('return <VStack><Pagination')
    expect(nextSource.jsx).not.toContain('(() => {')

    await expect(transpileCode(nextSource.jsx, nextSource.hooks)).resolves.toMatchObject({
      success: true,
      error: null,
    })
  })

  it('injects component setup into exported arrow-function App modules without wrapping the file', async () => {
    const source = createArcadeSourceFile(
      'import { VStack } from "@navikt/ds-react"\n' +
        'export const App = (): JSX.Element => {\n' +
        '  return <VStack></VStack>\n' +
        '}\n' +
        'export default App',
      ''
    )
    const insertionPoint = source.jsx.indexOf('</VStack>')

    const nextSource = applyComponentInsertion(source, paginationInsertion, {
      kind: 'autocomplete',
      from: insertionPoint,
      to: insertionPoint,
    })

    expect(nextSource.jsx).toContain('export const App = (): JSX.Element => {\n  // __AKSEL_ARCADE_COMPONENT_SETUP__')
    expect(nextSource.jsx).toContain('const [pageState, setPageState] = useState(1)')
    expect(nextSource.jsx).toContain('return <VStack><Pagination')
    expect(nextSource.jsx).not.toContain('(() => {')

    await expect(transpileCode(nextSource.jsx, nextSource.hooks)).resolves.toMatchObject({
      success: true,
      error: null,
    })
  })

  it('replaces JSX completion ranges and preserves existing Hooks code', () => {
    const source = createArcadeSourceFile('<Pagi', 'const selectedFilter = "all"')

    const autocompleteNextSource = applyComponentInsertion(source, hookBackedInsertion, {
      kind: 'autocomplete',
      from: 0,
      to: 5,
    })

    expect(autocompleteNextSource.jsx).toContain('<BodyShort>{statusLabel}</BodyShort>')
    expect(autocompleteNextSource.hooks).toBe(
      'const selectedFilter = "all"\n\n' +
        'export const useStatusLabel = () => {\n' +
        '  return "Ready"\n' +
        '}'
    )
  })
})

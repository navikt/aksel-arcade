import * as Babel from '@babel/standalone'
import { describe, expect, it } from 'vitest'
import { buildJsxValidationSource, looksLikeModuleSource } from '@/services/jsxValidation'

describe('buildJsxValidationSource', () => {
  it('treats a component-setup IIFE wrapper as a valid single root', () => {
    const { code } = buildJsxValidationSource(
      '(() => {\n' +
        '  const [pageState, setPageState] = useState(1)\n' +
        '  return <Pagination page={pageState} onPageChange={setPageState} count={9} />\n' +
        '})()'
    )

    expect(() =>
      Babel.transform(code, {
        presets: ['react', 'typescript'],
        filename: 'app.tsx',
      })
    ).not.toThrow()
  })

  it('still wraps multi-root JSX in a fragment for validation', () => {
    const { code, sourceStartLine } = buildJsxValidationSource('<Box>One</Box>\n<Box>Two</Box>')

    expect(code).toContain('<>')
    expect(sourceStartLine).toBe(4)
    expect(() =>
      Babel.transform(code, {
        presets: ['react', 'typescript'],
        filename: 'app.tsx',
      })
    ).not.toThrow()
  })

  it('passes exported App sources through without wrapping them as JSX children', () => {
    const source =
      'export default function App() {\n' +
      '  const [pageState, setPageState] = useState(1)\n' +
      '  return <Pagination page={pageState} onPageChange={setPageState} count={9} />\n' +
      '}'
    const { code, sourceStartLine } = buildJsxValidationSource(source)

    expect(looksLikeModuleSource(source)).toBe(true)
    expect(code).toBe(source)
    expect(sourceStartLine).toBe(1)
    expect(() =>
      Babel.transform(code, {
        presets: ['react', 'typescript'],
        filename: 'app.tsx',
      })
    ).not.toThrow()
  })
})

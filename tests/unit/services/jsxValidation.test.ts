import * as Babel from '@babel/standalone'
import { describe, expect, it } from 'vitest'
import { buildJsxValidationSource } from '@/services/jsxValidation'

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
})

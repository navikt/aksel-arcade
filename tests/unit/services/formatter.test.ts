import { describe, expect, it } from 'vitest'
import { formatCode } from '@/services/formatter'

describe('formatCode', () => {
  it('formats component-setup wrappers without treating nested JSX as multiple roots', async () => {
    const source =
      '(() => {\n' +
      'const [pageState, setPageState] = useState(1)\n' +
      'return (<><Pagination page={pageState} onPageChange={setPageState} count={9} /><Box /></>)\n' +
      '})()'

    await expect(formatCode(source, { parser: 'babel' })).resolves.toContain('const [pageState, setPageState] = useState(1)')
  })
})

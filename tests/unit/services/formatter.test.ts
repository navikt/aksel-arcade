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

  it('formats exported App sources directly without wrapping them in a JSX return shell', async () => {
    const source =
      'export default function App() {\n' +
      'const [pageState, setPageState] = useState(1)\n' +
      'return <VStack><Pagination page={pageState} onPageChange={setPageState} count={9} /></VStack>\n' +
      '}'

    await expect(formatCode(source, { parser: 'babel' })).resolves.toContain(
      'export default function App()'
    )
  })

  it('formats import-led component modules directly', async () => {
    const source =
      '// comment before imports\n' +
      "import { VStack } from '@navikt/ds-react'\n" +
      'export default function App() {\n' +
      'return <VStack />\n' +
      '}'

    await expect(formatCode(source, { parser: 'babel' })).resolves.toContain(
      "import { VStack } from '@navikt/ds-react'"
    )
  })
})

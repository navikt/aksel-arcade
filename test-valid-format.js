import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'

const validUglyCode = `<><Button variant="primary">Click me</Button>
          <Button variant="primary">Click me</Button>
<Button variant    ="primary   ">Click me    </Button></>`

async function test() {
  const wrappedCode = `function Component() {\n  return (\n    ${validUglyCode}\n  )\n}`
  
  console.log('=== UGLY INPUT ===')
  console.log(validUglyCode)
  
  const formatted = await prettier.format(wrappedCode, {
    parser: 'babel',
    plugins: [parserEstree, parserBabel],
    printWidth: 100,
    tabWidth: 2,
    singleQuote: true,
    semi: false,
    trailingComma: 'es5',
    arrowParens: 'always',
    jsxSingleQuote: false,
    bracketSpacing: true,
  })
  
  // Extract
  const withParens = formatted.match(/return \(\s*([\s\S]*?)\s*\)/m)
  if (withParens && withParens[1]) {
    console.log('\n=== FORMATTED OUTPUT ===')
    console.log(withParens[1].trim())
  }
}

test().catch(console.error)

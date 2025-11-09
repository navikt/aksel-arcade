import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'

const uglyCode = `<Button variant="primary">Click me</Button>
          <Button variant="primary">Click me</Button>
<Button variant    ="primary   ">Click me    </ 
            Button    >`

async function test() {
  const wrappedCode = `function Component() {\n  return (\n    ${uglyCode}\n  )\n}`
  
  console.log('=== UGLY INPUT ===')
  console.log(uglyCode)
  console.log('\n=== WRAPPED ===')
  console.log(wrappedCode)
  
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
  
  console.log('\n=== FORMATTED WRAPPER ===')
  console.log(formatted)
  
  // Extract
  const withoutParens = formatted.match(/return\s+([\s\S]*?)(?:\n}|$)/m)
  if (withoutParens && withoutParens[1]) {
    console.log('\n=== EXTRACTED JSX ===')
    console.log(withoutParens[1].trim())
  }
}

test().catch(console.error)

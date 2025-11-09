import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'

const yourCode = `<Button variant="primary">Click me</Button>
  <Button variant="primary">Click me</Button>
  <Button variant    ="primary   ">Click me</Button>`

async function test() {
  console.log('=== YOUR INPUT ===')
  console.log(yourCode)
  console.log('Length:', yourCode.length)
  
  const wrappedCode = `function Component() {\n  return (\n    ${yourCode}\n  )\n}`
  
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
  
  // Extract with parens pattern
  const withParens = formatted.match(/return \(\s*([\s\S]*?)\s*\)/m)
  if (withParens && withParens[1]) {
    const result = withParens[1].trim()
    console.log('\n=== EXTRACTED (with parens) ===')
    console.log(result)
    console.log('Length:', result.length)
    console.log('Changed?', result !== yourCode)
    return
  }
  
  // Extract without parens pattern
  const withoutParens = formatted.match(/return\s+([\s\S]*?)(?:\n}|$)/m)
  if (withoutParens && withoutParens[1]) {
    const result = withoutParens[1].trim()
    console.log('\n=== EXTRACTED (without parens) ===')
    console.log(result)
    console.log('Length:', result.length)
    console.log('Changed?', result !== yourCode)
    return
  }
  
  console.log('\n❌ NO PATTERN MATCHED')
}

test().catch(console.error)

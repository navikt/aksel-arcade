import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'

async function testFormatter(testName, messyCode) {
  console.log(`\n=== TEST: ${testName} ===`)
  console.log('Input:', messyCode)
  
  const wrappedCode = `function Component() {\n  return (\n    ${messyCode}\n  )\n}`

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

  console.log('Formatted wrapper:\n', formatted)
  
  // Try pattern 1: with parentheses
  const withParens = formatted.match(/return \(\s*([\s\S]*?)\s*\)/m)
  if (withParens && withParens[1]) {
    console.log('✅ Matched WITH parens pattern')
    console.log('Extracted:', withParens[1].trim())
    console.log('Starts with semicolon?', withParens[1].trim().startsWith(';'))
    return
  }

  // Try pattern 2: without parentheses
  const withoutParens = formatted.match(/return\s+([\s\S]*?)(?:\n}|$)/m)
  if (withoutParens && withoutParens[1]) {
    console.log('✅ Matched WITHOUT parens pattern')
    console.log('Extracted:', withoutParens[1].trim())
    console.log('Starts with semicolon?', withoutParens[1].trim().startsWith(';'))
    return
  }

  console.log('❌ No pattern matched!')
}

async function runTests() {
  await testFormatter('Simple single-line', '<Button variant="primary">Click me</Button>')
  await testFormatter('Multi-line JSX', `<Box padding="4">
    <Button variant="primary">Click me</Button>
    <Button variant="secondary">Cancel</Button>
  </Box>`)
  await testFormatter('Complex nested', `<VStack gap="4"><Heading size="large">Title</Heading><BodyShort>Text</BodyShort></VStack>`)
}

runTests().catch(console.error)

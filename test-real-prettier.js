import prettier from 'prettier/standalone'
import parserBabel from 'prettier/plugins/babel'
import parserEstree from 'prettier/plugins/estree'

async function testFormatter() {
  // Test with messy JSX that needs formatting
  const messyCode = `<Button    variant="primary"   >Click me</Button>`
  
  // Wrap it like our formatter does
  const wrappedCode = `function Component() {
  return (
    ${messyCode}
  )
}`

  console.log('=== INPUT CODE ===')
  console.log(messyCode)
  console.log()
  
  // Format the wrapped code
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

  console.log('=== FORMATTED WRAPPED CODE ===')
  console.log(formatted)
  console.log()
  
  // Extract using our regex
  const match = formatted.match(/return \(\s*([\s\S]*?)\s*\n\s*\)/m)
  if (match && match[1]) {
    const extracted = match[1].trim()
    console.log('=== EXTRACTED CODE ===')
    console.log(extracted)
    console.log()
    console.log('Starts with semicolon?', extracted.startsWith(';'))
    console.log('✅ SUCCESS - No semicolon!')
  } else {
    console.log('❌ FAILED - Regex did not match')
    console.log('Match:', match)
  }
}

testFormatter().catch(console.error)

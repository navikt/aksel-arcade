// Test the formatter wrap/unwrap logic
const testCode = `<Button variant="primary">Click me</Button>`

// Simulate wrapping
const wrappedCode = `function Component() {\n  return (\n${testCode}\n  )\n}`

console.log('Wrapped code:')
console.log(wrappedCode)

// Simulate what Prettier would return (formatted)
const formattedWrapped = `function Component() {
  return (
    <Button variant="primary">Click me</Button>
  )
}
`

console.log('\nFormatted wrapped code:')
console.log(formattedWrapped)

// Extract logic
const match = formattedWrapped.match(/return \(([\s\S]*?)\n\s*\)/m)
if (match && match[1]) {
  const extracted = match[1].trim()
  console.log('\nExtracted code:')
  console.log(extracted)
  console.log('\nHas semicolon at start?', extracted.startsWith(';'))
} else {
  console.log('\nPattern did not match!')
}

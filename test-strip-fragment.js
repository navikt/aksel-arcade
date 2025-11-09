// Test stripFragmentWrapper logic
function stripFragmentWrapper(code) {
  const trimmed = code.trim()
  
  // Match Fragment wrapper: <>\n...content...\n</>
  const fragmentMatch = trimmed.match(/^<>\s*([\s\S]*?)\s*<\/>$/m)
  if (fragmentMatch && fragmentMatch[1]) {
    return fragmentMatch[1].trim()
  }
  
  return code
}

const testCases = [
  {
    name: 'Fragment with multiple buttons',
    input: `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`,
    expected: '<Button variant="primary">Click me</Button>\n\n      <Button variant="primary">Click me</Button>\n      <Button variant="primary">Click me</Button>\n      <Button variant="primary">Click me</Button>\n      <Button variant="secondary">Cancel</Button>'
  },
  {
    name: 'Single button (no Fragment)',
    input: '<Button variant="primary">Click me</Button>',
    expected: '<Button variant="primary">Click me</Button>'
  },
  {
    name: 'Nested Fragment (should not strip)',
    input: '<div><>Content</></div>',
    expected: '<div><>Content</></div>'
  }
]

testCases.forEach(({ name, input, expected }) => {
  console.log(`\n=== ${name} ===`)
  console.log('Input:', input)
  const result = stripFragmentWrapper(input)
  console.log('Result:', result)
  console.log('Expected:', expected)
  console.log('Match:', result === expected ? '✅ PASS' : '❌ FAIL')
})

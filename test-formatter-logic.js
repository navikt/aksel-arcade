// Test formatter detection logic
const testCode = `<Button variant="primary">Click me</Button>

  
  
                <Button variant="primary">Click me</Button> 
  <Button variant="primary">Click me</Button>
  <Button variant    ="primary">Click me</Button>
      <Button    variant="secondary"   >Cancel</Button>`

console.log('=== TEST CODE ===')
console.log(testCode)
console.log('\n=== DETECTION LOGIC ===')

const trimmedCode = testCode.trim()
console.log('Trimmed code length:', trimmedCode.length)

// Old broken logic
const oldMatches = trimmedCode.split(/^<\w+/gm)
console.log('Old logic split result length:', oldMatches.length)
console.log('Old logic would wrap?', oldMatches.length > 2)

// New logic
const rootElementMatches = trimmedCode.match(/^\s*</gm)
console.log('New logic matches:', rootElementMatches)
console.log('New logic match count:', rootElementMatches ? rootElementMatches.length : 0)
console.log('New logic would wrap?', rootElementMatches && rootElementMatches.length > 1)

console.log('\n=== WRAPPED CODE ===')
const codeToFormat = rootElementMatches && rootElementMatches.length > 1 
  ? `<>\n${testCode}\n</>`
  : testCode

console.log(codeToFormat)

console.log('\n=== FINAL WRAPPED ===')
const wrappedCode = `function Component() {
  return (
    ${codeToFormat}
  )
}`
console.log(wrappedCode)

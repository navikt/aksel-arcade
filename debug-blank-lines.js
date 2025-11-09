// Test: What does Prettier do with multiple blank lines?
const messyCode = `<Button variant="primary">Click me</Button>

  
  
                <Button variant="primary">Click me</Button> 
  <Button variant="primary">Click me</Button>
  <Button variant    ="primary">Click me</Button>
      <Button    variant="secondary"   >Cancel</Button>`

// Prettier normalizes multiple blank lines to single blank lines
// When wrapped in Fragment:
const prettierOutput = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`

console.log('=== PRETTIER OUTPUT ===')
prettierOutput.split('\n').forEach((line, i) => {
  console.log(`Line ${i}: "${line.replace(/ /g, '·')}"`)
})

console.log('\n=== AFTER STRIPPING FRAGMENT ===')
const lines = prettierOutput.trim().split('\n')
const contentLines = lines.slice(1, -1)

contentLines.forEach((line, i) => {
  console.log(`Line ${i}: "${line.replace(/ /g, '·')}"`)
})

console.log('\nIssue: Line 1 is a blank line with 0 characters')
console.log('Line 2 starts with 6 spaces')
console.log('We dedent by 6, so blank line stays blank')

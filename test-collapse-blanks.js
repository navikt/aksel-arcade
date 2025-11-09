// Test: Collapsing blank lines
const input = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`

function stripFragmentWrapper(code) {
  const trimmed = code.trim()
  
  if (!trimmed.startsWith('<>') || !trimmed.endsWith('</>')) {
    return code
  }
  
  const lines = trimmed.split('\n')
  if (lines.length < 3) return code
  
  const contentLines = lines.slice(1, -1)
  const nonEmptyLines = contentLines.filter(line => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return ''
  
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => line.match(/^(\s*)/)?.[1]?.length || 0)
  )
  
  const dedented = contentLines
    .map(line => (line.trim().length === 0 ? '' : line.slice(minIndent)))
    .join('\n')
    .replace(/\n\n+/g, '\n') // Collapse multiple blank lines
    .trim()
  
  return dedented
}

const result = stripFragmentWrapper(input)

console.log('=== OUTPUT ===')
console.log(result)

console.log('\n=== LINE BY LINE ===')
result.split('\n').forEach((line, i) => {
  console.log(`Line ${i + 1}: "${line}"`)
})

console.log('\n✅ Should have NO blank lines between buttons')

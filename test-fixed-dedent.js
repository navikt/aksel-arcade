// Test FIXED stripFragmentWrapper
function stripFragmentWrapper(code) {
  const trimmed = code.trim()
  
  // Check if wrapped in Fragment
  if (!trimmed.startsWith('<>') || !trimmed.endsWith('</>')) {
    return code
  }
  
  // Split into lines and remove first (<>) and last (</>) lines
  const lines = trimmed.split('\n')
  if (lines.length < 3) return code // Need at least <>, content, </>
  
  // Remove Fragment wrapper lines
  const contentLines = lines.slice(1, -1)
  
  // Find minimum indentation of non-empty lines
  const nonEmptyLines = contentLines.filter(line => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return ''
  
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => line.match(/^(\s*)/)?.[1]?.length || 0)
  )
  
  // Dedent all lines by removing common indentation
  const dedented = contentLines
    .map(line => (line.trim().length === 0 ? '' : line.slice(minIndent)))
    .join('\n')
    .trim()
  
  return dedented
}

const testInput = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`

console.log('=== INPUT ===')
testInput.split('\n').forEach((line, i) => {
  console.log(`Line ${i}: "${line.replace(/ /g, '·')}"`)
})

const result = stripFragmentWrapper(testInput)

console.log('\n=== OUTPUT ===')
result.split('\n').forEach((line, i) => {
  const spaces = line.match(/^(\s*)/)[1].length
  console.log(`Line ${i}: [${spaces} spaces] "${line.replace(/ /g, '·')}"`)
})

console.log('\n✅ All lines should have 0 leading spaces')

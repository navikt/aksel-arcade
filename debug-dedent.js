// Debug the actual indentation issue
const input = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`

console.log('=== RAW INPUT (with visible spaces) ===')
input.split('\n').forEach((line, i) => {
  const spaces = line.match(/^(\s*)/)[1]
  console.log(`Line ${i}: [${spaces.length} spaces] "${line.replace(/ /g, '·')}"`)
})

// Extract content inside <>...</>
const match = input.trim().match(/^<>\s*([\s\S]*?)\s*<\/>$/m)
if (match) {
  const content = match[1]
  
  console.log('\n=== EXTRACTED CONTENT ===')
  content.split('\n').forEach((line, i) => {
    const spaces = line.match(/^(\s*)/)[1]
    console.log(`Line ${i}: [${spaces.length} spaces] "${line.replace(/ /g, '·')}"`)
  })
  
  // Find min indent
  const lines = content.split('\n')
  const nonEmpty = lines.filter(l => l.trim().length > 0)
  const minIndent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)[1].length))
  
  console.log(`\n=== MIN INDENT: ${minIndent} spaces ===`)
  
  // Dedent
  const dedented = lines.map(line => {
    if (line.trim().length === 0) return ''
    return line.slice(minIndent)
  }).join('\n').trim()
  
  console.log('\n=== DEDENTED OUTPUT ===')
  dedented.split('\n').forEach((line, i) => {
    const spaces = line.match(/^(\s*)/)[1]
    console.log(`Line ${i}: [${spaces.length} spaces] "${line.replace(/ /g, '·')}"`)
  })
}

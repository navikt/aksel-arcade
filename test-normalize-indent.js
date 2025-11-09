// Test normalized indentation after stripping Fragment
function stripFragmentWrapper(code) {
  const trimmed = code.trim()
  
  // Match Fragment wrapper: <>\n...content...\n</>
  const fragmentMatch = trimmed.match(/^<>\s*([\s\S]*?)\s*<\/>$/m)
  if (fragmentMatch && fragmentMatch[1]) {
    const content = fragmentMatch[1]
    
    // Normalize indentation: remove common leading whitespace
    const lines = content.split('\n')
    const nonEmptyLines = lines.filter(line => line.trim().length > 0)
    
    if (nonEmptyLines.length === 0) return content
    
    // Find minimum indentation (excluding empty lines)
    const minIndent = Math.min(
      ...nonEmptyLines.map(line => {
        const match = line.match(/^(\s*)/)
        return match ? match[1].length : 0
      })
    )
    
    // Remove the common indentation from all lines
    const normalized = lines
      .map(line => {
        if (line.trim().length === 0) return '' // Empty lines become truly empty
        return line.slice(minIndent)
      })
      .join('\n')
      .trim()
    
    return normalized
  }
  
  return code
}

const testInput = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`

console.log('=== INPUT ===')
console.log(testInput)

const result = stripFragmentWrapper(testInput)

console.log('\n=== OUTPUT ===')
console.log(result)

console.log('\n=== ANALYSIS ===')
result.split('\n').forEach((line, i) => {
  const indent = line.match(/^(\s*)/)[1].length
  console.log(`Line ${i + 1}: ${indent} spaces: "${line}"`)
})

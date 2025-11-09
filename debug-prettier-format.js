// Debug: See what Prettier outputs with Fragment wrapper
const inputCode = `<Button variant="primary">Click me</Button>

  
  
                <Button variant="primary">Click me</Button> 
  <Button variant="primary">Click me</Button>
  <Button variant    ="primary">Click me</Button>
      <Button    variant="secondary"   >Cancel</Button>`

// This is what formatter does:
const wrappedForPrettier = `function Component() {
  return (
    <>
${inputCode}
</>
  )
}`

console.log('=== INPUT TO PRETTIER ===')
console.log(wrappedForPrettier)

console.log('\n=== AFTER PRETTIER (simulated) ===')
// Prettier would format this to have consistent indentation inside the Fragment
const prettierOutput = `function Component() {
  return (
    <>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>
  );
}`
console.log(prettierOutput)

console.log('\n=== EXTRACTED CONTENT (return statement) ===')
const extracted = `<>
      <Button variant="primary">Click me</Button>

      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="primary">Click me</Button>
      <Button variant="secondary">Cancel</Button>
    </>`
console.log(extracted)

console.log('\n=== ISSUE: All content has 6-space indent inside Fragment ===')
console.log('We need to strip 6 spaces from ALL lines after removing Fragment wrapper')

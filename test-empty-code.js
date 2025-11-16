// Test transpiler with empty code
import Babel from '@babel/standalone'

console.log('=== TEST 1: Empty string ===')
const emptyCode = ''
const trimmed = emptyCode.trim()
console.log('Trimmed length:', trimmed.length)
console.log('Is empty:', !trimmed)

if (!trimmed) {
  console.log('✓ Early return with: function App() { return null; }')
}

console.log('\n=== TEST 2: Whitespace only ===')
const whitespaceCode = '   \n  \n  '
const trimmed2 = whitespaceCode.trim()
console.log('Trimmed length:', trimmed2.length)
console.log('Is empty:', !trimmed2)

if (!trimmed2) {
  console.log('✓ Early return with: function App() { return null; }')
}

console.log('\n=== TEST 3: Try to transpile empty wrapped code (what was happening before) ===')
try {
  const badWrappedCode = `function App() {
  return (
    
  );
}`
  console.log('Attempting to transpile:')
  console.log(badWrappedCode)
  
  const result = Babel.transform(badWrappedCode, {
    presets: ['react', 'typescript'],
    filename: 'app.tsx',
  })
  console.log('❌ Should have failed but got:', result.code)
} catch (error) {
  console.log('✓ Expected error:', error.message)
}

console.log('\n=== TEST 4: Transpile good empty code ===')
try {
  const goodCode = 'function App() { return null; }'
  const result = Babel.transform(goodCode, {
    presets: ['react', 'typescript'],
    filename: 'app.tsx',
  })
  console.log('✓ Success! Output:', result.code)
} catch (error) {
  console.log('❌ Unexpected error:', error.message)
}

// Test actual transpiler function with empty code
import { transpileCode } from './src/services/transpiler.js'

console.log('=== Testing transpileCode function ===\n')

console.log('TEST 1: Empty JSX code')
const result1 = await transpileCode('', '')
console.log('Success:', result1.success)
console.log('Code:', result1.code)
console.log('Error:', result1.error)

console.log('\n\nTEST 2: Whitespace-only JSX code')
const result2 = await transpileCode('   \n  \n  ', '')
console.log('Success:', result2.success)
console.log('Code:', result2.code)
console.log('Error:', result2.error)

console.log('\n\nTEST 3: Valid JSX code')
const result3 = await transpileCode('<Button>Hello</Button>', '')
console.log('Success:', result3.success)
console.log('Code length:', result3.code?.length)
console.log('Error:', result3.error)
console.log('Contains App:', result3.code?.includes('App'))

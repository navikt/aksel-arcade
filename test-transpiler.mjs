// Test script to verify transpiler behavior
// Run with: node --loader tsx test-transpiler.mjs

import { transpileCode } from './src/services/transpiler.ts'

async function test() {
  console.log('=== Test 1: Simple Alert ===\n')
  
  const jsxCode1 = '<Alert variant="info">Alert message</Alert>'
  const hooksCode1 = ''
  
  const result1 = await transpileCode(jsxCode1, hooksCode1)
  
  if (result1.success) {
    console.log('✅ Success!')
    console.log('Transpiled code:')
    console.log(result1.code)
  } else {
    console.log('❌ Error:', result1.error?.message)
  }
  
  console.log('\n\n=== Test 2: Form Summary Template ===\n')
  
  const jsxCode2 = `export default function App() {
  return (
    <BoxNew asChild background="default" paddingBlock="space-12">
      <Page>
        <Alert variant="info">Test</Alert>
      </Page>
    </BoxNew>
  )
}`
  const hooksCode2 = ''
  
  const result2 = await transpileCode(jsxCode2, hooksCode2)
  
  if (result2.success) {
    console.log('✅ Success!')
    console.log('Transpiled code (first 300 chars):')
    console.log(result2.code?.substring(0, 300))
  } else {
    console.log('❌ Error:', result2.error?.message)
  }
}

test().catch(console.error)

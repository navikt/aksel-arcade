import { describe, it, expect } from 'vitest'
import { transpileCode } from '@/services/transpiler'

describe('Transpiler Integration Tests', () => {
  it('should transpile default export function to App component', async () => {
    const jsxCode = `import { Button } from "@navikt/ds-react";

export default function App() {
  return <Button>Hello</Button>;
}`

    const result = await transpileCode(jsxCode, '')
    
    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('App')
    expect(result.code).not.toContain('export')
    expect(result.code).not.toContain('import')
    
    // Verify React.createElement is present (transpiled JSX)
    expect(result.code).toContain('React.createElement')
  })

  it('should transpile named export function and create App reference', async () => {
    const jsxCode = `import { Heading } from "@navikt/ds-react";

export default function MyComponent() {
  return <Heading>Test</Heading>;
}`

    const result = await transpileCode(jsxCode, '')
    
    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('MyComponent')
    expect(result.code).toContain('App')
  })

  it('should handle arrow function components', async () => {
    const jsxCode = `import { Box } from "@navikt/ds-react";

export default () => {
  return <Box>Content</Box>;
}`

    const result = await transpileCode(jsxCode, '')
    
    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('App')
  })

  it('should combine hooks code with jsx code', async () => {
    const hooksCode = `import { useState } from "react";

export const useCounter = () => {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
}`

    const jsxCode = `import { Button } from "@navikt/ds-react";

export default function App() {
  const { count, increment } = useCounter();
  return <Button onClick={increment}>Count: {count}</Button>;
}`

    const result = await transpileCode(jsxCode, hooksCode)
    
    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('useCounter')
    expect(result.code).toContain('App')
    expect(result.code).not.toContain('import')
  })

  it('should report syntax errors', async () => {
    const jsxCode = `export default function App() {
  return <Button>Unclosed
}`

    const result = await transpileCode(jsxCode, '')
    
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.error?.message).toBeTruthy()
  })

  it('should handle JSX with fragments', async () => {
    const jsxCode = `export default function App() {
  return (
    <>
      <div>First</div>
      <div>Second</div>
    </>
  );
}`

    const result = await transpileCode(jsxCode, '')
    
    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('React.createElement')
  })
})

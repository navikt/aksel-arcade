import { describe, it, expect } from 'vitest'
import { transpileCode } from '../../src/services/transpiler'

describe('Sandbox Integration Tests', () => {
  describe('Transpilation', () => {
    it('should transpile simple JSX code without imports', async () => {
      const jsxCode = `
export default function App() {
  return <Button>Hello</Button>;
}`
      const hooksCode = ''

      const result = await transpileCode(jsxCode, hooksCode)

      expect(result.success).toBe(true)
      expect(result.code).toBeTruthy()
      expect(result.code).not.toContain('export')
      expect(result.code).toContain('React.createElement')
      expect(result.code).toContain('Button')
    })

    it('should remove Aksel imports', async () => {
      const jsxCode = `
import { Button, Box } from '@navikt/ds-react';

export default function App() {
  return <Box><Button>Click</Button></Box>;
}`

      const result = await transpileCode(jsxCode, '')

      expect(result.success).toBe(true)
      expect(result.code).not.toContain('import')
      expect(result.code).not.toContain('@navikt/ds-react')
    })

    it('should transpile JSX with custom hooks code', async () => {
      const jsxCode = `
import { useCounter } from './hooks';

export default function App() {
  const { count, increment } = useCounter();
  return <Button onClick={increment}>{count}</Button>;
}`

      const hooksCode = `
import { useState } from 'react';

export const useCounter = () => {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
};`

      const result = await transpileCode(jsxCode, hooksCode)

      expect(result.success).toBe(true)
      expect(result.code).toContain('useCounter')
      expect(result.code).toContain('useState')
      expect(result.code).not.toContain('./hooks')
    })

    it('should handle React hooks correctly', async () => {
      const jsxCode = `
import { useState, useEffect } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('Count:', count);
  }, [count]);
  
  return <Button onClick={() => setCount(count + 1)}>{count}</Button>;
}`

      const result = await transpileCode(jsxCode, '')

      expect(result.success).toBe(true)
      expect(result.code).toContain('useState')
      expect(result.code).toContain('useEffect')
    })

    it('should handle compile errors gracefully', async () => {
      const jsxCode = `
export default function App() {
  return <Button>;  // Invalid JSX - missing closing tag
}`

      const result = await transpileCode(jsxCode, '')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.error?.message).toBeTruthy()
    })

    it('should provide detailed error info with line and column', async () => {
      const jsxCode = `
export default function App() {
  return <Button
}`

      const result = await transpileCode(jsxCode, '')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('Unexpected token')
      // Should have line number
      expect(result.error?.line).not.toBeNull()
    })

    it('should handle syntax errors in hooks code', async () => {
      const hooksCode = `
export const useBroken = () => {
  const [state] = useState(;  // Syntax error
}`

      const result = await transpileCode('export default () => <div />', hooksCode)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('Code Execution Format', () => {
    it('should produce code that defines App function', async () => {
      const jsxCode = `
export default function App() {
  return <div>Test</div>;
}`

      const result = await transpileCode(jsxCode, '')
      
      expect(result.success).toBe(true)
      expect(result.code).toContain('function App()')
    })

    it('should combine hooks and JSX into single executable code', async () => {
      const jsxCode = `
import { useToggle } from './hooks';
export default function App() {
  const [on, toggle] = useToggle();
  return <Button onClick={toggle}>{on ? 'ON' : 'OFF'}</Button>;
}`

      const hooksCode = `
import { useState } from 'react';
export const useToggle = () => {
  const [on, setOn] = useState(false);
  return [on, () => setOn(!on)];
};`

      const result = await transpileCode(jsxCode, hooksCode)

      expect(result.success).toBe(true)
      // Both hook and component should be in the output
      expect(result.code).toContain('useToggle')
      expect(result.code).toContain('function App()')
    })
  })
})

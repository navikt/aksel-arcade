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

  it('should strip supported production-style imports while preserving aliases', async () => {
    const hooksCode = `import { useState as useReactState } from "react";

export const useToggle = () => {
  const [enabled, setEnabled] = useReactState(false);
  return { enabled, toggle: () => setEnabled((value) => !value) };
}`

    const jsxCode = `import ReactRuntime, { Fragment as ReactFragment } from "react";
import {
  Button as AkselButton,
  type ButtonProps,
} from "@navikt/ds-react";
import * as Icons from "@navikt/aksel-icons";
import "@navikt/ds-css";
import { useToggle as useLocalToggle } from "./hooks";

export default function App() {
  const toggle = useLocalToggle();

  return (
    <ReactFragment>
      <AkselButton icon={<Icons.PlusIcon aria-hidden />} onClick={toggle.toggle}>
        {toggle.enabled ? "On" : "Off"}
      </AkselButton>
    </ReactFragment>
  );
}`

    const result = await transpileCode(jsxCode, hooksCode)

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).not.toContain('import')
    expect(result.code).not.toContain('@navikt')
    expect(result.code).toContain('const useReactState = React.useState')
    expect(result.code).toContain('const ReactRuntime = React')
    expect(result.code).toContain('const ReactFragment = React.Fragment')
    expect(result.code).toContain('const AkselButton = Button')
    expect(result.code).toContain('const Icons = AkselIcons')
    expect(result.code).toContain('const useLocalToggle = useToggle')
  })

  it('should surface unsupported imports instead of leaving runtime import errors', async () => {
    const jsxCode = `import { fetchUser } from "./api";

export default function App() {
  return <Button>{fetchUser.name}</Button>;
}`

    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('Unsupported import from "./api"')
    expect(result.error?.message).toContain('keep playground code import-free')
    expect(result.error?.line).toBe(0)
    expect(result.code).toBeNull()
  })

  it('should avoid duplicate runtime bindings for imports shared by both tabs', async () => {
    const hooksCode = `import { useState as useReactState } from "react";

export const useCounter = () => {
  const [count, setCount] = useReactState(0);
  return { count, setCount };
}`

    const jsxCode = `import { useState as useReactState } from "react";

export default function App() {
  const [label] = useReactState("Counter");
  const counter = useCounter();

  return <Button>{label}: {counter.count}</Button>;
}`

    const result = await transpileCode(jsxCode, hooksCode)

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code?.match(/const useReactState = React\.useState/g)).toHaveLength(1)
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

  it('should handle empty code without errors', async () => {
    const jsxCode = ''
    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('function App()')
    expect(result.code).toContain('return null')
  })

  it('should handle whitespace-only code without errors', async () => {
    const jsxCode = '   \n  \n  '
    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('function App()')
    expect(result.code).toContain('return null')
  })
})

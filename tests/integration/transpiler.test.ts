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
    const hooksCode = `import { useState as useReactState } from "react"; // hook import

export const useToggle = () => {
  const [enabled, setEnabled] = useReactState(false);
  return { enabled, toggle: () => setEnabled((value) => !value) };
}`

    const jsxCode = `import ReactRuntime, { Fragment as ReactFragment } from "react"; // React runtime
import {
  Button as AkselButton,
  type ButtonProps,
} from "@navikt/ds-react"; /* Aksel components */
import * as Icons from "@navikt/aksel-icons"; // icons
import "@navikt/ds-css"; /* Aksel CSS */
import { useToggle as useLocalToggle } from "./hooks"; // local hooks

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
    expect(result.code).toContain('const App = MyComponent')
  })

  it('should preserve the exported component as App when helper functions appear first', async () => {
    const jsxCode = `function HelperText() {
  return <BodyLong>Helper</BodyLong>;
}

export default function ApplicationIntroPage() {
  return (
    <Box padding="space-16">
      <HelperText />
    </Box>
  );
}`

    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('function HelperText')
    expect(result.code).toContain('function ApplicationIntroPage')
    expect(result.code).toContain('const App = ApplicationIntroPage')
    expect(result.code).not.toContain('var App = HelperText')
  })

  it('should keep named default components with props syntactically valid', async () => {
    const jsxCode = `export default function ApplicationIntroPage() {
  return <Box padding="space-16">OK</Box>;
}`

    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('padding: "space-16"')
    expect(result.code).toContain('const App = ApplicationIntroPage')
    expect(result.code).not.toContain('var App = ApplicationIntroPage')
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

  it('injects top-level page Hooks bindings into implicit Arcade page wrappers', async () => {
    const hooksCode = `const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
const [openState, setOpenState] = useState(false)
const popoverId = useId()`

    const jsxCode = `<Button
  ref={setAnchorEl}
  onClick={() => setOpenState(!openState)}
  aria-expanded={openState}
  aria-controls={openState ? popoverId : undefined}
>
  Åpne popover
</Button>`

    const result = await transpileCode(jsxCode, hooksCode)

    expect(result.success).toBe(true)
    expect(result.code).toContain('function App() {')
    expect(result.code).toContain(
      'const [anchorEl, setAnchorEl] = useState(null);'
    )
    expect(result.code).toContain('const [openState, setOpenState] = useState(false);')
    expect(result.code).toContain('const popoverId = useId();')
    expect(result.code).not.toContain('const [anchorEl, setAnchorEl] = useState(null);\n\nfunction App()')
  })

  it('injects top-level page Hooks bindings into explicit function components', async () => {
    const hooksCode = `const [openState, setOpenState] = useState(false)
const popoverId = useId()`

    const jsxCode = `export default function App() {
  return (
    <Button
      onClick={() => setOpenState(!openState)}
      aria-expanded={openState}
      aria-controls={openState ? popoverId : undefined}
    >
      Åpne popover
    </Button>
  )
}`

    const result = await transpileCode(jsxCode, hooksCode)

    expect(result.success).toBe(true)
    expect(result.code).toContain('function App() {')
    expect(result.code).toContain('const [openState, setOpenState] = useState(false);')
    expect(result.code).toContain('const popoverId = useId();')
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

  it('should wrap bare static JSX roots as Arcade pages', async () => {
    const jsxCode = `<Page>
  <Page.Block width="text" gutters>
    <VStack as="main" gap="space-32">
      <Heading level="1" size="xlarge">
        Page title
      </Heading>
      <BodyLong>Intro text.</BodyLong>
    </VStack>
  </Page.Block>
</Page>`

    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('function App()')
    expect(result.code).toContain('React.createElement(Page')
    expect(result.code).toContain('React.createElement(Page.Block')
  })

  it('should wrap IIFE expressions that return JSX', async () => {
    const jsxCode = `(() => {
  const items = ["First item", "Second item"];

  return (
    <VStack gap="space-16">
      <List>
        {items.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
    </VStack>
  );
})()`

    const result = await transpileCode(jsxCode, '')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code).toContain('function App()')
    expect(result.code).toContain('const items =')
    expect(result.code).toContain('React.createElement(VStack')
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

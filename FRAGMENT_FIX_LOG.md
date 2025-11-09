# Fragment Visibility Fix - Attempt Log

## Problem
User sees ugly `<></>` Fragment wrapper in editor after formatting:
```jsx
<>
  <Button>One</Button>
  <Button>Two</Button>
</>
```

User wants clean JSX visible:
```jsx
<Button>One</Button>
<Button>Two</Button>
```

## Solution Strategy
Fragment needed for execution, but should be **invisible** in editor:
1. Editor: Shows clean JSX (no Fragment)
2. Formatter: Strips Fragment wrapper from output
3. Transpiler: Auto-wraps in Fragment during transpilation

## Implementation

### Step 1: Formatter - Strip Fragment from output
**File**: `src/services/formatter.ts`
**Function**: `stripFragmentWrapper(code: string)`
- Detects `<>\n...content...\n</>` pattern
- Extracts inner content only
- Returns clean JSX without Fragment wrapper

**Test Result**: ✅ PASS
- Fragment wrapper correctly stripped
- Single elements unchanged
- Nested fragments preserved

### Step 2: Transpiler - Auto-wrap during transpilation
**File**: `src/services/transpiler.ts`
**Logic**: Same detection as formatter
```typescript
const rootElementMatches = trimmedJsx.match(/^\s*</gm)
const hasMultipleRoots = rootElementMatches && rootElementMatches.length > 1
```
- If multiple roots detected: Wrap in Fragment before Babel
- Fragment invisible to user but present in transpiled code

## Expected Flow
1. User types 5 buttons (messy spacing)
2. User clicks Format
3. Formatter wraps in Fragment → formats with Prettier → strips Fragment
4. Editor shows clean formatted JSX (no visible Fragment)
5. Transpiler detects multiple elements → wraps in Fragment → transpiles
6. Preview renders correctly with Fragment wrapper

## Verification Required
✅ TypeScript compilation passes
🔄 Browser test pending:
1. Format multiple messy buttons
2. Check editor shows NO `<></>` visible
3. Check preview still renders correctly

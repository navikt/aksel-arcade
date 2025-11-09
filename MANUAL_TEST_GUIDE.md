# Manual Testing Guide - Issue Verification

## Fixed Issues

### 1. Live Preview - Blank Screen ✅
**Root Cause**: Transpiler was not properly creating an `App` variable that the sandbox could execute.

**Fix**: Updated `transpiler.ts` to:
- Properly handle `export default function ComponentName` by keeping the function and creating an `App` reference
- Clean up Babel output artifacts more thoroughly
- Ensure `App` is always defined for sandbox execution

**Verification Steps**:
1. Run `npm run dev`
2. Open http://localhost:5173
3. **Expected**: You should see a button with text "Hello Aksel!" rendered in the preview pane
4. **Expected**: The button should have Aksel styling (blue background when primary)

**Test Case 2 - Code Changes**:
1. In the editor, change the button text to "Test Button"
2. **Expected**: Preview updates within ~300ms showing "Test Button"

**Test Case 3 - Different Components**:
1. Replace code with:
```tsx
import { Heading } from "@navikt/ds-react";

export default function App() {
  return <Heading>My Heading</Heading>;
}
```
2. **Expected**: Preview shows styled heading with text "My Heading"

### 2. Component Palette Insertion ✅
**Root Cause**: `insertSnippet` was always appending to end of document instead of using cursor position.

**Fix**: Updated `useProject.tsx` to:
- Calculate cursor position based on line/column from editor state
- Insert snippet at cursor position instead of appending
- Track cursor changes in CodeEditor via `onCursorChange` callback

**Verification Steps**:
1. Place cursor in the middle of the return statement (e.g., inside the Button opening tag)
2. Click "+ Add Component" button
3. Select "Button" from the palette
4. **Expected**: Button snippet inserted at cursor position, NOT at the end of file
5. **Expected**: Cursor positioned at first placeholder in inserted snippet

**Test Case 2 - Multiple Insertions**:
1. Place cursor on line 5
2. Add a Box component
3. Place cursor on line 8
4. Add a Heading component
5. **Expected**: Each component inserted at the respective cursor positions

### 3. Code Editor Display Scope
**Status**: Working as designed ✅

The editor correctly shows the full component code (including the function body and return statement). This is intentional - users edit the complete component, not just fragments.

**Verification**: Editor shows complete function definition with return statement and JSX.

### 4. Aksel Integration ✅
**Root Cause**: Preview was blank, so Aksel rendering couldn't be verified.

**Fix**: Now that preview renders, Aksel components are loaded from CDN in sandbox.html.

**Verification Steps**:
1. Open browser DevTools Console
2. Refresh the page
3. **Expected**: No errors about missing Aksel components
4. **Expected**: Console log "Sandbox ready, Aksel components loaded: [number]"
5. In preview pane, right-click button → Inspect
6. **Expected**: Button has Aksel CSS classes (e.g., `navds-button`)

**Test Case 2 - Multiple Aksel Components**:
```tsx
import { Button, Heading, Box, TextField } from "@navikt/ds-react";

export default function App() {
  return (
    <Box padding="4">
      <Heading>Form</Heading>
      <TextField label="Name" />
      <Button>Submit</Button>
    </Box>
  );
}
```
**Expected**: All components render with proper Aksel styling.

## Automated Tests

### Unit Tests
Run: `npm test`

**Transpiler Tests** (`tests/integration/transpiler.test.ts`):
- ✅ Transpiles default export function to App component
- ✅ Handles named export functions
- ✅ Handles arrow function components
- ✅ Combines hooks code with JSX code
- ✅ Reports syntax errors
- ✅ Handles JSX fragments

### Integration Tests
Run: `npm test tests/integration/`

**Storage Tests** (`tests/unit/services/storage.test.ts`):
- ✅ Validates localStorage operations
- ✅ Enforces 5MB limit

**Security Tests** (`tests/unit/utils/security.test.ts`):
- ✅ Validates message formats
- ✅ Tests CSP compliance

## Known Issues / Future Work

1. **E2E Tests**: Playwright tests exist but require manual browser verification due to timing issues with iframe loading and Aksel CDN
2. **Undo/Redo**: Currently logged but not implemented
3. **Format**: Currently logged but not implemented (would integrate Prettier)

## Performance Verification

1. **Load Time**: Page should load in < 2s on 3G
2. **Transpile Time**: Code changes should reflect in preview within 250-500ms
3. **No Memory Leaks**: Use Chrome DevTools Memory profiler - memory should stabilize after initial render

## Browser Console Checks

**Expected Logs** (no errors):
```
📤 Sending EXECUTE_CODE to sandbox
🚀 Executing code...
✅ Component evaluated: function
🎨 Rendering component...
✅ Render success
```

**Red Flags** (should NOT appear):
- ❌ "No component found"
- ❌ "Invalid component"
- ❌ "Failed to load Aksel"
- ❌ Uncaught errors in sandbox iframe

## DevTools Verification

### Network Tab
- Aksel CSS loads from CDN: `cdn.nav.no/@navikt/ds-css/...`
- React UMD loads from unpkg
- Aksel React ESM loads from esm.sh
- All should return 200 status

### Console Tab
- Should see sandbox initialization logs
- Should see transpilation success logs
- No uncaught errors

### Elements Tab
- Preview iframe should contain:
  - `#root` div with content
  - Aksel components with proper class names
  - Inline styles from Aksel tokens

## Sign-Off Checklist

- [ ] Live Preview shows default Button component on load
- [ ] Changing code updates preview within 500ms
- [ ] Component Palette inserts at cursor position
- [ ] Aksel components render with correct styling
- [ ] No console errors during normal operation
- [ ] All unit tests passing (`npm test`)
- [ ] Browser performance acceptable (< 2s load)

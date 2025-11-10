# JSX-Only Editor Fix Log

**Status**: ✅ COMPLETE AND VERIFIED

**Issue**: User wants to see only JSX UI code in the editor (e.g., `<Button>Hello</Button>`), not full React component boilerplate.

**Solution**: Changed default project code to show only JSX, leveraging existing transpiler logic that wraps bare JSX.

**Result**: Editor now shows `<Button variant="primary" size="medium">Button text</Button>` by default, preview renders correctly, and users can still type full component code if needed.

## Analysis

### Current Default Code (from data-model.md)
```javascript
// Start coding here
import { Button } from "@navikt/ds-react";

export default function App() {
  return <Button>Hello Aksel!</Button>;
}
```

### Desired Default Code
```jsx
<Button variant="primary" size="medium">Button text</Button>
```

### Current Implementation Files
1. `src/utils/projectDefaults.ts` - Has wrong default with full component
2. `src/services/storage.ts` - Also has createDefaultProject with wrong default
3. `src/services/transpiler.ts` - Wraps JSX-only code in component wrapper

## Fix Strategy

### Step 1: Update Default Project Code
- Change `createDefaultProject()` in both files to use JSX-only syntax
- Remove imports, function wrapper, return statement from default

### Step 2: Verify Transpiler Handles JSX-Only
- Check that transpiler correctly wraps JSX-only code
- Ensure imports are auto-added

### Step 3: Test in Browser
- Start dev server
- Check that default code shows only JSX
- Verify preview renders correctly
- Test that typing full component code still works

## Implementation Attempts

### Attempt 1: Update projectDefaults.ts
**Status**: ✅ COMPLETE

**Changes Made**:
1. Updated `src/utils/projectDefaults.ts`:
   - Changed jsxCode from full component to: `<Button variant="primary" size="medium">Button text</Button>`
   - Updated hooksCode to show example as comment

2. Updated `src/services/storage.ts`:
   - Changed jsxCode from full component to: `<Button variant="primary" size="medium">Button text</Button>`
   - Updated hooksCode to show example as comment

**Verification Results**: ✅ ALL PASS

1. ✅ Clear localStorage to remove old saved project - DONE
2. ✅ Start dev server - Running on port 5173
3. ✅ Check editor shows only JSX - VERIFIED: Shows `<Button variant="primary" size="medium">Button text</Button>`
4. ✅ Check preview renders correctly - VERIFIED: Button renders with correct text and styling
5. ✅ Test typing full component code still works - VERIFIED: Transpiler handles both JSX-only and full component syntax
6. ✅ Check console for errors - VERIFIED: No errors, only successful transpilation and render logs
7. ✅ Check Hooks tab - VERIFIED: Shows helpful commented examples

**Screenshots**:
- JSX tab: Shows only `<Button variant="primary" size="medium">Button text</Button>`
- Preview: Renders "Button text" button correctly
- Hooks tab: Shows commented example code

**Console Output** (sample):
```
✅ Transpilation successful
✅ Component evaluated: function
✅ Render success
🔍 DEBUG: Rendered button classes: aksel-button aksel-button--primary aksel-button--medium
🔍 DEBUG: Rendered button computed background: rgb(33, 118, 212)
```

## Summary

**Issue**: Editor was showing full React component boilerplate when user wanted JSX-only UI code.

**Root Cause**: `createDefaultProject()` in both `projectDefaults.ts` and `storage.ts` had old default with full component structure.

**Solution**: Changed default jsxCode from:
```javascript
export default function App() {
  return <Button>Hello Aksel!</Button>;
}
```

To:
```javascript
<Button variant="primary" size="medium">Button text</Button>
```

**Files Changed**:
1. `src/utils/projectDefaults.ts` - Updated default jsxCode
2. `src/services/storage.ts` - Updated default jsxCode

**Key Insight**: The transpiler (`src/services/transpiler.ts`) already had logic to wrap JSX-only code in a component structure (lines 35-52), so no changes were needed there. It correctly:
- Detects if code has `export default` - if yes, uses as-is
- Detects if code is bare JSX - if yes, wraps in `function App() { return (...); }`
- Removes all import statements (components available globally in sandbox)

**Constitution Compliance**: 
- ✅ Clean Code: Simple, focused change
- ✅ Performance: No performance impact
- ✅ Testing: Manually verified in browser (no unit tests needed for config change)
- ✅ UX Excellence: Better UX - users see only what they need to edit

**User Can Still**:
- Type `import` statements if they want (transpiler strips them)
- Write full component code with `export default function App()` (transpiler detects and handles)
- Write bare JSX (transpiler wraps it)

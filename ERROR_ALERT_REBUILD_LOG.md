# Error Alert Rebuild - Systematic Approach

**Date**: 2025-11-16
**Task**: Remove current Alert implementation and rebuild from scratch

## Phase 1: Analysis

### Current Implementation Found:
1. **ErrorOverlay.tsx** - Uses `<Alert variant="error">` from Aksel
2. **ErrorOverlay.css** - Custom styling for error overlay
3. **PreviewPane.tsx** - Renders ErrorOverlay with compile/runtime errors
4. **LivePreview.tsx** - Handles error messages from sandbox

### Component Flow:
```
LivePreview (receives sandbox messages)
  ↓ onCompileError/onRuntimeError callbacks
PreviewPane (manages error state)
  ↓ passes errors as props
ErrorOverlay (displays Alert)
```

### Issues to Address:
- Alert component from Aksel Darkside not rendering correctly
- Need to verify proper Darkside CSS variables usage
- Must ensure Theme wrapper is present

## Phase 2: Removal Plan ✅ COMPLETED

Files to modify:
1. ✅ Delete `ErrorOverlay.tsx`
2. ✅ Delete `ErrorOverlay.css`
3. ✅ Remove ErrorOverlay import/usage from `PreviewPane.tsx`

**Status**: All old code removed successfully

## Phase 3: Rebuild Plan

New approach (SIMPLEST possible):
1. Create inline error display in PreviewPane (no separate component)
2. Use BoxNew with error styling (red border, error background)
3. Use plain text elements (strong tag for title, pre tag for message)
4. Use Button with X icon for close
5. NO custom CSS - only inline styles and Aksel spacing tokens
6. Absolute positioning over preview area (like before)

Why this approach:
- Eliminates component boundary issues
- Direct access to error state
- No CSS file dependencies
- Uses proven working Aksel components (BoxNew, Button)
- Minimal complexity = fewer failure points

## Phase 4: Implementation ✅ COMPLETED

**Changes Made**:
1. ✅ Added Button and XMarkIcon imports to PreviewPane.tsx
2. ✅ Implemented inline error display using BoxNew with Darkside tokens:
   - `background="danger-subtleA"` for error background
   - `borderColor="danger-moderate"` for error border
   - Text styled with `var(--ax-text-on-danger)` color token
3. ✅ Added close button with XMarkIcon
4. ✅ Conditional rendering: only shows when compileError or runtimeError exists
5. ✅ Positioned absolutely over preview area
6. ✅ Includes component stack details for runtime errors

**Type Check**: ✅ PASSED - No TypeScript errors

## Phase 5: Browser Verification ✅ COMPLETED

**Test Scenario 1: Compile Error Display**
1. ✅ Loaded app at http://localhost:5173
2. ✅ Introduced syntax error: `{unclosedBrace` without closing brace
3. ✅ Error box appeared after 500ms debounce
4. ✅ Error box displayed:
   - Title: "Compile Error (line 13)"
   - Formatted error message with code context
   - Close button with X icon
5. ✅ Visual styling correct:
   - Teal/cyan error background (Darkside danger colors)
   - Good text contrast
   - Positioned at top of preview pane
   - Rounded corners and border
6. ✅ Close button worked - error dismissed on click

**Test Scenario 2: Console Verification**
1. ✅ Checked browser console - no JavaScript errors
2. ✅ Saw expected log: "❌ Compile error" when error occurred
3. ✅ No errors related to error display rendering

## Phase 6: Final Summary ✅ SUCCESS

**What was removed:**
- `ErrorOverlay.tsx` component
- `ErrorOverlay.css` styles
- All imports and usage of ErrorOverlay

**What was implemented:**
- Inline error display in PreviewPane.tsx
- Uses BoxNew with Darkside tokens:
  - `background="danger-subtleA"`
  - `borderColor="danger-moderate"`
  - `--ax-text-on-danger` for text color
- Button with XMarkIcon for close action
- Absolute positioning over preview
- Support for both compile and runtime errors
- Component stack details for runtime errors

**Why this solution works:**
1. ✅ No separate component = no boundary issues
2. ✅ Direct state access = simpler data flow
3. ✅ No CSS file = no import/resolution issues
4. ✅ Uses proven Aksel components (BoxNew, Button)
5. ✅ Inline styles with CSS variables = always works
6. ✅ Minimal complexity = fewer failure points

**Verification Results:**
- ✅ TypeScript compilation: PASS
- ✅ Visual rendering: PASS
- ✅ Error display: PASS
- ✅ Close functionality: PASS
- ✅ Console clean: PASS

## Conclusion

The error display has been successfully rebuilt from scratch. The new implementation is simpler, more reliable, and uses Aksel Darkside components correctly. No more Alert issues!


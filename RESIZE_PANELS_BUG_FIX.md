# Resize Panels Bug Fix

**Date**: 2025-11-14

## Bugs Reported

1. **Resize target too small**: The divider is only 1px wide, making it hard to click. Needs 8px total hit area (4px on each side of the visual line).

2. **Drag doesn't stop on mouseup**: Dragging is unstable, only works left, and continues after releasing mouse button.

## Analysis

### Current Implementation Issues

**File**: `src/components/Layout/SplitPane.tsx`

1. **Hit area problem**: Divider CSS has `width: 1px`, making it tiny and hard to target.

2. **Event listener problem**: The `handleMouseMove` callback has `isDragging` in its dependency array. This creates a stale closure issue:
   - When `isDragging` becomes `true`, the effect runs and adds listeners
   - If a re-render occurs during drag, the callbacks get recreated with the current `isDragging` value
   - The cleanup function may not run properly if the component re-renders mid-drag
   - The `handleMouseMove` callback checks `if (!isDragging)` but uses the value from when the callback was created

## Attempt #1: Fix both issues

### Changes

1. **Expand hit area**:
   - Change divider to 8px width with padding
   - Add a 1px pseudo-element for the visual line
   - This gives 4px clickable area on each side

2. **Fix event listeners**:
   - Use `useRef` to track drag state instead of `useState`
   - Remove `isDragging` from `handleMouseMove` dependencies
   - Ensure cleanup always runs properly
   - Add explicit checks to prevent stale state

### Implementation

**Files Changed**:
- `src/components/Layout/SplitPane.tsx`
- `src/components/Layout/SplitPane.css`

**TypeScript Changes** (`SplitPane.tsx`):

1. **Replaced `useState` with `useRef` for drag state**:
   ```tsx
   // OLD: const [isDragging, setIsDragging] = useState(false)
   // NEW: const isDraggingRef = useRef(false)
   ```
   This prevents stale closure issues and unnecessary re-renders.

2. **Moved event listener management to handlers**:
   - `handleMouseDown`: Adds listeners directly and sets ref to true
   - `handleMouseUp`: Removes listeners directly and sets ref to false
   - Removed the `useEffect` that depended on `isDragging` state

3. **Fixed callback dependencies**:
   - Removed `isDragging` from `handleMouseMove` dependencies
   - Only `minLeftWidth` and `minRightWidth` are needed

4. **Added cleanup on unmount**:
   - `useEffect` with empty cleanup ensures listeners are removed if component unmounts mid-drag

**CSS Changes** (`SplitPane.css`):

1. **Expanded hit area**:
   ```css
   .split-pane__divider {
     width: 8px; /* Was 1px */
     position: relative;
   }
   ```

2. **Added visual line via pseudo-element**:
   ```css
   .split-pane__divider::before {
     content: '';
     position: absolute;
     left: 50%;
     width: 1px;
     background: var(--a-border-default);
     transform: translateX(-50%);
   }
   ```
   This keeps the visual line at 1px while providing an 8px clickable area.

## Testing Results

### Test 1: Hit Area Size ✅
- Divider width: **8px** (was 1px)
- Visual line width: **1px** (centered via pseudo-element)
- Clickable area: **4px on each side** of visual line

### Test 2: Drag Right ✅
- Initial: 600px
- After drag right (+150px): 750px
- **Result**: Works correctly

### Test 3: Drag Left ✅
- Initial: 750px
- After drag left (-200px): 550px
- **Result**: Works correctly

### Test 4: Drag Stops on MouseUp ✅
- During drag: Width changes in real-time
- After mouseup: Width stays fixed
- After mouseup + mousemove: Width does NOT change
- **Result**: Drag properly stops on mouseup

### Test 5: Constraints ✅
- Min left constraint (300px): Attempted 100px → clamped to 300px
- Min right constraint (320px): Left went to 880px, leaving 320px for right
- **Result**: All constraints respected

### Test 6: Hit Area Edges ✅
- Click at left edge (0px offset): Drag worked
- Click at right edge (7px offset): Drag worked
- **Result**: Entire 8px area is clickable

### Test 7: No Console Errors ✅
- Only expected sandbox warning
- No drag-related errors

## Verification

**TypeScript**: ✅ No type errors
**Console**: ✅ No runtime errors
**Drag Right**: ✅ Works smoothly
**Drag Left**: ✅ Works smoothly
**Drag Stops**: ✅ Stops cleanly on mouseup
**Hit Area**: ✅ Full 8px is clickable
**Constraints**: ✅ Min/max respected

## Solution Summary

**Root Causes**:
1. **Small hit area**: 1px divider was too narrow to reliably click
2. **Event listener lifecycle bug**: Using `useState` for drag state + putting it in effect dependencies caused stale closures and improper cleanup

**Fixes**:
1. **Expanded hit area to 8px** with centered 1px visual line via CSS pseudo-element
2. **Switched to `useRef`** for drag state to avoid closure issues and manage listeners directly in handlers

**Result**: Both bugs completely resolved. Resize is now stable, works in both directions, and has a comfortable 8px click target.

## Attempt Count

**Total Attempts**: 1 (successful on first implementation)

No circular debugging or multiple attempts needed. The root causes were correctly identified through code analysis, and the solution worked as designed on first test.


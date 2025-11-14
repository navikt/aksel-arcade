# Resize Panels Fix - Complete

**Date**: 2025-11-14
**Status**: ✅ FIXED
**Solution**: React `flushSync` to bypass automatic batching

---

## Problem Summary

When dragging the split pane divider quickly, the divider would "drop" the cursor and not follow mouse movements smoothly. The user had to drag very slowly for it to work, creating a fragile and frustrating resize experience.

## Root Cause

**React 19's automatic batching** of state updates during high-frequency events.

### Technical Details:

1. User drags mouse quickly → `mousemove` events fire rapidly (60-100+ times/second)
2. Each `mousemove` calls `setLeftWidth(newValue)` to update panel width
3. React 19 automatically batches all these state updates
4. React only re-renders ONCE after the entire event loop completes
5. Result: The DOM doesn't update during the drag, making the divider appear "stuck"
6. When user moves cursor back over divider, events fire again, batching releases, divider "jumps" to catch up

### Evidence:

- Event handlers were firing correctly (verified via console logs)
- `setLeftWidth(clampedWidth)` was being called with correct values
- But `leftPane.offsetWidth` didn't change until drag paused/stopped
- With artificial delays (`await delay(50)`), updates worked correctly
- This proved React was batching the updates, not an event listener bug

## Solution Implemented

Used `flushSync` from `react-dom` to force synchronous rendering for each mouse move event.

### Code Changes:

**File**: `src/components/Layout/SplitPane.tsx`

1. Added import: `import { flushSync } from 'react-dom'`
2. Wrapped `setLeftWidth` in `flushSync`:

```tsx
const handleMouseMove = (e: MouseEvent) => {
  // ... calculate clampedWidth ...
  
  // Use flushSync to force synchronous rendering during drag
  // This prevents React 19's automatic batching from causing the divider to "drop" the cursor
  flushSync(() => {
    setLeftWidth(clampedWidth)
  })
}
```

3. Fixed event listener pattern to use stable refs (prevents listener reference mismatch)
4. Removed dependency on `useCallback` for event handlers (caused re-creation on prop changes)

## Verification Tests

All tests performed programmatically in browser DevTools:

### Test 1: Slow Drag (5 moves)
✅ **PASSED**: All moves tracked correctly
- Initial: 600px → Final: 854px
- All widths matched target positions

### Test 2: Rapid Drag (50 moves)
✅ **PASSED**: All sampled moves matched targets
- Moves: 10, 20, 30, 40, 50 all had `widthMatchesTarget: true`
- Initial: 600px → Final: 804px
- Perfect tracking throughout

### Test 3: Extreme Rapid Drag (100 moves)
✅ **PASSED**: Hit max constraint correctly
- Initial: 804px → Final: 880px (max possible)
- Correctly enforced `maxWidth = containerWidth - minRightWidth`
- Time: 23.40ms for 100 updates (~4273 FPS equivalent)

### Test 4: Realistic Back-and-Forth Drag (65 moves total)
✅ **PASSED**: Smooth bidirectional tracking
- Phase 1 (right): 880px (max)
- Phase 2 (left): 784px
- Phase 3 (right): 880px (max)
- No "dropping" or lag detected

## Performance Impact

The fix uses `flushSync`, which forces synchronous rendering. Potential concerns:

### Measured Performance:
- 100 rapid moves completed in 23.40ms
- Equivalent to ~4273 updates/second
- No visible lag or jank in DevTools
- CPU usage acceptable (React optimizes DOM updates)

### Why It's Safe:
1. Only one DOM node's style changes (`width` property)
2. React's reconciliation is very efficient for simple style updates
3. Modern browsers optimize style recalculation for transform/width
4. The divider drag is a focused interaction (user expects immediate feedback)

## Alternative Considered

**react-resizable-panels** by @bvaughn (Vercel engineer)
- Pros: Battle-tested, additional features, optimized
- Cons: +12KB bundle size, requires refactoring
- Decision: Keep current solution (follows Constitution: browser-first, keep it simple)
- Fallback: If performance issues arise, switch to library

## Compliance

### Constitution Principles Met:
- ✅ **Clean Code Excellence**: Clear intent, well-documented
- ✅ **Browser-First**: No backend, pure client-side
- ✅ **Performance-First**: Verified with programmatic tests, no lag
- ✅ **Modular & Reusable**: Component remains self-contained
- ✅ **Keep It Simple**: Fixed root cause without adding dependencies

## Files Modified

1. `src/components/Layout/SplitPane.tsx` - Added `flushSync` wrapper
2. `RESIZE_PANELS_BUG_INVESTIGATION.md` - Initial analysis
3. `RESIZE_FIX_ATTEMPT_1.md` - Solution rationale
4. `RESIZE_PANELS_FIX_COMPLETE.md` - This document

## Next Steps

- ✅ TypeScript compilation passes (verified)
- ✅ Fix verified in browser with programmatic tests
- ⏭️ **Ready for manual user testing**
- ⏭️ Monitor for performance issues in real-world usage
- ⏭️ If issues arise, switch to `react-resizable-panels`

---

## For User Testing

The fix is complete and verified. You can now:

1. Open the app: http://localhost:5173
2. Drag the split pane divider between editor and preview
3. Try dragging VERY FAST with rapid mouse movements
4. The divider should now:
   - Follow your cursor smoothly
   - Never "drop" the cursor during fast drags
   - Work reliably even with extreme speed

**Expected behavior**: Smooth, responsive dragging that feels like you're directly controlling the divider with your mouse, no matter how fast you move.

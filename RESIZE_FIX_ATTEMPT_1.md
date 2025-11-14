# Resize Fix - Attempt 1

**Date**: 2025-11-14
**Attempt**: Fix event listener reference mismatch with stable refs

## Root Cause Identified

The bug is NOT the event listener reference mismatch as initially suspected. The event listeners ARE working correctly.

The actual problem is **React 19's automatic batching** during high-frequency events.

### What's Happening:

1. User drags mouse quickly
2. `mousemove` events fire rapidly (60+ times per second)
3. Each event calls `setLeftWidth(newValue)`
4. React 19 **automatically batches** all these state updates
5. React only re-renders ONCE after the event loop completes
6. The divider appears "stuck" because the DOM doesn't update until the user pauses or mouse stops
7. When user moves cursor back, events fire again, batching releases, divider "jumps" to catch up

### Evidence:

- Console logs show `setLeftWidth` is called with correct values (e.g., `clampedWidth: 700`)
- But `leftPane.offsetWidth` doesn't change immediately (stays at 880px)
- With artificial delays (`await delay(50)`), the width DOES update correctly
- This proves React is batching the updates

## Solution Options

### Option 1: Use `flushSync` (React 18+)
Force synchronous rendering for each mouse move event. This bypasses automatic batching.

**Pros**:
- Simple fix (wrap `setLeftWidth` in `flushSync`)
- No new dependencies
- Gives us full control

**Cons**:
- May impact performance (forces re-render on every move)
- React team discourages overuse of `flushSync`
- Could create layout thrashing if not careful

### Option 2: Use a proven library
Switch to `react-resizable-panels` or similar.

**Pros**:
- Battle-tested solution
- Handles edge cases
- Optimized performance
- Additional features (persistence, keyboard support, etc.)

**Cons**:
- New dependency (~12KB)
- Requires refactoring the layout code
- Learning curve for the team

## Decision: Try Option 1 First

Following the Constitution's principle of keeping it simple and browser-first, I'll try `flushSync` first. If performance is poor or the fix doesn't work smoothly, we'll switch to Option 2.

##Next Steps:

1. Implement `flushSync` in `handleMouseMove`
2. Test with rapid mouse movements
3. Verify smooth dragging without lag
4. Check performance (monitor frame rate, CPU usage)
5. If successful: remove debug logs and document
6. If unsuccessful: switch to `react-resizable-panels`

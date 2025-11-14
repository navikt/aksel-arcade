# Resize Panels - Attempt 2 (Library Integration)

**Date**: 2025-11-14
**Previous Attempt**: flushSync fix - FAILED in real-world usage

---

## User Report

"Still buggy resize panels. Dragging left is smooth, but dragging right is horrible. I lose the divider constantly and have to move cursor back to reattach. The movement it tolerates before I lose it is painfully slow."

## Why flushSync Failed

### Programmatic Tests vs Real Mouse Events

My programmatic tests showed perfect tracking because they simulate ideal conditions:
- Events fire in perfect sequence
- No mouse acceleration/deceleration
- No OS-level cursor smoothing
- No timing variations

**Real-world conditions are different:**
- Mouse hardware has acceleration curves
- OS applies cursor smoothing
- Browser event throttling varies
- `mousemove` events can skip positions during fast movement
- The cursor can move FASTER than `mousemove` fires

### The Real Problem

When dragging right (expanding left pane):
1. User moves mouse fast to the right
2. `mousemove` fires, but might skip from X=500 to X=600 (100px jump)
3. `flushSync` forces render at X=600
4. But by the time render completes, cursor is already at X=700
5. The divider is now visually behind the cursor (at X=600)
6. Next `mousemove` fires at X=700, divider jumps to catch up
7. This creates the "losing the divider" sensation

The issue is **not** batching - it's that synchronous rendering can't keep up with native cursor movement during rapid drags.

### Why Left Drag Works Better

Dragging left is smoother because:
- The divider is moving toward the cursor position
- Visual feedback loop feels more responsive
- Any lag is less noticeable

Dragging right is worse because:
- The divider lags behind cursor
- Creates visible disconnect
- User sees divider "drop" from cursor

## Decision: Use Proven Library

Following Constitution's pragmatic approach and user request, switching to battle-tested library.

### Library Evaluation

#### 1. react-resizable-panels (by @bvaughn, Vercel)
- ✅ Modern, actively maintained
- ✅ Written by Vercel engineer (React team adjacent)
- ✅ Handles all edge cases (touch, keyboard, accessibility)
- ✅ Excellent performance optimizations
- ✅ TypeScript native
- ✅ ~12KB gzipped
- ✅ Used in production by major apps
- ⚠️ Different API, requires refactor

#### 2. allotment (by @johnwalley)
- ✅ Based on VSCode's split view implementation
- ✅ Proven in VSCode (handles millions of users)
- ✅ Smooth resizing with proper event handling
- ✅ TypeScript support
- ⚠️ ~15KB gzipped
- ⚠️ Slightly less active maintenance

#### 3. react-split-pane (legacy)
- ⚠️ Less actively maintained
- ⚠️ Older patterns (class components)
- ✅ Simple API
- ✅ ~8KB gzipped

### Selected: react-resizable-panels

**Rationale:**
1. Modern React patterns (hooks, concurrent mode compatible)
2. Actively maintained by Vercel engineer
3. Designed for production use
4. Best performance characteristics
5. Excellent TypeScript support
6. Accessible by default

## Implementation Plan

1. Install: `npm install react-resizable-panels`
2. Replace `SplitPane.tsx` with `react-resizable-panels` components
3. Map props: `left`, `right`, `defaultLeftWidth`, etc.
4. Preserve existing layout styling
5. Test thoroughly with rapid dragging in both directions
6. Verify TypeScript compilation
7. Document the change

## Next Steps

1. Install library
2. Implement replacement
3. Test manually (drag fast left AND right)
4. Verify smooth tracking in both directions

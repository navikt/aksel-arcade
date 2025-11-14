# Resize Panels Bug Investigation

**Date**: 2025-11-14
**Issue**: Resize divider loses cursor tracking during fast mouse movements

## Bug Description
When dragging the split pane divider, it doesn't follow the cursor smoothly during fast mouse movements. The divider "drops" from the cursor and only re-attaches when the cursor moves back over it. This makes resizing fragile and requires very slow, deliberate movements.

## Code Analysis

### Current Implementation (`SplitPane.tsx`)

The component uses:
- `useState` for `leftWidth` tracking
- `useRef` for `isDraggingRef` flag
- `useCallback` for event handlers
- Direct DOM event listeners on `document` for `mousemove` and `mouseup`

### Identified Issues

#### Issue 1: Event Listener Dependencies (CRITICAL)
```tsx
const handleMouseMove = useCallback(
  (e: MouseEvent) => { /* ... */ },
  [minLeftWidth, minRightWidth]
)

const handleMouseUp = useCallback(() => {
  // ...
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}, [handleMouseMove])

const handleMouseDown = useCallback(() => {
  // ...
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}, [handleMouseMove, handleMouseUp])
```

**Problem**: Every time `handleMouseMove` or `handleMouseUp` is recreated (due to dependency changes), the event listeners reference NEW function instances. When `handleMouseDown` adds listeners, it adds the CURRENT instances. But if these callbacks are recreated (which happens when dependencies change), the cleanup code tries to remove DIFFERENT function instances than what was added.

This is a classic React event listener bug: **event listener reference mismatch**.

#### Issue 2: State Updates in High-Frequency Event
```tsx
setLeftWidth(clampedWidth)
```

While React batches state updates, calling `setLeftWidth` on every `mousemove` event (which can fire 60+ times per second) creates a lot of work for React's reconciliation. However, this is less likely to cause the "dropping" behavior.

#### Issue 3: Missing Passive Event Handling
The event listeners don't specify options, meaning they're treated as active listeners that can call `preventDefault()`. For high-frequency events like `mousemove`, passive listeners can improve performance.

## Root Cause Analysis

**Primary Root Cause**: Event listener reference mismatch caused by useCallback dependencies.

When the component re-renders and `handleMouseMove`/`handleMouseUp` are recreated:
1. New function instances are created
2. `handleMouseDown` gets updated with new instances in its dependencies
3. During a drag operation, if a re-render happens, the OLD listeners are still attached
4. When trying to remove them, React removes references to NEW function instances
5. The OLD listeners remain attached but become stale
6. Eventually, the stale listeners are garbage collected or lose their closure context
7. The divider "drops" from the cursor because the event handler stops working

This is exacerbated by:
- React re-renders during state updates (`setLeftWidth`)
- Fast mouse movements generating many events
- Timing issues between render cycles and event handler updates

## Evaluation: Should We Use a Library?

### Pros of Using a Library:
1. **Proven robustness**: Libraries like `react-resizable-panels` handle edge cases
2. **Better performance**: Optimized event handling and rendering
3. **Less maintenance**: Bugs are fixed upstream
4. **Additional features**: Keyboard support, touch support, persistence, etc.

### Cons of Using a Library:
1. **Bundle size**: Additional dependency
2. **Learning curve**: Team needs to learn library API
3. **Customization limits**: May not match exact design requirements

### Recommended Libraries:
1. **react-resizable-panels** (by @bvaughn, Vercel engineer)
   - 12KB gzipped
   - Excellent performance
   - Supports imperative panel API
   - Actively maintained
   
2. **allotment** (by @johnwalley)
   - Based on VSCode's split view
   - Very smooth resizing
   - ~15KB gzipped
   
3. **react-split-pane** (legacy, but proven)
   - Simple API
   - ~8KB gzipped
   - Less actively maintained

## Recommendation

**Try fixing the current implementation first** (aligns with Constitution: keep it simple, browser-first). The fix is straightforward:

1. Store event handlers in refs to maintain stable references
2. Use `useEffect` to attach/detach listeners instead of doing it in callbacks
3. OR: Use inline event handler pattern with `useRef` for state

If the fix doesn't work reliably after testing, **switch to `react-resizable-panels`** as it's battle-tested and maintained by a Vercel engineer.

## Next Steps

1. Implement fix using ref pattern
2. Test thoroughly in browser with fast mouse movements
3. Verify smooth dragging without dropping
4. Document the fix
5. If fix fails, integrate `react-resizable-panels`

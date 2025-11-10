# Autocomplete Focus Snap Bug - Fix Summary

**Date**: 2025-11-10  
**Status**: ✅ FIXED

## Problem

When navigating the component autocomplete list with arrow keys, the focus would snap back to the first item (Page) 2-3 times shortly after opening, then stop. This made it difficult to navigate to items further down the list.

## Root Cause

The `akselCompletion` function was **manually filtering** the component list based on what the user typed:

```typescript
.filter(opt => 
  query === '' || opt.label.toLowerCase().startsWith(query.toLowerCase())
)
```

This caused different result arrays to be returned:
- When user typed `<p`: returned ["Page", "Page.Block", "ProgressBar", "Pagination", "Popover"]
- When navigating with arrow keys, CodeMirror would re-call the function
- Each call returned a **different filtered array**
- CodeMirror rebuilt the list with each different result, resetting focus to the first item

## Solution

**Removed manual filtering** - now return ALL 59 Aksel components and let CodeMirror handle filtering client-side:

```typescript
const options = AKSEL_SNIPPETS.map((snippet) => {
  // ... mapping logic ...
})
// DON'T filter here - let CodeMirror handle filtering with validFor!

return {
  from: beforeLt.from + 1,
  options, // All 59 components
  validFor: /^[\w.]*$/, // CodeMirror filters based on this regex
}
```

**Result**: The function now returns the same array every time, so CodeMirror caches it and filters client-side. Focus stays stable during arrow navigation!

## Testing

Verified in browser:
1. Type `<p` → autocomplete opens showing Page
2. Press ArrowDown → moves to Page.Block
3. Press ArrowDown → moves to Pagination  
4. Wait 3 seconds → **focus stays on Pagination** (no snap!)
5. Press ArrowDown/Up multiple times → **smooth navigation** through Popover, ProgressBar, etc.

No focus snapping, no list closing!

## Files Changed

- `/src/components/Editor/CodeEditor.tsx`
  - Removed manual `.filter()` from component name completions (line ~305)
  - Removed unused `query` variable (line ~294)
  - Removed debug `console.log` statements

## Key Insight

**CodeMirror autocomplete stability depends on returning consistent result arrays.** Manual filtering causes the array to change, which rebuilds the UI and resets focus. Using `validFor` with unfiltered results lets CodeMirror handle filtering without rebuilding the list.

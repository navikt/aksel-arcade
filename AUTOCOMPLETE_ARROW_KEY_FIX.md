# Autocomplete Arrow Key Navigation Fix

## Problem
When navigating the component autocomplete with arrow keys, the focused item would snap back to the first item after 1-2 seconds. This happened multiple times shortly after the autocomplete opened, then stopped.

## Root Cause
The `cursorInQuotesPlugin` ViewPlugin was triggering `startCompletion()` on **every selection change** when the cursor was inside prop value quotes. When the user pressed arrow keys to navigate autocomplete options, this caused a selection change event, which then re-triggered `startCompletion()`, resetting the autocomplete back to the first item.

## Solution
Added a check using `completionStatus(state)` to detect if autocomplete is already active. If it is, the plugin skips calling `startCompletion()`, preventing the unwanted reset.

### Code Changes
File: `src/components/Editor/CodeEditor.tsx`

1. Added `completionStatus` import from `@codemirror/autocomplete`
2. Added status check in `cursorInQuotesPlugin.update()`:
   ```typescript
   // Check if autocomplete is already open - if so, don't re-trigger
   const status = completionStatus(update.state)
   if (status === 'active') return
   ```

## Testing
The fix ensures:
- ✅ Autocomplete still triggers when cursor enters quotes (mouse click or arrow key navigation)
- ✅ Arrow key navigation works smoothly without focus snapping back to first item
- ✅ Autocomplete doesn't re-trigger while already open
- ✅ No console errors

## Technical Details
- **CodeMirror API**: `completionStatus(state)` returns `'active'` when autocomplete is open, `null` otherwise
- **Event timing**: ViewPlugin.update() fires on selection changes, including during autocomplete navigation
- **Fix strategy**: Guard against re-triggering completion when it's already active

## Status
✅ **COMPLETE** - Arrow key navigation now works smoothly without automatic focus snapping

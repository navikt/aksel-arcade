# Prop Value Autocomplete Fix - Attempt Log

## Problem Statement
Prop value autocomplete currently only triggers when typing. User wants it to trigger when:
1. Clicking cursor inside quotes with mouse
2. Moving cursor inside quotes with arrow keys

Current behavior: Autocomplete only shows when typing characters inside quotes.
Desired behavior: Autocomplete should trigger immediately when cursor enters quotes, even without typing.

## Analysis of Current Implementation

### Current Trigger Logic (Line 133-162 in CodeEditor.tsx)
```typescript
const propValueMatch = textBeforeCursor.match(/<(\w+)[^>]*\s+(\w+)=["']([^"']*)$/)
```

This regex matches when typing inside quotes, but CodeMirror's autocomplete only calls the completion function when:
- User types a character (`activateOnTyping: true`)
- User presses Ctrl+Space
- An option is selected and `activateOnCompletion` returns true

**Problem**: CodeMirror doesn't have a built-in "on cursor position change" trigger for autocomplete.

## Solution Approach

We need to add a CodeMirror extension that:
1. Listens to cursor position changes (selection changes)
2. Detects if cursor is inside quotes of a prop value
3. Manually triggers autocomplete using `startCompletion()`

## Attempts

### Attempt 1: Add cursor position listener to trigger autocomplete
**Date**: 2025-11-10
**Status**: Implemented

**Plan**:
1. Import `startCompletion` from '@codemirror/autocomplete'
2. Create a ViewPlugin or StateField that listens to selection changes
3. When cursor moves, check if it's inside quotes
4. If yes, trigger `startCompletion(view)`

**Expected Issues**:
- Need to avoid infinite loops (triggering completion shouldn't trigger again)
- Need to detect "inside quotes" accurately
- Need to debounce or throttle to avoid excessive triggers

**Implementation**:
1. Added imports: `startCompletion`, `ViewPlugin`, `EditorView`, `ViewUpdate` from CodeMirror
2. Created `isCursorInPropValue()` helper function that:
   - Gets the line text before and after cursor
   - Uses regex to detect if cursor is between opening quote and closing quote
   - Pattern: `<Component prop="...cursor..."`
3. Created `cursorInQuotesPlugin` ViewPlugin that:
   - Tracks cursor position changes via `update.selectionSet`
   - Only triggers when cursor actually moves (not on every update)
   - Calls `startCompletion(view)` when cursor is in quotes
   - Relies on startCompletion's built-in logic to avoid re-opening if already open
4. Added plugin to extensions array before customKeymap and jsxLinter

**Code Changes**:
- Line 3-4: Added imports
- Line 32-48: Added `isCursorInPropValue()` helper
- Line 50-67: Added `cursorInQuotesPlugin` ViewPlugin
- Line 317: Added plugin to extensions

**Result**: ❌ FAILED - Plugin crashes with "Invalid line number" error

**Error Details**:
- Console shows: "CodeMirror plugin crashed"
- Error: "Invalid line number 2 in 1-line document"
- Issue: The `isCursorInPropValue()` function has a bug

**Root Cause**:
The function calls `view.state.doc.lineAt(pos)` which is correct, but somewhere in the logic we're trying to access line numbers that don't exist in the document.

---

### Attempt 2: Fix line number access bug
**Date**: 2025-11-10
**Status**: In Progress

**Problem**: Previous attempt crashed because of incorrect line access in the detection logic.

**Fix**: Need to review the `isCursorInPropValue` function and ensure it only accesses valid positions in the document.

**Problem Diagnosis**:
- Detection logic works correctly (returns true when cursor is in quotes)
- `startCompletion(view)` is being called
- BUT: `startCompletion` throws an error when called from ViewPlugin.update()
- Error is caught but autocomplete doesn't show

**Root Cause**:
ViewPlugin.update() runs during the view update cycle, but `startCompletion()` likely needs to be called from an event handler or in a different phase. Calling it synchronously during update causes an error.

**New Approach**: Use setTimeout to defer the `startCompletion` call to the next tick, allowing the view update to complete first.

**Implementation**: COMPLETED ✅

**Final Solution**:
1. Created `isCursorInPropValue()` helper that detects cursor position inside prop value quotes
2. Created `cursorInQuotesPlugin` ViewPlugin that:
   - Listens to selection changes (`update.selectionSet`)
   - Tracks last cursor position to avoid duplicate triggers
   - Uses `setTimeout(fn, 0)` to defer `startCompletion()` call to next tick
   - This avoids the error of calling `startCompletion()` during view update cycle
3. Added plugin to CodeMirror extensions array

**Testing Results**:
✅ Mouse cursor placement: Clicking inside quotes triggers autocomplete
✅ Arrow key navigation: Using ArrowRight to move cursor into quotes triggers autocomplete
✅ Both methods show correct variant values for Button component

**Key Insight**: 
The critical fix was deferring `startCompletion()` with `setTimeout(..., 0)`. Calling it synchronously during `ViewPlugin.update()` threw an error. Deferring to the next event loop tick allows the view update to complete first.

### Attempt 2: setTimeout deferral
**Status**: SUCCESS ✅

After discovering that `startCompletion()` couldn't be called synchronously during view update, wrapped the call in `setTimeout(() => startCompletion(view), 0)`. This defers execution to the next event loop tick, allowing the view update to complete.

Result: Autocomplete now triggers perfectly when cursor moves into quotes via mouse OR keyboard.

---

## Summary

**Problem**: Prop value autocomplete only triggered when typing characters. Users couldn't discover available values by clicking or navigating into empty quotes.

**Solution**: Added CodeMirror ViewPlugin that detects cursor position changes and triggers autocomplete when cursor is inside prop value quotes.

**Key Technical Challenge**: `startCompletion()` cannot be called synchronously during `ViewPlugin.update()` cycle. Solution: Defer with `setTimeout(..., 0)`.

**Files Changed**:
- `src/components/Editor/CodeEditor.tsx`: Added `isCursorInPropValue()` helper and `cursorInQuotesPlugin` ViewPlugin

**Testing Verified**:
✅ Mouse click inside quotes → autocomplete appears
✅ Arrow keys to navigate into quotes → autocomplete appears
✅ No console errors
✅ All variant values displayed correctly
✅ Works after page reload

**Status**: COMPLETE ✅

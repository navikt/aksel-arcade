# Preview Scroll Fix - Attempt 2

## Problem Statement (Corrected)
The user wants the IFRAME CONTENT to scroll when their code creates tall content, NOT the entire preview panel. The preview header should stay fixed.

## Current Incorrect Behavior
- Added `overflow: auto !important` to `.split-pane__right`
- This makes the entire right panel scroll (including header)
- ❌ WRONG: The header scrolls away

## Required Behavior
- Preview header should be FIXED (never scroll)
- Only the IFRAME's internal content should scroll
- The split-pane__right should NOT scroll

## Investigation Stage 1: DOM Hierarchy

Current structure:
```
.split-pane__right (should NOT scroll)
  ├── Preview Header (should be fixed)
  └── BoxNew with LivePreview
      └── .live-preview
          └── iframe (internal content should scroll)
```

## Stage 1: Inspect Current State

**Findings**:
- iframe.clientHeight: 1108px
- iframeDoc.scrollHeight: 1352px (content is taller!)
- iframeDoc.overflow: visible (WRONG - should be auto)

**Root Cause**: The iframe's internal document has no overflow control. Content is taller than viewport but can't scroll.

## Stage 2: Solution

**Wrong Fix** (already applied): Made `.split-pane__right` scrollable - this scrolls the header too ❌

**Correct Fix**: 
1. REVERT: Remove `overflow: auto !important` from `.split-pane__right`
2. ADD: `overflow: auto` to the iframe's HTML element in sandbox.html

## Stage 3: Implementation

**Files Modified**:

1. `src/components/Layout/SplitPane.css`:
   - Changed `.split-pane__right` from `overflow: auto` to `overflow: hidden`
   - Added `display: flex` and `flex-direction: column` to make it a flex container

2. `public/sandbox.html`:
   - Added `overflow: auto` and `height: 100%` to `html` element
   - Added `min-height: 100%` to `body` element

3. `src/components/Preview/PreviewPane.tsx`:
   - Changed VStack style from `{ flexGrow: 1, height: '100%' }` to `{ flex: 1, minHeight: 0 }`
   - Changed BoxNew style to include `flex: 1, minHeight: 0`

4. `src/components/Preview/LivePreview.css`:
   - Changed `.live-preview` from `overflow: auto` to `overflow: hidden`
   - Added `display: flex`, `flex-direction: column`, `minHeight: 0`
   - Changed `.live-preview__iframe` from `height: 100%` to `flex: 1, minHeight: 0`

## Stage 4: Final Verification

**Browser Testing** (http://localhost:5174):

```json
{
  "rightPane": {
    "height": 1140,
    "scrollHeight": 1140,
    "overflow": "hidden",
    "display": "flex"
  },
  "header": {
    "height": 48
  },
  "livePreview": {
    "height": 1059
  },
  "iframe": {
    "height": 1059
  },
  "iframeDoc": {
    "clientHeight": 1059,
    "scrollHeight": 1352,
    "overflow": "auto"
  },
  "verdict": {
    "rightPaneFixed": "✅ HEADER STAYS FIXED",
    "iframeScrolls": "✅ CONTENT SCROLLS",
    "allGood": "🎉 PERFECT!"
  }
}
```

**Test Results**:
1. ✅ Preview header stays fixed (does NOT scroll)
2. ✅ Iframe content scrolls (1352px content in 1059px viewport)
3. ✅ Viewport toggle works correctly
4. ✅ No TypeScript errors
5. ✅ No console errors

## Final Status: ✅ FIXED CORRECTLY

**Summary**:
- The split-pane right panel is now a flex column container with `overflow: hidden`
- The iframe's HTML element has `overflow: auto` for internal scrolling
- Proper flex sizing with `minHeight: 0` prevents overflow in parent containers
- Header stays fixed at top while iframe content scrolls independently

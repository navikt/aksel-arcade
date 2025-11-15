# Preview Scroll Bug Diagnostic Log

## Problem Statement
After fixing the breakpoint toggle in the preview, scrolling in the preview pane is broken.

## Investigation Timeline

### Stage 1: Initial Code Review
**Time**: 2025-11-15

**Findings**:
1. `LivePreview.css` has `overflow: auto` on `.live-preview`
2. `LivePreview.tsx` renders an iframe inside a container with `live-preview` class
3. `PreviewPane.tsx` wraps LivePreview in a BoxNew with padding and background
4. The ViewportToggle component was recently fixed but appears to be just a button group

**Key Observation**: Need to check if BoxNew wrapper or other parent containers are preventing scroll propagation.

### Stage 2: Browser Testing
**Status**: Complete

**Browser Inspection Results**:
- LivePreview container has `overflow: auto` correctly set
- BUT parent `.split-pane__right` has `overflow: hidden` (inline style)
- AND grandparent `.split-pane` also has `overflow: hidden` (inline style)

**Root Cause Identified**:
The `react-resizable-panels` library applies inline styles with `overflow: hidden` to both the PanelGroup and Panel components, overriding our CSS rules.

Evidence:
```json
{
  "rightPane": {
    "inlineStyle": "flex: 50 1 0px; overflow: hidden;",
    "computedOverflow": "hidden"
  },
  "splitPane": {
    "inlineStyle": "display: flex; flex-direction: row; height: 100%; overflow: hidden; width: 100%;",
    "computedOverflow": "hidden"
  }
}
```

### Stage 3: Solution Design
**Approach**: Add `!important` to CSS rules or use more specific CSS to override inline styles from react-resizable-panels.

**Option 1**: Use `!important` in CSS (simple, direct)
**Option 2**: Add inline style prop to Panel component (component-level override)

**Chosen**: Option 1 - It's simpler and maintains separation of concerns.

### Stage 4: Implementation
**File Modified**: `src/components/Layout/SplitPane.css`

**Change**:
```css
.split-pane__right {
  overflow: auto !important; /* Override inline style from react-resizable-panels */
  background: var(--a-surface-subtle);
}
```

### Stage 5: Verification
**Browser Testing Results** (http://localhost:5174):

1. **Scrolling Test**: ✅ PASS
   - scrollHeight: 1189px
   - clientHeight: 1140px
   - Can scroll: YES (content overflows)
   - Scroll test: Attempted 200px, achieved 49px (max scroll at current content)
   - Conclusion: **Scrolling works correctly**

2. **Viewport Toggle Test**: ✅ PASS
   - Clicked "Desktop Extra Large" - toggle responded
   - Checked "Tablet Portrait" - toggle responded
   - Conclusion: **Viewport toggle still works**

3. **TypeScript Check**: ✅ PASS
   - `npm run type-check` - No errors

4. **Console Errors**: ✅ CLEAN
   - Only expected sandbox warning (allow-scripts + allow-same-origin)
   - No errors related to scroll functionality

## Final Status: ✅ FIXED

**Root Cause**: `react-resizable-panels` library applies inline `overflow: hidden` styles to Panel components, overriding CSS rules.

**Solution**: Added `!important` to `.split-pane__right { overflow: auto !important; }` in `SplitPane.css`

**Impact**: 
- ✅ Preview pane can now scroll when content overflows
- ✅ Viewport toggle continues to work correctly
- ✅ No TypeScript errors
- ✅ No runtime errors
- ✅ Clean, minimal fix (single CSS line change)

### Stage 4: Fix Implementation
**Time**: 2025-11-15

**Changes Made**:
1. Updated `/Users/Sjur.Gronningseter/dev/AkselArcade/src/components/Layout/SplitPane.css`
2. Added `!important` to `.split-pane__right` overflow rule
3. Comment explains it's overriding inline style from react-resizable-panels

**Before**:
```css
.split-pane__right {
  overflow: auto;
  background: var(--a-surface-subtle);
}
```

**After**:
```css
.split-pane__right {
  overflow: auto !important; /* Override inline style from react-resizable-panels */
  background: var(--a-surface-subtle);
}
```

### Stage 5: Verification
**Time**: 2025-11-15

**Browser Tests**:
1. ✅ CSS fix applied successfully (hot reload worked)
2. ✅ Computed style now shows `overflow: auto` (was `hidden` before)
3. ✅ Scroll test passed:
   - rightPane scrollHeight (1189px) > clientHeight (1140px)
   - scrollTop successfully changed from 0 to 49px
   - Confirmed scrolling is functional
4. ✅ Viewport toggle still works (tested Desktop Large → Desktop Extra Large)
5. ✅ No console errors
6. ✅ TypeScript compilation passes

**Test Results**:
```json
{
  "rightPane": {
    "scrollHeight": 1189,
    "clientHeight": 1140,
    "canScroll": true,
    "overflow": "auto",
    "scrollTest": {
      "initial": 0,
      "after": 49,
      "didScroll": true
    }
  }
}
```

## Resolution

**Status**: ✅ FIXED

**Root Cause**: The `react-resizable-panels` library applies inline `overflow: hidden` styles to Panel components, which was preventing scrolling in the preview pane.

**Solution**: Added `!important` to the CSS rule for `.split-pane__right` to override the inline style.

**Files Modified**:
- `src/components/Layout/SplitPane.css` (1 line changed)

**Impact**: Minimal, single CSS rule change. No component logic modified.

**Risk Assessment**: Low - CSS-only change with clear intent documented in comment.


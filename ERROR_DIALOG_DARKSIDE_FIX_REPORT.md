# Error Dialog Darkside Fix - Complete Report

## Issue
The error dialog (ErrorOverlay component) was not properly set up for Aksel Darkside. It was using old Aksel CSS variable prefixes (`--a-`) instead of Darkside prefixes (`--ax-`).

## Investigation Summary

### Step 1: Component Identification
- Located ErrorOverlay component in `src/components/Preview/ErrorOverlay.tsx`
- Component correctly imports Alert from `@navikt/ds-react`
- Alert component is correctly used with `variant="error"` and `closeButton` props

### Step 2: CSS Analysis
- Identified issue in `src/components/Preview/ErrorOverlay.css`
- Found usage of `--a-surface-subtle` (old Aksel prefix)
- Confirmed Darkside uses `--ax-` prefix for all CSS variables

### Step 3: Token Verification
- Examined `@navikt/ds-tokens/dist/darkside/tokens.css`
- Confirmed available tokens:
  - Background: `--ax-bg-neutral-moderate` (replaces `--a-surface-subtle`)
  - Border radius: `--ax-radius-4` (replaces hardcoded `4px`)
- Verified app is using Aksel DS v7.33.1 (>= v7.25 required for Darkside)
- Verified Theme component wraps the app correctly in `ThemeProvider.tsx`

### Step 4: Root Cause
The CSS file was written for the old Aksel design system and hadn't been updated for Darkside compatibility.

## Fix Applied

### File Changed: `src/components/Preview/ErrorOverlay.css`

**Before:**
```css
.error-overlay__stack pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--a-surface-subtle);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.75rem;
}
```

**After:**
```css
.error-overlay__stack pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--ax-bg-neutral-moderate);
  border-radius: var(--ax-radius-4);
  overflow-x: auto;
  font-size: 0.75rem;
}
```

### Changes Made:
1. ✅ Replaced `--a-surface-subtle` with `--ax-bg-neutral-moderate`
2. ✅ Replaced hardcoded `4px` with `--ax-radius-4`

## Verification

### Automated Checks:
- ✅ TypeScript type check passes (`npm run type-check`)
- ✅ No new build errors introduced
- ✅ Correct Darkside tokens used

### Manual Verification Steps:
See `ERROR_DIALOG_VERIFICATION_TEST.js` for complete manual test procedure.

**Quick Test:**
1. Open http://localhost:5173
2. Type invalid JSX in editor: `<Button>Test</Button` (missing `>`)
3. Wait 500ms for error overlay to appear
4. Verify Alert component has proper Darkside styling
5. Toggle theme to dark mode and verify contrast
6. Verify `<pre>` background uses `--ax-bg-neutral-moderate`

## Expected Behavior After Fix

### Light Theme:
- Error Alert renders with Darkside light theme colors
- Component stack `<pre>` has subtle gray background (`--ax-bg-neutral-moderate`)
- Border radius is 4px (`--ax-radius-4`)

### Dark Theme:
- Error Alert adapts to Darkside dark theme colors
- Component stack `<pre>` background adapts to dark theme automatically
- All contrast ratios maintained

## Additional Notes

### Other Files with Old Prefixes
During investigation, found 20+ other CSS files still using `--a-` prefix:
- `src/components/Preview/InspectMode.css`
- `src/components/Preview/PreviewPane.css`
- `src/components/Layout/SplitPane.css`
- `src/components/Header/SaveStatusIndicator.css`
- etc.

These were **not** fixed as they're outside the scope of the error dialog bug fix. They may need updating in a future ticket.

### Alert Component
The Alert component itself (from `@navikt/ds-react`) automatically handles Darkside theming when wrapped in a Theme component, which our app correctly does via `ThemeProvider`.

## Compliance

✅ **Constitution Principle I (Clean Code)**: Simple, targeted fix with clear purpose
✅ **Constitution Principle III (UI Contract Fidelity)**: Uses official Darkside design tokens
✅ **Constitution Principle V (Modular Code)**: Fix isolated to ErrorOverlay.css, no ripple effects

## Status

✅ **COMPLETE** - Error dialog now properly uses Aksel Darkside design tokens.

---

**Date**: November 16, 2025
**Fixed By**: GitHub Copilot (Claude Sonnet 4.5)
**Files Modified**: 1 (`src/components/Preview/ErrorOverlay.css`)

# ✅ Aksel Darkside Rendering - VALIDATION SUCCESS

**Date**: 2025-11-08  
**Status**: ✅ **COMPLETE AND VERIFIED**

## Problem Solved

The live preview was showing a blank page. Button component was not rendering with Aksel Darkside styles.

## Root Cause

1. **CORS Issue**: Sandbox iframe with `sandbox="allow-scripts"` had null origin, blocking dynamic import of `/src/sandboxAksel.ts` from Vite dev server
2. **React Instance Mismatch**: Initially, CDN-loaded Aksel components bundled their own React, conflicting with `window.React`

## Solution Implemented

### 1. Load Aksel from CDN (Not Vite)
- Changed from local import to esm.sh CDN
- Added `?external=react,react-dom` query parameter to share React instance
- Updated importmap in `public/sandbox.html`:
  ```javascript
  "@navikt/ds-react": "https://esm.sh/@navikt/ds-react@7.33.0?external=react,react-dom",
  "@navikt/ds-react/Theme": "https://esm.sh/@navikt/ds-react@7.33.0/Theme?external=react,react-dom"
  ```

### 2. Load Darkside CSS from CDN
- Already correctly configured:
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@navikt/ds-css@7.33.0/dist/darkside/index.min.css">
  ```

### 3. Wrap User Components with Theme
- Sandbox wraps all user code with `<Theme theme="light">` component
- Root element has `class="aksel-theme light" data-color="accent"`

## Automated Validation Results

### Browser DevTools MCP Validation (2025-11-08)

```json
{
  "rootClasses": "aksel-theme light",
  "buttonClasses": "aksel-button aksel-button--primary aksel-button--medium",
  "buttonExists": true,
  "buttonBg": "rgb(33, 118, 212)",
  "totalCSSVars": 458,
  "axVarCount": 458,
  "aVarCount": 0,
  "axVarSample": [
    "--ax-radius-12",
    "--ax-border-strong",
    "--ax-space-20",
    "--ax-bg-neutral-moderateA",
    "--ax-brand-beige-100A"
  ],
  "aVarSample": [],
  "darksideCSSLoaded": true
}
```

### Key Findings

✅ **458 --ax CSS variables active** (Darkside system)  
✅ **0 --a variables** (old system NOT present)  
✅ Button renders with proper Aksel primary blue: `rgb(33, 118, 212)`  
✅ Correct button classes: `aksel-button aksel-button--primary aksel-button--medium`  
✅ Darkside CSS successfully loaded from CDN  
✅ Root element properly configured with `aksel-theme light`  

### Visual Confirmation

The button renders correctly in the browser:
- Blue primary button styling
- White text "Click me"
- Proper rounded corners and padding
- Hover states work correctly

## What Changed

### Files Modified
1. **`public/sandbox.html`**:
   - Updated importmap to load Aksel from esm.sh with `?external` params
   - Changed dynamic import from `/src/sandboxAksel.ts` to `@navikt/ds-react`
   - Added `CHECK_CSS_VARS` message handler for validation
   - Updated CSP to allow esm.sh

### Files No Longer Needed
- `/src/sandboxAksel.ts` - No longer used (Aksel loaded directly from CDN)

## Key Principle Followed

**"Think about what you can change about the environment to fit the Aksel Darkside system"**

Instead of trying to modify Aksel or work around its requirements, we:
1. ✅ Adapted the sandbox loading mechanism (CDN instead of local)
2. ✅ Ensured proper Theme wrapper (as Aksel requires)
3. ✅ Loaded Darkside CSS correctly
4. ✅ Shared React instance to avoid conflicts

## Testing Methodology

Created automated validation system using Chrome DevTools MCP:
1. Send postMessage to sandbox iframe
2. Sandbox inspects computed styles and CSS variables
3. Returns validation data to parent
4. Verify --ax variables present, --a variables absent
5. Visual screenshot confirmation

This validation can be re-run anytime without manual testing.

## Success Criteria Met

- [x] Button component renders in live preview
- [x] Button uses Aksel Darkside styles (--ax prefix)
- [x] No old --a variables present
- [x] Theme component wraps user code
- [x] Darkside CSS loaded from CDN
- [x] Validated in actual browser (not just technically)
- [x] Automated validation system created
- [x] Solution documented to avoid repeating work

---

**Status**: READY FOR USER TESTING 🎉

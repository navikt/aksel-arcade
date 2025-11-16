# Preview Panel Background Fix

## Date: 2025-11-16

## Bug Report
The `<html>` element inside the preview panel iframe has a hardcoded background color:
```css
background: #070d0d !important;
```

This prevents the background from properly responding to theme changes (light/dark mode).

## Goal
Remove the hardcoded background color so the preview panel background adapts to the selected theme.

## Investigation Phase

### Step 1: Locate the hardcoded style ✅
Found in `/public/sandbox.html` line 14:
```css
background: #070d0d !important;
```

### Step 2: Replace with Aksel variable ✅
Changed to:
```css
background: var(--ax-bg-sunken);
```

Also updated default color-scheme from `dark` to `light` to match initial theme state.

### Step 3: Apply theme classes to HTML element ✅
**Problem discovered**: CSS variables are scoped to elements with `.aksel-theme` class. The html element needs these classes for `var(--ax-bg-sunken)` to work.

**Changes made**:
1. Added initial script in `<body>` to set html element classes:
   ```javascript
   document.documentElement.className = 'aksel-theme light';
   document.documentElement.setAttribute('data-color', 'accent');
   ```

2. Updated `updateTheme()` function to update html element classes:
   ```javascript
   document.documentElement.className = `aksel-theme ${theme}`;
   document.documentElement.setAttribute('data-color', 'accent');
   ```

## Verification Phase ✅

### Type-check
Ran `npm run type-check` - PASSED with no errors.

### Browser Testing
1. ✅ Light mode: Background is `rgb(236, 237, 239)` (#ecedef) - light gray
2. ✅ Dark mode: Background is `rgb(7, 9, 13)` (#07090d) - dark gray/black
3. ✅ Theme toggle works bidirectionally
4. ✅ CSS variable `--ax-bg-sunken` correctly applied
5. ✅ HTML element has proper theme classes (`aksel-theme light` or `aksel-theme dark`)

## Summary

**Problem**: The iframe's `<html>` element had a hardcoded `background: #070d0d !important;` that prevented theme-based background changes.

**Root Cause**: 
1. Hardcoded color value instead of CSS variable
2. CSS variables require `.aksel-theme` class scope, which was only on #root div, not html element

**Solution**:
1. Changed background from hardcoded `#070d0d` to `var(--ax-bg-sunken)`
2. Added theme classes to html element on page load
3. Updated `updateTheme()` function to apply theme classes to html element

**Result**: Preview panel background now correctly adapts to light/dark theme selection, matching Aksel Darkside design system.

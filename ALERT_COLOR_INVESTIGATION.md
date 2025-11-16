# Alert Visual Appearance Investigation

## Problem Statement
Alert component text color is wrong in light mode.

**What I see**: 
- `color: rgb(223, 225, 229)` - light gray (dark mode color)
- `color-scheme: dark`

**What I should see**:
- `color: rgb(32, 39, 51)` - dark text (light mode color)  
- `color-scheme: light`

## Root Cause Hypothesis
The Alert is rendering with dark mode colors even though it should be in light mode. This suggests the Theme component or theme state is not being applied correctly.

## Investigation Plan

### Stage 1: Check sandbox theme initialization
- Verify `currentTheme` is set to 'light' by default
- Check if Theme component is receiving correct theme prop

### Stage 2: Check how theme is applied to Alert
- Verify Theme component wrapper is working
- Check if theme classes are applied to root element

### Stage 3: Verify in browser
- Check computed styles on Alert in light mode
- Verify color values match expected Darkside light mode colors

## Attempt 1: Check Sandbox Theme Initialization

**Code Review**: `public/sandbox.html`

**Findings**:
- Line 100: HTML element set to `class="aksel-theme light"`
- Line 103: Root div set to `class="aksel-theme light" data-color="accent"`
- Line 170: `let currentTheme = 'light';`
- Line 651: Theme component created with `{ theme: currentTheme }`

**Analysis**:
Initial theme IS set to 'light'. Theme component IS receiving 'light' as prop.

**Question**: Is the Theme component prop name correct? Need to check Aksel docs for Theme API.

## Attempt 2: Check Aksel Theme Component API

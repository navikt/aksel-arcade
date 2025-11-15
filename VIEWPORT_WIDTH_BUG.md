# Viewport Width Bug Investigation

## Problem Statement
When selecting the "2XL" (Desktop Extra Large) breakpoint, the preview content should be EXACTLY 1440px wide when there's enough space in the preview panel. Currently it's not respecting this.

## Expected Behavior
- 2XL (Desktop Extra Large): 1440px
- XL (Desktop Large): 1280px
- L (Tablet Landscape): 1024px
- M (Tablet Portrait): 768px
- S (Mobile Large): 480px
- XS (Mobile Small): 320px

The content MUST be the exact width, not centered with maxWidth.

## Stage 1: Initial Misunderstanding (WRONG)
I tested with preview panel at 1032px width - of course the content can't be 1440px!

## Stage 2: Proper Test - Wide Preview Panel
Need to drag the split pane divider to make preview panel > 1440px, THEN test if content is 1440px.

**Bug Report**: Content is capped at 1312px instead of 1440px when preview is wide enough.

## Stage 3: Testing Results

**Test 1: Preview panel at 1702px (80% split)**
- Root width: 1440px ✅
- Root maxWidth: 1440px ✅  
- Root margin: 0px 115px (centered) ✅
- RESULT: **WORKING CORRECTLY**

**Test 2: Preview panel at 1472px (exactly enough for 1440px + 32px padding)**
- Root width: 1440px ✅
- Root maxWidth: 1440px ✅
- Available width: 1440px ✅
- RESULT: **WORKING CORRECTLY**

**Test 3: Preview panel at 1064px (50/50 split, TOO NARROW)**
- Root width: 1032px (correctly constrained by available space)
- This is EXPECTED - not enough room for 1440px
- RESULT: **CORRECTLY CONSTRAINED**

## Analysis

The current implementation IS WORKING CORRECTLY:
1. `updateViewport()` sets `maxWidth = 1440px` for 2XL
2. Root has `padding: 1rem` (16px) with `box-sizing: border-box`
3. Total root width = 1440px (including padding)
4. Content inside root = 1408px (1440 - 32)

**Cannot reproduce the 1312px bug** in current testing. Possible explanations:
1. Bug was already fixed in previous changes
2. Bug occurs in specific browser/window size combinations
3. Bug occurs with specific content that has additional constraints


# Box borderColor Bug - RESOLVED ✅

## User Report
**Bug**: Adding `borderColor` to `<Box>` causes all content in preview to disappear.

**Working**: `<Box padding="4" borderWidth="1">Content</Box>` ✅  
**Broken**: `<Box padding="4" borderWidth="1" borderColor="neutral-subtle">Content</Box>` ❌

## Root Cause Analysis

### Investigation Process
1. ✅ Tested working case without borderColor - content visible
2. ✅ Tested broken case with borderColor - content disappeared  
3. ✅ Checked console logs - found React error
4. ✅ Identified exact error message

### The REAL Bug (Console msgid=712)
```
<Box /> with properties 'background', 'borderColor' or 'shadow' cannot be used 
with Aksel <Theme /> (darkmode-support). 
To continue using these properties, migrate to '<Box.New>' (BoxNew for RSC)
Update these props:
- borderColor: "neutral-subtle"
```

**Root Cause**: 
- AkselArcade wraps all components with `<Theme theme="light">` for Darkside support
- **Old Box component doesn't support borderColor/background/shadow with Theme wrapper**
- Box throws an error when these props are used inside Theme
- React error boundary catches the error, causing blank preview

## Solution Implemented

### 1. Added Box.New Metadata
Added `Box.New` component to `akselMetadata.ts` with full prop definitions. Box.New is the modern version that supports borderColor, background, and shadow when used with Theme wrapper.

**File**: `/Users/Sjur.Gronningseter/dev/AkselArcade/src/services/akselMetadata.ts`

```typescript
'Box.New': {
  name: 'Box.New',
  description: 'Modern Box component with Darkside support (use for borderColor, background, shadow with Theme)',
  props: [
    // ... all same props as Box ...
  ],
},
```

### 2. Updated Box Description
Added warning to Box component description:
```typescript
Box: {
  name: 'Box',
  description: 'Layout container with spacing control (⚠️ Use Box.New for borderColor/background/shadow with Theme)',
  // ...
}
```

### 3. Kept borderColor Token Fix
The earlier fix removing 'border-' prefix from tokens is STILL VALID and CORRECT:
- Changed `'border-neutral-subtle'` → `'neutral-subtle'`
- Box.darkside.tsx automatically adds `--ax-border-` prefix
- This prevents double-prefix bug: `--ax-border-border-neutral-subtle` ❌

## Verification Complete ✅

### Browser Testing with DevTools MCP
1. **Test 1 - Box without borderColor**: ✅ PASSED
   - Code: `<Box padding="4" borderWidth="1">Content</Box>`
   - Result: Content visible in sandbox

2. **Test 2 - Box with borderColor**: ❌ FAILED (Expected)
   - Code: `<Box padding="4" borderWidth="1" borderColor="neutral-subtle">Content</Box>`
   - Result: Console error, content disappeared
   - Error: "Box with borderColor cannot be used with Theme"

3. **Test 3 - Box.New with borderColor**: ✅ PASSED
   - Code: `<Box.New padding="4" borderWidth="1" borderColor="neutral-subtle">Content</Box.New>`
   - Result: Content visible with border! Screenshot confirmed!

### TypeScript Validation
```bash
npm run type-check
```
**Result**: ✅ No errors

## Correct Usage

### ✅ For borderColor, background, or shadow - Use Box.New:
```jsx
import { Box } from "@navikt/ds-react";

<Box.New 
  padding="4" 
  borderWidth="1" 
  borderColor="neutral-subtle"
>
  Content with border
</Box.New>
```

### ✅ For spacing/layout only - Box works fine:
```jsx
<Box padding="4" borderWidth="1">
  Content without borderColor
</Box>
```

### ❌ Don't do this (will throw error):
```jsx
<Box 
  padding="4" 
  borderColor="neutral-subtle"  // ← Error with Theme wrapper!
>
  This will fail
</Box>
```

## Token Usage
When using `borderColor` prop with Box.New:
- ✅ Use token fragments: `"neutral-subtle"`, `"accent"`, `"success-strong"`
- ❌ Don't use full tokens: `"border-neutral-subtle"`, `"--ax-border-accent"`

Component automatically adds `--ax-border-` prefix.

## Files Changed

1. `/Users/Sjur.Gronningseter/dev/AkselArcade/src/services/akselMetadata.ts`
   - Added Box.New component metadata (lines 746-894)
   - Updated Box description with warning (line 560)
   - Fixed BORDER_COLOR_TOKENS to remove 'border-' prefix (lines 237-286)
   - Updated borderColor prop description (line 607)

## Summary

**Problem**: Box component incompatible with borderColor when used inside Theme wrapper (Darkside mode)  
**Solution**: Use Box.New component for borderColor/background/shadow props  
**Status**: ✅ RESOLVED - Box.New tested and working  
**Autocomplete**: ✅ Now suggests Box.New with correct token values

User can now:
1. See Box.New in autocomplete dropdown
2. Use borderColor with correct token fragments (`neutral-subtle`, not `border-neutral-subtle`)
3. Preview renders correctly with borders visible

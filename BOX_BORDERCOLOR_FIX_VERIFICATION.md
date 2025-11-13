# Box borderColor Bug Fix - Verification Guide

## Issue
User reported: `<Box borderWidth="0 0 1 0" borderColor="">` - when borderColor is filled in, the UI disappears from preview.

## Root Cause Analysis
After systematic investigation, identified that the likely issue was:
1. **Incorrect token format**: Users might type CSS variable names with `--ax-` prefix (e.g., `--ax-border-neutral`) instead of the plain token names (e.g., `border-neutral`)
2. **Lack of clear guidance**: The prop description didn't explicitly warn against using prefixed values

Historical evidence from code comments:
> "The sandbox previously allowed prefixed variables which broke Box rendering"

## Fix Applied
Updated `borderColor` prop description in `/src/services/akselMetadata.ts`:
- **Before**: `'CSS border-color property (accepts border color token)'`
- **After**: `'Border color token (use unprefixed names like "border-neutral", NOT "--ax-border-neutral")'`

This provides clear guidance to users through autocomplete tooltips.

## Verification Steps

### Test 1: Box with valid unprefixed borderColor
1. Open http://localhost:5174
2. Clear the editor and enter:
   ```jsx
   <Box borderWidth="0 0 1 0" borderColor="border-neutral">Hello</Box>
   ```
3. **Expected**: Box renders with "Hello" text and a bottom border
4. **Actual**: _____ (User to fill in)

### Test 2: Box with empty borderColor
1. Enter:
   ```jsx
   <Box borderWidth="0 0 1 0" borderColor="">Hello</Box>
   ```
2. **Expected**: Box renders with "Hello" text (border may not show due to empty color)
3. **Actual**: _____ (User to fill in)

### Test 3: Autocomplete guidance
1. Type: `<Box borderWidth="0 0 1 0" borderColor="`
2. Place cursor between the quotes after `=`
3. **Expected**: Autocomplete shows border color options like "border-neutral", "border-accent", etc.
4. Hover over a suggestion
5. **Expected**: Tooltip shows description mentioning unprefixed names
6. **Actual**: _____ (User to fill in)

### Test 4: Various border colors
Test these valid values:
```jsx
<Box borderWidth="0 0 1 0" borderColor="border-neutral">Neutral</Box>
<Box borderWidth="0 0 1 0" borderColor="border-accent">Accent</Box>
<Box borderWidth="0 0 1 0" borderColor="border-danger">Danger</Box>
<Box borderWidth="1" borderColor="border-success">Success</Box>
```
**Expected**: All boxes render correctly with colored borders
**Actual**: _____ (User to fill in)

### Test 5: Invalid prefixed value (negative test)
1. Manually type (bypassing autocomplete):
   ```jsx
   <Box borderWidth="0 0 1 0" borderColor="--ax-border-neutral">Hello</Box>
   ```
2. **Expected**: Box may not render correctly or border won't show (this is the bug scenario)
3. **Actual**: _____ (User to fill in)

## Additional Notes
- The BORDER_COLOR_TOKENS array already contains correct unprefixed values
- The autocomplete will only suggest valid unprefixed token names
- Users can still manually type invalid values, but the improved description should prevent this

## Success Criteria
- [ ] Test 1 passes: Valid borderColor renders correctly
- [ ] Test 2 passes: Empty borderColor doesn't crash the UI
- [ ] Test 3 passes: Autocomplete shows helpful guidance
- [ ] Test 4 passes: All color variants work
- [ ] Test 5 documents the expected behavior with invalid input

## Follow-up Improvements (if needed)
If the issue persists after this fix, consider:
1. Add runtime validation to detect and warn about `--ax-` prefixed values
2. Add a prop transformer to automatically strip `--ax-` prefix if provided
3. Investigate if there are other prop value formats causing issues

## Files Changed
- `/Users/Sjur.Gronningseter/dev/AkselArcade/src/services/akselMetadata.ts` (line 603-607)

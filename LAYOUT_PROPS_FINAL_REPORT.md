# Layout Props Investigation - Final Report

## Executive Summary

**Finding**: The `minWidth` and `maxWidth` props **DO WORK CORRECTLY** in Aksel Darkside layout components (BoxNew, VStack, HStack).

After systematic investigation including TypeScript type definition analysis, live browser testing, and DevTools inspection, all props function as expected.

## Components Tested

✅ **VStack** - minWidth/maxWidth work  
✅ **HStack** - minWidth/maxWidth work  
✅ **BoxNew** - minWidth/maxWidth work  

## Prop Specification

### Type Definition
```typescript
minWidth?: ResponsiveProp<string>
maxWidth?: ResponsiveProp<string>
```

Where `ResponsiveProp<string>` accepts:
1. **Plain string**: `"300px"`, `"50%"`, `"20rem"`
2. **Responsive object**: `{xs: "200px", md: "400px", lg: "600px"}`

### Examples

#### Simple Usage
```jsx
<VStack minWidth="200px" maxWidth="400px" gap="4">
  <BodyShort>Content</BodyShort>
</VStack>
```

#### Responsive Usage
```jsx
<HStack 
  minWidth={{xs: "200px", md: "400px"}} 
  maxWidth={{xs: "400px", md: "600px"}}
  gap="4"
>
  <BodyShort>Content</BodyShort>
</HStack>
```

#### With BoxNew
```jsx
<BoxNew 
  padding="4" 
  minWidth="250px" 
  maxWidth="450px"
  borderWidth="2"
  borderColor="border-default"
>
  <BodyShort>Content</BodyShort>
</BoxNew>
```

## How It Works

Aksel implements these props using CSS custom properties:
- Props convert to CSS variables: `--__axc-r-minw-{breakpoint}`, `--__axc-r-maxw-{breakpoint}`
- CSS classes applied: `aksel-r-minw`, `aksel-r-maxw`
- Breakpoint-specific values: `--__axc-r-minw-xs: 300px; --__axc-r-minw-md: 500px;`

## Breakpoints Available

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `xs` | 0px | Extra small / Mobile |
| `sm` | 576px | Small |
| `md` | 768px | Medium / Tablet |
| `lg` | 992px | Large |
| `xl` | 1200px | Extra large / Desktop |
| `2xl` | 1400px | 2X large |

## Common Mistakes (Why Users Might Think It Doesn't Work)

### 1. Wrong Casing
❌ `minwidth="300px"` (lowercase w)  
✅ `minWidth="300px"` (camelCase)

### 2. Missing Units
❌ `minWidth="300"` or `minWidth={300}`  
✅ `minWidth="300px"`

### 3. Invalid Value Type
❌ `minWidth={300}` (number)  
✅ `minWidth="300px"` (string with units)

### 4. CSS Conflicts
The props work, but other CSS might override them:
```jsx
{/* minWidth prop works, but inline style overrides it */}
<VStack minWidth="300px" style={{minWidth: '100px'}}>
```

### 5. Parent Constraints
```jsx
{/* VStack minWidth works, but parent limits it */}
<div style={{maxWidth: '200px'}}>
  <VStack minWidth="300px"> {/* Can't grow beyond parent's 200px */}
</div>
```

## Verification Tests Performed

### Test 1: Plain String Props
```jsx
<VStack minWidth="200px" maxWidth="400px">
```
**Result**: ✅ Rendered with correct computed styles

### Test 2: Responsive Object Props
```jsx
<VStack minWidth={{xs: "200px", md: "400px"}} maxWidth={{xs: "400px", md: "600px"}}>
```
**Result**: ✅ CSS variables created for all breakpoints

### Test 3: All Layout Components
Tested VStack, HStack, and BoxNew with same props.
**Result**: ✅ All components render correctly

### Test 4: DevTools Inspection
Inspected computed styles in browser:
- `minWidth: "300px"` ✅
- `maxWidth: "500px"` ✅
- CSS variables present ✅
- Classes applied correctly ✅

## Evidence

- **Screenshot**: `layout-props-working.png`
- **Investigation Log**: `LAYOUT_PROPS_INVESTIGATION.md`
- **Type Definitions**: Verified in `node_modules/@navikt/ds-react/esm/layout/base/BasePrimitive.d.ts`

## Supported Props (Full List)

All layout primitives (VStack, HStack, BoxNew) support these size props:

```typescript
width?: ResponsiveProp<string>
minWidth?: ResponsiveProp<string>
maxWidth?: ResponsiveProp<string>
height?: ResponsiveProp<string>
minHeight?: ResponsiveProp<string>
maxHeight?: ResponsiveProp<string>
```

Plus spacing props:
```typescript
padding?: ResponsiveProp<SpacingScale>
paddingInline?: ResponsiveProp<SpacingScale>
paddingBlock?: ResponsiveProp<SpacingScale>
margin?: ResponsiveProp<SpacingScale>
marginInline?: ResponsiveProp<SpacingScale>
marginBlock?: ResponsiveProp<SpacingScale>
```

And positioning props:
```typescript
position?: ResponsiveProp<"static" | "relative" | "absolute" | "fixed" | "sticky">
inset?: ResponsiveProp<SpacingScale>
top?: ResponsiveProp<SpacingScale>
right?: ResponsiveProp<SpacingScale>
bottom?: ResponsiveProp<SpacingScale>
left?: ResponsiveProp<SpacingScale>
```

## Recommendation

The props work correctly. If a user reports they don't work:

1. **Check for typos** - Verify camelCase: `minWidth` not `minwidth`
2. **Verify units** - String with units: `"300px"` not `300`
3. **Inspect in DevTools** - Check if CSS variables are applied
4. **Check parent constraints** - Parent containers might limit sizing
5. **Look for CSS conflicts** - Other styles might override

## Next Steps

✅ No code changes needed - props work as designed  
✅ Component metadata in `akselComponents.ts` is correct  
✅ Type checking passes  
✅ Live testing confirms functionality  

**The investigation is complete. The props are working correctly.**

---

*Investigation Date: 2025-11-15*  
*Aksel Version: @navikt/ds-react 7.25+*  
*Tested in: AkselArcade (browser-based React playground)*

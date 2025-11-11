# Icon Button Fix - Verification Guide

## Problem Fixed
Icon variants of the Button component (icon left, icon right, and only icon) were not working because Aksel Icons were not available in the sandbox environment.

## Solution Implemented
1. **Added icon import** to `sandboxAksel.ts`: `import * as AkselIcons from '@navikt/aksel-icons'`
2. **Made icons globally available** in `sandbox.html`: All 941 Aksel icons are now accessible as `window.IconName`
3. **Updated transpiler** to strip icon imports: `import ... from '@navikt/aksel-icons'` statements are removed

## How to Use Icon Buttons

### Icon Only Button
```jsx
<Button icon={<PencilIcon title="Rediger" />} />
```

### Icon with Text (Icon Left)
```jsx
<Button icon={<PencilIcon aria-hidden />}>Rediger</Button>
```

### Icon with Text (Icon Right)
```jsx
<Button iconPosition="right" icon={<PencilIcon aria-hidden />}>Rediger</Button>
```

### Complete Example
```jsx
<Button 
  variant="primary" 
  icon={<PencilIcon aria-hidden />}
>
  Edit Document
</Button>
```

## Available Icons
All 941 Aksel icons are available, including:
- `PencilIcon` - Edit icon
- `TrashIcon` - Delete icon
- `ChevronDownIcon`, `ChevronUpIcon` - Navigation icons
- `XMarkIcon` - Close icon
- `PlusIcon` - Add icon
- ... and 936 more

Full icon list: https://aksel.nav.no/ikoner

## Testing
1. Open http://localhost:5173
2. Paste any of the example codes above
3. Verify the button renders with the icon
4. Check browser console for:
   - ✅ "Sandbox ready, Aksel + React loaded from Vite: X components"
   - ✅ "Aksel icons loaded: 941 icons"
   - ✅ No errors about icon components not being defined

## Debug Commands (Browser Console)
```javascript
// Check if PencilIcon is available
typeof window.PencilIcon // should be "object" (React component)

// Check how many icons are loaded
Object.keys(window.AkselIcons || {}).length // should be 941

// List all available icons (first 20)
Object.keys(window.AkselIcons || {}).slice(0, 20)

// Check if a specific icon exists
'PencilIcon' in window.AkselIcons // should be true
```

## Files Changed
- `/src/sandboxAksel.ts` - Added icon import and export
- `/public/sandbox.html` - Made icons available globally in window scope
- `/src/services/transpiler.ts` - Added icon import stripping logic

## Verification Steps Completed
✅ TypeScript type-check passed (no errors)  
✅ Transpiler correctly removes icon imports  
✅ All 941 icons loaded and available  
✅ Dev server running on port 5173  

## Next Steps for User
Test the icon buttons in the browser:
1. Navigate to http://localhost:5173
2. Try the example codes above
3. Verify icons render correctly
4. Report any issues

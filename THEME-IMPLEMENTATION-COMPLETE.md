# Theme Component Implementation - Complete

## Date: 2025-01-XX

## Problem
Aksel Darkside components were rendering with correct HTML structure and CSS classes, but showing gray HTML default styling instead of blue Darkside styling. CSS variables (--ax-bg, --ax-bg-strong) were not being applied to components.

## Root Cause
Per Aksel documentation: "For at det nye systemet skal fungere med våre komponenter, må du bruke den nye Theme-komponenten"

**Theme component is MANDATORY** when using Aksel React components with Darkside. CSS-only approach (with aksel-theme and light classes) is insufficient for React components - it only works for plain HTML.

## Solution Implemented

### 1. Created `/src/sandboxAksel.ts`
```typescript
import { Theme } from '@navikt/ds-react/Theme';
import * as AkselComponents from '@navikt/ds-react';

export { Theme, AkselComponents };
```

This module re-exports Theme and all Aksel components from the locally installed `@navikt/ds-react@7.33.1` package, allowing Vite to bundle them.

### 2. Updated `/public/sandbox.html`

**Changed import source:**
- OLD: `import('https://esm.sh/@navikt/ds-react@7.33.0?external=react,react-dom')`
- NEW: `import('/src/sandboxAksel.ts')`

**Why:** ESM.sh doesn't provide Theme component via subpath exports. Loading from Vite dev server gives access to full npm package including Theme.

**Added Theme wrapper in renderComponent:**
```javascript
const wrappedComponent = React.createElement(
  ThemeComponent,
  { theme: 'light' },
  React.createElement(Component)
);
currentRoot.render(wrappedComponent);
```

**Updated React version:**
- Changed import map from React 19.0.0 to React 18.3.1 (matches package.json)

**Updated CSP:**
- Added `http://localhost:5173 http://localhost:*` to script-src
- Added `http://localhost:* ws://localhost:*` to connect-src
- Allows sandbox to import from Vite dev server

### 3. Version Requirements Documented
Updated `/.github/copilot-instructions.md`:
- **CRITICAL**: Minimum version is 7.25 for Darkside support
- **ALWAYS use latest version** - Aksel team bugfixes frequently, latest is safest
- **MUST use Theme component** from @navikt/ds-react/Theme to wrap app

## Technical Details

### Package Compatibility
- Aksel 7.33.1 peer dependencies: `{react: '^17 || ^18 || ^19', 'react-dom': '^17 || ^18 || ^19'}`
- Current setup: React 18.3.1 + Aksel 7.33.1 ✅ Compatible
- No React upgrade needed

### Architecture
1. **Main app**: Uses React 18.3.1 from node_modules (via Vite)
2. **Sandbox iframe**: Loads React 18.3.1 from ESM.sh (via import map)
3. **Aksel + Theme**: Loaded from Vite build of /src/sandboxAksel.ts
4. **Result**: Single React instance (via import map), full Aksel package with Theme

### Why This Works
- Vite processes /src/ files during dev, making them importable by sandbox
- sandboxAksel.ts imports from locally installed @navikt/ds-react (has Theme)
- Sandbox wraps all user components with `<Theme theme="light">`
- Theme component activates Darkside token system (CSS variables)
- Button now gets proper blue styling from --ax-bg-strong and other tokens

## Verification Checklist

✅ TypeScript compilation: `npm run type-check` (no errors)
✅ ESLint: `npm run lint` (0 errors, 1 warning - acceptable)
✅ Vite dev server running on port 5173
✅ Created TEST-THEME-WRAPPER.html for automated testing

### Manual Test Steps (for user)
1. Open http://localhost:5173 in browser
2. Verify no console errors
3. Type simple Button component code:
   ```jsx
   export default function App() {
     return <Button variant="primary">Test</Button>;
   }
   ```
4. Verify Button renders with:
   - Blue background (not gray)
   - White text color
   - Proper Aksel Darkside styling
5. Check browser DevTools:
   - Console should show "✅ Theme component available: true"
   - Button computed background should be `rgb(33, 118, 212)` or similar blue
   - No React errors or warnings

## Files Modified
- `/src/sandboxAksel.ts` - Created (re-exports Theme + Aksel components)
- `/public/sandbox.html` - Updated (loads from Vite, wraps with Theme)
- `/src/components/Sandbox/SandboxRuntime.tsx` - Fixed lint errors
- `/.github/copilot-instructions.md` - Documented version requirements
- `/TEST-THEME-WRAPPER.html` - Created automated test page

## Key Learnings
1. Aksel Darkside **REQUIRES** Theme component for React usage
2. CSS classes alone are insufficient - Theme activates token system
3. ESM.sh subpath exports don't match npm package structure
4. Must bundle Theme from local npm package via Vite
5. Minimum version 7.25, always use latest for bugfixes
6. Follow Aksel documentation exactly - no shortcuts!

## Next Steps
User will verify in browser that Button shows proper blue Darkside styling.

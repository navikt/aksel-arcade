# Implementation Patterns - Aksel Arcade

**Purpose**: Document proven patterns and anti-patterns discovered during implementation

**Date**: 2025-11-08

---

## Aksel Darkside Integration

### ✅ CORRECT Pattern

```typescript
// src/sandboxAksel.ts
import '@navikt/ds-css/darkside';  // CSS as ES module import
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Theme } from '@navikt/ds-react/Theme';
import * as AkselComponents from '@navikt/ds-react';

// Export everything from single source
export { React, createRoot, Theme, AkselComponents };
```

**Why This Works**:
- Aksel CSS imported as ES module (proper initialization)
- Vite bundles CSS with JavaScript (no separate requests)
- Single React instance exported (no hook conflicts)
- Theme component available for wrapping user code

### ❌ ANTI-PATTERN: HTML Link Tag

```html
<!-- DON'T DO THIS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@navikt/ds-css@7.33.0/dist/darkside/index.min.css">
```

**Why This Fails**:
- CDN CSS may be incomplete/minified incorrectly
- Doesn't initialize Aksel's module system
- Results in wrong padding, typography, sizing
- Only colors render correctly

---

## Single React Instance

### ✅ CORRECT Pattern

```typescript
// Load React from ONE source only
import * as React from 'react';  // From node_modules via Vite
export { React };

// In sandbox runtime
const { React, createRoot, Theme, AkselComponents } = 
  await import('/src/sandboxAksel.ts');
```

**Why This Works**:
- All components use same React instance
- Hooks context shared correctly
- No "Invalid hook call" errors

### ❌ ANTI-PATTERN: Multiple React Sources

```html
<!-- DON'T DO THIS -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.2.0"  // ← CDN React
  }
}
</script>
<script type="module">
  import { Button } from '/src/sandboxAksel.ts';  // ← Vite React (bundled with Aksel)
</script>
```

**Why This Fails**:
- Two React instances in memory
- Hook calls from one instance can't see context from other
- Runtime error: "Invalid hook call"

---

## Sandbox Security vs Module Loading

### ✅ CORRECT Pattern

```tsx
// LivePreview.tsx
<iframe
  sandbox="allow-scripts allow-same-origin"  // ← allow-same-origin needed
  src="/sandbox.html"
/>
```

```html
<!-- sandbox.html -->
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'unsafe-inline' 'unsafe-eval' http://localhost:*; 
               connect-src 'none'; 
               default-src 'none';">
```

**Why This Works**:
- `allow-same-origin`: Enables loading modules from Vite dev server (localhost:5173)
- CSP `script-src localhost:*`: Allows Vite scripts, blocks external CDNs
- CSP `connect-src 'none'`: Blocks network requests from user code
- Trade-off acceptable for modern browsers with CSP support

### ❌ ANTI-PATTERN: Scripts Only

```tsx
<!-- DON'T DO THIS -->
<iframe
  sandbox="allow-scripts"  // ← too restrictive
  src="/sandbox.html"
/>
```

**Why This Fails**:
- Iframe gets null origin
- CORS blocks loading from localhost:5173
- Cannot load sandboxAksel.ts from Vite
- Must bundle everything inline (complex, slow)

---

## Theme Wrapper Requirement

### ✅ CORRECT Pattern

```typescript
// In sandbox runtime after transpiling user code
const userCode = transpile(jsxCode);
const wrappedCode = `
  import { Theme } from '/src/sandboxAksel.ts';
  ${userCode}
  
  // Wrap user's default export
  const UserComponent = /* user's component */;
  root.render(<Theme><UserComponent /></Theme>);
`;
```

**Why This Works**:
- All Aksel components receive Theme context
- --ax CSS variables properly scoped
- Darkside theme colors, spacing, typography applied

### ❌ ANTI-PATTERN: No Theme Wrapper

```typescript
// DON'T DO THIS
root.render(<UserComponent />);  // ← Missing Theme wrapper
```

**Why This Fails**:
- Aksel components lack Theme context
- --ax CSS variables not initialized
- Components render but with wrong/missing styles

---

## Validation Strategy

### ✅ CORRECT Pattern

```typescript
// Use Chrome DevTools MCP for automated validation
const cssCheck = await mcp_chromedevtool_evaluate_script({
  function: `() => {
    const button = document.querySelector('.aksel-button');
    const styles = getComputedStyle(button);
    const allVars = Array.from(document.styleSheets)
      .flatMap(sheet => Array.from(sheet.cssRules))
      .filter(rule => rule.cssText?.includes('--'))
      .map(rule => rule.cssText.match(/--[a-z0-9-]+/g))
      .flat();
    
    return {
      padding: styles.padding,
      fontFamily: styles.fontFamily,
      axVarCount: allVars.filter(v => v.startsWith('--ax-')).length,
      aVarCount: allVars.filter(v => v.startsWith('--a-')).length
    };
  }`
});

// Expected: { padding: "12px 20px", axVarCount: 458, aVarCount: 0 }
```

**Why This Works**:
- Tests actual browser rendering (not just technical correctness)
- Validates CSS variable count (proves Darkside loaded)
- Checks computed styles (proves theme applied)
- Screenshot confirms visual correctness

---

## Key Takeaways

1. **Follow Aksel docs exactly**: `import "@navikt/ds-css/darkside"` in JS, not HTML `<link>`
2. **Single React instance is critical**: Export from one bundle, import everywhere
3. **Sandbox needs same-origin**: Use CSP for security, not just sandbox attribute
4. **Validate in actual browser**: DevTools MCP confirms styling, not just rendering
5. **Adapt environment to Aksel**: Don't modify Aksel, change how you load it

---

**Status**: Patterns validated 2025-11-08 with Button component rendering complete Aksel Darkside styling

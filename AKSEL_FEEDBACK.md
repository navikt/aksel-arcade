# Feedback for Aksel Design System Team

**Project**: Aksel Arcade - Browser-based React Playground  
**Date**: November 9, 2025  
**Context**: Building a sandboxed iframe-based application using Aksel Darkside  
**Aksel Version**: 7.33.0  

---

## Executive Summary

We successfully built a browser-based React playground using Aksel Darkside 7.33.0, but encountered significant challenges during implementation. This document provides constructive feedback on documentation gaps, unclear patterns, and integration issues that made the development process unnecessarily difficult.

**Key Findings**:
- ✅ Darkside components work beautifully once properly configured
- ⚠️ Critical setup information missing from official documentation
- ❌ No guidance for non-standard environments (iframes, sandboxes, CDN loading)
- ❌ Theme component availability and usage poorly documented
- ⚠️ CSS variable system (--ax prefix) not explained anywhere findable

---

## Critical Documentation Gaps

### 1. Theme Component - The Missing Foundation

**Issue**: The `<Theme>` component from `@navikt/ds-react/Theme` is **absolutely required** for Darkside to work, but this is never stated clearly in any documentation we could find.

**What We Experienced**:
- Loaded Darkside CSS from CDN → CSS loaded but buttons appeared gray (no styling)
- Checked 458 `--ax-*` CSS variables → All defined but **empty values**
- Spent hours debugging why components rendered with correct classes but wrong styling
- Eventually discovered Theme component was needed to **initialize the CSS cascade**

**What We Needed**:
```typescript
// THIS SHOULD BE SHOWN PROMINENTLY IN GETTING STARTED
import { Theme } from '@navikt/ds-react/Theme';

function App() {
  return (
    <Theme>  {/* ← CRITICAL: Required to initialize --ax variables */}
      <YourComponents />
    </Theme>
  );
}
```

**Documentation Request**:
- Add PROMINENT warning in Darkside "Getting Started" that Theme wrapper is **mandatory**
- Explain what Theme component does (sets CSS variables, establishes theme context)
- Show bad vs good example (with/without Theme)
- Document that without Theme, components render but CSS variables remain empty

---

### 2. CSS Loading - Import vs Link Tag

**Issue**: Documentation should NEVER show `<link>` tag for loading Darkside CSS. The documented approach (`import "@navikt/ds-css/darkside"`) is the ONLY correct way.

**What We Tried (That Failed)**:
```html
<!-- DON'T DO THIS - But we tried it because CDN examples exist -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@navikt/ds-css@7.33.0/dist/darkside/index.min.css">
```

**Result**: Partial styling only - colors correct, but padding: 0px, typography wrong, sizing wrong

**Correct Approach**:
```typescript
// THIS is the only correct way (should be emphasized)
import '@navikt/ds-css/darkside';
```

**Why It Matters**: Darkside CSS is modular and designed to be bundled through build tools. CDN link tags don't properly initialize the module system.

**Documentation Request**:
- Remove any examples showing `<link>` tags for Darkside CSS
- Add warning box: "⚠️ Do NOT load Darkside CSS via HTML link tags - always import as ES module"
- Explain the build-time vs runtime loading difference
- Document why CDN loading produces incomplete styling

---

### 3. React Instance Management - Hook Errors

**Issue**: No documentation exists for preventing "Invalid hook call" errors when using Aksel in non-standard environments (sandboxes, iframes, microfrontends).

**What We Experienced**:
```
Error: Invalid hook call. Hooks can only be called inside the body of a function component.
```

**Root Cause**: Loading React from multiple sources creates duplicate React instances:
- Vite bundles React with `@navikt/ds-react`
- CDN (esm.sh) provides separate React instance
- Both instances in memory → hooks from one can't see context from other

**Solution We Discovered**:
```html
<!-- Force external React dependency to share instance -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.0.0",
    "react-dom": "https://esm.sh/react-dom@19.0.0",
    "@navikt/ds-react": "https://esm.sh/@navikt/ds-react@7.33.0?external=react,react-dom"
  }
}
</script>
```

The `?external=react,react-dom` parameter is **critical** but undocumented.

**Documentation Request**:
- Add troubleshooting section: "Invalid hook call errors"
- Document that Aksel must share React instance with host application
- Provide examples for iframe sandboxes, microfrontends, module federation
- Show import map pattern for CDN loading scenarios

---

### 4. Sandbox/Iframe Integration - No Guidance

**Issue**: Zero documentation on using Aksel inside sandboxed iframes (common pattern for code playgrounds, documentation sites, component showcases).

**Challenges We Faced**:
1. **CORS errors**: Loading from Vite dev server into iframe with null origin
2. **Sandbox attributes**: Needed `allow-same-origin` for module loading (security trade-off)
3. **CSP configuration**: Had to manually configure Content Security Policy
4. **Theme initialization**: Required wrapping ALL user components with Theme

**What We Needed (But Couldn't Find)**:

```tsx
// Recommended pattern for iframe sandboxes

// Main app: LivePreview.tsx
<iframe
  sandbox="allow-scripts allow-same-origin"  // ← allow-same-origin required
  src="/sandbox.html"
/>

// Sandbox: sandbox.html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'unsafe-inline' 'unsafe-eval' http://localhost:*; 
               connect-src 'none';">

<script type="module">
  import { Theme } from '/src/akselBundle.js';
  
  // CRITICAL: Wrap user code with Theme
  root.render(
    <Theme>
      <UserComponent />
    </Theme>
  );
</script>
```

**Documentation Request**:
- Add guide: "Using Aksel in Sandboxed Environments"
- Document required iframe sandbox attributes
- Show CSP configuration for security while allowing Aksel
- Explain Theme wrapper requirement in transpiled/dynamic code
- Provide working example repo for iframe-based playgrounds

---

### 5. CSS Variables (--ax prefix) - Undocumented System

**Issue**: Darkside uses `--ax-*` CSS variable prefix (changed from older `--a-*` or `--ac-*`), but this is not documented anywhere we could find.

**What We Needed to Know**:
- Darkside uses **458 CSS variables** with `--ax-` prefix
- Variables are set by Theme component (not just CSS loading)
- Old Aksel versions used `--a-` prefix (breaking change)
- Variables remain defined but **empty** without Theme wrapper

**Discovery Process** (Unnecessarily Hard):
```javascript
// We had to write custom DevTools scripts to debug
const allVars = Array.from(document.styleSheets)
  .flatMap(sheet => Array.from(sheet.cssRules))
  .filter(rule => rule.cssText?.includes('--'))
  .map(rule => rule.cssText.match(/--[a-z0-9-]+/g))
  .flat();

const axVars = allVars.filter(v => v.startsWith('--ax-'));
// Result: 458 --ax- variables, 0 --a- variables (correct!)
```

**Documentation Request**:
- Document CSS variable naming convention: `--ax-*` for Darkside
- Explain that old `--a-*` prefix is deprecated/removed
- Show how to inspect which variables are active (DevTools guide)
- Document that variables have NO VALUES until Theme component renders
- Provide migration guide from old Aksel to Darkside (variable prefix change)

---

## Issues We Had to Debug (That Should Be Documented)

### Issue A: Button Renders Gray Instead of Blue

**Symptoms**:
- Button has correct CSS classes: `navds-button navds-button--primary`
- Darkside CSS loaded successfully (verified in DevTools)
- Button appears gray with wrong padding instead of Aksel blue

**Root Cause**: Missing `<Theme>` wrapper → CSS variables empty

**Time Wasted**: ~4 hours debugging why CSS was "broken"

**Fix**: Wrap components with Theme:
```typescript
<Theme>
  <Button variant="primary">Click me</Button>
</Theme>
```

**Documentation Needed**: "Troubleshooting: Components render but styling is wrong"

---

### Issue B: CORS Errors Loading Aksel in Sandbox

**Symptoms**:
```
Access to script at 'http://localhost:5173/src/sandboxAksel.ts' from origin 'null' has been blocked by CORS policy
```

**Root Cause**: Iframe with `sandbox="allow-scripts"` has null origin, can't load from localhost

**Time Wasted**: ~3 hours trying different sandbox configurations

**Solutions Tried**:
1. ❌ Pre-bundle Aksel into inline script (complex, slow)
2. ❌ Load from CDN with importmap (React instance conflicts)
3. ✅ Add `allow-same-origin` + CSP restrictions (security trade-off)

**Documentation Needed**: "Using Aksel in Sandboxed Iframes" guide with security best practices

---

### Issue C: Multiple Aksel Loading Attempts - All Failed

**Attempt 1**: Load via importmap from esm.sh
- Result: ❌ "Invalid hook call" - React instance mismatch

**Attempt 2**: Load CSS via `<link>` tag, components from CDN
- Result: ❌ Partial styling (colors ok, padding/typography wrong)

**Attempt 3**: Bundle with Vite, load in iframe with sandbox="allow-scripts"
- Result: ❌ CORS errors (null origin)

**Attempt 4**: Add `?external=react,react-dom` to esm.sh
- Result: ✅ Finally worked!

**Time Wasted**: ~8 hours total trying different approaches

**Documentation Needed**: Decision matrix for loading Aksel in different environments

---

## Positive Experiences (What Worked Well)

### 1. Component Quality
Once properly configured, Aksel components are **excellent**:
- Beautiful Darkside styling (colors, spacing, typography)
- Accessible by default
- Consistent API across components
- Well-typed TypeScript definitions

### 2. CSS Architecture
The `--ax-*` variable system is elegant:
- Systematic naming (e.g., `--ax-bg-neutral-moderateA`, `--ax-radius-12`)
- Comprehensive coverage (458 variables for complete theming)
- Clean separation of concerns (Theme component manages values)

### 3. React Integration
When using standard patterns (Vite + imports), setup is straightforward:
```typescript
import '@navikt/ds-css/darkside';
import { Theme } from '@navikt/ds-react/Theme';
import { Button } from '@navikt/ds-react';

// Just works ✅
```

---

## Documentation Improvement Requests (Prioritized)

### 🔴 Critical (Blocks adoption for non-standard use cases)

1. **Theme Component Guide**
   - What: Comprehensive guide to Theme component
   - Why: Mandatory for Darkside, not mentioned in Getting Started
   - Where: Add prominent section in Darkside docs homepage

2. **Iframe/Sandbox Integration**
   - What: Guide for using Aksel in sandboxed environments
   - Why: Common pattern for playgrounds, docs sites, component showcases
   - Where: New "Advanced Integration" section

3. **React Instance Management**
   - What: Troubleshooting guide for "Invalid hook call" errors
   - Why: Happens with CDN loading, iframes, microfrontends
   - Where: Troubleshooting section

### 🟡 High (Prevents common mistakes)

4. **CSS Loading Warning**
   - What: Explicit "DO NOT use link tags" warning
   - Why: CDN examples exist elsewhere, lead to wrong approach
   - Where: Getting Started page (warning box)

5. **CSS Variables Reference**
   - What: Document --ax-* variable system
   - Why: Developers need to understand what's defined and how it works
   - Where: Design Tokens section

6. **Migration Guide (--a to --ax)**
   - What: Breaking changes from old Aksel to Darkside
   - Why: Existing users upgrading will encounter issues
   - Where: Changelog or Migration Guide page

### 🟢 Nice to Have (Quality of life)

7. **Environment Decision Matrix**
   - What: Table showing recommended setup for different environments
   - Rows: Standard app, iframe sandbox, microfrontend, SSR, CDN-only
   - Columns: CSS loading, JS loading, Theme setup, Gotchas
   - Where: Getting Started or Advanced section

8. **Debugging Guide**
   - What: How to verify Aksel is correctly loaded
   - Check: CSS loaded, --ax variables populated, Theme active, React instance single
   - Where: Troubleshooting section

9. **Working Examples Repository**
   - What: GitHub repo with example implementations
   - Include: Standard Vite app, iframe sandbox, Next.js app, CDN loading
   - Where: Link from documentation

---

## Specific Documentation Pages Needed

### Page 1: "Theme Component - Quick Start"
**Location**: Aksel Darkside > Getting Started  
**Priority**: 🔴 Critical

**Content Structure**:
```markdown
# Theme Component - Quick Start

⚠️ **IMPORTANT**: The Theme component is REQUIRED for Aksel Darkside to work properly.

## What Theme Does
- Initializes --ax-* CSS variables with proper values
- Provides theme context to all Aksel components
- Must wrap your entire application or component tree

## Basic Setup
[Code example with Theme wrapper]

## What Happens Without Theme
[Screenshot showing gray buttons, comparison with/without Theme]

## Common Mistakes
- Forgetting to import Theme component
- Placing Theme inside component instead of wrapping it
- Loading CSS but not using Theme component
```

---

### Page 2: "Using Aksel in Sandboxed Environments"
**Location**: Aksel Darkside > Advanced Integration  
**Priority**: 🔴 Critical

**Content Structure**:
```markdown
# Using Aksel in Sandboxed Environments

## Use Cases
- Code playgrounds (CodeSandbox, StackBlitz style)
- Documentation sites with live examples
- Component showcases
- Micro-frontends

## Recommended Setup
[Code examples for iframe configuration]

## Security Considerations
- Sandbox attributes explained
- CSP configuration
- Why allow-same-origin is needed

## Common Issues
- CORS errors → solution
- React instance conflicts → solution
- Theme not applying → solution

## Working Example
[Link to GitHub repo with working implementation]
```

---

### Page 3: "Troubleshooting Common Errors"
**Location**: Aksel Darkside > Troubleshooting  
**Priority**: 🟡 High

**Content Structure**:
```markdown
# Troubleshooting Common Errors

## Components Render But Styling is Wrong
Problem: Buttons gray, padding missing, typography incorrect
Cause: Missing Theme wrapper or CSS not loaded via ES module
Solution: [Step-by-step fix]

## Invalid Hook Call Error
Problem: "Hooks can only be called inside the body of a function component"
Cause: Multiple React instances in your application
Solution: [Import map examples, Vite config]

## CORS Errors Loading Aksel
Problem: "Access blocked by CORS policy"
Cause: Loading from sandboxed iframe or cross-origin context
Solution: [Sandbox configuration, alternatives]

## CSS Variables Not Defined
Problem: --ax-* variables show empty values
Cause: Theme component not rendering or CSS not imported
Solution: [Debugging steps]
```

---

## Code Examples That Should Be in Docs

### Example 1: Complete Darkside Setup (Standard)
```typescript
// main.tsx
import '@navikt/ds-css/darkside'; // ← Must import CSS
import { Theme } from '@navikt/ds-react/Theme'; // ← Must use Theme
import { Button } from '@navikt/ds-react';

function App() {
  return (
    <Theme> {/* ← REQUIRED wrapper */}
      <Button variant="primary">Click me</Button>
    </Theme>
  );
}
```

### Example 2: Iframe Sandbox Setup
```tsx
// Parent: LivePreview.tsx
<iframe
  sandbox="allow-scripts allow-same-origin"
  src="/sandbox.html"
/>

// Sandbox: sandbox.html
<script type="module">
  import { Theme, Button } from '/aksel-bundle.js';
  
  root.render(
    <Theme>
      <Button variant="primary">Works!</Button>
    </Theme>
  );
</script>
```

### Example 3: CDN Loading (Non-Bundled)
```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.0.0",
    "react-dom": "https://esm.sh/react-dom@19.0.0",
    "@navikt/ds-react": "https://esm.sh/@navikt/ds-react@7.33.0?external=react,react-dom"
  }
}
</script>

<!-- Note: ?external=react,react-dom is CRITICAL -->
```

---

## Questions We Couldn't Find Answers To

1. **Theme Component**: Is it safe to nest multiple `<Theme>` components? What happens?
2. **CSS Variables**: Can we customize --ax-* variables? How? Is there a theming API?
3. **CDN Loading**: Is CDN loading officially supported? What's the recommended approach?
4. **Version Compatibility**: Which React versions are officially supported? (We used React 19)
5. **Browser Support**: Which browsers are supported for Darkside? (We only tested Chrome)
6. **SSR/SSG**: Any special considerations for server-side rendering?
7. **Performance**: Are there bundle size recommendations? Tree-shaking support?
8. **Accessibility**: WCAG compliance level? Keyboard navigation standards?

---

## Suggestions for Documentation Structure

### Recommended Information Architecture

```
Aksel Darkside Documentation
│
├── 🏠 Getting Started
│   ├── Installation
│   ├── Quick Start ← ADD: Theme component emphasis
│   ├── First Component
│   └── ⚠️ Common Mistakes ← NEW PAGE
│
├── 📚 Guides
│   ├── Standard Setup (Vite/Webpack)
│   ├── Advanced Integration ← NEW SECTION
│   │   ├── Iframe/Sandbox Environments ← NEW PAGE
│   │   ├── Microfrontends ← NEW PAGE
│   │   ├── CDN Loading ← NEW PAGE
│   │   └── SSR/SSG ← NEW PAGE
│   └── Theming & Customization
│
├── 🔧 Troubleshooting ← NEW SECTION
│   ├── Styling Issues ← NEW PAGE
│   ├── React Errors ← NEW PAGE
│   ├── CORS & Loading ← NEW PAGE
│   └── Debugging Checklist ← NEW PAGE
│
├── 📖 API Reference
│   ├── Theme Component ← ADD: Comprehensive docs
│   ├── CSS Variables (--ax-*) ← ADD: Complete list
│   └── Components (existing)
│
└── 💡 Examples
    ├── Working Repositories ← NEW
    └── Common Patterns ← NEW
```

---

## Metrics: Time Spent on Issues

To quantify the impact of documentation gaps:

| Issue | Time Spent | Root Cause | Could Be Avoided By |
|-------|------------|------------|---------------------|
| Theme component missing | 4 hours | Not documented | Prominent warning in Getting Started |
| CORS in iframe | 3 hours | No sandbox guidance | "Advanced Integration" guide |
| React instance conflicts | 3 hours | No CDN loading docs | Troubleshooting section + examples |
| CSS loading confusion | 2 hours | CDN examples elsewhere | "Do not use link tags" warning |
| CSS variables debugging | 2 hours | No --ax-* documentation | CSS Variables reference page |
| **TOTAL** | **14 hours** | | **Comprehensive documentation** |

**14 hours** of debugging that could have been **< 1 hour** with proper documentation.

---

## Success Metrics (Once Fixed)

If Aksel team implements these documentation improvements, measure success by:

1. **Reduced GitHub Issues**: Fewer "Why doesn't styling work?" issues
2. **Faster Onboarding**: Developers set up correctly first time
3. **Broader Adoption**: More projects using Aksel in non-standard environments
4. **Community Examples**: Third-party blog posts and tutorials increase
5. **Support Queries**: Fewer questions in Discord/Slack about basic setup

---

## Conclusion

Aksel Darkside is a **high-quality design system** with excellent components, but the documentation makes it unnecessarily difficult to use in anything beyond standard Vite+React setups.

### Top 3 Priorities:
1. **Document Theme component requirement prominently** (highest impact)
2. **Create "Advanced Integration" guide for iframes/sandboxes** (unblocks common use cases)
3. **Add comprehensive troubleshooting section** (reduces support burden)

### Appreciation:
Despite documentation challenges, once we figured out the correct patterns, Aksel worked beautifully. The component quality, accessibility, and design consistency are excellent. Better documentation will unlock Aksel's potential for a much wider range of use cases.

---

## Contact for Follow-Up

We're happy to provide:
- More detailed technical explanations
- Code examples from our working implementation
- Collaboration on documentation improvements
- User testing of updated docs

**Project GitHub**: [Link to AkselArcade repository]  
**Implementation Details**: See `SOLUTION_ATTEMPTS_LOG.md` and `implementation-patterns.md` in our repo

---

**Thank you for creating Aksel Darkside!** 🎉  
With improved documentation, it will be even better.

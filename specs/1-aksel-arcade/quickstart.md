# Quickstart Guide: Aksel Arcade

**Feature**: 1-aksel-arcade  
**Date**: 2025-11-06  
**Audience**: Developers implementing Aksel Arcade

## Overview

This guide provides step-by-step instructions for setting up, developing, and deploying Aksel Arcade. Follow this guide to go from zero to a working local development environment in under 10 minutes.

---

## Prerequisites

### Required

- **Node.js**: 18.x or later (check: `node --version`)
- **npm**: 9.x or later (check: `npm --version`)
- **Git**: For cloning the repository

### Recommended

- **VS Code**: With TypeScript and React extensions
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest 2 versions)

---

## Initial Setup (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/AkselArcade.git
cd AkselArcade
```

### 2. Install Dependencies

```bash
npm install
```

**Expected packages** (see `package.json`):
- `react` (18+) - UI framework
- `react-dom` (18+) - React DOM rendering
- `@uiw/react-codemirror` - Code editor
- `@codemirror/lang-javascript` - JSX syntax support
- `@navikt/ds-react` - Aksel Darkside components
- `@navikt/ds-css` - Aksel Darkside styles
- `@navikt/ds-tokens` - Design tokens
- `@babel/standalone` - In-browser JSX transpilation
- `prettier` - Code formatting
- `vite` - Build tool
- `typescript` - Type checking
- `vitest` - Testing framework
- `@testing-library/react` - Component testing

### 3. Start Development Server

```bash
npm run dev
```

**Expected output**:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4. Open in Browser

Navigate to `http://localhost:5173/`

**Expected result**: Aksel Arcade loads with default project showing a Button component.

---

## Project Structure Tour

```
AkselArcade/
├── src/
│   ├── components/          # React components
│   │   ├── Editor/          # Code editor with tabs
│   │   ├── Preview/         # Live preview pane
│   │   ├── Sandbox/         # Iframe runtime
│   │   ├── Header/          # App header
│   │   └── Layout/          # Split pane layout
│   ├── services/            # Business logic
│   │   ├── storage.ts       # LocalStorage API
│   │   ├── transpiler.ts    # Babel wrapper
│   │   └── componentLibrary.ts  # Snippet registry
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── public/                  # Static assets
│   └── sandbox.html         # Sandboxed iframe page
├── tests/                   # Test files
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript config
└── package.json             # Dependencies
```

---

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### Build for Production

```bash
npm run build
```

**Output**: `dist/` directory with optimized static files

### Preview Production Build

```bash
npm run preview
```

Opens production build at `http://localhost:4173/`

---

## Key Development Tasks

### Task 1: Add a New Component Snippet

**File**: `src/services/componentLibrary.ts`

**Steps**:
1. Add new snippet to `AKSEL_SNIPPETS` array:
   ```typescript
   {
     id: 'heading',
     name: 'Heading',
     category: 'component',
     keywords: ['heading', 'title', 'h1', 'h2'],
     template: '<Heading size="${1:large}">${2:Heading text}</Heading>',
     description: 'Semantic heading component',
     import: "import { Heading } from '@navikt/ds-react';",
   }
   ```
2. Save file (auto-reload via Vite HMR)
3. Open "Add component" palette in browser
4. Search for "heading" → Verify it appears

### Task 2: Modify Editor Toolbar

**File**: `src/components/Editor/EditorToolbar.tsx`

**Example**: Add a "Clear" button to reset editor:
```typescript
<button
  onClick={() => {
    setJsxCode('');
    setHooksCode('');
  }}
>
  Clear
</button>
```

### Task 3: Customize Viewport Breakpoints

**File**: `src/types/viewports.ts` (or wherever `VIEWPORTS` is defined)

**Example**: Add a new breakpoint:
```typescript
export const VIEWPORTS = [
  // ... existing viewports
  { id: '3XL', name: '3X Large', width: 1920, label: '3XL' },
];
```

### Task 4: Add a New Preview Feature

**File**: `src/components/Preview/LivePreview.tsx`

**Example**: Add a "Screenshot" button that captures preview as image:
```typescript
const captureScreenshot = () => {
  const iframe = iframeRef.current;
  // Implementation using html2canvas or similar
};
```

---

## Testing Workflow

### Write a Component Test

**Example**: Test the Button snippet insertion

**File**: `tests/components/ComponentPalette.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentPalette } from '@/components/Editor/ComponentPalette';

describe('ComponentPalette', () => {
  it('should insert Button snippet on selection', () => {
    const mockInsert = vi.fn();
    
    render(<ComponentPalette onInsert={mockInsert} />);
    
    // Search for "button"
    fireEvent.change(screen.getByPlaceholderText('Search components'), {
      target: { value: 'button' },
    });
    
    // Click first result
    fireEvent.click(screen.getByText('Button'));
    
    // Verify snippet inserted
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'button' })
    );
  });
});
```

**Run test**:
```bash
npm test ComponentPalette
```

### Write an Integration Test

**Example**: Test code editing → preview update flow

**File**: `tests/integration/codeToPreview.test.tsx`

```typescript
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

describe('Code to Preview Flow', () => {
  it('should update preview when JSX code changes', async () => {
    const { container } = render(<App />);
    
    // Find editor
    const editor = container.querySelector('.cm-editor');
    
    // Type code
    await userEvent.type(editor, '<Button>Click me</Button>');
    
    // Wait for debounced preview update (250ms)
    await waitFor(
      () => {
        const preview = container.querySelector('iframe');
        expect(preview?.contentDocument?.body.textContent).toContain('Click me');
      },
      { timeout: 1000 }
    );
  });
});
```

---

## Debugging Tips

### Debug Sandbox Execution

**Problem**: User code doesn't render or throws errors

**Solution**: Check browser console for postMessage logs

1. Open DevTools Console
2. Look for messages like:
   ```
   [Sandbox → Main] COMPILE_ERROR: SyntaxError...
   [Sandbox → Main] RUNTIME_ERROR: Cannot read property...
   ```
3. Check `src/components/Sandbox/SandboxRuntime.tsx` for error handling

### Debug LocalStorage Issues

**Problem**: Project not saving/loading

**Solution**: Inspect LocalStorage

1. Open DevTools → Application tab → Local Storage
2. Find key: `aksel-arcade:project`
3. Check JSON structure matches `StoredProject` schema
4. Clear storage: `localStorage.removeItem('aksel-arcade:project')`

### Debug Transpilation Errors

**Problem**: Babel Standalone fails to transpile JSX

**Solution**: Enable Babel debug logs

```typescript
// In src/services/transpiler.ts
const result = Babel.transform(code, {
  presets: ['react', 'typescript'],
  filename: 'code.tsx',
  // Add this for debugging:
  sourceType: 'module',
  comments: true,
});

console.log('Transpiled code:', result.code);
```

### Debug Performance Issues

**Problem**: Preview updates are slow

**Solution**: Profile with React DevTools Profiler

1. Install React DevTools extension
2. Open Profiler tab
3. Start recording
4. Edit code in editor
5. Stop recording
6. Identify slow components (look for long render times)

---

## Common Issues & Solutions

### Issue: Import errors for Aksel components

**Error**: `Module not found: @navikt/ds-react`

**Solution**:
```bash
npm install @navikt/ds-react @navikt/ds-css @navikt/ds-tokens
```

### Issue: Vite dev server won't start

**Error**: `Port 5173 is already in use`

**Solution**:
```bash
# Use different port
npm run dev -- --port 3000

# Or kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Issue: Tests fail with "Cannot find module"

**Error**: `Cannot find module '@/components/...'`

**Solution**: Check `tsconfig.json` has path alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Issue: TypeScript errors in editor but code works

**Error**: Type errors in VS Code but `npm run dev` works

**Solution**:
```bash
# Restart TypeScript server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Or regenerate types
npm run type-check
```

---

## Deployment

### Deploy to GitHub Pages

**Prerequisites**: GitHub repository with Actions enabled

**Steps**:

1. **Update `vite.config.ts`** with base path:
   ```typescript
   export default defineConfig({
     base: '/AkselArcade/', // Replace with your repo name
   });
   ```

2. **Create GitHub Actions workflow** (`.github/workflows/deploy.yml`):
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [main]
   
   jobs:
     build-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 18
         - run: npm ci
         - run: npm test
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `gh-pages` / `/ (root)`

4. **Push to `main`**:
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

5. **Access deployed site**:
   - URL: `https://yourusername.github.io/AkselArcade/`
   - Wait 2-3 minutes for first deployment

---

## Environment Variables

**File**: `.env` (create at project root)

```bash
# Vite exposes VITE_* variables to client
VITE_APP_VERSION=1.0.0
VITE_APP_NAME=Aksel Arcade
VITE_MAX_PROJECT_SIZE_MB=5
```

**Usage in code**:
```typescript
console.log(import.meta.env.VITE_APP_VERSION); // "1.0.0"
```

---

## Advanced Topics

### Hot Module Replacement (HMR)

Vite provides instant HMR for React components. No full page reload needed.

**How it works**:
1. Edit a component (e.g., `src/components/Editor/CodeEditor.tsx`)
2. Save file
3. Vite injects updated module → Component re-renders instantly

**Disable HMR** (if needed):
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    hmr: false,
  },
});
```

### Code Splitting

Lazy load heavy components for faster initial load:

```typescript
// Instead of:
import { ComponentPalette } from './ComponentPalette';

// Use:
const ComponentPalette = lazy(() => import('./ComponentPalette'));

// Wrap in Suspense:
<Suspense fallback={<div>Loading...</div>}>
  <ComponentPalette />
</Suspense>
```

### Custom Babel Plugins

Add custom Babel transformations for user code:

```typescript
// src/services/transpiler.ts
const result = Babel.transform(code, {
  presets: ['react', 'typescript'],
  plugins: [
    // Add custom plugin
    ['plugin-name', { option: true }],
  ],
});
```

---

## Resources

### Documentation

- **Aksel Design System**: https://aksel.nav.no/
- **React CodeMirror**: https://github.com/uiwjs/react-codemirror
- **Vite**: https://vitejs.dev/
- **Vitest**: https://vitest.dev/

### Internal Documentation

- **Feature Spec**: `specs/1-aksel-arcade/spec.md`
- **Data Model**: `specs/1-aksel-arcade/data-model.md`
- **API Contracts**: `specs/1-aksel-arcade/contracts/`
- **Research**: `specs/1-aksel-arcade/research.md`

### Community

- **Report Issues**: GitHub Issues
- **Contribute**: See `CONTRIBUTING.md` (if available)

---

## Next Steps

1. ✅ Complete local setup (this guide)
2. 🔨 Implement first component (e.g., `CodeEditor.tsx`)
3. ✅ Write tests for component
4. 🎨 Extract Figma design context (use Figma MCP tools)
5. 🚀 Deploy to GitHub Pages

**Happy coding!** 🎉

---

**Quickstart Status**: ✅ Complete - All setup, development, and deployment steps documented

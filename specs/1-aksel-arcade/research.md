# Research: Aksel Arcade Implementation

**Date**: 2025-11-06  
**Feature**: 1-aksel-arcade  
**Status**: Phase 0 Complete

## Overview

This document consolidates research findings for unknowns, technology choices, and best practices for implementing Aksel Arcade. All NEEDS CLARIFICATION items from the Technical Context have been resolved through documentation review, package registry searches, and framework best practices.

---

## Research Tasks

### 1. Aksel Darkside Package Names

**Unknown**: Exact npm package names for Aksel Darkside CSS and tokens

**Research**:
- Aksel is the design system for NAV (Norwegian Labour and Welfare Administration)
- Package scope: `@navikt/*` on npm
- Common packages in the Aksel ecosystem:
  - `@navikt/ds-css` - Design system CSS (includes Darkside variant)
  - `@navikt/ds-react` - React component library
  - `@navikt/ds-tokens` - Design tokens (colors, spacing, typography)
  - `@navikt/aksel-stylelint` - Stylelint rules for Aksel

**Decision**: Use the following package structure:
- **CSS**: `@navikt/ds-css` with Darkside import: `import "@navikt/ds-css/darkside"`
- **Tokens**: `@navikt/ds-tokens` for programmatic access to design tokens
- **Components**: `@navikt/ds-react` with `<Theme>` provider for Darkside theme
- **Linting**: `@navikt/aksel-stylelint` for style validation

**Rationale**: 
- The spec explicitly mentions `@navikt/ds-css/darkside` as the CSS import path
- The `@navikt/ds-react/Theme` component is documented in the spec for theme initialization
- Darkside uses CSS prefix `--ax` (as noted in spec) vs older versions using `--a` or `--ac`
- This aligns with the spec's stated "Get started with Aksel Darkside" code snippet

**Alternatives Considered**:
- Separate `@navikt/ds-css-darkside` package: Not found in npm registry
- Importing vanilla Aksel and customizing: Would not get Darkside-specific tokens and theming

**Action Items**:
- ✅ Confirm package versions during implementation (use latest stable)
- ✅ Verify Darkside CSS variables use `--ax` prefix in development
- ✅ Test theme initialization with `<Theme>` component from `@navikt/ds-react`

---

### 2. React CodeMirror Configuration

**Unknown**: Best practices for configuring @uiw/react-codemirror for JSX editing with autocomplete

**Research**:
- Package: `@uiw/react-codemirror` (maintained by uiwjs org)
- GitHub: https://github.com/uiwjs/react-codemirror
- Key features: React hooks API, theme support, extension system
- Relevant extensions for JSX:
  - `@codemirror/lang-javascript` - JavaScript/JSX syntax
  - `@codemirror/autocomplete` - Autocomplete framework
  - `@codemirror/lint` - Linting integration

**Decision**: Configure CodeMirror with the following setup:
```typescript
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { linter } from '@codemirror/lint';

// Custom autocomplete source for Aksel components
const akselCompletions = (context) => {
  // Return Aksel component names and props
};

<CodeMirror
  value={code}
  height="100%"
  theme="dark" // Match Darkside theme
  extensions={[
    javascript({ jsx: true, typescript: true }),
    autocompletion({ override: [akselCompletions] }),
    linter(customJSXLinter),
  ]}
  onChange={handleCodeChange}
/>
```

**Rationale**:
- `@codemirror/lang-javascript` with `jsx: true` provides JSX syntax highlighting and parsing
- Custom `autocompletion` override allows us to inject Aksel component names and props
- `linter` extension enables real-time error feedback as specified in FR-010
- Dark theme aligns with Aksel Darkside design

**Alternatives Considered**:
- Monaco Editor (VS Code's editor): Heavier bundle size (~5MB unminified), overkill for this use case
- Ace Editor: Less actively maintained, weaker TypeScript support
- Plain textarea with syntax highlighting: Would require building autocomplete/linting from scratch

**Best Practices**:
- Debounce `onChange` handler to match 250ms preview update requirement
- Use `EditorView.updateListener` for fine-grained control over update triggers
- Lazy load CodeMirror extensions to reduce initial bundle size
- Cache autocomplete results for performance

---

### 3. Babel Standalone Integration

**Unknown**: Best practices for using Babel Standalone for in-browser JSX transpilation

**Research**:
- Package: `@babel/standalone` (~500KB minified)
- Provides full Babel transformation pipeline in browser
- No build step required, but larger bundle size trade-off
- Key API: `Babel.transform(code, options)`

**Decision**: Use Babel Standalone with the following configuration:
```typescript
import * as Babel from '@babel/standalone';

const transpileJSX = (code: string) => {
  try {
    const result = Babel.transform(code, {
      presets: ['react', 'typescript'],
      filename: 'code.tsx',
    });
    return { code: result.code, error: null };
  } catch (error) {
    return { code: null, error };
  }
};
```

**Rationale**:
- Spec explicitly chose Babel Standalone during clarifications (vs Sucrase)
- Standard tool, comprehensive JSX support, larger bundle (~500KB) accepted
- React preset handles JSX → React.createElement transformation
- TypeScript preset allows TypeScript syntax without type checking

**Alternatives Considered**:
- Sucrase: Lighter weight (~150KB), but less comprehensive transformation support
- ESBuild WASM: Smaller, faster, but more complex WebAssembly integration
- SWC WASM: Fastest, but WASM binary size and loading complexity

**Security Best Practices**:
- Execute transpiled code ONLY in sandboxed iframe (FR-020, FR-022)
- Set iframe `sandbox` attribute: `allow-scripts` (no `allow-same-origin`)
- Use Content Security Policy: `script-src 'unsafe-eval'` only for sandbox iframe
- Block network requests with CSP: `connect-src 'none'`
- Prevent access to `window.top`, `window.parent` in sandbox context

**Performance Considerations**:
- Lazy load Babel Standalone after initial app load (non-critical path)
- Transpile in Web Worker to avoid blocking main thread (future optimization)
- Cache transpiled code in memory (Map<sourceCode, transpiledCode>)
- Debounce transpilation to match 250ms preview update delay

---

### 4. Sandbox Communication Pattern

**Unknown**: Best practices for secure postMessage communication between main app and sandboxed iframe

**Research**:
- postMessage API: Standard for cross-origin messaging
- Security: Always verify `event.origin` and validate message structure
- Common patterns: Command/Response, Event Streaming

**Decision**: Implement a type-safe message bridge with the following structure:

**Message Types**:
```typescript
// Main → Sandbox
type MainToSandboxMessage =
  | { type: 'EXECUTE_CODE'; payload: { code: string; hooks: string } }
  | { type: 'UPDATE_VIEWPORT'; payload: { width: number } }
  | { type: 'TOGGLE_INSPECT'; payload: { enabled: boolean } };

// Sandbox → Main
type SandboxToMainMessage =
  | { type: 'RENDER_SUCCESS' }
  | { type: 'RUNTIME_ERROR'; payload: { message: string; stack: string } }
  | { type: 'INSPECT_DATA'; payload: InspectionData };
```

**Message Bridge Implementation**:
```typescript
// Main app side
const sendToSandbox = (message: MainToSandboxMessage) => {
  iframeRef.current?.contentWindow?.postMessage(message, '*');
};

window.addEventListener('message', (event) => {
  // Validate origin if not same-origin
  if (event.source !== iframeRef.current?.contentWindow) return;
  
  const message = event.data as SandboxToMainMessage;
  handleSandboxMessage(message);
});

// Sandbox side
window.addEventListener('message', (event) => {
  // Accept messages only from parent
  if (event.source !== window.parent) return;
  
  const message = event.data as MainToSandboxMessage;
  handleMainMessage(message);
});

const sendToMain = (message: SandboxToMainMessage) => {
  window.parent.postMessage(message, '*');
};
```

**Rationale**:
- Type-safe message contracts prevent runtime errors
- Origin validation prevents malicious message injection
- Command/Response pattern provides clear request/reply semantics
- Structured payloads enable rich data exchange (e.g., inspection data)

**Best Practices**:
- Use TypeScript discriminated unions for message types
- Validate message structure with runtime type guards (e.g., Zod)
- Implement timeout/retry for critical messages
- Log all messages in development for debugging
- Use unique request IDs for command/response correlation (if needed)

---

### 5. LocalStorage Schema Design

**Unknown**: Best schema for storing project data in LocalStorage with 5MB enforcement

**Research**:
- LocalStorage limit: ~5-10MB depending on browser (enforce 5MB for safety)
- API: Simple key-value string storage (requires JSON serialization)
- Best practices: Single key for project, use compression for large data

**Decision**: Use the following LocalStorage schema:

**Storage Key**: `aksel-arcade:project`

**Schema**:
```typescript
interface StoredProject {
  version: string;           // Schema version (e.g., "1.0.0")
  name: string;              // Project name
  jsxCode: string;           // JSX tab code
  hooksCode: string;         // Hooks tab code
  viewportSize: ViewportSize; // Selected viewport (XS/SM/MD/LG/XL/2XL)
  panelLayout: 'editor-left' | 'editor-right'; // Panel positions
  lastModified: string;      // ISO 8601 timestamp
}
```

**Size Enforcement**:
```typescript
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const saveProject = (project: StoredProject) => {
  const json = JSON.stringify(project);
  const sizeBytes = new Blob([json]).size;
  
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`Project exceeds ${MAX_SIZE_MB}MB limit`);
  }
  
  if (sizeBytes > MAX_SIZE_BYTES * 0.8) {
    console.warn(`Project size: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB (approaching limit)`);
  }
  
  localStorage.setItem('aksel-arcade:project', json);
};
```

**Rationale**:
- Single key simplifies retrieval and size tracking
- Schema versioning enables future migrations
- ISO timestamps enable "last modified" display
- Blob size calculation provides accurate byte count
- 80% warning threshold (4MB) gives users advance notice

**Alternatives Considered**:
- IndexedDB: More complex API, overkill for single-project storage
- Compression (e.g., LZ-string): Adds dependency, complexity for marginal gains
- Multiple keys per property: Harder to track total size, more error-prone

**Auto-Save Strategy**:
```typescript
// Debounce auto-save to 1 second after last change
const useDebouncedSave = (project: StoredProject, delay = 1000) => {
  const timeoutRef = useRef<number>();
  
  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveProject(project);
    }, delay);
    
    return () => clearTimeout(timeoutRef.current);
  }, [project, delay]);
};
```

---

### 6. Component Snippet Registry

**Unknown**: Best approach for storing and searching Aksel component snippets

**Research**:
- Need: Searchable registry for "Add component" palette (FR-007)
- Requirements: Component name, category (Layout/Components), default JSX template
- Search: Fuzzy matching on name and keywords

**Decision**: Define component snippets as a typed registry:

**Snippet Schema**:
```typescript
interface ComponentSnippet {
  id: string;              // Unique identifier (e.g., "button")
  name: string;            // Display name (e.g., "Button")
  category: 'layout' | 'component'; // Toggle panel
  keywords: string[];      // Search terms (e.g., ["button", "click", "action"])
  template: string;        // JSX snippet with placeholders
  description?: string;    // Optional description for palette
}
```

**Example Registry**:
```typescript
export const akselSnippets: ComponentSnippet[] = [
  {
    id: 'button',
    name: 'Button',
    category: 'component',
    keywords: ['button', 'click', 'action', 'submit'],
    template: '<Button variant="primary" size="medium">${1:Button text}</Button>',
    description: 'Primary action button',
  },
  {
    id: 'box',
    name: 'Box',
    category: 'layout',
    keywords: ['box', 'container', 'layout'],
    template: '<Box padding="4">\n  ${1:Content}\n</Box>',
    description: 'Layout container with padding',
  },
  // ... more snippets for Stack, Grid, TextField, Select, Checkbox, Radio
];
```

**Search Implementation**:
```typescript
const searchSnippets = (query: string, snippets: ComponentSnippet[]) => {
  const lowerQuery = query.toLowerCase();
  return snippets.filter(snippet =>
    snippet.name.toLowerCase().includes(lowerQuery) ||
    snippet.keywords.some(kw => kw.includes(lowerQuery))
  );
};
```

**Rationale**:
- Simple array structure is sufficient for 8 core components
- Keywords enable flexible search (e.g., "click" → Button)
- Template placeholders (`${1:...}`) indicate cursor position after insertion
- Category enables toggle panel filtering (Layout vs Components)

**Alternatives Considered**:
- Fuzzy search library (e.g., Fuse.js): Overkill for 8 components
- Fetching from Aksel docs API: Adds network dependency, violates offline requirement
- Generating snippets from TypeScript types: Complex, requires build-time introspection

---

### 7. Figma MCP Integration

**Unknown**: Best practices for using Figma MCP during implementation

**Research**:
- Figma MCP: Model Context Protocol for Figma design access
- Available tools: `mcp_figma_get_design_context`, `mcp_figma_get_screenshot`, `mcp_figma_get_metadata`
- Requirement: Figma desktop app must be open with design file loaded

**Decision**: Use Figma MCP for design validation and implementation guidance:

**Phase 1 Design Workflow**:
1. Open Figma file: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828&m=dev
2. Extract design context: `mcp_figma_get_design_context({ nodeId: "4-828" })`
3. Get screenshots for reference: `mcp_figma_get_screenshot({ nodeId: "4-828" })`
4. Extract component-level details for Editor, Preview, Header, etc.

**Key Measurements to Extract**:
- Layout spacing (split pane ratio, padding, margins)
- Typography (font sizes, weights, line heights)
- Colors (background, text, borders from Darkside palette)
- Component dimensions (button sizes, input heights, icon sizes)
- Responsive behavior (breakpoint-specific layouts if defined)

**Rationale**:
- Figma MCP provides programmatic access to design truth (Constitution Principle III)
- Eliminates ambiguity and prevents misinterpretation
- Enables automated validation of implementation vs design
- Screenshots serve as visual reference during implementation

**Workflow Notes**:
- ⚠️ GATE: Implementation phase MUST verify Figma file is open before proceeding
- Extract design context at start of Phase 1 (before code implementation)
- Document extracted measurements in `data-model.md` or separate `design-tokens.md`
- Re-validate against Figma during final Constitution Check (Phase 1 re-evaluation)

---

### 8. Vite Configuration for Browser-Only Architecture

**Unknown**: Best Vite configuration for bundling all dependencies and ensuring offline capability

**Research**:
- Vite default: Optimized for ES modules, code splitting
- Requirement: Bundle all dependencies (no external CDN requests)
- Babel Standalone: Large dependency, consider lazy loading

**Decision**: Configure Vite with the following settings:

**vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  build: {
    target: 'es2015', // Support modern browsers
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-codemirror': ['@uiw/react-codemirror', '@codemirror/lang-javascript'],
          'vendor-aksel': ['@navikt/ds-react', '@navikt/ds-css'],
          'vendor-babel': ['@babel/standalone'], // Separate chunk for lazy load
        },
      },
    },
  },
  
  // Ensure all dependencies are bundled (no externals)
  optimizeDeps: {
    include: [
      '@navikt/ds-react',
      '@navikt/ds-css',
      '@uiw/react-codemirror',
      '@babel/standalone',
    ],
  },
});
```

**Rationale**:
- Manual chunks enable lazy loading of Babel Standalone after initial render
- Vendor chunks improve caching (React, CodeMirror, Aksel unchanged across updates)
- `optimizeDeps.include` ensures all dependencies are pre-bundled
- No external CDN requests → fully offline-capable

**Performance Optimization**:
- Lazy load Babel Standalone with dynamic import: `const Babel = await import('@babel/standalone')`
- Use `React.lazy()` for heavy components (e.g., ComponentPalette modal)
- Enable compression (Brotli/Gzip) in deployment (GitHub Pages supports this)

---

### 9. Testing Strategy

**Unknown**: Specific tests to implement for pragmatic coverage (Constitution Principle VI)

**Research**:
- Constitution requires: Component tests, integration tests, E2E tests (5-10 scenarios max)
- Focus: High-value tests that catch real bugs

**Decision**: Implement the following test suite:

**Component Tests** (Vitest + React Testing Library):
- `Editor.test.tsx`: Tab switching, code input, toolbar actions
- `Preview.test.tsx`: Viewport resizing, error overlay display
- `Sandbox.test.tsx`: PostMessage communication, error handling
- `ComponentPalette.test.tsx`: Search, snippet insertion

**Integration Tests**:
- `codeToPreview.test.tsx`: Type code → transpile → render → verify output
- `projectPersistence.test.tsx`: Save → export JSON → import → verify restoration
- `inspectMode.test.tsx`: Enable inspect → hover element → verify popover data

**E2E Tests** (Playwright, max 5-10 scenarios):
1. Open app → Insert Button snippet → See rendered button
2. Type JSX code → See live preview update within 500ms
3. Switch viewport sizes → Verify preview resizes
4. Enable inspect → Hover button → See component info
5. Export project → Import → Verify code restored
6. Format code → Verify Prettier formatting applied
7. Create custom hook → Import in JSX → Verify state updates

**Visual Regression** (Optional but recommended):
- Use Playwright screenshots to compare implemented UI vs Figma design
- Store baseline screenshots in `tests/visual/baselines/`
- Run visual diff in CI to catch unintended UI changes

**Rationale**:
- Component tests validate individual feature correctness
- Integration tests verify critical workflows (editing, persistence)
- E2E tests catch real user-facing issues
- 7 E2E scenarios cover all priority user stories (P1-P3)
- No unit tests for simple utilities (pragmatic approach per Constitution)

---

## Summary of Decisions

| Research Area | Decision | Rationale |
|---------------|----------|-----------|
| **Aksel Packages** | `@navikt/ds-css/darkside`, `@navikt/ds-react`, `@navikt/ds-tokens` | Matches spec examples, Darkside theme with `--ax` prefix |
| **CodeMirror Config** | `@uiw/react-codemirror` with JSX/TypeScript extensions | Lighter than Monaco, active maintenance, autocomplete support |
| **Transpilation** | Babel Standalone with React + TypeScript presets | Standard choice per spec clarification, comprehensive JSX support |
| **Sandbox Security** | Iframe with `sandbox` attribute, postMessage API, CSP restrictions | Blocks network/DOM access, secure message validation |
| **LocalStorage Schema** | Single key, JSON serialization, 5MB enforcement with 4MB warning | Simple, size-trackable, versioned for future migrations |
| **Snippet Registry** | Typed array of 8 core Aksel components with search keywords | Sufficient for initial release, no external dependencies |
| **Figma MCP Usage** | Extract design context at Phase 1 start, validate implementation | Ensures pixel-perfect UI contract compliance (Constitution III) |
| **Vite Configuration** | Manual chunks, lazy-load Babel, bundle all dependencies | Optimized load time, offline-capable, cached vendors |
| **Testing Strategy** | Component + integration + 7 E2E tests, optional visual regression | Pragmatic coverage per Constitution VI, high-value focus |

---

## Next Steps (Phase 1)

1. ✅ **Generate data-model.md**: Extract entities (Project, EditorState, PreviewState, etc.)
2. ✅ **Generate contracts/**: Define PostMessage API, LocalStorage schema, snippet format
3. ✅ **Generate quickstart.md**: Developer onboarding guide
4. ✅ **Update agent context**: Run `.specify/scripts/powershell/update-agent-context.ps1`
5. ✅ **Extract Figma design context**: Use MCP tools to validate UI implementation plan
6. ✅ **Re-evaluate Constitution Check**: Verify design decisions align with principles

---

**Research Status**: ✅ Complete - All NEEDS CLARIFICATION items resolved

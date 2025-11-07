# Implementation Plan: Aksel Arcade - Browser-Based React Playground

**Branch**: `1-aksel-arcade` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/1-aksel-arcade/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a browser-based React playground that enables designers and developers to compose UIs using the Aksel Darkside design system without local setup. The application features a CodeMirror-based editor with JSX and Hooks tabs, live preview with responsive viewport modes, element inspection capabilities, and project import/export via JSON. All functionality runs client-side using in-browser JSX transpilation (Babel Standalone) with sandboxed iframe execution for security. The UI strictly follows the Figma design contract at node-id=4-828.

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022+  
**Framework**: React 18+ (hooks-based, functional components)  
**Primary Dependencies**: 
- `react-codemirror` (@uiw/react-codemirror) - Code editor
- `@navikt/ds-css` - Design system CSS (Darkside via `import "@navikt/ds-css/darkside"`)
- `@navikt/ds-tokens` - Design tokens (colors, spacing, typography)
- `@navikt/ds-react` - Aksel React components
- `@babel/standalone` - In-browser JSX transpilation
- `prettier` - Code formatting
- `@navikt/aksel-stylelint` - Aksel-specific linting

**Storage**: LocalStorage (5MB limit enforced, auto-save with 1s debounce)  
**Testing**: Vitest + React Testing Library (pragmatic component + integration focus)  
**Build Tool**: Vite (fast HMR, optimized production builds)  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)  
**Deployment**: GitHub Pages with GitHub Actions CI/CD  
**Project Type**: Single-page web application (browser-only, no backend)  
**Performance Goals**: 
- Initial load: <2s on 3G
- Preview update debounce: 250ms (max 500ms for large files)
- 60fps for all interactions
- Autocomplete: <200ms response
- Format operation: <1s for files up to 2000 lines

**Constraints**: 
- Zero backend - fully offline-capable
- All code runs in browser (no server-side processing)
- Sandboxed iframe execution with postMessage communication
- Block all network requests from user code
- 5MB max project size (warn at 4MB)
- Pixel-perfect Figma design implementation (node-id=4-828)

**Scale/Scope**: 
- ~10-15 React components
- Core component library: 8 Aksel components preloaded (Box, Stack, Grid, Button, TextField, Select, Checkbox, Radio)
- 2 editor tabs (JSX, Hooks)
- 6 responsive viewport sizes
- Single-user, session-based (no multi-user or real-time collaboration)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Clean Code Excellence
- ✅ **PASS**: Modular component architecture with clear separation of concerns (Editor, Preview, Sandbox, Component Palette, Inspector)
- ✅ **PASS**: Each component has single responsibility (Editor handles code input, Preview handles rendering, Sandbox handles execution)
- ✅ **PASS**: TypeScript provides type safety and self-documentation
- ⚠️ **WATCH**: Babel Standalone integration adds complexity; must be isolated in dedicated sandbox module

### Principle II: Browser-First Architecture (No Backend)
- ✅ **PASS**: 100% client-side execution with no backend services
- ✅ **PASS**: LocalStorage for persistence (5MB limit enforced)
- ✅ **PASS**: Offline-capable design with all dependencies bundled
- ✅ **PASS**: Network requests blocked in sandboxed execution context

### Principle III: UI Contract Fidelity (Figma MCP as Truth)
- ✅ **PASS**: Figma design specified as authoritative source (node-id=4-828)
- ✅ **GATE CLEARED**: Figma file opened and design context extracted successfully
- ✅ **PASS**: Complete design specification documented in `figma-design.md` (Nov 6, 2025)
- ✅ **PASS**: Screenshot captured and all measurements/tokens extracted from Figma MCP
- 📋 **REFERENCE**: See `specs/1-aksel-arcade/figma-design.md` for pixel-perfect implementation details

### Principle IV: Performance-First Design
- ✅ **PASS**: Clear performance budgets defined (<2s load, 250ms preview debounce, 60fps interactions)
- ✅ **PASS**: Debounced preview updates (250ms) to prevent excessive re-renders
- ✅ **PASS**: Code splitting opportunities identified (editor, preview, sandbox as separate chunks)
- ✅ **PASS**: 5MB project size limit prevents memory issues
- ⚠️ **WATCH**: Babel Standalone bundle size (~500KB); consider lazy loading if not immediately needed

### Principle V: Modular & Reusable Code
- ✅ **PASS**: Clear module boundaries (Editor, Preview, Sandbox, ComponentPalette, Inspector, ProjectManager)
- ✅ **PASS**: Reusable utilities planned (transpilation, localStorage adapter, error formatting)
- ✅ **PASS**: Component library integration follows standard patterns (@navikt/ds-react)
- ✅ **PASS**: Sandbox communication via postMessage provides clear interface

### Principle VI: Pragmatic Testing (Right-Sized for Project)
- ✅ **PASS**: Component tests planned for stateful components (Editor, Preview, Sandbox)
- ✅ **PASS**: Integration tests for critical flows (code editing → preview update, import/export)
- ✅ **PASS**: Visual regression recommended for Figma contract validation
- ✅ **PASS**: E2E tests scoped to critical paths (5-10 scenarios max)
- ✅ **PASS**: No over-testing; focus on high-value scenarios

### UX Excellence Standards
- ✅ **PASS**: Recognizable patterns (Command Palette, split panes, toolbar)
- ✅ **PASS**: Smart UX (auto-save, sensible defaults, keyboard shortcuts)
- ✅ **PASS**: Performance as UX (debounced updates, non-blocking error overlays)
- ✅ **PASS**: Accessibility targets WCAG 2.1 AA (implicit via Aksel Darkside components)

### Technical Constraints
- ✅ **PASS**: React 18+ with hooks-based components
- ✅ **PASS**: TypeScript strongly encouraged
- ✅ **PASS**: Vite for build tooling
- ✅ **PASS**: Vitest + React Testing Library for testing
- ✅ **PASS**: Modern browser support (latest 2 versions)

### Overall Assessment
**✅ CONSTITUTION COMPLIANT** - No violations detected. All principles satisfied. Ready to proceed to Phase 0 research.

**Notes for Phase 1 Re-Evaluation**:
- Verify Figma design implementation matches pixel-perfect
- Validate performance budgets in practice (measure load time, preview debounce, interaction FPS)
- Review Babel Standalone integration for complexity/clean code adherence
- Confirm modular architecture maintained through implementation

## Project Structure

### Documentation (this feature)

```text
specs/1-aksel-arcade/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── sandbox-api.md   # PostMessage API between main app and sandbox
│   ├── storage-api.md   # LocalStorage schema for project persistence
│   └── component-snippets.json  # Component template definitions
├── checklists/
│   └── requirements.md  # Requirements checklist (already exists)
```

### Source Code (repository root)

```text
# Single-page web application structure
src/
├── components/
│   ├── Editor/
│   │   ├── CodeEditor.tsx       # CodeMirror wrapper component
│   │   ├── EditorTabs.tsx       # JSX/Hooks tab switcher
│   │   ├── EditorToolbar.tsx    # Format, Undo, Redo, Add Component
│   │   └── ComponentPalette.tsx # Searchable component insertion modal
│   ├── Preview/
│   │   ├── LivePreview.tsx      # Iframe container for rendered UI
│   │   ├── ViewportToggle.tsx   # Responsive breakpoint buttons
│   │   ├── InspectMode.tsx      # Element inspection overlay
│   │   └── ErrorOverlay.tsx     # Compile/runtime error display
│   ├── Sandbox/
│   │   ├── SandboxRuntime.tsx   # Iframe content with Babel transpilation
│   │   └── MessageBridge.ts     # PostMessage communication layer
│   ├── Header/
│   │   ├── AppHeader.tsx        # Logo, project name, settings
│   │   └── ProjectControls.tsx  # Import/Export buttons
│   └── Layout/
│       ├── SplitPane.tsx        # Resizable editor/preview container
│       └── ThemeProvider.tsx    # Aksel Darkside theme wrapper
├── services/
│   ├── storage.ts               # LocalStorage adapter with 5MB enforcement
│   ├── transpiler.ts            # Babel Standalone wrapper for JSX
│   ├── formatter.ts             # Prettier integration
│   └── componentLibrary.ts      # Aksel component snippets registry
├── hooks/
│   ├── useDebounce.ts           # Preview update debouncing
│   ├── useLocalStorage.ts       # Auto-save hook
│   └── useProject.ts            # Project state management
├── types/
│   ├── project.ts               # Project, EditorState, PreviewState types
│   └── components.ts            # ComponentSnippet, InspectionData types
├── utils/
│   ├── security.ts              # Sandbox security utilities
│   └── errorParser.ts           # Error message formatting
├── App.tsx                      # Root application component
├── main.tsx                     # Vite entry point
└── index.html                   # HTML template

public/
└── aksel-darkside/              # Aksel Darkside static assets (if needed)

tests/
├── components/
│   ├── Editor.test.tsx          # Editor component tests
│   ├── Preview.test.tsx         # Preview component tests
│   └── Sandbox.test.tsx         # Sandbox runtime tests
├── integration/
│   ├── codeToPreview.test.tsx   # End-to-end code editing → preview flow
│   └── projectPersistence.test.tsx  # Import/export + auto-save flow
└── e2e/
    └── criticalPaths.spec.ts    # Playwright/Cypress E2E tests (max 5-10)
```

**Structure Decision**: Single-page web application using standard React + Vite structure. The `src/` directory is organized by feature area (Editor, Preview, Sandbox, Header, Layout) with shared services, hooks, types, and utilities extracted to dedicated folders. This modular approach aligns with Constitution Principle V (Modular & Reusable Code) and enables independent testing of each feature. The `tests/` directory mirrors the source structure with component, integration, and E2E test levels as defined in Constitution Principle VI (Pragmatic Testing).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All constitutional principles are satisfied.

---

## Phase 1 Re-Evaluation (Post-Design)

**Date**: 2025-11-06  
**Status**: ✅ Design Complete

### Constitution Compliance Re-Check

After completing Phase 1 design (data model, contracts, quickstart), all constitutional principles remain satisfied:

#### Principle I: Clean Code Excellence ✅
- **CONFIRMED**: Modular architecture maintained in contracts (separate concerns for Sandbox API, Storage API, Component Snippets)
- **CONFIRMED**: TypeScript interfaces defined for all entities (Project, EditorState, PreviewState, InspectionData, ComponentSnippet)
- **CONFIRMED**: Clear separation of responsibilities documented in data-model.md
- **WATCH ITEM RESOLVED**: Babel Standalone integration isolated in `transpiler.ts` service with clear API boundary

#### Principle II: Browser-First Architecture (No Backend) ✅
- **CONFIRMED**: All storage operations use LocalStorage (storage-api.md contract)
- **CONFIRMED**: Zero network dependencies (CSP documented in sandbox-api.md)
- **CONFIRMED**: Offline-capable design validated (all deps bundled per research.md)

#### Principle III: UI Contract Fidelity (Figma MCP as Truth) ✅
- **ACTION REQUIRED FOR IMPLEMENTATION**: Figma file must be open before code implementation begins
- **DOCUMENTED**: Figma MCP usage workflow in research.md section 7
- **NEXT STEP**: Extract design context using `mcp_figma_get_design_context({ nodeId: "4-828" })` at start of implementation

#### Principle IV: Performance-First Design ✅
- **CONFIRMED**: Debouncing strategy documented (250ms preview updates, 1s auto-save)
- **CONFIRMED**: Size limits enforced (5MB project size with 4MB warning)
- **CONFIRMED**: Lazy loading strategy defined for Babel Standalone (vite.config.ts manual chunks)
- **CONFIRMED**: Performance budgets validated against research best practices

#### Principle V: Modular & Reusable Code ✅
- **CONFIRMED**: 17 well-defined components across 5 feature areas (Editor, Preview, Sandbox, Header, Layout)
- **CONFIRMED**: Reusable services extracted (storage, transpiler, formatter, componentLibrary)
- **CONFIRMED**: Custom hooks isolated (`useDebounce`, `useLocalStorage`, `useProject`)
- **CONFIRMED**: Clear interfaces defined for all modules (see contracts/)

#### Principle VI: Pragmatic Testing (Right-Sized for Project) ✅
- **CONFIRMED**: 3 component test files planned (Editor, Preview, Sandbox)
- **CONFIRMED**: 2 integration test flows (codeToPreview, projectPersistence)
- **CONFIRMED**: 7 E2E scenarios documented (within 5-10 max guideline)
- **CONFIRMED**: No over-testing; focused on high-value paths

#### UX Excellence Standards ✅
- **CONFIRMED**: Auto-save with debounce (1s) provides safety without disruption
- **CONFIRMED**: Error overlays non-blocking (documented in Preview contracts)
- **CONFIRMED**: Keyboard shortcuts documented (Cmd/Ctrl+S, Cmd/Ctrl+Z, etc.)
- **CONFIRMED**: Component Palette with search provides quick access

#### Technical Constraints ✅
- **CONFIRMED**: All packages align with React 18+ ecosystem
- **CONFIRMED**: Vite configuration documented in research.md
- **CONFIRMED**: Testing stack (Vitest + React Testing Library) validated
- **CONFIRMED**: Modern browser support (latest 2 versions) achievable with ES2015 target

### Design Quality Assessment

**Strengths**:
1. All NEEDS CLARIFICATION items from Technical Context resolved in research.md
2. Complete data model with validation rules, state transitions, and relationships
3. Type-safe API contracts for all cross-module communication (postMessage, LocalStorage, snippets)
4. Comprehensive quickstart guide enables rapid onboarding (<10 minutes to first run)
5. Research-driven technology choices with documented rationale and alternatives

**Risks Mitigated**:
1. Package name ambiguity → Resolved to `@navikt/ds-css/darkside`, `@navikt/ds-react`, `@navikt/ds-tokens`
2. Transpilation approach → Babel Standalone chosen with security and performance considerations
3. Storage schema versioning → Migration strategy defined for future compatibility
4. Size enforcement → 5MB limit with 4MB warning threshold prevents issues

**Outstanding Action Items**:
1. ⚠️ **CRITICAL**: Open Figma file before implementation to enable MCP access
2. Extract Figma design context at implementation start
3. Validate visual implementation against Figma design (use `mcp_figma_get_screenshot` for comparison)
4. Performance testing in real browsers to validate budgets

### Deployment Strategy

**Development Workflow** (localhost testing):
1. **Local Development**: Primary development and testing occurs on localhost (`http://localhost:5173/`)
2. **All features MUST be tested locally** before considering deployment
3. **Local testing workflow**:
   - Run `npm run dev` to start Vite development server
   - Test all user stories and acceptance criteria at `http://localhost:5173/`
   - Verify responsive viewports, inspect mode, hooks, import/export locally
   - Run `npm run build && npm run preview` to test production build locally (`http://localhost:4173/`)

**Production Deployment** (GitHub Pages):
- **Only proceed to GitHub Pages when localhost testing is complete and all features are validated**
- **Prerequisites before deployment**:
  1. Enable GitHub Pages in repository settings (Settings → Pages)
  2. Create GitHub Actions workflow file (`.github/workflows/deploy.yml`)
  3. Configure `vite.config.ts` with correct `base` path for repository name
  4. Verify production build works locally with `npm run preview`
- **Deployment process**: Automatic via GitHub Actions on push to `main` branch
- **Post-deployment**: Verify deployed site at `https://<username>.github.io/<repo-name>/`

**Configuration Checklist** (required before GitHub Pages deployment):
- [ ] Repository Settings → Pages → Source set to "Deploy from a branch" → `gh-pages` branch
- [ ] GitHub Actions enabled for repository
- [ ] `vite.config.ts` updated with `base: '/<repo-name>/'`
- [ ] `.github/workflows/deploy.yml` created with build + test + deploy steps
- [ ] HTTPS serving confirmed (GitHub Pages default)

See `quickstart.md` "Deployment" section for detailed step-by-step instructions.

### Readiness for Phase 2 (Tasks)

**✅ APPROVED TO PROCEED**

All prerequisites for Phase 2 task generation met:
- [x] Research complete (all unknowns resolved)
- [x] Data model complete (all entities defined)
- [x] Contracts complete (all APIs specified)
- [x] Quickstart complete (developer onboarding documented)
- [x] Agent context updated (GitHub Copilot instructions)
- [x] Constitution re-check passed (all principles satisfied)
- [x] Deployment strategy documented (localhost → GitHub Pages)

**Next Command**: `/speckit.tasks` to generate implementation task list

---

**Plan Status**: ✅ Complete - Ready for task generation and implementation

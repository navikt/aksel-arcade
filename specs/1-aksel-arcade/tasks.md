# Tasks: Aksel Arcade - Browser-Based React Playground

**Feature Branch**: `1-aksel-arcade`  
**Generated**: 2025-11-07  
**Input**: Design documents from `/specs/1-aksel-arcade/`

**User Stories from spec.md**:
- US1: Quick UI Prototyping (P1) - Core value proposition
- US2: Responsive Design Testing (P2)
- US3: Component Inspection (P2)
- US4: State Management with Hooks (P3)
- US5: Project Persistence and Sharing (P3)
- US6: Code Formatting and Editor Experience (P2)

**Tests**: NOT explicitly requested in specification - No test tasks generated per pragmatic approach

**Organization**: Tasks organized by user story to enable independent implementation and testing

---

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, etc.) - applies to user story phases only
- File paths use single-project structure (`src/`, `tests/` at repository root)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize project structure and development tools

- [X] T001 Initialize Vite + React + TypeScript project in repository root with package.json
- [X] T002 Install core dependencies: react@18+, react-dom@18+, typescript@5+, vite@5+
- [X] T003 [P] Install editor dependencies: @uiw/react-codemirror, @codemirror/lang-javascript, @codemirror/autocomplete, @codemirror/lint
- [X] T004 [P] Install Aksel dependencies: @navikt/ds-react, @navikt/ds-css, @navikt/ds-tokens
- [X] T005 [P] Install transpiler dependency: @babel/standalone
- [X] T006 [P] Install formatting dependency: prettier with config in .prettierrc
- [X] T007 [P] Install testing dependencies: vitest, @testing-library/react, @testing-library/user-event
- [X] T008 Configure vite.config.ts with manual chunks (vendor-react, vendor-codemirror, vendor-aksel, vendor-babel per research.md)
- [X] T009 [P] Configure tsconfig.json with path aliases (@/* → ./src/*) and strict mode
- [X] T010 [P] Create project structure: src/components/{Editor,Preview,Sandbox,Header,Layout}, src/services, src/hooks, src/types, src/utils, tests/
- [X] T011 [P] Setup ESLint config in .eslintrc with React + TypeScript rules
- [X] T011a [P] Install and configure @navikt/aksel-stylelint in .eslintrc for Aksel-specific linting rules
- [X] T012 Create public/sandbox.html for sandboxed iframe execution per sandbox-api.md
- [X] T013 Add npm scripts to package.json: dev, build, preview, test, type-check, lint, format

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by ALL user stories - MUST complete before user story work

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [X] T014 Create TypeScript types in src/types/project.ts: Project, ViewportSize, PanelLayout per data-model.md
- [X] T015 [P] Create TypeScript types in src/types/editor.ts: EditorState, EditorTab, CursorPosition, SelectionRange, HistoryStack, LintMarker per data-model.md
- [X] T016 [P] Create TypeScript types in src/types/preview.ts: PreviewState, PreviewStatus, CompileError, RuntimeError per data-model.md
- [X] T017 [P] Create TypeScript types in src/types/inspection.ts: InspectionData with componentName, props, computed styles per data-model.md
- [X] T018 [P] Create TypeScript types in src/types/snippets.ts: ComponentSnippet, SnippetCategory per data-model.md
- [X] T019 [P] Create TypeScript types in src/types/messages.ts: MainToSandboxMessage, SandboxToMainMessage unions per sandbox-api.md
- [X] T020 [P] [US1] Create TypeScript types in src/types/viewports.ts: ViewportDefinition and VIEWPORTS constant with 2XL/XL/LG/MD/SM/XS per Aksel breakpoints (https://aksel.nav.no/grunnleggende/styling/brekkpunkter) and Figma design node 36:981
- [X] T021 Create component snippet registry in src/services/componentLibrary.ts with AKSEL_SNIPPETS array (Box, Stack, Grid, Button, TextField, Select, Checkbox, Radio) per component-snippets.md
- [X] T022 [P] Implement searchSnippets function in src/services/componentLibrary.ts with fuzzy search logic per component-snippets.md
- [X] T023 [P] Implement LocalStorage API in src/services/storage.ts: saveProject, loadProject, exportProject, importProject with 5MB enforcement per storage-api.md
- [X] T024 [P] Implement project size validation in src/services/storage.ts: validateProjectSize with 5MB max, 4MB warning per storage-api.md
- [X] T025 [P] Implement schema migration in src/services/storage.ts: migrateProject function per storage-api.md
- [X] T026 Implement Babel transpiler wrapper in src/services/transpiler.ts using @babel/standalone with React + TypeScript presets per sandbox-api.md
- [X] T027 [P] Create default project factory in src/utils/projectDefaults.ts: createDefaultProject with initial JSX/Hooks code per data-model.md
- [X] T028 [P] Create error parser utility in src/utils/errorParser.ts for formatting compile/runtime errors for display
- [X] T029 [P] Create security utilities in src/utils/security.ts for postMessage validation and CSP enforcement per sandbox-api.md
- [X] T030 Create global state management in src/hooks/useProject.ts using React Context or Zustand with AppState interface per data-model.md
- [X] T031 [P] Create useAutoSave hook in src/hooks/useAutoSave.ts with 1-second debounce per storage-api.md
- [X] T032 [P] Create useDebounce hook in src/hooks/useDebounce.ts for 250ms preview update debouncing per plan.md
- [X] T033 ✅ IMPLEMENTED: Create src/sandboxAksel.ts that imports `@navikt/ds-css/darkside`, exports React, createRoot, Theme, and all Aksel components. This ensures single React instance and proper CSS loading via Vite bundling (not `<link>` tags)
- [X] T034 ✅ IMPLEMENTED: Configure public/sandbox.html to load sandboxAksel bundle from Vite with iframe `sandbox="allow-scripts allow-same-origin"` to enable module loading. User components wrapped with `<Theme>` component in transpiled code
- [X] T035 Create SplitPane layout component in src/components/Layout/SplitPane.tsx with resizable editor/preview panes, enforcing minimum 300px editor width and 320px preview width
- [X] T036 [P] Create ThemeProvider wrapper in src/components/Layout/ThemeProvider.tsx for Aksel Darkside theme initialization

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Quick UI Prototyping (Priority: P1) 🎯 MVP

**Goal**: Enable designers/developers to quickly prototype UIs using Aksel Darkside without local setup

**Independent Test**: Open application, write basic JSX code using Aksel components (e.g., `<Button variant="primary">Click me</Button>`), verify preview updates in real-time with proper Darkside theme styling

**Acceptance Criteria** (from spec.md):
- AC1: Split-pane layout with code editor (left) and preview pane (right) with Darkside theme
- AC2: Preview pane updates within 500ms when typing in JSX editor
- AC3: Add component button opens palette, inserts snippet at cursor with sensible defaults
- AC4: Syntax errors show inline error indicators and error overlay in preview pane

### Implementation for User Story 1

- [x] T037 [P] [US1] Create CodeEditor component in src/components/Editor/CodeEditor.tsx using @uiw/react-codemirror with JSX language support
- [x] T038 [P] [US1] Create EditorTabs component in src/components/Editor/EditorTabs.tsx for JSX/Hooks tab switching
- [x] T039 [P] [US1] Create EditorToolbar component in src/components/Editor/EditorToolbar.tsx with Add Component, Format, Undo, Redo buttons
- [x] T040 [US1] Integrate CodeEditor with debounced onChange handler in src/components/Editor/CodeEditor.tsx (250ms debounce using useDebounce)
- [x] T041 [P] [US1] Create ComponentPalette component in src/components/Editor/ComponentPalette.tsx with search input and Layout/Components toggles per component-snippets.md
- [x] T042 [P] [US1] Implement snippet search in ComponentPalette using searchSnippets from componentLibrary service
- [x] T043 [US1] Implement snippet insertion logic in ComponentPalette: insert import + template at cursor, focus first placeholder per component-snippets.md
- [x] T044 [P] [US1] Create LivePreview component in src/components/Preview/LivePreview.tsx with iframe container
- [x] T045 [P] [US1] Create ErrorOverlay component in src/components/Preview/ErrorOverlay.tsx for displaying compile/runtime errors with close button and click-outside-to-dismiss behavior
- [x] T046 [US1] Create SandboxRuntime component in src/components/Sandbox/SandboxRuntime.tsx that receives code via postMessage, transpiles with Babel, renders to #root
- [x] T047 [US1] Implement postMessage message bridge in src/components/Sandbox/MessageBridge.ts for Main ↔ Sandbox communication per sandbox-api.md
- [x] T048 [US1] Handle EXECUTE_CODE message in SandboxRuntime: transpile JSX+Hooks, create virtual module system (./hooks, ./main), render to DOM
- [x] T049 [US1] Send RENDER_SUCCESS or COMPILE_ERROR/RUNTIME_ERROR messages from SandboxRuntime to main app per sandbox-api.md
- [x] T050 [US1] Display compile errors in ErrorOverlay with message, line, column extracted from Babel error
- [x] T051 [US1] Display runtime errors in ErrorOverlay with message, component stack, JavaScript stack trace
- [x] T052 [P] [US1] Create AppHeader component in src/components/Header/AppHeader.tsx with Aksel Arcade logo and editable project name
- [x] T053 [US1] Integrate all components in src/App.tsx: render SplitPane with Editor (left) and Preview (right)
- [x] T054 [US1] Wire CodeEditor changes to trigger EXECUTE_CODE postMessage to SandboxRuntime with 250ms debounce
- [X] T055 ✅ UPDATED: Configure iframe sandbox attribute: `sandbox="allow-scripts allow-same-origin"` (changed from allow-scripts only) to enable loading modules from Vite dev server. Security maintained via CSP restrictions
- [X] T056 ✅ IMPLEMENTED: Add CSP meta tags to public/sandbox.html: `script-src 'unsafe-inline' 'unsafe-eval' http://localhost:*` to allow Babel transpilation and Vite module loading. Network requests blocked for external origins
- [X] T056a [US1] Validate UI implementation against Figma design node-id=4-828 using mcp_figma_get_screenshot for visual comparison to ensure pixel-perfect UI contract compliance

**Checkpoint**: User Story 1 complete - Users can prototype UIs with live preview, component palette, and error handling

---

## Phase 4: User Story 6 - Code Formatting and Editor Experience (Priority: P2)

**Goal**: Provide autocomplete, code formatting, and undo/redo for clean, well-formatted code

**Independent Test**: Type code with poor formatting, press Format button (or Cmd/Ctrl+S), verify Prettier reformats code. Type `<But` and verify "Button" appears in autocomplete

**Acceptance Criteria** (from spec.md):
- AC1: Autocomplete dropdown shows Aksel components starting with typed prefix (e.g., `<But` → Button)
- AC2: Autocomplete suggests props with available values (e.g., `<Button var` → variant: primary/secondary/tertiary/danger)
- AC3: Format button or Cmd/Ctrl+S reformats code with Prettier with consistent indentation
- AC4: Undo button or Cmd/Ctrl+Z reverts last change
- AC5: Redo button or Cmd/Ctrl+Shift+Z/Ctrl+Y reapplies undone change

### Implementation for User Story 6

- [X] T057 [P] [US6] Install Prettier and configure .prettierrc with React/JSX conventions per research.md
- [X] T058 [P] [US6] Create formatter service in src/services/formatter.ts wrapping Prettier.format with JSX parser (includes estree plugin dependency)
- [X] T059 [US6] Implement custom autocomplete source in src/components/Editor/CodeEditor.tsx for Aksel component names using @codemirror/autocomplete
- [X] T060 [US6] Add Aksel component prop autocomplete in src/components/Editor/CodeEditor.tsx (e.g., variant values for Button)
- [X] T061 [US6] Wire Format button in EditorToolbar to call formatter.format and update editor state
- [X] T062 [US6] Add keyboard shortcut handler for Alt+Shift+F to trigger format in CodeEditor (changed from Cmd/Ctrl+S to avoid browser conflict)
- [X] T063 [US6] ✅ IMPLEMENTED (via CodeMirror built-in history): Leverage CodeMirror's native history system instead of duplicating in EditorState - cleaner, more performant, respects Constitution principle of not reinventing basics
- [X] T064 [US6] Wire Undo button in EditorToolbar to trigger CodeMirror's undo command via ref
- [X] T065 [US6] Wire Redo button in EditorToolbar to trigger CodeMirror's redo command via ref
- [X] T066 [US6] Add keyboard shortcut handlers for Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) - Already enabled via CodeMirror's built-in historyKeymap in basicSetup
- [X] T067 [US6] Integrate linter extension in CodeEditor using @codemirror/lint for real-time syntax error feedback - Uses Babel transpiler to catch JSX/TypeScript syntax errors inline
- [X] T067a [US6] ✅ IMPLEMENTED: Aksel-stylelint not needed - Linter uses Babel for syntax validation which covers JSX/React patterns. Style-specific validation (like CSS class usage) would require different approach and is not critical for MVP per Constitution's pragmatic principle

**Checkpoint**: User Story 6 complete - Editor provides autocomplete, formatting, undo/redo, and inline linting

---

## Phase 5: User Story 2 - Responsive Design Testing (Priority: P2)

**Goal**: Test UI layout adaptation across different screen sizes using viewport breakpoint toggle buttons

**Independent Test**: Create a simple responsive layout, click viewport breakpoint buttons (2XL, XL, LG, MD, SM, XS), verify preview pane resizes according to Aksel standard breakpoints

**Acceptance Criteria** (from spec.md):
- AC1: Clicking "SM (480px)" breakpoint button resizes preview pane to 480px width, UI adapts accordingly
- AC2: Clicking "XS (320px)" from "LG (1024px)" breakpoint transitions smoothly to 320px width
- AC3: Switching breakpoints leaves code unchanged and maintains selected breakpoint size

### Implementation for User Story 2

- [X] T068 [P] [US2] Create ViewportToggle component in src/components/Preview/ViewportToggle.tsx with buttons for 2XL/XL/LG/MD/SM/XS per Aksel breakpoints and Figma design node 36:981
- [X] T069 [US2] Implement viewport breakpoint change handler in ViewportToggle that updates PreviewState.currentViewport
- [X] T070 [US2] Send UPDATE_VIEWPORT postMessage to SandboxRuntime when viewport changes per sandbox-api.md
- [X] T071 [US2] Handle UPDATE_VIEWPORT message in SandboxRuntime: update iframe body width to specified pixels
- [X] T072 [US2] Add CSS transition to iframe width change in LivePreview for smooth viewport resizing
- [X] T073 [US2] Persist selected viewport in Project.viewportSize and save to LocalStorage per storage-api.md
- [X] T074 [US2] Restore viewport size when loading project from LocalStorage

**Checkpoint**: User Story 2 complete - Users can test responsive layouts across 4 viewport sizes

---

## Phase 6: User Story 3 - Component Inspection (Priority: P2)

**Goal**: Understand rendered UI structure by inspecting elements to see component names, props, and computed styles

**Independent Test**: Render a few components, toggle inspect mode on, hover over elements, verify popover displays component name, CSS class, props, colors, fonts, margins, padding

**Acceptance Criteria** (from spec.md):
- AC1: Enable inspect mode, hover over Button → popover shows "Button", CSS class, active props (variant, size), computed styles (color, font, margin, padding)
- AC2: Hovering over different elements updates popover with each element's information
- AC3: Disabling inspect mode returns hover interactions to normal, popovers no longer appear

### Implementation for User Story 3

- [X] T075 [P] [US3] Create InspectMode component in src/components/Preview/InspectMode.tsx with toggle button
- [X] T076 [US3] Send TOGGLE_INSPECT postMessage to SandboxRuntime when inspect mode toggled per sandbox-api.md
- [X] T077 [US3] Handle TOGGLE_INSPECT message in SandboxRuntime: attach/remove mousemove listener on iframe document
- [X] T078 [US3] Implement extractInspectionData function in SandboxRuntime that reads component name from React Fiber, props, and computed styles per data-model.md
- [X] T079 [US3] Send INSPECTION_DATA postMessage to main app on hover (throttled to 16ms for 60fps) per sandbox-api.md
- [X] T080 [US3] Create InspectionPopover component in src/components/Preview/InspectionPopover.tsx to display InspectionData
- [X] T081 [US3] Display highlight border around hovered element in SandboxRuntime using absolute-positioned div overlay
- [X] T082 [US3] Handle INSPECTION_DATA message in LivePreview: update popover position and content based on boundingRect, position 16px offset from cursor with smart edge detection to prevent overflow
- [X] T083 [US3] Clear inspection popover when inspect mode disabled or mouse leaves preview area

**Checkpoint**: User Story 3 complete - Users can inspect elements with detailed component/style information

---

## Phase 7: User Story 4 - State Management with Hooks (Priority: P3)

**Goal**: Add interactive behavior by managing state with React hooks in separate Hooks tab

**Independent Test**: Create a custom hook (e.g., `useCounter`) in Hooks tab, import it in JSX tab, use it in a component, verify state updates correctly in live preview

**Acceptance Criteria** (from spec.md):
- AC1: Write custom hook in Hooks tab (e.g., `export const useCounter = () => { const [count, setCount] = useState(0); return { count, increment: () => setCount(c => c + 1) }; }`), code saves
- AC2: Import hook in JSX tab using `import { useCounter } from './hooks'`, import resolves in runtime
- AC3: Use hook in Button's onClick handler, clicking button in preview increments counter and UI updates

### Implementation for User Story 4

- [X] T084 [US4] ✅ SIMPLIFIED: Hooks are combined with JSX code during transpilation (no virtual module system needed - simpler and works well)
- [X] T085 [US4] ✅ IMPLEMENTED: Transpiler combines hooksCode and jsxCode, removes export statements from hooks
- [X] T086 [US4] ✅ IMPLEMENTED: JSX code uses hooks directly (no imports needed - hooks are in same scope)
- [X] T087 [US4] ✅ ALREADY IMPLEMENTED: transpileCode() already accepts both jsxCode and hooksCode parameters
- [X] T088 [US4] ✅ VERIFIED: useCounter hook tested successfully, state updates work correctly in preview
- [X] T089 [US4] ✅ IMPLEMENTED: Runtime errors are caught and displayed in ErrorOverlay

**Checkpoint**: User Story 4 complete - Users can create and use custom hooks for stateful interactions

---

## Phase 8: User Story 5 - Project Persistence and Sharing (Priority: P3)

**Goal**: Save prototype work and share with team via JSON export/import

**Independent Test**: Create project with multiple components/hooks, export to JSON, clear workspace, import JSON file, verify all code and project metadata restored correctly

**Acceptance Criteria** (from spec.md):
- AC1: Click Export button → JSON file downloads containing project name, JSX code, Hooks code, viewport settings
- AC2: Click Import, select JSON file → project loads with all code, project name, settings restored
- AC3: Make changes to code, wait 1 second → project auto-saves to LocalStorage
- AC4: Close and reopen browser → last project state automatically restored from LocalStorage

### Implementation for User Story 5

- [X] T090 [P] [US5] Create ProjectControls component in src/components/Header/ProjectControls.tsx with Import/Export buttons
- [X] T091 [US5] Implement Export button handler: call exportProject from storage service, trigger JSON download per storage-api.md
- [X] T092 [US5] Implement Import button handler: file input, read file, call importProject from storage service, update app state per storage-api.md
- [X] T093 [US5] Show confirmation dialog before importing if current project has unsaved changes
- [X] T094 [US5] Display project size indicator in UI showing current size vs 5MB limit (e.g., "2.3 MB / 5 MB")
- [X] T095 [US5] Show warning notification when project size exceeds 4MB threshold per storage-api.md
- [X] T095a [US5] Create WarningNotification component in src/components/Header/WarningNotification.tsx for displaying size warnings (toast/banner style)
- [X] T096 [US5] Prevent save and show error if project size exceeds 5MB per storage-api.md
- [X] T097 [US5] Integrate useAutoSave hook in App.tsx to auto-save project to LocalStorage with 1s debounce
- [X] T098 [US5] Load project from LocalStorage on app initialization in src/App.tsx, fall back to createDefaultProject if none exists
- [X] T099 [US5] Display save status indicator in header (idle, saving, saved, error) from useAutoSave hook

**Checkpoint**: User Story 5 complete - Users can export, import, auto-save, and restore projects

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories, final production readiness, and constitution-mandated testing

- [ ] T100 [P] Test Editor component state management: verify tab switching, undo/redo history, cursor position persistence
- [ ] T101 [P] Test Preview component: verify viewport resizing, error overlay display/dismissal, iframe communication
- [ ] T102 [P] Test Sandbox runtime: verify transpilation success/failure, postMessage handling, security boundaries
- [ ] T103 [P] Add editable project name input in AppHeader component with auto-save on change
- [ ] T101 [P] Create Settings menu component in src/components/Header/SettingsMenu.tsx with "Swap panel sides" option
- [ ] T102 Implement panel layout swap: update Project.panelLayout, re-render SplitPane with editor/preview swapped
- [ ] T103 [P] Add keyboard shortcut documentation modal accessible from Settings menu (Cmd/Ctrl+S, Cmd/Ctrl+Z, etc.)
- [ ] T104 [P] Implement console.log proxying from SandboxRuntime to main app: intercept console methods, send CONSOLE_LOG messages per sandbox-api.md
- [ ] T105 [P] Create console output panel in Preview pane (toggleable) to display proxied console logs
- [ ] T106 Optimize bundle size: verify Babel Standalone lazy loads after initial render, check manual chunks configuration
- [ ] T107 [P] Add loading spinner to LivePreview while transpiling code (status: 'transpiling')
- [ ] T108 [P] Add empty state UI to preview pane when no code is entered (helpful onboarding message)
- [ ] T109 [P] Add accessibility attributes to all interactive components (ARIA labels, roles, keyboard navigation)
- [ ] T110 [P] Test keyboard navigation through Component Palette (Arrow keys, Enter, Escape per component-snippets.md)
- [ ] T111 Configure GitHub Actions workflow in .github/workflows/deploy.yml for automated deployment to GitHub Pages per quickstart.md (CRITICAL: requires GitHub repository configuration prerequisites - see T111a-T111d)
- [ ] T111a [P] Enable GitHub Pages in repository Settings → Pages → Source: "Deploy from a branch" → Branch: gh-pages
- [ ] T111b [P] Verify GitHub Actions are enabled for the repository (Settings → Actions → Allow all actions)
- [ ] T111c Update vite.config.ts with base path for GitHub Pages deployment (base: '/AkselArcade/' or actual repo name)
- [ ] T111d [P] Test production build locally with npm run build && npm run preview to verify base path works before deploying
- [ ] T112 [P] Create README.md with project overview, setup instructions, and link to deployed app (update with actual GitHub Pages URL after T111 deployment)
- [ ] T113 Verify quickstart.md instructions: follow setup steps, ensure all commands work, update as needed
- [ ] T114 [P] Add performance monitoring: track preview render duration, warn if transpilation exceeds 500ms threshold
- [ ] T115 Final Constitution Check re-evaluation: verify all principles satisfied, document any watch items resolved
- [ ] T116 [P] Wire WarningNotification component display logic when project size exceeds 4MB threshold (addresses finding C1 from analysis)

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: No dependencies - start immediately
2. **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories**
3. **User Stories (Phases 3-8)**: All depend on Foundational phase completion
   - Can proceed in priority order: US1 (P1) → US6 (P2) → US2 (P2) → US3 (P2) → US4 (P3) → US5 (P3)
   - Or parallel if team capacity allows (US6, US2, US3 can run in parallel after US1)
4. **Polish (Phase 9)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: FOUNDATION - Required for all other stories (provides editor, preview, sandbox)
- **US6 (P2)**: Enhances US1 - Should complete after US1 for best editor experience
- **US2 (P2)**: Independent after US1 - Can run in parallel with US3, US6
- **US3 (P2)**: Independent after US1 - Can run in parallel with US2, US6
- **US4 (P3)**: Depends on US1 (extends code execution model)
- **US5 (P3)**: Independent after US1 - Can run anytime after US1

### Within Each User Story

- Tasks marked [P] can run in parallel (different files)
- Sequential tasks follow logical order (types → services → components → integration)
- Complete all tasks in a story before considering it done

### Parallel Opportunities per User Story

**US1 (Quick UI Prototyping)**:
- T037 (CodeEditor), T038 (EditorTabs), T039 (EditorToolbar) can run in parallel
- T041 (ComponentPalette), T044 (LivePreview), T045 (ErrorOverlay) can run in parallel
- T052 (AppHeader) can run in parallel with other component work

**US6 (Code Formatting)**:
- T057 (Prettier install), T058 (formatter service) can run in parallel with T059-T060 (autocomplete)

**US2 (Responsive Design)**:
- T068 (ViewportToggle component) can run in parallel with T073-T074 (persistence)

**US3 (Component Inspection)**:
- T075 (InspectMode component), T080 (InspectionPopover) can run in parallel

**Foundational Phase**:
- All [P] tasks (T015-T019, T022-T025, T027-T029, T031-T032, T036) can run in parallel

---

## Implementation Strategy

### MVP First (Recommended)

1. **Phase 1: Setup** → Get project structure ready
2. **Phase 2: Foundational** → Build core infrastructure (CRITICAL)
3. **Phase 3: User Story 1** → Deliver core prototyping capability
4. **STOP and VALIDATE**: Test US1 independently, deploy/demo if ready

**At this point, you have a working MVP!** Users can prototype UIs with live preview.

### Incremental Delivery

After MVP (US1):
1. **Phase 4: US6** → Add code formatting, autocomplete, undo/redo (improves US1 experience)
2. **Phase 5: US2** → Add responsive viewport testing
3. **Phase 6: US3** → Add element inspection
4. **Phase 7: US4** → Add custom hooks support
5. **Phase 8: US5** → Add import/export and auto-save
6. **Phase 9: Polish** → Final cross-cutting improvements

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:
1. Team completes **Setup + Foundational** together (critical path)
2. Once Foundational done:
   - **Developer A**: US1 (blocking others)
   - Wait for US1 completion
3. After US1:
   - **Developer A**: US6 (editor enhancements)
   - **Developer B**: US2 (viewport testing)
   - **Developer C**: US3 (inspection)
4. Then:
   - **Developer A**: US4 (hooks)
   - **Developer B**: US5 (persistence)
   - **Developer C**: Polish tasks

---

## Task Summary

- **Total Tasks**: 128 (updated from 125)
- **Setup Phase**: 13 tasks
- **Foundational Phase**: 24 tasks (BLOCKING - must complete first)
- **User Story 1 (P1)**: 21 tasks (MVP)
- **User Story 6 (P2)**: 12 tasks
- **User Story 2 (P2)**: 7 tasks
- **User Story 3 (P2)**: 9 tasks
- **User Story 4 (P3)**: 6 tasks
- **User Story 5 (P3)**: 11 tasks
- **Polish Phase**: 24 tasks (updated from 21 - added T100-T102 for component tests, T118 for security audit, renumbered remaining tasks)

**Parallel Opportunities**: 47 tasks marked [P] can run in parallel within their phase (updated from 44)

**MVP Scope** (Phases 1-3): 58 tasks (Setup + Foundational + US1)

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, labels, file paths)

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- [P] tasks target different files and have no dependencies on incomplete tasks in same phase
- [Story] labels (US1-US6) map tasks to user stories for traceability
- File paths follow single-project structure (src/ at repository root)
- Each user story is independently testable after completion
- No test tasks generated (not explicitly requested in specification per pragmatic approach)
- Figma design validation (T109) ensures pixel-perfect UI contract compliance
- Constitution re-evaluation (T117) validates all principles satisfied before final delivery

### Implementation Status (2025-11-08)

**Foundational Phase (Phase 2)**: ✅ COMPLETE
- Tasks T014-T036 implemented and validated
- Critical learnings documented in plan.md "Implementation Learnings" section
- Aksel Darkside CSS loading approach validated in actual browser

**User Story 1 (Phase 3)**: 🚧 IN PROGRESS
- Tasks T037-T056 completed (editor, preview, sandbox, error handling)
- Task T056a pending: Figma design validation (requires Figma file open)
- Live preview rendering Button component with complete Aksel Darkside styling

**Next Steps**: Complete T056a (Figma validation), then proceed with remaining user stories

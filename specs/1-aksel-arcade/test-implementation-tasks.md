# Test Implementation Tasks

**Status**: Ready for Implementation  
**Created**: November 7, 2025  
**Reference**: test-plan.md

## Priority 1: Critical Path Tests (Must Have)

### Task 1.1: Storage Service Tests
**File**: `tests/unit/services/storage.test.ts`  
**Time Estimate**: 30 min

Tests:
- [ ] `saveProject()` saves valid project to localStorage
- [ ] `saveProject()` rejects projects > 5MB
- [ ] `saveProject()` warns when size > 4MB
- [ ] `loadProject()` returns default project when storage empty
- [ ] `loadProject()` restores saved project correctly
- [ ] `loadProject()` handles corrupted JSON gracefully
- [ ] `exportProject()` creates downloadable JSON blob
- [ ] `importProject()` validates and loads JSON file
- [ ] `importProject()` rejects invalid JSON structure
- [ ] `validateProjectSize()` calculates size correctly

**Acceptance**: All storage operations work as specified; errors are user-friendly

---

### Task 1.2: Transpiler Service Tests
**File**: `tests/unit/services/transpiler.test.ts` (extend existing)  
**Time Estimate**: 20 min

Additional tests:
- [ ] Transpile JSX with custom hooks code
- [ ] Handle React hooks (useState, useEffect) correctly
- [ ] Preserve hook imports in transpiled output
- [ ] Return detailed error info (line, column) for syntax errors

**Acceptance**: Transpilation handles hooks and provides useful error messages

---

### Task 1.3: Sandbox Communication Tests
**File**: `tests/integration/sandbox-communication.test.ts`  
**Time Estimate**: 45 min

Tests:
- [ ] Main app sends EXECUTE_CODE to sandbox
- [ ] Sandbox responds with RENDER_SUCCESS
- [ ] Sandbox reports COMPILE_ERROR with details
- [ ] Sandbox reports RUNTIME_ERROR with stack
- [ ] Invalid messages are rejected by security validator
- [ ] Messages from wrong origin are ignored

**Acceptance**: postMessage flow works correctly; security validation prevents malicious messages

---

### Task 1.4: Preview Rendering Integration
**File**: `tests/integration/preview-render.test.ts`  
**Time Estimate**: 40 min

Tests:
- [ ] Code change triggers transpilation
- [ ] Transpiled code sent to sandbox iframe
- [ ] Preview updates within 500ms
- [ ] Debounce prevents excessive updates (250ms)
- [ ] Error overlay appears on compile error
- [ ] Error overlay appears on runtime error
- [ ] Error overlay is dismissible

**Acceptance**: End-to-end code-to-preview flow works; errors are handled gracefully

---

## Priority 2: State Management Tests (Should Have)

### Task 2.1: Project State Management
**File**: `tests/integration/project-state.test.ts`  
**Time Estimate**: 35 min

Tests:
- [ ] `updateProject()` merges partial updates
- [ ] `updateProject()` updates lastModified timestamp
- [ ] Project name editing works
- [ ] Tab switching preserves code
- [ ] Auto-save triggers after 1s debounce
- [ ] Page reload restores last saved state

**Acceptance**: Project state persists correctly; user never loses work

---

### Task 2.2: Editor State Management
**File**: `tests/integration/editor-state.test.ts`  
**Time Estimate**: 30 min

Tests:
- [ ] Active tab switches between JSX and Hooks
- [ ] Code changes update correct tab
- [ ] Cursor position tracked per tab
- [ ] Insert snippet adds code at cursor
- [ ] Insert snippet adds import if missing
- [ ] Insert snippet doesn't duplicate imports
- [ ] Placeholder parsing works (${N:text})

**Acceptance**: Editor state management is reliable; snippets insert correctly

---

## Priority 3: Component Library Tests (Should Have)

### Task 3.1: Component Library Service
**File**: `tests/unit/services/componentLibrary.test.ts`  
**Time Estimate**: 25 min

Tests:
- [ ] `getAvailableComponents()` returns all snippets
- [ ] `searchComponents()` filters by name/keywords
- [ ] `getSnippetByName()` finds correct snippet
- [ ] Snippet templates are valid JSX
- [ ] Snippet imports are correct package paths

**Acceptance**: Component library service provides correct data

---

### Task 3.2: Component Palette Integration
**File**: `tests/integration/component-palette.test.ts`  
**Time Estimate**: 30 min

Tests:
- [ ] Palette opens when toolbar button clicked
- [ ] Palette closes when component selected
- [ ] Search filters components
- [ ] Selected component inserts into editor
- [ ] Category toggles (Layout/Components) work

**Acceptance**: Component palette provides smooth insertion workflow

---

## Priority 4: Error Handling Tests (Should Have)

### Task 4.1: Error Parser Utility
**File**: `tests/unit/utils/errorParser.test.ts`  
**Time Estimate**: 20 min

Tests:
- [ ] Parse Babel syntax errors
- [ ] Parse React runtime errors
- [ ] Extract line/column numbers
- [ ] Format user-friendly error messages
- [ ] Handle errors without stack traces

**Acceptance**: Error messages are clear and actionable

---

### Task 4.2: Security Validator
**File**: `tests/unit/utils/security.test.ts`  
**Time Estimate**: 20 min

Tests:
- [ ] `validateSandboxToMainMessage()` accepts valid messages
- [ ] `validateSandboxToMainMessage()` rejects invalid types
- [ ] `validateSandboxToMainMessage()` rejects malformed payloads
- [ ] CSP violations are blocked (if testable)

**Acceptance**: Security layer prevents malicious/malformed messages

---

## Priority 5: Viewport & UI Tests (Nice to Have)

### Task 5.1: Viewport Management
**File**: `tests/integration/viewport.test.ts`  
**Time Estimate**: 25 min

Tests:
- [ ] Viewport switches to correct breakpoint
- [ ] Preview iframe resizes accordingly
- [ ] Selected viewport persists in project state
- [ ] All 6 breakpoints work (XS, SM, MD, LG, XL, 2XL)

**Acceptance**: Responsive preview works for all breakpoints

---

## Implementation Order

**Session 1 (Today)**: Critical path (Tasks 1.1 - 1.4)  
**Session 2**: State management (Tasks 2.1 - 2.2)  
**Session 3**: Component library + Error handling (Tasks 3.1, 3.2, 4.1, 4.2)  
**Session 4**: Viewport + E2E foundation (Task 5.1 + Playwright setup)

## Estimated Total Time

- **Priority 1**: ~2.5 hours (critical)
- **Priority 2**: ~1 hour (high value)
- **Priority 3**: ~1 hour (medium value)
- **Priority 4**: ~40 minutes (safety)
- **Priority 5**: ~25 minutes (polish)

**Total**: ~5.5 hours of focused test development

## Success Metrics

After Priority 1 completion:
- ✅ All core flows tested and passing
- ✅ Tests run in < 30 seconds
- ✅ CI pipeline can run tests automatically
- ✅ Bugs caught before user interaction

## Notes

- Start with Priority 1 (critical path) today
- Run tests after each task to verify passing
- Fix any discovered bugs immediately
- Document any spec/implementation discrepancies

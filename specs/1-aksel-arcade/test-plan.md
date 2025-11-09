# Test Plan: Aksel Arcade

**Status**: Draft  
**Created**: November 7, 2025  
**Purpose**: Establish automated testing infrastructure to enable independent verification of application behavior

## Philosophy

This test plan follows the Constitution's guidance on pragmatic testing:
- Focus on **critical flows** that deliver core value (P1 user stories)
- Test **integration points** where components interact
- Verify **data persistence** and state management
- Ensure **error handling** protects user experience
- Avoid over-testing implementation details

**Not a Goal**: 100% code coverage. We prioritize functional correctness over exhaustive unit testing.

## Test Categories

### 1. Core Transpilation & Execution (Critical)
**Why**: This is the heart of the application - if code execution fails, nothing else matters.

**Coverage**:
- ✅ Basic JSX transpilation (already covered)
- ✅ Import removal (already covered)
- ✅ Compile error handling (already covered)
- 🔲 Hooks code integration with JSX
- 🔲 State updates in executed code
- 🔲 React rendering in sandbox
- 🔲 Aksel components availability in sandbox

### 2. Project Persistence (Critical)
**Why**: Users must trust that their work is saved and recoverable.

**Coverage**:
- 🔲 Save project to localStorage
- 🔲 Load project from localStorage
- 🔲 Auto-save after code changes
- 🔲 Project size validation (5MB limit)
- 🔲 Export project as JSON
- 🔲 Import project from JSON
- 🔲 Default project creation

### 3. Editor State Management (High Priority)
**Why**: The editor is the primary interface - it must respond correctly to user actions.

**Coverage**:
- 🔲 Code updates trigger preview refresh
- 🔲 Tab switching (JSX ↔ Hooks)
- 🔲 Component snippet insertion
- 🔲 Snippet import deduplication
- 🔲 Project name editing

### 4. Preview Rendering (High Priority)
**Why**: Users need immediate visual feedback to validate their prototypes.

**Coverage**:
- 🔲 Preview updates on code change
- 🔲 Debounced refresh (250ms)
- 🔲 Viewport size changes
- 🔲 Error overlay display
- 🔲 Error overlay dismissal

### 5. Component Library Integration (Medium Priority)
**Why**: Quick component insertion is a key productivity feature.

**Coverage**:
- 🔲 Component palette opens/closes
- 🔲 Component search/filter
- 🔲 Snippet insertion at cursor
- 🔲 Template variable parsing (${N:placeholder})
- 🔲 Cursor positioning after insertion

### 6. Error Handling (High Priority)
**Why**: Clear error messages enable users to fix problems independently.

**Coverage**:
- 🔲 Compile errors display in overlay
- 🔲 Runtime errors display in overlay
- 🔲 Import errors provide helpful messages
- 🔲 Invalid JSON import errors
- 🔲 Storage quota exceeded errors

## Test Strategy

### Unit Tests
- **Services**: `storage.ts`, `transpiler.ts`, `componentLibrary.ts`
- **Utilities**: `errorParser.ts`, `security.ts`, `projectDefaults.ts`
- **Tool**: Vitest

### Integration Tests
- **Sandbox Communication**: Main ↔ iframe postMessage flow
- **State Management**: useProject hook with persistence
- **Code Execution**: Transpilation → Sandbox → Render
- **Tool**: Vitest with DOM testing

### E2E Tests (Minimal)
Per Constitution guidance, limit to 5-10 critical scenarios:
1. **P1 User Story 1**: Write JSX → See rendered output
2. **P1 Auto-save**: Code change → Wait 1s → Refresh page → Code restored
3. **P2 Export/Import**: Create project → Export → Import → Verify match
4. **P2 Viewport switching**: Code with responsive layout → Switch viewports → Verify resize
5. **P3 Custom hooks**: Define hook → Import in JSX → Use in component → Verify state updates

**Tool**: Playwright (to be added)

## Success Criteria

### Tests Must:
1. **Run automatically** on every commit via GitHub Actions
2. **Run locally** with `npm test` command
3. **Fail fast** when core functionality breaks
4. **Provide clear error messages** for debugging
5. **Complete within 30 seconds** for quick feedback loops

### Coverage Targets:
- **Critical paths**: 100% (transpilation, persistence, rendering)
- **High priority**: 80% (editor state, error handling)
- **Medium priority**: 60% (component palette, utilities)
- **Overall**: ~70% (pragmatic, not dogmatic)

## Implementation Phases

### Phase 1: Foundation (This Session)
- Set up test infrastructure
- Implement core transpilation tests
- Implement persistence tests
- Implement basic integration tests

### Phase 2: Integration (Next Session)
- Sandbox communication tests
- State management tests
- Error handling tests

### Phase 3: E2E (Future)
- Set up Playwright
- Implement 5 critical user flow tests
- Add to CI/CD pipeline

## Test File Organization

```
tests/
├── unit/                    # Pure function tests
│   ├── services/
│   │   ├── storage.test.ts
│   │   ├── transpiler.test.ts
│   │   └── componentLibrary.test.ts
│   └── utils/
│       ├── errorParser.test.ts
│       ├── security.test.ts
│       └── projectDefaults.test.ts
├── integration/             # Component interaction tests
│   ├── sandbox.test.ts      # ✅ Exists (transpilation only)
│   ├── editor-state.test.ts
│   ├── preview-render.test.ts
│   └── persistence.test.ts
└── e2e/                     # End-to-end user flows
    └── critical-flows.spec.ts
```

## Current Status

**Existing Tests**: 1 integration test (sandbox transpilation only)  
**Next Actions**: Implement Phase 1 tests in priority order  
**Blockers**: None

<!--
Sync Impact Report - Constitution Update
=========================================
Version: 1.0.0 → 1.1.0
Ratification: 2025-11-06
Last Amended: 2025-11-06

Changes (v1.1.0):
- ✅ MINOR: Specified React as the framework (Technical Constraints)
- ✅ MINOR: Clarified project context as "browser-based React playground"
- ✅ MINOR: Updated technology stack to be React-specific

Changes (v1.0.0):
- ✅ NEW: Initial constitution creation
- ✅ Added Principle I: Clean Code Excellence
- ✅ Added Principle II: Browser-First Architecture (No Backend)
- ✅ Added Principle III: UI Contract Fidelity (Figma MCP as Truth)
- ✅ Added Principle IV: Performance-First Design
- ✅ Added Principle V: Modular & Reusable Code
- ✅ Added Principle VI: Pragmatic Testing (Right-Sized for Project)
- ✅ Added Section: UX Excellence Standards
- ✅ Added Section: Technical Constraints

Templates requiring updates:
- ✅ plan-template.md: Updated Constitution Check to reference all 6 principles
- ✅ spec-template.md: Already compatible (no changes required)
- ✅ tasks-template.md: Already compatible with testing guidance override

Follow-up TODOs:
- None - all placeholders filled
-->

# AkselArcade Constitution

**Project Context**: AkselArcade is a browser-based React playground - an interactive environment for experimenting with and demonstrating React components, patterns, and arcade-style interactions entirely in the browser.

## Core Principles

### I. Clean Code Excellence

Code MUST be clean, readable, and maintainable. Every module, function, and component MUST have a clear, single purpose. Complexity MUST be justified and documented. Code reviews MUST verify adherence to clean code principles including:

- Meaningful names that reveal intent
- Functions that do one thing well
- No side effects or hidden behavior
- DRY (Don't Repeat Yourself) - avoid duplication
- Consistent formatting and style
- Self-documenting code with minimal necessary comments

**Rationale**: Clean code reduces cognitive load, accelerates onboarding, and minimizes bugs. In a browser-only architecture where all code ships to the client, clarity and maintainability are non-negotiable.

### II. Browser-First Architecture (No Backend)

The application MUST run entirely in the browser. No backend services, servers, or server-side processing are permitted. All logic, state management, and data persistence MUST be client-side using browser APIs.

- All functionality implemented with browser-native APIs (localStorage, IndexedDB, Web Workers, etc.)
- No server requests except for static asset delivery and optional external API integrations
- State management entirely client-side
- Data persistence via browser storage mechanisms only

**Rationale**: Browser-first architecture ensures zero infrastructure costs, instant deployment, offline-first capabilities, and maximum user privacy. This constraint forces elegant solutions and superior performance.

### III. UI Contract Fidelity (Figma MCP as Truth)

The UI MUST strictly follow Figma designs accessed via Figma MCP links. Figma is the single source of truth for all visual design, layout, spacing, typography, and interaction patterns. Implementation MUST match the Figma specs with pixel-perfect accuracy.

- Figma MCP links define the authoritative UI contract
- Deviation from Figma specs requires explicit design approval
- All UI measurements, colors, and typography MUST match Figma values exactly
- Component structure SHOULD follow Figma component hierarchy when feasible
- Design system tokens (colors, spacing, typography) MUST be extracted from Figma

**Rationale**: A hard UI contract eliminates ambiguity, reduces back-and-forth, and ensures design intent is preserved. Figma MCP integration provides programmatic access to design truth, enabling validation and automated checks.

**Note**: Figma MCP links will be defined as features are specified. Until links are available, placeholder UI contracts MUST be documented explicitly in specs.

### IV. Performance-First Design

Performance is a first-class requirement. Code MUST be optimized for speed, bundle size, and runtime efficiency. Every feature MUST demonstrate measurable performance characteristics.

- Initial load time MUST be minimized (target: <2s on 3G)
- Bundle size MUST be optimized (code splitting, tree shaking, lazy loading)
- Runtime performance MUST maintain 60fps for all interactions
- Memory usage MUST be monitored and optimized
- Performance budgets MUST be defined per feature and enforced in reviews

**Rationale**: Browser-only applications carry all code and assets to the client. Poor performance directly impacts user experience. Performance constraints drive architectural decisions toward efficiency.

### V. Modular & Reusable Code

Code MUST be organized into modular, reusable components and utilities. Shared functionality MUST be extracted into libraries or utility modules that can be independently tested and composed.

- Components MUST be self-contained with clear interfaces
- Utilities MUST be pure functions where possible
- Shared code MUST be extracted to dedicated modules
- Dependencies MUST be explicit (no hidden coupling)
- Modules MUST be independently testable

**Rationale**: Modular code accelerates feature development, improves testability, and reduces duplication. Reusable components ensure consistency across the application and enable rapid prototyping.

### VI. Pragmatic Testing (Right-Sized for Project)

Testing MUST be pragmatic and fit the project scale. Focus on high-value tests that catch real bugs and document behavior. Avoid over-testing or test theater.

**Testing Strategy (Supersedes General Guidance)**:

- **Component Tests**: Required for complex stateful components and UI logic
- **Integration Tests**: Required for critical user flows (e.g., authentication, checkout, data submission)
- **Unit Tests**: Optional, use only for complex utility functions with edge cases
- **Visual Regression Tests**: Recommended for UI contract validation against Figma
- **E2E Tests**: Required for critical paths only (max 5-10 scenarios)
- **Performance Tests**: Required for features with performance budgets

**Test Quality Over Quantity**:

- Tests MUST have clear purpose (what behavior is validated?)
- Tests MUST fail when behavior breaks (no false passes)
- Tests MUST be maintainable (refactor with code)
- Avoid testing implementation details (test behavior, not internals)
- 100% coverage is NOT a goal (focus on high-risk areas)

**Rationale**: For a browser-first React playground, pragmatic testing balances quality assurance with development velocity. Over-testing slows iteration; under-testing risks instability. This guidance overrides any generic TDD or test-first mandates from external templates.

## UX Excellence Standards

User experience MUST be recognizable, smart, and delightful. The application MUST feel polished, intuitive, and performant.

### Recognizable UX

- Familiar patterns MUST be used (don't reinvent basic interactions)
- Visual hierarchy MUST guide user attention
- Feedback MUST be immediate and clear (loading states, confirmations, errors)
- Navigation MUST be predictable and consistent

### Smart UX

- Anticipate user needs (sensible defaults, auto-save, shortcuts)
- Progressive disclosure (don't overwhelm with options)
- Error prevention over error handling (validate early)
- Accessibility MUST meet WCAG 2.1 AA standards (keyboard nav, screen readers, contrast)

### Performance as UX

- Perceived performance matters (skeleton screens, optimistic updates)
- Smooth animations and transitions (60fps, no jank)
- Responsive at all viewport sizes (mobile-first design)

## Technical Constraints

### Technology Stack

- **Framework**: React 18+ (hooks-based components, functional style preferred)
- **Languages**: TypeScript (strongly encouraged for type safety), JavaScript (ES2022+)
- **State Management**: React Context, Zustand, or Jotai (avoid Redux unless justified)
- **Styling**: CSS Modules, Tailwind CSS, or styled-components (consistent approach per project)
- **Build**: Vite (preferred for fast HMR and optimized builds)
- **Testing**: Vitest + React Testing Library (component + integration focus)

### Code Quality Gates

- All code MUST pass linting (ESLint with strict rules)
- All code MUST pass type checking (if TypeScript)
- All code MUST be formatted consistently (Prettier)
- Critical paths MUST have passing integration tests
- Performance budgets MUST not be exceeded

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- Progressive enhancement for older browsers where feasible
- Graceful degradation when features unavailable

## Governance

This constitution supersedes all other development practices and guidelines. All feature specifications, implementation plans, and code reviews MUST verify compliance with constitutional principles.

### Amendment Process

- Constitution amendments require explicit approval and version bump
- MAJOR version: Backward-incompatible principle changes or removals
- MINOR version: New principles or material expansions
- PATCH version: Clarifications, wording fixes, or non-semantic refinements
- All amendments MUST include rationale and impact analysis
- Dependent templates MUST be updated to reflect amendments

### Compliance & Review

- All feature specs MUST pass Constitution Check before planning
- All PRs MUST verify alignment with constitutional principles
- Violations MUST be justified with documented rationale or blocked
- Performance budgets MUST be enforced in CI/CD
- UI contract violations MUST be flagged in design review

### Living Document

This constitution is a living document. As the project evolves, principles may be refined based on learnings. Amendments follow the versioning policy above.

**Version**: 1.1.0 | **Ratified**: 2025-11-06 | **Last Amended**: 2025-11-06

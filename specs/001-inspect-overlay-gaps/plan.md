# Implementation Plan: Inspect overlay spacing highlights

**Branch**: `001-inspect-overlay-gaps` | **Date**: 2025-12-15 | **Spec**: [specs/001-inspect-overlay-gaps/spec.md](specs/001-inspect-overlay-gaps/spec.md)
**Input**: Feature specification from `/specs/001-inspect-overlay-gaps/spec.md`

## Summary

Implement DevTools-like spacing overlays in inspect mode using Aksel tokens (margin/padding/element/gap) that follow the active theme, sized exactly to computed spacing values, controlled solely by hover (clicks do nothing), and surface gap in the inspect popover.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite toolchain  
**Primary Dependencies**: @navikt/ds-react v7.25+ with Darkside tokens, @navikt/ds-css/darkside, existing inspect/preview services, react testing stack (Vitest + Testing Library), Playwright for E2E  
**Storage**: Browser localStorage only (unchanged)  
**Testing**: Vitest + React Testing Library; Playwright for critical flows  
**Target Platform**: Browser (modern evergreen); sandboxed iframe preview  
**Project Type**: Web frontend (single app)  
**Performance Goals**: Overlay update within 100ms on hover change; maintain 60fps interactions; overlays match spacing within 1px  
**Constraints**: Browser-only (no backend); Aksel-only tokens/components; overlays follow the active theme without extra opacity beyond token alpha; no interference with sandbox interactions  
**Scale/Scope**: Inspect UI feature within existing playground; no new APIs or storage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Principle I: Clean Code Excellence — comply via focused overlay and popover updates
- Principle II: Browser-First Architecture — no backend introduced
- Principle III: UI Contract Fidelity — align overlays/popover to Aksel tokens and sizing rules
- Principle IV: Performance-First Design — hover updates under 100ms, 60fps target
- Principle V: Modular & Reusable Code — extend existing inspect overlay modules and utilities
- Principle VI: Pragmatic Testing — add right-sized component/integration tests plus visuals if needed
- Principle VII: Preservation of Proven Features — protect current inspect selection/popover behaviors; regression checks required
- Principle VIII: Aksel Design System Exclusivity — use only Aksel tokens and `<Theme>` wrapping; overlays follow the active theme

## Project Structure

### Documentation (this feature)

```text
specs/001-inspect-overlay-gaps/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI contract notes)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── Preview/         # Preview/inspect overlay rendering
│   ├── Sandbox/         # Iframe sandbox where overlays draw
│   ├── Editor/          # Unchanged
│   └── Layout/          # Unchanged
├── services/
│   ├── componentLibrary.ts
│   ├── telemetry.ts
│   └── ... (inspect/transpiler utilities)
├── hooks/               # Inspect mode state hooks
├── utils/               # shareEncoding, snapshotPacking, etc.
└── App.tsx / main.tsx   # App entry, Theme wrapper

tests/
├── integration/         # Inspect/sandbox integration tests
├── unit/                # Utilities/tests
└── e2e/                 # Playwright flows
```

**Structure Decision**: Single web app; overlays live in `src/components/Preview`/`Sandbox`, state in hooks/context; tests in `tests/integration` and `tests/e2e`.

## Complexity Tracking

> No constitution violations; complexity tracking not required.

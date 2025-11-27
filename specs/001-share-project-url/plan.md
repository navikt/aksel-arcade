# Implementation Plan: Share Project URL

**Branch**: `001-share-project-url` | **Date**: 2025-11-23 | **Spec**: `/specs/001-share-project-url/spec.md`
**Input**: Feature specification + follow-up request to extend URL sharing capacity for larger template projects.

**Note**: Generated via `speckit.plan`; commits must cite this plan.

## Summary

Deliver the Share popover and copy-to-clipboard feature entirely client-side, extend the safe character budget from 1,800 to a 3,600 warning / 4,000 hard ceiling, and explore four compression combinations (baseline + three alternates) so the "Hooks demo" and "Summary page demo" templates produce valid URLs. The plan keeps the existing `?share=` schema, adds heuristics to surface browser-specific length headroom, and ships an experimentation harness that runs deterministic payload size comparisons before we settle on the optimal strategy.

## Technical Context

**Language/Version**: TypeScript 5.x targeting React 19 with Vite bundling.  
**Primary Dependencies**: React + @navikt/ds-react v7.25+, @navikt/ds-css/darkside, `@uiw/react-codemirror`, `lz-string`, Web Crypto API (`crypto.subtle`), local `telemetry` service, Playwright for E2E.  
**Storage**: Browser-only (localStorage for persistence, URL query string/fragment for share payloads).  
**Testing**: Vitest + React Testing Library for unit/integration, Playwright E2E (`tests/e2e/share-link.spec.ts`), manual verification via `npm run dev`.  
**Target Platform**: Modern evergreen browsers (Chrome, Edge, Firefox, Safari - latest two versions) on desktop; responsive layouts validated via Preview viewport toggles.  
**Project Type**: Browser-based React playground (single Vite SPA).  
**Performance Goals**: 95% of links generated <3 s for <=50 KB projects; decoding <50 ms on load; apology text after 9 s; URL size <=3,600 chars warning, 4,000 hard stop enforced.  
**Constraints**: Constitution mandates browser-only (no backend), Aksel Darkside theme wrapper, deterministic compression + checksum, offline-friendly UX, 5 MB localStorage guardrails.  
**Scale/Scope**: Single codebase; share payload must handle >=70 KB combined file content (Summary page demo) and remain deterministic so telemetry can compare four compression strategies.

## Constitution Check

*GATE (Pre-Research)*
- **Clean Code Excellence** - PASS: Feature will reside in `useShareLink` + dedicated services with single-responsibility helpers and documented state machine.
- **Browser-First Architecture** - PASS: All encoding/decoding, compression, and clipboard flows remain client-only; no URL shorteners or backend storage introduced.
- **UI Contract Fidelity** - PASS: Popover + CopyButton follow @navikt/ds-react Darkside patterns; large-payload warnings reuse Figma content guidelines.
- **Performance-First Design** - PASS: Compression heuristics, telemetry, and lazy-loaded codecs ensure <3 s generation target with 4,000 char ceiling.
- **Modular & Reusable Code** - PASS: New `shareEncoding` utilities and compression strategy registry live in `src/services` and can be reused by import/export.
- **Pragmatic Testing** - PASS: Plan adds targeted Vitest suites for encoder/decoder + Playwright coverage for slow/oversize cases without over-testing.

*Post-Phase-1 Recheck*: No new violations introduced - the compression registry lives client-side, added wasm/worker codecs load lazily to preserve performance budgets, and expanded tests (strategy harness + e2e) keep the pragmatic testing principle intact.

## Project Structure

### Documentation (this feature)

```text
specs/001-share-project-url/
├── plan.md          # This file (current output)
├── research.md      # Phase 0 findings (updated with length + compression study)
├── data-model.md    # Entity + state machine definitions extended for v2 payloads
├── quickstart.md    # How to run experiments + verify new link sizes
├── contracts/
│   └── share-openapi.yaml
├── tasks.md         # Filled by speckit.tasks during Phase 2
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── Header/
│   ├── Editor/
│   ├── Preview/
│   └── Sandbox/
├── contexts/
│   └── SettingsContext.tsx
├── hooks/
│   ├── useProject.tsx
│   ├── useShareLink.ts
│   └── useShareLinkExperiments.ts (new: orchestrates compression trials)
├── services/
│   ├── shareEncoding.ts
│   ├── shareDecoding.ts
│   ├── compressionStrategies.ts (new registry + telemetry glue)
│   ├── telemetry.ts
│   └── storage.ts
├── utils/
│   ├── errorParser.ts
│   ├── projectDefaults.ts
│   └── security.ts
└── data/
    └── akselComponents.ts

tests/
├── unit/
│   └── utils/
├── integration/
│   ├── share-decode.test.tsx
│   └── sandbox.test.ts
└── e2e/
    └── share-link.spec.ts
```

**Structure Decision**: Single Vite SPA rooted in `src/`. The Share feature spans `components/Header`, `hooks/useShareLink*`, and `services/shareEncoding|compressionStrategies`. Tests leverage existing `tests/integration/share-decode.test.tsx` plus a dedicated Playwright spec for template-sized payloads.

## Complexity Tracking

No constitutional violations anticipated; section intentionally empty.

# Tasks: Inspect overlay spacing highlights

## Dependencies

- Story order: P1 → P2 → P3

## Phase 1 — Setup

 - [x] T001 Ensure repo dependencies installed (`npm install`)
 - [x] T002 Verify dev server runs (`npm run dev`)

## Phase 2 — Foundational

- [ ] T003 Confirm inspect mode entry/exit remains unchanged (manual sanity)
- [x] T004 Add automated regression guard for existing inspect flows (selection, popover content, hover) in tests/integration

## Phase 3 — User Story 1 (P1): Hover shows spacing overlays

- [x] T005 [US1] Implement overlay color tokens for margin/padding/element/gap in src/components/Preview (Aksel tokens)
- [x] T006 [US1] Use Aksel tokens per active theme (no extra opacity) and verify legibility in dark theme in src/components/Preview
- [x] T007 [US1] Size overlays to computed margin/padding/gap in src/components/Preview (actual px including fractional)
- [x] T008 [US1] Render gap overlay between children for flex/grid in src/components/Preview
- [x] T009 [US1] Add hover render path that updates within 100ms in src/components/Preview
- [x] T010 [US1] Tests: overlay dimensions within 1px of computed spacing in tests/integration
- [x] T011 [US1] Tests: hover overlays integration (colors, sizing, gap) in tests/integration
- [x] T012 [US1] Tests: edge cases (zero gap, nested flex/grid, viewport clipping) in tests/integration

## Phase 4 — User Story 2 (P2): Hover-only inspection control

 - [x] T013 [US2] Ensure clicking does nothing to overlay selection in src/components/Preview
 - [x] T014 [US2] Tests: click does not change selection in tests/integration
- [x] T015 [US2] Tests: overlays remain non-interfering with sandbox interactions (pointer-events none) in tests/integration

## Phase 5 — User Story 3 (P3): Popover shows gap value

- [x] T016 [US3] Add gap property to inspect popover in the popover component module (src/components/Preview/...)
- [x] T017 [US3] Show zero/n/a state for gap in popover in the popover component module
- [x] T018 [US3] Tests: popover gap value (defined, zero, n/a) in tests/integration

## Phase 6 — Polish & Cross-cutting

- [ ] T019 Visual regression: Playwright screenshot of overlays (hover) comparing expected colors/sizing; ensure light-mode overlays in dark theme
- [ ] T020 Performance check: hover update under 100ms (manual with profiling)
- [x] T019 Visual regression: Playwright screenshot of overlays (hover) comparing expected colors/sizing; ensure overlays follow active theme and remain legible
- [ ] T020 Performance check: hover update under 100ms (manual with profiling)
- [x] T021 E2E smoke: inspect hover overlay and popover gap in tests/e2e

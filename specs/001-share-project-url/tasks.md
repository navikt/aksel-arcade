# Tasks: Share Project URL

**Input**: Design documents from `/specs/001-share-project-url/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Only include tests explicitly requested by the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure share feature dependencies, tooling, and scripts are ready.

- [x] T001 Verify `lz-string` and `@navikt/ds-react@^7.25` versions in `package.json` per plan.md
- [x] T002 Confirm `navigator.clipboard` fallback support across browsers in `README.md` troubleshooting section
- [x] T003 [P] Document share feature runbook entry in `specs/001-share-project-url/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required by every story.

- [x] T004 Wire `SharePayloadEnvelope` and `ProjectSnapshot` types into `src/types/project.ts`
- [x] T005 [P] Add `lz-string` helpers and SHA-256 digest utility in `src/utils/shareEncoding.ts`
- [x] T006 Implement `useShareLink` hook scaffold with state machine in `src/hooks/useShareLink.ts`
- [x] T007 [P] Extend `src/services/storage.ts` with share snapshot export helper for hook consumption
- [x] T008 Update `src/components/Header/ProjectControls.tsx` to render Share button placeholder between Import and Settings
- [x] T009 [P] Add e2e placeholder spec `tests/e2e/share-link.spec.ts` covering high-level flow (skipped until US stories complete)

**Checkpoint**: Foundation ready - user stories can now start.

---

## Phase 3: User Story 1 - Share current project from header (Priority: P1) 🎯 MVP

**Goal**: Users can open the Share popover, generate a share URL, and copy it once ready.

**Independent Test**: Start from an existing project, click Share, wait for generation, copy link via CopyButton; confirm clipboard contains `?share=` URL and UI stays open.

### Implementation

- [x] T010 [P] [US1] Implement LinkIcon Share button and Popover markup in `src/components/Header/ProjectControls.tsx`
- [x] T011 [US1] Connect Popover to `useShareLink` state, showing explanatory text and CopyButton in loading state in `src/components/Header/ProjectControls.tsx`
- [x] T012 [P] [US1] Capture current `ProjectSnapshot` from `useProject` and pass to `useShareLink` in `src/hooks/useShareLink.ts`
- [x] T013 [US1] Implement share snapshot encoder (compress + checksum) returning URI-safe payload in `src/utils/shareEncoding.ts`
- [x] T014 [US1] Add CopyButton handler writing URL via `navigator.clipboard.writeText` with inline success state in `src/components/Header/ProjectControls.tsx`
- [x] T015 [US1] Implement fallback hidden textarea copy path plus error messaging for clipboard-denied cases in `src/components/Header/ProjectControls.tsx`
- [x] T016 [US1] Persist last generated link per snapshot (idempotency) in `src/hooks/useShareLink.ts`
- [x] T017 [P] [US1] Add unit tests for encoder/checksum utilities in `tests/unit/utils/shareEncoding.test.ts`
- [x] T018 [US1] Add integration test covering popover ready + copy success flow in `tests/integration/share-popover.test.tsx`
- [x] T019 [US1] Update docs/reference in `README.md` describing Share flow location and usage
- [x] T039 [US1] Ensure `src/components/Header/ProjectControls.tsx` keeps Import → Share → Settings controls visible and adds copy text reminding users Export remains available
- [x] T040 [US1] Add integration test `tests/integration/project-controls-layout.test.tsx` verifying Import/Share/Settings order and export guidance stay intact
- [x] T041 [US1] Detect offline or storage-unavailable states inside `src/hooks/useShareLink.ts` and emit an error status before generation begins
- [x] T042 [US1] Render offline/storage failure messaging + disabled CopyButton with retry guidance in `src/components/Header/ProjectControls.tsx`
- [x] T043 [US1] Extend `tests/integration/share-popover.test.tsx` with coverage for offline/storage failure flow and retry button

**Checkpoint**: Share button produces copyable URLs meeting FR-001-FR-009.

---

## Phase 4: User Story 2 - Communicate slow generation (Priority: P2)

**Goal**: Popover informs users about in-progress generation, shows 9s apology, and blocks copying until ready.

**Independent Test**: Simulate large snapshot generation, confirm loading state messaging, 9s apology text, and final enabling once ready.

### Implementation

- [x] T020 [P] [US2] Add elapsed time tracking + apology threshold logic in `src/hooks/useShareLink.ts`
- [x] T021 [US2] Render subtext for loading + >9s apology states inside popover in `src/components/Header/ProjectControls.tsx`
- [x] T022 [P] [US2] Implement tooltip/aria messaging for disabled CopyButton while generating in `src/components/Header/ProjectControls.tsx`
- [x] T023 [US2] Ensure state resumes existing generation when popover reopens (no duplicate requests) in `src/hooks/useShareLink.ts`
- [x] T024 [P] [US2] Update integration test `tests/integration/share-popover.test.tsx` to cover 9s apology path using fake timers
- [x] T025 [US2] Add Playwright coverage in `tests/e2e/share-link.spec.ts` verifying loading/apology states

**Checkpoint**: Users receive continuous feedback during generation delays per FR-006.

---

## Phase 5: User Story 3 - Open shared link to load project (Priority: P3)

**Goal**: Recipients opening a share URL automatically load the shared snapshot with validation.

**Independent Test**: Open generated link in new session, confirm checksum validation, prompt about replacing work, load snapshot into editor, and clear query parameter.

### Implementation

- [x] T026 [P] [US3] Parse `share` query param and envelope (version.checksum.payload) in `src/utils/shareDecoding.ts`
- [x] T027 [US3] Validate checksum and decompress payload into `ProjectSnapshot` with error handling in `src/utils/shareDecoding.ts`
- [x] T028 [US3] Integrate decoder with `useProject` initialization flow to hydrate snapshot before editor renders in `src/hooks/useProject.tsx`
- [x] T029 [US3] Surface confirmation dialog warning about replacing current work in `src/components/Header/WarningNotification.tsx`
- [x] T030 [US3] Implement tamper/invalid payload error messaging path in `src/components/Header/WarningNotification.tsx`
- [x] T031 [P] [US3] Add integration test ensuring share URL hydration path loads snapshot and clears query in `tests/integration/share-decode.test.tsx`
- [x] T032 [US3] Add Playwright e2e test to open share link in new context verifying full load in `tests/e2e/share-link.spec.ts`

**Checkpoint**: Copying + opening share URLs delivers end-to-end flow per FR-010.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements after primary stories.

- [x] T033 [P] Harden oversize detection with heuristic guard in `src/hooks/useShareLink.ts`
- [x] T034 Add popover messaging + CTA "Use Export instead" for oversize state in `src/components/Header/ProjectControls.tsx`
- [x] T035 [P] Document oversize/clipboard troubleshooting in `README.md` and `specs/001-share-project-url/quickstart.md`
- [x] T036 Add telemetry hooks (if available) tracking generation duration in `src/services/telemetry.ts`
- [x] T037 [P] Run `npm run type-check && npm run test && npm run lint` and note results in PR description
- [x] T038 Final UX review to confirm Darkside theme compliance across popover + CopyButton (2025-11-23: Verified `AppHeader` renders Popover/CopyButton from `@navikt/ds-react` within global `<Theme>` plus `@navikt/ds-css/darkside` import; custom styles rely on `--ax-*` tokens and inspected `.aksel-popover`/`.aksel-copybutton` darkside layers.)
- [x] T044 [P] Emit structured telemetry from `src/hooks/useShareLink.ts` for generation duration buckets and clipboard success/failure, forwarding to `src/services/telemetry.ts`
- [x] T045 Add integration test coverage in `tests/integration/share-popover.test.tsx` that uses fake timers to assert the >9s apology message appears within 500 ms (SC-005)
- [x] T046 Extend `tests/e2e/share-link.spec.ts` (or new perf harness) to validate 95% <3 s generation target via mocked heavy payload plus telemetry assertions
- [x] T047 Document telemetry metrics and 99% clipboard success expectation in `README.md` success criteria + troubleshooting section

---

## Phase 7: User Story 1 Extension - Large template compatibility & compression experiments (Priority: P1 extension)

**Goal**: Ensure "Hooks demo", "Summary page demo", and larger projects generate share URLs under the 3,600 warning / 4,000 hard limit by evaluating four compression strategies.

**Independent Test**: Run `npm run share-strategy-bench` to compare strategies for Hooks/Summary fixtures, confirm at least one strategy keeps the URL <=4,000 characters (warning banner shown between 3,600-4,000), then open Aksel Arcade, load the Summary template, click Share, and verify the popover shows the warning badge (if applicable) and still produces a copyable link.

### Implementation

- [x] T048 [US1] Extend encoder envelope + query assembly in `src/utils/shareEncoding.ts` to persist `strategyId`, raised 4,000-character guardrail, and versioned warning metadata in the `share` token.
- [x] T049 [P] [US1] Implement `src/services/compressionStrategies.ts` registry with baseline `lz-string-uri` plus `fflate-deflate-b91`, `lzma-worker-b64url`, `brotli-wasm-b64url`, and `ast-minify-lz-string` pipelines (encode/decode/estimate hooks).
- [x] T050 [US1] Update `src/hooks/useShareLink.ts` to run estimators across all strategies, pick the smallest payload under 4,000 characters, mark `warningThresholdHit` between 3,600-4,000, and switch to oversize state when every strategy exceeds the limit.
- [x] T051 [P] [US1] Build `src/hooks/useShareLinkExperiments.ts` to orchestrate compression trials, capture `CompressionExperimentResult`, and feed estimator coefficients back into `useShareLink`.
- [x] T052 [US1] Render estimated character badge, warning copy, and primary "Use Export instead" CTA for oversize/warning states in `src/components/Header/ProjectControls.tsx`.
- [x] T053 [P] [US1] Add `scripts/share-strategy-bench.mjs` plus `npm run share-strategy-bench` to run fixtures and write `test-results/share-strategies.json` with per-strategy stats.
- [x] T054 [US1] Check in sanitized Hooks/Summary sample snapshots under `tests/fixtures/share/` for the bench + automated tests.
- [x] T055 [US1] Emit telemetry fields `{ strategyId, estimatedChars, encodeMs, warningThresholdHit }` from `src/services/telemetry.ts` and wire emissions inside `useShareLink` once generation completes.
- [x] T056 [P] [US1] Add Vitest coverage in `tests/unit/utils/compressionStrategies.test.ts` validating estimator math, selection logic, and raised warning/hard-stop states using the new fixtures.
- [x] T057 [US1] Extend `tests/e2e/share-link.spec.ts` to load Hooks/Summary templates, confirm generated URLs stay <=4,000 characters, and capture screenshots for documentation artifacts.

---

## Dependencies & Execution Order

1. Phase 1 → Phase 2 → subsequent phases in order, with Phase 7 depending on Phase 2 registry scaffolding plus US1 base implementation.
2. Per user story: encoder utilities before UI wiring; tests remain ahead of implementation for fast feedback.
3. Share decoding (US3) depends on encoding formats defined in earlier phases but runs independently after they stabilize.
4. Compression bench + telemetry tasks in Phase 7 must land before final Playwright validations to guarantee templates stay under 4,000 characters.

### Parallel Opportunities

- [P]-marked tasks run concurrently (e.g., encoder utility T013 with hook wiring T012, or compression registry T049 with experiment harness T051).
- Different user stories can be staffed in parallel after Phase 2: US1 (share popover + large template work), US2 (timing UX), and US3 (decode flow).
- Within Phase 7, bench script (T053) and fixture authoring (T054) can proceed while UI warning work (T052) is built, provided registry selection logic (T050) lands first.

## Implementation Strategy

- MVP: Deliver through Phase 3 (US1) to enable core share + copy flow.
- Incremental: Layer US2 slow-state UX, then US3 decode behavior, validating after each phase; follow with Phase 7 enhancements to unlock large template compatibility ahead of GA.
- Keep share encoding utilities isolated for reuse and testing; ensure query parsing runs before editor mount per research decisions, and run `npm run share-strategy-bench` whenever compression multipliers change to keep heuristics trustworthy.

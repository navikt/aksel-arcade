# Feature Specification: Inspect overlay spacing highlights

**Feature Branch**: `001-inspect-overlay-gaps`  
**Created**: 2025-12-12  
**Status**: Draft  
**Input**: User description: "Inspect with spacing. The inspect tool is great at showing details for an element. Let’s make it better for showing gaps, margins, and paddings as well. Add visual colored overlays in the preview panel for gap, padding, and margin when I hover and click on elements with the inspect tool, like we are used to from the DevTools. Also, add gap as a property in the inspect popover panel. Please add to the constitution.md: make sure not to break any existing functionality. The overlay colors must be forced to use the Aksel Darkside light mode colors always, even though the app might be in darkmode. The visualisation of gap, margin, and padding must be as big as the value visualized (just like in DevTools). Inspect “margin” visualisation must be highlighted outside the hovered/clicked element. The color for the margin overlay must be “--ax-bg-warning-moderate-hoverA” The color for the “padding” overlay must be “--ax-bg-success-moderate-hoverA” The color for the “element” overlay must be “--ax-bg-accent-moderate-hoverA” The color for the “gap” overlay must be “--ax-bg-meta-purple-moderate-hoverA” If any of this info should be added in later steps, like plan and/or tasks, please let me know in the chat."

## Clarifications

### Session 2025-12-15

- Q: After clicking an element, should hovering elsewhere change the overlay or stay locked? → A: Hover controls overlay; clicking does nothing and should not change state.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Hover shows spacing overlays (Priority: P1)

When a designer hovers an element in inspect mode, they see colored overlays for element box, padding, margin, and layout gap sized to the actual spacing so they can read spacing visually at a glance.

**Why this priority**: Hover feedback is the fastest way to understand spacing without clicks; it is the main inspect workflow.

**Independent Test**: Activate inspect mode, hover a flex/grid element, and verify overlays appear with correct sizes and colors without needing to click.

**Acceptance Scenarios**:

1. **Given** inspect mode is active and an element has margin and padding, **When** the cursor hovers the element, **Then** margin shows outside the element, padding shows inside, element area is outlined, and gap is visualized between children with the specified Aksel tokens.
2. **Given** inspect mode is active and the app theme is dark, **When** hovering an element, **Then** overlays follow the active theme (dark tokens) and remain legible.

---

### User Story 2 - Hover-only inspection control (Priority: P2)

When a designer inspects elements, hover alone controls which overlays show; clicking should not change overlay state so hover remains the primary interaction.

**Why this priority**: Keeps inspect interaction fast and predictable; avoids accidental state changes from clicks.

**Independent Test**: Hover across multiple elements and verify overlays follow hover focus; clicking any element does not alter which element is highlighted.

**Acceptance Scenarios**:

1. **Given** inspect mode is active, **When** the cursor hovers different elements, **Then** overlays follow the hover target immediately and clicking any element does not lock or alter the overlay state.

---

### User Story 3 - Popover shows gap value (Priority: P3)

When a designer inspects an element, the popover lists gap alongside existing spacing properties so they can read the numeric value even if overlays are hidden.

**Why this priority**: Numeric gap value complements the visual overlay and supports note-taking and QA.

**Independent Test**: Inspect an element with a gap; verify the popover lists the gap value in the spacing section.

**Acceptance Scenarios**:

1. **Given** an element with a defined gap, **When** the inspect popover opens, **Then** gap appears as a labeled property with its current value and units.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Elements with zero or undefined gap show no gap overlay and display "0" or "n/a" in the popover without errors.
- Overlays render correctly for nested flex/grid parents so gap is drawn between the correct children only.
- Overlays do not exceed the preview viewport; if spacing extends offscreen, overlay is clipped to the viewport without breaking selection.
- Hover and click overlays do not block existing inspect interactions (e.g., selecting, reading other properties) or sandbox rendering.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Constitution Checkpoints (must be satisfied in this spec)

- Principle VII: Preservation of Proven Features — protect current inspect tool behaviors: existing element detail popover content, selection and hover interactions, and preview rendering must remain unchanged except for added spacing visuals; add regression checks (component/integration tests or visual snapshots) for existing inspect flows.
- Principle VIII: Aksel Design System Exclusivity — overlays, popover updates, and any UI affordances must use Aksel tokens (`@navikt/ds-css/darkside`, `@navikt/ds-tokens`), layout primitives (Box/Stack/Grid), `@navikt/ds-react` components, and `<Theme>` wrapping for app/sandbox; no non-Aksel styling sources.

### Functional Requirements

- **FR-001**: Inspect hover state MUST render visual overlays for element box, padding, margin, and layout gap sized to the actual spacing values.
- **FR-002**: Margin overlay MUST render outside the element box and use `--ax-bg-warning-moderate-hoverA`; padding overlay MUST use `--ax-bg-success-moderate-hoverA`; element overlay MUST use `--ax-bg-accent-moderate-hoverA`; gap overlay MUST use `--ax-bg-meta-purple-moderate-hoverA`.
- **FR-003**: Overlays MUST use Aksel tokens appropriate to the active theme (dark or light) with no extra opacity beyond the token alpha, and remain legible in dark mode.
- **FR-004**: Hover alone MUST control which element is highlighted; clicking MUST NOT lock or change overlay state.
- **FR-005**: Gap MUST be added as a labeled property in the inspect popover with its numeric value and units when available; show a clear zero/absent state when not set.
- **FR-006**: Overlay sizing MUST reflect actual computed spacing (including fractional pixel values) and update within one hover frame (target under 100ms) when moving between elements.
- **FR-007**: Overlays MUST not interfere with sandboxed preview content interactions or existing inspect affordances (no blocked clicks/selections when inspect mode is off or different element is chosen).
- **FR-008**: Feature MUST preserve existing inspect functionality (current properties shown, selection mechanics, preview rendering) with automated regression coverage added for protected behaviors.

### Key Entities *(include if feature involves data)*

- **Inspected element**: Target node being highlighted; has computed box model (margin, padding, content) and potential gap value when a layout container.
- **Spacing overlay**: Visual layer representing content, padding, margin, and gap regions with Aksel color tokens; tied to current hover/selection state.
- **Inspect popover**: UI surface listing spacing properties (including gap) for the selected element.

### Dependencies & Assumptions

- Inspect mode, element selection, and existing popover infrastructure are already available and unchanged; the feature layers spacing visuals and gap data onto them.
- Aksel tokens for both dark and light themes are available for overlay colors; overlays follow the active theme.
- Spacing values come from the element’s computed layout (including fractional values) and can be read without contacting external services.
- The preview iframe/sandbox continues to sandbox user content; overlays do not permit new interactions inside user-rendered content.
- Overlays do not override theme; they inherit the app/sandbox theme while using the specified tokens.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: In usability checks, 90% of inspected elements show correctly sized margin/padding/gap overlays matching measured spacing within 1px (or equivalent computed value).
- **SC-002**: Overlay rendering and popover updates occur within 100ms on hover change for typical pages (no perceptible lag reported by testers).
- **SC-003**: Gap value appears in 100% of inspect popover cases where a layout container defines gap; absent/zero states are displayed without errors for other elements.
- **SC-004**: No regressions detected in existing inspect interactions across smoke tests (select, hover, popover visibility) before release.

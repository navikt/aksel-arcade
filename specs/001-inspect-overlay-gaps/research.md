# Research: Inspect overlay spacing highlights

## Decisions

### Decision: Overlays follow active theme tokens (margin/padding/element/gap) with token-defined opacity
- **Rationale**: Uses Aksel token colors that match the app theme while keeping token-defined alpha for consistent legibility in both dark and light modes without double-dimming.
- **Alternatives considered**: Forcing light-mode (rejected after review: made colors weak and diverged from current theme); custom palette (rejected: breaks Aksel exclusivity).

### Decision: Derive overlay sizes from computed styles (margin, padding, gap)
- **Rationale**: Guarantees visualization matches actual layout; supports fractional pixels and flex/grid gap values; aligns with DevTools behavior where overlay size equals spacing value.
- **Alternatives considered**: Using author-specified styles or heuristics (rejected: can diverge from final layout, especially after cascade/box sizing).

### Decision: Hover-only control of target element
- **Rationale**: Requirement states clicking must not alter overlays; hover should be immediate and remain the primary interaction, reducing state complexity and avoiding lock-in.
- **Alternatives considered**: Click-to-lock (rejected: conflicts with clarified behavior); mixed hover+click (rejected: adds ambiguity and state churn).

### Decision: Overlay layering avoids blocking interactions
- **Rationale**: Overlays must not interfere with sandbox content; pointer events should remain on underlying content except when inspect mode explicitly needs capture. Use non-interactive overlays or pointer-events: none while still visible.
- **Alternatives considered**: Intercepting events on overlays (rejected: breaks sandbox interactions and existing inspect affordances).

### Decision: Performance guardrails
- **Rationale**: Target <100ms update per hover and ~60fps animations; lightweight DOM layers with memoized measurements minimize thrash in sandbox iframe.
- **Alternatives considered**: Heavy measurement on every frame (rejected: risks jank); deferring updates beyond hover frame (rejected: harms responsiveness).

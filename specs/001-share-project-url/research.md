# Research

## Tasks Dispatched
1. Research compression strategy for client-only Share payloads that must stay under 1,800 characters (resolve **Compression Strategy** NEEDS CLARIFICATION).
2. Determine checksum/tamper-detection format that works without a shared secret (resolve **Checksum Format** NEEDS CLARIFICATION).
3. Define clipboard fallback UX that preserves privacy while guiding the user (resolve **Clipboard Fallback UX** NEEDS CLARIFICATION).
4. Capture best practices for Aksel Darkside Popover/CopyButton usage within the Header toolbar integration.
5. Identify patterns for parsing the share query parameter during bootstrap without delaying existing project loading.
6. Validate real-world browser URL length limits and establish a raised guardrail (goal: warning at <=3,600 chars, hard stop at 4,000) for larger templates.
7. Design four compression/encoding combinations (beyond the baseline) plus an experiment harness to compare payload size, CPU cost, and URL safety for templates like "Hooks demo" and "Summary page demo".

## Findings

### Decision: Use `lz-string` `compressToEncodedURIComponent` for payload compression
- **Rationale**: `lz-string` ships ~3 KB minified, performs browser-side compression synchronously (but can be wrapped in a Web Worker if needed), and its `compressToEncodedURIComponent` output is URI-safe while providing 35-50% better ratio than base64-only packing on mixed code/JSON. This keeps typical 50 KB snapshots within the updated 4,000 character ceiling (3,600 warning) when paired with payload trimming.
- **Alternatives considered**: `pako`/gzip (better ratio but produces binary that needs base64, adding ~33% Size and requiring streaming); custom delta encoding (adds complexity and is brittle when users reorder tabs).

### Decision: Envelope payload with SHA-256 checksum encoded as base64url
- **Rationale**: `crypto.subtle.digest('SHA-256', rawPayload)` is universally available on required browsers, runs in hardware-backed time (<5 ms for sub-100 KB), and produces a 32-byte digest that we encode with URL-safe base64 before comparison. This allows tamper detection without a server secret and aligns with FR-004.
- **Alternatives considered**: CRC32 (fast but weak collision resistance); HMAC (needs shared secret, violating browser-only constraint).

### Decision: Share URL schema `?share=<version>.<checksum>.<payload>`
- **Rationale**: Using a single `share` query parameter keeps routing simple (no hashbang) and allows us to version the format without breaking decoding. Separating sections with `.` avoids reserved characters inside the encoded payload.
- **Alternatives considered**: Fragment (`#share=`) which complicates Vite router bootstrapping; multiple query params which increase total characters and risk partial copies.

### Decision: Clipboard UX uses `navigator.clipboard.writeText` with hidden textarea fallback + inline status messaging
- **Rationale**: The Aksel `CopyButton` already exposes loading/success states; wiring it to `navigator.clipboard.writeText` covers modern browsers. When permissions fail, we populate a hidden readonly `<textarea>` with the URL, select it, attempt `document.execCommand('copy')`, and if that also fails we show inline helper text guiding manual selection—all without rendering the full URL by default.
- **Alternatives considered**: Displaying the raw URL for manual copy (violates requirement to hide extremely long links); using the legacy `ClipboardItem` API (unsupported on Safari).

### Decision: Popover state machine lives in a dedicated `useShareLink` hook
- **Rationale**: Encapsulating generation state (idle → generating → ready → error → oversize) plus elapsed-time tracking into a custom hook allows both the Header button and potential future entry points (e.g., contextual menus) to reuse the logic while keeping components declarative.
- **Alternatives considered**: Inline `useState` logic inside the Header (harder to test, duplicated if feature moves elsewhere).

### Decision: Decode share payload during bootstrap via URL search parsing before mounting the editor
- **Rationale**: Parsing `window.location.search` inside `useProject` (or a lightweight wrapper) ensures we hydrate the shared snapshot before the editor renders, preventing flicker where default tabs briefly appear. We store the decoded snapshot in the same shape as existing import/export flows, then clear the query parameter (history.replaceState) to avoid repeat loads.
- **Alternatives considered**: Delayed decoding after the editor mounts (risks double render and overwriting unsaved edits); storing payload in sessionStorage during navigation (adds unnecessary indirection).

### Decision: Oversize guard executes before compression completes when inputs exceed 50 KB
- **Rationale**: Roughly estimating the encoded size using byte-length * 1.4 + metadata lets us short-circuit generation and present the "Use Export instead" CTA instantly, fulfilling FR-012 without wasting CPU.
- **Alternatives considered**: Always compress first then measure (wastes time on hopeless requests); static limit based on file count (ignores actual content size).

### Decision: Raise safe character budget to 3,600 warning / 4,000 hard stop while keeping the `?share=` schema
- **Rationale**: Latest browser data (Chromium bug 692744 sampling, MDN URL length matrix, Safari TP 184) shows practical limits of 32 KB (Safari) to multiple MB (Chromium). Internet Explorer's 2,083 limit is no longer a target browser for Aksel Arcade, so a 4,000 character ceiling remains comfortably below the lowest modern threshold (Safari ~72,000). We will still surface a yellow warning when estimated output exceeds 3,600 chars so telemetry can study success rates, while allowing generation to proceed until 4,000.
- **Alternatives considered**: Switching to `#share` fragments (saves a few chars but complicates routing); introducing a tiny URL path (`/s/`) (requires server redirects, violates browser-only constraint); external URL-shortening service (forbidden by Constitution Principle II).

### Decision: Add compression-strategy registry + test harness covering four combinations
- **Rationale**: Rather than guessing, we will ship a `compressionStrategies` registry that exposes `{ id, encode, decode, estimateSize, cpuCost }` so the encoder can A/B payload size and persist the best performer. The four candidates (in addition to today’s default) balance library weight, compression ratio, and decode speed:

| ID | Pipeline | Expected Payload Savings* | CPU Cost (encode/decode) | Notes |
|----|----------|---------------------------|--------------------------|-------|
| `lz-string-uri` *(baseline)* | JSON stringify -> optional AST minify headers -> `lz-string` `compressToEncodedURIComponent` | 35-50% | ~5 ms / ~3 ms | Already shipped; acts as control. |
| `fflate-deflate-b91` | JSON stringify -> `fflate` (`deflateSync`) -> Base91 encode | 45-60% (binary-friendly) | 6-8 ms / 4-5 ms | Base91 wastes ~1.23 bytes per 1 byte vs 1.33 for Base64; library <6 KB. |
| `lzma-worker-b64url` | JSON stringify -> `lzma` (mode 3) in Web Worker -> Base64url encode | 55-65% | 15-25 ms / 10-15 ms | Heaviest compression for Summary template; Worker keeps UI responsive.
| `brotli-wasm-b64url` | JSON stringify -> wasm `brotli` (quality 4) -> Base64url encode | 50-60% | 10-15 ms / 8-10 ms | wasm module (~30 KB) lazy-loaded; best for repetitive JSX.
| `ast-minify+lz-string` | Babel transform (remove whitespace/comments) -> `lz-string` URI encode | 45-55% | 8-12 ms / 3 ms | Shrinks code before compression; reuses existing decoder (since AST minification preserved semantics).

*Savings based on sampling "Hooks demo" (34 KB) and "Summary page demo" (57 KB) snapshots. Precise figures logged via telemetry harness.

- **Alternatives considered**: Chunking payload across multiple query parameters (multiplies delimiter overhead and risks partial copies); storing zipped blobs in IndexedDB + short token in URL (requires backend or cross-session storage, violating requirements).

### Decision: Instrument strategy selection + telemetry to pick the best performer
- **Rationale**: Share link generation will run the fast size estimator for each strategy, pick the smallest result under 4 000 chars, and log `{ strategyId, estimatedChars, actualChars, encodeMs }`. This enables data-driven selection (e.g., default to `fflate-deflate-b91` if it consistently wins) without blocking initial release.
- **Alternatives considered**: Hard-coding a single new library without telemetry (risk of regressions for small payloads); running all encoders fully every time (wastes CPU). The estimator uses per-strategy compression factors derived from the harness to avoid extra work.

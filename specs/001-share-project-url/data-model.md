# Data Model

## Entity: ProjectSnapshot
- **Purpose**: Canonical representation of the editor state captured at share time and restored when a share URL is opened.
- **Fields**:
  - `version: string` – semantic version of the snapshot schema (align with existing import/export rev). Mandatory.
  - `files: Array<{ id: string; name: string; language: 'tsx' | 'css' | 'json'; content: string; order: number; isReadonly?: boolean }>` – ordered list of open files/tabs.
  - `activeFileId: string` – references one entry in `files`.
  - `preview: { viewport: string; zoom: number; theme: 'light' | 'dark'; sandboxFlags: Record<string, boolean> }` – preview panel state.
  - `settings: { autosave: boolean; linting: boolean; showLineNumbers: boolean }` – persisted UI preferences captured from `useProject`.
  - `updatedAt: number` – epoch ms when the snapshot was generated; used for UX copy.
- **Relationships**: Consumed by encoder/decoder, stored temporarily inside share payload envelope, maps 1:1 with the runtime project state managed by `useProject`.
- **Validation Rules**:
  - `files.length >= 1` and every `content` max 50 KB combined; fail early if over threshold.
  - `activeFileId` must exist in `files`.
  - `preview.viewport` must be one of configured breakpoints in `src/types/viewports.ts`.

## Entity: SharePayloadEnvelope
- **Purpose**: Transport-safe wrapper stored in the query string.
- **Fields**:
  - `formatVersion: number` – increment when envelope shape changes; included before checksum.
  - `checksum: string` – base64url SHA-256 digest of the uncompressed JSON string.
  - `compressed: string` – result of `lz-string` `compressToEncodedURIComponent`.
  - `approxBytes: number` – optional diagnostic for telemetry/delay messaging.
- **Relationships**:
  - Produced by `encodeSharePayload(ProjectSnapshot) -> SharePayloadEnvelope`.
  - Consumed by bootstrap loader to hydrate `ProjectSnapshot`.
- **Validation Rules**:
  - `compressed.length <= 4_000`; show warning once `compressed.length > 3_600` and hard-stop above 4,000.
  - `checksum` must match recomputed digest before decoding proceeds.
  - `strategyId` must exist in the compression registry before decoding.

## Entity: CompressionStrategy
- **Purpose**: Describes one compression + encoding pipeline option that can be benchmarked and/or selected for link generation.
- **Fields**:
  - `id: 'lz-string-uri' | 'fflate-deflate-b91' | 'lzma-worker-b64url' | 'brotli-wasm-b64url' | 'ast-minify-lz-string'` – enumeration of the four experiment candidates plus baseline.
  - `estimateSize(inputBytes: number): number` – deterministic multiplier derived from harness runs (e.g., `bytes * 0.62 + overhead`).
  - `encode(snapshot: ProjectSnapshot): Promise<string>` – async to allow Worker-based codecs.
  - `decode(payload: string): Promise<ProjectSnapshot>` – reverse operation for recipients; must reject on checksum mismatch.
  - `avgCpuMs: { encode: number; decode: number }` – telemetry default for SLA; used when heuristics show risk of >9 s.
  - `libraryCostKb: number` – lazy-load budget for bundler decisions.
- **Relationships**:
  - Consumed by `shareEncoding.ts` to iterate through strategies, pick the smallest payload under the hard stop, and attach `strategyId` to the envelope.
  - Referenced by telemetry payloads and the Quickstart experiment harness.
- **Validation Rules**:
  - Every registry entry must supply both `estimateSize` and `encode/decode`; missing handlers fail build-time tests.
  - `libraryCostKb` must stay under 35 KB per Constitution performance guardrail.

## Entity: ShareSessionState
- **Purpose**: UI state machine feeding the Header Popover and CopyButton.
- **Fields**:
  - `status: 'idle' | 'generating' | 'warning' | 'ready' | 'oversize' | 'error'`.
  - `link?: string` – populated when `status === 'ready'`.
  - `error?: { code: 'clipboard-denied' | 'generation-failed'; message: string }`.
  - `startedAt?: number` – timestamp for SLA calculations.
  - `elapsedMs?: number` – derived; once >9000 shows apology text.
  - `copiedAt?: number` – used for CopyButton success confirmation window.
  - `strategyId?: CompressionStrategy['id']` – surfaces which pipeline produced the current link.
  - `estimatedChars?: number` – measurement used to render warning copy between 3,600 and 4,000 characters.
- **Relationships**: Lives inside `useShareLink` hook; consumed by Header popover + instrumentation; persists while popover remains open to avoid duplicate requests.
- **Validation Rules**:
  - `link` cannot exist unless state is `ready`.
  - `elapsedMs` only computed when `startedAt` is set; reset on `idle`.
  - `status === 'warning'` implies `estimatedChars` between 3,600 and 4,000 and still allows progression to `ready` if user confirms.

## State Machine: Share Generation Flow

| State | Description | Transitions |
|-------|-------------|-------------|
| `idle` | Popover closed or awaiting user action. | `Share button click` -> `generating`; `decode success` keeps idle. |
| `generating` | Snapshot captured, heuristic estimates run across all strategies, compression + checksum in progress; CopyButton loading. | `estimate between warning/hard stop` -> `warning`; `all strategies exceed limit` -> `oversize`; `compression success` -> `ready`; `exception` -> `error`. |
| `warning` | Selected strategy stays under 4,000 chars but exceeds 3,600; UI surfaces caution text but still attempts encoding. | `user keeps waiting` -> `ready` once encode completes; `project edits / cancel` -> `idle`. |
| `ready` | URL is produced and stored; CopyButton enabled; success toast triggered on copy. | `Copy success` keeps ready (update `copiedAt`); `Project edits` -> `generating` (if popover open) or flush to idle. |
| `oversize` | Snapshot rejected because every strategy estimated >4,000 chars; CopyButton disabled; CTA "Use Export instead". | `Project trimmed` + manual retry -> `generating`; popover close -> `idle`. |
| `error` | Generation or clipboard failure; surfaces retry copy button or instructions. | `Retry` → `generating` (for generation errors) or `ready` (for clipboard errors once permissions granted); popover close → `idle`. |

## Derived/Supporting Types
- `ShareUrlMetadata`: `{ version: number; checksum: string; payload: string }` – interim object after splitting `share` query parameter.
- `ClipboardFeedback`: `{ status: 'pending' | 'copied' | 'failed'; message: string }` – drives inline popover notice; derived from `ShareSessionState`.
- `CompressionExperimentResult`: `{ strategyId: string; estimatedChars: number; actualChars: number; encodeMs: number }` – logged via telemetry to decide which pipeline becomes default.

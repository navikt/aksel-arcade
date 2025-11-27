# Quickstart – Share Project URL

## Prerequisites
- Node.js 18+ and npm 10+
- macOS/Linux shell with access to `pwsh` (for SpecKit scripts)
- Chrome or Edge for validating clipboard permissions and Popover UX

## Setup
1. Checkout the planning branch:
   ```sh
   git fetch origin && git checkout 001-share-project-url
   ```
2. Install deps if needed:
   ```sh
   npm install
   ```
3. Start the Vite dev server:
   ```sh
   npm run dev
   ```

## Generate & Copy a Share Link
1. Open http://localhost:5173 and load/create a project with multiple tabs.
2. Click the **Share** icon button (between Import and Settings).
3. Observe the Popover:
   - CopyButton stays in loading state while the link is generated.
   - If elapsed time exceeds 9s, confirm the apology helper text appears.
   - If `Estimated size: 3,6xx chars` appears, confirm the new warning badge renders but generation continues.
4. When the CopyButton enables, click **Copy share link**.
5. Confirm you receive inline success feedback and that the clipboard contains a URL with `?share=` and `strategyId` telemetry logged in DevTools (`window.__AKSEL_TELEMETRY_LOG__`).
6. Open DevTools and run `window.__AKSEL_TELEMETRY_LOG__` to confirm a `share_generation` event fired with `withinTarget: true` (95% < 3s budget) and a `share_clipboard` event with `outcome: "success"`.

## Decode a Share Link
1. Open a new browser window/session.
2. Paste the copied URL into the address bar and load it.
3. Verify that Aksel Arcade warns about replacing current work, then hydrates the shared code, tabs, and preview settings.
4. Ensure the app strips the `share` query parameter via `history.replaceState` after loading.

## Oversize & Error Handling
1. Create (or script) a project whose combined file content exceeds ~80 KB (e.g., duplicate the "Summary page demo" tabs).
2. Open the Share popover and confirm the oversize warning appears immediately (before compression finishes), disables the CopyButton, enumerates the estimated characters for the best candidate strategy, and surfaces the **Use Export instead** CTA once the estimate crosses 4,000 characters (warning kicks in at 3,600).
3. Toggle browser DevTools to simulate clipboard-denied state (Application > Clipboard permissions) and verify fallback messaging appears when CopyButton is pressed—`window.__AKSEL_TELEMETRY_LOG__` should now show a `share_clipboard` event with `outcome: "fallback"`.
4. Reduce the project (delete files or collapse assets) until the estimator drops below 4,000 chars; confirm the warning badge clears once the size returns to <3,600 chars.

## Benchmark Compression Strategies
1. Run the harness (added in this plan) to evaluate all strategies against curated fixtures:
   ```sh
   npm run share-strategy-bench
   ```
2. Inspect `test-results/share-strategies.json` for per-strategy character counts, encode/decode timings, and telemetry factors.
3. Load the "Hooks demo" template, open Share, and watch the console log for `strategyId`. Confirm the registry selected the same winner reported by the harness.
4. Repeat with the "Summary page demo" template to ensure at least one strategy stays under 4,000 characters. Capture screenshots of the Popover warning badge for QA.
5. Record findings in `tests/e2e/share-link.spec.ts` by adding coverage that asserts the `share` query param length is below 4,000 when using the largest template fixture.

## Testing
- Unit/Integration: `npm run test -- share` (targeted Vitest suites for encode/decode + popover state machine).
- E2E: `npx playwright test tests/e2e/share-link.spec.ts` (naming placeholder until spec lands).
- Type checks + lint before PR: `npm run type-check && npm run lint`.

## Runbook: Share Feature
1. **Share popover stuck in loading**
   - Confirm dev server console does not show storage or crypto errors.
   - Check the `ShareSessionState` logs in the browser console; if `status` remains `generating` after 9s, expect the apology helper text and verify that the `lz-string` bundle loaded without CSP violations.
2. **CopyButton disabled with clipboard warning**
   - Use the browser site settings to re-enable clipboard permissions, then retry. The fallback hidden textarea automatically appears and selects text for manual `Cmd/Ctrl+C` if `navigator.clipboard.writeText` throws.
3. **Oversize payload rejection**
   - Inspect the warning banner for the reported character count. Trim large files or toggle preview assets, then click **Retry** to re-run the heuristic. If the payload still exceeds 4,000 chars, direct users to the Export flow (warning surfaces between 3,600 and 4,000).
4. **Opening a shared link does nothing**
   - Reload with DevTools open and verify the `?share=` query parameter is present. Look for checksum mismatch logs; if present, the app intentionally prevents hydration and shows the tamper error message.
5. **Share query parameter not cleared**
   - Ensure `useProject` ran the `history.replaceState` call after decoding. If you navigated via hash routing, manually call `window.history.replaceState(null, document.title, window.location.pathname)` and reopen the Share link to confirm the fix.

## Packed Snapshot Troubleshooting
1. **Count suspect quotes quickly**
   - When you collect a failing packed payload, run a one-liner to count unescaped quotes before `repairPackedSnapshotJson` touches it:
     ```sh
     node - <<'NODE'
     const payload = process.argv[2]
     const stray = (payload.match(/className="/g) ?? []).length
     console.log('Unescaped className quotes:', stray)
     NODE "$CORRUPTED_PAYLOAD"
     ```
   - This matches the snippet captured in T065; the full regeneration script (documented beside `tests/integration/share-decode.test.tsx`) rewrites `tests/fixtures/share/packed-with-unescaped-quotes.json` whenever schemas change.
2. **Force a specific compression strategy**
   - The old `window.__akselShareDebug` shim has been removed. When you need to exercise a single strategy in the UI, temporarily limit `listCompressionStrategies()` to that entry (remember to revert before committing) or lean on the bench harness (`npm run share-strategy-bench`) to encode/decode fixtures deterministically outside the UI.
3. **Decode payloads offline**
   - Use the existing bench harness to reproduce encode/decode pipelines without the UI: `npm run share-strategy-bench`. The bundled runner (`scripts/share-strategy-bench.mjs`) caches its compiled entry under `node_modules/.cache/aksel-arcade/`, exposing the same helpers T065 relies on for generating canonical packed JSON snippets.
4. **Verify repair logic end-to-end**
   - Run `npx vitest run tests/integration/share-decode.test.tsx` to execute the regression from T065 (fixture: `tests/fixtures/share/packed-with-unescaped-quotes.json`); the test also documents the Node bundle recipe for rebuilding the fixture.
   - For manual smoke tests (T063), start `npm run dev`, load the Summary template, force the packed strategy, copy the link, and open it in a clean profile. Inspect `localStorage.telemetryQueue` to confirm `{ strategyId, repairApplied }` are recorded and that the warning banner clears once hydration succeeds.
   - Document any findings in `specs/001-share-project-url/compression-log.md` and reference T063–T065 so future contributors know where to continue the investigation.

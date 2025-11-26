# Share Compression Attempts Log

Chronological record of approaches evaluated for share URL payload compression. Keep entries short and focused on what changed, measured impact, and follow-up ideas.

## 2025-11-26 — Packed Brotli q11 + Base64url checksum fix
- **Why**: Fresh share links created with `packed-brotli-q11-b64url` tripped the "Share link could not be opened" dialog because decode recomputed the checksum from the raw JSON snapshot while encode hashed the packed snapshot string. Checksums never matched, so we always warned about tampering even though payloads were intact.
- **Fix**: Taught `getChecksumPayloadForStrategy` to treat any `strategyId` starting with `packed-` as a packed snapshot so it serializes the same data used during encode regardless of transport (Base91 vs Base64url). Added a regression test that encodes/decodes using the Base64url variant to ensure checksum validation stays green.
- **Impact**: Decoding now succeeds without touching compression outputs. Existing packed strategies keep their behavior, and future `packed-*` codecs automatically get the correct checksum source.

## 2025-11-26 — Packed Brotli q11 + Base64url regression fix
- **Why**: Hooks demo share links ballooned back above 3.7k chars because Base91 payloads explode once they’re percent-encoded into real URLs (every `%` adds two more chars). Needed a transport that keeps q11 Brotli gains without `%` chaos.
- **Heuristic updates**: Added `packed-brotli-q11-b64url` to the strategy registry with a more aggressive estimate multiplier (`0.4 + 85`). Also inflated the Base91 strategy multipliers so ranking logic no longer underestimates their real-world footprint. Unit spec `tests/unit/utils/compressionStrategies.test.ts` now expects the base64url variant to win for Hooks snapshot.
- **Measurement harness**: Extended `scripts/debug-share-length.mjs` so `FORCE_STRATEGY_ID=… node scripts/debug-share-length.mjs` spins up Vite + Playwright, loads each template via the actual UI, and (optionally) forces a specific codec. The script logs share length, payload chars, packed snapshot length, and warnings.
- **Results (default ranking, no override)**:
	- Hooks demo → `packed-brotli-q11-b64url`, **2616 chars** (payload 2444 chars). Warning flag stays `false` (<2966 target).
	- Summary template → same strategy, **1944 chars** (payload 1772), well under the 4000 hard limit without forcing warnings.
- **Forced sanity check**: `FORCE_STRATEGY_ID=packed-brotli-q11-b64url …` reported Hooks at 2614 chars, confirming repeatability regardless of experimental multipliers stored in localStorage.
- **Follow-up**: Keep the Base91 flavor around for edge cases that need the wider alphabet, but prefer base64url transport whenever heuristics predict an oversized percent-encoding overhead. Keep feeding telemetry back into `useShareLinkExperiments` so multipliers stay honest.

## 2025-11-25 — T063 manual share decode (packed-deflate-b91)
- **Setup**: Ran `node scripts/verify-packed-share.mjs` (bootstraps a Vite dev server + Playwright) to load the "Oppsummeringsside for søknadsdialoger" template, forced `window.__akselShareDebug.forceStrategyId = 'packed-deflate-b91'`, opened the Share popover, and copied the link via the real CopyButton before loading it inside a brand-new browser context.
- **Share URL**:
	```
	http://127.0.0.1:4173/aksel-arcade/?share=2.eyJ2IjoxLCJzIjoicGFja2VkLWRlZmxhdGUtYjkxIiwidyI6MCwidCI6MzYwMCwiYyI6NDAwMH0.kZCi0SzIdMygOYXnMLVOkQYOn4ScmP8aTrlQcLUFlMw.`.L%3DSTXB%21%7Eqxq%7DW%3EM%2CaTxQ%7BdkUS%24F91dU0u0%3EAK%3Fj3%7C%3F4%26%3Cep3IoF%7E4%5EkBxqH_%3CGhj%3BWm%29GZ%22PQw%7E%3Cdyw%60SSary%7C%22W50O%7B%24%5Dje%21EA%26E9%3EWqr3s%28%26d%24pmNrR%23UCBBj%7Dqofa50l6%28%5D%60%5EQbdnY3F%3BjWz9%28%2Cq%7Bwgqu6%3C%40%3F%28f%2FM%26%5Ep%26%3BF%3ChSD%29%60hL_DLog7%284%7BI3U%7Dc4a%7CP%26%5D%240%5B2eXO41bVMb%5Em*%60%5DjCU0%3C*Oi7zO%5DTVmKXh%5B_%25bu598elY%25%215%7E%7D%3F3%3E1%3CvJd%7D%3Ez.rGX%7DrQN4x%2F%28W%3BTkdy1H*TW3Dewq%28%3DEAY_BOz%2BvWgx%22M%7E5z%25Tz%2B%26arKk%29%23y%21g%60yd%5EXPr%7B8d%3D%5Di%3E%28%5B%7B5%7E%26eJ0q%3C4%7B*Ze%26C%29%25%7DO%25m90Db%25S%22Q_Vtbe1YnN*%3BH_%3B%60YP%21Uzh%24T%3DXA9tIt7%29W%3Fu%26l0ACg%7E%29%2FiZHR%3FWP%7EHTrBk%3B7%3D3%26YTP%7C%3FMooWf%7DuXD4Rg%7CvTlul%5EDjudP%7C%7D%40Zrhtg5%5BVG7%21%3FAu%3C%21599Ad1aJSaUkOfJRMET0%28c%3D%25Cf%5Bp9%2C7%26%60S276L%2CI3Rhe%5EwZcIk%3EZ*f%3CTPUC%3Ailj5HH_2G6kY%7D%3F%24%7C%7D%21%7C%40nRT7WB_yU%5B%24*5%3A0%5DI%2B5t.v%5BO%3EhN3UTdF14%7C%3FjnG6%2CqpB%5EwU%2C%7C*%3E%255qbVf_ErN%2B8Jg%2604jtS1%5B%7B%2CStzTpS%220S%292fKT%3Dgol%2B%24N%7E%3AJzTJ.hEp5%7D%2FP%2C%3Dmb%24hXe%3ER%3F%7B%5B%3F4%5D%24JKL%26%25j%40_4x%26.tT3Ia%60%7CXl%29%5D%254y%60jn%5D%5BY5Oa%3Bi%3A%24IKfsVG%22v2jYO%3CwS7s%3CHw.Tv%21%3E8EhJ*BCy%28js%7C%29qG%7CxKCal%21%3A%3Fj%28a%22%22A6Ij9KLCO%3Bx%7D4XmMb02H3%3A_3t0Xsoctgqa%7CG.Y.z.6i*8YQmCa%3D%3D%7C%24%2Cm%23e*CtmDk4g%29z%7BnKE%3AENPBC%3EG%24%40RjdL%2C16%5EbMFi%7BCNX4%219gbNK2hI6wLN%3CbmRk%3ACy0%3FVfR%26%7B%5Bst%2Cdt%60Ot%2C%7BnUBB%5Dd.cG0b%25%5DI%25Lf%29gMz%3Ax%3E%2Bp%22%246zg%26%2Fp7yn%60bNx%3AjY%25%5D%3C%2B%40bE%29q7%7Bd%5EJT%2C%40XKG%3Fgz%3DCYDLL3018vH%5Bt%2CwVO6i%26na*ywRD4%21Gc%28yg6Oa%3DK%3F%3Cs%29GO%3F%60EgfcQr%26%7CzgR5IdIAPsx_B%2FlE%3Fb%29fKcTj%5E%24Rtfr%2BO%3FFu%5D%3C%7C%3CXF%22%7B%5E%7BFH%3ElZClb%40Lix%3Dx%3DYpDZxBLgEcGQ%3AcR3r3ZCC%7Cg9T%3D%25ChKvU%5DirO%24n%7EI%5B%28pBu7Ix%40CJwNx%60fcqCkyCF99y1i_y*z%26V.KZL%40rIB%2FIwYl%3Cn1%258%5E_%40%21%5B_r.O%3D%21B%29UKvO%3D%7B4Qj%5D%24X%5DUa%23yJsU6S5wP%23%28%26pCeudi%7DLLci83%2CVNS%24%3FD%60%608lExe%3Fn7D4%25n%22Nqmo2isY%25%5BN6N90e%4015%7D%24oT.mLr%5DNN%23F%24A%3A%7B%5E%2BKF4C%5Em%256%7E%5Bs%5E%264%26_y%2F6%7CSUN.0%5D0Ec%24uIo*TLy_M%3C9%24%29%5D%2C%24%29%21T_*%2B%28%3A9L%3FCL94XG%26%2C%25%60Cwm%3DPG%7E%286FY%3CN%280G%2B%3CzmD%285_0NkyPt%5BCwiWi%3FwFJ%60%5E5%3D.WT.W%24W%21emYmG%287mu%28%7C%5Der%24.q%28I%5B%25nUpnl%7C%2Fld%3FYLbszC%60q.rn%21%5DZ1X%5DVwyl%23Zd1e8%28y%7CoQh%25.wI12FBOgw%2FS%23%29Qz%7D%40%3Cz.HyABD4a64%295B%7CDu%29bZ%7D%25%40c2l%28%5DGJ*Ce%3BC%3AA%7B%7B%3A%22m%25s%3EwFurj%5B%7B%26X%7D_Q5bRd0hFEZ%7CIg%5B%60q%24OT%5D%2Fe08vvV9NWq9%7D%40TZqWA%21%5D_%2CgqrLn%24%3AMP%26%7C69KOduOC%3D0ngVc4Wq%7Ds%29Px%3C06C%7C%5DPhj%3FtIxy_%5EaZG0q4%60%5D%5DeEk%26B%22JBP6B%2530%7Cz9W0ZOc%7EsLe9x*p%3B4%3A%29ww%2CUREWpL645u9NQq9%5D%29DZ92%3As4%3ESm6MypODq%5D*nrLOK%2F1xdOm%5DeWDS%3B4%7E%26e_%3E%7D%29Jw%2BIsGh%29J19W%7B%28mO%2Cw%3E%23%5BdTo%3A%7E%3DlYBql%3A%25xKh7%29q08drg.pK6vJz*I%23G7%3C%3DA%3EF1q%3Ce%2CiZgmrdFx%7Cp%5E_PA
	```
- **Hydration outcome**: Recipient context saw the "Load shared project" WarningNotification, accepted it, previewed the full summary template, and the location bar returned to `/aksel-arcade/` (no lingering `share=` param).
- **Telemetry**: `{"type":"share_decode","strategyId":"packed-deflate-b91","repairApplied":false,"checksumValid":true}` pulled from `localStorage.telemetryQueue`.
- **Artifacts**: Full JSON dump (share URL + warning flag + telemetry + raw console output) recorded in `test-results/t063-share-session.json`.

<details>
<summary>Sender console (verbatim)</summary>

```json
[
	{"type":"debug","text":"[vite] connecting..."},
	{"type":"debug","text":"[vite] connected."},
	{"type":"info","text":"%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold"},
	{"type":"warning","text":"An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing."},
	{"type":"log","text":"🔒 CSP applied: Production"},
	{"type":"log","text":"🔧 Environment: Production"},
	{"type":"log","text":"🚀 Starting module load, isDev: false"},
	{"type":"log","text":"🚀 Will call: loadFromBuild()"},
	{"type":"log","text":"📦 Loading pre-bundled sandbox..."},
	{"type":"log","text":"📍 Base path: /aksel-arcade/"},
	{"type":"log","text":"📥 Loading script from: http://127.0.0.1:4173/aksel-arcade/sandbox-bundle.js"},
	{"type":"log","text":"✅ Sandbox bundle loaded successfully"},
	{"type":"log","text":"✅ window.sandboxBundle found, keys: [AkselComponents, AkselIcons, React, Theme, createRoot, default]"},
	{"type":"log","text":"✅ Module loaded successfully!"},
	{"type":"log","text":"🔍 Module keys: [AkselComponents, AkselIcons, React, Theme, createRoot, default]"},
	{"type":"log","text":"🔍 sandbox.React: true sandbox.createRoot: true sandbox.Theme: true"},
	{"type":"log","text":"✅ Sandbox ready, Aksel + React loaded from Vite: 79 components"},
	{"type":"log","text":"✅ Aksel icons loaded: 941 icons"},
	{"type":"log","text":"✅ React version: 19.2.0"},
	{"type":"log","text":"✅ Theme component available: true"},
	{"type":"log","text":"✅ Darkside CSS imported via @navikt/ds-css/darkside"},
	{"type":"log","text":"✅ Sandbox is ready"},
	{"type":"log","text":"📤 Sending UPDATE_VIEWPORT to sandbox: 768px"},
	{"type":"log","text":"📤 Sending UPDATE_THEME to sandbox: dark"},
	{"type":"log","text":"📥 Sandbox received message: UPDATE_VIEWPORT"},
	{"type":"log","text":"📐 Updating viewport..."},
	{"type":"log","text":"📐 Setting viewport width to 768px"},
	{"type":"log","text":"📥 Sandbox received message: UPDATE_THEME"},
	{"type":"log","text":"🎨 Updating theme..."},
	{"type":"log","text":"🎨 Updating theme to dark"},
	{"type":"log","text":"✅ Form summary template loaded successfully"},
	{"type":"log","text":"✅ Transpilation successful"},
	{"type":"log","text":"📝 Transpiled code: function App() { ... }"},
	{"type":"debug","text":"[packed-deflate-b91] snippet m søknaden har ID)</BodyShort>\\n                <Heading lev"},
	{"type":"debug","text":"[telemetry] {type: share_generation, durationMs: 18, bucket: <1s, approxChars: 3076, estimatedChars: 3739}"},
	{"type":"debug","text":"[telemetry] {type: share_clipboard, outcome: success, timestamp: 1764110959051}"}
]
```

</details>

<details>
<summary>Recipient console (verbatim)</summary>

```json
[
	{"type":"debug","text":"[vite] connecting..."},
	{"type":"debug","text":"[vite] connected."},
	{"type":"info","text":"%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold"},
	{"type":"debug","text":"[telemetry] {type: share_decode, strategyId: packed-deflate-b91, repairApplied: false, checksumValid: true, errorCode: undefined}"},
	{"type":"warning","text":"An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing."},
	{"type":"log","text":"🔒 CSP applied: Production"},
	{"type":"log","text":"🔧 Environment: Production"},
	{"type":"log","text":"🚀 Starting module load, isDev: false"},
	{"type":"log","text":"🚀 Will call: loadFromBuild()"},
	{"type":"log","text":"📦 Loading pre-bundled sandbox..."},
	{"type":"log","text":"📍 Base path: /aksel-arcade/"},
	{"type":"log","text":"📥 Loading script from: http://127.0.0.1:4173/aksel-arcade/sandbox-bundle.js"},
	{"type":"log","text":"✅ Sandbox bundle loaded successfully"},
	{"type":"log","text":"✅ window.sandboxBundle found, keys: [AkselComponents, AkselIcons, React, Theme, createRoot, default]"},
	{"type":"log","text":"✅ Module loaded successfully!"},
	{"type":"log","text":"🔍 Module keys: [AkselComponents, AkselIcons, React, Theme, createRoot, default]"},
	{"type":"log","text":"🔍 sandbox.React: true sandbox.createRoot: true sandbox.Theme: true"},
	{"type":"log","text":"✅ Sandbox ready, Aksel + React loaded from Vite: 79 components"},
	{"type":"log","text":"✅ Aksel icons loaded: 941 icons"},
	{"type":"log","text":"✅ React version: 19.2.0"},
	{"type":"log","text":"✅ Theme component available: true"},
	{"type":"log","text":"✅ Darkside CSS imported via @navikt/ds-css/darkside"},
	{"type":"log","text":"✅ Sandbox is ready"},
	{"type":"log","text":"📤 Sending UPDATE_VIEWPORT to sandbox: 768px"},
	{"type":"log","text":"📤 Sending UPDATE_THEME to sandbox: dark"},
	{"type":"log","text":"📥 Sandbox received message: UPDATE_VIEWPORT"},
	{"type":"log","text":"📐 Updating viewport..."},
	{"type":"log","text":"📐 Setting viewport width to 768px"},
	{"type":"log","text":"📥 Sandbox received message: UPDATE_THEME"},
	{"type":"log","text":"🎨 Updating theme..."},
	{"type":"log","text":"🎨 Updating theme to dark"},
	{"type":"log","text":"✅ Transpilation successful"},
	{"type":"log","text":"📝 Transpiled code: function App() { ... }"}
]
```

</details>

## 2025-11-23 — Snapshot packing + Deflate/Base91
- **Strategy**: Serialize snapshots into compact array-based wire format, then apply `deflateSync(level=9)` with Base91 encoding.
- **Why**: Baseline JSON contains repetitive keys and whitespace. Packing removes structural noise before compression.
- **Result**: ~12-18% shorter tokens compared to plain Deflate+Base91 on Hooks Demo fixture (per `share-strategy-bench`).
- **Notes**: Compatible with checksum model because original JSON is preserved for hashing. Requires `snapshotPacking` helpers and strategy registry update.

## 2025-11-25 — Snapshot packing + Brotli (q9) + Base91
- **Strategy**: Packed snapshot string fed into `brotli-wasm` compressor at quality 9, then transported via Base91 to keep letter budget high.
- **Why**: Higher-quality Brotli should squeeze more redundancy out of the packed wire format than Deflate, even if CPU cost rises.
- **Result**: Hooks demo share URL landed at **1,119 chars** (baseline packed-deflate is 1,260), ~11% shorter. Encode/Decode (Node 18) ~7 ms / ~0 ms.
- **Notes**: Requires loading Brotli WASM in Node and browser; added `scripts/compression-experiments` harness for measurement. Need to confirm decode latency and WASM bundle impact before shipping.

## 2025-11-25 — Snapshot packing + Brotli (q7) + Base91
- **Strategy**: Same as above but with Brotli quality 7 to check perf/size trade-offs.
- **Why**: q9 might be overkill for interactive shares; q7 offers faster encode/decode with slightly worse ratio.
- **Result**: Hooks demo URL measured **1,122 chars** (~11% shorter than baseline, but 0.3% longer than q9). Encode cost ~25 ms.
- **Notes**: Still materially better than packed-deflate; q7 may be safer default if q9 proves too spiky on slower devices.

## 2025-11-25 — Snapshot packing + LZMA (mode 4) + Base91
- **Strategy**: Run packed snapshot through LZMA mode 4 (slower but denser than mode 3) and wrap bytes with Base91.
- **Why**: LZMA historically wins on ratio; combining with packed input should amplify benefits.
- **Result**: Hooks demo URL came in at **1,252 chars**, only ~0.6% shorter than packed-deflate while taking ~24 ms to encode.
- **Notes**: Not worth integrating—the gain is negligible relative to added worker/LZMA cost. Consider dropping from shortlist.

## 2025-11-25 — Snapshot packing + Brotli (q11) + Base91
- **Strategy**: Drive `brotli-wasm` at quality 11 against the packed wire format, then emit Base91.
- **Why**: q11 is Brotli’s maximum compression mode; curious how far we can push URL length before CPU/time becomes unacceptable.
- **Result**: Hooks demo share URL dropped to **1,047 chars** (~17% shorter than packed-deflate, ~6% shorter than q9). Encode/Decode (Node 18) ≈15 ms / ≈0 ms with deterministic round-trip (`serializePackedSnapshot` equality).
- **Notes**: `brotli_wasm_bg.wasm` (bundler build) is ~1.01 MiB on disk; bundling this takes a noticeable chunk of our size budget. Node decode time is trivial, but need to confirm perf on low-end browsers + measure bundle impact in real builds before flipping default.

## 2025-11-25 — Snapshot packing + Brotli (q9) + Base64url
- **Strategy**: Same q9 Brotli pass, but encode bytes with Base64url instead of Base91.
- **Why**: Sanity-check how much Base91’s alphabet contributes vs. compression alone.
- **Result**: Hooks demo URL was **1,203 chars**, ~8% longer than the Base91 transport despite identical compressed bytes.
- **Notes**: Confirms Base91’s value for URL density; Base64url sacrifices too much headroom to justify switching.

## 2025-11-25 — Snapshot packing + Brotli (q11) + Base64url
- **Strategy**: Apply q11 Brotli to the packed payload but emit Base64url, mirroring the control above.
- **Why**: Isolate whether q11’s gains survive without Base91.
- **Result**: Hooks demo URL measured **1,125 chars**, still better than q7/q9 Base91 but ~7% longer than q11+Base91.
- **Notes**: Reinforces that Base91 transport is essential for squeezing every character; Base64url only makes sense if we need a conservative character set.

## 2025-11-26 — T063 packed-deflate sanity run (Summary template)
- **Setup**: Dev server on `http://127.0.0.1:5173` with Summary template auto-loaded (Settings → “Oppsummeringsside for søknadsdialoger”). Forced packed strategy via `window.__akselShareDebug.forceStrategyId = 'packed-deflate-b91'` before opening the Share popover.
- **Observed URL**:
	```
	http://127.0.0.1:5173/aksel-arcade/?share=2.eyJ2IjoxLCJzIjoicGFja2VkLWRlZmxhdGUtYjkxIiwidyI6MCwidCI6MzYwMCwiYyI6NDAwMH0.PI15NnLL1dl-cPlf2_16nmyjywOeoR8N65sTg-gH0d4.`.L%3DSTXB%21%7Eqxq%7DW%3EM%2CaTxQ%7BdkUS%24F91dU0u0%3EAK%3Fj3%7C%3F4%26%3Cep3IoF%7E4%5EkBxqH_%3CGhj%3BWm%29GZ%22PQw%7E%3Cdyw%60SSary%7C%22W50O%7B%24%5Dje%21EA%26E9I.8%5E%3Cj6%5Et%24pmNrR%23UCBBj%7Dqofa50l6%28%5D%60%5EQbdnY3F%3BjWz9%28%2Cq%7Bwgqu6%3C%40%3F%28f%2FM%26%5Ep%26%3BF%3ChSD%29%60hL_DLog7%284%7BI3U%7Dc4a%7CP%26%5D%240%5B2eXO41bVMb%5Em*%60%5DjCU0%3C*Oi7zO%5DTVmKXh%5B_%25bu598elY%25%215%7E%7D%3F3%3E1%3CvJd%7D%3Ez.rGX%7DrQN4x%2F%28W%3BTkdy1H*TW3Dewq%28%3DEAY_BOz%2BvWgx%22M%7E5z%25Tz%2B%26arKk%29%23y%21g%60yd%5EXPr%7B8d%3D%5Di%3E%28%5B%7B5%7E%26eJ0q%3C4%7B*Ze%26C%29%25%7DO%25m90Db%25S%22Q_Vtbe1YnN*%3BH_%3B%60YP%21Uzh%24T%3DXA9tIt7%29W%3Fu%26l0ACg%7E%29%2FiZHR%3FWP%7EHTrBk%3B7%3D3%26YTP%7C%3FMooWf%7DuXD4Rg%7CvTlul%5EDjudP%7C%7D%40Zrhtg5%5BVG7%21%3FAu%3C%21599Ad1aJSaUkOfJRMET0%28c%3D%25Cf%5Bp9%2C7%26%60S276L%2CI3Rhe%5EwZcIk%3EZ*f%3CTPUC%3Ailj5HH_2G6kY%7D%3F%24%7C%7D%21%7C%40nRT7WB_yU%5B%24*5%3A0%5DI%2B5t.v%5BO%3EhN3UTdF14%7C%3FjnG6%2CqpB%5EwU%2C%7C*%3E%255qbVf_ErN%2B8Jg%2604jtS1%5B%7B%2CStzTpS%220S%292fKT%3Dgol%2B%24N%7E%3AJzTJ.hEp5%7D%2FP%2C%3Dmb%24hXe%3ER%3F%7B%5B%3F4%5D%24JKL%26%25j%40_4x%26.tT3Ia%60%7CXl%29%5D%254y%60jn%5D%5BY5Oa%3Bi%3A%24IKfsVG%22v2jYO%3CwS7s%3CHw.Tv%21%3E8EhJ*BCy%28js%7C%29qG%7CxKCal%21%3A%3Fj%28a%22%22A6Ij9KLCO%3Bx%7D4XmMb02H3%3A_3t0Xsoctgqa%7CG.Y.z.6i*8YQmCa%3D%3D%7C%24%2Cm%23e*CtmDk4g%29z%7BnKE%3AENPBC%3EG%24%40RjdL%2C16%5EbMFi%7BCNX4%219gbNK2hI6wLN%3CbmRk%3ACy0%3FVfR%26%7B%5Bst%2Cdt%60Ot%2C%7BnUBB%5Dd.cG0b%25%5DI%25Lf%29gMz%3Ax%3E%2Bp%22%246zg%26%2Fp7yn%60bNx%3AjY%25%5D%3C%2B%40bE%29q7%7Bd%5EJT%2C%40XKG%3Fgz%3DCYDLL3018vH%5Bt%2CwVO6i%26na*ywRD4%21Gc%28yg6Oa%3DK%3F%3Cs%29GO%3F%60EgfcQr%26%7CzgR5IdIAPsx_B%2FlE%3Fb%29fKcTj%5E%24Rtfr%2BO%3FFu%5D%3C%7C%3CXF%22%7B%5E%7BFH%3ElZClb%40Lix%3Dx%3DYpDZxBLgEcGQ%3AcR3r3ZCC%7Cg9T%3D%25ChKvU%5DirO%24n%7EI%5B%28pBu7Ix%40CJwNx%60fcqCkyCF99y1i_y*z%26V.KZL%40rIB%2FIwYl%3Cn1%258%5E_%40%21%5B_r.O%3D%21B%29UKvO%3D%7B4Qj%5D%24X%5DUa%23yJsU6S5wP%23%28%26pCeudi%7DLLci83%2CVNS%24%3FD%60%608lExe%3Fn7D4%25n%22Nqmo2isY%25%5BN6N90e%4015%7D%24oT.mLr%5DNN%23F%24A%3A%7B%5E%2BKF4C%5Em%256%7E%5Bs%5E%264%26_y%2F6%7CSUN.0%5D0Ec%24uIo*TLy_M%3C9%24%29%5D%2C%24%29%21T_*%2B%28%3A9L%3FCL94XG%26%2C%25%60Cwm%3DPG%7E%286FY%3CN%280G%2B%3CzmD%285_0NkyPt%5BCwiWi%3FwFJ%60%5E5%3D.WT.W%24W%21emYmG%287mu%28%7C%5Der%24.q%28I%5B%25nUpnl%7C%2Fld%3FYLbszC%60q.rn%21%5DZ1X%5DVwyl%23Zd1e8%28y%7CoQh%25.wI12FBOgw%2FS%23%29Qz%7D%40%3Cz.HyABD4a64%295B%7CDu%29bZ%7D%25%40c2l%28%5DGJ*Ce%3BC%3AA%7B%7B%3A%22m%25s%3EwFurj%5B%7B%26X%7D_Q5bRd0hFEZ%7CIg%5B%60q%24OT%5D%2Fe08vvV9NWq9%7D%40TZqWA%21%5D_%2CgqrLn%24%3AMP%26%7C69KOduOC%3D0ngVc4Wq%7Ds%29Px%3C06C%7C%5DPhj%3FtIxy_%5EaZG0q4%60%5D%5DeEk%26B%22JBP6B%2530%7Cz9W0ZOc%7EsLe9x*p%3B4%3A%29ww%2CUREWpL645u9NQq9%5D%29DZ92%3As4%3ESm6MypODq%5D*nrLOK%2F1xdOm%5DeWDS%3B4%7E%26e_%3E%7D%29Jw%2BIsGh%29J19W%7B%28mO%2Cw%3E%23%5BdTo%3A%7E%3DlYBql%3A%25xKh7%29q08drg.pK6vJz*I%23G7%3C%3DA%3EF1q%3Ce%2CiZgmrdFx%7Cp%5E_PA
	```
- **Hydration outcome**: Recipient context saw the Load Shared Project dialog, applied snapshot successfully, and URL cleared back to `/aksel-arcade/` once the user confirmed.
- **Telemetry**: `localStorage.telemetryQueue` now includes `{ type: 'share_decode', strategyId: 'packed-deflate-b91', repairApplied: false, checksumValid: true }`, satisfying T063 requirements.
- **Console notes**: Sender/recipient both log expected CSP iframe errors (sandbox build not loaded over HTTP in dev). Documented the raw console arrays plus telemetry blob in the session artifacts for future audits.

## 2025-11-26 — T064 share e2e wait budget (Summary template)
- **Selector hardening**: Added `data-testid="project-controls-settings"` to the header ActionMenu trigger so Playwright can locate the Settings button without strict-mode ambiguity. `tests/e2e/share-link.spec.ts` now uses `page.getByTestId('project-controls-settings')` when loading templates.
- **Wait guidance**: Summary template forces `packed-deflate-b91`, which routinely spends 8‑10s encoding. The e2e spec keeps a 20 s `await expect(copyButton).toBeEnabled({ timeout: 20000 })` budget with an inline comment so CI engineers know the delay is intentional.
- **Verification**: `npx playwright test tests/e2e/share-link.spec.ts` (Chromium) passes locally in ~18 s, confirming the new selectors and wait budget stabilize the run.

## 2025-11-15 — AST whitespace trim + LZ-String
- **Strategy**: Strip redundant whitespace/comment blocks from file contents before running standard LZ-String URI encoder.
- **Why**: Quick win without new libraries.
- **Result**: ~8% average savings but lossy (drops intentional spacing/comments). Flagged as experimental.
- **Notes**: Kept as fallback for users prioritizing shareability over perfect formatting.

## 2025-11-10 — LZMA worker + Base64url
- **Strategy**: Run LZMA (mode 3) in worker, encode bytes via Base64url.
- **Why**: Best compression ratio among general-purpose codecs we can bundle.
- **Result**: Reliable 20-25% size reduction vs LZ-String but slower encode (20ms median).
- **Notes**: Still exceeds URL limit for very large projects; limited by Base64 expansion.

## 2025-10-30 — Deflate + Base91
- **Strategy**: `fflate` Deflate level 6 and custom Base91 alphabet.
- **Why**: Remove Base64 padding overhead while keeping fast CPU profile.
- **Result**: Moderate gains (~15% vs LZ-String) with good performance.
- **Notes**: Became default fallback due to simplicity.

## 2025-10-15 — LZ-String URI encoding
- **Strategy**: Stock `compressToEncodedURIComponent`.
- **Why**: Initial implementation baseline.
- **Result**: Acceptable for tiny demos but frequently exceeds 4000-char budget.
- **Notes**: Retained for backward compatibility.

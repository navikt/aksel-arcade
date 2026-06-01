# PRD: Desktop Arcade Agent transport

## Problem Statement

Aksel Arcade has a high-signal workspace for creating Aksel-based React prototypes: editable source, live preview, diagnostics, Preview evidence, import/export, and a sandboxed Arcade authoring contract. The current browser-only Agent session work proved that this is the right collaboration surface, but the browser is the wrong place to make agent connectivity easy for non-technical users. Browser automation requires unsafe developer settings, a browser-global bridge is hard for external agents to reach reliably, and the extension-plus-native-connector direction adds two moving parts before the user can get value.

The user wants to keep the existing editor panel, code preview panel, sandbox behavior, and Arcade project format unchanged, while improving the agent connection by adding Desktop Arcade as a desktop product surface. The product should support Web Arcade and Desktop Arcade from the same shared playground model, make Agent access a Desktop Arcade-only capability, and keep cross-shell sharing simple through Arcade project packages instead of continuing URL sharing in Desktop Arcade.

## Solution

Add Desktop Arcade as a desktop product surface around the shared Aksel Arcade workspace. Web Arcade and Desktop Arcade use the same shell-neutral Arcade project model, the same editor and preview experience, the same Arcade authoring contract, and compatible import/export behavior. Desktop Arcade adds Agent access; Web Arcade has no Agent UI, Agent runtime initialization, browser-global Agent bridge, or Web-facing Agent access affordances.

Desktop Arcade starts a consent-gated Agent session from the existing lightweight ActionMenu pattern. While active, Desktop Arcade exposes the existing Agent bridge commands through a same-device Agent transport. The first Agent transport is a short-lived loopback HTTP JSON-RPC adapter bound to localhost with a random port and an Agent pairing credential sent only in an Authorization header. The copied Agent pairing handoff is a short bootstrap command; after the External agent runs it, the Agent bridge returns Agent operating instructions for the active session. The transport is behind a swappable adapter boundary so it can be replaced later by a Unix socket, named pipe, MCP adapter, or helper process if security or product learning requires it.

The user-facing mental model is still "Agent access to this Arcade project." The menu shows only simple active/inactive status, a copy action for the hidden Agent pairing handoff, and copy success/failure feedback; it does not show Checkpoints, rollback, or Agent-specific history. The bridge-returned Agent operating instructions tell the External agent how to use the active Agent session: call `getProject` first, use import-free Arcade JSX and Hooks, rely on diagnostics and Preview evidence for feedback, apply immediate human-visible full-field replacements with `applyAgentChange`, and validate after changes. Desktop Arcade does not host in-app chat, store provider credentials, or integrate provider SDKs.

Web Arcade keeps Share URL as a web-only feature. Desktop Arcade does not offer Share URL. The canonical cross-shell sharing artifact becomes the Arcade project package, normally exported with a `.akselarcade` extension. Both Web Arcade and Desktop Arcade can import `.akselarcade` packages and older `.json` exports. Packages contain only the portable Arcade project and optional copied-out production guidance, not Agent session state, pairing credentials, endpoint details, diagnostics, Preview evidence, or Agent-specific history.

## User Stories

1. As an Aksel Arcade user, I want Web Arcade and Desktop Arcade to work with the same Arcade project model, so that my prototypes are portable between product surfaces.
2. As an Aksel Arcade user, I want Desktop Arcade to keep the familiar editor and preview workspace, so that the desktop pivot does not force me to learn a new creation flow.
3. As an Aksel Arcade user, I want the code panel to behave the same in Web Arcade and Desktop Arcade, so that source editing remains predictable.
4. As an Aksel Arcade user, I want the code preview panel to behave the same in Web Arcade and Desktop Arcade, so that live review remains the core workflow.
5. As an Aksel Arcade user, I want the sandbox runtime to keep the same Arcade authoring contract, so that prototypes run consistently across shells.
6. As an Aksel Arcade user, I want Desktop Arcade to add agent connectivity without changing normal human editing, so that Agent access is an enhancement rather than a redesign.
7. As a Web Arcade user, I want Agent controls absent, so that I am not offered a workflow that only works in Desktop Arcade.
8. As a Web Arcade user, I want Web Arcade to avoid initializing Agent session runtime, so that browser bridge behavior does not become an accidental supported path.
9. As a Web Arcade user, I want Share URL to remain available in Web Arcade, so that browser-based sharing remains possible where it already makes sense.
10. As a Desktop Arcade user, I want Share URL removed from Desktop Arcade, so that desktop sharing does not rely on browser URL payloads.
11. As a Desktop Arcade user, I want to export an Arcade project package, so that I can share a prototype as a portable file.
12. As a Desktop Arcade user, I want exported packages to use the `.akselarcade` extension by default, so that the artifact feels native to Aksel Arcade.
13. As a Web Arcade user, I want to import `.akselarcade` packages, so that Desktop Arcade users can send me projects without conversion.
14. As a Web Arcade user, I want to keep importing older `.json` exports, so that existing project files remain usable.
15. As a Desktop Arcade user, I want to import older `.json` exports, so that existing Web Arcade projects remain usable.
16. As an Aksel Arcade user, I want Arcade project packages to exclude Agent session state, so that shared projects do not leak local collaboration details.
17. As an Aksel Arcade user, I want Arcade project packages to exclude Agent pairing credentials, so that exported files cannot authorize agent access.
18. As an Aksel Arcade user, I want Arcade project packages to exclude endpoint information, so that local transport details are never shared.
19. As an Aksel Arcade user, I want Arcade project packages to exclude Agent-specific history, so that packages represent the current Arcade project rather than session state.
20. As an Aksel Arcade user, I want Arcade project packages to exclude diagnostics and Preview evidence, so that transient review data is not treated as project content.
21. As a Desktop Arcade user, I want to start Agent access from a lightweight ActionMenu, so that the feature stays close to the workspace without taking it over.
22. As a Desktop Arcade user, I want to stop Agent access from the same ActionMenu, so that I can revoke access immediately.
23. As a Desktop Arcade user, I want Agent access to be off by default, so that no external agent can inspect or change my Arcade project until I consent.
24. As a Desktop Arcade user, I want the menu to show only `Status: inaktiv` or `Status: aktiv`, so that I do not have to understand transport internals.
25. As a Desktop Arcade user, I want the Agent pairing handoff copied to the clipboard without showing the token, so that I can pair an external agent without exposing secrets in the UI.
26. As a Desktop Arcade user, I want copy success or failure feedback, so that I know whether the hidden Agent pairing handoff was copied.
27. As a Desktop Arcade user, I want copy failure to offer retry rather than automatically revealing the prompt, so that credentials are not exposed by accident.
28. As a Desktop Arcade user, I want no local endpoint or token wording in the main UI, but clear copy that the paired agent can read and change this Arcade project while Agent access is active, so that my consent is informed without exposing transport details.
29. As a Desktop Arcade user, I want the Agent pairing handoff and Agent operating instructions to work with GitHub Copilot app, so that I can test the workflow with the Copilot surface I use now.
30. As a Desktop Arcade user, I want the Agent pairing handoff and Agent operating instructions to work with Copilot CLI, so that terminal-based agent workflows can use the same Agent bridge.
31. As a Desktop Arcade user, I want the Agent pairing handoff and Agent operating instructions to work with Copilot in VS Code, so that editor-based agent workflows can use the same Agent bridge.
32. As a Desktop Arcade user, I want the Agent operating instructions to stay provider-neutral, so that other same-device external agents can use the protocol too.
33. As a Desktop Arcade user, I want Desktop Arcade to avoid in-app provider chat, so that the product stays focused on the playground and not on becoming an LLM client.
34. As a Desktop Arcade user, I want Desktop Arcade to avoid provider credential storage, so that I do not have to trust Arcade with LLM account secrets.
35. As an External agent, I want Agent operating instructions returned by the bridge, so that I know how to work with the active Agent session without discovering the protocol elsewhere.
36. As an External agent, I want a simple same-device endpoint, so that I can connect without browser automation, browser extensions, or Apple Events.
37. As an External agent, I want to authenticate with an Agent pairing credential, so that only the user-approved session is accessible.
38. As an External agent, I want the credential sent in an Authorization header, so that it is not leaked through URL history or query strings.
39. As an External agent, I want the Agent transport to expose `getProject`, so that I can understand the active Arcade project source and name.
40. As an External agent, I want the Agent transport to expose `getPreviewContext`, so that I can account for the current theme and viewport.
41. As an External agent, I want the Agent transport to expose `getDiagnostics`, so that I can respond to compile errors, runtime errors, preview status, and sandbox console output.
42. As an External agent, I want the Agent transport to expose `getPreviewEvidence`, so that I can inspect the rendered preview through sanitized Preview evidence.
43. As an External agent, I want the Agent transport to expose `getSessionState`, so that I can understand the active session capabilities.
44. As an External agent, I want the Agent transport to expose `applyAgentChange`, so that I can submit valid Agent changes to the active Arcade project.
45. As an External agent, I want the transport methods to map one-to-one to Agent bridge commands, so that there is no second desktop-specific API to learn.
46. As an External agent, I want rejected commands to return structured errors, so that I can correct invalid requests safely.
47. As an External agent, I want unsupported commands rejected, so that I cannot accidentally use Desktop Arcade as a broader automation API.
48. As an External agent, I want access to be same-device only, so that the local workflow is clear and bounded.
49. As an External agent, I want the Agent session to end when the user stops access, so that stale credentials stop working immediately.
50. As an External agent, I want the Agent session to end when Desktop Arcade quits or reloads, so that reconnect requires fresh user consent.
51. As a Desktop Arcade user, I want Agent changes to apply immediately after validation, so that I can review the result in the live preview.
52. As a Desktop Arcade user, I want Agent changes to avoid creating a separate Checkpoint or rollback history, so that accepted changes are ordinary Arcade project edits.
53. As a Desktop Arcade user, I want stopping Agent access to be the Agent-specific safety boundary, so that a paired External agent cannot keep working after I revoke access.
54. As a Desktop Arcade user, I want the Agent menu to omit Checkpoints, rollback, and Agent-specific history, so that the controls stay focused on access and pairing.
55. As a Desktop Arcade user, I want all Agent permissions enabled while access is active, so that the copied instructions match what the agent can do.
56. As a Desktop Arcade user, I want permission complexity hidden in v1, so that starting Agent access remains a simple consent decision.
57. As a Desktop Arcade user, I want invalid Agent changes rejected before mutation, so that the active Arcade project is protected from malformed requests.
58. As a Desktop Arcade user, I want oversized Agent changes rejected before mutation, so that local persistence and package limits remain safe.
59. As a Desktop Arcade user, I want preview setting and metadata changes to follow the same validation as source changes, so that all Agent changes are safe and atomic.
60. As a Desktop Arcade user, I want the live preview to show Agent changes immediately after they apply, so that review stays visual.
61. As a Desktop Arcade user, I want compile and runtime errors to appear through the normal preview flow, so that Agent changes do not need a separate proposal validation UI.
62. As a Desktop Arcade user, I want Preview evidence to remain sanitized rather than full screenshots in v1, so that the agent sees only Arcade-scoped state.
63. As a Desktop Arcade user, I want no visible command log in v1, so that the menu stays focused on access and instructions.
64. As a Desktop Arcade user, I want technical request failures logged for debugging, so that developers can diagnose transport issues without exposing noise in the UI.
65. As a maintainer, I want one shared renderer codebase, so that Web Arcade and Desktop Arcade do not drift.
66. As a maintainer, I want shell differences expressed through capabilities, so that components do not accumulate scattered platform checks.
67. As a maintainer, I want Web Arcade capabilities to enable Share URL and disable Agent sessions, so that Web behavior is explicit.
68. As a maintainer, I want Desktop Arcade capabilities to enable Agent sessions and disable Share URL, so that Desktop behavior is explicit.
69. As a maintainer, I want a swappable Agent transport boundary, so that loopback HTTP can be replaced if security concerns appear.
70. As a maintainer, I want the Agent bridge command contract independent from HTTP details, so that command validation and session behavior can be tested without a socket.
71. As a maintainer, I want the loopback HTTP adapter to be one transport implementation, so that future Unix socket, named pipe, MCP, or helper adapters do not rewrite Agent sessions.
72. As a maintainer, I want the Desktop Arcade renderer to stay browser-like, so that Electron does not give broad Node access to React components.
73. As a maintainer, I want desktop capabilities exposed through narrow preload IPC, so that security boundaries are explicit.
74. As a maintainer, I want one active Agent session tied to one active window and current Arcade project in v1, so that routing and consent stay simple.
75. As a maintainer, I want macOS-first validation with cross-platform architecture, so that the immediate Copilot desktop app workflow can be tested without blocking on every packaging target.
76. As a security reviewer, I want the loopback endpoint bound only to localhost, so that it is not exposed to the LAN.
77. As a security reviewer, I want the Agent transport off until the user starts Agent access, so that there is no always-listening local service.
78. As a security reviewer, I want random ports and unguessable credentials, so that unauthorized local requests are hard to guess.
79. As a security reviewer, I want credentials cleared on stop, reload, and quit, so that authorization is short-lived.
80. As a security reviewer, I want no token in URLs, so that credentials do not appear in browser history, logs, screenshots, or copied links.
81. As a security reviewer, I want no file-system, shell, share/export, or package commands on the Agent transport, so that the endpoint cannot become a general desktop automation surface.
82. As a security reviewer, I want package import/export separate from Agent transport, so that project sharing does not create agent authorization.
83. As a security reviewer, I want no cloud relay in v1, so that Arcade project state is not routed through new infrastructure.
84. As a security reviewer, I want no remote or LAN pairing in v1, so that the trust boundary stays same-device.
85. As a future product designer, I want the Desktop Agent transport to support provider-neutral agents through a protocol, so that the UI can stay simple while examples evolve.
86. As a future product designer, I want MCP left as a possible adapter rather than a v1 requirement, so that the first workflow can prove value before adopting a larger ecosystem surface.

## Implementation Decisions

- Keep Web Arcade and Desktop Arcade in the same product context with one shared renderer and one shell-neutral Arcade project model.
- Add a shell capabilities deep module that exposes product-surface capabilities such as Agent sessions, Share URL, and Arcade project package affordances. Components should consume capabilities rather than checking for Electron directly.
- Configure Web Arcade capabilities so Share URL is available, Agent sessions are unavailable, and Agent session runtime is not initialized.
- Configure Desktop Arcade capabilities so Agent sessions are available, Share URL is unavailable, and Arcade project package affordances are enabled.
- Add Desktop Arcade as a desktop shell around the shared renderer rather than forking the app or moving the workspace into a separate repo.
- Keep the Desktop Arcade renderer browser-like: no broad Node access, no direct socket/process/file capabilities in React components, and desktop-only operations exposed through narrow preload IPC.
- Preserve the existing editor panel, code preview panel, preview diagnostics, sandbox runtime, Aksel component usage, templates, and Arcade authoring contract across Web Arcade and Desktop Arcade.
- Keep Agent sessions Desktop Arcade-only. Web Arcade should not show the Agent menu button, publish a browser-global Agent bridge, initialize hidden Agent runtime, or own Web-facing Agent access affordances; Agent UI/runtime modules should load from Desktop-only entry points where practical, and the superseded browser-global Agent bridge should be removed entirely rather than kept as a Desktop debugging or routing surface.
- Do not require a byte-perfect Web bundle with zero Agent strings unless separate Web/Desktop bundling already makes that natural; the required boundary is no Web Agent UI, runtime initialization, bridge publication, or Web-facing Agent docs.
- Preserve the existing Agent bridge validation semantics. The Desktop Agent transport should route to the same conceptual bridge commands rather than introduce a second desktop-specific agent API, but the mutation command should be renamed to `applyAgentChange` to match the **Agent change** domain term.
- Expose only the existing Agent bridge commands over the Desktop Agent transport: project reads, preview context reads, diagnostics reads, Preview evidence reads, session state reads, and Agent changes.
- Keep Agent changes as immediate apply-after-validation without Checkpoints or rollback, preserving live-preview review while following ADR-0005. Do not introduce staged proposal validation as part of the desktop pivot.
- Do not add an Agent-specific replacement recovery path, command log, accepted-change history, or persisted Agent change telemetry as part of this removal.
- Keep Agent change summaries in the command contract only; do not display them in Desktop Arcade UI without a future explicit history/activity feature.
- Return only `changedFields` from successful `applyAgentChange` calls; do not return Checkpoint identifiers, echoed summaries, or new change-record identifiers.
- Remove Checkpoint-related type names and APIs completely, including Checkpoint list items, restore callbacks, result identifiers, rollback collection names, UI labels, and tests.
- Rename broad mutation request/result types from source-only wording to Agent change wording, while keeping source-specific field types only where they truly refer to JSX/Hooks source.
- Keep `AgentSessionMenu` and `useAgentSession` naming because the Agent session concept remains; remove only their Checkpoint and rollback responsibilities.
- Keep Agent permissions all-on while a Desktop Agent session is active for v1. The menu remains simple, and copied instructions accurately reflect the active capabilities.
- Add a Desktop Agent session coordinator deep module that owns active/inactive state, session identifiers, pairing credential lifecycle, one active session, session cleanup on stop/reload/quit/project replacement, and communication with the renderer bridge.
- Add an Agent transport interface deep module that accepts authenticated command requests and returns normalized command results independent of any concrete transport technology.
- Implement loopback HTTP JSON-RPC as the first Agent transport adapter. It is a same-device adapter, not the Agent bridge itself.
- Bind the loopback adapter only to localhost, choose a random available port per active Agent session, and keep the endpoint off when Agent access is inactive.
- Require an unguessable Agent pairing credential for every transport request. The credential must be short-lived and scoped to one active Agent session.
- Send the Agent pairing credential only through an Authorization header. Do not accept credentials in query parameters.
- Shut down the loopback adapter and invalidate the credential when the user stops Agent access, Desktop Arcade reloads, Desktop Arcade quits, or the active Arcade project is explicitly replaced.
- Keep the transport adapter boundary explicit so loopback HTTP can later be replaced or supplemented by Unix sockets, named pipes, MCP, or a command helper without rewriting Agent session behavior.
- Use a custom minimal JSON-RPC protocol first. MCP is a possible later adapter, not the v1 protocol requirement.
- Map JSON-RPC method names one-to-one to Agent bridge command names. The protocol should remain thin and should not rename or reinterpret bridge commands; stale rollback-era `applySourceChange` calls should fail as unsupported rather than being shimmed.
- Reject unauthenticated, expired, malformed, unsupported, or out-of-session transport requests with structured errors.
- Do not expose file-system, shell, Share URL, export, import, package creation, project package opening, or desktop window commands through the Agent transport in v1.
- Keep Preview evidence as the existing sanitized DOM/layout/frame evidence for v1. Do not add Electron screenshot capture as part of this PRD.
- Keep the Agent menu as the user-facing Desktop Agent access surface. It contains start/stop access, simple active/inactive status, concise consent copy that the paired agent can read and change the active Arcade project while access is active, a hidden Agent pairing handoff copy action, and copy feedback; it does not contain Checkpoints, rollback, or Agent-specific history.
- Keep the copied Agent pairing handoff hidden from the user during normal operation. Copying places the handoff on the clipboard; the menu does not render the endpoint or credential.
- If copying the hidden Agent pairing handoff fails, show copy failure feedback and allow retry. Do not automatically reveal the handoff or token.
- Return compact Agent operating instructions through the bridge after the copied bootstrap request. The instructions are the authoritative Desktop Arcade operating guide for the active session: call `getProject` first, use import-free Arcade JSX and Hooks rather than file edits, use `getPreviewContext`, `getDiagnostics`, and `getPreviewEvidence` for feedback, send full-field replacements through `applyAgentChange({ summary, jsxCode?, hooksCode?, viewportSize?, theme?, name? })` that apply immediately to the human-visible Arcade project, and validate by polling diagnostics until the preview settles before using Preview evidence when permitted.
- Keep Agent operating instructions content-free. They should not include active Arcade project source; External agents read project content through `getProject`.
- Keep Agent operating instructions provider-neutral. Mention GitHub Copilot app, Copilot CLI, and Copilot in VS Code in validation notes and documentation, not as protocol-specific behavior.
- Do not add a new machine-readable workflow field until an actual External agent or tool can consume it; use `instructionsMarkdown` plus the existing structured session, protocol, permission, command, and authoring-contract fields.
- Remove obsolete long-form instruction helpers when implementing Agent operating instructions instead of keeping a parallel copied-prompt path.
- Keep Copilot agent surfaces as key test targets but do not make the protocol Copilot-specific. Provider-neutral means any same-device External agent that can use the protocol can connect.
- Do not add in-app LLM chat, provider SDK calls, provider credential storage, or backend LLM mediation.
- Keep one active Agent session tied to one active window and one current Arcade project in v1.
- Keep Desktop persistence as the current single-current-project model for this PRD. Do not turn Desktop Arcade into a multi-document app with Save, Save As, and recent files as part of the Agent transport pivot.
- Make Arcade project packages the canonical cross-shell sharing artifact. Export `.akselarcade` by default and accept both `.akselarcade` and legacy `.json` imports.
- Keep Arcade project package contents focused on the portable Arcade project and optional AI enrichment metadata. Exclude Agent sessions, Agent pairing credentials, endpoint details, Agent permissions, Agent-specific history, diagnostics, Preview evidence, and transport metadata.
- Treat package `aiInstructions` metadata as copied-out production guidance, not Web Arcade Agent access; keep the existing field name unless a separate package-format cleanup changes it.
- Keep Share URL Web Arcade-only. Desktop Arcade should not generate URL payloads as a sharing path.
- Update security documentation narrowly for Desktop-only Agent access: same-device loopback transport, localhost binding, short-lived credentials, no Web Agent access, no browser-global Agent bridge, and no Checkpoint/rollback guarantee.
- Validate macOS first with the GitHub Copilot desktop app because it is the immediate test environment, while keeping the architecture cross-platform where possible.
- Treat `docs/prd/0028-agent-sessions.md` as historical context for the browser-only MVP direction. This PRD supersedes its browser-only Agent session assumptions.
- Respect ADR-0003 for the Desktop Agent transport pivot and ADR-0005 for removing Agent session Checkpoints and rollback.

## Testing Decisions

- Good tests should assert external behavior and user-visible outcomes rather than implementation details. The important guarantees are that Web Arcade has no visible or initialized Agent session behavior, Desktop Arcade can start and stop Agent access safely, External agents can only call authorized bridge commands, Agent changes preserve immediate apply-after-validation semantics, and shared packages never contain Agent session secrets.
- Unit-test the shell capabilities module so Web Arcade and Desktop Arcade expose the intended capability matrix.
- Unit-test the Desktop Agent session coordinator for start, stop, reload, quit cleanup, one-session behavior, credential invalidation, and active/inactive status.
- Unit-test the Agent transport interface with a fake adapter to prove command routing and authentication can be tested without loopback networking.
- Unit-test the loopback HTTP JSON-RPC adapter for localhost binding, random-port lifecycle, Authorization header requirements, rejection of missing or invalid credentials, malformed JSON-RPC payloads, unsupported methods, and shutdown behavior.
- Unit-test the Agent bridge command router for one-to-one command mapping, structured success and failure shapes, and rejection of non-bridge commands.
- Unit-test the copied Agent pairing handoff and bridge-returned Agent operating instructions with behavioral assertions rather than exact Markdown snapshots: provider-neutral behavior, Authorization header usage, no query-token examples, available command names, hidden handoff contents, content-free operating guidance, no long curl examples, and the `getProject`-first workflow.
- Unit-test the Agent menu copy behavior for success, failure, retry, and no automatic prompt reveal.
- Unit-test Arcade project package export for `.akselarcade` defaults and exclusion of Agent session state, credentials, endpoint information, Agent-specific history, diagnostics, Preview evidence, and transport metadata.
- Unit-test Arcade project package import for `.akselarcade` and legacy `.json` compatibility.
- Integration-test Web Arcade rendering with small negative boundary coverage to prove the Agent button/menu is absent, no browser-global Agent bridge is published, no Agent runtime initializes, and normal Web sharing/import/export still works.
- Integration-test Desktop Arcade rendering with Desktop capabilities to prove the Agent menu is present, status is active/inactive, and the Share URL UI is absent.
- Integration-test Desktop Agent access start/stop through the menu and verify transport availability follows the active session.
- Integration-test authenticated JSON-RPC calls against the active session for `getProject`, `getPreviewContext`, `getDiagnostics`, `getPreviewEvidence`, `getSessionState`, and `applyAgentChange`.
- Integration-test unauthenticated and stale-token JSON-RPC calls to prove they fail after stop, reload, or credential invalidation.
- Integration-test Agent changes through the Desktop transport to prove the editor state, preview settings, and diagnostics flow follow the Desktop Agent bridge behavior without creating Checkpoints.
- Integration-test explicit project replacement while Agent access is active to prove credentials are revoked before the new Arcade project is exposed.
- Integration-test that invalid Agent changes through the Desktop transport reject before mutation.
- Integration-test that Desktop project packages exclude all Agent session and transport state after an Agent session has been active.
- E2E-test Desktop Arcade on macOS for the happy path: start Agent access, copy hidden instructions, connect with a local request using the copied authorization shape, read project state, apply a small Agent change, inspect diagnostics, and stop access.
- E2E-test Web Arcade for regression safety: normal editing, preview, import/export, and Share URL behavior still work with Agent features disabled.
- Prior art in the codebase includes unit tests for storage, share encoding/decoding, compression strategies, security message validation, snapshot packing, diagnostics, and Preview evidence; integration tests for header controls, share popovers, settings, sandbox behavior, Agent menu behavior, and inspection popovers; and Playwright E2E coverage for share links, themes, autocomplete, component palette behavior, inspect overlays, and sandboxed Aksel rendering.

## Implementation Progress

These notes are historical implementation context. Entries before ADR-0005 may describe Checkpoint behavior that the current plan now removes.

- 2026-05-27 - Issue #55 added `src/services/shellCapabilities.ts` as the reusable shell capability boundary for Web Arcade and Desktop Arcade. Web Arcade enables Share URL and disables Agent sessions; Desktop Arcade enables Agent sessions, disables Share URL, and keeps Arcade project package affordances explicit for the later package issues.
- `App` now receives the resolved shell capability set from bootstrap, defaulting to Web Arcade when rendered outside Electron. `AppHeader` consumes capabilities instead of checking Electron, browser globals, or URL state, so the normal web surface shows Share URL without Agent access while Desktop Arcade shows Agent access without Share URL.
- Added unit coverage for the Web/Desktop capability matrix and integration coverage for the header behavior in both capability modes. Existing Desktop Agent bridge coverage now runs against the Desktop capability set.

- 2026-05-27 - Issue #59 added a macOS-first Electron development shell around the shared renderer. `npm run desktop:dev` starts Vite on the first available `127.0.0.1` port from `5173` and launches `desktop/main.cjs` against that exact renderer URL, which loads the existing workspace with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and a locked-down navigation policy.
- `desktop/preload.cjs` exposes only `window.__AKSEL_ARCADE_DESKTOP__.getShellCapabilities()` over the `aksel-arcade:get-shell-capabilities` IPC channel. The renderer now resolves Desktop Arcade capabilities only from that narrow preload bridge; normal browser pages ignore Desktop-looking globals and stay Web Arcade, while Electron without the preload bridge refuses to render Web Arcade.
- Added preload-capability unit coverage to prove Desktop Arcade capabilities come from the IPC bridge, normal browser pages remain Web Arcade, Electron without preload fails closed, and malformed/Web preload payloads are rejected instead of giving React arbitrary desktop state.

- 2026-05-27 - Issue #65 exposed `applySourceChange` through the authenticated Desktop Agent transport by widening the renderer transport protocol route from read-only bridge methods to all supported Agent bridge command names.
- JSON-RPC `params` for `applySourceChange` now flow through the existing Agent bridge mutation validator, so source, preview setting, and project metadata replacements use the same apply-then-review path, size checks, structured errors, diagnostics flow, and Checkpoint creation as the browser bridge compatibility wrapper.
- Non-bridge desktop automation methods such as filesystem, shell, Share URL, export/import/package, rollback, and window-management requests remain rejected as unsupported transport methods. Copied hidden instructions now list all supported JSON-RPC methods and include an authenticated change example.
- Added protocol and menu integration coverage for accepted transport changes, validation rejection before mutation, unsupported methods, stale renderer-session mismatch, and normal preview/project state updates after a transport Agent change.

- 2026-05-27 - Issue #66 proved human-controlled rollback for Desktop transport Agent changes. Accepted transport `applySourceChange` calls return Checkpoint identifiers and surface the Checkpoint in the Agent menu, while rollback remains available only through the human menu action.
- Added Desktop transport integration coverage for source, Hooks, preview setting, and metadata restoration from the Agent menu after an authenticated transport change.
- Added protocol coverage that `restoreCheckpoint` and `deleteCheckpoint` remain unsupported JSON-RPC methods, so External agents can see reported Checkpoint identifiers but cannot restore or delete Checkpoints through the transport.
- Added session safety coverage that stops Agent access and confirms local rollback entries are cleared from the Agent menu.

- 2026-05-27 - Issue #57 changed the default project export into an Arcade project package. Downloads now use the `.akselarcade` extension and a package envelope with `aksel-arcade/project-package` format metadata.
- Package contents are built by enumerating the portable Arcade project fields: project identity, editable source, viewport, panel layout, timestamps, and optional AI enrichment metadata. Local Agent session state, pairing credentials, endpoints, permissions, Agent-specific history, diagnostics, Preview evidence, and transport state are not copied into the package envelope.
- Web Arcade Share URL remains a separate web-only sharing path. Share URL oversize copy now points users to package export rather than JSON export.
- Added unit and integration coverage for package filename/MIME/shape, current project content, optional Aksel metadata, Desktop export fallback behavior, and Agent artifact exclusion.

- 2026-05-27 - Issue #68 recorded the human-in-the-loop validation pass for the copied Desktop Agent instructions with GitHub Copilot app on macOS, Copilot CLI, and Copilot in VS Code.
- Each validated surface used Desktop Arcade Agent access to copy the hidden instructions, read Arcade project state, read diagnostics or Preview evidence, apply a small visible Agent change, review the live preview, and stop Agent access.
- Validation kept the instructions provider-neutral and did not add Copilot-specific protocol behavior. Follow-up issues #83 and #84 record the post-change preview settling guidance gap and sandbox render diagnostics gap instead of changing the PRD requirements.

## Out of Scope

- Editing the historical browser-only Agent sessions PRD.
- Keeping Agent sessions visible or initialized in Web Arcade.
- Continuing URL sharing in Desktop Arcade.
- Browser extension support.
- Browser Apple Events automation.
- Extension-plus-native-connector transport.
- Always-on local services.
- LAN, remote, or cloud Agent pairing.
- Cloud relay infrastructure.
- In-app LLM chat.
- Direct provider SDK integration.
- Provider credential storage.
- Backend persistence or server APIs.
- MCP as the first Agent transport implementation.
- A globally installed helper command as a v1 requirement.
- Agent access to file-system, shell, export/import, Share URL, project package, or window-management commands.
- Staged proposal validation UI for Agent changes.
- Text patch APIs, cursor edits, editor selection control, or active-tab control for agents.
- Agent-specific Checkpoints, rollback, or replacement recovery history.
- Persistent trusted agents or reconnect across Desktop Arcade restarts.
- Multiple simultaneous Desktop Arcade windows with independent Agent sessions.
- Turning Desktop Arcade into a full document app with Save, Save As, recent files, and multi-file persistence.
- Desktop screenshot capture as Preview evidence in v1.
- Windows and Linux packaging/signing as first validation blockers.
- A user-visible Agent command log in v1.

## Further Notes

This PRD uses the domain language from the Aksel Arcade glossary: Web Arcade, Desktop Arcade, Arcade project, Arcade project package, Agent access, Agent session, Agent bridge, Agent transport, Agent pairing, Agent pairing handoff, Agent operating instructions, Agent pairing credential, External agent, Copilot agent surface, Arcade-scoped state, Preview evidence, Arcade authoring contract, and Agent change.

The main architectural trade-off is that Desktop Arcade accepts a short-lived local loopback transport because the Electron shell can own local capabilities more safely than Web Arcade, while the renderer stays browser-like and the transport remains swappable. The main product trade-off is that Web Arcade and Desktop Arcade keep the same creation workspace, but Agent access becomes a Desktop Arcade differentiator instead of a browser feature.

The prior browser-only Agent session work remains useful as the command contract and safety model. This PRD changes how External agents reach the Agent bridge, not what the Agent bridge is allowed to do.

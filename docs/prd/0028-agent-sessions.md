# PRD: Agent sessions for Aksel Arcade

> Superseded for current planning: Web Arcade no longer supports Agent access, and Desktop Arcade Agent sessions no longer include Checkpoints or rollback. See `docs/prd/0029-desktop-arcade-agent-transport.md` and `docs/adr/0005-remove-agent-checkpoints.md` for the current direction.

## Problem Statement

Aksel Arcade is already a high-signal environment for creating Aksel-based React prototypes: it has the active Arcade project, JSX and Hooks source, preview preferences, compile and runtime diagnostics, Aksel metadata, share/export packaging, and a live sandboxed preview. External LLMs and coding agents can use that context to produce useful UI changes, but today they have no intentional way to work in the active browser session.

Without an Agent session, a human must copy code back and forth, use share/export as a handoff workaround, or let an agent automate the UI through brittle DOM interactions. That breaks the intended co-creation workflow: the human and agent should be working against the same active Arcade project, with clear consent, constrained permissions, live preview review, and a human-controlled rollback path.

## Solution

Add browser-only Agent sessions to Aksel Arcade. A human starts or stops an Agent session from a header ActionMenu, copies agent instructions into their external agent chat, and can stop access at any time. While active, Aksel Arcade enables all Agent permissions by default and exposes a temporary `window.__AKSEL_ARCADE_AGENT_BRIDGE__` bridge that lets the external agent read Arcade-scoped state, inspect diagnostics, request scoped Preview evidence, and apply allowed Agent changes.

Agent changes use apply-then-review with rollback. The bridge validates payload shape, permissions, project size, and enum values before mutating the active Arcade project. It does not compile-gate or render-gate the change. Instead, Aksel Arcade creates an automatic Checkpoint before every accepted Agent change, applies the allowed full-field replacements atomically, and lets the human review the result in the live preview. If the human does not want the result, they restore a Checkpoint from the Agent ActionMenu.

The MVP keeps the feature browser-only. It does not introduce in-app LLM provider calls, a backend, localhost bridge, MCP connector, browser extension, staged proposal validation UI, text patching, cursor editing, persisted trusted agents, checkpoint sharing by default, or an in-app screenshot capture dependency.

## User Stories

1. As an Arcade user, I want to start an Agent session from Aksel Arcade, so that I can let an external agent work on my active Arcade project.
2. As an Arcade user, I want Agent access to be off until I explicitly start it, so that no agent can interact with my Arcade project without consent.
3. As an Arcade user, I want to stop an Agent session immediately, so that I can revoke access whenever I want.
4. As an Arcade user, I want Agent access to disappear on page reload, so that access does not persist accidentally.
5. As an Arcade user, I want the Agent controls near the existing settings controls, so that I can find them without leaving the editor and preview workspace.
6. As an Arcade user, I want Agent controls in an ActionMenu, so that the feature stays lightweight and does not take over the workspace.
7. As an Arcade user, I want the Agent session start/stop control to use an ActionMenu checkbox item with the static label "Agent-tilgang", so that it fits the Aksel component constraints and does not change meaning while toggled.
8. As an Arcade user, I want Agent capabilities enabled automatically while access is active, so that the menu stays simple and the copied instructions match what the agent can do.
9. As an Arcade user, I want source changes enabled by default, so that the main agent co-creation workflow works immediately.
10. As an Arcade user, I want preview setting changes enabled by default, so that the agent can adjust viewport and theme while designing.
11. As an Arcade user, I want Preview evidence capture enabled by default, so that the agent can inspect the rendered result when needed.
12. As an Arcade user, I want project metadata changes enabled by default while Agent access is active, so that the agent can keep names aligned with the work when needed.
13. As an Arcade user, I want the menu to explain that reading Arcade-scoped state is mandatory while active, so that I understand the baseline access.
14. As an Arcade user, I want the menu status translated to Norwegian and limited to active/inactive, so that it is easy to understand.
15. As an Arcade user, I want the status to avoid pretending there is a persistent connection or separate revoked state, so that I do not get misleading connected/disconnected signals.
16. As an Arcade user, I want to copy agent instructions from an ActionMenu item, so that I can paste the correct bridge contract into my external agent chat.
17. As an Arcade user, I want copied agent instructions to include the bridge name, commands, active permissions, and Arcade authoring contract, so that the external agent knows how to interact safely.
18. As an external agent, I want to detect the browser bridge only while an Agent session is active, so that I know whether I am authorized to work.
19. As an external agent, I want to read the current Arcade project, so that I can understand the source I am editing.
20. As an external agent, I want to read preview settings, so that I can account for the active viewport and theme.
21. As an external agent, I want to read diagnostics, so that I can respond to compile errors, runtime errors, preview status, and sandbox console output.
22. As an external agent, I want to request scoped Preview evidence, so that I can inspect the rendered preview without scraping the whole Arcade UI.
23. As an external agent, I want Preview evidence to include useful layout and style facts, so that I can reason about visual problems.
24. As an external agent, I want Preview evidence to exclude browser state and unrelated page data, so that I stay within the user's consent boundary.
25. As an external agent, I want to apply full replacements for JSX and Hooks source, so that I can make coherent React changes without fragile cursor operations.
26. As an external agent, I want to apply preview setting replacements when permitted, so that I can adjust viewport or theme as part of the design workflow.
27. As an external agent, I want to apply project name replacements only when permitted, so that I respect the human's metadata control.
28. As an external agent, I want to include a human-readable summary with each Agent change, so that rollback history is understandable.
29. As an external agent, I want rejected commands to return structured errors, so that I can retry with a valid request.
30. As an external agent, I want disallowed-field changes to reject as a whole, so that I do not accidentally create partial edits.
31. As an Arcade user, I want Agent changes to be applied atomically, so that I never see half-applied code, theme, viewport, or name updates.
32. As an Arcade user, I want malformed Agent changes rejected before mutation, so that invalid bridge calls do not corrupt my Arcade project.
33. As an Arcade user, I want oversized Agent changes rejected before mutation, so that local storage and share/export limits are protected.
34. As an Arcade user, I want unsupported viewport and theme values rejected before mutation, so that the app remains in valid UI states.
35. As an Arcade user, I want every accepted Agent change to create a Checkpoint first, so that I can return to the previous Arcade project state.
36. As an Arcade user, I want rollback to be human-only, so that an agent cannot undo work without my instruction.
37. As an Arcade user, I want rollback history in the Agent menu, so that I can restore a recent Checkpoint without leaving the workspace.
38. As an Arcade user, I want rollback history capped, so that an Agent session does not become an unbounded version history system.
39. As an Arcade user, I want Checkpoints to restore changed project and preview fields, so that rollback reverses the agent's effect without changing session controls.
40. As an Arcade user, I want Checkpoints excluded from share/export by default, so that handoff artifacts stay focused on the current Arcade project.
41. As an Arcade user, I want the live preview to show the effect of Agent changes, so that I can review the result in the same way I review my own edits.
42. As an Arcade user, I want compile and runtime errors to appear through the normal preview flow after Agent changes, so that I do not need a separate proposal validation UI.
43. As an Arcade user, I want the feature to use the same Arcade authoring contract for humans and agents, so that agent-authored code is not a special runtime mode.
44. As an Arcade user, I want agents blocked from introducing unsupported imports or expanded network access, so that the sandbox remains constrained.
45. As an Arcade user, I want share/export to remain a fallback rather than an Agent bridge command, so that the MVP stays focused on active co-creation.
46. As an Arcade user, I want in-app LLM provider calls out of scope, so that my code is not sent to third parties by default.
47. As an Arcade maintainer, I want the Agent session logic isolated behind deep modules, so that permissions, validation, Checkpoints, and bridge behavior can be tested without rendering the full app.
48. As an Arcade maintainer, I want the Agent UI to reuse existing Aksel primitives, so that the feature follows the rest of the product's interaction patterns.
49. As an Arcade maintainer, I want recent sandbox console output captured in app state, so that diagnostics can serve both humans and agents.
50. As an Arcade maintainer, I want Preview evidence sanitization to be deterministic, so that tests can assert behavior without depending on browser internals.

## Implementation Decisions

- Build an Agent session state module as a deep module. It owns whether the Agent session is active, the all-on default Agent permissions, simplified status derivation, Checkpoint creation, Checkpoint capping, and human rollback.
- Build an Agent bridge module as a deep module. It owns installing and removing `window.__AKSEL_ARCADE_AGENT_BRIDGE__`, exposes the bridge commands, normalizes return shapes, records activity, and delegates mutation only through validated session operations.
- Build an Agent change validator as a deep module. It accepts unknown bridge input and returns either a valid Agent change or a structured error. It enforces payload shape, allowed fields, project size, enum values, and permission requirements before mutation.
- Use full-field replacements only for Agent changes. The allowed replacements are project name, JSX source, Hooks source, viewport, and theme, plus a human-readable summary. Text patches, cursor edits, editor selection changes, active tab changes, panel layout changes, settings changes, share data, and export data are not part of the Agent change contract.
- Reject an Agent change as a whole when it contains a field that is not permitted. Do not apply the allowed subset.
- Apply accepted Agent changes atomically. A Checkpoint is captured before mutation, allowed replacements are applied together, and the command returns the changed fields and Checkpoint id immediately.
- Do not wait for preview compilation or rendering inside the apply command. Diagnostics and Preview evidence are separate read commands.
- Keep Checkpoints in memory for the active Agent session only. Cap rollback history at 10 automatic Checkpoints. Clear history on page reload or when the session ends.
- Make rollback human-only. The bridge may report Checkpoint ids, but it does not expose a restore command to agents.
- Restore only fields affected by Agent changes: project source/name and preview theme/viewport. Do not restore Agent permissions, session status, or rollback history as part of rollback.
- Build a diagnostics collector that returns preview status, compile error, runtime error, and recent sandbox console messages in a structured shape.
- Store recent sandbox console messages in app state instead of only forwarding them to the developer console. Keep this bounded to prevent unbounded memory growth.
- Build a Preview evidence serializer as a deep module. It reads only the sandboxed preview frame and returns sanitized evidence.
- The bridge-provided Preview evidence includes a sanitized element tree and frame metadata. Screenshots and accessibility-tree snapshots are expected to come from external browser automation tools when available, not from a new in-app screenshot dependency.
- Sanitized Preview evidence includes tag names, text content, Aksel/data attributes, class names, bounding boxes, and selected computed layout/style values. It excludes scripts, event handlers, React internals, full CSS text, arbitrary object props, browser cookies, local storage, clipboard data, and unrelated Arcade UI DOM.
- Keep the Agent bridge browser-only for MVP. Do not add in-app provider calls, server persistence, a backend API, a localhost process, MCP, or browser extension support.
- Expose the bridge only while an Agent session is active. Remove it when the human stops the Agent session and rely on page reload to clear it naturally.
- Add a new Agent ActionMenu button immediately left of the settings cog. The ActionMenu contains a static `Agent-tilgang` start/stop checkbox, simplified Norwegian status, context copy guidance, rollback history, and Copy agent instructions.
- Use `ActionMenu.CheckboxItem` for the start/stop control and `ActionMenu.Item` for copying agent instructions. Do not expose separate permission controls in the menu.
- Reading Arcade-scoped state is mandatory while an Agent session is active and is explained in the ActionMenu rather than exposed as a permission toggle.
- Status is simplified and translated for the UI: `Status: inaktiv` when access is off and `Status: aktiv` when access is on. Do not show a separate revoked state or imply durable socket connectivity.
- Copy agent instructions includes the bridge global name, command names, active permission state, the Arcade authoring contract, and the reminder that the human must start access before the bridge exists.
- Preserve existing share/export behavior. Do not add bridge commands for share URL generation or JSON export. Exclude Checkpoints from share/export by default.
- Respect the existing ADRs: the MVP uses a browser-only page bridge, and Agent changes use apply-then-review with rollback.

## Implementation Progress

### 2026-05-25 - Issue #32 Copy agent instructions and read Arcade-scoped state

Completed:

- Selected #32 as the highest-priority `ready-for-agent` feature from #32-#38 because it is the first unblocked capability after #31; #33-#38 depend on #32 directly or through the later Agent bridge chain.
- Added copyable external-agent instructions to the Agent menu, including the bridge global, available read commands, active permission state, the Arcade authoring contract, scoped-read boundaries, and the reminder that the human must start Agent access before the bridge exists.
- Added active bridge read commands: `getProject()`, `getPreviewContext()`, and `getSessionState()`. They return only Arcade-scoped project source/name, preview theme/viewport, session status, active permissions, read scope, and command names.
- Kept read commands out of share/export/browser state by not exposing share payloads, export data, browser storage, clipboard data, cookies, or unrelated page state.
- Updated Agent status after bridge read activity and preserved revoked-session errors for stale bridge references after access is stopped.
- Added integration coverage for instruction contents, bridge absence before start, active read command success, revoked-session read errors, activity recording, and scoped read shape.
- PR #40 code review follow-up tightened and covered current-state reads: captured bridge references now report updated project source/name, preview theme/viewport, and active permission state after in-session changes.
- PR #40 build follow-up fixed the failing `tsc -b` path by removing test variables assigned only inside `act()` callbacks; bridge command calls now use a typed helper so build-mode control-flow analysis can prove assignment and union narrowing.

Next:

- #33 can build source replacement, automatic Checkpoints, and human rollback on top of the read command/session primitives.

### 2026-05-26 - Issue #35 Allow permitted preview and metadata replacements

Completed:

- Selected #35 as the highest-priority `ready-for-agent` feature from #35-#38 because #34 is closed, #35 is the next guarded mutation capability in the PRD chain, and it unlocks the later Preview evidence work in #37.
- Extended the existing guarded `applySourceChange({ summary, ... })` path to accept full-field replacements for `viewportSize`, `theme`, and `name` in addition to `jsxCode` and `hooksCode`.
- Kept Agent permissions atomic by requiring `sourceChanges` for source fields, `previewSettings` for viewport/theme fields, and `projectMetadata` for project name replacement. Metadata remains disabled by default.
- Validated unsupported fields, invalid viewport/theme values, invalid names, malformed source fields, missing summaries, empty changes, and oversized project updates before mutation.
- Created a Checkpoint before every accepted Agent change, including preview-only and metadata-only changes, and extended human rollback to restore only the changed source/name/viewport/theme fields.
- Updated copied Agent instructions and menu coverage so active sessions can toggle source, preview setting, Preview evidence, and metadata permissions.
- Added integration coverage for permission defaults/toggles, preview setting replacement, metadata default denial and opt-in apply, combined source/preview/metadata apply, whole-change rejection, invalid enum/name handling, Checkpoint capping, and rollback of combined changes.

Next:

- #36 can expose diagnostics from compile/runtime/console preview state without changing the mutation contract.
- #37 can build sanitized Preview evidence on top of the now-permitted preview-setting workflow.

### 2026-05-26 - PR #45 code review follow-up

Fixed after reviewing PR #45:

- Found that rapid sequential Agent changes could create a later Checkpoint from stale pre-render state, causing human rollback to jump back too far.
- Synchronized the Agent session's current project/preview refs immediately after accepted Agent changes and human rollback, so subsequent bridge calls capture the latest accepted state even before React flushes a render.
- Added regression coverage that applies two Agent changes in the same React act batch, restores the second Checkpoint back to the first change, then restores the first Checkpoint back to the original source.

Verification completed with `npm run typecheck`, `npm run test -- --run`, `npm run build`, and a browser smoke/console check at `http://127.0.0.1:5177/aksel-arcade/`.

### 2026-05-26 - Issue #36 Return diagnostics with bounded sandbox console history

Completed:

- Selected #36 as the highest-priority `ready-for-agent` feature from #36-#38 because #35 is complete, diagnostics are the next PRD feedback-loop capability, and agents need compile/runtime/console visibility before Preview evidence and share/export hardening.
- Added bounded sandbox console history to preview state so recent sandbox `log`, `warn`, and `error` output is retained as sanitized strings with capped message count, argument count, and argument length.
- Added the active bridge read command `getDiagnostics()`, returning only Arcade-scoped preview diagnostics: preview status, compile error, runtime error, and bounded sandbox console messages.
- Updated copied Agent instructions and command discovery so external agents know to use `getDiagnostics()` after accepted changes.
- Marked accepted source changes as `transpiling` immediately in diagnostics while the debounced preview pipeline reprocesses, avoiding stale pre-change diagnostics in the post-apply gap.
- Preserved apply-then-review behavior: schema-valid Agent changes that later fail compilation or rendering still apply, and diagnostics reports the normal preview errors afterward.
- Added unit coverage for diagnostics normalization/bounding/cloning and integration coverage for command shape, diagnostics read activity, revoked-session errors, runtime error diagnostics, bounded console history, and compile error diagnostics after accepted invalid source.

Next:

- #38 should keep share/export regression coverage focused on excluding Agent session state, permissions, activity, bridge metadata, and Checkpoints.

### 2026-05-26 - Issue #37 Return sanitized Preview evidence from the sandbox

Completed:

- Selected #37 as the single feature to implement because #35 and #36 are complete, making the permission and diagnostics bridge foundations available for Preview evidence.
- Added a bounded deterministic Preview evidence serializer that reads the sandboxed Preview iframe root only and returns frame metadata plus a sanitized element tree.
- Included useful visual facts for external agents: tag names, direct text content, sorted class names, allowed `id`/`role`/`title`/`aria-*`/`data-*` attributes, bounding boxes, viewport/scroll metadata, and selected computed layout/style values.
- Excluded unsafe or unrelated data from evidence: scripts, styles, handlers, React internals, full CSS text, arbitrary object props, browser storage/cookies/clipboard references, and outer Arcade UI DOM.
- Added the active Agent bridge command `getPreviewEvidence()`, gated by the existing `previewEvidence` permission, with structured `permission-denied`, `preview-unavailable`, and `session-revoked` failures.
- Updated copied Agent instructions and command discovery so external agents know to request sanitized Preview evidence only through the bridge command.
- Added unit and integration coverage for deterministic serialization, included layout facts, excluded unsafe data, permission denial without evidence, revoked-session errors, and read activity recording.

Next:

- #38 should keep share/export regression coverage focused on excluding Agent session state, permissions, activity, bridge metadata, Preview evidence, and Checkpoints.

### 2026-05-26 - Issue #38 share/export fallback and PR #49 build follow-up

Completed:

- Kept Share URL generation and Export JSON as human-triggered fallback flows only; the active Agent bridge still exposes no share/export commands or properties.
- Changed Share URL snapshot generation and share refresh fingerprinting to use the current Arcade project viewport, so accepted Agent preview-size changes are packaged instead of stale preview state.
- Added regression coverage proving Share URL and Export JSON payloads include current project/source/preview state while excluding Agent session state, permissions, activity, bridge metadata, Checkpoints, rollback history, diagnostics, and Preview evidence.
- Fixed the post-merge PR #49 build regression where the retry button passed `generateShareLink` directly as a React click handler after the hook gained an optional `forceRegeneration` boolean parameter.

Verification completed with `npm run build`, which covers sandbox bundling, `tsc -b`, and Vite production bundling.

### 2026-05-26 - Issue #51 Agent ActionMenu simplification

Completed:

- Updated the Agent ActionMenu to match the new design direction: Norwegian section labels, a static `Agent-tilgang` checkbox, `Status: aktiv` / `Status: inaktiv`, contextual copy guidance, and a `Kopier instruksjoner` `ActionMenu.Item`.
- Removed the separate Agent permission controls from the UI.
- Changed the default active Agent permission state to all-on, including project metadata changes, so copied instructions and bridge session state report all permissions as available while Agent access is active.
- Kept the existing bridge commands, validation, Checkpoints, rollback, diagnostics, Preview evidence, and share/export exclusions in place.
- Updated integration coverage for the simplified menu, static checkbox label, all-on permission state, ActionMenu copy item, simplified status, metadata replacement default, and share/export fallback helper.

## Testing Decisions

- Good tests should assert external behavior and user-visible outcomes, not internal implementation details. Tests should prove that agents can only do what the human authorized, that invalid bridge calls fail safely, that accepted changes update the Arcade project atomically, and that rollback restores the prior state.
- Unit-test the Agent change validator with valid payloads, malformed payloads, disallowed fields, missing permissions, unsupported viewport/theme values, empty changes, oversized changes, and structured error responses.
- Unit-test the Agent session state module for default permissions, start/stop behavior, activity status derivation, Checkpoint creation, Checkpoint capping, and human rollback.
- Unit-test the Agent bridge module for install/remove behavior, command availability only while active, structured command results, activity recording, whole-change rejection, and revoked-session errors.
- Unit-test the Preview evidence serializer with representative preview DOM to ensure it includes useful layout/style facts and excludes scripts, handlers, React internals, full CSS, storage, and unrelated page data.
- Unit-test the diagnostics collector to ensure compile errors, runtime errors, preview status, and bounded sandbox console messages are returned consistently.
- Integration-test the Agent ActionMenu UI using the same style as existing header/share/settings tests. Cover menu placement, the static `Agent-tilgang` checkbox, all-on default permissions, simplified status text, rollback entries, and Copy agent instructions as an `ActionMenu.Item`.
- Integration-test app wiring by applying Agent changes through the bridge and asserting the editor, preview settings, diagnostics state, and rollback history reflect the external behavior.
- E2E-test the browser bridge with page evaluation. Cover bridge absence before Start, bridge presence after Start, source-code application, Hooks-code application, preview setting application, metadata replacement with default permissions, diagnostics retrieval, Preview evidence retrieval, Stop removing the bridge, and human rollback.
- E2E-test that applying invalid code is allowed when schema and permissions are valid, and that the normal live preview reports compile/runtime diagnostics afterward.
- E2E-test that Checkpoints are not included in Share URL or Export JSON by default.
- Prior art in the codebase includes unit tests for storage, share encoding/decoding, compression strategies, security message validation, snapshot packing, and autocomplete; integration tests for share popovers, project controls, sandbox behavior, and inspection popovers; and e2e tests for share links, themes, autocomplete, component palette behavior, inspect overlays, and sandboxed Aksel rendering.

## Out of Scope

- In-app LLM chat.
- Direct calls to LLM providers.
- Provider credential storage.
- Backend APIs or server persistence.
- A localhost bridge.
- MCP connector support.
- Browser extension support.
- Persistent trusted agents.
- Always-on bridge stubs.
- Staged proposal validation UI.
- Compile-gating or render-gating Agent changes before apply.
- Text patch APIs.
- Cursor edit APIs.
- Agent-triggered rollback.
- Checkpoint sharing by default.
- Checkpoint persistence across reloads.
- Share URL or Export JSON commands on the bridge.
- In-app screenshot capture dependencies.
- Full-page DOM snapshots.
- Access to cookies, clipboard, local storage, or unrelated browser/page state.
- Expanded package imports or expanded sandbox network access for agent-authored code.

## Further Notes

This PRD intentionally uses the domain language from the Aksel Arcade glossary: Arcade project, Agent session, Agent bridge, Agent permission, Arcade-scoped state, Preview evidence, Arcade authoring contract, Agent change, and Checkpoint.

The MVP assumes the human communicates with the external agent outside Aksel Arcade. Aksel Arcade supplies the authorized browser bridge and copyable agent instructions, not the chat surface.

The most important product trade-off is that safety comes from explicit consent, narrow permissions, schema validation, bounded diagnostics/evidence, and human rollback rather than staged proposal validation. That trade-off is recorded in the ADR for apply-then-review Agent changes.

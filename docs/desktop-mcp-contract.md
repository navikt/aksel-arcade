# Desktop MCP contract

Desktop Arcade exposes the active Arcade project through the **Desktop Arcade MCP server**. The MCP protocol layer may be rebuilt or reorganized, but the Arcade-facing public contract should remain stable unless it conflicts with the MCP specification.

## Public contract

Preserve these unless a change is intentionally documented and covered by contract tests:

- MCP endpoint identity: `http://127.0.0.1:3846/mcp`
- Local-only, no-auth setup contract
- Tool names and intended behavior
- Stable resource URIs and URI templates
- Guidance entry points, including `initialize.result.instructions` and `arcade://desktop/start-here`
- Structured tool result shapes and Arcade error codes
- Machine-readable `arcade://desktop/capabilities` metadata

The active implementation is the SDK-backed Desktop Arcade MCP server in `desktop/main-process.ts` and `desktop/mcpSdkServer.ts`. There is no parallel handwritten MCP server path or runtime switch.

## Implementation boundaries

The MCP server should follow the current MCP specification and the official TypeScript MCP SDK. Protocol sessions, lifecycle handling, transport details, schema validation, and MCP error semantics belong to the SDK-backed main-process MCP layer.

Arcade project behavior belongs outside the MCP protocol layer. Main-process MCP modules should be thin adapters that call renderer/domain handlers for active-project reads, `apply_changes`, annotation mutations, and Preview evidence capture.

Pure shared contract code may live under `src/shared/desktopMcp/`. It must not import React, DOM APIs, Electron, storage, or renderer state.

## Acceptance checks

The contract is guarded by golden MCP tests for initialization, discovery, resources, tools, structured success/error results, HTTP security behavior, generated catalog drift, MCP Inspector compatibility, and the existing Desktop MCP smoke flow.

## Intentional spec-alignment changes

- `initialize` now uses SDK-managed protocol negotiation instead of returning the previously fixed `2024-11-05` protocol version.
- The endpoint advertises spec-native `resources/templates/list` templates for parameterized URI families such as page source, page annotations, Aksel component detail resources, and Preview capture resources.
- The final public tool surface is SDK-registered: `read_resource`, `list_annotations`, `watch_annotations`, `capture_preview_evidence`, `apply_changes`, `acknowledge_annotation`, `resolve_annotation`, `dismiss_annotation`, and `reply_to_annotation`.
- Legacy bulk annotation mutation tool names remain out of scope; the public contract uses the Arcade-native mutation tools above.

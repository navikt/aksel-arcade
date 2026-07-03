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

## Implementation boundaries

The MCP server should follow the current MCP specification and the official TypeScript MCP SDK. Protocol sessions, lifecycle handling, transport details, schema validation, and MCP error semantics belong to the SDK-backed main-process MCP layer.

Arcade project behavior belongs outside the MCP protocol layer. Main-process MCP modules should be thin adapters that call renderer/domain handlers for active-project reads, `apply_changes`, annotation mutations, and Preview evidence capture.

Pure shared contract code may live under `src/shared/desktopMcp/`. It must not import React, DOM APIs, Electron, storage, or renderer state.

## Acceptance checks

The contract is guarded by golden MCP tests for initialization, discovery, resources, tools, structured success/error results, HTTP security behavior, generated catalog drift, MCP Inspector compatibility, and the existing Desktop MCP smoke flow.

## SDK rebuild candidates

The current handwritten server is the baseline that issue #343 locks down, but these current behaviors are expected candidates for intentional spec-alignment changes during the SDK rebuild from issue #342:

- `initialize` always returns the fixed protocol version string `2024-11-05`; the SDK rebuild should replace this with proper MCP version negotiation against the client.
- The current server publishes concrete resources through `resources/list` and `resources/read`, but it does not yet advertise spec-native resource templates for parameterized URI families such as page source, page annotations, Aksel component detail resources, or Preview capture resources.

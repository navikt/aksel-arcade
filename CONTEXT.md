# Aksel Arcade

Aksel Arcade is a browser playground for creating Aksel-based React prototypes with live human review.

## Language

**Arcade project**:
A user-owned prototype in Aksel Arcade, including its editable source and preview preferences.
_Avoid_: File, document, artifact

**Agent session**:
A revocable, consent-gated pairing relationship where an authorized external agent can inspect and change the active **Arcade project** while the human can stop access and roll back changes.
_Avoid_: Chat, bot session, automation session

**Agent bridge**:
The user-authorized connection point between an external agent and an active **Agent session**; it lets agents read **Arcade-scoped state** and submit **Agent changes**.
_Avoid_: Provider integration, backend API, browser extension

**Agent permission**:
A human-controlled capability that limits what an external agent may change or capture during an **Agent session**.
_Avoid_: Role, scope, feature flag

**Arcade-scoped state**:
The parts of Aksel Arcade that describe the active **Arcade project**, its preview, its **Preview evidence**, and its Arcade-specific diagnostics.
_Avoid_: Browser state, page state, local storage

**Preview evidence**:
DOM, accessibility, screenshot, or frame metadata obtained on request from only the sandboxed preview frame for the active **Arcade project**.
_Avoid_: Full-page snapshot, browser screenshot, Arcade UI snapshot

**Arcade authoring contract**:
The shared rules for source that can run in Aksel Arcade, whether written by a human or changed by an agent.
_Avoid_: Agent-only rules, human-only rules

**Agent change**:
An agent-authored replacement set applied to one or more parts of the active **Arcade project** during an **Agent session**.
_Avoid_: Proposed change, patch, command, cursor edit

**Checkpoint**:
A human-restorable safety point captured before an **Agent change** during an **Agent session**; checkpoints are local session safety, not shared project history.
_Avoid_: Version, revision, commit

## Example dialogue

Developer: "The agent session applied an agent change to the Arcade project."

Domain expert: "Show it in the live preview. If the user does not want it, restore the checkpoint."

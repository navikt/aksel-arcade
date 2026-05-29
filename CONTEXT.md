# Aksel Arcade

Aksel Arcade is a playground for creating Aksel-based React prototypes with live human review, available through web and desktop product surfaces.

## Language

**Arcade project**:
A shell-neutral user-owned prototype in Aksel Arcade, including its editable source and preview preferences.
_Avoid_: File, document, artifact

**Arcade project source**:
The two editable code parts of an **Arcade project**: JSX and Hooks.
_Avoid_: Files, filesystem, project code

**Preview preference**:
A review-facing display preference of an **Arcade project**, such as the viewport used to open its preview.
_Avoid_: Workspace preference, editor layout

**Workspace preference**:
A local product-surface preference for arranging Arcade itself around an **Arcade project**, such as editor panel placement.
_Avoid_: Preview preference, project content

**Arcade project package**:
A shell-neutral portable share artifact named with the `.akselarcade` extension that contains only the importable **Arcade project** data needed for import, export, or desktop file opening: name, **Arcade project source**, and viewport **Preview preference**. Importing one creates a new local **Arcade project** identity rather than preserving the source project instance; it excludes AI metadata, setup instructions, explanatory text, documentation links, production-import guidance, diagnostics, preview evidence, and **Workspace preferences**.
_Avoid_: Arcade project, save file, document, AI export bundle

**Web Arcade**:
The browser-hosted product surface for working with **Arcade projects**.
_Avoid_: Browser-only Arcade, original Arcade

**Desktop Arcade**:
The desktop product surface for working with the same **Arcade projects** as **Web Arcade**.
_Avoid_: Electron app, native app

**Agent session**:
A Desktop Arcade-only revocable, consent-gated pairing relationship where an authorized external agent can inspect and change one active **Arcade project** while the human can stop access.
_Avoid_: Chat, bot session, automation session

**Agent access**:
A Desktop Arcade-only human-controlled on/off consent state that makes the current **Arcade project** available for explicit **Agent pairing** during an **Agent session**. It does not include ordinary project sharing, import/export, or normal human preview review.
_Avoid_: Local server, transport, pairing token, Share URL

**Agent bridge**:
The Desktop Arcade user-authorized connection point between an external agent and an active **Agent session**; it lets agents read **Arcade-scoped state** and submit **Agent changes**.
_Avoid_: Provider integration, backend API, browser extension

**Agent transport**:
The Desktop Arcade-only same-device mechanism an **External agent** uses to reach the **Agent bridge** during an active **Agent session**.
_Avoid_: Agent bridge, permission model, browser access

**Agent pairing**:
The deliberate user-approved link between one **External agent** and one active **Agent session** through an **Agent pairing credential**.
_Avoid_: Installation, login, persistent trust, implicit local trust

**Agent pairing handoff**:
The human-mediated transfer that gives an **External agent** what it needs to complete **Agent pairing** for one active **Agent session**.
_Avoid_: Agent discovery, provider push, persistent setup

**Agent pairing credential**:
A short-lived secret that authorizes one **External agent** to use the **Agent transport** for one active **Agent session**.
_Avoid_: API key, installation token, persistent trust

**External agent**:
A user-directed AI agent outside Desktop Arcade that works on an active **Arcade project** through the **Agent bridge**.
_Avoid_: In-app chat, provider integration, browser automation

**Copilot agent surface**:
A GitHub Copilot product surface that can act as an **External agent**, such as the GitHub Copilot app, Copilot CLI, or Copilot in VS Code.
_Avoid_: Copilot provider, single Copilot integration

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

## Example dialogue

Developer: "The human started Agent access and copied an Agent pairing handoff to the external agent."

Domain expert: "Good. That pairs the agent with this active Arcade project only; it is not persistent trust."

Developer: "The agent session applied an agent change to the Arcade project."

Domain expert: "Show it in the live preview. If the user does not want more agent changes, stop Agent access."

Developer: "The user exported an Arcade project package to send a prototype to a colleague."

Domain expert: "Then the package should contain the project name, Arcade project source, and viewport preview preference only. It should not carry AI instructions, local identity, diagnostics, preview evidence, or workspace preferences."

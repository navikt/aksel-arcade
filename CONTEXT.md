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
A review-facing display preference of an **Arcade project**, such as the viewport or theme used to open its preview.
_Avoid_: Workspace preference, editor layout

**Workspace preference**:
A local product-surface preference for arranging Arcade itself around an **Arcade project**, such as editor panel placement. In **Web Arcade**, workspace preferences belong to the current **Web Arcade working copy**.
_Avoid_: Preview preference, project content

**Arcade project package**:
A shell-neutral portable share artifact named with the `.akselarcade` extension that contains only the importable **Arcade project** data needed for import, export, or desktop file opening: name, **Arcade project source**, and viewport **Preview preference**. Importing one creates a new local **Arcade project** identity rather than preserving the source project instance; it excludes AI metadata, setup instructions, explanatory text, documentation links, production-import guidance, diagnostics, preview evidence, and **Workspace preferences**.
_Avoid_: Arcade project, save file, document, AI export bundle

**Web share URL**:
A Web Arcade link that carries only the portable **Arcade project** data needed to load a shared prototype: **Arcade project source** and shareable **Preview preferences**. Opening one creates a fresh local **Arcade project** identity without preserving sender identity, timestamps, diagnostics, preview evidence, or **Workspace preferences**.
_Avoid_: Project code URL, save file, telemetry bundle

**Web Arcade URL**:
The ordinary browser address for opening **Web Arcade** without project data. It opens a new default **Web Arcade working copy** unless it is a **Web share URL**.
_Avoid_: Web share URL, project URL

**Web Arcade**:
The browser-hosted product surface for working with **Arcade projects**.
_Avoid_: Browser-only Arcade, original Arcade

**Web Arcade working copy**:
A tab-scoped editing instance of an **Arcade project** in **Web Arcade**, including its name, **Arcade project source**, **Preview preferences**, and **Workspace preferences**. It survives reloads in its own tab, and duplicating the tab forks the visible work into an independent working copy; a new tab opened through a **Web Arcade URL** starts as a new default working copy. Autosave belongs to the working copy, not to a browser-wide last project, and closed working copies are not a durable project library.
_Avoid_: Synchronized tab, shared browser project

**Reset editor**:
A Web Arcade action that replaces only the current **Web Arcade working copy** with the default Untitled Project.
_Avoid_: Clear storage, reload

**Desktop Arcade**:
The downloadable desktop product surface for working with the same **Arcade projects** as **Web Arcade**.
_Avoid_: Electron app, native app

**Desktop Arcade release**:
A versioned publication of **Desktop Arcade** for download, containing the supported platform-specific install artifacts for that version.
_Avoid_: Web deploy, build run, artifact batch

**Desktop install artifact**:
A human-facing installer included in a **Desktop Arcade release** for one supported desktop platform and processor family.
_Avoid_: Build output, ZIP bundle, auto-update feed

**Desktop release credential**:
A protected secret used only by release automation to sign or notarize **Desktop install artifacts**.
_Avoid_: App secret, runtime secret, project data

**Desktop Arcade version**:
The SemVer identifier for a **Desktop Arcade release**.
_Avoid_: Build number, deployment ID, Web Arcade version

**Desktop-impacting change**:
A change that alters **Desktop Arcade** itself, its release path, or shared **Arcade project** behavior shipped by **Desktop Arcade**.
_Avoid_: Desktop-only change, every repository change

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

Developer: "A Desktop-impacting change was merged."

Domain expert: "Create a new Desktop Arcade release with the next Desktop Arcade version and the supported Desktop install artifacts. Do not treat it as a Web deploy."

Developer: "A release job needs a signing secret."

Domain expert: "That is a Desktop release credential. It belongs only to release automation and must not become app data, project data, or Web Arcade behavior."

Developer: "The user opened a Web share URL from a colleague."

Domain expert: "Replace only the current Web Arcade working copy with a fresh local Arcade project identity from the shared Arcade project source and preview preferences. Do not preserve sender identity, timestamps, diagnostics, preview evidence, or workspace preferences."

Developer: "The user copied the ordinary Web Arcade URL into a new tab."

Domain expert: "Open a new default Web Arcade working copy. Only a Web share URL carries project data."

Developer: "The user has the same Web Arcade project open in two browser tabs."

Domain expert: "Treat them as separate Web Arcade working copies. A change in one tab should not replace work in the other unless the user explicitly imports or shares that project data."

Developer: "The user opens a new blank Web Arcade tab."

Domain expert: "Start a new default Web Arcade working copy. Do not restore another tab's work into it."

Developer: "The user reloads a Web Arcade tab with unsent work."

Domain expert: "Restore that tab's Web Arcade working copy after reload. Reloading is not the same as opening a new blank tab."

Developer: "The user duplicates a Web Arcade tab."

Domain expert: "Fork the visible work, including the name, into a separate Web Arcade working copy. The two tabs may start identical, but edits diverge immediately."

Developer: "The user wants to throw away the current Web Arcade working copy."

Domain expert: "Use Reset editor. It replaces only the current working copy with the default Untitled Project; it does not clear other tabs."

Developer: "The user imports an Arcade project package in a Web Arcade tab."

Domain expert: "Replace only that tab's Web Arcade working copy with the imported Arcade project data."

Developer: "The user needs to keep a Web Arcade prototype after closing the tab."

Domain expert: "Use Share or Export. A closed Web Arcade working copy is not a durable project library entry."

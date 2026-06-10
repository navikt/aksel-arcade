# Aksel Arcade

Aksel Arcade is a playground for creating Aksel-based React prototypes with live human review, available through web and desktop product surfaces.

## Language

**Arcade project**:
A shell-neutral user-owned prototype in Aksel Arcade, including its editable source and preview preferences.
_Avoid_: File, document, artifact

**Arcade project source**:
The editable code of an **Arcade project**, composed of the **Global config** and one or more ordered **Arcade pages**, each with its own JSX and Hooks. The default experience presents a single page; multi-page authoring is an experimental, locally enabled capability.
_Avoid_: Files, filesystem, project code

**Arcade page**:
A named, independently rendered screen within an **Arcade project source**, identified by a stable page id that is never renumbered or reused. Each page holds its own JSX and Hooks.
_Avoid_: File, route, tab, document, screen mock

**Global config**:
The permanent, non-navigable part of an **Arcade project source** whose JSX (shared component definitions) and Hooks (shared logic) are in scope for every **Arcade page**. It is never renamed, deleted, or used as a **start page**.
_Avoid_: Page, layout, shell, global theme, settings

**Page reference**:
A use of an **Arcade page**'s stable id within **Arcade project source** that targets that page for **page navigation**. It survives renaming the page's display name and becomes a **stale page reference** when its target no longer exists.
_Avoid_: Link, route, page name, href

**Stale page reference**:
A **page reference** whose target **Arcade page** has been deleted; Arcade highlights it across every page that still uses it.
_Avoid_: Broken link, dangling pointer, error

**Page navigation**:
The in-prototype act of moving the preview from the **active page** to another **Arcade page**, as opposed to ordinary browser navigation. It is expressed through standard Aksel components.
_Avoid_: Browser navigation, routing, redirect, share navigation

**Active page**:
The single **Arcade page** currently shown in the preview, selected in the page panel, and open in the JSX and Hooks tabs. Preview **page navigation** and panel selection keep these in sync.
_Avoid_: Start page, current file, selected tab, open page

**Start page**:
The **Arcade page** where the preview begins on a fresh render. There is one per **Arcade project**, defaulting to the first page and changeable to any page.
_Avoid_: Active page, home route, landing page, default tab

**Preview preference**:
A review-facing display preference of an **Arcade project**, such as the viewport or theme used to open its preview.
_Avoid_: Workspace preference, editor layout

**Workspace preference**:
A local product-surface preference for arranging Arcade itself around an **Arcade project**, such as editor panel placement or whether experimental multi-page authoring is enabled. In **Web Arcade**, workspace preferences belong to the current **Web Arcade working copy**.
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

**Agent operating instructions**:
Concise session-scoped guidance returned through the **Agent bridge** that tells an **External agent** how to work with Desktop Arcade during one active **Agent session**.
_Avoid_: Agent pairing handoff, Aksel training, project content, repository documentation

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
The parts of Aksel Arcade that describe the active **Arcade project** — including its **Global config**, its ordered **Arcade pages** (with their stable ids and display names), its **Start page**, and its **Active page** — together with its preview, its **Preview evidence**, and its Arcade-specific diagnostics.
_Avoid_: Browser state, page state, local storage

**Preview evidence**:
DOM, accessibility, screenshot, or frame metadata obtained on request from only the sandboxed preview frame for the active **Arcade project**.
_Avoid_: Full-page snapshot, browser screenshot, Arcade UI snapshot

**Arcade authoring contract**:
The shared rules for source that can run in Aksel Arcade, whether written by a human or changed by an agent.
_Avoid_: Agent-only rules, human-only rules

**Arcade authoring guidance**:
Actionable guidance that helps a human or **External agent** produce valid **Arcade project source** under the **Arcade authoring contract**.
_Avoid_: Agent operating instructions, Aksel training

**Aksel-valid Arcade JSX**:
**Arcade project source** that represents a UI with current Aksel React components, layout primitives, icons, and `--ax` design tokens before using native HTML or custom CSS fallbacks.
_Avoid_: Visual mimic, prop-free HTML, screenshot-only JSX

**Aksel insertion catalog**:
The shared set of all non-deprecated top-level, renderable Aksel UI choices that Arcade authoring aids offer as complete **Aksel-valid Arcade JSX** blocks across **Web Arcade** and **Desktop Arcade**. An insertion choice must be present in current Aksel documentation, render in Arcade’s current Aksel runtime, not be excluded by current replacement guidance, and be behavior-complete for the component’s primary interaction. It may have a user-facing label that differs from the literal Aksel component name when one Aksel component has multiple common runnable defaults. The catalog guides new authoring and does not define whether existing source can still render.
_Avoid_: Raw component list, subcomponent list, autocomplete docs data, infrastructure component, one export equals one choice

**Multi-part insertion**:
An authoring-aid insertion that updates JSX and Hooks in the same **Arcade project source** edit target when a behavior-complete Aksel choice needs supporting state, ids, or refs. Generated hook support code may include a short comment explaining which inserted example needs it, and repeated insertions must avoid support-code name collisions.
_Avoid_: JSX-only snippet, hidden side effect

**Contextual subcomponent suggestion**:
A code autocomplete suggestion for a compound Aksel subcomponent that appears only where the surrounding JSX has the relevant parent component ancestry. When a compound parent expects direct children, matching subcomponents rank ahead of general child-level choices.
_Avoid_: Top-level subcomponent option, global subcomponent autocomplete

**Contextual child suggestion**:
A code autocomplete suggestion for a parent-bound Aksel child component that is not useful as a top-level insertion, such as a `Radio` inside a `RadioGroup`.
_Avoid_: Top-level insertion choice, arbitrary child suggestion

**Child-level component suggestion**:
A code autocomplete suggestion for a general renderable Aksel choice, including layout primitives, offered where JSX children can be written without being tied to a specific compound parent. Arcade may omit otherwise valid choices at constrained compound positions when suggesting them would steer users toward poor Aksel structure.
_Avoid_: Compound subcomponent suggestion, prop suggestion

**Agent change**:
An agent-authored change applied to one or more parts of the active **Arcade project** during an **Agent session** — the **Global config** code, an individual **Arcade page**'s code, or the project's page set itself (adding, renaming, or removing an **Arcade page**, or changing the **Start page**). The app assigns page ids; an agent never chooses them.
_Avoid_: Proposed change, patch, command, cursor edit

## Example dialogue

Developer: "The human started Agent access and copied an Agent pairing handoff to the external agent."

Domain expert: "Good. That pairs the agent with this active Arcade project only; it is not persistent trust."

Developer: "The agent session applied an agent change to the Arcade project."

Domain expert: "Show it in the live preview. If the user does not want more agent changes, stop Agent access."

Developer: "The external agent needs help writing the source for a screenshot recreation."

Domain expert: "Keep the Agent operating instructions focused on the active session and use Arcade authoring guidance to steer the agent toward Aksel-valid Arcade JSX."

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

Developer: "The user enabled multi-page authoring and added a second page."

Domain expert: "Now the Arcade project source has the Global config plus two Arcade pages. The flag that enabled this is a Workspace preference; it does not travel with the project."

Developer: "The user renamed 'Home' to 'Landing'."

Domain expert: "Page references point at the page's stable id, not its name, so navigation keeps working. Only the display name changed."

Developer: "The user deleted a page that other pages still link to."

Domain expert: "Those become stale page references. Highlight them on every page that still uses them."

Developer: "Which page should the preview show first?"

Domain expert: "The start page. By default that is the first page, but the user can set any page as the start page. Whatever page the preview is currently on is the active page, and the panel and code tabs follow it."

Developer: "The user wants a header shared across every page."

Domain expert: "Define it in the Global config JSX as a shared component and use it from each page. The Global config never renders on its own."

Developer: "The user shared a multi-page prototype as a Web share URL."

Domain expert: "While multi-page is experimental, the portable artifact carries only the start page. Warn the user that other pages are not included."

Developer: "An agent wants to add a page, but the user never enabled multi-page authoring."

Domain expert: "Then the agent works single-page on the first page, just like the human. Agent multi-page is gated by the same Workspace preference; the Agent operating instructions should tell the agent to ask the human to enable it."

Developer: "Multi-page is enabled and the agent needs to add a page and link to it."

Domain expert: "The agent submits an agent change to add the page; the app gives it back a stable id. The agent then references that id in its page references — both navigation methods point at the id, never the name. The Arcade authoring guidance documents those rules for humans and agents alike."

# Aksel Arcade

Aksel Arcade is a playground for creating Aksel-based React prototypes with live human review, available through web and desktop product surfaces.

## Language

**Arcade project**:
A shell-neutral user-owned prototype in Aksel Arcade, including its editable source, page-scoped annotations, and preview preferences.
_Avoid_: File, document, artifact

**Arcade project source**:
The editable code of an **Arcade project**, composed of the **Global config** and one or more ordered **Arcade pages**, each with its own JSX and Hooks. A new project starts with one page, and added pages remain part of the same permanent source model.
_Avoid_: Files, filesystem, project code

**Arcade page**:
A named, independently rendered screen within an **Arcade project source**, identified by a stable page id that is never renumbered or reused. Each page holds its own JSX and Hooks.
_Avoid_: File, route, tab, document, screen mock

**Annotation**:
A durable note in an **Arcade project** that is scoped to exactly one **Arcade page** and attached to one or more preview elements on that page. It is review information for other users and **External agents**, survives page renaming through the stable page id, and is deleted when its page is deleted; it is not a **Workspace preference**, **Preview evidence**, or separate Desktop-only session.
_Avoid_: Feedback, comment, marker, inspection result

**Open annotation**:
An **Annotation** that still needs attention, including pending annotations, acknowledged annotations, and legacy annotations with no status, as long as its **Annotation target** can be resolved in the current preview. Resolved, dismissed, or dead-target annotations remain in project data for history, but they are not counted in the active page badge, shown as normal markers, or returned as agent work.
_Avoid_: Stored annotation, unresolved marker, active comment

**Annotation thread**:
The conversation attached to an **Annotation** after the original note is created, containing follow-up messages from humans or **External agents**. In v0.3.0, status and thread changes are agent/MCP-facing workflow data; agents may add thread replies and update annotation status, but they do not rewrite the original human-authored annotation note or target.
_Avoid_: Annotation text, chat session, agent change

**Annotation mode**:
A temporary preview interaction state where the active page's **Annotations** are visible and a user can create or edit annotations on preview elements. It intercepts preview interactions, is mutually exclusive with Inspect mode, and turning it off hides annotation UI without deleting annotations.
_Avoid_: Feedback mode, review mode, agent mode

**Annotation target**:
The concrete user-perceived preview DOM element, or group of preview DOM elements, that an **Annotation** is attached to on an **Arcade page**. Any rendered user-authored preview element can be a target, including generic/custom `div` and `span` elements, layout wrappers, and Aksel component roots; only non-preview chrome and non-rendered implementation nodes such as `script`, `style`, `template`, `html`, `body`, `display: none`, `display: contents`, or hidden elements are excluded. Targets are resolved identity-first and marker geometry second: a target can remain valid even when currently hidden by viewport or layout, while saved coordinates and geometry are compatibility and diagnostic data, not a substitute anchor for normal marker placement.
_Avoid_: CSS selector, marker position, inspection target

**Dead annotation target**:
An **Annotation target** that cannot be reconnected unambiguously to a live preview element or complete element group in the current render. The annotation remains in project data for history, but humans and **External agents** ignore it while the target is dead: it is not counted, shown in normal **Annotation mode**, or returned as agent work; if the complete target becomes resolvable again in a later render, the annotation becomes usable again.
_Avoid_: Stale marker, broken marker, deleted element, missing annotation

**Hidden annotation target**:
An **Annotation target** that can be resolved by identity in the current preview but is not visible in the selected viewport or layout state. The annotation still counts as open and remains visible to **External agents**; for element groups, normal **Annotation mode** may show the visible subset as long as the complete group still resolves.
_Avoid_: Dead annotation target, hidden marker, unresolved annotation

**Clear annotations**:
A page-scoped destructive action that removes every **Annotation** record for the active **Arcade page**, including open annotations, resolved or dismissed history, and annotations whose target is currently dead.
_Avoid_: Clear visible markers, reset project, dismiss annotations

**Context replacement**:
An explicit action that replaces the prototype context being reviewed, such as Reset editor, loading a built-in template or demo, applying a **Web share URL**, importing an **Arcade project package**, or a future replace-project flow. It resets the entire **Arcade project** annotation set rather than preserving old review information across the new context.
_Avoid_: Ordinary source edit, annotation clear, page navigation

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

**Preview fullscreen**:
A tab-local in-app **Workspace preference** that makes the preview the primary Arcade surface while preserving a way back to the normal workspace layout. It is not browser fullscreen, and changes only how Arcade is arranged around the active **Arcade project**, not the project itself, its **Preview preferences**, or **Arcade project packages**; it survives ordinary reloads of the same working copy, and a **Web share URL** may carry it as an opening intent for the recipient tab.
_Avoid_: Fullscreen preview preference, project fullscreen, browser fullscreen

**Workspace preference**:
A local product-surface preference for arranging Arcade itself around an **Arcade project**, such as editor panel placement or whether the **Page panel** is open. In **Web Arcade**, workspace preferences belong to the current **Web Arcade working copy**.
_Avoid_: Preview preference, project content

**Arcade project package**:
A shell-neutral portable share artifact named with the `.akselarcade` extension that contains only the importable **Arcade project** data needed for import, export, or desktop file opening: name, **Arcade project source**, **Annotations**, and viewport **Preview preference**. Importing one creates a new local **Arcade project** identity rather than preserving the source project instance; it excludes AI metadata, setup instructions, explanatory text, documentation links, production-import guidance, diagnostics, preview evidence, and **Workspace preferences**.
_Avoid_: Arcade project, save file, document, AI export bundle

**Web share URL**:
A Web Arcade link that carries the portable **Arcade project** data needed to load a shared prototype — **Arcade project source**, complete **Annotations** when they fit the URL payload boundary, and shareable **Preview preferences** — and may also carry share-opening intent such as **Preview fullscreen**. Opening one creates a fresh local **Arcade project** identity without preserving sender identity, timestamps, diagnostics, preview evidence, or durable **Workspace preferences**.
_Avoid_: Project code URL, save file, telemetry bundle

**Web Arcade URL**:
The ordinary browser address for opening **Web Arcade** without project data. It opens a new default **Web Arcade working copy** unless it is a **Web share URL**.
_Avoid_: Web share URL, project URL

**Web Arcade**:
The browser-hosted product surface for working with **Arcade projects**.
_Avoid_: Browser-only Arcade, original Arcade

**Web Arcade working copy**:
A tab-scoped editing instance of an **Arcade project** in **Web Arcade**, including its name, **Arcade project source**, **Annotations**, **Preview preferences**, and **Workspace preferences**. It survives reloads in its own tab, and duplicating the tab forks the visible work into an independent working copy; a new tab opened through a **Web Arcade URL** starts as a new default working copy. Autosave belongs to the working copy, not to a browser-wide last project, and closed working copies are not a durable project library.
_Avoid_: Synchronized tab, shared browser project

**Reset editor**:
A Web Arcade action that replaces only the current **Web Arcade working copy** with the default Untitled Project, including clearing any **Annotations** in that working copy.
_Avoid_: Clear storage, reload

**Desktop Arcade**:
The downloadable desktop product surface for working with the same **Arcade projects** as **Web Arcade**.
_Avoid_: Electron app, native app

**Desktop Arcade release**:
A versioned publication of **Desktop Arcade** for download, containing the supported platform-specific install artifacts for that version.
_Avoid_: Web deploy, build run, artifact batch

**Desktop release candidate**:
A versioned pre-release publication of **Desktop Arcade** for team testing before a general-download **Desktop Arcade release**. It contains the supported **Desktop install artifacts** for a candidate **Desktop Arcade version**.
_Avoid_: Test build, beta artifact, workflow run

**Release candidate line**:
The candidate-ready integration line of work that automatically publishes **Desktop release candidates** for team testing. It is promoted into the stable public line when the current candidate set is accepted.
_Avoid_: Experimental master, ad hoc test branch, feature pile

**Stable release line**:
The public line of work that publishes **Desktop Arcade releases** and GitHub Pages updates. It receives **Release promotions** and urgent **Hotfixes** only.
_Avoid_: Integration branch, RC line, experiment branch

**Release promotion**:
The maintainer-approved promotion of the current **Release candidate line** into the **Stable release line** to publish a new **Desktop Arcade release**.
_Avoid_: Manual tag, direct publish, ad hoc merge

**Hotfix**:
An urgent fix applied to the **Stable release line** to publish a patch **Desktop Arcade release** without waiting for the current **Release candidate line** to be promoted. The same fix is then carried back into the **Release candidate line**.
_Avoid_: Deferred RC fix, one-sided patch, emergency experiment

**RC cycle**:
The release-candidate period for one chosen **Target release version**, beginning when that version target is set on the **Release candidate line** and ending when it is promoted or superseded.
_Avoid_: Endless branch state, unversioned test phase

**Target release version**:
The chosen SemVer version that the current **RC cycle** aims to publish as the next public **Desktop Arcade release**. Its **Desktop release candidates** use the same version with an `-rc.N` suffix.
_Avoid_: Guess-later version, build number, hidden bump

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

**Agent session** _(legacy, superseded)_:
The pre-MCP Desktop Arcade pairing relationship model. It is obsolete for the local MCP bridge v1 and should appear only in historical notes or legacy compatibility tests.
_Avoid_: Chat, bot session, automation session

**Agent access** _(legacy, superseded)_:
The pre-MCP in-app on/off consent toggle. Desktop Arcade MCP v1 does not use a separate Agent access switch; consent happens in the MCP client configuration instead.
_Avoid_: Local server, transport, pairing token, Share URL

**Agent bridge** _(legacy, superseded)_:
The pre-MCP local agent surface. Desktop Arcade MCP v1 uses the **Desktop Arcade MCP server** instead.
_Avoid_: Desktop Arcade MCP server, provider integration, backend API, browser extension

**Desktop Arcade MCP server**:
The local MCP server surface in **Desktop Arcade** that lets an **External agent** read **Arcade-scoped state** and submit **Agent changes** for the active **Arcade project** through narrow resources and tools.
_Avoid_: Agent bridge, provider integration, backend API, browser extension

**Agent transport** _(legacy, superseded)_:
The pre-MCP same-device pairing transport. Desktop Arcade MCP v1 uses the fixed local MCP endpoint instead of the old random loopback pairing transport.
_Avoid_: Agent bridge, permission model, browser access

**Agent pairing** _(legacy, superseded)_:
The old user-approved link established through a short-lived credential. Desktop Arcade MCP v1 does not use a separate pairing step.
_Avoid_: Installation, login, persistent trust, implicit local trust

**Agent pairing handoff** _(legacy, superseded)_:
The copied bootstrap command used by the old loopback transport. Desktop Arcade MCP v1 replaces it with normal MCP client setup.
_Avoid_: Agent discovery, provider push, persistent setup

**Agent operating instructions** _(legacy, superseded)_:
The old session-scoped returned instructions. Desktop Arcade MCP v1 uses the `arcade://desktop/operating-guide` resource instead.
_Avoid_: Agent pairing handoff, Aksel training, project content, repository documentation

**Agent pairing credential** _(legacy, superseded)_:
The old short-lived pairing secret. Desktop Arcade MCP v1 requires no token or authorization header.
_Avoid_: API key, installation token, persistent trust

**External agent**:
A user-directed AI agent outside Desktop Arcade that works on an active **Arcade project** through the **Desktop Arcade MCP server**.
_Avoid_: In-app chat, provider integration, browser automation

**Copilot agent surface**:
A GitHub Copilot product surface that can act as an **External agent**, such as the GitHub Copilot app, Copilot CLI, or Copilot in VS Code.
_Avoid_: Copilot provider, single Copilot integration

**Agent permission** _(legacy, superseded)_:
The old in-app capability toggle model. Desktop Arcade MCP v1 relies on the MCP host's approval UX plus the narrow Desktop Arcade MCP contract instead.
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
An agent-authored change applied to one or more parts of the active **Arcade project** through the **Desktop Arcade MCP server** — the **Global config** code, an individual **Arcade page**'s code, or the project's page set itself (adding, renaming, or removing an **Arcade page**, or changing the **Start page**). The app assigns page ids; an agent never chooses them.
_Avoid_: Proposed change, patch, command, cursor edit

## Example dialogue

Developer: "The human added Desktop Arcade as an MCP server in the external agent client."

Domain expert: "Good. The Desktop Arcade MCP server now targets this active Arcade project. Desktop Arcade v1 does not need a separate Agent access toggle or pairing handoff."

Developer: "The agent applied a batch change to the Arcade project through `apply_changes`."

Domain expert: "Show it in the live preview. If the user does not want more agent changes, remove or disable the MCP server in the client instead of looking for an in-app Agent access toggle."

Developer: "The external agent needs help writing the source for a screenshot recreation."

Domain expert: "Keep the operating guide focused on the MCP resources and tools, and use Arcade authoring guidance to steer the agent toward Aksel-valid Arcade JSX."

Developer: "The user exported an Arcade project package to send a prototype to a colleague."

Domain expert: "Then the package should contain the project name, Arcade project source, and viewport preview preference only. It should not carry AI instructions, local identity, diagnostics, preview evidence, or workspace preferences."

Developer: "A Desktop-impacting change was merged."

Domain expert: "Create a new Desktop Arcade release with the next Desktop Arcade version and the supported Desktop install artifacts. Do not treat it as a Web deploy."

Developer: "The current RC cycle targets 0.2.0 on the Release candidate line."

Domain expert: "Then Desktop release candidates should publish as 0.2.0-rc.N from release-candidate. Only a Release promotion into the Stable release line should publish 0.2.0 as a public Desktop Arcade release from master."

Developer: "A release job needs a signing secret."

Domain expert: "That is a Desktop release credential. It belongs only to release automation and must not become app data, project data, or Web Arcade behavior."

Developer: "A production bug needs an urgent fix before the RC cycle is promoted."

Domain expert: "That is a Hotfix. Apply it to the Stable release line, publish the patch Desktop Arcade release from master, and then carry the same fix back into the Release candidate line."

Developer: "The user opened a Web share URL from a colleague."

Domain expert: "Replace only the current Web Arcade working copy with a fresh local Arcade project identity from the shared Arcade project source, preview preferences, and any share-opening intent. Do not preserve sender identity, timestamps, diagnostics, preview evidence, or durable workspace preferences."

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

Developer: "The user added a second page and then closed the Page panel."

Domain expert: "Now the Arcade project source has the Global config plus two Arcade pages. Closing the Page panel is a Workspace preference; it changes the workspace layout and does not travel with the project."

Developer: "The user renamed 'Home' to 'Landing'."

Domain expert: "Page references point at the page's stable id, not its name, so navigation keeps working. Only the display name changed."

Developer: "The user deleted a page that other pages still link to."

Domain expert: "Those become stale page references. Highlight them on every page that still uses them."

Developer: "Which page should the preview show first?"

Domain expert: "The start page. By default that is the first page, but the user can set any page as the start page. Whatever page the preview is currently on is the active page, and the panel and code tabs follow it."

Developer: "The user wants a header shared across every page."

Domain expert: "Define it in the Global config JSX as a shared component and use it from each page. The Global config never renders on its own."

Developer: "The user shared a multi-page prototype as a Web share URL."

Domain expert: "The Web share URL should carry the full Arcade project source plus the shareable preview preferences. The recipient keeps their own durable Workspace preferences unless the URL includes an explicit share-opening intent such as Preview fullscreen."

Developer: "An agent wants to add a page to a one-page Arcade project."

Domain expert: "The Desktop Arcade MCP server always works against the full pages-based Arcade project source, even when there is only one Arcade page. The agent can call the page lifecycle operations directly; the app still assigns the stable page id."

Developer: "The agent needs to add a page and link to it."

Domain expert: "The agent submits an agent change to add the page; the app gives it back a stable id. The agent then references that id in its page references — both navigation methods point at the id, never the name. The Arcade authoring guidance documents those rules for humans and agents alike."

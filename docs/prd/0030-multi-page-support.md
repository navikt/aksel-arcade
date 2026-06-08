# PRD: Multi-page support for Aksel Arcade

> Status: ready-for-agent
> Related ADRs: 0011 (pages-based Arcade project source), 0012 (frozen append-order page ids), 0013 (experimental, local-only multi-page), 0014 (pages-aware Agent bridge)

## Problem Statement

Today an Arcade project is a single screen: one **JSX** body and one **Hooks** body that compile to one preview. Prototyping anything that spans more than one screen — a flow with a landing page and a detail page, a wizard, navigation between views — is impossible without faking it inside a single component. Humans (and the agents that pair with Desktop Arcade) have nowhere to put a second screen, no way to move between screens in the preview, and no shared place for code that every screen needs (a top nav, shared constants, shared helpers).

People also want to try this without it destabilising the product: it should be an opt-in experiment they can switch on and off, behaving identically in Web Arcade and Desktop Arcade, and it must not silently change how existing single-screen projects, sharing, or exporting work.

## Solution

Add **multi-page authoring** behind an experimental **Workspace preference** that the user turns on or off from the settings menu, with identical behaviour in Web Arcade and Desktop Arcade.

When enabled, the **Arcade project source** becomes a permanent **Global config** plus an ordered set of **Arcade pages**. A new page panel (a left drawer that pushes the code editor) lets the user add pages, rename them, delete them, set a **Start page**, and switch the **Active page**. The JSX and Hooks tabs always edit whatever is selected in the panel — an Arcade page or the Global config. All pages plus the Global config compile into one running prototype with an injected `goToPage()` helper and an internal router, so a prototype can navigate between its own screens; Aksel anchors (`Link`, `LinkCard`) whose `href`/`to` is a page id navigate too. Navigating in the preview moves the panel selection and the editor with it, and vice versa.

Page identity is a stable, app-assigned `pageNN` id (a **Page reference**) that never changes — so renaming a page never breaks **Page navigation**. Deleting a page turns every reference to it into a **Stale page reference**, which is highlighted in the editor on every page that still uses it and surfaced as a broken-navigation indicator in the panel. A separate indicator flags pages whose code has errors. The code editor autocompletes page ids inside `goToPage(...)` and inside `href`/`to` values.

When multi-page is **off**, everything behaves exactly as today (a single page under the hood). The experiment stays local-only: while it is behind the flag, sharing and exporting carry just the Start page, with a clear warning.

Paired agents get the same capabilities through the **Agent bridge**: they read the full page set, create/rename/delete pages, set the Start page, select the Active page, and target their **Agent changes** at a specific page or the Global config — all gated by the same human flag, so when the human has not enabled multi-page the agent works single-page and is told to ask the human to enable it.

## User Stories

### Enabling and toggling the experiment

1. As an Arcade user, I want to turn multi-page authoring on from the settings menu, so that I can prototype flows that span more than one screen.
2. As an Arcade user, I want to turn multi-page authoring off again from the settings menu, so that I can return to the simple single-screen experience.
3. As an Arcade user, I want the multi-page toggle to be clearly marked as experimental, so that I understand it is not yet a stable, shareable feature.
4. As a Web Arcade user, I want the multi-page toggle to live in the same settings menu as theme and panel order, so that I find it where I expect other workspace preferences.
5. As a Desktop Arcade user, I want multi-page to look and behave exactly as it does in Web Arcade, so that I do not have to relearn it per platform.
6. As an Arcade user, I want my multi-page on/off choice to be remembered for this working copy across reloads, so that the editor reopens the way I left it.
7. As an Arcade user, I want turning the flag off to preserve my pages (not delete them), so that toggling the experiment is safe to do repeatedly.

### Migration and single-page continuity

8. As an existing Arcade user, I want my current single-screen project to keep working untouched when this feature ships, so that nothing I made breaks.
9. As an existing Arcade user, I want my old project to become a single Arcade page ("Page 1") with an empty Global config under the hood, so that enabling the flag later just reveals it as page one of a multi-page project.
10. As an Arcade user with the flag off, I want the preview, sharing, exporting, and importing to behave exactly as before, so that the experiment has no effect until I opt in.

### The page panel

11. As an Arcade user, I want a panel-toggle button to the left of the JSX/Hooks toggle, so that I can show or hide the page panel.
12. As an Arcade user, I want the page panel to slide in from the left and push the code editor over, so that it shares the code area rather than covering it.
13. As an Arcade user, I want the page panel to open by default the first time I enable the flag, so that I immediately see how to manage pages.
14. As an Arcade user, I want the panel's open/closed state remembered per working copy, so that it reopens the way I left it.
15. As an Arcade user, I want a "Config" section at the top of the panel containing a permanent "Global config" entry, so that shared code is always one click away.
16. As an Arcade user, I want a "Pages" section listing my Arcade pages in order, so that I can see and pick any screen.
17. As an Arcade user, I want the currently active page row visually highlighted, so that I always know which page I am editing and previewing.
18. As an Arcade user, I want to hover a page row and see a hover state, so that the rows feel like interactive controls.

### Adding, renaming, deleting pages

19. As an Arcade user, I want an "Add page" button pinned at the bottom of the panel, so that creating a new screen is always reachable.
20. As an Arcade user, I want a new page to be created empty, named "Page N", and immediately become the active page, so that I can start editing it right away.
21. As an Arcade user, I want each page row to have a context menu (kebab), so that I can act on that specific page.
22. As an Arcade user, I want the page context menu to offer "Set as start page", "Rename", and "Delete", so that I have the page lifecycle actions in one place.
23. As an Arcade user, I want to rename a page inline (Enter commits, Esc cancels), so that I can give screens meaningful names quickly.
24. As an Arcade user, I want renaming a page to never break navigation to it, so that I can rename freely without auditing my code.
25. As an Arcade user, I want to delete a page from its context menu with a confirmation dialog, so that I do not lose a screen by accident.
26. As an Arcade user, I want the delete confirmation to tell me how many references across how many pages will become stale, so that I understand the impact before deleting.
27. As an Arcade user, I want to be prevented from deleting the last remaining page, so that a project always has at least one screen.
28. As an Arcade user, I want deleting the current start page to fall back to the first remaining page as the new start page, so that the prototype still has an entry point.

### Global config

29. As an Arcade user, I want the Global config to hold JSX and Hooks code shared across every page, so that I do not repeat shared components, helpers, state, or constants.
30. As an Arcade user, I want to define a shared component (e.g. a top nav) in the Global config JSX and use it from any page, so that all my screens share one chrome.
31. As an Arcade user, I want Global config Hooks values to be in scope on every page, so that shared constants and helpers are available everywhere.
32. As an Arcade user, I want the Global config to never render on its own, so that it acts as a shared library rather than a screen.
33. As an Arcade user, I want the Global config to be permanent — not renamable, not deletable, and not selectable as a start page — so that it stays a stable shared scope.
34. As an Arcade user, when I select Global config, I want the preview to show a "Global config has no preview" placeholder, so that I understand it is shared code, not a screen.

### Editing pages

35. As an Arcade user, I want the JSX and Hooks tabs to always edit whatever is selected in the panel (a page or the Global config), so that there is one obvious editing target.
36. As an Arcade user, I want switching the active page in the panel to load that page's JSX and Hooks into the tabs, so that I edit the right screen.
37. As an Arcade user, I want each page to keep its own JSX and Hooks code, so that screens are independent.
38. As an Arcade user, I want the active page remembered per working copy, so that reopening restores the screen I was last editing rather than the start page.

### Navigating between pages (runtime)

39. As an Arcade author, I want an injected `goToPage('pageNN')` helper available in my code, so that I can navigate between screens from event handlers (e.g. a Button onClick).
40. As an Arcade author, I want Aksel anchors (Link, LinkCard) whose `href`/`to` is a page id to navigate within the prototype, so that I can build navigation the idiomatic Aksel way.
41. As an Arcade author, I want both navigation methods to reference the same stable page id, so that there is one way to identify a target screen.
42. As an Arcade author, I want a read-only injected `currentPageId`, so that I can highlight the active item in a shared nav.
43. As an Arcade user, I want the prototype to open on the Start page when it first renders, so that the flow begins where I intend.
44. As an Arcade user, I want to choose which page is the Start page, so that I control the prototype's entry point.
45. As an Arcade author, I want each page to render fresh when navigated to (React state resets), with only Global config module-scope values persisting across pages, so that page navigation has predictable state semantics.

### Preview ↔ panel synchronisation

46. As an Arcade user, when I navigate inside the preview, I want the panel selection and the code tabs to follow to that page, so that what I see running matches what I am editing.
47. As an Arcade user, when I select a page in the panel, I want the preview to navigate to that page, so that selecting a screen previews it.
48. As an Arcade user, I want the active page to be a single shared notion across preview, panel, and editor, so that they never disagree about which screen is current.

### Autocomplete

49. As an Arcade author, I want page-id autocomplete to trigger inside `goToPage('…')`, so that I can pick a target screen without memorising ids.
50. As an Arcade author, I want page-id autocomplete to trigger inside `href`/`to` values, so that anchor navigation is as easy as the helper.
51. As an Arcade author, I want completions to show the friendly page name as the label and the page id as the detail, and insert the id, so that I pick by name but get the stable id.
52. As an Arcade author, I want autocomplete to also work while editing the Global config, so that shared navigation (e.g. a top nav) is easy to author.
53. As an Arcade author, I want to still be able to type a page id freely, so that autocomplete assists without blocking.

### Stale references and error indicators

54. As an Arcade user, when I delete a page, I want every reference to it highlighted in the editor on every page that still uses it, so that I can find and fix broken navigation.
55. As an Arcade author, I want a stale page reference flagged as a warning with a clear message (e.g. "Page page03 was deleted"), so that I know exactly what broke.
56. As an Arcade user, I want a per-page broken-navigation indicator in the panel when a page contains stale references, so that I can spot broken pages without opening each one.
57. As an Arcade user, I want a per-page error indicator in the panel when a page's code has compile/runtime errors, so that I can spot broken pages at a glance.
58. As an Arcade user, when a page has both errors and broken navigation, I want the error indicator to take priority, so that the most blocking problem is the one I see.
59. As an Arcade user, I want these indicators to update live as I edit any page or the Global config, so that they reflect the current state of the whole project.

### Sharing and exporting (while experimental)

60. As an Arcade user sharing a multi-page prototype via a Web share URL, I want it to carry the Start page only, with a warning that other pages are not included, so that I am not surprised by lossy sharing.
61. As an Arcade user exporting a multi-page prototype to an `.akselarcade` package, I want it to carry the Start page only, with the same warning, so that exports stay backward-compatible while the feature is experimental.
62. As a recipient of a shared/exported prototype, I want to receive a valid single-page project, so that older clients and the stable format keep working.

### Agent (Desktop Arcade) multi-page

63. As an agent paired with Desktop Arcade, I want to read the full page set (Global config, ordered pages with ids and names, which is the start page, which is active) through the Agent bridge, so that I understand the project I am working on.
64. As an agent, I want to create a new page and have the app assign and return its stable id, so that I can then reference it without ever choosing the id myself.
65. As an agent, I want to rename a page, so that I can improve a prototype's structure.
66. As an agent, I want to delete a page, so that I can remove screens that are no longer needed.
67. As an agent, I want to set the Start page, so that I can control the prototype's entry point.
68. As an agent, I want to select the active page, so that I can drive what the human sees in the preview while I work.
69. As an agent, I want my code changes to target a specific page or the Global config, so that I can edit any part of a multi-page project precisely.
70. As an agent, I want each structural change to apply immediately and be visible to the human (apply-then-review), so that the human stays in control.
71. As an agent, I want page CRUD to fall under the existing source-changes permission, so that the human's existing consent controls govern it.
72. As an agent, when multi-page is not enabled by the human, I want to work single-page on the first page exactly as the human does, so that I never produce a structure the human did not turn on.
73. As an agent, when multi-page is not enabled, I want the operating instructions to tell me to ask the human to enable it, so that the human can opt in deliberately.
74. As an agent, I want durable authoring rules (both navigation methods, page references, the frozen-id rule, stale-reference and Global config semantics, and `currentPageId`) in the shared authoring guidance, so that I author multi-page prototypes correctly.
75. As an agent, I want the session-scoped operating instructions to tell me which lifecycle commands exist and whether multi-page is currently enabled, so that I know what I can do right now.
76. As a human running an agent, I want the agent's multi-page edits to be reviewable in the live preview just like its code edits, so that I can accept or stop them.

## Implementation Decisions

### Domain model and migration (ADR 0011, ADR 0012)

- The **Arcade project source** is generalised to one canonical shape: a permanent **Global config** (its own JSX + Hooks), an ordered list of **Arcade pages** (each with a stable id, an editable display name, and its own JSX + Hooks), and a `startPageId`. The currently selected/previewed page is the **Active page**.
- There are no parallel `jsxCode`/`hooksCode` top-level fields kept "beside" the pages model — there is one source of truth. The multi-page flag controls only the page-panel UI and how the source is compiled, not the underlying shape (ADR 0011).
- **Page ids are frozen** `pageNN` strings assigned by append order at creation, never renumbered and never reused. Deleting leaves a gap (e.g. `page02` deleted ⇒ ids may read `page01, page03`). The display name is separate and freely editable; renaming never touches the id (ADR 0012).
- **Migration**: an existing single-page project becomes one page `page01` named "Page 1" carrying the old JSX/Hooks, with an empty Global config and `startPageId = page01`. Migration is lossless and runs regardless of the flag.

### Page model & lifecycle service (deep module)

- A pure service owns all transformations of the project source: `nextPageId`, `createPage`, `renamePage`, `deletePage`, `setStartPage`, `setActivePage`, and the single-page→multi-page migration. The app (not the agent, not the UI) is the sole authority that mints ids, preserving the frozen-id invariant.
- Lifecycle invariants enforced here: at least one Arcade page always exists (delete is rejected/disabled on the last page); deleting the start page falls back to the first remaining page; a newly created page becomes active; the Global config is never created, renamed, deleted, or set as start.

### Page reference analyzer (deep module)

- A pure analyzer takes a code body (any page's JSX/Hooks or the Global config) and the current set of valid page ids, and returns the list of **Page references** it contains — both `goToPage('pageNN')` calls and Aksel `href`/`to="pageNN"` attribute values — each with its source position and a valid/stale classification.
- This single analyzer is the one source of truth that drives: (a) the editor's stale-reference linter (warnings with positions), (b) the panel's per-page broken-navigation indicator, and (c) the delete-time impact count ("N references across M pages").
- Reference detection distinguishes a page-navigation `href`/`to` (value equals a known-or-formerly-known page id) from ordinary external links, so external links are never flagged.

### Multi-page bundle compiler (extends the transpiler — deep module)

- The transpiler is extended from `transpile(jsx, hooks) → one App` to compile the whole project source — Global config + every page + the start page — into one bundle containing: an internal router, an injected `goToPage(pageId)` helper, a read-only injected `currentPageId`, and the sandbox wiring that intercepts clicks on Aksel anchors whose `href`/`to` resolves to a page id (preventDefault + navigate).
- Global config JSX is compiled as shared component definitions in scope for every page; Global config Hooks as shared module-scope functions/state/constants in scope for every page. Nothing in Global config auto-renders.
- Navigation re-mounts the target page (fresh React state); only Global config module-scope values persist across navigation.
- When the flag is off, the compiler still operates on the canonical pages shape but produces the single-page result (one page, no router needed) so behaviour is byte-for-byte the current experience.

### Preview ↔ panel/editor synchronisation (API contract)

- The **Active page** is a single shared value. Two postMessage flows keep preview and host in sync: sandbox→parent emits a navigation event when the running prototype changes page (host updates panel selection + editor); parent→sandbox sends a navigate instruction when the user selects a page in the panel.
- Selecting the Global config shows a "Global config has no preview" placeholder instead of a rendered screen.

### Feature flag as a Workspace preference

- Multi-page is a local **Workspace preference**, persisted in the working copy alongside theme and panel order (it does not travel with shared/exported project data). It is surfaced as an experimental toggle in the settings ActionMenu, identical in Web and Desktop Arcade. There is no general feature-flag framework introduced; it reuses the existing preference + working-copy-storage mechanism.
- The working copy also persists: panel open/closed state, and the last active page id.

### Page navigation autocomplete (extends autocomplete source)

- The Aksel autocomplete override is extended so that, when the cursor is inside a `goToPage('…')` argument or inside an `href`/`to` value, it offers the project's pages as completions: label = friendly name, detail = `pageNN` id, inserted text = the id. Free typing is preserved. Applies in Global config too.

### Editor panel UI (Figma frame 99:392)

- A panel-toggle button (`SidebarLeftIcon`, tertiary/icon-only) is added to the left of the JSX/Hooks ToggleGroup in the code header.
- The page panel is a fixed-width (198px) left push-drawer inside the code wrapper with a right border; it shifts the code editor right rather than overlaying it.
- Structure: a "Config" section (Detail/Strong heading) with the permanent "Global config" row (no status icon, no kebab); a "Pages" section listing page rows; an "Add page" button (Secondary/Small, Plus icon, full width) pinned at the bottom.
- Each page row shows the display name, up to one status icon, and a kebab that opens an Aksel ActionMenu with: **Set as start page** (`HouseIcon`), **Rename** (`PencilIcon`), divider, **Delete** (`TrashIcon`, danger colour). Rename is inline (Enter commits, Esc cancels). Delete opens a confirmation dialog showing the stale-reference impact.
- Status icons: `ExclamationmarkTriangleIcon` = page has code errors (priority); `LinkBrokenIcon` = page has stale page references. At most one shows per row; the error icon wins when both apply.
- The active row uses the strong/pressed highlight; rows have a hover state. Tokens and exact icon mapping per the stored Figma spec.
- The JSX/Hooks tab labels stay **"Hooks"** (the Figma "Hook" is treated as label rounding), matching the existing tab and the Hooks code field.

### Pages-aware Agent bridge (ADR 0014 — deep module)

- `getProject` returns the full pages model: Global config, ordered pages with ids + display names, the start page id, and the active page id.
- New lifecycle commands are added: `createPage` (app assigns and returns the frozen id), `renamePage`, `deletePage`, `setStartPage`, `selectActivePage`. These mutate the page set through the page lifecycle service, preserving all invariants. The agent never supplies an id on create.
- `applyAgentChange` gains a `target` selecting where code edits land: a specific page id, or the Global config. Existing preview/metadata fields are unchanged.
- The declarative whole-document alternative (agent submits the entire `{globalConfig, pages[], startPageId}` and the app diffs) is rejected: deletion-by-omission is dangerous with a generative agent, and round-tripping ids invites frozen-id violations (ADR 0014).
- Page CRUD stays under the existing `sourceChanges` permission; no new permission key is introduced.
- The protocol version bumps from 2 to 3.
- **Gating**: all multi-page agent behaviour is gated by the same human multi-page Workspace preference. Flag off ⇒ the bridge exposes single-page behaviour (page01) and the operating instructions tell the agent to ask the human to enable multi-page.
- **Documentation split**: durable authoring rules (both navigation methods, page references, frozen-id rule, stale-reference + Global config semantics, `currentPageId`) go into the shared **Arcade authoring guidance/contract** (useful to humans and agents alike). Session-scoped operating bits (which lifecycle commands exist, whether multi-page is enabled, and "ask the human to enable it" when off) go into the **Agent operating instructions** markdown. The instructions item describing the `applyAgentChange` field shape is updated to include the target.

### Portable-format degradation (ADR 0013)

- While multi-page is experimental, the Web share URL, the `.akselarcade` package, and the share snapshot remain single-page and carry only the Start page, with an explicit warning that other pages are not included. The portable formats are not version-bumped to carry the full page set yet; lossless multi-page portability is a planned follow-up for when the feature graduates from the flag.

## Testing Decisions

A good test here asserts **external behaviour through a module's public interface**, not its internals: given inputs, assert the returned data / emitted result / rendered output and observable side effects. Tests should not assert private helpers, intermediate strings, or implementation structure that can change without changing behaviour. Pure deep modules are tested directly; UI glue is tested through a couple of focused integration tests that drive real user interactions.

Modules to be tested:

1. **Page model & lifecycle service** — create assigns the next frozen id and makes the page active; ids are never reused after delete; rename changes only the display name (id and references unchanged); delete is rejected on the last page; deleting the start page reassigns start to the first remaining page; migration turns a single-page project into `page01` "Page 1" with an empty Global config. Prior art: `tests/unit/projectDefaults.test.ts`, `tests/unit/insertSnippet.test.ts`.
2. **Page reference analyzer** — finds `goToPage` and `href`/`to` references with correct positions; classifies references to missing ids as stale and to existing ids as valid; ignores external links; counts impact across multiple bodies. Prior art: `tests/unit/akselCatalog.test.ts` (pure-data assertions).
3. **Multi-page bundle compiler** — compiling Global config + pages yields one runnable bundle exposing `goToPage`/`currentPageId`; the start page renders first; a shared Global config component is usable from a page; flag-off compilation reproduces the current single-page output. Prior art: `tests/integration/transpiler.test.ts`, `tests/integration/sandbox.test.ts`.
4. **Pages-aware Agent bridge** — `getProject` returns the pages model; `createPage` returns an app-assigned id and the agent cannot set one; `renamePage`/`deletePage`/`setStartPage`/`selectActivePage` enforce the same invariants; `applyAgentChange` routes code to the targeted page or Global config; page CRUD requires `sourceChanges`; protocol version is 3; with the flag off, the bridge reports single-page and the instructions tell the agent to ask the human. Prior art: `tests/unit/services/agentBridge.test.ts`.
5. **Workspace multi-page preference** — the flag, panel open/closed state, and last active page round-trip through working-copy storage; they are absent from shared/exported payloads. Prior art: `tests/unit/services/storage.test.ts`.
6. **Page navigation autocomplete source** — completions appear inside `goToPage('…')` and `href`/`to`, show name + id, insert the id, and do not appear in unrelated positions; work in Global config. Prior art: `tests/unit/akselAutocomplete.test.ts`.

Plus:

7. **Migration regression (e2e)** — an existing single-page working copy still loads and previews unchanged after the feature ships. Prior art: `tests/e2e/migration-regression.spec.ts`.
8. **A couple of integration tests for the UI glue** — driving the PagePanel (add/rename/delete/set-start/switch active) and the preview↔panel sync (navigating in the preview moves the panel + editor; selecting Global config shows the placeholder). Prior art: `tests/integration/component-palette.test.tsx`, `tests/integration/project-controls-layout.test.tsx`.

## Out of Scope

- **Lossless multi-page portability.** Sharing/exporting the full page set (versioned, backward-compatible portable formats) is deferred until the feature graduates from the flag (ADR 0013).
- **Page reordering** in the panel (pages keep their append order).
- **Page duplication / templates.**
- **URL-based routing / deep links** to a specific page from outside the prototype; navigation is internal to the running prototype only.
- **Cross-page React state persistence** beyond Global config module scope; each page renders fresh on navigation by design.
- **A general feature-flag framework**; multi-page reuses the existing Workspace-preference + working-copy-storage mechanism.
- **A hard page cap**; the existing project size guard remains the only limit.
- **Changing the "Hooks" tab label** to match the Figma "Hook".

## Further Notes

- The authoritative visual/interaction spec is the Figma frame `99:392` (panel `101:938`, code header `99:413`, row ActionMenu `105:1629`), including the icon mapping (`SidebarLeftIcon`, `ExclamationmarkTriangleIcon`, `LinkBrokenIcon`, `MenuElipsisVerticalIcon`, `HouseIcon`, `PencilIcon`, `TrashIcon`, `PlusIcon`) and `--ax` tokens.
- The domain language for this feature is defined in `CONTEXT.md` (Arcade page, Global config, Page reference, Stale page reference, Page navigation, Active page, Start page, plus the pages-aware Agent bridge entries). Use those terms in implementation and tests.
- Decisions that are hard to reverse are recorded in ADRs 0011–0014; respect them.
- When multi-page graduates from the flag, the planned follow-ups are: lossless, version-bumped, backward-compatible-on-read portable formats; these should get their own PRD/ADR.

const MCP_GUIDANCE_RESOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    uri: 'arcade://desktop/start-here',
    name: 'Desktop Arcade MCP start-here guide',
    description: 'Minimal first-read guide for zero-knowledge MCP clients.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/workflows/replace-project',
    name: 'Desktop Arcade replace-project workflow',
    description: 'Scoped workflow for replacing existing Arcade project content without waste.',
    mimeType: 'text/markdown',
  }),
  Object.freeze({
    uri: 'arcade://desktop/workflows/multi-page-navigation',
    name: 'Desktop Arcade multi-page navigation workflow',
    description: 'Rules and examples for page navigation in Arcade source.',
    mimeType: 'text/markdown',
  }),
])

const createMcpGuidanceResourceText = (uri) => {
  switch (uri) {
    case 'arcade://desktop/start-here':
      return [
        '# Desktop Arcade MCP start-here',
        '',
        'This is the only on-ramp you need: reading this once plus `arcade://project/manifest` is enough to start authoring. Treat this MCP server as the only source of truth for the active Desktop Arcade project — do not inspect the repository or local files.',
        '',
        '## First steps',
        '1. If your client has resource methods, read `arcade://project/manifest`. If it only has tools, call `read_resource` with that URI.',
        '2. Read the source URIs listed in the manifest before editing existing work.',
        '3. For annotation review work, call `list_annotations` first or read `arcade://project/annotations` / `arcade://project/pages/{pageId}/annotations` for non-dead history and counts. Use `watch_annotations` for pending-only long-polling and `acknowledge_annotation` / `resolve_annotation` / `dismiss_annotation` / `reply_to_annotation` to change annotation state or thread history.',
        '4. Make durable edits with `apply_changes`, then read `arcade://project/diagnostics`, then use `capture_preview_evidence` for rendered proof.',
        '',
        '## Authoring mechanics you cannot infer (read before writing source)',
        '- **Import-free:** React, Aksel components, Aksel icons, and hooks are injected globals. Never write `import` statements.',
        '- **jsx vs hooks:** every Arcade page (and Global config) has two source tabs, `jsx` and `hooks`. The `jsx` source is inlined into `return ( … )`, so it must be a single JSX element/expression and must **never** be wrapped in `{ … }` (a leading `{` parses as an object literal and breaks the whole preview). In a page `hooks` tab, top-level hook bindings such as `const [value, setValue] = useState(...)` or `const id = useId()` are hoisted into that page component, so page state belongs there. Global config `hooks` is module scope: define shared custom hooks, helpers, constants, and components there, but never call hooks at its top level.',
        '- **Navigation:** move between pages with `goToPage("pageNN")`, or an Aksel `Link`/`LinkCard` whose `href`/`to` is a bare page id. The current page id is injected read-only as `currentPageId`. There is no router and no `<a href>` navigation.',
        '- **Page ids are app-assigned.** Within one `apply_changes` batch, link pages with `{{pageRef:name}}` placeholders targeting any `create_page.newPageRef` declared in that batch.',
        '- **Use real Aksel components and props** — do not hand-roll raw HTML or guess prop names. If an Aksel component resource resolves to a replacement payload, follow the sanctioned replacement instead of reintroducing the hidden/deprecated component. Pull per-component usage on demand (see on-demand references); do not preload it.',
        '- **Annotations are page-scoped review data.** `list_annotations` defaults to open work on the active page. Use `watch_annotations` for pending-only long-polling and the annotation mutation tools when you need to change state. The annotation resources keep non-dead history, while hidden-but-resolved targets still count as real work.',
        '- **Global config** is shared code in scope for every page; it never renders as a page on its own.',
        '- **Pages are independent screens.** They do not share React state; build a stateful flow as one page.',
        '- **Capture is ephemeral:** `capture_preview_evidence` renders in an isolated throwaway frame, so in-capture interactions and `goToPage` never change the human-visible Active page or durable source — never try to "restore" the Active page after a capture.',
        '',
        '## On-demand references (optional — fetch only when you need the depth)',
        '- `arcade://desktop/authoring-guide` — fuller authoring rules and the priority order for fetching Aksel component usage/snippets.',
        '- `arcade://desktop/apply-changes-operations` — the per-operation field matrix for `apply_changes`.',
        '- `arcade://desktop/workflows/replace-project` — before replacing existing project content.',
        '- `arcade://desktop/workflows/multi-page-navigation` — page-flow patterns in depth.',
        '- `arcade://aksel/catalog` (+ one `arcade://aksel/components/{name}` at a time) — version-matched, import-free component snippets.',
      ].join('\n')
    case 'arcade://desktop/workflows/replace-project':
      return [
        '# Replace an existing Arcade project',
        '',
        'When the human says to replace existing Arcade content, treat current content as disposable, but keep the project coherent and scoped.',
        '',
        '## Algorithm',
        '',
        '1. Read `arcade://project/manifest` and the source resources for pages you will reuse.',
        '2. Decide the exact desired page count from the task.',
        '3. Reuse the first ordered existing pages before creating new pages. Rename and replace their source instead of abandoning them.',
        '4. Create only missing pages, in the same logical order a human expects to see them.',
        '5. Source `{{pageRef:name}}` placeholders may target any `create_page.newPageRef` declared in the same batch, so do not reverse pages just to satisfy references.',
        '6. Delete extra old pages after the pages you keep have the source you want.',
        '7. Set `set_start_page` and `select_active_page` to the first logical page unless the user says otherwise.',
        '8. Add `assertions` to the same `apply_changes` call, for example `{"pageCount":3,"startPage":"first","activePage":"first","forbidImports":true}`.',
        '',
        '## Do not',
        '',
        '- Do not leave failed first attempts behind.',
        '- Do not create a second full copy of a flow instead of replacing or deleting the first one.',
        '- Do not make `page08` the start page just because references were easier in reverse order.',
      ].join('\n')
    case 'arcade://desktop/workflows/multi-page-navigation':
      return [
        '# Multi-page navigation in Arcade',
        '',
        'Page navigation targets stable app-assigned page ids such as `page01`. Page names are only labels.',
        '',
        'Use one of these patterns:',
        '',
        '```jsx',
        '<Button onClick={() => goToPage("page02")}>Next</Button>',
        '<Link href="page02">Open details</Link>',
        '<LinkCard href="page02">Open details</LinkCard>',
        '```',
        '',
        'For pages created in the same `apply_changes` batch, use placeholders in source and let Arcade rewrite them:',
        '',
        '```jsx',
        '<Button onClick={() => goToPage("{{pageRef:step2}}")}>Next</Button>',
        '```',
        '',
        'Do not use browser URLs for page flow: no `?pageId=...`, no external URLs, and no raw `Button as="a"` flow buttons. If you need a button-like page transition, use `goToPage` in `onClick`.',
      ].join('\n')
    default:
      return null
  }
}

module.exports = {
  MCP_GUIDANCE_RESOURCE_DEFINITIONS,
  createMcpGuidanceResourceText,
}

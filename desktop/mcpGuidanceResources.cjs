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
        'Use this MCP server as the only source of truth for the active Desktop Arcade project. Do not inspect the repository or local files.',
        '',
        '1. If your client has resource methods, read `arcade://project/manifest`. If it only has tools, call `read_resource` with that URI.',
        '2. Read the source URIs from the manifest before editing existing work.',
        '3. For replacement tasks, read `arcade://desktop/workflows/replace-project` before calling `apply_changes`.',
        '4. For page flow/navigation tasks, read `arcade://desktop/workflows/multi-page-navigation`.',
        '5. Use `apply_changes` for durable edits, then read `arcade://project/diagnostics`, then use `capture_preview_evidence` for rendered proof.',
        '',
        'Keep source import-free. React, Aksel components, icons, and hooks are injected globals in Arcade.',
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

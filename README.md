# 🎮 Aksel Arcade

**A React playground for the Aksel v8 design system, available as Web Arcade and Desktop Arcade**

Build and experiment with UI components instantly in Web Arcade, or download Desktop Arcade when you need the desktop product surface.

🚀 **[Launch Aksel Arcade](https://navikt.github.io/aksel-arcade/)**

---

## What is Aksel Arcade?

Aksel Arcade is an interactive coding environment that lets designers and developers prototype React UIs using the [Aksel design system](https://aksel.nav.no). Web Arcade is the browser-hosted product surface; Desktop Arcade is the downloadable desktop product surface published through GitHub Releases. Write JSX, see results instantly, and share your prototypes with a simple JSON export.

Perfect for:
- 🎨 **Designers** exploring component combinations
- 👨‍💻 **Developers** testing Aksel components before implementation
- 🧪 **Teams** collaborating on UI prototypes
- 📚 **Learning** React and the Aksel design system

---

## ✨ Key Features

### 📝 Smart Code Editor
- **Dual-tab editing**: Write JSX for UI and custom React hooks in separate tabs
- **Intelligent autocomplete**: Get suggestions for Aksel components and their props as you type
- **Live linting**: See syntax errors highlighted in real-time
- **One-click formatting**: Clean up your code with Prettier (Cmd/Ctrl+S)
- **Component palette**: Quick-insert snippets for Aksel components with sensible defaults

### 👁️ Live Preview
- **Instant updates**: See your UI render as you type (250ms debounce)
- **Responsive testing**: Toggle between 6 viewport sizes (XS 320px → 2XL 1440px)
- **Light/dark themes**: Preview components with current Aksel styling
- **Error overlay**: Friendly error messages when something goes wrong

### 🔍 Inspect Mode ⭐
One of Aksel Arcade's most powerful features! Enable inspect mode to:
- **Hover over any element** to see its details in a smart popover
- **Component identification**: See the component name and CSS class
- **Props inspector**: View all active props passed to the component
- **Computed styles**: Get color, font, margin, and padding values
- **Debug faster**: Understand exactly how your UI is structured

### 💾 Project Management
- **Export/Import projects**: Save your work as JSON files and share with teammates
- **Auto-save**: Your current Web Arcade working copy persists in tab-scoped storage for reload safety
- **Edit project names**: Keep your prototypes organized
- **Tab reload recovery**: Reload the same tab to restore its working copy; use Share or Export to keep work after closing it

### 🔗 Share Projects Instantly
- **Header Share button**: Click the Link icon between Import and Settings to open the share popover without leaving your flow.
- **One-click CopyButton**: The popover generates a link client-side, keeps the CopyButton disabled until ready, and confirms when the URL is copied.
- **Offline-aware**: If generation takes longer than expected or clipboard permissions are denied, you’ll get inline guidance plus a manual copy fallback without revealing the full URL.
- **Payload guard rails**: Oversize snapshots are caught by a 1.4× heuristic before compression finishes, so the CopyButton never flashes an unusable link.
- **Still exportable**: Oversize warnings now include a dedicated **Use Export instead** CTA that triggers the JSON export flow without leaving the popover.
- **Telemetry-backed SLA**: Every generation and clipboard attempt emits a telemetry event so we can prove the 95% < 3 s / 99% clipboard-success targets from the spec.

### 🛡️ Safe Sandbox
- Code runs in an isolated iframe for security
- No backend dependencies—fully offline-capable
- All processing happens in your browser

---

## 🚀 Getting Started

### Use Web Arcade
Just visit **[https://navikt.github.io/aksel-arcade/](https://navikt.github.io/aksel-arcade/)** and start coding in the browser-hosted Web Arcade. No Desktop install artifact is needed for Web Arcade, and ordinary Web Arcade URLs do not install, update, or distribute Desktop Arcade.

### Download Desktop Arcade
Desktop Arcade is distributed from the repository's **[GitHub Releases](https://github.com/navikt/aksel-arcade/releases)** page. Team testers should use the latest matching GitHub pre-release for the active RC cycle, and end users should use the latest published release tagged `desktop-vX.Y.Z`:

| Machine | Desktop install artifact |
| --- | --- |
| Mac with Apple Silicon | `Aksel-Arcade-X.Y.Z-mac-arm64.dmg` |
| Mac with Intel processor | `Aksel-Arcade-X.Y.Z-mac-x64.dmg` |

Replace `X.Y.Z` with the Desktop Arcade version shown in the release. The current Desktop distribution path does not include a Web Arcade download UI, in-app updates, package-manager distribution, checksum artifacts, or Windows installers. macOS DMGs are signed and notarized.

---

## 📖 How to Use

### Using Code Autocomplete ⚡

Aksel Arcade features intelligent autocomplete to speed up your workflow:

- **Component names**: Type `<But` and see `Button` suggested
- **Props**: Type `<Button var` to get `variant` suggestions
- **Prop values**: See available options like `primary`, `secondary`, `tertiary` for the `variant` prop
- **Import-free authoring**: Aksel components and icons are available in the playground without setup, while exports include production import guidance

**Pro tip**: Press `Ctrl+Space` to manually trigger autocomplete at any time.

### Using Inspect Mode 🔍

Inspect mode helps you understand your UI structure:

1. Click the **"Inspect"** button in the toolbar (or use keyboard shortcut)
2. **Hover over any element** in the preview pane
3. **See detailed information** in the popover:
   - Component/element name
   - CSS class name
   - Active props (for React components)
   - Computed styles: color, font, margins, padding

**Pro tip**: Use inspect mode to:
- Debug spacing issues (check margin/padding values)
- Verify color tokens are applied correctly
- Understand component hierarchies
- Copy CSS class names for reference

### Exporting & Importing Projects 📦

**To Export:**
1. Click the **"Export"** button in the header
2. A JSON file downloads with your project name (e.g., `My Project.json`)
3. The file contains:
    - Project name
    - JSX code
    - Hooks code
    - Viewport settings
    - Aksel v8 metadata with exact package versions, docs links, and production setup guidance

**To Import:**
1. Click the **"Import"** button in the header
2. Select a previously exported `.json` file
3. Your project loads instantly with all code and settings restored

**Pro tip**: Use export/import to:
- Share prototypes with teammates
- Create backups of your work
- Transfer projects between browsers
- Build a library of reusable patterns

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run desktop:dev      # Start macOS-first Desktop Arcade dev shell
npm run desktop:build    # Build Desktop Arcade renderer with local relative assets
npm run desktop:package  # Build unsigned macOS Desktop install artifacts without publishing
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run type-check       # TypeScript type checking
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run aksel:refresh-docs -- --write src/data/akselAutocompleteData.ts
                         # Fetch fresh Aksel docs and rewrite checked-in docs metadata
npm run aksel:audit -- --target 8.11.0
                         # Run the manual Aksel docs/runtime/catalog drift audit
```

Playwright starts its own isolated Vite server by default. To intentionally reuse a local
server, run `PLAYWRIGHT_REUSE_SERVER=true PLAYWRIGHT_PORT=<port> npm run test:e2e`.

### Manual Aksel upgrade and audit workflow

Ordinary `npm run typecheck`, `npm run lint`, and `npm test` stay network-independent. Fresh `https://aksel.nav.no/llm.md` data is only fetched by the explicit maintainer commands above.

When you intentionally upgrade Arcade to a new Aksel version:

1. Update the pinned runtime packages and lockfile:

   ```bash
   npm install --save-exact @navikt/ds-react@X.Y.Z @navikt/ds-css@X.Y.Z @navikt/aksel-icons@X.Y.Z
   ```

2. Refresh the checked-in docs metadata from fresh Aksel docs:

   ```bash
   npm run aksel:refresh-docs -- --write src/data/akselAutocompleteData.ts
   ```

3. Run the focused drift audit for the same target version:

   ```bash
   npm run aksel:audit -- --target X.Y.Z
   ```

4. Review the report before changing policy:
   - **Potential findings** are new or changed drift that still needs human review.
   - **Accepted exceptions** come from the explicit local ledger for known Arcade-specific differences such as runtime aliases or legacy compatibility entries.

5. If the audit surfaces a new or changed potential local exception, stop and clarify that policy with a human before encoding it as an accepted Arcade exception.

6. After any intentional catalog/docs updates, run the normal validation loop again:

   ```bash
   npm run typecheck
   npm run lint
   npm test -- --run
   ```

### Shell capability modes

Web Arcade is the default dev mode: Share URL is available and Agent access is not available. To launch the Desktop Arcade development shell, run:

```bash
npm run desktop:dev
```

The desktop script starts Vite on the first available `127.0.0.1` port from `5173` and opens an Electron shell around that exact renderer. Desktop capabilities are supplied only through a narrow preload IPC bridge, so React components stay browser-like: the Electron shell receives the Desktop Arcade capability set without direct Node, socket, process, or filesystem access. The same renderer URL opened in a normal browser remains Web Arcade with Share URL available and no Agent access, Agent runtime, browser-global Agent bridge, or Agent pairing handoff.

### Desktop Arcade MCP v1 setup and smoke checklist

Desktop Arcade exposes a local MCP server only in the desktop shell. Web Arcade does **not** expose an MCP endpoint.

| Setting | Value |
| --- | --- |
| Server name | `aksel-arcade` |
| Type | `HTTP (MCP Streamable HTTP)` |
| URL | `http://127.0.0.1:3846/mcp` |
| Auth | No token/header required. |

Desktop MCP v1 publishes nine tools — `read_resource`, `list_annotations`, `watch_annotations`, `acknowledge_annotation`, `resolve_annotation`, `dismiss_annotation`, `reply_to_annotation`, `capture_preview_evidence`, and `apply_changes` — plus `arcade://desktop/*`, `arcade://aksel/*`, `arcade://project/*`, dynamic page annotation resources at `arcade://project/pages/{pageId}/annotations`, and capture-produced `arcade://preview/captures/*` resources. Read resources through MCP `resources/list`/`resources/read`; tool-only hosts can call `read_resource({ uri })` for the same content. Arcade source is virtual `arcade://...` content, not repository-backed source content.

On connect, the server returns self-teaching `initialize.result.instructions` pointing agents to `arcade://desktop/start-here`, the import-free sandbox, `goToPage` navigation, app-assigned page ids with `{{pageRef:name}}`, and the apply→diagnostics→capture loop. Replacement and page-flow guidance is split into `arcade://desktop/workflows/replace-project` and `arcade://desktop/workflows/multi-page-navigation`. Per-component Aksel usage is pulled on demand — never preloaded — through `arcade://aksel/catalog` (a version-matched index) and one `arcade://aksel/components/{name}` snippet resource at a time.

For the full smoke checklist, use an MCP client that exposes `resources/list` and `resources/read` (or an equivalent resource inspector). Tool-only MCP hosts should call `read_resource` for stable resources, annotation resources, diagnostics, source, Aksel snippets, and capture evidence.

1. Start Desktop Arcade with a multi-page Arcade project.
2. Add the MCP server to your client with the exact settings above.
3. Verify `initialize` returns `instructions` that mention `goToPage`, the import-free sandbox, and `arcade://desktop/start-here`.
4. Verify `tools/list` returns the nine tools listed above.
5. Verify `resources/list` and `resources/read` can read `arcade://desktop/start-here`, `arcade://desktop/workflows/replace-project`, `arcade://desktop/workflows/multi-page-navigation`, `arcade://desktop/operating-guide`, `arcade://desktop/authoring-guide`, `arcade://desktop/capabilities`, `arcade://desktop/apply-changes-operations`, `arcade://aksel/catalog`, `arcade://project/manifest`, `arcade://project/annotations`, `arcade://project/preview-context`, and `arcade://project/diagnostics`, plus one page annotation resource such as `arcade://project/pages/{pageId}/annotations`.
6. Read `arcade://aksel/catalog`, then read one `arcade://aksel/components/{name}` resource and confirm its snippet is import-free and version-matched.
7. Read `arcade://project/manifest`, follow the source resource URIs it returns, and confirm the source matches the open Arcade project.
8. Run `apply_changes` with one batch that updates existing source and creates/links a page by using `create_page.newPageRef`, later lifecycle `tempPageRef` targets, `{{pageRef:name}}` placeholders, and replacement-task assertions such as `{"pageCount":3,"startPage":"first","activePage":"first","forbidImports":true}`.
9. Unless the user asked for a different workflow, read `arcade://project/diagnostics` after the batch, then confirm the visible Desktop preview reflects the durable change.
10. Call `capture_preview_evidence({ pageId })` for the new page, then read the returned `manifest`, `screenshot`, `accessibility`, `dom-layout-style`, and `frame` resources.
11. Verify capturing a non-active page does not change the visible Active page unless `select_active_page` was used intentionally.
12. Open Desktop Settings and verify MCP availability plus safe last-activity metadata only.
13. Open the same renderer in a normal browser and verify Web Arcade shows no Desktop MCP settings section and no Web MCP endpoint.

Desktop MCP v1 intentionally omits prompts, SSE/subscriptions, general filesystem/network/shell/clipboard access, import/export/share/package tools, arbitrary JavaScript execution, visual diffing, and any Web Arcade MCP endpoint.

### Local unsigned Desktop packaging

Use `npm run desktop:build` to create Desktop Arcade renderer output in `dist-desktop` with relative asset URLs, separate from the Web Arcade GitHub Pages build in `dist`. Use `AKSEL_ARCADE_DESKTOP_VERSION=0.2.0 npm run desktop:package` to build the supported unsigned local macOS installers into `release/desktop` without publishing:

| Platform | Artifact |
| --- | --- |
| Mac Apple Silicon | `Aksel-Arcade-X.Y.Z-mac-arm64.dmg` |
| Mac Intel | `Aksel-Arcade-X.Y.Z-mac-x64.dmg` |

For host-specific local packaging, use `npm run desktop:package:mac`. macOS DMGs require macOS.

### Tech Stack

- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool and dev server
- **Electron** - macOS-first Desktop Arcade development shell with narrow preload IPC
- **CodeMirror 6** - Code editor
- **Babel Standalone** - In-browser JSX transpilation
- **@navikt/ds-react** - Aksel v8 React components
- **@navikt/ds-css** - Aksel CSS, tokens, resets, and theme styles
- **Vitest + Playwright** - Testing

---

## 🏗️ Architecture

Aksel Arcade's shared renderer runs client-side:

```
┌─────────────────────────────────────┐
│  Main Application (React)          │
│  ├─ Code Editor (CodeMirror)       │
│  ├─ Component Palette               │
│  └─ Preview Container               │
│      └─ Sandboxed iframe            │
│         ├─ Babel (JSX → JS)         │
│         ├─ User Code Execution      │
│         └─ Aksel Components         │
└─────────────────────────────────────┘
```

- **No backend**: Everything runs client-side
- **Safe execution**: User code runs in isolated iframe
- **Offline-capable**: All dependencies bundled at build time
- **Tab-scoped persistence**: Web Arcade working copies survive same-tab reloads without servers
- **Explicit shells**: Web Arcade keeps browser sharing and no Agent access; Desktop Arcade adds Agent access only through the narrow desktop transport.

## 🧰 Troubleshooting

### Oversize share links
- Share URLs now issue a warning between 3,600-4,000 characters and hard-stop at 4,000. A pre-flight heuristic multiplies the snapshot length by ~1.4; if the estimate breaks those guard rails the popover immediately disables CopyButton and shows **Use Export instead**.
- Click the CTA to trigger the JSON export without leaving the popover, or trim files and hit **Retry generation** to try again.
- Developers can verify the guard rails by inspecting `window.__AKSEL_TELEMETRY_LOG__` and ensuring a `share_generation` event with `outcome: "oversize"` fires when the warning appears.

### Clipboard access when sharing projects
- `navigator.clipboard.writeText` works in Chromium, Firefox, and Safari as long as the page is served over HTTPS (or `http://localhost` during development). If the API is unavailable or permission is denied, the Share popover automatically falls back to a hidden textarea copy path so the CopyButton still guides you through copying the link.
- Safari and hardened enterprise browsers occasionally block clipboard writes until the user interacts with the page. Click anywhere inside the editor (or the Share popover) and try copying again; the fallback path triggers instantly when the modern API throws.
- If you have previously denied clipboard permissions, open your browser site settings (`chrome://settings/content/clipboard`, `edge://settings/content/clipboard`, or Safari > Settings for This Website) and re-allow clipboard access. The troubleshooting banner in the README matches the runtime messaging so users know why CopyButton is disabled.
- Offline mode or browser profiles with `document.execCommand` disabled will show inline helper text instructing you to use the hidden textarea output. You can always press `Cmd/Ctrl+C` after the text is auto-selected to finish copying manually, and telemetry should still log the attempt with `outcome: "fallback"` to keep the 99% target honest.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

### Local Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Make your changes
5. Run tests: `npm test` and `npm run test:e2e`
6. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

Built with ❤️ using:
- [Aksel Design System](https://aksel.nav.no/) by NAV
- [CodeMirror](https://codemirror.net/) for the editor
- [Babel](https://babeljs.io/) for JSX transpilation
- [React](https://react.dev/) for the UI framework
- [Agentation](https://github.com/benjitaylor/agentation) for the annotation schema and workflow reference

---

## 🔗 Links

- **Live App**: https://navikt.github.io/aksel-arcade/
- **Aksel Documentation**: https://aksel.nav.no/
- **Report Issues**: https://github.com/navikt/aksel-arcade/issues

---

**Ready to build something awesome? [Start prototyping now!](https://navikt.github.io/aksel-arcade/)** 🚀

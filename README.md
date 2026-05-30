# 🎮 Aksel Arcade

**A browser-based React playground for the Aksel v8 design system**

Build and experiment with UI components instantly—no setup, no installation, no backend. Just open your browser and start creating.

🚀 **[Launch Aksel Arcade](https://navikt.github.io/aksel-arcade/)**

---

## What is Aksel Arcade?

Aksel Arcade is an interactive coding environment that lets designers and developers prototype React UIs using the [Aksel design system](https://aksel.nav.no) directly in the browser. Write JSX, see results instantly, and share your prototypes with a simple JSON export.

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

## ✅ Share Success Criteria

- **95% of share generations finish < 3 s** — the telemetry payload exposes `withinTarget: true` whenever we’re inside the budget, so you can check `window.__AKSEL_TELEMETRY_LOG__` in DevTools while testing.
- **99% clipboard success rate** — CopyButton paths use the native API first and log `share_clipboard` events with `outcome: "success"`; fallback selections show up as `"fallback"` and should stay below 1%.
- **Oversize guard rails fire before compression** — as soon as estimates cross 3,600 characters the popover shows a warning badge, and any token projected to exceed 4,000 characters logs a `share_generation` event with `outcome: "oversize"` and disables the CopyButton while surfacing the export CTA.

### 🛡️ Safe Sandbox
- Code runs in an isolated iframe for security
- No backend dependencies—fully offline-capable
- All processing happens in your browser

---

## 🚀 Getting Started

### Use the Live App
Just visit **[https://navikt.github.io/aksel-arcade/](https://navikt.github.io/aksel-arcade/)** and start coding!

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

## ⌨️ Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Undo | `Cmd+Z` | `Ctrl+Z` |
| Redo | `Cmd+Shift+Z` | `Ctrl+Y` |


---

## 🛠️ Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run desktop:dev      # Start macOS-first Desktop Arcade dev shell
npm run desktop:build    # Build Desktop Arcade renderer with local relative assets
npm run desktop:package  # Build unsigned Desktop install artifacts without publishing
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run type-check       # TypeScript type checking
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Shell capability modes

Web Arcade is the default dev mode: Share URL is available and Agent access is not available. To launch the Desktop Arcade development shell, run:

```bash
npm run desktop:dev
```

The desktop script starts Vite on `127.0.0.1:5173` and opens an Electron shell around the same renderer. Desktop capabilities are supplied only through a narrow preload IPC bridge, so React components stay browser-like: the Electron shell receives the Desktop Arcade capability set without direct Node, socket, process, or filesystem access. The same renderer URL opened in a normal browser remains Web Arcade with Share URL available and no Agent access, Agent runtime, browser-global Agent bridge, or Agent pairing handoff.

### Local unsigned Desktop packaging

Use `npm run desktop:build` to create Desktop Arcade renderer output in `dist-desktop` with relative asset URLs, separate from the Web Arcade GitHub Pages build in `dist`. Use `AKSEL_ARCADE_DESKTOP_VERSION=0.1.0 npm run desktop:package` to build the configured unsigned local installers into `release/desktop` without publishing:

| Platform | Artifact |
| --- | --- |
| Windows x64 | `Aksel-Arcade-X.Y.Z-windows-x64.exe` |
| Mac Apple Silicon | `Aksel-Arcade-X.Y.Z-mac-arm64.dmg` |
| Mac Intel | `Aksel-Arcade-X.Y.Z-mac-x64.dmg` |

For host-specific local packaging, use `npm run desktop:package:mac` or `npm run desktop:package:win`. macOS DMGs require macOS, and Windows NSIS builds from macOS or Linux may require Wine.

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

---

## 🔗 Links

- **Live App**: https://navikt.github.io/aksel-arcade/
- **Aksel Documentation**: https://aksel.nav.no/
- **Report Issues**: https://github.com/navikt/aksel-arcade/issues

---

**Ready to build something awesome? [Start prototyping now!](https://navikt.github.io/aksel-arcade/)** 🚀

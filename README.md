# 🎮 Aksel Arcade

**A browser-based React playground for the Aksel Darkside design system**

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
- **Darkside theme**: Preview components with authentic Aksel styling
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
- **Auto-save**: Your project persists in localStorage automatically
- **Edit project names**: Keep your prototypes organized
- **Session recovery**: Return to your last project when you reopen the app

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
- **Imports**: Get suggestions for Aksel components when typing import statements

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
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run type-check       # TypeScript type checking
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Tech Stack

- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool and dev server
- **CodeMirror 6** - Code editor
- **Babel Standalone** - In-browser JSX transpilation
- **@navikt/ds-react** - Aksel Darkside components
- **Vitest + Playwright** - Testing

---

## 🏗️ Architecture

Aksel Arcade runs entirely in the browser:

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
- **localStorage persistence**: Auto-save without servers

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

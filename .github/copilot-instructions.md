# AkselArcade Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-11-06

## Active Technologies
- TypeScript 5.x / JavaScript ES2022+ with React 19 and Vite.
- Aksel v8.11.0 packages pinned exactly: `@navikt/ds-react`, `@navikt/ds-css`, and `@navikt/aksel-icons`.
- `@navikt/ds-css` is the runtime CSS import; do not use legacy CSS subpaths as the setup path.
- `@navikt/ds-css` includes Aksel CSS variables from tokens; do not add a direct runtime `@navikt/ds-tokens` dependency unless a development-only tool explicitly needs it.
- `@uiw/react-codemirror`, `@babel/standalone`, Web Crypto APIs, local telemetry, Vitest + Testing Library, and Playwright.
- Browser-only persistence and sharing: localStorage plus encoded URL payloads; no backend.
- Aksel Arcade authoring is import-free in the sandbox. Production imports belong in export metadata and copied-out app code.

## Project Structure

```text
src/
├── components/
│   ├── Editor/          # Code editor with tabs
│   ├── Preview/         # Live preview pane
│   ├── Sandbox/         # Iframe runtime
│   ├── Header/          # App header
│   └── Layout/          # Split pane layout
├── services/            # Business logic
├── hooks/               # Custom React hooks
├── types/               # TypeScript types
├── utils/               # Utilities
├── App.tsx              # Root component
└── main.tsx             # Entry point
tests/
├── components/          # Component tests
├── integration/         # Integration tests
└── e2e/                 # End-to-end tests
```

## Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm test                 # Run tests
npm run type-check       # TypeScript type checking
npm run lint             # ESLint
npm run format           # Prettier formatting
npm run build            # Production build
npm run preview          # Preview production build
```

## Code Style

**TypeScript / JavaScript**:
- Use TypeScript for type safety (strongly encouraged)
- Functional components with hooks (no class components)
- Follow React 18+ best practices
- Use ES2022+ features
- 2-space indentation
- Prettier for formatting
- ESLint for linting

**React Conventions**:
- Hooks-based functional components
- Descriptive component names (PascalCase)
- Props interface for TypeScript components
- Use `useState`, `useEffect`, `useContext` appropriately
- Custom hooks in `src/hooks/`
- Avoid prop drilling (use Context or Zustand for global state)

**Aksel v8 Usage**:
- Import from `@navikt/ds-react` for components
- Import `@navikt/ds-css` once for styles, resets, fonts, and Aksel CSS variables
- Use `<Theme>` from `@navikt/ds-react/Theme` for light/dark theme semantics
- Use current layout primitives such as `Box`, `HStack`, `VStack`, `HGrid`, `Page`, and `Bleed`
- CSS variables use the `--ax` prefix (not `--a` or `--ac`)

**Security**:
- Execute user code only in sandboxed iframe
- Validate all postMessage communications
- Block network requests from user code
- Enforce Content Security Policy

**Performance**:
- Debounce preview updates (250ms)
- Lazy load heavy components (Babel Standalone, ComponentPalette)
- Code splitting with Vite
- Monitor bundle size (target <2s load on 3G)

**Testing**:
- Component tests for stateful components
- Integration tests for critical flows
- E2E tests for priority user stories (max 5-10 scenarios)
- No over-testing (pragmatic approach per Constitution)

## Recent Changes
- 001-aksel-v8-migration: Updated project memory to the Aksel v8 playground model with exact 8.11.0 package pins, current `@navikt/ds-css` setup, import-free sandbox authoring, and production import guidance in exports.
- 001-inspect-overlay-gaps: Added inspect/preview services, React testing stack (Vitest + Testing Library), and Playwright E2E coverage.
- 001-share-project-url: Added encoded share payloads, `lz-string`, Web Crypto API (`crypto.subtle`), local telemetry service, and share-link guard rails.


<!-- MANUAL ADDITIONS START -->

## CRITICAL: Verification Before Completion

**MANDATORY RULE**: Before claiming any feature/fix is "done" or "ready to test":

1. **Check for errors**: Run `npm run type-check` and verify no TypeScript errors
2. **Test in browser**: Open the app in browser (http://localhost:5173) and verify the feature actually works
3. **Console check**: Open browser DevTools console and verify no runtime errors
4. **Visual verification**: Confirm the UI renders correctly without crashes

**Never tell the user something is "done", "working", "ready to test", or "complete" without first completing ALL verification steps above.**

The user is testing UX, not debugging technical failures. It is YOUR responsibility as the AI to ensure technical functionality works before handing off to the user.

If verification fails, fix the issues and verify again before responding to the user.

## Release workflow policy

- Default ordinary feature work to the protected `release-candidate` branch. Branch from `release-candidate`, open PRs back to `release-candidate`, and treat that branch as the normal integration line.
- Touch `master` only when the user explicitly asks for a **Release promotion** or a **Hotfix**.
- The current RC target version lives in `.github/release-candidate.json`. Agents and release automation should treat that file as the source of truth for the active RC cycle.
- Desktop-impacting merges to `release-candidate` are intended to publish signed Desktop release candidates. Merges to `master` are intended to publish the public Desktop release and the stable GitHub Pages site.
- Agents may merge to `master` only on explicit user instruction and only after the required checks pass.
- Hotfixes start from `master` and must be carried back into `release-candidate` after the public patch release work is merged.
- See `docs/desktop-release.md` for the full runbook, bootstrap checklist, and copy-paste user request examples.

<!-- MANUAL ADDITIONS END -->

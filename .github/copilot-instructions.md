# AkselArcade Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-11-06

## Active Technologies

- TypeScript 5.x / JavaScript ES2022+ + React 19+ (1-aksel-arcade)
- react-codemirror (@uiw/react-codemirror) (1-aksel-arcade)
- @navikt/ds-css/darkside (v7.25+) + @navikt/ds-react (v7.25+) (1-aksel-arcade)
  - **CRITICAL**: Minimum version is 7.25 for Darkside support
  - **ALWAYS use latest version** - Aksel team bugfixes frequently, latest is safest
  - **MUST use Theme component** from @navikt/ds-react/Theme to wrap app
- @babel/standalone (1-aksel-arcade)
- Vite (1-aksel-arcade)
- LocalStorage (5MB limit enforced) (1-aksel-arcade)

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

**Aksel Darkside Usage**:
- Import from `@navikt/ds-react` for components
- Import `@navikt/ds-css/darkside` for styles
- Use `<Theme>` provider for Darkside theme
- CSS variables use `--ax` prefix (not `--a` or `--ac`)

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

- 1-aksel-arcade: Added TypeScript 5.x / JavaScript ES2022+ + React 18+ (browser-based React playground)

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

<!-- MANUAL ADDITIONS END -->

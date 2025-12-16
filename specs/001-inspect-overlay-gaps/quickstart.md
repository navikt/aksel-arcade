# Quickstart: Inspect overlay spacing highlights

## Setup
- Install deps: `npm install`
- Dev server: `npm run dev` (http://localhost:5173)
- Type check: `npm run type-check`
- Lint: `npm run lint`

## Run tests
- Component/integration: `npm test`
- E2E (Playwright): `npm run test:e2e` (ensure dev server running)

## Feature focus
- Work in `src/components/Preview` and `src/components/Sandbox` for overlay rendering; use Aksel tokens that follow the active theme.
- Update inspect popover logic where spacing properties are shown to include gap.
- Keep overlays non-interactive (`pointer-events: none`) and sized from computed styles.

## Validate
- Hover over flex/grid elements: overlays show margin outside, padding inside, gap between children with required colors; click does nothing.
- Confirm overlays remain legible in dark theme while following the active theme tokens (no extra opacity beyond token alpha).
- Check popover shows gap values or "n/a" when absent.
- Ensure performance: overlays refresh within ~100ms and interactions stay smooth (60fps target).

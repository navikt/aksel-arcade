/**
 * VERIFICATION TEST - Error Dialog Darkside Compatibility
 * 
 * This test verifies that the ErrorOverlay component correctly uses
 * Aksel Darkside design tokens and renders properly in both themes.
 * 
 * To run this test:
 * 1. Open http://localhost:5173 in a browser
 * 2. In the editor, type invalid JSX (e.g., "<Button>Test</Button" - missing closing >)
 * 3. Wait for the error overlay to appear
 * 4. Check the following:
 *    - Alert component renders with proper Darkside styling
 *    - Error message is readable in both light and dark themes
 *    - Close button works
 *    - Background colors use --ax-* tokens
 * 
 * Expected behavior:
 * - Light theme: Error alert has appropriate light background
 * - Dark theme: Error alert has appropriate dark background
 * - No visual artifacts or broken styling
 * - CSS variables resolve correctly (no fallback to defaults)
 */

// Manual Verification Steps
const VERIFICATION_STEPS = [
  {
    step: 1,
    action: 'Open http://localhost:5173',
    expected: 'App loads with default example code',
  },
  {
    step: 2,
    action: 'In JSX editor, type invalid code: <Button>Click me</Button (missing closing >)',
    expected: 'After 500ms debounce, error overlay appears at top of preview pane',
  },
  {
    step: 3,
    action: 'Inspect error overlay Alert component',
    expected: 'Alert has variant="error" with red/danger styling from Darkside',
  },
  {
    step: 4,
    action: 'Check component stack <pre> background',
    expected: 'Background uses --ax-bg-neutral-moderate (should be visible gray)',
  },
  {
    step: 5,
    action: 'Toggle theme to dark mode (Settings > Theme)',
    expected: 'Error overlay adapts to dark theme with appropriate contrast',
  },
  {
    step: 6,
    action: 'Click close button on Alert',
    expected: 'Error overlay closes, preview pane returns to normal',
  },
  {
    step: 7,
    action: 'Fix the JSX error',
    expected: 'Error overlay disappears, preview renders successfully',
  },
];

console.log('=== Error Dialog Darkside Verification Test ===\n');
console.log('Follow these steps to manually verify the fix:\n');
VERIFICATION_STEPS.forEach(({ step, action, expected }) => {
  console.log(`Step ${step}: ${action}`);
  console.log(`   Expected: ${expected}\n`);
});

console.log('\n=== CSS Token Verification ===');
console.log('The following CSS tokens should be used:');
console.log('- --ax-bg-neutral-moderate (for <pre> background)');
console.log('- --ax-radius-4 (for border-radius)');
console.log('\nThese tokens are defined in @navikt/ds-tokens/dist/darkside/tokens.css');
console.log('and automatically adapt to light/dark themes via Theme component.\n');

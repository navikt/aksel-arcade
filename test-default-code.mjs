/**
 * Automated verification of Alert component default code fix
 * 
 * This test verifies that:
 * 1. Default code is a proper React component
 * 2. Default code uses Alert component
 * 3. Code matches expected pattern
 */

import { createDefaultProject } from './src/utils/projectDefaults.ts';

console.log('🧪 Running automated verification...\n');

// Test 1: Check default project structure
const project = createDefaultProject();

console.log('Test 1: Default project created');
console.log('  ✅ Project ID:', project.id);
console.log('  ✅ Project name:', project.name);
console.log('');

// Test 2: Check JSX code
console.log('Test 2: JSX code validation');
console.log('  JSX Code:', project.jsxCode);
console.log('');

// Expected patterns
const hasExportDefault = project.jsxCode.includes('export default function');
const hasAppFunction = project.jsxCode.includes('function App()');
const hasAlertComponent = project.jsxCode.includes('<Alert');
const hasVariantInfo = project.jsxCode.includes('variant="info"');
const hasReturn = project.jsxCode.includes('return');

console.log('  Pattern checks:');
console.log(`  ${hasExportDefault ? '✅' : '❌'} Has "export default function"`);
console.log(`  ${hasAppFunction ? '✅' : '❌'} Has "function App()"`);
console.log(`  ${hasAlertComponent ? '✅' : '❌'} Has "<Alert" component`);
console.log(`  ${hasVariantInfo ? '✅' : '❌'} Has variant="info" prop`);
console.log(`  ${hasReturn ? '✅' : '❌'} Has return statement`);
console.log('');

// Test 3: Verify it's NOT the old code
const isOldCode = project.jsxCode.includes('<Button variant="primary">Button text</Button>');
console.log('Test 3: Not old code');
console.log(`  ${!isOldCode ? '✅' : '❌'} Is NOT old Button code`);
console.log('');

// Test 4: Overall validation
const allTestsPass = hasExportDefault && hasAppFunction && hasAlertComponent && hasVariantInfo && hasReturn && !isOldCode;

console.log('='.repeat(60));
if (allTestsPass) {
  console.log('✅ ALL TESTS PASSED!');
  console.log('');
  console.log('Default code is a proper React component with Alert.');
  console.log('The fix is correctly implemented.');
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('');
  console.log('Check the failing tests above and fix the default code.');
}
console.log('='.repeat(60));
console.log('');

// Exit with appropriate code
if (!allTestsPass) {
  process.exit(1);
}

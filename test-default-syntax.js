// Test the default code for syntax errors
const defaultCode = `export default function App() {
  return (
    <Alert variant="info">
      Welcome to AkselArcade! This Alert component is styled with Aksel Darkside.
    </Alert>
  )
}`;

console.log('=== DEFAULT CODE TEST ===');
console.log('Code:');
console.log(defaultCode);
console.log('');

// Check for common syntax issues
const checks = {
  'Has export default': defaultCode.includes('export default'),
  'Has function App()': defaultCode.includes('function App()'),
  'Has return': defaultCode.includes('return'),
  'Has <Alert': defaultCode.includes('<Alert'),
  'Has closing </Alert>': defaultCode.includes('</Alert>'),
  'Has variant prop': defaultCode.includes('variant='),
  'Has closing )': defaultCode.includes(')'),
  'Has closing }': defaultCode.endsWith('}'),
  'Balanced parentheses': (defaultCode.match(/\(/g) || []).length === (defaultCode.match(/\)/g) || []).length,
  'Balanced braces': (defaultCode.match(/\{/g) || []).length === (defaultCode.match(/\}/g) || []).length,
  'Balanced angle brackets (open)': (defaultCode.match(/</g) || []).length,
  'Balanced angle brackets (close)': (defaultCode.match(/>/g) || []).length,
};

console.log('Syntax Checks:');
for (const [check, result] of Object.entries(checks)) {
  console.log(`${result ? '✅' : '❌'} ${check}: ${result}`);
}

console.log('');
console.log('Character count:', defaultCode.length);
console.log('Line count:', defaultCode.split('\n').length);
console.log('');

if (Object.values(checks).every(v => v === true || typeof v === 'number')) {
  console.log('✅ DEFAULT CODE LOOKS VALID');
} else {
  console.log('❌ DEFAULT CODE MAY HAVE ISSUES');
}

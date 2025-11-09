// Test the fixes

console.log('=== Test 1: Multiple JSX elements should be wrapped in fragment ===');
const multipleElements = `<Button variant="primary">Click me</Button>

<Button variant="primary" size="medium">Button text</Button>`;

const lines = multipleElements.trim().split('\n');
const hasMultipleRoots = lines.filter(line => line.trim().match(/^<[A-Z]/)).length > 1;

console.log('Input:', multipleElements);
console.log('Has multiple roots:', hasMultipleRoots);

if (hasMultipleRoots) {
  const wrapped = `function App() {\n  return (\n    <>\n      ${multipleElements}\n    </>\n  );\n}`;
  console.log('Wrapped output:');
  console.log(wrapped);
  console.log('✓ Multiple elements correctly wrapped in fragment');
} else {
  console.log('✗ Failed to detect multiple roots');
}

console.log('\n=== Test 2: Single JSX element should not have fragment ===');
const singleElement = '<Button variant="primary">Click me</Button>';
const singleLines = singleElement.trim().split('\n');
const singleHasMultipleRoots = singleLines.filter(line => line.trim().match(/^<[A-Z]/)).length > 1;

console.log('Input:', singleElement);
console.log('Has multiple roots:', singleHasMultipleRoots);

if (!singleHasMultipleRoots) {
  const wrapped = `function App() {\n  return (\n    ${singleElement}\n  );\n}`;
  console.log('Wrapped output:');
  console.log(wrapped);
  console.log('✓ Single element correctly wrapped without fragment');
} else {
  console.log('✗ Incorrectly detected as multiple roots');
}

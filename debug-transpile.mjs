import { transformSync } from '@babel/standalone';

// Test the exact code user reported
const testCode1 = `<Alert variant="info">Alert message</Alert>`;

// Test the template summary code
const testCode2 = `function App() {
  return (
    <Alert variant="info">Alert message</Alert>
  );
}`;

console.log('=== Test 1: Bare JSX ===');
console.log('Input:', testCode1);

try {
  // Simulate what transpiler.ts does
  const wrapped = `function App() {\n  return (\n    ${testCode1}\n  );\n}`;
  console.log('\nWrapped:', wrapped);
  
  const result = transformSync(wrapped, {
    presets: ['react', 'typescript'],
    filename: 'app.tsx',
  });
  
  console.log('\n✅ Success!');
  console.log('Output:', result.code);
} catch (error) {
  console.log('\n❌ Error:', error.message);
}

console.log('\n\n=== Test 2: Function component ===');
console.log('Input:', testCode2);

try {
  const result = transformSync(testCode2, {
    presets: ['react', 'typescript'],
    filename: 'app.tsx',
  });
  
  console.log('\n✅ Success!');
  console.log('Output:', result.code);
} catch (error) {
  console.log('\n❌ Error:', error.message);
}

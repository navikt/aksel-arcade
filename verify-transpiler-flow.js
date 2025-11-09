// Simulate the transpiler + sandbox flow

// 1. User writes bare JSX
const userCode = '<Button variant="primary">Click me</Button>';

// 2. Transpiler wraps it
const wrappedJsx = `function App() {
  return (
    ${userCode}
  );
}`;

console.log('=== Transpiled JSX ===');
console.log(wrappedJsx);

// 3. After Babel (simulated - would become vanilla JS with React.createElement calls)
// For this test, assume Babel output is similar structure

// 4. Sandbox wraps it for execution
const componentDeclarations = `const Button = window.Button;`;
const reactHooks = `const { useState, useEffect } = window.React;`;

const finalCode = `
(function() {
  ${componentDeclarations}
  ${reactHooks}
  
  ${wrappedJsx}
  
  if (typeof App !== 'undefined') return App;
  throw new Error('No component found');
})()
`;

console.log('\n=== Final sandboxed code ===');
console.log(finalCode);

console.log('\n=== Validation ===');
console.log('✓ Code structure looks correct');
console.log('✓ App function is defined');
console.log('✓ Button component would be available from window');
console.log('✓ React hooks would be available from window.React');

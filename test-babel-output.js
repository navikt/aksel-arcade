// Test what Babel actually transpiles to - simulating the full transpiler flow
import Babel from '@babel/standalone';

const jsxCode = '<Button variant="primary">Click me</Button>';
const hooksCode = '';

// Simulate transpiler.ts logic
const cleanJsxCode = jsxCode
  .replace(/import\s+.*?from\s+['"]@navikt\/ds-react['"]\s*;?\n?/g, '')
  .replace(/import\s+.*?from\s+['"]react['"]\s*;?\n?/g, '')
  .replace(/import\s+.*?from\s+['"]\.(\/hooks)?['"]\s*;?\n?/g, '');

const hasExportDefault = /export\s+default\s+(function|class|\(|const|let|var)/.test(cleanJsxCode);

console.log('INPUT JSX:', jsxCode);
console.log('hasExportDefault:', hasExportDefault);

let processedJsxCode;
if (hasExportDefault) {
  processedJsxCode = cleanJsxCode.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
  processedJsxCode = processedJsxCode.replace(/export\s+default\s+/g, 'const App = ');
} else {
  const trimmedJsx = cleanJsxCode.trim();
  const hasMultipleRoots = trimmedJsx.split('\n').filter(line => line.trim().match(/^<[A-Z]/)).length > 1;
  
  if (hasMultipleRoots) {
    processedJsxCode = `function App() {\n  return (\n    <>\n      ${cleanJsxCode}\n    </>\n  );\n}`;
  } else {
    processedJsxCode = `function App() {\n  return (\n    ${cleanJsxCode}\n  );\n}`;
  }
}

console.log('\nPROCESSED JSX:');
console.log(processedJsxCode);

const combinedCode = `\n${hooksCode}\n\n${processedJsxCode}\n`;

const result = Babel.transform(combinedCode, {
  presets: ['react', 'typescript'],
  filename: 'app.tsx',
});

let finalCode = result.code;

// Clean up transpiled output (from transpiler.ts)
finalCode = finalCode.replace(/"use strict";\s*/g, '');
finalCode = finalCode.replace(/Object\.defineProperty\(exports[^;]+;\s*/g, '');
finalCode = finalCode.replace(/exports\.__esModule\s*=\s*true;\s*/g, '');
finalCode = finalCode.replace(/exports\.default\s*=\s*(\w+);\s*/g, '');

const functionMatch = finalCode.match(/function\s+(\w+)\s*\([^)]*\)\s*\{/);
if (functionMatch && functionMatch[1] !== 'App') {
  const componentName = functionMatch[1];
  finalCode = finalCode.replace(
    new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\})`),
    `$1\nvar App = ${componentName};`
  );
}

console.log('\nFINAL TRANSPILED OUTPUT:');
console.log('==================');
console.log(finalCode);
console.log('==================');

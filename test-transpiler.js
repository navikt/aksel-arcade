// Quick test of transpiler logic
const jsxCode = '<Button variant="primary">Click me</Button>';
const cleanJsxCode = jsxCode; // No imports to remove

const hasExportDefault = /export\s+default\s+(function|class|\(|const|let|var)/.test(cleanJsxCode);
console.log('hasExportDefault:', hasExportDefault);

const processedJsxCode = `function App() {\n  return (\n    ${cleanJsxCode}\n  );\n}`;
console.log('processedJsxCode:');
console.log(processedJsxCode);

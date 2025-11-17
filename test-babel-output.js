const Babel = require('@babel/standalone');

const code = `function App() {
  return (
    <Alert variant="info">Alert message</Alert>
  );
}`;

const result = Babel.transform(code, {
  presets: ['react', 'typescript'],
  filename: 'app.tsx',
});

console.log('=== BABEL OUTPUT ===');
console.log(result.code);
console.log('=== END ===');

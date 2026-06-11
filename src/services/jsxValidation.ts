export interface JsxValidationSource {
  code: string
  sourceStartLine: number
}

export function buildJsxValidationSource(sourceCode: string): JsxValidationSource {
  const trimmedJsx = sourceCode.trim()

  if (!trimmedJsx) {
    return {
      code: 'function App() { return null; }\n\nexport default App;\n',
      sourceStartLine: 1,
    }
  }

  const rootElementMatches = trimmedJsx.match(/^\s*</gm)
  const hasMultipleRoots =
    trimmedJsx.startsWith('<') && rootElementMatches && rootElementMatches.length > 1

  if (hasMultipleRoots) {
    return {
      code:
        'function App() {\n' +
        '  return (\n' +
        '    <>\n' +
        `${sourceCode}\n` +
        '    </>\n' +
        '  );\n' +
        '}\n\n' +
        'export default App;\n',
      sourceStartLine: 4,
    }
  }

  return {
    code:
      'function App() {\n' +
      '  return (\n' +
      `    ${sourceCode}\n` +
      '  );\n' +
      '}\n\n' +
      'export default App;\n',
    sourceStartLine: 3,
  }
}

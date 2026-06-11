export interface JsxValidationSource {
  code: string
  sourceStartLine: number
}

const MODULE_SOURCE_PATTERN =
  /^(?:import\b|export\b|(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/

function stripLeadingTrivia(sourceCode: string): string {
  let remainingSource = sourceCode

  while (true) {
    const withoutWhitespace = remainingSource.replace(/^\s+/, '')

    if (withoutWhitespace !== remainingSource) {
      remainingSource = withoutWhitespace
      continue
    }

    if (remainingSource.startsWith('//')) {
      const nextLineIndex = remainingSource.indexOf('\n')
      remainingSource = nextLineIndex === -1 ? '' : remainingSource.slice(nextLineIndex + 1)
      continue
    }

    if (remainingSource.startsWith('/*')) {
      const commentEndIndex = remainingSource.indexOf('*/')

      if (commentEndIndex === -1) {
        return remainingSource
      }

      remainingSource = remainingSource.slice(commentEndIndex + 2)
      continue
    }

    return remainingSource
  }
}

export function looksLikeModuleSource(sourceCode: string): boolean {
  return MODULE_SOURCE_PATTERN.test(stripLeadingTrivia(sourceCode))
}

export function buildJsxValidationSource(sourceCode: string): JsxValidationSource {
  const trimmedJsx = sourceCode.trim()

  if (!trimmedJsx) {
    return {
      code: 'function App() { return null; }\n\nexport default App;\n',
      sourceStartLine: 1,
    }
  }

  if (looksLikeModuleSource(sourceCode)) {
    return {
      code: sourceCode,
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

import type { TranspileResult, CompileError } from '@/types/preview'

// Lazy load Babel to avoid blocking initial page load
let Babel: typeof import('@babel/standalone') | null = null

const loadBabel = async () => {
  if (!Babel) {
    Babel = await import('@babel/standalone')
  }
  return Babel
}

export const transpileCode = async (
  jsxCode: string,
  hooksCode: string
): Promise<TranspileResult> => {
  try {
    const babel = await loadBabel()

    // Remove all import statements - components will be available globally in sandbox
    // Also remove imports from './hooks' since we're combining the code
    const cleanJsxCode = jsxCode
      .replace(/import\s+.*?from\s+['"]@navikt\/ds-react['"]\s*;?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]react['"]\s*;?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]\.(\/hooks)?['"]\s*;?\n?/g, '')
    
    const cleanHooksCode = hooksCode
      .replace(/import\s+.*?from\s+['"]@navikt\/ds-react['"]\s*;?\n?/g, '')
      .replace(/import\s+.*?from\s+['"]react['"]\s*;?\n?/g, '')

    // Smart wrapping: detect if user provided component structure
    const hasExportDefault = /export\s+default\s+(function|class|\(|const|let|var)/.test(cleanJsxCode)
    
    let processedJsxCode: string
    
    if (hasExportDefault) {
      // Developer mode: user provided full component, just clean up exports
      processedJsxCode = cleanJsxCode.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
      processedJsxCode = processedJsxCode.replace(/export\s+default\s+/g, 'const App = ')
    } else {
      // Designer mode: auto-wrap bare JSX in component structure
      // Check if there are multiple root JSX elements by counting lines starting with <
      const trimmedJsx = cleanJsxCode.trim()
      const rootElementMatches = trimmedJsx.match(/^\s*</gm) // Lines starting with <
      const hasMultipleRoots = rootElementMatches && rootElementMatches.length > 1
      
      if (hasMultipleRoots) {
        // Wrap in fragment if multiple root elements (Fragment is invisible to user but needed for execution)
        processedJsxCode = `function App() {\n  return (\n    <>\n${cleanJsxCode}\n    </>\n  );\n}`
      } else {
        // Single root element
        processedJsxCode = `function App() {\n  return (\n    ${cleanJsxCode}\n  );\n}`
      }
    }

    // Remove export statements from hooks code (export const, export function, etc.)
    let processedHooksCode = cleanHooksCode.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ')
    processedHooksCode = processedHooksCode.replace(/export\s*\{[^}]+\}\s*;?\n?/g, '')

    const combinedCode = `
${processedHooksCode}

${processedJsxCode}
`

    // Transpile with React and TypeScript presets
    const result = babel.transform(combinedCode, {
      presets: ['react', 'typescript'],
      filename: 'app.tsx',
    })

    if (!result || !result.code) {
      return {
        success: false,
        code: null,
        error: {
          message: 'Transpilation failed: No output code generated',
          line: null,
          column: null,
          stack: null,
        },
      }
    }

    // Clean up transpiled output
    let finalCode = result.code
    
    // Remove "use strict" directives
    finalCode = finalCode.replace(/"use strict";\s*/g, '')
    
    // Remove Object.defineProperty calls
    finalCode = finalCode.replace(/Object\.defineProperty\(exports[^;]+;\s*/g, '')
    
    // Remove exports.__esModule
    finalCode = finalCode.replace(/exports\.__esModule\s*=\s*true;\s*/g, '')
    
    // Ensure App is defined as a variable if it was exported
    // Handle: exports.default = App; -> var App = App;
    // But we need to keep the original function, so just remove the export assignment
    finalCode = finalCode.replace(/exports\.default\s*=\s*(\w+);\s*/g, '')
    
    // If we have a function definition without App being assigned, ensure App points to it
    // Look for: function ComponentName() { ... } and add App = ComponentName after
    const functionMatch = finalCode.match(/function\s+(\w+)\s*\([^)]*\)\s*\{/)
    if (functionMatch && functionMatch[1] !== 'App') {
      const componentName = functionMatch[1]
      // Add App assignment after the function definition
      finalCode = finalCode.replace(
        new RegExp(`(function\\s+${componentName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\})`),
        `$1\nvar App = ${componentName};`
      )
    }

    return {
      success: true,
      code: finalCode,
      error: null,
    }
  } catch (error) {
    // Parse Babel error for line/column info
    const compileError = parseBabelError(error)
    return {
      success: false,
      code: null,
      error: compileError,
    }
  }
}

const parseBabelError = (error: unknown): CompileError => {
  if (error instanceof Error) {
    // Try to extract line and column from error message
    // Babel errors typically look like: "unknown: Unexpected token (3:15)"
    const match = error.message.match(/\((\d+):(\d+)\)/)

    return {
      message: error.message,
      line: match ? parseInt(match[1], 10) - 1 : null, // Convert to 0-indexed
      column: match ? parseInt(match[2], 10) : null,
      stack: error.stack || null,
    }
  }

  return {
    message: String(error),
    line: null,
    column: null,
    stack: null,
  }
}

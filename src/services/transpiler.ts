import type { TranspileResult, CompileError } from '@/types/preview'

// Lazy load Babel to avoid blocking initial page load
let Babel: typeof import('@babel/standalone') | null = null

const loadBabel = async () => {
  if (!Babel) {
    Babel = await import('@babel/standalone')
  }
  return Babel
}

type SupportedImportModule = 'react' | 'aksel' | 'aksel-icons' | 'local-hooks' | 'side-effect'

interface UnsupportedImport {
  source: string
  line: number
  column: number
}

interface StripSupportedImportsResult {
  code: string
  runtimePrelude: string
  unsupportedImports: UnsupportedImport[]
}

interface ImportBinding {
  kind: 'default' | 'namespace' | 'named'
  imported?: string
  local: string
}

const STATIC_IMPORT_PATTERN =
  /^[ \t]*import(\s+type\b)?(?:\s+['"]([^'"]+)['"]|\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"])\s*;?[ \t]*(?:\r?\n|$)/gm
const LOCAL_HOOKS_IMPORT_PATTERN = /^\.{1,2}\/hooks(?:\/[\w.-]+)?(?:\.(?:[cm]?[jt]sx?))?$/
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/

const getSupportedImportModule = (source: string): SupportedImportModule | null => {
  if (source === 'react') return 'react'
  if (source === '@navikt/ds-react' || source === '@navikt/ds-react/Theme') return 'aksel'
  if (source === '@navikt/aksel-icons') return 'aksel-icons'
  if (source === '@navikt/ds-css' || source === '@navikt/ds-css/darkside') return 'side-effect'
  if (LOCAL_HOOKS_IMPORT_PATTERN.test(source)) return 'local-hooks'

  return null
}

const getLineColumn = (source: string, offset: number): { line: number; column: number } => {
  const beforeOffset = source.slice(0, offset)
  const lineBreaks = beforeOffset.match(/\r\n|\r|\n/g) ?? []
  const lastLineBreak = Math.max(beforeOffset.lastIndexOf('\n'), beforeOffset.lastIndexOf('\r'))

  return {
    line: lineBreaks.length,
    column: lastLineBreak === -1 ? offset : offset - lastLineBreak - 1,
  }
}

const findTopLevelComma = (text: string): number => {
  let braceDepth = 0

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') braceDepth += 1
    if (char === '}') braceDepth -= 1
    if (char === ',' && braceDepth === 0) return index
  }

  return -1
}

const stripTypePrefix = (specifier: string): string => specifier.replace(/^type\s+/, '').trim()

const parseNamespaceBinding = (clause: string): ImportBinding | null => {
  const namespaceMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/)
  return namespaceMatch ? { kind: 'namespace', local: namespaceMatch[1] } : null
}

const parseNamedBindings = (clause: string): ImportBinding[] => {
  const namedStart = clause.indexOf('{')
  const namedEnd = clause.lastIndexOf('}')
  if (namedStart === -1 || namedEnd === -1 || namedEnd <= namedStart) {
    return []
  }

  return clause
    .slice(namedStart + 1, namedEnd)
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .flatMap((specifier): ImportBinding[] => {
      if (specifier.startsWith('type ')) {
        return []
      }

      const [importedPart, localPart] = specifier.split(/\s+as\s+/i)
      const imported = stripTypePrefix(importedPart)
      const local = stripTypePrefix(localPart ?? imported)

      if (!IDENTIFIER_PATTERN.test(imported) || !IDENTIFIER_PATTERN.test(local)) {
        return []
      }

      return [{ kind: 'named', imported, local }]
    })
}

const parseImportClause = (clause: string): ImportBinding[] => {
  const trimmedClause = clause.trim()
  if (!trimmedClause) {
    return []
  }

  if (trimmedClause.startsWith('{')) {
    return parseNamedBindings(trimmedClause)
  }

  const namespaceBinding = parseNamespaceBinding(trimmedClause)
  if (namespaceBinding) {
    return [namespaceBinding]
  }

  const firstComma = findTopLevelComma(trimmedClause)
  const defaultBinding = (
    firstComma === -1 ? trimmedClause : trimmedClause.slice(0, firstComma)
  ).trim()
  const bindings: ImportBinding[] = []

  if (IDENTIFIER_PATTERN.test(defaultBinding)) {
    bindings.push({ kind: 'default', local: defaultBinding })
  }

  if (firstComma === -1) {
    return bindings
  }

  const remainingClause = trimmedClause.slice(firstComma + 1).trim()
  const remainingNamespaceBinding = parseNamespaceBinding(remainingClause)
  if (remainingNamespaceBinding) {
    bindings.push(remainingNamespaceBinding)
  } else {
    bindings.push(...parseNamedBindings(remainingClause))
  }

  return bindings
}

const getModuleNamespaceExpression = (moduleKind: SupportedImportModule): string | null => {
  switch (moduleKind) {
    case 'react':
      return 'React'
    case 'aksel':
      return 'AkselDS'
    case 'aksel-icons':
      return 'AkselIcons'
    case 'local-hooks':
    case 'side-effect':
      return null
  }
}

const createRuntimePreludeStatements = (
  importClause: string | undefined,
  moduleKind: SupportedImportModule,
  isTypeOnly: boolean
): string[] => {
  if (isTypeOnly || moduleKind === 'side-effect' || !importClause) {
    return []
  }

  return parseImportClause(importClause).flatMap((binding): string[] => {
    const moduleNamespace = getModuleNamespaceExpression(moduleKind)

    if (binding.kind === 'default' || binding.kind === 'namespace') {
      if (!moduleNamespace || binding.local === moduleNamespace) {
        return []
      }

      return [`const ${binding.local} = ${moduleNamespace};`]
    }

    if (!binding.imported || binding.local === binding.imported) {
      return []
    }

    const importedExpression =
      moduleKind === 'react' ? `React.${binding.imported}` : binding.imported

    return [`const ${binding.local} = ${importedExpression};`]
  })
}

const stripSupportedImports = (sourceCode: string): StripSupportedImportsResult => {
  const unsupportedImports: UnsupportedImport[] = []
  const runtimePreludeStatements: string[] = []

  const code = sourceCode.replace(
    STATIC_IMPORT_PATTERN,
    (
      statement: string,
      typeOnlyToken: string | undefined,
      sideEffectSource: string | undefined,
      importClause: string | undefined,
      fromSource: string | undefined,
      offset: number
    ) => {
      const importSource = sideEffectSource ?? fromSource
      if (!importSource) {
        return statement
      }

      const moduleKind = getSupportedImportModule(importSource)
      if (!moduleKind) {
        unsupportedImports.push({
          source: importSource,
          ...getLineColumn(sourceCode, offset),
        })
        return statement
      }

      runtimePreludeStatements.push(
        ...createRuntimePreludeStatements(importClause, moduleKind, Boolean(typeOnlyToken))
      )
      return ''
    }
  )

  return {
    code,
    runtimePrelude: Array.from(new Set(runtimePreludeStatements)).join('\n'),
    unsupportedImports,
  }
}

const createUnsupportedImportError = (unsupportedImport: UnsupportedImport): CompileError => ({
  message: `Unsupported import from "${unsupportedImport.source}". Aksel Arcade strips only React, Aksel component/icon/CSS, and local hooks imports; keep playground code import-free or move non-Aksel logic into the Hooks tab.`,
  line: unsupportedImport.line,
  column: unsupportedImport.column,
  stack: null,
})

const getRuntimePreludeStatements = (runtimePrelude: string): string[] =>
  runtimePrelude.split('\n').filter(Boolean)

const removeDuplicateRuntimePreludeStatements = (
  runtimePrelude: string,
  previousRuntimePrelude: string
): string => {
  const seen = new Set(getRuntimePreludeStatements(previousRuntimePrelude))
  return getRuntimePreludeStatements(runtimePrelude)
    .filter((statement) => !seen.has(statement))
    .join('\n')
}

export const transpileCode = async (
  jsxCode: string,
  hooksCode: string
): Promise<TranspileResult> => {
  try {
    const babel = await loadBabel()

    const strippedJsx = stripSupportedImports(jsxCode)
    const strippedHooks = stripSupportedImports(hooksCode)
    const unsupportedImport =
      strippedJsx.unsupportedImports[0] ?? strippedHooks.unsupportedImports[0]

    if (unsupportedImport) {
      return {
        success: false,
        code: null,
        error: createUnsupportedImportError(unsupportedImport),
      }
    }

    const cleanJsxCode = strippedJsx.code
    const cleanHooksCode = strippedHooks.code

    // Check if code is empty after cleaning
    const trimmedJsx = cleanJsxCode.trim()

    // If completely empty, return a valid no-op component
    if (!trimmedJsx) {
      return {
        success: true,
        code: 'function App() { return null; }',
        error: null,
      }
    }

    // Smart wrapping: detect if user provided component structure
    const hasExportDefault = /export\s+default\s+(function|class|\(|const|let|var)/.test(
      cleanJsxCode
    )

    let processedJsxCode: string

    if (hasExportDefault) {
      // Developer mode: user provided full component, just clean up exports
      processedJsxCode = cleanJsxCode.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
      processedJsxCode = processedJsxCode.replace(/export\s+default\s+/g, 'const App = ')
    } else {
      // Designer mode: auto-wrap bare JSX in component structure
      // Check if there are multiple root JSX elements by counting lines starting with <
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
    let processedHooksCode = cleanHooksCode.replace(
      /export\s+(const|let|var|function|class)\s+/g,
      '$1 '
    )
    processedHooksCode = processedHooksCode.replace(/export\s*\{[^}]+\}\s*;?\n?/g, '')

    const jsxRuntimePrelude = removeDuplicateRuntimePreludeStatements(
      strippedJsx.runtimePrelude,
      strippedHooks.runtimePrelude
    )

    const combinedCode = `
${strippedHooks.runtimePrelude}
${processedHooksCode}

${jsxRuntimePrelude}
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

/**
 * Code Formatter Service
 * 
 * Provides code formatting functionality using Prettier.
 * Supports JSX/TSX formatting with React conventions.
 */

// Prettier is loaded dynamically to avoid bundle size impact
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prettierModule: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prettierParserBabel: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prettierParserEstree: any = null

async function loadPrettier() {
  if (!prettierModule) {
    // Dynamically import Prettier modules - babel plugin requires estree plugin
    const [prettierImport, parserBabelImport, parserEstreeImport] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ])
    // Extract the actual exports
    prettierModule = prettierImport.default || prettierImport
    prettierParserBabel = parserBabelImport.default || parserBabelImport
    prettierParserEstree = parserEstreeImport.default || parserEstreeImport
  }
  return { prettier: prettierModule, parserBabel: prettierParserBabel, parserEstree: prettierParserEstree }
}

export interface FormatOptions {
  /** Parser to use (default: 'babel-ts') */
  parser?: 'babel' | 'babel-ts' | 'typescript'
  /** Print width (default: 100) */
  printWidth?: number
  /** Tab width (default: 2) */
  tabWidth?: number
  /** Use single quotes (default: true) */
  singleQuote?: boolean
  /** Use semicolons (default: false) */
  semi?: boolean
  /** Trailing commas (default: 'es5') */
  trailingComma?: 'none' | 'es5' | 'all'
}

/**
 * Strip Fragment wrapper from formatted JSX
 * The Fragment is needed for formatting but should be invisible to the user
 */
function stripFragmentWrapper(code: string): string {
  const trimmed = code.trim()
  
  // Check if wrapped in Fragment
  if (!trimmed.startsWith('<>') || !trimmed.endsWith('</>')) {
    return code
  }
  
  // Split into lines and remove first (<>) and last (</>) lines
  const lines = trimmed.split('\n')
  if (lines.length < 3) return code // Need at least <>, content, </>
  
  // Remove Fragment wrapper lines
  const contentLines = lines.slice(1, -1)
  
  // Find minimum indentation of non-empty lines
  const nonEmptyLines = contentLines.filter(line => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return ''
  
  const minIndent = Math.min(
    ...nonEmptyLines.map(line => line.match(/^(\s*)/)?.[1]?.length || 0)
  )
  
  // Dedent all lines by removing common indentation
  const dedented = contentLines
    .map(line => (line.trim().length === 0 ? '' : line.slice(minIndent)))
    .join('\n')
    .trim()
  
  return dedented
}

/**
 * Format code with Prettier
 * 
 * @param code - Code string to format
 * @param options - Formatting options
 * @returns Formatted code string
 * @throws Error if formatting fails
 */
export async function formatCode(code: string, options: FormatOptions = {}): Promise<string> {
  try {
    const { prettier, parserBabel, parserEstree } = await loadPrettier()

    // Detect if code has multiple root JSX elements by counting opening tags
    // at the start of lines (ignoring whitespace)
    const trimmedCode = code.trim()
    const rootElementMatches = trimmedCode.match(/^\s*</gm) // Lines starting with <
    const hasMultipleRootElements = rootElementMatches && rootElementMatches.length > 1

    // Auto-wrap multiple elements in Fragment to make valid JSX
    const codeToFormat = hasMultipleRootElements ? `<>\n${code}\n</>` : code
    
    // Wrap in function to avoid semicolon being added to standalone JSX
    const wrappedCode = `function Component() {\n  return (\n    ${codeToFormat}\n  )\n}`

    const formatted = await prettier.format(wrappedCode, {
      parser: options.parser || 'babel',
      plugins: [parserEstree, parserBabel],
      printWidth: options.printWidth || 100,
      tabWidth: options.tabWidth || 2,
      singleQuote: options.singleQuote !== undefined ? options.singleQuote : true,
      semi: options.semi !== undefined ? options.semi : false,
      trailingComma: options.trailingComma || 'es5',
      arrowParens: 'always',
      jsxSingleQuote: false,
      bracketSpacing: true,
      jsxBracketSameLine: false,
    })

    // Extract the return statement content
    // Prettier may format it as either:
    // 1. return (...multiline JSX...)
    // 2. return <SingleLineJSX />
    // Use greedy matching to capture all content up to the final closing paren/brace
    const withParens = formatted.match(/return \(\s*([\s\S]+)\s*\)\s*\n?\s*\}/m)
    if (withParens && withParens[1]) {
      const extracted = withParens[1].trim()
      // Remove Fragment wrapper if present (we added it for formatting only)
      return stripFragmentWrapper(extracted)
    }

    const withoutParens = formatted.match(/return\s+([\s\S]+?)(?:\n\})/m)
    if (withoutParens && withoutParens[1]) {
      const extracted = withoutParens[1].trim()
      // Remove Fragment wrapper if present (we added it for formatting only)
      return stripFragmentWrapper(extracted)
    }

    // Fallback: if pattern doesn't match, return original code (safer than returning wrapped)
    return code
  } catch (error) {
    // Extract meaningful error message from Prettier syntax errors
    const errorMsg = error instanceof Error ? error.message : String(error)
    throw new Error(errorMsg)
  }
}

/**
 * Check if code is already formatted
 * 
 * @param code - Code string to check
 * @param options - Formatting options
 * @returns true if code is already formatted, false otherwise
 */
export async function isFormatted(code: string, options: FormatOptions = {}): Promise<boolean> {
  try {
    const formatted = await formatCode(code, options)
    return code === formatted
  } catch {
    return false
  }
}

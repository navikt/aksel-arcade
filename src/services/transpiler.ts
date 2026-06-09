import type { ArcadePageId, ProjectSource } from '@/types/project'
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
  /^[ \t]*import(\s+type\b)?(?:\s+['"]([^'"]+)['"]|\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"])\s*;?[ \t]*(?:(?:\/\/[^\r\n]*)|(?:\/\*[\s\S]*?\*\/[ \t]*))?(?:\r?\n|$)/gm
const LOCAL_HOOKS_IMPORT_PATTERN = /^\.{1,2}\/hooks(?:\/[\w.-]+)?(?:\.(?:[cm]?[jt]sx?))?$/
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/
const DEFAULT_EXPORT_DECLARATION_PATTERN =
  /export\s+default\s+(function|class)\s+([A-Za-z_$][\w$]*)/
const EXPORT_NAMED_DECLARATION_PATTERN = /export\s+(const|let|var|function|class)\s+/g
const EXPORT_NAMED_LIST_PATTERN = /export\s*\{[^}]+\}\s*;?\n?/g

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

const createDefaultExportComponent = (sourceCode: string, componentIdentifier: string): string => {
  const defaultDeclarationMatch = sourceCode.match(DEFAULT_EXPORT_DECLARATION_PATTERN)

  if (defaultDeclarationMatch) {
    const [, declarationKind, declaredName] = defaultDeclarationMatch
    const processedSource = sourceCode.replace(
      DEFAULT_EXPORT_DECLARATION_PATTERN,
      `${declarationKind} ${declaredName}`
    )

    return declaredName === componentIdentifier
      ? processedSource
      : `${processedSource}\nconst ${componentIdentifier} = ${declaredName};`
  }

  return sourceCode.replace(/export\s+default\s+/g, `const ${componentIdentifier} = `)
}

const stripNamedExports = (sourceCode: string): string =>
  sourceCode
    .replace(EXPORT_NAMED_DECLARATION_PATTERN, '$1 ')
    .replace(EXPORT_NAMED_LIST_PATTERN, '')

const normalizeModuleDeclarations = (
  sourceCode: string,
  defaultExportIdentifier: string
): string =>
  stripNamedExports(
    /export\s+default\s+/.test(sourceCode)
      ? createDefaultExportComponent(sourceCode, defaultExportIdentifier)
      : sourceCode
  )

const createComponentEntrySource = (
  sourceCode: string,
  componentName: string
): ComponentEntrySource => {
  const trimmedJsx = sourceCode.trim()

  if (!trimmedJsx) {
    return {
      code: `function ${componentName}() { return null; }`,
      wrapperPrefixLines: 0,
    }
  }

  const hasExportDefault = /export\s+default\s+(function|class|\(|const|let|var)/.test(sourceCode)

  if (hasExportDefault) {
    return {
      code: createDefaultExportComponent(sourceCode, componentName),
      wrapperPrefixLines: 0,
    }
  }

  const rootElementMatches = trimmedJsx.match(/^\s*</gm)
  const hasMultipleRoots =
    trimmedJsx.startsWith('<') && rootElementMatches && rootElementMatches.length > 1

  if (hasMultipleRoots) {
    return {
      code: `function ${componentName}() {\n  return (\n    <>\n${sourceCode}\n    </>\n  );\n}`,
      wrapperPrefixLines: 3,
    }
  }

  return {
    code: `function ${componentName}() {\n  return (\n    ${sourceCode}\n  );\n}`,
    wrapperPrefixLines: 2,
  }
}

interface CombinedSourceMapping {
  label: string
  generatedStartLine: number
  generatedEndLine: number
  sourceLineOffset: number
  sourceLineCount: number
  pageId: ArcadePageId | null
}

interface BuildCombinedSourceResult {
  code: string | null
  error: CompileError | null
  sourceMappings?: CombinedSourceMapping[]
}

interface PreparedSourceBlock extends StripSupportedImportsResult {
  label: string
}

interface ComponentEntrySource {
  code: string
  wrapperPrefixLines: number
}

interface ProjectSourceTranspileOptions {
  previewSessionKey?: string
}

const getFirstUnsupportedImport = (
  preparedBlocks: PreparedSourceBlock[]
): UnsupportedImport | undefined =>
  preparedBlocks.flatMap((block) => block.unsupportedImports)[0]

const createPreparedSourceBlock = (label: string, sourceCode: string): PreparedSourceBlock => ({
  label,
  ...stripSupportedImports(sourceCode),
})

const buildSinglePageCombinedSource = (
  jsxCode: string,
  hooksCode: string
): BuildCombinedSourceResult => {
  const strippedJsx = createPreparedSourceBlock('page JSX', jsxCode)
  const strippedHooks = createPreparedSourceBlock('page Hooks', hooksCode)
  const unsupportedImport = getFirstUnsupportedImport([strippedJsx, strippedHooks])

  if (unsupportedImport) {
    return {
      code: null,
      error: createUnsupportedImportError(unsupportedImport),
    }
  }

  const processedHooksCode = normalizeModuleDeclarations(
    strippedHooks.code,
    '__AkselArcadeHooksDefault'
  )
  const processedJsxCode = createComponentEntrySource(strippedJsx.code, 'App')
  const jsxRuntimePrelude = removeDuplicateRuntimePreludeStatements(
    strippedJsx.runtimePrelude,
    strippedHooks.runtimePrelude
  )

  return {
    code: `
${strippedHooks.runtimePrelude}
${processedHooksCode}

${jsxRuntimePrelude}
${processedJsxCode.code}
`,
    error: null,
  }
}

const sanitizeIdentifier = (value: string): string => value.replace(/[^A-Za-z0-9_$]/g, '_')

const getPageComponentName = (pageId: string): string =>
  `__AkselArcadePageComponent_${sanitizeIdentifier(pageId)}`

const getPageModuleName = (pageId: string): string => `__AkselArcadePage_${sanitizeIdentifier(pageId)}`

const looksLikeBareGlobalConfigJsx = (sourceCode: string): boolean => {
  const trimmedSource = sourceCode.trim()
  if (!trimmedSource || /export\s+default\s+/.test(trimmedSource)) {
    return false
  }

  return trimmedSource.startsWith('<') || trimmedSource.startsWith('(')
}

const createGlobalConfigJsxError = (): CompileError => ({
  message:
    'Global config JSX must contain shared declarations such as components or helpers; bare JSX is not rendered in the multi-page preview runtime.',
  line: 0,
  column: 0,
  stack: null,
  pageId: null,
})

const createEmptyPagesError = (): CompileError => ({
  message: 'Arcade project source must contain at least one page to render a preview.',
  line: null,
  column: null,
  stack: null,
  pageId: null,
})

const splitLines = (sourceCode: string): string[] => sourceCode.split('\n')

const appendLines = (lines: string[], sourceCode: string): void => {
  lines.push(...splitLines(sourceCode))
}

const appendMappedLines = (
  lines: string[],
  sourceMappings: CombinedSourceMapping[],
  label: string,
  sourceCode: string,
  sourceLineOffset = 0,
  sourceLineCount = splitLines(sourceCode).length,
  pageId: ArcadePageId | null = null
): void => {
  if (!sourceCode) {
    return
  }

  const generatedStartLine = lines.length + 1
  appendLines(lines, sourceCode)
  sourceMappings.push({
    label,
    generatedStartLine,
    generatedEndLine: lines.length,
    sourceLineOffset,
    sourceLineCount,
    pageId,
  })
}

const buildProjectSourceCombinedCode = (
  source: ProjectSource,
  { previewSessionKey }: ProjectSourceTranspileOptions = {}
): BuildCombinedSourceResult => {
  const firstPage = source.pages[0]
  if (!firstPage) {
    return {
      code: null,
      error: createEmptyPagesError(),
    }
  }

  const strippedGlobalHooks = createPreparedSourceBlock('global config Hooks', source.globalConfig.hooks)
  const strippedGlobalJsx = createPreparedSourceBlock('global config JSX', source.globalConfig.jsx)
  const preparedPages = source.pages.map((page) => ({
    page,
    strippedHooks: createPreparedSourceBlock(`${page.id} Hooks`, page.source.hooks),
    strippedJsx: createPreparedSourceBlock(`${page.id} JSX`, page.source.jsx),
  }))
  const unsupportedImport = getFirstUnsupportedImport([
    strippedGlobalHooks,
    strippedGlobalJsx,
    ...preparedPages.flatMap((preparedPage) => [preparedPage.strippedHooks, preparedPage.strippedJsx]),
  ])

  if (unsupportedImport) {
    return {
      code: null,
      error: createUnsupportedImportError(unsupportedImport),
    }
  }

  if (looksLikeBareGlobalConfigJsx(strippedGlobalJsx.code)) {
    return {
      code: null,
      error: createGlobalConfigJsxError(),
    }
  }

  const processedGlobalHooks = normalizeModuleDeclarations(
    strippedGlobalHooks.code,
    '__AkselArcadeGlobalHooksDefault'
  )
  const processedGlobalJsx = normalizeModuleDeclarations(
    strippedGlobalJsx.code,
    '__AkselArcadeGlobalConfigDefault'
  )
  const globalJsxRuntimePrelude = removeDuplicateRuntimePreludeStatements(
    strippedGlobalJsx.runtimePrelude,
    strippedGlobalHooks.runtimePrelude
  )
  const pageBlocks = preparedPages.map(({ page, strippedHooks, strippedJsx }) => {
    const pageComponentName = getPageComponentName(page.id)
    const pageModuleName = getPageModuleName(page.id)
    const processedPageHooks = normalizeModuleDeclarations(
      strippedHooks.code,
      `${pageComponentName}HooksDefault`
    )
    const processedPageJsx = createComponentEntrySource(strippedJsx.code, pageComponentName)
    const pageJsxRuntimePrelude = removeDuplicateRuntimePreludeStatements(
      strippedJsx.runtimePrelude,
      strippedHooks.runtimePrelude
    )

    return {
      pageId: page.id,
      pageModuleName,
      strippedHooks,
      processedPageHooks,
      pageJsxRuntimePrelude,
      strippedJsx,
      processedPageJsx,
    }
  })
  const startPageId = source.pages.some((page) => page.id === source.startPageId)
    ? source.startPageId
    : firstPage.id
  const pageEntries = pageBlocks
    .map(({ pageId, pageModuleName }) => `  ${JSON.stringify(pageId)}: ${pageModuleName},`)
    .join('\n')
  const pageIds = source.pages.map((page) => page.id)
  const lines: string[] = []
  const sourceMappings: CombinedSourceMapping[] = []

  appendLines(lines, strippedGlobalHooks.runtimePrelude)
  appendMappedLines(lines, sourceMappings, strippedGlobalHooks.label, processedGlobalHooks)
  appendLines(lines, '')
  appendLines(lines, globalJsxRuntimePrelude)
  appendMappedLines(lines, sourceMappings, strippedGlobalJsx.label, processedGlobalJsx)
  appendLines(lines, '')
  appendLines(
    lines,
    `const __AkselArcadePageIds = ${JSON.stringify(pageIds)};
const __AkselArcadeValidPageIds = new Set(__AkselArcadePageIds);
const __AkselArcadeStartPageId = ${JSON.stringify(startPageId)};
const __AkselArcadePreviewSessionKey = ${JSON.stringify(previewSessionKey ?? null)};
const __AkselArcadeResolvePageId = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  return __AkselArcadeValidPageIds.has(value) ? value : null;
};
const __AkselArcadeReadPersistedPageId = () => {
  if (typeof window === 'undefined' || !__AkselArcadePreviewSessionKey) {
    return null;
  }

  const previewState = window.__AKSEL_ARCADE_PREVIEW_STATE;
  if (!previewState || previewState.sessionKey !== __AkselArcadePreviewSessionKey) {
    return null;
  }

  return __AkselArcadeResolvePageId(previewState.currentPageId);
};
const __AkselArcadePersistPageId = (pageId) => {
  if (typeof window === 'undefined' || !__AkselArcadePreviewSessionKey) {
    return;
  }

  window.__AKSEL_ARCADE_PREVIEW_STATE = {
    sessionKey: __AkselArcadePreviewSessionKey,
    currentPageId: pageId,
  };
};
const __AkselArcadeInitialPageId = __AkselArcadeReadPersistedPageId() ?? __AkselArcadeStartPageId;
const __AkselArcadePreviewRuntimeBridgeKey = '__AKSEL_ARCADE_PREVIEW_RUNTIME';
const __AkselArcadePreviewPageChangedEvent = '__AKSEL_ARCADE_PREVIEW_PAGE_CHANGED';
const __AkselArcadeRuntime = {
  currentPageId: __AkselArcadeInitialPageId,
  goToPage: (pageId) => {
    const nextPageId = __AkselArcadeResolvePageId(pageId);
    if (!nextPageId) {
      console.warn(\`Unknown Arcade page "\${String(pageId)}"\`);
      return false;
    }

    return nextPageId === __AkselArcadeRuntime.currentPageId;
  },
};
const __AkselArcadeSyncPreviewRuntimeBridge = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window[__AkselArcadePreviewRuntimeBridgeKey] = {
    currentPageId: __AkselArcadeRuntime.currentPageId,
    goToPage: (pageId) => __AkselArcadeRuntime.goToPage(pageId),
    hasPageId: (pageId) => __AkselArcadeResolvePageId(pageId) !== null,
  };
};
const __AkselArcadeDispatchPageChanged = (pageId) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(__AkselArcadePreviewPageChangedEvent, {
      detail: { pageId },
    })
  );
};
const goToPage = (pageId) => __AkselArcadeRuntime.goToPage(pageId);
let currentPageId = __AkselArcadeRuntime.currentPageId;
__AkselArcadeSyncPreviewRuntimeBridge();`
  )
  appendLines(lines, '')

  pageBlocks.forEach(
    ({
      pageModuleName,
      pageId,
      strippedHooks,
      processedPageHooks,
      pageJsxRuntimePrelude,
      strippedJsx,
      processedPageJsx,
    }) => {
      appendLines(lines, `const ${pageModuleName} = (() => {`)
      appendLines(lines, strippedHooks.runtimePrelude)
      appendMappedLines(
        lines,
        sourceMappings,
        strippedHooks.label,
        processedPageHooks,
        0,
        splitLines(strippedHooks.code).length,
        pageId
      )
      appendLines(lines, '')
      appendLines(lines, pageJsxRuntimePrelude)
      appendMappedLines(
        lines,
        sourceMappings,
        strippedJsx.label,
        processedPageJsx.code,
        processedPageJsx.wrapperPrefixLines,
        splitLines(strippedJsx.code).length,
        pageId
      )
      appendLines(lines, '')
      appendLines(lines, `  return ${getPageComponentName(pageId)}`)
      appendLines(lines, '})()')
      appendLines(lines, '')
    }
  )

  appendLines(
    lines,
    `const __AkselArcadePageComponents = {
${pageEntries}
};

function App() {
  const [activePageId, setActivePageId] = React.useState(__AkselArcadeInitialPageId);

  currentPageId = activePageId;
  __AkselArcadeRuntime.currentPageId = activePageId;
  __AkselArcadeRuntime.goToPage = (pageId) => {
    const nextPageId = __AkselArcadeResolvePageId(pageId);
    if (!nextPageId) {
      console.warn(\`Unknown Arcade page "\${String(pageId)}"\`);
      return false;
    }

    if (nextPageId === __AkselArcadeRuntime.currentPageId) {
      return true;
    }

    setActivePageId(nextPageId);
    return true;
  };
  __AkselArcadeSyncPreviewRuntimeBridge();

  React.useEffect(() => {
    __AkselArcadePersistPageId(activePageId);
    __AkselArcadeDispatchPageChanged(activePageId);
  }, [activePageId]);

  React.useEffect(() => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      return undefined;
    }

    const handlePageLinkClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a');
      if (!anchor || !rootElement.contains(anchor)) {
        return;
      }

      const targetPageId =
        __AkselArcadeResolvePageId(anchor.getAttribute('href')) ??
        __AkselArcadeResolvePageId(anchor.getAttribute('to'));
      if (!targetPageId) {
        return;
      }

      event.preventDefault();
      __AkselArcadeRuntime.goToPage(targetPageId);
    };

    document.addEventListener('click', handlePageLinkClick, true);
    return () => {
      document.removeEventListener('click', handlePageLinkClick, true);
    };
  }, []);

  const ActivePageComponent =
    __AkselArcadePageComponents[activePageId] ??
    __AkselArcadePageComponents[__AkselArcadeStartPageId];

  return React.createElement(ActivePageComponent, { key: activePageId });
}`
  )

  return {
    code: lines.join('\n'),
    error: null,
    sourceMappings,
  }
}

interface TranspileCombinedCodeOptions {
  sourceMappings?: CombinedSourceMapping[]
}

const findSourceMapping = (
  sourceMappings: CombinedSourceMapping[],
  generatedLine: number
): CombinedSourceMapping | null => {
  const containingMapping =
    sourceMappings.find(
      (sourceMapping) =>
        generatedLine >= sourceMapping.generatedStartLine &&
        generatedLine <= sourceMapping.generatedEndLine
    ) ?? null

  if (containingMapping) {
    return containingMapping
  }

  return (
    sourceMappings.reduce<CombinedSourceMapping | null>((closestMapping, sourceMapping) => {
      if (sourceMapping.generatedStartLine > generatedLine) {
        return closestMapping
      }

      if (!closestMapping || sourceMapping.generatedStartLine > closestMapping.generatedStartLine) {
        return sourceMapping
      }

      return closestMapping
    }, null) ?? null
  )
}

const transpileCombinedCode = async (
  combinedCode: string,
  { sourceMappings = [] }: TranspileCombinedCodeOptions = {}
): Promise<TranspileResult> => {
  try {
    const babel = await loadBabel()
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

    let finalCode = result.code

    finalCode = finalCode.replace(/"use strict";\s*/g, '')
    finalCode = finalCode.replace(/Object\.defineProperty\(exports[^;]+;\s*/g, '')
    finalCode = finalCode.replace(/exports\.__esModule\s*=\s*true;\s*/g, '')
    finalCode = finalCode.replace(/exports\.default\s*=\s*(\w+);\s*/g, '')

    return {
      success: true,
      code: finalCode,
      error: null,
    }
  } catch (error) {
    const compileError = parseBabelError(error, sourceMappings)
    return {
      success: false,
      code: null,
      error: compileError,
    }
  }
}

export const transpileCode = async (
  jsxCode: string,
  hooksCode: string
): Promise<TranspileResult> => {
  const combinedSource = buildSinglePageCombinedSource(jsxCode, hooksCode)
  if (combinedSource.error || !combinedSource.code) {
    return {
      success: false,
      code: null,
      error: combinedSource.error,
    }
  }

  return transpileCombinedCode(combinedSource.code)
}

export const transpileProjectSource = async (
  source: ProjectSource,
  options?: ProjectSourceTranspileOptions
): Promise<TranspileResult> => {
  const combinedSource = buildProjectSourceCombinedCode(source, options)
  if (combinedSource.error || !combinedSource.code) {
    return {
      success: false,
      code: null,
      error: combinedSource.error,
    }
  }

  return transpileCombinedCode(combinedSource.code, {
    sourceMappings: combinedSource.sourceMappings,
  })
}

const parseBabelError = (
  error: unknown,
  sourceMappings: CombinedSourceMapping[] = []
): CompileError => {
  if (error instanceof Error) {
    // Try to extract line and column from error message
    // Babel errors typically look like: "unknown: Unexpected token (3:15)"
    const match = error.message.match(/\((\d+):(\d+)\)/)
    const generatedLine = match ? parseInt(match[1], 10) : null
    const sourceMapping = generatedLine ? findSourceMapping(sourceMappings, generatedLine) : null
    const mappedLine =
      generatedLine && sourceMapping
        ? Math.min(
            sourceMapping.sourceLineCount,
            Math.max(
              1,
              generatedLine - sourceMapping.generatedStartLine + 1 - sourceMapping.sourceLineOffset
            )
          )
        : generatedLine
    const mappedMessage =
      sourceMapping && mappedLine
        ? `${sourceMapping.label}: ${error.message.replace(/\((\d+):(\d+)\)/, `(${mappedLine}:$2)`)}`
        : error.message

    return {
      message: mappedMessage,
      line: mappedLine ? mappedLine - 1 : null, // Convert to 0-indexed
      column: match ? parseInt(match[2], 10) : null,
      stack: error.stack || null,
      pageId: sourceMapping?.pageId ?? null,
    }
  }

  return {
    message: String(error),
    line: null,
    column: null,
    stack: null,
  }
}

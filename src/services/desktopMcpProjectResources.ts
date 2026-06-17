import type { ThemeMode, ArcadePageId, ArcadeSourceFile, Project } from '@/types/project'
import type { CompileError, PreviewStatus, RuntimeError } from '@/types/preview'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import { getArcadeRuntimeDiagnosticHint } from '@/services/runtimeDiagnosticHints'
import {
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
  createDesktopMcpProjectPageSourceUri,
  parseDesktopMcpProjectSourceUri,
  type DesktopMcpProjectSourceKind,
} from '@/services/desktopMcpProjectSourceUris'
import {
  findPageReferences,
  type PageReference,
  type PageReferenceKind,
  getStalePageReferenceMessage,
} from '@/services/pageReferences'
import {
  getActivePage,
  getPageById,
  getStartPage,
  isArcadePageId,
} from '@/services/projectSource'
import type {
  DesktopMcpProjectResourceReadFailure,
  DesktopMcpProjectResourceReadRequest,
  DesktopMcpProjectResourceReadResult,
  DesktopMcpProjectResourceReadSuccess,
} from '@/services/desktopMcpProjectResourceProtocol'

export {
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
  DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
  createDesktopMcpProjectPageSourceUri,
  type DesktopMcpProjectSourceKind,
} from '@/services/desktopMcpProjectSourceUris'

const COMPILE_ERROR_SOURCE_LABEL_PATTERN = /^(global config|page\d+)\s+(JSX|Hooks):/i
const SOURCE_FILE_MIME_TYPE = 'text/plain'
const JSON_MIME_TYPE = 'application/json'
const MAX_DIAGNOSTIC_DETAILS_LENGTH = 1_000
const MAX_DIAGNOSTIC_SNIPPET_LENGTH = 200

type DesktopMcpProjectResourceKind =
  | 'manifest'
  | 'preview-context'
  | 'diagnostics'
  | 'global-source'
  | 'page-source'

interface DesktopMcpProjectResourceContext {
  project: Project
  theme: ThemeMode
  diagnostics: PreviewDiagnostics
}

interface DesktopMcpProjectSourceResourceSummary {
  uri: string
  bytes: number
  lineCount: number
  empty: boolean
}

interface DesktopMcpProjectReferenceEntry {
  sourceUri: string
  kind: PageReferenceKind
  targetPageId: ArcadePageId
  line: number
  column: number
}

interface DesktopMcpProjectManifestSourceGroup {
  jsx: DesktopMcpProjectSourceResourceSummary
  hooks: DesktopMcpProjectSourceResourceSummary
}

interface DesktopMcpProjectManifestSection {
  source: DesktopMcpProjectManifestSourceGroup
  pageReferences: DesktopMcpProjectReferenceEntry[]
  stalePageReferences: DesktopMcpProjectReferenceEntry[]
}

export interface DesktopMcpProjectManifestPage extends DesktopMcpProjectManifestSection {
  id: ArcadePageId
  name: string
}

export interface DesktopMcpProjectManifest {
  name: string
  projectRevision: string
  startPageId: ArcadePageId
  activePageId: ArcadePageId
  globalConfig: DesktopMcpProjectManifestSection
  pages: DesktopMcpProjectManifestPage[]
}

export interface DesktopMcpProjectPreviewContext {
  viewportSize: Project['viewportSize']
  theme: ThemeMode
}

type DesktopMcpProjectDiagnosticSeverity = 'error' | 'warning'
type DesktopMcpProjectDiagnosticKind =
  | 'compile-error'
  | 'runtime-error'
  | 'stale-page-reference'

export interface DesktopMcpProjectDiagnosticIssue {
  kind: DesktopMcpProjectDiagnosticKind
  severity: DesktopMcpProjectDiagnosticSeverity
  message: string
  hint?: string
  pageId?: ArcadePageId
  pageName?: string
  resourceUri?: string
  line?: number
  column?: number
  details?: string
  snippet?: string
  targetPageId?: ArcadePageId
}

export interface DesktopMcpProjectDiagnosticsResource {
  status: PreviewStatus
  issues: DesktopMcpProjectDiagnosticIssue[]
}

interface ParsedDesktopMcpProjectResourceUri {
  kind: DesktopMcpProjectResourceKind
  uri: string
  pageId?: ArcadePageId
  sourceKind?: DesktopMcpProjectSourceKind
}

interface PageReferenceSet {
  pageReferences: DesktopMcpProjectReferenceEntry[]
  stalePageReferences: DesktopMcpProjectReferenceEntry[]
}

export const createDesktopMcpProjectRevision = ({
  project,
  theme,
}: Pick<DesktopMcpProjectResourceContext, 'project' | 'theme'>): string => {
  const startPage = getStartPage(project)
  const activePage = getActivePage(project)
  const serializedState = JSON.stringify({
    name: project.name,
    source: project.source,
    startPageId: startPage.id,
    activePageId: activePage.id,
    preview: {
      viewportSize: project.viewportSize,
      theme,
    },
  })

  let hash = 2166136261
  for (let index = 0; index < serializedState.length; index += 1) {
    hash ^= serializedState.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `rev-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const createDesktopMcpProjectManifest = ({
  project,
  theme,
}: Pick<DesktopMcpProjectResourceContext, 'project' | 'theme'>): DesktopMcpProjectManifest => {
  const validPageIds = project.source.pages.map((page) => page.id)
  const startPage = getStartPage(project)
  const activePage = getActivePage(project)

  const globalConfig: DesktopMcpProjectManifestSection = {
    source: {
      jsx: createSourceResourceSummary(
        project.source.globalConfig.jsx,
        DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI
      ),
      hooks: createSourceResourceSummary(
        project.source.globalConfig.hooks,
        DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI
      ),
    },
    ...createReferenceSet(project.source.globalConfig, validPageIds, {
      jsx: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
      hooks: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
    }),
  }

  const pages = project.source.pages.map<DesktopMcpProjectManifestPage>((page) => ({
    id: page.id,
    name: page.name,
    source: {
      jsx: createSourceResourceSummary(
        page.source.jsx,
        createDesktopMcpProjectPageSourceUri(page.id, 'jsx')
      ),
      hooks: createSourceResourceSummary(
        page.source.hooks,
        createDesktopMcpProjectPageSourceUri(page.id, 'hooks')
      ),
    },
    ...createReferenceSet(page.source, validPageIds, {
      jsx: createDesktopMcpProjectPageSourceUri(page.id, 'jsx'),
      hooks: createDesktopMcpProjectPageSourceUri(page.id, 'hooks'),
    }),
  }))

  return {
    name: project.name,
    projectRevision: createDesktopMcpProjectRevision({ project, theme }),
    startPageId: startPage.id,
    activePageId: activePage.id,
    globalConfig,
    pages,
  }
}

export const createDesktopMcpProjectPreviewContext = ({
  project,
  theme,
}: Pick<DesktopMcpProjectResourceContext, 'project' | 'theme'>): DesktopMcpProjectPreviewContext => ({
  viewportSize: project.viewportSize,
  theme,
})

export const createDesktopMcpProjectDiagnostics = ({
  project,
  diagnostics,
}: Pick<DesktopMcpProjectResourceContext, 'project' | 'diagnostics'>): DesktopMcpProjectDiagnosticsResource => {
  const pageNameById = new Map(project.source.pages.map((page) => [page.id, page.name] as const))
  const issues: DesktopMcpProjectDiagnosticIssue[] = []

  if (diagnostics.compileError) {
    issues.push(createCompileErrorIssue(project, diagnostics.compileError, pageNameById))
  }

  if (diagnostics.runtimeError) {
    issues.push(createRuntimeErrorIssue(diagnostics.runtimeError, pageNameById))
  }

  issues.push(...createStalePageReferenceIssues(project, pageNameById))

  return {
    status: diagnostics.status,
    issues,
  }
}

export const readDesktopMcpProjectResource = (
  request: DesktopMcpProjectResourceReadRequest,
  context: DesktopMcpProjectResourceContext
): DesktopMcpProjectResourceReadResult => {
  const parsedUri = parseDesktopMcpProjectResourceUri(request.uri)
  if (!parsedUri) {
    return createResourceFailure(
      'invalid-resource-uri',
      request.uri,
      `Unsupported Desktop Arcade MCP project resource "${request.uri}".`
    )
  }

  switch (parsedUri.kind) {
    case 'manifest':
      return createResourceSuccess(parsedUri.uri, JSON_MIME_TYPE, createDesktopMcpProjectManifest(context))
    case 'preview-context':
      return createResourceSuccess(
        parsedUri.uri,
        JSON_MIME_TYPE,
        createDesktopMcpProjectPreviewContext(context)
      )
    case 'diagnostics':
      return createResourceSuccess(parsedUri.uri, JSON_MIME_TYPE, createDesktopMcpProjectDiagnostics(context))
    case 'global-source':
      return createSourceResourceSuccess(parsedUri.uri, readGlobalSourceText(context.project, parsedUri.sourceKind!))
    case 'page-source': {
      const page = getPageById(context.project.source, parsedUri.pageId!)
      if (!page) {
        return createResourceFailure(
          'source-not-found',
          parsedUri.uri,
          `Arcade page "${parsedUri.pageId}" was not found for Desktop MCP resource "${parsedUri.uri}".`
        )
      }

      return createSourceResourceSuccess(parsedUri.uri, readPageSourceText(page.source, parsedUri.sourceKind!))
    }
  }
}

const parseDesktopMcpProjectResourceUri = (
  uri: string
): ParsedDesktopMcpProjectResourceUri | null => {
  if (uri === DESKTOP_MCP_PROJECT_MANIFEST_URI) {
    return { kind: 'manifest', uri }
  }

  if (uri === DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI) {
    return { kind: 'preview-context', uri }
  }

  if (uri === DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI) {
    return { kind: 'diagnostics', uri }
  }

  if (uri === DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI) {
    return { kind: 'global-source', uri, sourceKind: 'jsx' }
  }

  if (uri === DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI) {
    return { kind: 'global-source', uri, sourceKind: 'hooks' }
  }

  const parsedSourceUri = parseDesktopMcpProjectSourceUri(uri)
  if (!parsedSourceUri || parsedSourceUri.target.type !== 'page') {
    return null
  }

  return {
    kind: 'page-source',
    uri,
    pageId: parsedSourceUri.target.pageId,
    sourceKind: parsedSourceUri.sourceKind,
  }
}

const createSourceResourceSummary = (
  content: string,
  uri: string
): DesktopMcpProjectSourceResourceSummary => ({
  uri,
  bytes: new TextEncoder().encode(content).length,
  lineCount: content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length,
  empty: content.length === 0,
})

const createReferenceSet = (
  source: ArcadeSourceFile,
  validPageIds: readonly ArcadePageId[],
  uris: { jsx: string; hooks: string }
): PageReferenceSet => {
  const references = [
    ...createReferenceEntries(source.jsx, validPageIds, uris.jsx),
    ...createReferenceEntries(source.hooks, validPageIds, uris.hooks),
  ].sort(sortReferenceEntries)

  return {
    pageReferences: references.filter((reference) => reference.status === 'valid').map(stripReferenceStatus),
    stalePageReferences: references
      .filter((reference) => reference.status === 'stale')
      .map(stripReferenceStatus),
  }
}

const createReferenceEntries = (
  code: string,
  validPageIds: readonly ArcadePageId[],
  sourceUri: string
): Array<DesktopMcpProjectReferenceEntry & { status: PageReference['status'] }> =>
  findPageReferences(code, validPageIds).map((reference) => ({
    sourceUri,
    kind: reference.kind,
    targetPageId: reference.targetPageId,
    status: reference.status,
    line: reference.line,
    column: reference.column,
  }))

const stripReferenceStatus = ({
  status: _status,
  ...reference
}: DesktopMcpProjectReferenceEntry & { status: PageReference['status'] }): DesktopMcpProjectReferenceEntry =>
  reference

const sortReferenceEntries = (
  left: DesktopMcpProjectReferenceEntry & { status: PageReference['status'] },
  right: DesktopMcpProjectReferenceEntry & { status: PageReference['status'] }
): number =>
  left.sourceUri.localeCompare(right.sourceUri) ||
  left.line - right.line ||
  left.column - right.column ||
  left.targetPageId.localeCompare(right.targetPageId)

const createCompileErrorIssue = (
  project: Project,
  error: CompileError,
  pageNameById: ReadonlyMap<ArcadePageId, string>
): DesktopMcpProjectDiagnosticIssue => {
  const resourceUri = error.resourceUri ?? inferCompileErrorResourceUri(error.message)
  const sourceText = resourceUri ? readSourceTextFromUri(project, resourceUri) : null

  return {
    kind: 'compile-error',
    severity: 'error',
    message: error.message,
    ...(error.pageId ? { pageId: error.pageId } : {}),
    ...(error.pageId && pageNameById.has(error.pageId)
      ? { pageName: pageNameById.get(error.pageId)! }
      : {}),
    ...(resourceUri ? { resourceUri } : {}),
    ...(error.line !== null ? { line: error.line } : {}),
    ...(error.column !== null ? { column: error.column } : {}),
    ...(error.stack ? { details: truncateText(error.stack, MAX_DIAGNOSTIC_DETAILS_LENGTH) } : {}),
    ...(sourceText !== null && error.line !== null
      ? { snippet: getSourceLineSnippet(sourceText, error.line) }
      : {}),
  }
}

const createRuntimeErrorIssue = (
  error: RuntimeError,
  pageNameById: ReadonlyMap<ArcadePageId, string>
): DesktopMcpProjectDiagnosticIssue => {
  const details = [error.componentStack, error.stack]
    .filter((value): value is string => Boolean(value))
    .join('\n\n')
  const hint = getArcadeRuntimeDiagnosticHint(error)

  return {
    kind: 'runtime-error',
    severity: 'error',
    message: error.message,
    ...(hint ? { hint } : {}),
    ...(error.pageId ? { pageId: error.pageId } : {}),
    ...(error.pageId && pageNameById.has(error.pageId)
      ? { pageName: pageNameById.get(error.pageId)! }
      : {}),
    ...(details ? { details: truncateText(details, MAX_DIAGNOSTIC_DETAILS_LENGTH) } : {}),
  }
}

const createStalePageReferenceIssues = (
  project: Project,
  pageNameById: ReadonlyMap<ArcadePageId, string>
): DesktopMcpProjectDiagnosticIssue[] => {
  const validPageIds = project.source.pages.map((page) => page.id)
  const issues: DesktopMcpProjectDiagnosticIssue[] = []

  const pushStaleIssues = (
    source: ArcadeSourceFile,
    uris: { jsx: string; hooks: string },
    location: { pageId?: ArcadePageId; pageName?: string }
  ) => {
    for (const reference of [
      ...findPageReferences(source.jsx, validPageIds).map((entry) => ({
        ...entry,
        sourceUri: uris.jsx,
        sourceText: source.jsx,
      })),
      ...findPageReferences(source.hooks, validPageIds).map((entry) => ({
        ...entry,
        sourceUri: uris.hooks,
        sourceText: source.hooks,
      })),
    ]) {
      if (reference.status !== 'stale') {
        continue
      }

      issues.push({
        kind: 'stale-page-reference',
        severity: 'warning',
        message: getStalePageReferenceMessage(reference),
        ...(location.pageId ? { pageId: location.pageId } : {}),
        ...(location.pageName ? { pageName: location.pageName } : {}),
        resourceUri: reference.sourceUri,
        line: reference.line,
        column: reference.column,
        targetPageId: reference.targetPageId,
        snippet: getSourceLineSnippet(reference.sourceText, reference.line),
      })
    }
  }

  pushStaleIssues(project.source.globalConfig, {
    jsx: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI,
    hooks: DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI,
  }, {})

  for (const page of project.source.pages) {
    pushStaleIssues(
      page.source,
      {
        jsx: createDesktopMcpProjectPageSourceUri(page.id, 'jsx'),
        hooks: createDesktopMcpProjectPageSourceUri(page.id, 'hooks'),
      },
      {
        pageId: page.id,
        pageName: pageNameById.get(page.id),
      }
    )
  }

  return issues.sort((left, right) => {
    const leftPage = left.pageId ?? ''
    const rightPage = right.pageId ?? ''
    return (
      left.kind.localeCompare(right.kind) ||
      leftPage.localeCompare(rightPage) ||
      (left.resourceUri ?? '').localeCompare(right.resourceUri ?? '') ||
      (left.line ?? 0) - (right.line ?? 0) ||
      (left.column ?? 0) - (right.column ?? 0)
    )
  })
}

const inferCompileErrorResourceUri = (message: string): string | null => {
  const match = message.match(COMPILE_ERROR_SOURCE_LABEL_PATTERN)
  if (!match) {
    return null
  }

  const sourceKind = match[2].toLowerCase() as DesktopMcpProjectSourceKind
  if (match[1].toLowerCase() === 'global config') {
    return sourceKind === 'jsx'
      ? DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_JSX_URI
      : DESKTOP_MCP_PROJECT_SOURCE_GLOBAL_HOOKS_URI
  }

  return isArcadePageId(match[1])
    ? createDesktopMcpProjectPageSourceUri(match[1], sourceKind)
    : null
}

const createResourceSuccess = (
  uri: string,
  mimeType: string,
  content: object
): DesktopMcpProjectResourceReadSuccess => ({
  ok: true,
  uri,
  mimeType,
  text: JSON.stringify(content),
})

const createSourceResourceSuccess = (
  uri: string,
  text: string
): DesktopMcpProjectResourceReadSuccess => ({
  ok: true,
  uri,
  mimeType: SOURCE_FILE_MIME_TYPE,
  text,
})

const createResourceFailure = (
  code: DesktopMcpProjectResourceReadFailure['code'],
  resourceUri: string,
  message: string
): DesktopMcpProjectResourceReadFailure => ({
  ok: false,
  code,
  message,
  resourceUri,
})

const readGlobalSourceText = (
  project: Project,
  sourceKind: DesktopMcpProjectSourceKind
): string => readPageSourceText(project.source.globalConfig, sourceKind)

const readPageSourceText = (
  source: ArcadeSourceFile,
  sourceKind: DesktopMcpProjectSourceKind
): string => (sourceKind === 'jsx' ? source.jsx : source.hooks)

const readSourceTextFromUri = (project: Project, uri: string): string | null => {
  const parsedUri = parseDesktopMcpProjectResourceUri(uri)
  if (!parsedUri) {
    return null
  }

  switch (parsedUri.kind) {
    case 'global-source':
      return readGlobalSourceText(project, parsedUri.sourceKind!)
    case 'page-source': {
      const page = getPageById(project.source, parsedUri.pageId!)
      return page ? readPageSourceText(page.source, parsedUri.sourceKind!) : null
    }
    default:
      return null
  }
}

const getSourceLineSnippet = (sourceText: string, line: number): string | undefined => {
  const sourceLine = sourceText.split(/\r\n|\r|\n/)[line]
  if (sourceLine === undefined) {
    return undefined
  }

  const normalizedLine = sourceLine.trim()
  if (!normalizedLine) {
    return undefined
  }

  return truncateText(normalizedLine, MAX_DIAGNOSTIC_SNIPPET_LENGTH)
}

const truncateText = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value

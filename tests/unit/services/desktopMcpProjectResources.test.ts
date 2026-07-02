import { describe, expect, it } from 'vitest'
import { createArcadePage, createArcadeSourceFile } from '@/services/projectSource'
import type { Project } from '@/types/project'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import {
  DESKTOP_MCP_PROJECT_ANNOTATIONS_URI,
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  createDesktopMcpProjectPageAnnotationsUri,
  createDesktopMcpProjectDiagnostics,
  createDesktopMcpProjectManifest,
  createDesktopMcpProjectRevision,
  readDesktopMcpProjectResource,
} from '@/services/desktopMcpProjectResources'

const createProject = (): Project => ({
  id: 'project-1',
  name: 'Desktop MCP project',
  source: {
    globalConfig: createArcadeSourceFile(
      `export const SharedNav = () => (
  <Link to="page02">Details</Link>
)`,
      ''
    ),
    pages: [
      createArcadePage(
        'page01',
        'Start',
        createArcadeSourceFile(
          `export default function StartPage() {
  return <Link to="page02">Go details</Link>
}`,
          `export const goMissing = () => goToPage('page99')`
        )
      ),
      createArcadePage(
        'page02',
        'Details',
        createArcadeSourceFile(
          `export default function DetailsPage() {
  return (
    <section data-testid="details">Details</section>
  )
}`,
          'const detailsReady = true'
        )
      ),
    ],
    startPageId: 'page01',
    nextPageNumber: 3,
  },
  activePageId: 'page02',
  annotations: [
    {
      id: 'annotation-visible-pending',
      pageId: 'page01',
      x: 10,
      y: 20,
      comment: 'Visible pending note',
      element: 'Button',
      elementPath: 'visible',
      timestamp: 1,
      kind: 'feedback',
      status: 'pending',
      createdAt: '2026-06-16T08:01:00.000Z',
      updatedAt: '2026-06-16T08:01:00.000Z',
    },
    {
      id: 'annotation-hidden-acknowledged',
      pageId: 'page01',
      x: 11,
      y: 21,
      comment: 'Hidden acknowledged note',
      element: 'BodyShort',
      elementPath: 'hidden',
      timestamp: 2,
      kind: 'feedback',
      status: 'acknowledged',
      createdAt: '2026-06-16T08:02:00.000Z',
      updatedAt: '2026-06-16T08:02:00.000Z',
    },
    {
      id: 'annotation-dead-dismissed',
      pageId: 'page01',
      x: 12,
      y: 22,
      comment: 'Dead dismissed note',
      element: 'Link',
      elementPath: 'dead',
      timestamp: 3,
      kind: 'feedback',
      status: 'dismissed',
      createdAt: '2026-06-16T08:03:00.000Z',
      updatedAt: '2026-06-16T08:03:00.000Z',
    },
    {
      id: 'annotation-visible-resolved',
      pageId: 'page02',
      x: 13,
      y: 23,
      comment: 'Visible resolved note',
      element: 'Section',
      elementPath: 'visible',
      timestamp: 4,
      kind: 'feedback',
      status: 'resolved',
      createdAt: '2026-06-16T08:04:00.000Z',
      updatedAt: '2026-06-16T08:04:00.000Z',
    },
  ],
  viewportSize: 'LG',
  panelLayout: 'editor-left',
  version: '2.0.0',
  createdAt: '2026-06-16T08:00:00.000Z',
  lastModified: '2026-06-16T08:00:00.000Z',
})

const createDiagnostics = (overrides: Partial<PreviewDiagnostics> = {}): PreviewDiagnostics => ({
  status: 'error',
  compileError: {
    message: 'Unexpected token (3:10)',
    line: 2,
    column: 10,
    stack: 'SyntaxError: Unexpected token',
    pageId: 'page02',
    resourceUri: 'arcade://project/source/pages/page02/jsx',
  },
  runtimeError: {
    message: 'Boom',
    componentStack: '\n    at StartPage',
    stack: 'Error: Boom',
    pageId: 'page01',
  },
  sandboxConsoleMessages: [],
  ...overrides,
})

const resolvePageAnnotationVisibilities = async (
  _pageId: string,
  annotations: Array<{ id: string }>
): Promise<Map<string, 'visible' | 'hidden' | 'dead'>> =>
  new Map(
    annotations.map((annotation) => {
      if (annotation.id === 'annotation-hidden-acknowledged') {
        return [annotation.id, 'hidden'] as const
      }
      if (annotation.id === 'annotation-dead-dismissed') {
        return [annotation.id, 'dead'] as const
      }
      return [annotation.id, 'visible'] as const
    })
  )

describe('desktopMcpProjectResources', () => {
  it('builds a compact manifest with source links, revision metadata, page references, and annotation counts', async () => {
    const manifest = await createDesktopMcpProjectManifest(
      {
      project: createProject(),
      theme: 'dark',
      },
      { resolvePageAnnotationVisibilities }
    )

    expect(manifest.name).toBe('Desktop MCP project')
    expect(manifest.projectRevision).toMatch(/^rev-[0-9a-f]{8}$/)
    expect(manifest.startPageId).toBe('page01')
    expect(manifest.activePageId).toBe('page02')
    expect(manifest.globalConfig.source.jsx.uri).toBe('arcade://project/source/global/jsx')
    expect(manifest.globalConfig.pageReferences).toEqual([
      {
        sourceUri: 'arcade://project/source/global/jsx',
        kind: 'to',
        targetPageId: 'page02',
        line: 1,
        column: 12,
      },
    ])
    expect(manifest.pages[0]).toMatchObject({
      id: 'page01',
      name: 'Start',
      source: {
        jsx: { uri: 'arcade://project/source/pages/page01/jsx', empty: false },
        hooks: { uri: 'arcade://project/source/pages/page01/hooks', empty: false },
      },
      pageReferences: [
        {
          sourceUri: 'arcade://project/source/pages/page01/jsx',
          kind: 'to',
          targetPageId: 'page02',
          line: 1,
          column: 19,
        },
      ],
      stalePageReferences: [
        {
          sourceUri: 'arcade://project/source/pages/page01/hooks',
          kind: 'goToPage',
          targetPageId: 'page99',
          line: 0,
          column: 41,
        },
      ],
      annotationCounts: {
        open: 2,
        pending: 1,
      },
    })
    expect(manifest.pages[1]?.annotationCounts).toEqual({
      open: 0,
      pending: 0,
    })
  })

  it('summarizes compile, runtime, and stale-reference diagnostics with resource URIs and snippets', () => {
    const diagnostics = createDesktopMcpProjectDiagnostics({
      project: createProject(),
      diagnostics: createDiagnostics(),
    })

    expect(diagnostics.status).toBe('error')

    const compileIssue = diagnostics.issues.find((issue) => issue.kind === 'compile-error')
    expect(compileIssue).toMatchObject({
      kind: 'compile-error',
      severity: 'error',
      pageId: 'page02',
      pageName: 'Details',
      resourceUri: 'arcade://project/source/pages/page02/jsx',
      line: 2,
      column: 10,
      snippet: '<section data-testid="details">Details</section>',
    })

    const runtimeIssue = diagnostics.issues.find((issue) => issue.kind === 'runtime-error')
    expect(runtimeIssue).toMatchObject({
      kind: 'runtime-error',
      severity: 'error',
      pageId: 'page01',
      pageName: 'Start',
      message: 'Boom',
    })
    expect(runtimeIssue?.details).toContain('StartPage')

    const staleIssue = diagnostics.issues.find(
      (issue) =>
        issue.kind === 'stale-page-reference' &&
        issue.resourceUri === 'arcade://project/source/pages/page01/hooks'
    )
    expect(staleIssue).toMatchObject({
      kind: 'stale-page-reference',
      severity: 'warning',
      pageId: 'page01',
      pageName: 'Start',
      targetPageId: 'page99',
      line: 0,
      column: 41,
    })
    expect(staleIssue?.snippet).toContain("goToPage('page99')")
  })

  it('adds an Arcade-specific hint for invalid hook calls coming from Global config hooks', () => {
    const project = createProject()
    project.source.globalConfig = createArcadeSourceFile(
      project.source.globalConfig.jsx,
      'const [sharedCount, setSharedCount] = useState(0)'
    )

    const diagnostics = createDesktopMcpProjectDiagnostics({
      project,
      diagnostics: createDiagnostics({
        compileError: null,
        runtimeError: {
          message:
            'Invalid hook call. Hooks can only be called inside of the body of a function component.',
          componentStack: null,
          stack:
            'Error: Invalid hook call. Hooks can only be called inside of the body of a function component.',
        },
      }),
    })

    const runtimeIssue = diagnostics.issues.find((issue) => issue.kind === 'runtime-error')
    expect(runtimeIssue).toMatchObject({
      kind: 'runtime-error',
      message:
        'Invalid hook call. Hooks can only be called inside of the body of a function component.',
      hint: 'This often means a hook is still running at module scope (for example Global config, or a bare page Hooks statement) instead of inside a page component. In Arcade, keep page state in top-level bindings in the page Hooks tab (for example `const [value, setValue] = useState(...)`), or define a custom hook function in Global config and call it from a page.',
    })
    expect(runtimeIssue).not.toHaveProperty('pageId')
  })

  it('surfaces sandbox render failures through arcade://project/diagnostics as structured runtime issues', async () => {
    const result = await readDesktopMcpProjectResource(
      { uri: DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics({
          compileError: null,
          runtimeError: {
            message: 'Agent render exploded',
            componentStack: '\n    at App',
            stack: 'Error: Agent render exploded',
            pageId: 'page01',
          },
        }),
      }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.message)
    }

    const diagnostics = JSON.parse(result.text) as {
      status: string
      issues: Array<{
        kind: string
        pageId?: string
        pageName?: string
        message?: string
        details?: string
      }>
    }

    expect(diagnostics.status).toBe('error')
    expect(diagnostics.issues).toContainEqual(
      expect.objectContaining({
        kind: 'runtime-error',
        pageId: 'page01',
        pageName: 'Start',
        message: 'Agent render exploded',
      })
    )
    expect(diagnostics.issues.find((issue) => issue.kind === 'runtime-error')?.details).toContain(
      'App'
    )
  })

  it('returns preview context and pure source text for project resources', async () => {
    const project = createProject()
    const context = {
      project,
      theme: 'light' as const,
      diagnostics: createDiagnostics(),
    }

    const previewContextResult = await readDesktopMcpProjectResource(
      { uri: DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI },
      context
    )
    expect(previewContextResult.ok).toBe(true)
    if (!previewContextResult.ok) {
      throw new Error(previewContextResult.message)
    }
    expect(previewContextResult.mimeType).toBe('application/json')
    expect(JSON.parse(previewContextResult.text)).toEqual({
      viewportSize: 'LG',
      theme: 'light',
    })

    const sourceResult = await readDesktopMcpProjectResource(
      { uri: 'arcade://project/source/pages/page02/hooks' },
      context
    )
    expect(sourceResult).toEqual({
      ok: true,
      uri: 'arcade://project/source/pages/page02/hooks',
      mimeType: 'text/plain',
      text: 'const detailsReady = true',
    })
  })

  it('returns source-not-found and invalid-resource-uri failures for unsupported project reads', async () => {
    const context = {
      project: createProject(),
      theme: 'dark' as const,
      diagnostics: createDiagnostics(),
    }

    expect(
      await readDesktopMcpProjectResource({ uri: 'arcade://project/source/pages/page99/jsx' }, context)
    ).toEqual({
      ok: false,
      code: 'source-not-found',
      resourceUri: 'arcade://project/source/pages/page99/jsx',
      message:
        'Arcade page "page99" was not found for Desktop MCP resource "arcade://project/source/pages/page99/jsx".',
    })

    expect(
      await readDesktopMcpProjectResource({ uri: 'arcade://project/source/pages/page02/css' }, context)
    ).toEqual({
      ok: false,
      code: 'invalid-resource-uri',
      resourceUri: 'arcade://project/source/pages/page02/css',
      message:
        'Unsupported Desktop Arcade MCP project resource "arcade://project/source/pages/page02/css".',
    })
  })

  it('changes the project revision when theme or durable project state changes', () => {
    const baseProject = createProject()
    const renamedProject: Project = {
      ...baseProject,
      name: 'Renamed project',
    }

    const baseRevision = createDesktopMcpProjectRevision({
      project: baseProject,
      theme: 'dark',
    })
    const themeRevision = createDesktopMcpProjectRevision({
      project: baseProject,
      theme: 'light',
    })
    const renamedRevision = createDesktopMcpProjectRevision({
      project: renamedProject,
      theme: 'dark',
    })

    expect(themeRevision).not.toBe(baseRevision)
    expect(renamedRevision).not.toBe(baseRevision)
  })

  it('reads manifest, diagnostics, and annotation resources through the public project resource entrypoints', async () => {
    const context = {
      project: createProject(),
      theme: 'dark' as const,
      diagnostics: createDiagnostics(),
    }

    const manifestResult = await readDesktopMcpProjectResource(
      { uri: DESKTOP_MCP_PROJECT_MANIFEST_URI },
      context,
      { resolvePageAnnotationVisibilities }
    )
    expect(manifestResult.ok).toBe(true)
    if (!manifestResult.ok) {
      throw new Error(manifestResult.message)
    }
    expect(JSON.parse(manifestResult.text).pages).toHaveLength(2)

    const diagnosticsResult = await readDesktopMcpProjectResource(
      { uri: DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI },
      context
    )
    expect(diagnosticsResult.ok).toBe(true)
    if (!diagnosticsResult.ok) {
      throw new Error(diagnosticsResult.message)
    }
    expect(JSON.parse(diagnosticsResult.text).issues.length).toBeGreaterThanOrEqual(3)

    const projectAnnotationsResult = await readDesktopMcpProjectResource(
      { uri: DESKTOP_MCP_PROJECT_ANNOTATIONS_URI },
      context,
      { resolvePageAnnotationVisibilities }
    )
    expect(projectAnnotationsResult.ok).toBe(true)
    if (!projectAnnotationsResult.ok) {
      throw new Error(projectAnnotationsResult.message)
    }

    const projectAnnotations = JSON.parse(projectAnnotationsResult.text)
    expect(projectAnnotations.counts).toMatchObject({
      total: 3,
      open: 2,
      pending: 1,
      acknowledged: 1,
      resolved: 1,
      dismissed: 0,
      visible: 2,
      hidden: 1,
    })
    expect(projectAnnotations.annotations.map((annotation: { id: string }) => annotation.id)).toEqual([
      'annotation-visible-pending',
      'annotation-hidden-acknowledged',
      'annotation-visible-resolved',
    ])

    const pageAnnotationsResult = await readDesktopMcpProjectResource(
      { uri: createDesktopMcpProjectPageAnnotationsUri('page01') },
      context,
      { resolvePageAnnotationVisibilities }
    )
    expect(pageAnnotationsResult.ok).toBe(true)
    if (!pageAnnotationsResult.ok) {
      throw new Error(pageAnnotationsResult.message)
    }

    const pageAnnotations = JSON.parse(pageAnnotationsResult.text)
    expect(pageAnnotations.page).toEqual({
      id: 'page01',
      name: 'Start',
      isActive: false,
    })
    expect(pageAnnotations.annotations).toEqual([
      expect.objectContaining({
        id: 'annotation-visible-pending',
        targetVisibility: 'visible',
      }),
      expect.objectContaining({
        id: 'annotation-hidden-acknowledged',
        targetVisibility: 'hidden',
      }),
    ])
  })
})

import { describe, expect, it } from 'vitest'
import {
  DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
  DESKTOP_MCP_PROJECT_MANIFEST_URI,
  DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
  createDesktopMcpProjectPageSourceUri,
  createDesktopMcpProjectRevision,
} from '@/services/desktopMcpProjectResources'
import { createArcadePage, createArcadeSourceFile } from '@/services/projectSource'
import type { PreviewDiagnostics } from '@/services/previewDiagnostics'
import { prepareDesktopMcpApplyChanges } from '@/services/desktopMcpApplyChanges'
import type { ArcadePageId, Project } from '@/types/project'

const FIXED_TIMESTAMP = '2026-06-16T12:00:00.000Z'

const createProject = ({
  includeSecondPage = false,
  startPageId = 'page01',
  activePageId = 'page01',
}: {
  includeSecondPage?: boolean
  startPageId?: ArcadePageId
  activePageId?: ArcadePageId
} = {}): Project => ({
  id: 'project-1',
  name: 'Desktop MCP project',
  source: {
    globalConfig: createArcadeSourceFile('export const Shared = () => null', ''),
    pages: [
      createArcadePage(
        'page01',
        'Page 1',
        createArcadeSourceFile(
          'export default function PageOne() {\n  return <div>Hello</div>\n}',
          'const pageOneReady = true'
        )
      ),
      ...(includeSecondPage
        ? [
            createArcadePage(
              'page02',
              'Page 2',
              createArcadeSourceFile(
                'export default function PageTwo() {\n  return <div>Second</div>\n}',
                'const pageTwoReady = true'
              )
            ),
          ]
        : []),
    ],
    startPageId,
    nextPageNumber: includeSecondPage ? 3 : 2,
  },
  activePageId,
  viewportSize: 'LG',
  panelLayout: 'editor-left',
  version: '2.0.0',
  createdAt: '2026-06-16T08:00:00.000Z',
  lastModified: '2026-06-16T08:00:00.000Z',
})

const createDiagnostics = (): PreviewDiagnostics => ({
  status: 'idle',
  compileError: null,
  runtimeError: null,
  sandboxConsoleMessages: [],
})

describe('desktopMcpApplyChanges', () => {
  it('prevalidates and prepares existing-project edits atomically', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Rename and update the starter page',
        operations: [
          {
            type: 'replace_source',
            resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
            content: 'export default function PageOne() {\n  return <div>Updated</div>\n}',
          },
          {
            type: 'set_preview_context',
            viewportSize: 'MD',
            theme: 'light',
          },
          {
            type: 'rename_project',
            name: 'Renamed project',
          },
        ],
      },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.previewRefreshRequired).toBe(true)
    expect(result.nextProject.name).toBe('Renamed project')
    expect(result.nextProject.viewportSize).toBe('MD')
    expect(result.nextProject.lastModified).toBe(FIXED_TIMESTAMP)
    expect(result.nextProject.source.pages[0]?.source.jsx).toContain('Updated')
    expect(result.nextTheme).toBe('light')
    expect(result.nextDiagnostics).toMatchObject({
      status: 'transpiling',
      compileError: null,
      runtimeError: null,
    })
    expect(result.result).toEqual({
      ok: true,
      summary: 'Rename and update the starter page',
      projectRevision: createDesktopMcpProjectRevision({
        project: result.nextProject,
        theme: result.nextTheme,
      }),
      changedResources: [
        DESKTOP_MCP_PROJECT_MANIFEST_URI,
        createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
        DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
      ],
      nextRecommendedResources: [
        DESKTOP_MCP_PROJECT_MANIFEST_URI,
        DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
        createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
        DESKTOP_MCP_PROJECT_PREVIEW_CONTEXT_URI,
      ],
      operationResults: [
        {
          index: 0,
          type: 'replace_source',
          resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
        },
        {
          index: 1,
          type: 'set_preview_context',
          viewportSize: 'MD',
          theme: 'light',
        },
        {
          index: 2,
          type: 'rename_project',
          name: 'Renamed project',
        },
      ],
      safeActivity: {
        toolName: 'apply_changes',
        operationTypes: ['replace_source', 'set_preview_context', 'rename_project'],
        timestamp: FIXED_TIMESTAMP,
      },
    })
  })

  it('creates, renames, links, and selects pages atomically with temp refs and placeholder rewriting', () => {
    const originalProject = createProject()
    const originalRevision = createDesktopMcpProjectRevision({
      project: originalProject,
      theme: 'dark',
    })

    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Create a landing page and link the starter page to it',
        expectedProjectRevision: originalRevision,
        operations: [
          {
            type: 'create_page',
            newPageRef: 'landing',
            jsxCode:
              'export default function LandingPage() {\n  return <a href="{{pageRef:landing}}">Stay on landing</a>\n}',
            hooksCode: 'export const useLanding = () => true',
          },
          {
            type: 'rename_page',
            tempPageRef: 'landing',
            name: 'Landing',
          },
          {
            type: 'replace_source',
            resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
            content:
              'export default function PageOne() {\n  return <a href="{{pageRef:landing}}">Open landing</a>\n}',
          },
          {
            type: 'set_start_page',
            tempPageRef: 'landing',
          },
          {
            type: 'select_active_page',
            tempPageRef: 'landing',
          },
        ],
      },
      {
        project: originalProject,
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(result.previewRefreshRequired).toBe(true)
    expect(result.nextProject.source.pages).toHaveLength(2)
    expect(result.nextProject.source.pages[1]).toMatchObject({
      id: 'page02',
      name: 'Landing',
      source: {
        jsx: 'export default function LandingPage() {\n  return <a href="page02">Stay on landing</a>\n}',
        hooks: 'export const useLanding = () => true',
      },
    })
    expect(result.nextProject.source.startPageId).toBe('page02')
    expect(result.nextProject.activePageId).toBe('page02')
    expect(result.nextProject.source.pages[0]?.source.jsx).toBe(
      'export default function PageOne() {\n  return <a href="page02">Open landing</a>\n}'
    )
    expect(result.nextProject.lastModified).toBe(FIXED_TIMESTAMP)
    expect(result.nextDiagnostics.status).toBe('transpiling')
    expect(result.result.projectRevision).not.toBe(originalRevision)
    expect(result.result).toEqual({
      ok: true,
      summary: 'Create a landing page and link the starter page to it',
      projectRevision: createDesktopMcpProjectRevision({
        project: result.nextProject,
        theme: result.nextTheme,
      }),
      changedResources: [
        DESKTOP_MCP_PROJECT_MANIFEST_URI,
        createDesktopMcpProjectPageSourceUri('page02', 'jsx'),
        createDesktopMcpProjectPageSourceUri('page02', 'hooks'),
        createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
      ],
      nextRecommendedResources: [
        DESKTOP_MCP_PROJECT_MANIFEST_URI,
        DESKTOP_MCP_PROJECT_DIAGNOSTICS_URI,
        createDesktopMcpProjectPageSourceUri('page02', 'jsx'),
        createDesktopMcpProjectPageSourceUri('page02', 'hooks'),
        createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
      ],
      operationResults: [
        {
          index: 0,
          type: 'create_page',
          pageId: 'page02',
          name: 'Page 2',
          newPageRef: 'landing',
          sourceResources: {
            jsxResourceUri: createDesktopMcpProjectPageSourceUri('page02', 'jsx'),
            hooksResourceUri: createDesktopMcpProjectPageSourceUri('page02', 'hooks'),
          },
        },
        {
          index: 1,
          type: 'rename_page',
          pageId: 'page02',
          name: 'Landing',
        },
        {
          index: 2,
          type: 'replace_source',
          resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
        },
        {
          index: 3,
          type: 'set_start_page',
          pageId: 'page02',
        },
        {
          index: 4,
          type: 'select_active_page',
          pageId: 'page02',
        },
      ],
      tempPageRefMappings: {
        landing: {
          pageId: 'page02',
          sourceResources: {
            jsxResourceUri: createDesktopMcpProjectPageSourceUri('page02', 'jsx'),
            hooksResourceUri: createDesktopMcpProjectPageSourceUri('page02', 'hooks'),
          },
        },
      },
      safeActivity: {
        toolName: 'apply_changes',
        operationTypes: [
          'create_page',
          'rename_page',
          'replace_source',
          'set_start_page',
          'select_active_page',
        ],
        timestamp: FIXED_TIMESTAMP,
      },
    })
  })

  it('fails stale project revisions before applying anything', () => {
    const project = createProject()
    const currentProjectRevision = createDesktopMcpProjectRevision({
      project,
      theme: 'dark',
    })

    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Attempt stale edit',
        expectedProjectRevision: 'rev-deadbeef',
        operations: [
          {
            type: 'rename_project',
            name: 'Stale rename',
          },
        ],
      },
      {
        project,
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'stale-project-revision',
      message: `apply_changes expected project revision "rev-deadbeef" but the active project is now "${currentProjectRevision}". Re-read arcade://project/manifest before retrying.`,
      manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      expectedProjectRevision: 'rev-deadbeef',
      currentProjectRevision,
    })
  })

  it('rejects replace_source targets that are not current manifest resources', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Patch a missing page',
        operations: [
          {
            type: 'replace_source',
            resourceUri: 'arcade://project/source/pages/page99/jsx',
            content: 'export default () => null',
          },
        ],
      },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation-target',
      message:
        'apply_changes replace_source could not find Arcade page "page99" for "arcade://project/source/pages/page99/jsx". Re-read arcade://project/manifest before retrying.',
      manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
      resourceUri: 'arcade://project/source/pages/page99/jsx',
    })
  })

  it('rejects unresolved page-ref placeholders before anything applies', () => {
    const project = createProject()

    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Link to a missing temp page ref',
        operations: [
          {
            type: 'replace_source',
            resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
            content:
              'export default function PageOne() {\n  return <a href="{{pageRef:missing}}">Broken</a>\n}',
          },
        ],
      },
      {
        project,
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation-target',
      message:
        'apply_changes replace_source operation 0 content contains unresolved {{pageRef:missing}} placeholder. Declare create_page.newPageRef "missing" earlier in the same apply_changes batch.',
      manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
    })
    expect(project.source.pages).toHaveLength(1)
    expect(project.source.pages[0]?.source.jsx).toContain('Hello')
  })

  it('rejects temp refs that are used before their create_page declaration', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Use a temp ref too early',
        operations: [
          {
            type: 'set_start_page',
            tempPageRef: 'landing',
          },
          {
            type: 'create_page',
            newPageRef: 'landing',
          },
        ],
      },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation-target',
      message:
        'apply_changes set_start_page operation 0 references tempPageRef "landing" before create_page declares it. Move the create_page earlier in the batch.',
      manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
    })
  })

  it('rejects page-ref placeholders that target a temp-ref page deleted earlier in the batch', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Delete a temp-ref page before linking to it',
        operations: [
          {
            type: 'create_page',
            newPageRef: 'landing',
          },
          {
            type: 'delete_page',
            tempPageRef: 'landing',
          },
          {
            type: 'replace_source',
            resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
            content:
              'export default function PageOne() {\n  return <a href="{{pageRef:landing}}">Broken</a>\n}',
          },
        ],
      },
      {
        project: createProject({ includeSecondPage: true, startPageId: 'page02', activePageId: 'page02' }),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation-target',
      message:
        'apply_changes replace_source operation 2 content contains {{pageRef:landing}} placeholder, but Arcade page "page03" is no longer available at that step.',
      manifestResourceUri: DESKTOP_MCP_PROJECT_MANIFEST_URI,
    })
  })

  it('requires an explicit start-page replacement when deleting the current start page', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Delete the current start page',
        operations: [
          {
            type: 'delete_page',
            pageId: 'page01',
          },
        ],
      },
      {
        project: createProject({ includeSecondPage: true }),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation',
      message:
        'apply_changes deleted the current Start page without setting a replacement in the same batch. Add set_start_page targeting a remaining page or tempPageRef.',
    })
  })

  it('requires an explicit active-page replacement when deleting the current active page', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Delete the current active page',
        operations: [
          {
            type: 'delete_page',
            pageId: 'page01',
          },
        ],
      },
      {
        project: createProject({
          includeSecondPage: true,
          startPageId: 'page02',
          activePageId: 'page01',
        }),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation',
      message:
        'apply_changes deleted the current Active page without selecting a replacement in the same batch. Add select_active_page targeting a remaining page or tempPageRef.',
    })
  })

  it('rejects batches that would leave the project with zero pages', () => {
    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Delete the last page',
        operations: [
          {
            type: 'delete_page',
            pageId: 'page01',
          },
        ],
      },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result).toEqual({
      ok: false,
      code: 'invalid-operation',
      message:
        'apply_changes would leave the Arcade project without any pages. Keep a remaining page or create a replacement before deleting the last page.',
    })
  })

  it('rejects batches that would exceed the 5MB Arcade project size limit', () => {
    const hugeJsx = `export default function Huge() {\n  return <div>${'x'.repeat(5 * 1024 * 1024)}</div>\n}`

    const result = prepareDesktopMcpApplyChanges(
      {
        summary: 'Overflow the project size limit',
        operations: [
          {
            type: 'replace_source',
            resourceUri: createDesktopMcpProjectPageSourceUri('page01', 'jsx'),
            content: hugeJsx,
          },
        ],
      },
      {
        project: createProject(),
        theme: 'dark',
        diagnostics: createDiagnostics(),
      },
      FIXED_TIMESTAMP
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected payload-too-large failure')
    }
    expect(result.code).toBe('payload-too-large')
    expect(result.message).toContain('exceeds 5MB limit')
  })
})

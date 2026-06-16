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
import type { Project } from '@/types/project'

const FIXED_TIMESTAMP = '2026-06-16T12:00:00.000Z'

const createProject = (): Project => ({
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
    ],
    startPageId: 'page01',
    nextPageNumber: 2,
  },
  activePageId: 'page01',
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

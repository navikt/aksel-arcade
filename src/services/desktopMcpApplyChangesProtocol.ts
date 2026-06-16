import type { ArcadePageId, ThemeMode, ViewportSize } from '@/types/project'

export interface DesktopMcpApplyChangesSourceResources {
  jsxResourceUri: string
  hooksResourceUri: string
}

export interface DesktopMcpApplyChangesTempPageRefMapping {
  pageId: ArcadePageId
  sourceResources: DesktopMcpApplyChangesSourceResources
}

interface DesktopMcpApplyChangesPageTarget {
  pageId?: ArcadePageId
  tempPageRef?: string
}

export type DesktopMcpApplyChangesOperation =
  | {
      type: 'replace_source'
      resourceUri: string
      content: string
    }
  | ({
      type: 'create_page'
      name?: string
      newPageRef?: string
      jsxCode?: string
      hooksCode?: string
    })
  | ({
      type: 'rename_page'
      name: string
    } & DesktopMcpApplyChangesPageTarget)
  | ({
      type: 'delete_page'
    } & DesktopMcpApplyChangesPageTarget)
  | ({
      type: 'set_start_page'
    } & DesktopMcpApplyChangesPageTarget)
  | ({
      type: 'select_active_page'
    } & DesktopMcpApplyChangesPageTarget)
  | {
      type: 'set_preview_context'
      viewportSize?: ViewportSize
      theme?: ThemeMode
    }
  | {
      type: 'rename_project'
      name: string
    }

export interface DesktopMcpApplyChangesRequest {
  summary: string
  expectedProjectRevision?: string
  operations: DesktopMcpApplyChangesOperation[]
}

export type DesktopMcpApplyChangesErrorCode =
  | 'project-unavailable'
  | 'stale-project-revision'
  | 'invalid-operation'
  | 'invalid-operation-target'
  | 'invalid-project-name'
  | 'payload-too-large'
  | 'persistence-failed'

export interface DesktopMcpLastActivity {
  toolName: 'apply_changes' | 'capture_preview_evidence'
  operationTypes?: string[]
  timestamp: string
}

export type DesktopMcpApplyChangesOperationResult =
  | {
      index: number
      type: 'replace_source'
      resourceUri: string
    }
  | {
      index: number
      type: 'create_page'
      pageId: ArcadePageId
      name: string
      newPageRef?: string
      sourceResources: DesktopMcpApplyChangesSourceResources
    }
  | {
      index: number
      type: 'rename_page'
      pageId: ArcadePageId
      name: string
    }
  | {
      index: number
      type: 'delete_page'
      pageId: ArcadePageId
    }
  | {
      index: number
      type: 'set_start_page'
      pageId: ArcadePageId
    }
  | {
      index: number
      type: 'select_active_page'
      pageId: ArcadePageId
    }
  | {
      index: number
      type: 'set_preview_context'
      viewportSize?: ViewportSize
      theme?: ThemeMode
    }
  | {
      index: number
      type: 'rename_project'
      name: string
    }

export interface DesktopMcpApplyChangesSuccess {
  ok: true
  summary: string
  projectRevision: string
  changedResources: string[]
  nextRecommendedResources: string[]
  operationResults: DesktopMcpApplyChangesOperationResult[]
  tempPageRefMappings?: Record<string, DesktopMcpApplyChangesTempPageRefMapping>
  safeActivity: DesktopMcpLastActivity
}

export interface DesktopMcpApplyChangesFailure {
  ok: false
  code: DesktopMcpApplyChangesErrorCode
  message: string
  manifestResourceUri?: string
  resourceUri?: string
  expectedProjectRevision?: string
  currentProjectRevision?: string
}

export type DesktopMcpApplyChangesResult =
  | DesktopMcpApplyChangesSuccess
  | DesktopMcpApplyChangesFailure

export type DesktopMcpApplyChangesHandler = (
  request: DesktopMcpApplyChangesRequest
) => DesktopMcpApplyChangesResult | Promise<DesktopMcpApplyChangesResult>

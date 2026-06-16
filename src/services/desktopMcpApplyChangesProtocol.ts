import type { ThemeMode, ViewportSize } from '@/types/project'

export type DesktopMcpApplyChangesOperation =
  | {
      type: 'replace_source'
      resourceUri: string
      content: string
    }
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

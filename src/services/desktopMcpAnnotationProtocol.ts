import type { ArcadeAnnotation } from '@/types/annotations'
import type { ArcadePageId } from '@/types/project'

export type DesktopMcpAnnotationMutationToolName =
  | 'acknowledge_annotation'
  | 'resolve_annotation'
  | 'dismiss_annotation'
  | 'reply_to_annotation'

export interface DesktopMcpAcknowledgeAnnotationRequest {
  toolName: 'acknowledge_annotation'
  annotationId: string
}

export interface DesktopMcpResolveAnnotationRequest {
  toolName: 'resolve_annotation'
  annotationId: string
  summary?: string
}

export interface DesktopMcpDismissAnnotationRequest {
  toolName: 'dismiss_annotation'
  annotationId: string
  reason: string
}

export interface DesktopMcpReplyToAnnotationRequest {
  toolName: 'reply_to_annotation'
  annotationId: string
  message: string
}

export type DesktopMcpAnnotationMutationRequest =
  | DesktopMcpAcknowledgeAnnotationRequest
  | DesktopMcpResolveAnnotationRequest
  | DesktopMcpDismissAnnotationRequest
  | DesktopMcpReplyToAnnotationRequest

export interface DesktopMcpAnnotationMutationSuccess {
  ok: true
  toolName: DesktopMcpAnnotationMutationToolName
  annotationId: string
  pageId: ArcadePageId
  message: string
  annotation: ArcadeAnnotation
  annotations: ArcadeAnnotation[]
}

export interface DesktopMcpAnnotationMutationFailure {
  ok: false
  code: 'annotation-not-found' | 'dead-target-annotation' | 'invalid-annotation-payload'
  annotationId: string
  message: string
}

export type DesktopMcpAnnotationMutationResult =
  | DesktopMcpAnnotationMutationSuccess
  | DesktopMcpAnnotationMutationFailure

export interface DesktopMcpWatchAnnotationsRequest {
  scope?: 'page' | 'project'
  pageId?: ArcadePageId
  waitTimeoutSeconds?: number
  batchWindowSeconds?: number
}

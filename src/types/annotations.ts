import type { ArcadePageId } from '@/types/project'

export type AnnotationIntent = 'fix' | 'change' | 'question' | 'approve'
export type AnnotationSeverity = 'blocking' | 'important' | 'suggestion'
export type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed'
export type AnnotationKind = 'feedback' | 'placement' | 'rearrange'
export type AnnotationAuthorRole = 'human' | 'agent'

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationTargetIdentity {
  signature: string
  tagName: string
  role?: string
  accessibleName?: string
  text?: string
  cssClasses?: string
  elementPath: string
  fullPath: string
}

export interface AnnotationThreadMessage {
  id: string
  role: AnnotationAuthorRole
  content: string
  timestamp: number
}

export interface AnnotationPlacement {
  componentType: string
  width: number
  height: number
  scrollY: number
  text?: string
}

export interface AnnotationRearrange {
  selector: string
  label: string
  tagName: string
  originalRect: AnnotationRect
  currentRect: AnnotationRect
}

export interface ArcadeAnnotation {
  id: string
  pageId: ArcadePageId
  x: number
  y: number
  comment: string
  element: string
  elementPath: string
  timestamp: number
  selectedText?: string
  clickOffsetX?: number
  clickOffsetY?: number
  targetIdentities?: AnnotationTargetIdentity[]
  boundingBox?: AnnotationRect
  nearbyText?: string
  cssClasses?: string
  nearbyElements?: string
  computedStyles?: string
  fullPath?: string
  accessibility?: string
  isMultiSelect?: boolean
  isFixed?: boolean
  reactComponents?: string
  sourceFile?: string
  drawingIndex?: number
  elementBoundingBoxes?: AnnotationRect[]
  kind?: AnnotationKind
  placement?: AnnotationPlacement
  rearrange?: AnnotationRearrange
  sessionId?: string
  url?: string
  intent?: AnnotationIntent
  severity?: AnnotationSeverity
  status?: AnnotationStatus
  thread?: AnnotationThreadMessage[]
  createdAt?: string
  updatedAt?: string
  resolvedAt?: string
  resolvedBy?: AnnotationAuthorRole
  authorId?: string
}

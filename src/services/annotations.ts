import type {
  AnnotationAuthorRole,
  AnnotationKind,
  AnnotationStatus,
  AnnotationThreadMessage,
  ArcadeAnnotation,
} from '@/types/annotations'
import type { ArcadePageId, Project } from '@/types/project'
import { generateSecureUUID } from '@/utils/crypto'

export const ANNOTATION_KINDS = [
  'feedback',
  'placement',
  'rearrange',
] as const satisfies readonly AnnotationKind[]
export const ANNOTATION_STATUSES = [
  'pending',
  'acknowledged',
  'resolved',
  'dismissed',
] as const satisfies readonly AnnotationStatus[]

export interface AnnotationTargetSnapshot {
  x: number
  y: number
  element: string
  elementPath: string
  boundingBox?: ArcadeAnnotation['boundingBox']
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
  elementBoundingBoxes?: ArcadeAnnotation['elementBoundingBoxes']
  selectedText?: string
}

export interface CreateAnnotationInput {
  pageId: ArcadePageId
  comment: string
  target: AnnotationTargetSnapshot
  now?: number
  nowIso?: string
}

export interface AnnotationFilterOptions {
  pageId?: ArcadePageId
  status?: AnnotationStatus | 'open' | 'all'
  includeNonFeedback?: boolean
  isDeadTarget?: (annotation: ArcadeAnnotation) => boolean
  isHiddenTarget?: (annotation: ArcadeAnnotation) => boolean
  targetVisibility?: 'all' | 'visible' | 'hidden'
}

export interface AnnotationCountOptions {
  pageId?: ArcadePageId
  includeNonFeedback?: boolean
  isDeadTarget?: (annotation: ArcadeAnnotation) => boolean
  isHiddenTarget?: (annotation: ArcadeAnnotation) => boolean
  targetVisibility?: 'all' | 'visible' | 'hidden'
}

export const createEmptyAnnotations = (): ArcadeAnnotation[] => []

export const cloneAnnotations = (annotations: readonly ArcadeAnnotation[]): ArcadeAnnotation[] =>
  annotations.map(cloneAnnotation)

export const createAnnotation = (input: CreateAnnotationInput): ArcadeAnnotation => {
  const createdAt = input.nowIso ?? new Date().toISOString()
  const timestamp = input.now ?? Date.now()

  return {
    id: generateSecureUUID(),
    pageId: input.pageId,
    ...copyTargetSnapshot(input.target),
    comment: input.comment,
    timestamp,
    kind: 'feedback',
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
  }
}

export const addAnnotation = (project: Project, input: CreateAnnotationInput): Project => ({
  ...project,
  annotations: [...project.annotations, createAnnotation(input)],
})

export const getAnnotationKind = (annotation: Pick<ArcadeAnnotation, 'kind'>): AnnotationKind =>
  annotation.kind ?? 'feedback'

export const isKnownAnnotationKind = (kind: unknown): kind is AnnotationKind =>
  typeof kind === 'string' && ANNOTATION_KINDS.includes(kind as AnnotationKind)

export const isKnownAnnotationStatus = (status: unknown): status is AnnotationStatus =>
  typeof status === 'string' && ANNOTATION_STATUSES.includes(status as AnnotationStatus)

export const isFeedbackAnnotation = (annotation: ArcadeAnnotation): boolean =>
  getAnnotationKind(annotation) === 'feedback'

export const isOpenAnnotationStatus = (status: ArcadeAnnotation['status']): boolean =>
  status === undefined || status === 'pending' || status === 'acknowledged'

export const filterAnnotations = (
  annotations: readonly ArcadeAnnotation[],
  options: AnnotationFilterOptions = {}
): ArcadeAnnotation[] =>
  annotations.filter((annotation) => {
    if (options.pageId && annotation.pageId !== options.pageId) {
      return false
    }

    if (!options.includeNonFeedback && !isFeedbackAnnotation(annotation)) {
      return false
    }

    if (options.isDeadTarget?.(annotation)) {
      return false
    }

    const targetVisibility = options.targetVisibility ?? 'all'
    if (targetVisibility !== 'all') {
      const isHiddenTarget = options.isHiddenTarget?.(annotation) ?? false
      if (targetVisibility === 'visible' && isHiddenTarget) {
        return false
      }
      if (targetVisibility === 'hidden' && !isHiddenTarget) {
        return false
      }
    }

    switch (options.status ?? 'all') {
      case 'all':
        return true
      case 'open':
        return isOpenAnnotationStatus(annotation.status)
      default:
        return annotation.status === options.status
    }
  })

export const getPageAnnotations = (
  annotations: readonly ArcadeAnnotation[],
  pageId: ArcadePageId,
  options: Omit<AnnotationFilterOptions, 'pageId'> = {}
): ArcadeAnnotation[] =>
  filterAnnotations(annotations, { ...options, pageId, status: options.status ?? 'all' })

export const getOpenAnnotations = (
  annotations: readonly ArcadeAnnotation[],
  options: AnnotationCountOptions = {}
): ArcadeAnnotation[] => filterAnnotations(annotations, { ...options, status: 'open' })

export const getPendingAnnotations = (
  annotations: readonly ArcadeAnnotation[],
  options: AnnotationCountOptions = {}
): ArcadeAnnotation[] => filterAnnotations(annotations, { ...options, status: 'pending' })

export const countOpenAnnotationsByPage = (
  annotations: readonly ArcadeAnnotation[],
  options: AnnotationCountOptions = {}
): Map<ArcadePageId, number> => countAnnotationsByPage(getOpenAnnotations(annotations, options))

export const countPendingAnnotationsByPage = (
  annotations: readonly ArcadeAnnotation[],
  options: AnnotationCountOptions = {}
): Map<ArcadePageId, number> => countAnnotationsByPage(getPendingAnnotations(annotations, options))

export const editAnnotationComment = (
  annotations: readonly ArcadeAnnotation[],
  annotationId: string,
  comment: string,
  options?: { nowIso?: string }
): ArcadeAnnotation[] =>
  updateAnnotation(annotations, annotationId, (annotation) => ({
    ...annotation,
    comment,
    status: annotation.status === 'acknowledged' ? 'pending' : annotation.status,
    updatedAt: options?.nowIso ?? new Date().toISOString(),
  }))

export const hardDeleteAnnotation = (
  annotations: readonly ArcadeAnnotation[],
  annotationId: string
): ArcadeAnnotation[] =>
  annotations.filter((annotation) => annotation.id !== annotationId).map(cloneAnnotation)

export const clearPageAnnotations = (
  annotations: readonly ArcadeAnnotation[],
  pageId: ArcadePageId
): ArcadeAnnotation[] =>
  annotations.filter((annotation) => annotation.pageId !== pageId).map(cloneAnnotation)

export const setAnnotationStatus = (
  annotations: readonly ArcadeAnnotation[],
  annotationId: string,
  status: AnnotationStatus,
  options?: { nowIso?: string; resolvedBy?: AnnotationAuthorRole }
): ArcadeAnnotation[] =>
  updateAnnotation(annotations, annotationId, (annotation) => {
    const nowIso = options?.nowIso ?? new Date().toISOString()
    return {
      ...annotation,
      status,
      updatedAt: nowIso,
      ...(status === 'resolved' || status === 'dismissed'
        ? { resolvedAt: nowIso, resolvedBy: options?.resolvedBy }
        : {}),
    }
  })

export const appendAnnotationThreadMessage = (
  annotations: readonly ArcadeAnnotation[],
  annotationId: string,
  message: Omit<AnnotationThreadMessage, 'id' | 'timestamp'> & {
    id?: string
    timestamp?: number
  },
  options?: { nowIso?: string }
): ArcadeAnnotation[] =>
  updateAnnotation(annotations, annotationId, (annotation) => ({
    ...annotation,
    thread: [
      ...(annotation.thread?.map((threadMessage) => ({ ...threadMessage })) ?? []),
      {
        id: message.id ?? generateSecureUUID(),
        role: message.role,
        content: message.content,
        timestamp: message.timestamp ?? Date.now(),
      },
    ],
    updatedAt: options?.nowIso ?? new Date().toISOString(),
  }))

const updateAnnotation = (
  annotations: readonly ArcadeAnnotation[],
  annotationId: string,
  update: (annotation: ArcadeAnnotation) => ArcadeAnnotation
): ArcadeAnnotation[] => {
  let didUpdate = false
  const updated = annotations.map((annotation) => {
    if (annotation.id !== annotationId) {
      return cloneAnnotation(annotation)
    }

    didUpdate = true
    return update(cloneAnnotation(annotation))
  })

  if (!didUpdate) {
    throw new Error(`Unknown annotation "${annotationId}"`)
  }

  return updated
}

const countAnnotationsByPage = (
  annotations: readonly ArcadeAnnotation[]
): Map<ArcadePageId, number> => {
  const counts = new Map<ArcadePageId, number>()
  for (const annotation of annotations) {
    counts.set(annotation.pageId, (counts.get(annotation.pageId) ?? 0) + 1)
  }
  return counts
}

const copyTargetSnapshot = (target: AnnotationTargetSnapshot): AnnotationTargetSnapshot => ({
  x: target.x,
  y: target.y,
  element: target.element,
  elementPath: target.elementPath,
  ...(target.boundingBox ? { boundingBox: { ...target.boundingBox } } : {}),
  ...(target.nearbyText !== undefined ? { nearbyText: target.nearbyText } : {}),
  ...(target.cssClasses !== undefined ? { cssClasses: target.cssClasses } : {}),
  ...(target.nearbyElements !== undefined ? { nearbyElements: target.nearbyElements } : {}),
  ...(target.computedStyles !== undefined ? { computedStyles: target.computedStyles } : {}),
  ...(target.fullPath !== undefined ? { fullPath: target.fullPath } : {}),
  ...(target.accessibility !== undefined ? { accessibility: target.accessibility } : {}),
  ...(target.isMultiSelect !== undefined ? { isMultiSelect: target.isMultiSelect } : {}),
  ...(target.isFixed !== undefined ? { isFixed: target.isFixed } : {}),
  ...(target.reactComponents !== undefined ? { reactComponents: target.reactComponents } : {}),
  ...(target.sourceFile !== undefined ? { sourceFile: target.sourceFile } : {}),
  ...(target.drawingIndex !== undefined ? { drawingIndex: target.drawingIndex } : {}),
  ...(target.elementBoundingBoxes
    ? { elementBoundingBoxes: target.elementBoundingBoxes.map((box) => ({ ...box })) }
    : {}),
  ...(target.selectedText !== undefined ? { selectedText: target.selectedText } : {}),
})

const cloneAnnotation = (annotation: ArcadeAnnotation): ArcadeAnnotation => ({
  ...annotation,
  ...(annotation.boundingBox ? { boundingBox: { ...annotation.boundingBox } } : {}),
  ...(annotation.elementBoundingBoxes
    ? { elementBoundingBoxes: annotation.elementBoundingBoxes.map((box) => ({ ...box })) }
    : {}),
  ...(annotation.placement ? { placement: { ...annotation.placement } } : {}),
  ...(annotation.rearrange
    ? {
        rearrange: {
          ...annotation.rearrange,
          originalRect: { ...annotation.rearrange.originalRect },
          currentRect: { ...annotation.rearrange.currentRect },
        },
      }
    : {}),
  ...(annotation.thread ? { thread: annotation.thread.map((message) => ({ ...message })) } : {}),
})

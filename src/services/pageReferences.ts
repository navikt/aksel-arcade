import type { ArcadePageId, ArcadeSourceFile, ProjectSource } from '@/types/project'
import { isArcadePageId } from '@/services/projectSource'

export type PageReferenceKind = 'goToPage' | 'href' | 'to'
export type PageReferenceStatus = 'valid' | 'stale'

export interface PageReference {
  targetPageId: ArcadePageId
  kind: PageReferenceKind
  status: PageReferenceStatus
  from: number
  to: number
  line: number
  column: number
}

export interface DeletePageImpact {
  referenceCount: number
  pageCount: number
  globalConfigReferenceCount: number
}

export interface ProjectPageReferenceAnalysis {
  brokenNavigationPageIds: ArcadePageId[]
  globalConfigStaleReferences: PageReference[]
  staleReferencesByPageId: Partial<Record<ArcadePageId, PageReference[]>>
}

const GO_TO_PAGE_REFERENCE_PATTERN = /\bgoToPage\s*\(\s*(['"`])(page\d+)\1\s*\)/g
const PAGE_ATTRIBUTE_REFERENCE_PATTERN =
  /\b(href|to)\s*=\s*(?:(['"`])(page\d+)\2|\{\s*(['"`])(page\d+)\4\s*\})/g

const getLineColumn = (source: string, offset: number): { line: number; column: number } => {
  const beforeOffset = source.slice(0, offset)
  const lineBreaks = beforeOffset.match(/\r\n|\r|\n/g) ?? []
  const lastLineBreak = Math.max(beforeOffset.lastIndexOf('\n'), beforeOffset.lastIndexOf('\r'))

  return {
    line: lineBreaks.length,
    column: lastLineBreak === -1 ? offset : offset - lastLineBreak - 1,
  }
}

const createPageReference = (
  code: string,
  validPageIds: ReadonlySet<ArcadePageId>,
  kind: PageReferenceKind,
  targetPageId: ArcadePageId,
  from: number,
  to: number
): PageReference => {
  const { line, column } = getLineColumn(code, from)

  return {
    targetPageId,
    kind,
    status: validPageIds.has(targetPageId) ? 'valid' : 'stale',
    from,
    to,
    line,
    column,
  }
}

const collectGoToPageReferences = (
  code: string,
  validPageIds: ReadonlySet<ArcadePageId>
): PageReference[] => {
  const references: PageReference[] = []

  for (const match of code.matchAll(GO_TO_PAGE_REFERENCE_PATTERN)) {
    const targetPageId = match[2]
    const fullMatch = match[0]
    const matchIndex = match.index
    if (matchIndex === undefined || !isArcadePageId(targetPageId)) {
      continue
    }

    const targetOffset = fullMatch.indexOf(targetPageId)
    const from = matchIndex + targetOffset
    references.push(
      createPageReference(code, validPageIds, 'goToPage', targetPageId, from, from + targetPageId.length)
    )
  }

  return references
}

const collectAttributeReferences = (
  code: string,
  validPageIds: ReadonlySet<ArcadePageId>
): PageReference[] => {
  const references: PageReference[] = []

  for (const match of code.matchAll(PAGE_ATTRIBUTE_REFERENCE_PATTERN)) {
    const kind = match[1]
    const targetPageId = match[3] ?? match[5]
    const fullMatch = match[0]
    const matchIndex = match.index
    if (
      matchIndex === undefined ||
      (kind !== 'href' && kind !== 'to') ||
      !isArcadePageId(targetPageId)
    ) {
      continue
    }

    const targetOffset = fullMatch.indexOf(targetPageId)
    const from = matchIndex + targetOffset
    references.push(
      createPageReference(code, validPageIds, kind, targetPageId, from, from + targetPageId.length)
    )
  }

  return references
}

const getSourceFilePageReferences = (
  sourceFile: ArcadeSourceFile,
  validPageIds: readonly ArcadePageId[]
): PageReference[] => {
  const validPageIdSet = new Set(validPageIds)

  return [sourceFile.jsx, sourceFile.hooks]
    .flatMap((code) => [
      ...collectGoToPageReferences(code, validPageIdSet),
      ...collectAttributeReferences(code, validPageIdSet),
    ])
    .sort((left, right) => left.from - right.from || left.to - right.to)
}

export const findPageReferences = (
  code: string,
  validPageIds: readonly ArcadePageId[]
): PageReference[] => {
  const validPageIdSet = new Set(validPageIds)

  return [...collectGoToPageReferences(code, validPageIdSet), ...collectAttributeReferences(code, validPageIdSet)].sort(
    (left, right) => left.from - right.from || left.to - right.to
  )
}

export const getStalePageReferences = (
  code: string,
  validPageIds: readonly ArcadePageId[]
): PageReference[] => findPageReferences(code, validPageIds).filter((reference) => reference.status === 'stale')

export const getStalePageReferenceMessage = (reference: Pick<PageReference, 'targetPageId'>): string =>
  `Page ${reference.targetPageId} no longer exists.`

export const analyzeProjectPageReferences = (
  source: ProjectSource
): ProjectPageReferenceAnalysis => {
  const validPageIds = source.pages.map((page) => page.id)
  const globalConfigStaleReferences = getSourceFilePageReferences(source.globalConfig, validPageIds).filter(
    (reference) => reference.status === 'stale'
  )
  const staleReferencesByPageId = source.pages.reduce<
    Partial<Record<ArcadePageId, PageReference[]>>
  >((result, page) => {
    const staleReferences = getSourceFilePageReferences(page.source, validPageIds).filter(
      (reference) => reference.status === 'stale'
    )

    result[page.id] = staleReferences
    return result
  }, {})
  const brokenNavigationPageIds = source.pages
    .filter(
      (page) =>
        globalConfigStaleReferences.length > 0 ||
        (staleReferencesByPageId[page.id]?.length ?? 0) > 0
    )
    .map((page) => page.id)

  return {
    brokenNavigationPageIds,
    globalConfigStaleReferences,
    staleReferencesByPageId,
  }
}

export const getDeletePageImpact = (
  source: ProjectSource,
  deletedPageId: ArcadePageId
): DeletePageImpact => {
  const validPageIds = source.pages.map((page) => page.id)
  const globalConfigReferenceCount = getSourceFilePageReferences(source.globalConfig, validPageIds).filter(
    (reference) => reference.targetPageId === deletedPageId
  ).length
  const impactedPageIds = new Set<ArcadePageId>()

  const pageReferenceCount = source.pages.reduce((count, page) => {
    if (page.id === deletedPageId) {
      return count
    }

    const pageReferences = getSourceFilePageReferences(page.source, validPageIds).filter(
      (reference) => reference.targetPageId === deletedPageId
    )
    if (pageReferences.length > 0) {
      impactedPageIds.add(page.id)
    }

    return count + pageReferences.length
  }, 0)

  return {
    referenceCount: globalConfigReferenceCount + pageReferenceCount,
    pageCount: impactedPageIds.size,
    globalConfigReferenceCount,
  }
}

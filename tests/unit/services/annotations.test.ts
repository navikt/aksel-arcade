import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ArcadeAnnotation } from '@/types/annotations'
import {
  appendAnnotationThreadMessage,
  clearPageAnnotations,
  countOpenAnnotationsByPage,
  countPendingAnnotationsByPage,
  createAnnotation,
  editAnnotationComment,
  filterAnnotations,
  getOpenAnnotations,
  getPendingAnnotations,
  hardDeleteAnnotation,
  setAnnotationStatus,
} from '@/services/annotations'

const target = {
  x: 50,
  y: 120,
  element: 'Button',
  elementPath: 'main > button:nth-child(1)',
  boundingBox: { x: 10, y: 20, width: 100, height: 40 },
  cssClasses: 'navds-button',
}

const annotation = (overrides: Partial<ArcadeAnnotation> = {}): ArcadeAnnotation => ({
  id: crypto.randomUUID(),
  pageId: 'page01',
  x: 10,
  y: 20,
  comment: 'Review this',
  element: 'Button',
  elementPath: 'main > button',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
  ...overrides,
})

describe('annotation lifecycle service', () => {
  it('creates feedback annotations with secure ids, pending status, timestamps, and no human author id', () => {
    const created = createAnnotation({
      pageId: 'page01',
      comment: 'Needs clearer copy',
      target,
      now: 1234,
      nowIso: '2026-07-01T08:10:00.000Z',
    })

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(created).toMatchObject({
      pageId: 'page01',
      comment: 'Needs clearer copy',
      x: 50,
      y: 120,
      element: 'Button',
      elementPath: 'main > button:nth-child(1)',
      kind: 'feedback',
      status: 'pending',
      timestamp: 1234,
      createdAt: '2026-07-01T08:10:00.000Z',
      updatedAt: '2026-07-01T08:10:00.000Z',
    })
    expect(created.authorId).toBeUndefined()
  })

  it('filters page-scoped, open, pending, dead-target, hidden-target, and non-feedback annotations for v0.3 workflows', () => {
    const annotations = [
      annotation({ id: crypto.randomUUID(), pageId: 'page01', status: 'pending' }),
      annotation({ id: crypto.randomUUID(), pageId: 'page01', status: 'acknowledged' }),
      annotation({ id: crypto.randomUUID(), pageId: 'page01', status: 'resolved' }),
      annotation({ id: crypto.randomUUID(), pageId: 'page02', status: 'pending' }),
      annotation({
        id: crypto.randomUUID(),
        pageId: 'page01',
        kind: 'placement',
        status: 'pending',
      }),
      annotation({
        id: crypto.randomUUID(),
        pageId: 'page01',
        status: 'pending',
        elementPath: 'dead',
      }),
      annotation({
        id: crypto.randomUUID(),
        pageId: 'page01',
        status: 'pending',
        elementPath: 'hidden',
      }),
    ]

    const isDeadTarget = (candidate: ArcadeAnnotation) => candidate.elementPath === 'dead'
    const isHiddenTarget = (candidate: ArcadeAnnotation) => candidate.elementPath === 'hidden'

    expect(getOpenAnnotations(annotations, { pageId: 'page01', isDeadTarget })).toHaveLength(3)
    expect(getPendingAnnotations(annotations, { pageId: 'page01', isDeadTarget })).toHaveLength(2)
    expect(
      filterAnnotations(annotations, { pageId: 'page01', status: 'all', isDeadTarget })
    ).toHaveLength(4)
    expect(
      filterAnnotations(annotations, {
        pageId: 'page01',
        status: 'pending',
        includeNonFeedback: true,
        isDeadTarget,
      })
    ).toHaveLength(3)
    expect(
      filterAnnotations(annotations, {
        pageId: 'page01',
        status: 'open',
        isDeadTarget,
        isHiddenTarget,
        targetVisibility: 'visible',
      })
    ).toHaveLength(2)
    expect(
      filterAnnotations(annotations, {
        pageId: 'page01',
        status: 'open',
        isDeadTarget,
        isHiddenTarget,
        targetVisibility: 'hidden',
      })
    ).toHaveLength(1)
  })

  it('counts open and pending annotations by page while excluding dead targets and non-feedback records', () => {
    const hiddenButResolved = annotation({
      pageId: 'page01',
      status: 'acknowledged',
      elementPath: 'hidden',
    })
    const annotations = [
      annotation({ pageId: 'page01', status: 'pending' }),
      hiddenButResolved,
      annotation({ pageId: 'page02', status: 'pending' }),
      annotation({ pageId: 'page01', status: 'resolved' }),
      annotation({ pageId: 'page01', kind: 'rearrange', status: 'pending' }),
      annotation({ pageId: 'page01', status: 'pending', elementPath: 'dead' }),
    ]

    const isDeadTarget = (candidate: ArcadeAnnotation) => candidate.elementPath === 'dead'
    const openCounts = countOpenAnnotationsByPage(annotations, { isDeadTarget })
    const pendingCounts = countPendingAnnotationsByPage(annotations, { isDeadTarget })

    expect(openCounts.get('page01')).toBe(2)
    expect(openCounts.get('page02')).toBe(1)
    expect(pendingCounts.get('page01')).toBe(1)
    expect(pendingCounts.get('page02')).toBe(1)
  })

  it('edits acknowledged annotations back to pending while preserving thread history', () => {
    const thread = [
      {
        id: crypto.randomUUID(),
        role: 'agent' as const,
        content: 'Acknowledged',
        timestamp: 10,
      },
    ]
    const acknowledged = annotation({ status: 'acknowledged', thread })

    const updated = editAnnotationComment([acknowledged], acknowledged.id, 'Updated text', {
      nowIso: '2026-07-01T09:00:00.000Z',
    })

    expect(updated[0]).toMatchObject({
      comment: 'Updated text',
      status: 'pending',
      updatedAt: '2026-07-01T09:00:00.000Z',
    })
    expect(updated[0].thread).toEqual(thread)
  })

  it('supports hard delete, page clear, status updates, and thread-compatible replies', () => {
    const first = annotation({ pageId: 'page01' })
    const second = annotation({ pageId: 'page02' })

    const withReply = appendAnnotationThreadMessage([first, second], first.id, {
      id: crypto.randomUUID(),
      role: 'agent',
      content: 'I can fix this.',
      timestamp: 42,
    })
    expect(withReply[0].thread).toEqual([
      expect.objectContaining({ role: 'agent', content: 'I can fix this.', timestamp: 42 }),
    ])

    const resolved = setAnnotationStatus(withReply, first.id, 'resolved', {
      nowIso: '2026-07-01T09:05:00.000Z',
      resolvedBy: 'agent',
    })
    expect(resolved[0]).toMatchObject({
      status: 'resolved',
      resolvedAt: '2026-07-01T09:05:00.000Z',
      resolvedBy: 'agent',
    })

    expect(hardDeleteAnnotation(resolved, first.id).map((item) => item.id)).toEqual([second.id])
    expect(clearPageAnnotations(resolved, 'page02').map((item) => item.id)).toEqual([first.id])
  })

  it('documents Agentation attribution in the README acknowledgments', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

    expect(readme).toContain('[Agentation](https://github.com/benjitaylor/agentation)')
  })
})

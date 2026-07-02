import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '@/utils/projectDefaults'
import {
  mutateDesktopMcpAnnotation,
  type DesktopMcpAnnotationMutationRequest,
} from '@/services/desktopMcpAnnotations'

const createProject = () => {
  const project = createDefaultProject()
  project.annotations = [
    {
      id: 'annotation-open',
      pageId: project.source.pages[0]?.id ?? 'page01',
      x: 10,
      y: 20,
      comment: 'Open note',
      element: 'Button',
      elementPath: 'button',
      timestamp: 1,
      kind: 'feedback',
      status: 'pending',
      createdAt: '2026-06-16T08:01:00.000Z',
      updatedAt: '2026-06-16T08:01:00.000Z',
    },
    {
      id: 'annotation-dead',
      pageId: project.source.pages[0]?.id ?? 'page01',
      x: 11,
      y: 21,
      comment: 'Dead note',
      element: 'Link',
      elementPath: 'link',
      timestamp: 2,
      kind: 'feedback',
      status: 'pending',
      createdAt: '2026-06-16T08:02:00.000Z',
      updatedAt: '2026-06-16T08:02:00.000Z',
    },
  ]
  return project
}

describe('desktopMcpAnnotations', () => {
  it('updates statuses and thread messages for annotation mutations', () => {
    const project = createProject()

    const acknowledgeResult = mutateDesktopMcpAnnotation(project, {
      toolName: 'acknowledge_annotation',
      annotationId: 'annotation-open',
    })
    expect(acknowledgeResult.ok).toBe(true)
    if (!acknowledgeResult.ok) {
      throw new Error(acknowledgeResult.message)
    }
    expect(acknowledgeResult.annotation.status).toBe('acknowledged')

    const replyResult = mutateDesktopMcpAnnotation(
      { ...project, annotations: acknowledgeResult.annotations },
      {
        toolName: 'reply_to_annotation',
        annotationId: 'annotation-open',
        message: 'Looks good',
      }
    )
    expect(replyResult.ok).toBe(true)
    if (!replyResult.ok) {
      throw new Error(replyResult.message)
    }
    expect(replyResult.annotation.thread).toEqual([
      expect.objectContaining({
        role: 'agent',
        content: 'Looks good',
      }),
    ])

    const resolveResult = mutateDesktopMcpAnnotation(
      { ...project, annotations: replyResult.annotations },
      {
        toolName: 'resolve_annotation',
        annotationId: 'annotation-open',
        summary: 'Fixed in source',
      }
    )
    expect(resolveResult.ok).toBe(true)
    if (!resolveResult.ok) {
      throw new Error(resolveResult.message)
    }
    expect(resolveResult.annotation.status).toBe('resolved')
    expect(resolveResult.annotation.resolvedBy).toBe('agent')
    expect(resolveResult.annotation.thread?.[1]).toMatchObject({
      role: 'agent',
      content: 'Fixed in source',
    })

    const dismissResult = mutateDesktopMcpAnnotation(
      { ...project, annotations: resolveResult.annotations },
      {
        toolName: 'dismiss_annotation',
        annotationId: 'annotation-open',
        reason: 'Not applicable',
      }
    )
    expect(dismissResult.ok).toBe(true)
    if (!dismissResult.ok) {
      throw new Error(dismissResult.message)
    }
    expect(dismissResult.annotation.status).toBe('dismissed')
    expect(dismissResult.annotation.resolvedBy).toBe('agent')
  })

  it('rejects dead-target annotations and invalid payloads', () => {
    const project = createProject()

    const deadResult = mutateDesktopMcpAnnotation(
      project,
      {
        toolName: 'reply_to_annotation',
        annotationId: 'annotation-dead',
        message: 'Nope',
      },
      {
        isDeadTarget: (annotation) => annotation.id === 'annotation-dead',
      }
    )
    expect(deadResult).toEqual({
      ok: false,
      code: 'dead-target-annotation',
      annotationId: 'annotation-dead',
      message:
        'Desktop MCP annotation "annotation-dead" cannot be changed because its target is dead.',
    })

    const invalidDismiss = mutateDesktopMcpAnnotation(project, {
      toolName: 'dismiss_annotation',
      annotationId: 'annotation-open',
      reason: '   ',
    } satisfies DesktopMcpAnnotationMutationRequest)
    expect(invalidDismiss).toEqual({
      ok: false,
      code: 'invalid-annotation-payload',
      annotationId: 'annotation-open',
      message: 'dismiss_annotation reason must be a non-empty string.',
    })
  })
})

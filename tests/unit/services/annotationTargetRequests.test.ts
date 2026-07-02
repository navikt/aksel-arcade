import { describe, expect, it } from 'vitest'
import type { ArcadeAnnotation } from '@/types/annotations'
import { buildAnnotationTargetResolutionRequest } from '@/services/annotationTargetRequests'

const annotation = (overrides: Partial<ArcadeAnnotation> = {}): ArcadeAnnotation => ({
  id: crypto.randomUUID(),
  pageId: 'page01',
  x: 50,
  y: 80,
  comment: 'Review this',
  element: 'button "Save changes"',
  elementPath: 'main > button:nth-of-type(1)',
  timestamp: 1,
  kind: 'feedback',
  status: 'pending',
  createdAt: '2026-07-02T10:00:00.000Z',
  updatedAt: '2026-07-02T10:00:00.000Z',
  accessibility: 'role=button name="Save changes"',
  fullPath: 'button:nth-of-type(1)',
  cssClasses: 'aksel-button',
  nearbyText: 'Save changes',
  ...overrides,
})

describe('annotation target resolution requests', () => {
  it('prefers stored target identities for multi-element annotations', () => {
    const request = buildAnnotationTargetResolutionRequest(
      annotation({
        isMultiSelect: true,
        targetIdentities: [
          {
            signature: 'first',
            tagName: 'button',
            role: 'button',
            accessibleName: 'Approve',
            text: 'Approve',
            cssClasses: 'aksel-button',
            elementPath: 'main > button:nth-of-type(1)',
            fullPath: 'button:nth-of-type(1)',
          },
          {
            signature: 'second',
            tagName: 'button',
            role: 'button',
            accessibleName: 'Reject',
            text: 'Reject',
            cssClasses: 'aksel-button',
            elementPath: 'main > button:nth-of-type(2)',
            fullPath: 'button:nth-of-type(2)',
          },
        ],
      })
    )

    expect(request).toEqual({
      mode: 'group',
      identities: [
        expect.objectContaining({ signature: 'first' }),
        expect.objectContaining({ signature: 'second' }),
      ],
    })
  })

  it('reconstructs a legacy single-target identity from saved annotation metadata', () => {
    const request = buildAnnotationTargetResolutionRequest(
      annotation({
        targetIdentities: undefined,
      })
    )

    expect(request).toMatchObject({
      mode: 'identity',
      identity: {
        tagName: 'button',
        role: 'button',
        accessibleName: 'Save changes',
        text: 'Save changes',
        cssClasses: 'aksel-button',
        elementPath: 'main > button:nth-of-type(1)',
        fullPath: 'button:nth-of-type(1)',
      },
    })
    expect(request?.mode === 'identity' && request.identity.signature.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  getAnnotationTargetIdentity,
  resolveAnnotationTargetAtPoint,
  resolveAnnotationTargetGroup,
  resolveAnnotationTargetIdentity,
  resolveAnnotationTargetsInRect,
  type AnnotationTargetIdentity,
  type AnnotationTargetRect,
} from '@/services/annotationTargets'

const setRect = (element: Element, rect: AnnotationTargetRect) => {
  const domRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  } as DOMRect

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(domRect)
}

const makeRoot = (html: string): HTMLElement => {
  document.body.innerHTML = `<div id="root">${html}</div>`
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
  return document.getElementById('root') as HTMLElement
}

describe('annotation target resolution', () => {
  it('normalizes hover and click points to the smallest meaningful target without mutating source', () => {
    const root = makeRoot('<button class="navds-button"><span>Lagre</span></button>')
    const button = root.querySelector('button') as HTMLButtonElement
    const span = root.querySelector('span') as HTMLSpanElement
    setRect(button, { x: 20, y: 30, width: 120, height: 40 })
    setRect(span, { x: 25, y: 35, width: 50, height: 20 })
    Object.defineProperty(document, 'elementFromPoint', {
      value: vi.fn(() => span),
      configurable: true,
    })

    const result = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 30, y: 40 }, window)

    expect(result.status).toBe('resolved')
    expect(result.target?.identity).toMatchObject({
      tagName: 'button',
      role: 'button',
      accessibleName: 'Lagre',
    })
    expect(result.target?.snapshot).toMatchObject({
      element: 'button "Lagre"',
      elementPath: 'button "Lagre"',
      cssClasses: 'navds-button',
    })
    expect(root.innerHTML).toBe('<button class="navds-button"><span>Lagre</span></button>')
  })

  it('captures selected text as metadata while anchoring to the containing normalized element', () => {
    const root = makeRoot('<article><p>Marker denne teksten for agenten.</p></article>')
    const paragraph = root.querySelector('p') as HTMLParagraphElement
    setRect(paragraph, { x: 10, y: 20, width: 240, height: 32 })

    const range = document.createRange()
    range.setStart(paragraph.firstChild as Text, 7)
    range.setEnd(paragraph.firstChild as Text, 19)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const result = resolveAnnotationTargetAtPoint(
      root,
      { mode: 'point', x: 20, y: 24, selectedText: 'denne teksten' },
      window
    )

    expect(result.status).toBe('resolved')
    expect(result.target?.identity.tagName).toBe('p')
    expect(result.target?.snapshot.selectedText).toBe('denne teksten')
  })

  it('treats zero and ambiguous identity matches as dead targets', () => {
    const originalRoot = makeRoot('<div><button>Save</button></div>')
    const original = originalRoot.querySelector('button') as HTMLButtonElement
    setRect(original, { x: 10, y: 10, width: 80, height: 32 })
    const identity = getAnnotationTargetIdentity(originalRoot, original, window)

    const missingRoot = makeRoot('<div><button>Cancel</button></div>')
    expect(resolveAnnotationTargetIdentity(missingRoot, identity, window)).toMatchObject({
      status: 'dead',
      reason: 'no-match',
      matchCount: 0,
    })

    const ambiguousRoot = makeRoot('<section><button>Save</button><button>Save</button></section>')
    ambiguousRoot.querySelectorAll('button').forEach((button, index) => {
      setRect(button, { x: 10 + index * 90, y: 10, width: 80, height: 32 })
    })

    expect(resolveAnnotationTargetIdentity(ambiguousRoot, identity, window)).toMatchObject({
      status: 'dead',
      reason: 'ambiguous-match',
      matchCount: 2,
    })
  })

  it('represents hidden-but-resolved targets separately from dead targets', () => {
    const root = makeRoot('<button>Continue</button>')
    const button = root.querySelector('button') as HTMLButtonElement
    setRect(button, { x: 10, y: 900, width: 120, height: 32 })
    const identity = getAnnotationTargetIdentity(root, button, window)

    const result = resolveAnnotationTargetIdentity(root, identity, window)

    expect(result.status).toBe('hidden')
    expect(result.target?.visibility).toBe('hidden')
    expect(result.target?.snapshot.boundingBox).toEqual({ x: 10, y: 900, width: 120, height: 32 })
  })

  it('resolves drag multi-select targets all at once and no-ops empty drags', () => {
    const root = makeRoot(`
      <section aria-label="Actions">
        <button>Approve</button>
        <button>Reject</button>
      </section>
    `)
    const [approve, reject] = Array.from(root.querySelectorAll('button'))
    setRect(root.querySelector('section') as HTMLElement, { x: 0, y: 0, width: 260, height: 80 })
    setRect(approve, { x: 10, y: 10, width: 100, height: 40 })
    setRect(reject, { x: 130, y: 10, width: 100, height: 40 })

    const result = resolveAnnotationTargetsInRect(
      root,
      { x: 0, y: 0, width: 260, height: 80 },
      window
    )

    expect(result.status).toBe('resolved')
    expect(result.targets).toHaveLength(2)
    expect(result.target?.snapshot).toMatchObject({
      isMultiSelect: true,
      elementBoundingBoxes: [
        { x: 10, y: 10, width: 100, height: 40 },
        { x: 130, y: 10, width: 100, height: 40 },
      ],
    })

    expect(
      resolveAnnotationTargetsInRect(root, { x: 500, y: 500, width: 20, height: 20 }, window)
    ).toMatchObject({
      status: 'no-target',
      reason: 'empty-selection',
    })
  })

  it('resolves multi-element identity groups all-or-nothing', () => {
    const root = makeRoot('<button>One</button><button>Two</button>')
    const buttons = Array.from(root.querySelectorAll('button'))
    buttons.forEach((button, index) =>
      setRect(button, { x: 10 + index * 90, y: 10, width: 80, height: 32 })
    )
    const identities = buttons.map((button) => getAnnotationTargetIdentity(root, button, window))

    const resolved = resolveAnnotationTargetGroup(root, identities, window)
    expect(resolved.status).toBe('resolved')
    expect(resolved.targets).toHaveLength(2)

    const partialRoot = makeRoot('<button>One</button>')
    const partialButton = partialRoot.querySelector('button') as HTMLButtonElement
    setRect(partialButton, { x: 10, y: 10, width: 80, height: 32 })

    expect(resolveAnnotationTargetGroup(partialRoot, identities as AnnotationTargetIdentity[], window)).toMatchObject({
      status: 'dead',
      reason: 'partial-group',
      matchCount: 1,
    })
  })
})

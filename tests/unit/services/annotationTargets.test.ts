import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { Box, Button, Checkbox, HStack, InlineMessage, TextField, VStack } from '@navikt/ds-react'
import {
  getAnnotationTargetIdentity,
  resolveAnnotationTargetAtPoint,
  resolveAnnotationTargetGroup,
  resolveAnnotationTargetIdentity,
  resolveAnnotationTargetsInRect,
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
  it('normalizes hover and click points to the closest annotatable target without mutating source', () => {
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

  it('captures selected text as metadata while anchoring to the containing preview element', () => {
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
      targetIdentities: [
        expect.objectContaining({ tagName: 'button', accessibleName: 'Approve' }),
        expect.objectContaining({ tagName: 'button', accessibleName: 'Reject' }),
      ],
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
    expect(resolved.target?.snapshot.targetIdentities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signature: identities[0].signature }),
        expect.objectContaining({ signature: identities[1].signature }),
      ])
    )

    const partialRoot = makeRoot('<button>One</button>')
    const partialButton = partialRoot.querySelector('button') as HTMLButtonElement
    setRect(partialButton, { x: 10, y: 10, width: 80, height: 32 })

    expect(resolveAnnotationTargetGroup(partialRoot, identities, window)).toMatchObject({
      status: 'dead',
      reason: 'partial-group',
      matchCount: 1,
    })
  })

  it('logs invalid selector paths before falling back to signature matching', () => {
    const root = makeRoot('<div><button>Save</button></div>')
    const button = root.querySelector('button') as HTMLButtonElement
    setRect(button, { x: 10, y: 10, width: 80, height: 32 })
    const identity = getAnnotationTargetIdentity(root, button, window)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = resolveAnnotationTargetIdentity(
      root,
      { ...identity, fullPath: 'button:nth-of-type(' },
      window
    )

    expect(result).toMatchObject({
      status: 'resolved',
      target: { identity: { signature: identity.signature } },
      matchCount: 1,
    })
    expect(warnSpy).toHaveBeenCalledWith('Invalid annotation target selector path:', {
      fullPath: 'button:nth-of-type(',
      message: expect.any(String),
    })

    warnSpy.mockRestore()
  })

  it('covers common Aksel component and layout DOM in the target matrix', () => {
    const { container } = render(
      React.createElement(
        Box,
        {
          as: 'div',
          padding: 'space-16',
          background: 'raised',
          borderRadius: '12',
          borderWidth: '1',
          borderColor: 'neutral-subtleA',
        },
        React.createElement(
          VStack,
          { as: 'div', gap: 'space-8' },
          React.createElement(
            HStack,
            { as: 'div', gap: 'space-4' },
            React.createElement(Button, null, 'Send'),
            React.createElement(TextField, { label: 'Navn' }),
            React.createElement(Checkbox, null, 'Godta')
          ),
          React.createElement(
            InlineMessage,
            { as: 'div', status: 'info' },
            React.createElement('strong', null, 'Quick tip:'),
            ' Delete this intro and start coding!'
          ),
          React.createElement(
            'ul',
            null,
            React.createElement('li', null, 'First item'),
            React.createElement('li', null, 'Second item')
          )
        )
      )
    )
    const root = container.firstElementChild as HTMLElement
    const vStack = root.querySelector('.aksel-vstack') as HTMLElement
    const hStack = root.querySelector('.aksel-hstack') as HTMLElement
    const button = root.querySelector('button') as HTMLButtonElement
    const textInput = root.querySelector('input[type="text"]') as HTMLInputElement
    const checkbox = root.querySelector('input[type="checkbox"]') as HTMLInputElement
    const inlineMessage = root.querySelector('.aksel-inline-message') as HTMLElement
    const inlineMessageIcon = root.querySelector('.aksel-inline-message__icon') as SVGElement | null
    const unorderedList = root.querySelector('ul') as HTMLUListElement

    setRect(root, { x: 0, y: 0, width: 520, height: 240 })
    setRect(vStack, { x: 16, y: 16, width: 488, height: 208 })
    setRect(hStack, { x: 16, y: 16, width: 420, height: 80 })
    setRect(button, { x: 32, y: 32, width: 80, height: 40 })
    setRect(textInput, { x: 132, y: 32, width: 160, height: 40 })
    setRect(checkbox, { x: 312, y: 42, width: 24, height: 24 })
    setRect(inlineMessage, { x: 16, y: 112, width: 420, height: 48 })
    if (inlineMessageIcon) {
      setRect(inlineMessageIcon, { x: 24, y: 124, width: 20, height: 20 })
    }
    setRect(unorderedList, { x: 16, y: 176, width: 220, height: 48 })

    Object.defineProperty(document, 'elementFromPoint', {
      value: vi.fn((x: number, y: number) => {
        if (x === 4 && y === 4) return root
        if (x === 20 && y === 96) return vStack
        if (x === 24 && y === 84) return hStack
        if (x === 30 && y === 130) return inlineMessageIcon ?? inlineMessage
        if (x === 24 && y === 124) return inlineMessage
        if (x === 24 && y === 184) return unorderedList
        return button
      }),
      configurable: true,
    })

    const buttonTarget = resolveAnnotationTargetIdentity(
      root,
      getAnnotationTargetIdentity(root, button, window),
      window
    )
    const textFieldTarget = resolveAnnotationTargetIdentity(
      root,
      getAnnotationTargetIdentity(root, textInput, window),
      window
    )
    const checkboxTarget = resolveAnnotationTargetIdentity(
      root,
      getAnnotationTargetIdentity(root, checkbox, window),
      window
    )
    const boxTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 4, y: 4 }, window)
    const vStackTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 20, y: 96 }, window)
    const hStackTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 24, y: 84 }, window)
    const inlineMessageTarget = resolveAnnotationTargetAtPoint(
      root,
      { mode: 'point', x: 24, y: 124 },
      window
    )
    const inlineMessageIconTarget = resolveAnnotationTargetAtPoint(
      root,
      { mode: 'point', x: 30, y: 130 },
      window
    )
    const listTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 24, y: 184 }, window)

    expect(buttonTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { role: 'button', accessibleName: 'Send' } },
    })
    expect(textFieldTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { role: 'textbox', accessibleName: 'Navn' } },
    })
    expect(checkboxTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { role: 'checkbox', accessibleName: 'Godta' } },
    })
    expect(boxTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: expect.stringContaining('aksel-box') } },
    })
    expect(vStackTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: expect.stringContaining('aksel-vstack') } },
    })
    expect(hStackTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: expect.stringContaining('aksel-hstack') } },
    })
    expect(inlineMessageTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: expect.stringContaining('aksel-inline-message') } },
    })
    expect(inlineMessageIconTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: expect.stringContaining('aksel-inline-message') } },
    })
    expect(listTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { tagName: 'ul' } },
    })
  })

  it('resolves arbitrary custom elements instead of requiring semantic or Aksel markup', () => {
    const root = makeRoot(`
      <div class="custom-card">
        <div class="custom-row"></div>
        <span class="custom-label">Custom label</span>
        <div class="hidden-custom" style="display: none">Hidden</div>
      </div>
    `)
    const card = root.querySelector('.custom-card') as HTMLDivElement
    const row = root.querySelector('.custom-row') as HTMLDivElement
    const label = root.querySelector('.custom-label') as HTMLSpanElement
    const hidden = root.querySelector('.hidden-custom') as HTMLDivElement

    setRect(card, { x: 0, y: 0, width: 260, height: 120 })
    setRect(row, { x: 16, y: 16, width: 228, height: 40 })
    setRect(label, { x: 16, y: 72, width: 120, height: 24 })
    setRect(hidden, { x: 16, y: 100, width: 120, height: 20 })

    Object.defineProperty(document, 'elementFromPoint', {
      value: vi.fn((x: number, y: number) => {
        if (x === 8 && y === 8) return card
        if (x === 20 && y === 20) return row
        if (x === 20 && y === 80) return label
        return null
      }),
      configurable: true,
    })

    const cardTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 8, y: 8 }, window)
    const rowTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 20, y: 20 }, window)
    const labelTarget = resolveAnnotationTargetAtPoint(root, { mode: 'point', x: 20, y: 80 }, window)
    const dragTarget = resolveAnnotationTargetsInRect(root, { x: 10, y: 10, width: 240, height: 54 }, window)
    const hiddenIdentity = getAnnotationTargetIdentity(root, hidden, window)

    expect(cardTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { tagName: 'div', cssClasses: 'custom-card' } },
    })
    expect(rowTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { tagName: 'div', cssClasses: 'custom-row' } },
    })
    expect(labelTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { tagName: 'span', cssClasses: 'custom-label' } },
    })
    expect(dragTarget).toMatchObject({
      status: 'resolved',
      target: { identity: { cssClasses: 'custom-row' } },
    })
    expect(resolveAnnotationTargetIdentity(root, hiddenIdentity, window)).toMatchObject({
      status: 'dead',
      reason: 'no-match',
    })
  })
})

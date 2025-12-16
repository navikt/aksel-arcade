import { describe, expect, it } from 'vitest'
// @ts-expect-error: overlay helpers are authored in public assets for sandbox runtime
import {
  clampRect,
  computeGapRects,
  computeSpacingOverlayRects,
  createOverlayElements,
  renderGapLayers,
  renderSpacingLayers,
} from '../../public/inspect-overlays.js'

describe('inspect overlays helpers', () => {
  it('computes spacing overlays within 1px of computed spacing', () => {
    const spacing = computeSpacingOverlayRects({
      boundingRect: {
        left: 100,
        top: 100,
        right: 320,
        bottom: 250,
        width: 220,
        height: 150,
      },
      margin: { top: 12, right: 8, bottom: 10, left: 6 },
      padding: { top: 16, right: 10, bottom: 14, left: 12 },
      viewport: { left: 0, top: 0, right: 800, bottom: 600 },
    })

    expect(spacing.marginRects.top?.width ?? 0).toBeCloseTo(220 + 6 + 8, 0)
    expect(spacing.marginRects.bottom?.height ?? 0).toBeCloseTo(10, 0)
    expect(spacing.paddingRects.left?.width ?? 0).toBeCloseTo(12, 0)
    expect(spacing.paddingRects.top?.height ?? 0).toBeCloseTo(16, 0)
    expect(spacing.contentRect?.width ?? 0).toBeCloseTo(220 - 12 - 10, 0)
  })

  it('computes flex gap overlays using actual gap size', () => {
    const gaps = computeGapRects({
      layoutType: 'flex',
      flexDirection: 'row',
      rowGap: 0,
      columnGap: 20,
      childrenRects: [
        { left: 10, top: 10, right: 60, bottom: 50, width: 50, height: 40 },
        { left: 80, top: 12, right: 120, bottom: 48, width: 40, height: 36 },
      ],
      containerRect: { left: 0, top: 0, right: 200, bottom: 80, width: 200, height: 80 },
      viewport: { left: 0, top: 0, right: 200, bottom: 80 },
    })

    expect(gaps).toHaveLength(1)
    expect(gaps[0].width).toBeCloseTo(20, 0)
    expect(gaps[0].height).toBeCloseTo(36, 0)
  })

  it('returns no gaps when gap is zero', () => {
    const gaps = computeGapRects({
      layoutType: 'flex',
      flexDirection: 'row',
      rowGap: 0,
      columnGap: 0,
      childrenRects: [
        { left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40 },
        { left: 50, top: 0, right: 90, bottom: 40, width: 40, height: 40 },
      ],
      containerRect: { left: 0, top: 0, right: 200, bottom: 80, width: 200, height: 80 },
      viewport: { left: 0, top: 0, right: 200, bottom: 80 },
    })

    expect(gaps).toHaveLength(0)
  })

  it('clips overlays to the viewport', () => {
    const clamped = clampRect({ left: -10, top: -10, width: 30, height: 30 }, {
      left: 0,
      top: 0,
      right: 20,
      bottom: 20,
    })

    expect(clamped?.left).toBe(0)
    expect(clamped?.top).toBe(0)
    expect(clamped?.width).toBeCloseTo(20, 0)
    expect(clamped?.height).toBeCloseTo(20, 0)
  })

  it('keeps overlay layers non-interactive', () => {
    const elements = createOverlayElements(document)
    const spacing = computeSpacingOverlayRects({
      boundingRect: {
        left: 5,
        top: 5,
        right: 45,
        bottom: 45,
        width: 40,
        height: 40,
      },
      margin: { top: 2, right: 2, bottom: 2, left: 2 },
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
      viewport: { left: 0, top: 0, right: 100, bottom: 100 },
    })

    renderSpacingLayers(elements, spacing)
    renderGapLayers(elements, [])

    expect(elements.root.style.pointerEvents).toBe('none')
    expect(elements.gapContainer.style.pointerEvents).toBe('none')

    elements.root.remove()
  })

  it('keeps overlays unchanged after clicks (hover is authoritative)', () => {
    const elements = createOverlayElements(document)
    const spacing = computeSpacingOverlayRects({
      boundingRect: {
        left: 10,
        top: 10,
        right: 50,
        bottom: 50,
        width: 40,
        height: 40,
      },
      margin: { top: 1, right: 1, bottom: 1, left: 1 },
      padding: { top: 2, right: 2, bottom: 2, left: 2 },
      viewport: { left: 0, top: 0, right: 100, bottom: 100 },
    })

    renderSpacingLayers(elements, spacing)
    const before = elements.content.style.cssText

    elements.root.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(elements.content.style.cssText).toBe(before)
    elements.root.remove()
  })
})

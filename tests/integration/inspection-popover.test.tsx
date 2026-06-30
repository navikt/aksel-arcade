import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InspectionPopover, POPOVER_FALLBACK_HEIGHT, POPOVER_WIDTH } from '@/components/Preview/InspectionPopover'
import type { InspectionData } from '@/types/inspection'

const baseBoundingRect = {
  left: 100,
  top: 100,
  right: 200,
  bottom: 200,
  width: 100,
  height: 100,
  x: 100,
  y: 100,
}

const baseSpacing = { top: 8, right: 8, bottom: 8, left: 8 }

const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight

const baseData: InspectionData = {
  componentName: 'Button',
  tagName: 'button',
  cssClass: 'aksel-button',
  props: { variant: 'primary' },
  color: 'rgb(0, 0, 0)',
  fontFamily: 'Inter',
  fontSize: '16px',
  margin: '8px',
  padding: '8px',
  marginValues: baseSpacing,
  paddingValues: baseSpacing,
  layoutType: 'flex',
  flexDirection: 'row',
  rowGap: 12,
  columnGap: 12,
  gap: '12px',
  gapApplicable: true,
  boundingRect: baseBoundingRect,
  cursorX: 120,
  cursorY: 120,
}

const createIframeRef = (overrides: Partial<DOMRect> = {}) => {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)

  const width = overrides.width ?? 500
  const height = overrides.height ?? 500
  const left = overrides.left ?? 0
  const top = overrides.top ?? 0
  const right = overrides.right ?? left + width
  const bottom = overrides.bottom ?? top + height

  iframe.getBoundingClientRect = () => ({
    left,
    top,
    right,
    bottom,
    width,
    height,
    x: left,
    y: top,
  }) as DOMRect

  return { current: iframe }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true })
})

describe('InspectionPopover gap display', () => {
  it('renders defined gap value', () => {
    const iframeRef = createIframeRef()
    render(<InspectionPopover data={baseData} iframeRef={iframeRef} isVisible />)

    const gapRow = screen.getByText('Gap:').parentElement
    expect(gapRow?.textContent).toContain('12px')
  })

  it('shows zero gap when spacing is zero', () => {
    const iframeRef = createIframeRef()
    render(
      <InspectionPopover
        data={{ ...baseData, rowGap: 0, columnGap: 0, gap: '0px' }}
        iframeRef={iframeRef}
        isVisible
      />
    )

    const gapRow = screen.getByText('Gap:').parentElement
    expect(gapRow?.textContent).toContain('0')
  })

  it('shows n/a when gap is not applicable', () => {
    const iframeRef = createIframeRef()
    render(
      <InspectionPopover
        data={{ ...baseData, layoutType: 'block', gapApplicable: false, rowGap: 0, columnGap: 0, gap: null }}
        iframeRef={iframeRef}
        isVisible
      />
    )

    const gapRow = screen.getByText('Gap:').parentElement
    expect(gapRow?.textContent?.toLowerCase()).toContain('n/a')
  })
})

describe('InspectionPopover positioning', () => {
  it('keeps the popover inside the viewport when the element is near the bottom', () => {
    Object.defineProperty(window, 'innerHeight', { value: 320, writable: true })
    const iframeRef = createIframeRef({ height: 320, bottom: 320 })

    render(
      <InspectionPopover
        data={{
          ...baseData,
          boundingRect: { ...baseBoundingRect, top: 260, bottom: 300, height: 40, y: 260 },
        }}
        iframeRef={iframeRef}
        isVisible
      />
    )

    const popover = screen.getByTestId('inspection-popover')
    const top = parseFloat(popover.style.top)

    expect(top).toBeGreaterThanOrEqual(8)
    expect(top + POPOVER_FALLBACK_HEIGHT).toBeLessThanOrEqual(320 - 8)
  })

  it('clamps horizontally when the element is near the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 320, writable: true })
    const iframeRef = createIframeRef({ width: 320, right: 320 })

    render(
      <InspectionPopover
        data={{
          ...baseData,
          boundingRect: {
            ...baseBoundingRect,
            left: 260,
            right: 300,
            width: 40,
            x: 260,
          },
        }}
        iframeRef={iframeRef}
        isVisible
      />
    )

    const popover = screen.getByTestId('inspection-popover')
    const left = parseFloat(popover.style.left)

    expect(left).toBeGreaterThanOrEqual(8)
    expect(left + POPOVER_WIDTH).toBeLessThanOrEqual(320 - 8)
  })
})

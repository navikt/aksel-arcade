import { useLayoutEffect, useRef, useState } from 'react'
import type { InspectionData } from '@/types/inspection'
import './InspectionPopover.css'

export const POPOVER_WIDTH = 300
export const POPOVER_FALLBACK_HEIGHT = 260
const VIEWPORT_MARGIN = 8
const ELEMENT_GAP = 8

interface InspectionPopoverProps {
  data: InspectionData
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  isVisible: boolean
}

export const InspectionPopover = ({ data, iframeRef, isVisible }: InspectionPopoverProps) => {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!isVisible) {
      setPosition(null)
      return
    }

    const calculatePosition = () => {
      if (!iframeRef.current || !popoverRef.current) return null

      const iframeRect = iframeRef.current.getBoundingClientRect()
      const elementRect = data.boundingRect
      const intrinsicIframeWidth = iframeRef.current.offsetWidth || iframeRect.width || 1
      const intrinsicIframeHeight = iframeRef.current.offsetHeight || iframeRect.height || 1
      const scaleX = intrinsicIframeWidth > 0 ? iframeRect.width / intrinsicIframeWidth : 1
      const scaleY = intrinsicIframeHeight > 0 ? iframeRect.height / intrinsicIframeHeight : 1
      const elementInWindow = {
        left: iframeRect.left + elementRect.left * scaleX,
        right: iframeRect.left + elementRect.right * scaleX,
        top: iframeRect.top + elementRect.top * scaleY,
        bottom: iframeRect.top + elementRect.bottom * scaleY,
        width: elementRect.width * scaleX,
        height: elementRect.height * scaleY,
      }

      const popoverRect = popoverRef.current.getBoundingClientRect()
      const popoverWidth = popoverRect.width || POPOVER_WIDTH
      const popoverHeight = popoverRect.height || POPOVER_FALLBACK_HEIGHT

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const elementCenter = elementInWindow.left + elementInWindow.width / 2
      const minLeft = Math.max(iframeRect.left + VIEWPORT_MARGIN, VIEWPORT_MARGIN)
      const maxLeftCandidateIframe = iframeRect.right - popoverWidth - VIEWPORT_MARGIN
      const maxLeftCandidateViewport = viewportWidth - popoverWidth - VIEWPORT_MARGIN
      const maxLeft = Math.max(minLeft, Math.min(maxLeftCandidateIframe, maxLeftCandidateViewport))
      const centeredLeft = elementCenter - popoverWidth / 2
      const left = Math.min(Math.max(centeredLeft, minLeft), maxLeft)

      const spaceBelow = viewportHeight - elementInWindow.bottom - VIEWPORT_MARGIN
      const spaceAbove = elementInWindow.top - VIEWPORT_MARGIN
      const preferBelow = spaceBelow >= popoverHeight + ELEMENT_GAP || spaceBelow >= spaceAbove

      const preferredTop = preferBelow
        ? elementInWindow.bottom + ELEMENT_GAP
        : elementInWindow.top - popoverHeight - ELEMENT_GAP

      const minTop = Math.max(iframeRect.top + VIEWPORT_MARGIN, VIEWPORT_MARGIN)
      const maxTopCandidateIframe = iframeRect.bottom - popoverHeight - VIEWPORT_MARGIN
      const maxTopCandidateViewport = viewportHeight - popoverHeight - VIEWPORT_MARGIN
      const maxTop = Math.max(minTop, Math.min(maxTopCandidateIframe, maxTopCandidateViewport))

      const top = Math.min(Math.max(preferredTop, minTop), maxTop)

      return { left, top }
    }

    const nextPosition = calculatePosition()
    if (nextPosition) {
      setPosition(nextPosition)
    }

    const handleResize = () => {
      const updatedPosition = calculatePosition()
      if (updatedPosition) {
        setPosition(updatedPosition)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [data, iframeRef, isVisible])

  if (!isVisible || !iframeRef.current) return null

  const gapLabel = (() => {
    if (!data.gapApplicable) return 'n/a'

    const rowGap = Number.isFinite(data.rowGap) ? data.rowGap : 0
    const columnGap = Number.isFinite(data.columnGap) ? data.columnGap : 0
    const hasRow = rowGap > 0
    const hasColumn = columnGap > 0

    if (!hasRow && !hasColumn) return '0'

    if (hasRow && hasColumn && Math.abs(rowGap - columnGap) > 0.5) {
      return `${rowGap}px ${columnGap}px`
    }

    const numericGap = hasRow ? rowGap : columnGap
    if (numericGap > 0) return `${numericGap}px`

    return data.gap ?? '0'
  })()

  return (
    <div
      className="inspection-popover"
      ref={popoverRef}
      style={{
        left: `${position?.left ?? -9999}px`,
        top: `${position?.top ?? -9999}px`,
        visibility: position ? 'visible' : 'hidden',
      }}
      data-testid="inspection-popover"
    >
      <div className="inspection-popover__header">
        <span className="inspection-popover__component-name">{data.componentName}</span>
        <span className="inspection-popover__tag-name">&lt;{data.tagName}&gt;</span>
      </div>

      {data.cssClass && (
        <div className="inspection-popover__section">
          <div className="inspection-popover__label">CSS Class</div>
          <div className="inspection-popover__value inspection-popover__value--mono">
            {data.cssClass}
          </div>
        </div>
      )}

      {data.props && Object.keys(data.props).length > 0 && (
        <div className="inspection-popover__section">
          <div className="inspection-popover__label">Props</div>
          <div className="inspection-popover__props">
            {Object.entries(data.props).map(([key, value]) => (
              <div key={key} className="inspection-popover__prop">
                <span className="inspection-popover__prop-key">{key}:</span>
                <span className="inspection-popover__prop-value">
                  {typeof value === 'string' ? `"${value}"` : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="inspection-popover__section">
        <div className="inspection-popover__label">Computed Styles</div>
        <div className="inspection-popover__styles">
          <div className="inspection-popover__style-row">
            <span className="inspection-popover__style-key">Color:</span>
            <span className="inspection-popover__style-value">
              <span className="inspection-popover__color-swatch" style={{ backgroundColor: data.color }} />
              {data.color}
            </span>
          </div>
          <div className="inspection-popover__style-row">
            <span className="inspection-popover__style-key">Font:</span>
            <span className="inspection-popover__style-value">{data.fontSize} {data.fontFamily}</span>
          </div>
          <div className="inspection-popover__style-row">
            <span className="inspection-popover__style-key">Margin:</span>
            <span className="inspection-popover__style-value">{data.margin}</span>
          </div>
          <div className="inspection-popover__style-row">
            <span className="inspection-popover__style-key">Padding:</span>
            <span className="inspection-popover__style-value">{data.padding}</span>
          </div>
          <div className="inspection-popover__style-row">
            <span className="inspection-popover__style-key">Gap:</span>
            <span className="inspection-popover__style-value">{gapLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

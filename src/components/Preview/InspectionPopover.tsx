import type { InspectionData } from '@/types/inspection'
import './InspectionPopover.css'

interface InspectionPopoverProps {
  data: InspectionData
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  isVisible: boolean
}

export const InspectionPopover = ({ data, iframeRef, isVisible }: InspectionPopoverProps) => {
  if (!isVisible || !iframeRef.current) return null

  // Get iframe position in the main window
  const iframeRect = iframeRef.current.getBoundingClientRect()
  
  // Get element's position (convert from iframe-relative to window coordinates)
  const elementRect = data.boundingRect
  const elementInWindow = {
    left: iframeRect.left + elementRect.left,
    right: iframeRect.left + elementRect.right,
    top: iframeRect.top + elementRect.top,
    bottom: iframeRect.top + elementRect.bottom,
    width: elementRect.width,
    height: elementRect.height,
  }
  
  // Popover dimensions
  const popoverWidth = 300
  const gap = 8 // Gap between element and popover
  const estimatedPopoverHeight = 250 // Estimated height (no max-height, let it flow)
  
  // Calculate vertical position (prefer below, but use above if not enough space)
  const spaceBelow = iframeRect.bottom - elementInWindow.bottom
  const spaceAbove = elementInWindow.top - iframeRect.top
  
  let top: number
  if (spaceBelow >= estimatedPopoverHeight || spaceBelow >= spaceAbove) {
    // Position below element
    top = elementInWindow.bottom + gap
  } else {
    // Position above element
    top = elementInWindow.top - estimatedPopoverHeight - gap
  }
  
  // Calculate horizontal position (center on element, but stay within iframe bounds)
  const elementCenter = elementInWindow.left + elementInWindow.width / 2
  let left = elementCenter - popoverWidth / 2
  
  // Ensure popover stays within iframe horizontal bounds
  if (left < iframeRect.left + 8) {
    left = iframeRect.left + 8
  } else if (left + popoverWidth > iframeRect.right - 8) {
    left = iframeRect.right - popoverWidth - 8
  }
  
  // Ensure popover stays within iframe vertical bounds
  if (top < iframeRect.top + 8) {
    top = iframeRect.top + 8
  } else if (top + estimatedPopoverHeight > iframeRect.bottom - 8) {
    top = Math.max(iframeRect.top + 8, iframeRect.bottom - estimatedPopoverHeight - 8)
  }

  return (
    <div
      className="inspection-popover"
      style={{
        left: `${left}px`,
        top: `${top}px`,
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
        </div>
      </div>
    </div>
  )
}

import { type ReactNode } from 'react'
import './SplitPane.css'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  minRightWidth?: number
}

export const SplitPane = ({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 300,
  minRightWidth = 320,
}: SplitPaneProps) => {
  // For now, using a simple fixed split - will add resize functionality in Phase 3
  const leftWidth = Math.max(minLeftWidth, (window.innerWidth * defaultLeftWidth) / 100)

  return (
    <div className="split-pane">
      <div className="split-pane__left" style={{ width: `${leftWidth}px`, minWidth: `${minLeftWidth}px` }}>
        {left}
      </div>
      <div className="split-pane__divider" />
      <div className="split-pane__right" style={{ minWidth: `${minRightWidth}px` }}>
        {right}
      </div>
    </div>
  )
}

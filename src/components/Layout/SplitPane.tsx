import { type ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
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
  // Convert pixel sizes to percentages for react-resizable-panels
  // Note: This is approximate - the library handles responsive resizing internally
  const defaultLeftPercent = defaultLeftWidth
  
  // Calculate min sizes as percentages (approximate, based on typical viewport)
  const minLeftPercent = (minLeftWidth / window.innerWidth) * 100
  const minRightPercent = (minRightWidth / window.innerWidth) * 100

  return (
    <PanelGroup direction="horizontal" className="split-pane">
      <Panel 
        defaultSize={defaultLeftPercent} 
        minSize={minLeftPercent}
        className="split-pane__left"
      >
        {left}
      </Panel>
      <PanelResizeHandle className="split-pane__divider" />
      <Panel 
        minSize={minRightPercent}
        className="split-pane__right"
      >
        {right}
      </Panel>
    </PanelGroup>
  )
}

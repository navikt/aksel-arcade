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
  minLeftWidth = 20,
  minRightWidth = 20,
}: SplitPaneProps) => {
  return (
    <PanelGroup direction="horizontal" className="split-pane">
      <Panel 
        defaultSize={defaultLeftWidth} 
        minSize={minLeftWidth}
        className="split-pane__left"
      >
        {left}
      </Panel>
      <PanelResizeHandle className="split-pane__divider" />
      <Panel 
        minSize={minRightWidth}
        className="split-pane__right"
      >
        {right}
      </Panel>
    </PanelGroup>
  )
}

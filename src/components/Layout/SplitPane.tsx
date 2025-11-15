import { type ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useSettings } from '@/contexts/SettingsContext'
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
  const { panelOrder } = useSettings()
  
  // Swap panels based on panelOrder setting
  const firstPanel = panelOrder === 'code-left' ? left : right
  const secondPanel = panelOrder === 'code-left' ? right : left
  
  return (
    <PanelGroup direction="horizontal" className="split-pane">
      <Panel 
        defaultSize={defaultLeftWidth} 
        minSize={minLeftWidth}
        className="split-pane__left"
      >
        {firstPanel}
      </Panel>
      <PanelResizeHandle className="split-pane__divider" />
      <Panel 
        minSize={minRightWidth}
        className="split-pane__right"
      >
        {secondPanel}
      </Panel>
    </PanelGroup>
  )
}

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
  const { panelOrder, previewFullscreen } = useSettings()

  // Swap panels based on panelOrder setting
  const firstPanel = panelOrder === 'code-left' ? left : right
  const secondPanel = panelOrder === 'code-left' ? right : left
  const firstPanelRole = panelOrder === 'code-left' ? 'editor' : 'preview'
  const secondPanelRole = panelOrder === 'code-left' ? 'preview' : 'editor'

  return (
    <PanelGroup
      direction="horizontal"
      className={previewFullscreen ? 'split-pane split-pane--preview-fullscreen' : 'split-pane'}
    >
      <Panel
        defaultSize={defaultLeftWidth}
        minSize={minLeftWidth}
        className={`split-pane__left split-pane__panel split-pane__panel--${firstPanelRole}${
          previewFullscreen && firstPanelRole === 'editor' ? ' split-pane__panel--hidden' : ''
        }`}
        data-pane-role={firstPanelRole}
        aria-hidden={previewFullscreen && firstPanelRole === 'editor'}
      >
        {firstPanel}
      </Panel>
      <PanelResizeHandle className="split-pane__divider" />
      <Panel
        minSize={minRightWidth}
        className={`split-pane__right split-pane__panel split-pane__panel--${secondPanelRole}${
          previewFullscreen && secondPanelRole === 'editor' ? ' split-pane__panel--hidden' : ''
        }`}
        data-pane-role={secondPanelRole}
        aria-hidden={previewFullscreen && secondPanelRole === 'editor'}
      >
        {secondPanel}
      </Panel>
    </PanelGroup>
  )
}

import { Tabs } from '@navikt/ds-react'
import type { EditorTab } from '@/types/editor'
import './EditorTabs.css'

interface EditorTabsProps {
  activeTab: EditorTab
  onTabChange: (tab: EditorTab) => void
}

export const EditorTabs = ({ activeTab, onTabChange }: EditorTabsProps) => {
  return (
    <div className="editor-tabs">
      <Tabs value={activeTab} onChange={(value) => onTabChange(value as EditorTab)}>
        <Tabs.List>
          <Tabs.Tab value="JSX" label="JSX" />
          <Tabs.Tab value="Hooks" label="Hooks" />
        </Tabs.List>
      </Tabs>
    </div>
  )
}

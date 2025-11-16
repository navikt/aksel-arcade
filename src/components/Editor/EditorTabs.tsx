import { ToggleGroup } from '@navikt/ds-react'
import type { EditorTab } from '@/types/editor'
import './EditorTabs.css'

interface EditorTabsProps {
  activeTab: EditorTab
  onTabChange: (tab: EditorTab) => void
}

export const EditorTabs = ({ activeTab, onTabChange }: EditorTabsProps) => {
  return (
    <ToggleGroup 
      size="small" 
      value={activeTab} 
      onChange={(value) => onTabChange(value as EditorTab)}
      variant="neutral"
    >
      <ToggleGroup.Item value="JSX">JSX</ToggleGroup.Item>
      <ToggleGroup.Item value="Hooks">Hooks</ToggleGroup.Item>
    </ToggleGroup>
  )
}

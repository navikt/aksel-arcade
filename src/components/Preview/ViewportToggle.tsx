import { useContext } from 'react'
import { ToggleGroup } from '@navikt/ds-react'
import { AppContext } from '@/hooks/useProject'
import { VIEWPORTS } from '@/types/viewports'
import type { ViewportSize } from '@/types/project'
import './ViewportToggle.css'

export const ViewportToggle = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('ViewportToggle must be used within AppProvider')

  const { project, updateProject } = context

  const handleViewportChange = (value: string) => {
    updateProject({ viewportSize: value as ViewportSize })
  }

  return (
    <ToggleGroup 
      size="small" 
      value={project.viewportSize} 
      onChange={handleViewportChange}
      variant="neutral"
    >
      {VIEWPORTS.map((viewport) => (
        <ToggleGroup.Item 
          key={viewport.id} 
          value={viewport.id}
          aria-label={`${viewport.name} (${viewport.width}px)`}
        >
          {viewport.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  )
}

import { useContext } from 'react'
import { ToggleGroup } from '@navikt/ds-react'
import { AppContext } from '@/hooks/useProject'
import { VIEWPORTS } from '@/types/viewports'
import type { ViewportSize } from '@/types/project'

interface ViewportToggleProps {
  fill?: boolean
}

export const ViewportToggle = ({ fill = false }: ViewportToggleProps) => {
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
      fill={fill}
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

import { useContext } from 'react'
import { AppContext } from '@/hooks/useProject'
import { VIEWPORTS } from '@/types/viewports'
import type { ViewportSize } from '@/types/project'
import './ViewportToggle.css'

export const ViewportToggle = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('ViewportToggle must be used within AppProvider')

  const { project, updateProject } = context

  const handleViewportChange = (viewportId: ViewportSize) => {
    updateProject({ viewportSize: viewportId })
  }

  return (
    <div className="viewport-toggle" role="group" aria-label="Viewport size selector">
      {VIEWPORTS.map((viewport) => (
        <button
          key={viewport.id}
          type="button"
          className={`viewport-toggle__button ${
            project.viewportSize === viewport.id ? 'viewport-toggle__button--active' : ''
          }`}
          onClick={() => handleViewportChange(viewport.id)}
          aria-label={`${viewport.name} (${viewport.width}px)`}
          aria-pressed={project.viewportSize === viewport.id}
          title={`${viewport.name} (${viewport.width}px)`}
        >
          {viewport.label}
        </button>
      ))}
    </div>
  )
}

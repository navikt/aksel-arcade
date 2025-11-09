import { Heading, TextField } from '@navikt/ds-react'
import { ProjectControls } from './ProjectControls'
import { ProjectSizeIndicator } from './ProjectSizeIndicator'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import type { Project } from '@/types/project'
import type { SaveStatus } from '@/hooks/useAutoSave'
import './AppHeader.css'

interface AppHeaderProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  currentProject: Project
  onProjectImported: (project: Project) => void
  saveStatus: SaveStatus
  projectSizeBytes: number
}

export const AppHeader = ({
  projectName,
  onProjectNameChange,
  currentProject,
  onProjectImported,
  saveStatus,
  projectSizeBytes,
}: AppHeaderProps) => {
  const MAX_PROJECT_SIZE = 5 * 1024 * 1024 // 5MB

  return (
    <header className="app-header">
      <Heading size="large" level="1" className="app-header__logo">
        Aksel Arcade
      </Heading>
      
      <TextField
        label="Project name"
        hideLabel
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
        className="app-header__project-name"
        size="small"
      />

      <div className="app-header__controls">
        <ProjectSizeIndicator sizeBytes={projectSizeBytes} maxSizeBytes={MAX_PROJECT_SIZE} />
        <SaveStatusIndicator status={saveStatus} />
        <ProjectControls
          currentProject={currentProject}
          onProjectImported={onProjectImported}
          hasUnsavedChanges={saveStatus === 'saving' || saveStatus === 'idle'}
        />
      </div>
    </header>
  )
}

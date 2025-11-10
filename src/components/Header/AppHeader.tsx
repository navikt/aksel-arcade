import { Heading, Detail, Button } from '@navikt/ds-react'
import { PencilIcon } from '@navikt/aksel-icons'
import { ProjectControls } from './ProjectControls'
import { ProjectSizeIndicator } from './ProjectSizeIndicator'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import type { Project } from '@/types/project'
import type { SaveStatus } from '@/hooks/useAutoSave'
import './AppHeader.css'

// Aksel Logo Mark SVG from Figma - 24x24px
const AkselLogoMark = () => (
  <img src="/aksel-logo.svg" alt="Aksel" width="24" height="24" />
)

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
      <div className="app-header__left">
        <div className="app-header__title-wrapper">
          <AkselLogoMark />
          <Heading size="medium" level="1" className="app-header__title">
            Aksel Arcade
          </Heading>
        </div>
        
        <div className="app-header__project-name-wrapper">
          <Detail>{projectName || 'Skriv navn...'}</Detail>
          <Button
            size="xsmall"
            variant="tertiary-neutral"
            icon={<PencilIcon title="Edit project name" fontSize="1.04rem" />}
            onClick={() => {
              const newName = prompt('Project name:', projectName)
              if (newName) onProjectNameChange(newName)
            }}
            aria-label="Edit project name"
          />
        </div>
      </div>

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

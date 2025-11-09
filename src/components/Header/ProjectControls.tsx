import { useRef } from 'react'
import { Button } from '@navikt/ds-react'
import { UploadIcon, DownloadIcon } from '@navikt/aksel-icons'
import type { Project } from '@/types/project'
import { exportProject, importProject } from '@/services/storage'
import './ProjectControls.css'

interface ProjectControlsProps {
  currentProject: Project
  onProjectImported: (project: Project) => void
  hasUnsavedChanges?: boolean
}

export const ProjectControls = ({
  currentProject,
  onProjectImported,
  hasUnsavedChanges = false,
}: ProjectControlsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // T091: Export button handler
  const handleExport = () => {
    exportProject(currentProject)
    console.log('✅ Project exported:', currentProject.name)
  }

  // T092: Import button handler
  const handleImportClick = () => {
    // T093: Show confirmation if unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Importing a project will replace your current work. Continue?'
      )
      if (!confirmed) return
    }

    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const result = await importProject(file)

    if (result.success && result.project) {
      onProjectImported(result.project)
      console.log('✅ Project imported:', result.project.name)
    } else {
      alert(`Import failed: ${result.error}`)
      console.error('❌ Import failed:', result.error)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="project-controls">
      <Button
        variant="secondary"
        size="small"
        onClick={handleImportClick}
        icon={<UploadIcon aria-hidden />}
      >
        Import
      </Button>

      <Button
        variant="secondary"
        size="small"
        onClick={handleExport}
        icon={<DownloadIcon aria-hidden />}
      >
        Export
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Import project file"
      />
    </div>
  )
}

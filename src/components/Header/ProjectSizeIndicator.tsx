import { Detail, ProgressBar } from '@navikt/ds-react'
import './ProjectSizeIndicator.css'

interface ProjectSizeIndicatorProps {
  sizeBytes: number
  maxSizeBytes: number
}

export const ProjectSizeIndicator = ({ sizeBytes, maxSizeBytes }: ProjectSizeIndicatorProps) => {
  const formatMB = (bytes: number): number => bytes / (1024 * 1024)
  
  const sizeMB = formatMB(sizeBytes)
  const maxMB = formatMB(maxSizeBytes)
  const percentage = (sizeMB / maxMB) * 100

  return (
    <div className="project-size-indicator">
      <Detail textColor="subtle">
        {sizeMB.toFixed(4)}/{maxMB} MB
      </Detail>
      <ProgressBar 
        value={Math.min(percentage, 100)} 
        size="small"
        aria-label="Project size usage"
      />
    </div>
  )
}

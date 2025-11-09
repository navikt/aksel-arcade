import './ProjectSizeIndicator.css'

interface ProjectSizeIndicatorProps {
  sizeBytes: number
  maxSizeBytes: number
}

export const ProjectSizeIndicator = ({ sizeBytes, maxSizeBytes }: ProjectSizeIndicatorProps) => {
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const percentage = (sizeBytes / maxSizeBytes) * 100
  const isWarning = percentage > 80 // 4MB of 5MB
  const isError = percentage > 100

  return (
    <div
      className={`project-size-indicator ${
        isError ? 'project-size-indicator--error' : isWarning ? 'project-size-indicator--warning' : ''
      }`}
      title={`Project size: ${formatBytes(sizeBytes)} / ${formatBytes(maxSizeBytes)}`}
    >
      <span className="project-size-indicator__text">
        {formatBytes(sizeBytes)} / {formatBytes(maxSizeBytes)}
      </span>
      <div className="project-size-indicator__bar">
        <div
          className="project-size-indicator__fill"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

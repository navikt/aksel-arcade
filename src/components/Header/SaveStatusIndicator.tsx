import type { SaveStatus } from '@/hooks/useAutoSave'
import './SaveStatusIndicator.css'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  sizeInfo?: string
}

export const SaveStatusIndicator = ({ status, sizeInfo }: SaveStatusIndicatorProps) => {
  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return sizeInfo || 'Ready'
      case 'saving':
        return 'Saving...'
      case 'saved':
        return '✓ Saved'
      case 'error':
        return '⚠ Save failed'
      default:
        return 'Ready'
    }
  }

  const getStatusClass = () => {
    switch (status) {
      case 'saving':
        return 'save-status-indicator--saving'
      case 'saved':
        return 'save-status-indicator--saved'
      case 'error':
        return 'save-status-indicator--error'
      default:
        return ''
    }
  }

  return (
    <div className={`save-status-indicator ${getStatusClass()}`}>
      <span className="save-status-indicator__text">{getStatusText()}</span>
    </div>
  )
}

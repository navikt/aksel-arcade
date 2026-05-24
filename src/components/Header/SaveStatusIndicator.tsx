import { Tag } from '@navikt/ds-react'
import type { SaveStatus } from '@/hooks/useAutoSave'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  sizeInfo?: string
}

export const SaveStatusIndicator = ({ status, sizeInfo }: SaveStatusIndicatorProps) => {
  const getStatus = (): { text: string; color: 'neutral' | 'info' | 'success' | 'danger' } => {
    switch (status) {
      case 'idle':
        return { text: sizeInfo || 'Ready', color: 'neutral' }
      case 'saving':
        return { text: 'Saving...', color: 'info' }
      case 'saved':
        return { text: 'Saved', color: 'success' }
      case 'error':
        return { text: 'Save failed', color: 'danger' }
      default:
        return { text: 'Ready', color: 'neutral' }
    }
  }

  const { text, color } = getStatus()

  return (
    <Tag size="small" variant="moderate" data-color={color}>
      {text}
    </Tag>
  )
}

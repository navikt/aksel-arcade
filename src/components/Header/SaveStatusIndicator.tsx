import { Tag } from '@navikt/ds-react'
import type { SaveStatus } from '@/hooks/useAutoSave'

interface SaveStatusIndicatorProps {
  status: SaveStatus
}

export const SaveStatusIndicator = ({ status }: SaveStatusIndicatorProps) => {
  if (status !== 'error') {
    return null
  }

  return (
    <Tag
      size="small"
      variant="moderate"
      data-color="danger"
      title="Autosave failed. Reload safety is unavailable until saving works again."
    >
      Autosave failed
    </Tag>
  )
}

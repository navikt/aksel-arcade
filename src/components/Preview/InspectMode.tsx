import { useContext } from 'react'
import { Button } from '@navikt/ds-react'
import { FileSearchIcon } from '@navikt/aksel-icons'
import { AppContext } from '@/hooks/useProject'

interface InspectModeProps {
  isInspectMode: boolean
  onInspectToggle?: (enabled: boolean) => void
}

export const InspectMode = ({ isInspectMode, onInspectToggle }: InspectModeProps) => {
  const context = useContext(AppContext)
  if (!context) throw new Error('InspectMode must be used within AppProvider')

  const handleToggle = () => {
    const newMode = !isInspectMode
    onInspectToggle?.(newMode)
  }

  return (
    <Button
      variant={isInspectMode ? 'secondary' : 'tertiary'}
      data-color="neutral"
      size="xsmall"
      icon={
        <FileSearchIcon title={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'} />
      }
      onClick={handleToggle}
      aria-label={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'}
      aria-pressed={isInspectMode}
      className="preview-pane__icon-button inspect-mode-button"
    />
  )
}

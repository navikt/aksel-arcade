import { useState, useContext } from 'react'
import { Button } from '@navikt/ds-react'
import { FileSearchIcon } from '@navikt/aksel-icons'
import { AppContext } from '@/hooks/useProject'

interface InspectModeProps {
  onInspectToggle?: (enabled: boolean) => void
}

export const InspectMode = ({ onInspectToggle }: InspectModeProps) => {
  const context = useContext(AppContext)
  if (!context) throw new Error('InspectMode must be used within AppProvider')

  const [isInspectMode, setIsInspectMode] = useState(false)

  const handleToggle = () => {
    const newMode = !isInspectMode
    setIsInspectMode(newMode)

    // Notify parent component
    onInspectToggle?.(newMode)
  }

  return (
    <Button
      variant={isInspectMode ? 'secondary' : 'tertiary'}
      data-color="neutral"
      size="small"
      icon={
        <FileSearchIcon title={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'} />
      }
      onClick={handleToggle}
      aria-label={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'}
      aria-pressed={isInspectMode}
      className="inspect-mode-button"
    />
  )
}

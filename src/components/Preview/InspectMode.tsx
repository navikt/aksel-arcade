import { useState, useContext } from 'react'
import { Button } from '@navikt/ds-react'
import { FileSearchIcon } from '@navikt/aksel-icons'
import { AppContext } from '@/hooks/useProject'
import type { MainToSandboxMessage } from '@/types/messages'
import './InspectMode.css'

interface InspectModeProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  onInspectToggle?: (enabled: boolean) => void
}

export const InspectMode = ({ iframeRef, onInspectToggle }: InspectModeProps) => {
  const context = useContext(AppContext)
  if (!context) throw new Error('InspectMode must be used within AppProvider')

  const [isInspectMode, setIsInspectMode] = useState(false)

  const handleToggle = () => {
    const newMode = !isInspectMode
    setIsInspectMode(newMode)
    
    // Send TOGGLE_INSPECT message to sandbox (T076)
    if (iframeRef.current?.contentWindow) {
      const message: MainToSandboxMessage = {
        type: 'TOGGLE_INSPECT',
        payload: { enabled: newMode },
      }
      iframeRef.current.contentWindow.postMessage(message, window.location.origin)
      console.log(`📤 Sent TOGGLE_INSPECT: ${newMode ? 'enabled' : 'disabled'}`)
    }
    
    // Notify parent component
    onInspectToggle?.(newMode)
  }

  return (
    <Button
      variant="tertiary-neutral"
      size="small"
      icon={<FileSearchIcon title={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'} />}
      onClick={handleToggle}
      aria-label={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'}
      aria-pressed={isInspectMode}
      className="inspect-mode-button"
    />
  )
}

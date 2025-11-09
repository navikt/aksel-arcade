import { useState, useContext } from 'react'
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
      iframeRef.current.contentWindow.postMessage(message, '*')
      console.log(`📤 Sent TOGGLE_INSPECT: ${newMode ? 'enabled' : 'disabled'}`)
    }
    
    // Notify parent component
    onInspectToggle?.(newMode)
  }

  return (
    <button
      type="button"
      className={`inspect-mode-toggle ${isInspectMode ? 'inspect-mode-toggle--active' : ''}`}
      onClick={handleToggle}
      aria-label={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'}
      aria-pressed={isInspectMode}
      title={isInspectMode ? 'Disable inspect mode' : 'Enable inspect mode'}
    >
      {/* Pointer/cursor icon */}
      <svg
        width="17"
        height="17"
        viewBox="0 0 17 17"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M2.5 2.5L14.5 8.5L8.5 10.5L6.5 14.5L2.5 2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  )
}

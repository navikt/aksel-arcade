import { useState } from 'react'
import { Button } from '@navikt/ds-react'
import { SunIcon, MoonIcon } from '@navikt/aksel-icons'
import type { MainToSandboxMessage } from '@/types/messages'

interface ThemeToggleProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  onThemeChange?: (theme: 'light' | 'dark') => void
}

export const ThemeToggle = ({ iframeRef, onThemeChange }: ThemeToggleProps) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const handleToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    
    // Send UPDATE_THEME message to sandbox
    if (iframeRef.current?.contentWindow) {
      const message: MainToSandboxMessage = {
        type: 'UPDATE_THEME',
        payload: { theme: newTheme },
      }
      iframeRef.current.contentWindow.postMessage(message, '*')
      console.log(`📤 Sent UPDATE_THEME: ${newTheme}`)
    }
    
    // Notify parent component
    onThemeChange?.(newTheme)
  }

  return (
    <Button
      variant="tertiary-neutral"
      size="small"
      icon={theme === 'light' 
        ? <MoonIcon title="Switch to dark theme" /> 
        : <SunIcon title="Switch to light theme" />
      }
      onClick={handleToggle}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
    />
  )
}

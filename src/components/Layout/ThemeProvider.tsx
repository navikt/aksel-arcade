import { type ReactNode } from 'react'
import { Theme } from '@navikt/ds-react/Theme'
import { useSettings } from '@/contexts/SettingsContext'

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { theme } = useSettings()
  
  return (
    <Theme theme={theme} hasBackground={true}>
      {children}
    </Theme>
  )
}

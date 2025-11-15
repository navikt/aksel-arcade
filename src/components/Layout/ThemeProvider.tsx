import { type ReactNode } from 'react'
import { Theme } from '@navikt/ds-react/Theme'

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Aksel Darkside Theme component
  // Default to dark mode - can be made configurable later
  return (
    <Theme theme="dark" hasBackground={true}>
      {children}
    </Theme>
  )
}

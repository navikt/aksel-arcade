import { type ReactNode } from 'react'

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Aksel Darkside theme is applied via CSS import in main.tsx
  // This component can be extended later for theme switching
  return <div data-theme="dark">{children}</div>
}

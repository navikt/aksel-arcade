import { createContext, useContext, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'
export type PanelOrder = 'code-left' | 'preview-left'

interface SettingsContextValue {
  theme: ThemeMode
  panelOrder: PanelOrder
  toggleTheme: () => void
  togglePanelOrder: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [panelOrder, setPanelOrder] = useState<PanelOrder>('code-left')

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const togglePanelOrder = () => {
    setPanelOrder(prev => prev === 'code-left' ? 'preview-left' : 'code-left')
  }

  return (
    <SettingsContext.Provider value={{ theme, panelOrder, toggleTheme, togglePanelOrder }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}

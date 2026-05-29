import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PanelOrder, ThemeMode } from '@/types/project'

export type { PanelOrder, ThemeMode }

interface SettingsContextValue {
  theme: ThemeMode
  panelOrder: PanelOrder
  toggleTheme: () => void
  togglePanelOrder: () => void
  setTheme: (nextTheme: ThemeMode) => void
  setPanelOrder: (nextPanelOrder: PanelOrder) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark')
  const [panelOrder, setPanelOrder] = useState<PanelOrder>('code-left')

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const togglePanelOrder = () => {
    setPanelOrder((prev) => (prev === 'code-left' ? 'preview-left' : 'code-left'))
  }

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
  }

  const setPanelOrderValue = (nextPanelOrder: PanelOrder) => {
    setPanelOrder(nextPanelOrder)
  }

  return (
    <SettingsContext.Provider
      value={{
        theme,
        panelOrder,
        toggleTheme,
        togglePanelOrder,
        setTheme,
        setPanelOrder: setPanelOrderValue,
      }}
    >
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

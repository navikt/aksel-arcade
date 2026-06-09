import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PanelOrder, ThemeMode } from '@/types/project'

export type { PanelOrder, ThemeMode }

interface SettingsContextValue {
  theme: ThemeMode
  panelOrder: PanelOrder
  multiPageEnabled: boolean
  toggleTheme: () => void
  togglePanelOrder: () => void
  toggleMultiPageEnabled: () => void
  setTheme: (nextTheme: ThemeMode) => void
  setPanelOrder: (nextPanelOrder: PanelOrder) => void
  setMultiPageEnabled: (enabled: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark')
  const [panelOrder, setPanelOrder] = useState<PanelOrder>('code-left')
  const [multiPageEnabled, setMultiPageEnabledState] = useState(false)

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const togglePanelOrder = () => {
    setPanelOrder((prev) => (prev === 'code-left' ? 'preview-left' : 'code-left'))
  }

  const toggleMultiPageEnabled = () => {
    setMultiPageEnabledState((prev) => !prev)
  }

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
  }

  const setPanelOrderValue = (nextPanelOrder: PanelOrder) => {
    setPanelOrder(nextPanelOrder)
  }

  const setMultiPageEnabled = (enabled: boolean) => {
    setMultiPageEnabledState(enabled)
  }

  return (
    <SettingsContext.Provider
      value={{
        theme,
        panelOrder,
        multiPageEnabled,
        toggleTheme,
        togglePanelOrder,
        toggleMultiPageEnabled,
        setTheme,
        setPanelOrder: setPanelOrderValue,
        setMultiPageEnabled,
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

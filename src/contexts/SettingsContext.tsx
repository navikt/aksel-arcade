import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PanelOrder, SelectedEditTarget, ThemeMode } from '@/types/project'

export type { PanelOrder, ThemeMode }

interface SettingsContextValue {
  theme: ThemeMode
  panelOrder: PanelOrder
  multiPageEnabled: boolean
  pagePanelOpen: boolean
  selectedEditTarget: SelectedEditTarget
  previewFullscreen: boolean
  toggleTheme: () => void
  togglePanelOrder: () => void
  toggleMultiPageEnabled: () => void
  togglePagePanel: () => void
  togglePreviewFullscreen: () => void
  setTheme: (nextTheme: ThemeMode) => void
  setPanelOrder: (nextPanelOrder: PanelOrder) => void
  setMultiPageEnabled: (enabled: boolean) => void
  setPagePanelOpen: (open: boolean) => void
  setSelectedEditTarget: (target: SelectedEditTarget) => void
  setPreviewFullscreen: (previewFullscreen: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark')
  const [panelOrder, setPanelOrder] = useState<PanelOrder>('code-left')
  const [multiPageEnabled, setMultiPageEnabledState] = useState(false)
  const [pagePanelOpen, setPagePanelOpenState] = useState(true)
  const [selectedEditTarget, setSelectedEditTargetState] = useState<SelectedEditTarget>('page')
  const [previewFullscreen, setPreviewFullscreenState] = useState(false)

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const togglePanelOrder = () => {
    setPanelOrder((prev) => (prev === 'code-left' ? 'preview-left' : 'code-left'))
  }

  const toggleMultiPageEnabled = () => {
    setMultiPageEnabledState((prev) => !prev)
  }

  const togglePagePanel = () => {
    setPagePanelOpenState((prev) => !prev)
  }

  const togglePreviewFullscreen = () => {
    setPreviewFullscreenState((prev) => !prev)
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

  const setPagePanelOpen = (open: boolean) => {
    setPagePanelOpenState(open)
  }

  const setSelectedEditTarget = (target: SelectedEditTarget) => {
    setSelectedEditTargetState(target)
  }

  const setPreviewFullscreen = (nextPreviewFullscreen: boolean) => {
    setPreviewFullscreenState(nextPreviewFullscreen)
  }

  return (
    <SettingsContext.Provider
      value={{
        theme,
        panelOrder,
        multiPageEnabled,
        pagePanelOpen,
        selectedEditTarget,
        previewFullscreen,
        toggleTheme,
        togglePanelOrder,
        toggleMultiPageEnabled,
        togglePagePanel,
        togglePreviewFullscreen,
        setTheme,
        setPanelOrder: setPanelOrderValue,
        setMultiPageEnabled,
        setPagePanelOpen,
        setSelectedEditTarget,
        setPreviewFullscreen,
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

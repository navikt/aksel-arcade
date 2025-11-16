import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Project } from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState } from '@/types/preview'
import { createDefaultProject, createDefaultEditorState, createDefaultPreviewState, FORM_SUMMARY_JSX_CODE } from '@/utils/projectDefaults'
import { loadProject } from '@/services/storage'
import type { ComponentSnippet } from '@/types/snippets'

interface AppState {
  // Persisted state
  project: Project

  // Ephemeral state
  editorState: EditorState
  previewState: PreviewState

  // UI state
  isComponentPaletteOpen: boolean
  isSettingsOpen: boolean

  // Actions
  updateProject: (updates: Partial<Project>) => void
  setProject: (project: Project) => void
  updateEditorState: (updates: Partial<EditorState>) => void
  updatePreviewState: (updates: Partial<PreviewState>) => void
  toggleComponentPalette: () => void
  closeComponentPalette: () => void
  toggleSettings: () => void
  insertSnippet: (snippet: ComponentSnippet) => void
  resetToIntro: () => void
  loadFormSummaryTemplate: () => void
}

const AppContext = createContext<AppState | null>(null)

export { AppContext }

export const useProject = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useProject must be used within AppProvider')
  }
  return context
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // T098: Load project from LocalStorage on initialization
  const [project, setProjectState] = useState<Project>(() => {
    const result = loadProject()
    if (result.error) {
      console.error('Failed to load project:', result.error)
      return createDefaultProject()
    }
    if (result.migrated) {
      console.log('Project migrated from version', result.project?.version)
    }
    return result.project || createDefaultProject()
  })
  
  const [editorState, setEditorState] = useState<EditorState>(createDefaultEditorState())
  const [previewState, setPreviewState] = useState<PreviewState>(createDefaultPreviewState())
  const [isComponentPaletteOpen, setIsComponentPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const updateProject = (updates: Partial<Project>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updates,
      lastModified: new Date().toISOString(),
    }))
  }

  const setProject = (newProject: Project) => {
    setProjectState(newProject)
  }

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }))
  }

  const updatePreviewState = (updates: Partial<PreviewState>) => {
    setPreviewState((prev) => ({ ...prev, ...updates }))
  }

  const toggleComponentPalette = () => {
    setIsComponentPaletteOpen((prev) => !prev)
  }

  const closeComponentPalette = () => {
    setIsComponentPaletteOpen(false)
  }

  const toggleSettings = () => {
    setIsSettingsOpen((prev) => !prev)
  }

  const insertSnippet = (snippet: ComponentSnippet) => {
    // Get current code for active tab
    const currentCode = editorState.activeTab === 'JSX' ? project.jsxCode : project.hooksCode

    // Parse template: replace ${N:placeholder} with placeholder text
    let parsedTemplate = snippet.template
    parsedTemplate = parsedTemplate.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder) => placeholder)

    // Simply append at end with proper spacing
    const newCode = currentCode.trimEnd() + '\n\n' + parsedTemplate

    // Update project with new code
    if (editorState.activeTab === 'JSX') {
      updateProject({ jsxCode: newCode })
    } else {
      updateProject({ hooksCode: newCode })
    }
  }

  const resetToIntro = () => {
    const confirmed = window.confirm(
      'Reset editor to intro state? This will replace your current code.'
    )
    if (confirmed) {
      const introProject = createDefaultProject()
      setProjectState({
        ...project,
        jsxCode: introProject.jsxCode,
        hooksCode: introProject.hooksCode,
        lastModified: new Date().toISOString(),
      })
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
    }
  }

  const loadFormSummaryTemplate = () => {
    const confirmed = window.confirm(
      'Load form summary page template? This will replace your current code.'
    )
    if (confirmed) {
      // Clear any potential storage conflicts by updating project cleanly
      setProjectState({
        ...project,
        jsxCode: FORM_SUMMARY_JSX_CODE,
        hooksCode: '', // Empty hooks for template
        lastModified: new Date().toISOString(),
      })
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
      console.log('✅ Form summary template loaded successfully')
    }
  }

  const value: AppState = {
    project,
    editorState,
    previewState,
    isComponentPaletteOpen,
    isSettingsOpen,
    updateProject,
    setProject,
    updateEditorState,
    updatePreviewState,
    toggleComponentPalette,
    closeComponentPalette,
    toggleSettings,
    insertSnippet,
    resetToIntro,
    loadFormSummaryTemplate,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

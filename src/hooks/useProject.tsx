import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

/* eslint-disable react-refresh/only-export-components */
// Context providers intentionally export both context and hooks

import {
  CURRENT_PROJECT_VERSION,
  type ArcadePageId,
  type Project,
  type ProjectSourceTarget,
  type ProjectSnapshot,
  type SelectedEditTarget,
  type ShareUrlMetadata,
  type ShareUrlOpeningIntent,
} from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState, SandboxConsoleMessage } from '@/types/preview'
import {
  createDefaultProject,
  createDefaultEditorState,
  createDefaultPreviewState,
  FORM_SUMMARY_JSX_CODE,
  HOOKS_DEMO_JSX_CODE,
  HOOKS_DEMO_HOOKS_CODE,
} from '@/utils/projectDefaults'
import {
  FIRST_PAGE_ID,
  createPage as createProjectPage,
  createSinglePageProjectSource,
  deletePage as deleteProjectPage,
  getSourceForEditTarget,
  normalizeProjectSelection,
  renamePage as renameProjectPage,
  resolveSelectedEditTarget,
  setActivePage,
  setStartPage as setProjectStartPage,
  updateActivePageSource,
  updateSourceForEditTarget,
  updateSourceForTarget,
} from '@/services/projectSource'
import {
  DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
  loadProject,
  SNAPSHOT_FILE_IDS,
  type WebArcadeWorkingCopyPreferences,
} from '@/services/storage'
import type { ComponentSnippet } from '@/types/snippets'
import { useSettings } from '@/contexts/SettingsContext'
import {
  decodeShareToken,
  getShareTokenFromLocation,
  stripShareQueryParam,
  type ShareDecodeError,
} from '@/utils/shareDecoding'
import { appendSandboxConsoleMessage } from '@/services/previewDiagnostics'
import { notifyAgentSessionProjectReplaced } from '@/services/agentSessionLifecycle'

interface ShareHydrationState {
  status: 'idle' | 'decoding' | 'ready' | 'error'
  token?: string
  snapshot?: ProjectSnapshot
  metadata?: ShareUrlMetadata
  openingIntent?: ShareUrlOpeningIntent
  error?: ShareDecodeError
}

type ProjectUpdate = Partial<Pick<Project, 'name' | 'viewportSize' | 'panelLayout' | 'activePageId'>> & {
  jsxCode?: string
  hooksCode?: string
  editTarget?: SelectedEditTarget
  sourceTarget?: ProjectSourceTarget
}

interface AppState {
  // Persisted state
  project: Project

  // Ephemeral state
  editorState: EditorState
  previewState: PreviewState
  previewIframeRef: RefObject<HTMLIFrameElement | null>

  // UI state
  isComponentPaletteOpen: boolean
  isSettingsOpen: boolean

  // Actions
  updateProject: (updates: ProjectUpdate) => void
  createPage: () => void
  renamePage: (pageId: ArcadePageId, name: string) => void
  deletePage: (pageId: ArcadePageId) => void
  setStartPage: (pageId: ArcadePageId) => void
  replaceProject: (project: Project) => void
  updateEditorState: (updates: Partial<EditorState>) => void
  updatePreviewState: (updates: Partial<PreviewState>) => void
  recordSandboxConsoleMessage: (message: SandboxConsoleMessage) => void
  toggleComponentPalette: () => void
  closeComponentPalette: () => void
  toggleSettings: () => void
  insertSnippet: (snippet: ComponentSnippet) => void
  resetToIntro: () => void
  loadFormSummaryTemplate: () => void
  loadHooksDemo: () => void

  // Share hydration
  shareHydration: ShareHydrationState
  applySharedSnapshot: () => void
  dismissShareHydration: () => void
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
  const initialLoadResultRef = useRef<ReturnType<typeof loadProject> | null>(null)
  if (!initialLoadResultRef.current) {
    initialLoadResultRef.current = loadProject()
  }

  // T098: Load project from the current Web Arcade working copy on initialization
  const [project, setProjectState] = useState<Project>(() => {
    const result = initialLoadResultRef.current!
    if (result.error) {
      console.error('Failed to load project:', result.error)
      return createDefaultProject()
    }
    return result.project || createDefaultProject()
  })

  const [editorState, setEditorState] = useState<EditorState>(createDefaultEditorState())
  const [previewState, setPreviewState] = useState<PreviewState>(() =>
    createDefaultPreviewState(initialLoadResultRef.current?.project?.viewportSize)
  )
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const [isComponentPaletteOpen, setIsComponentPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const {
    multiPageEnabled,
    pagePanelOpen,
    previewFullscreen,
    selectedEditTarget,
    setTheme,
    setPanelOrder,
    setMultiPageEnabled,
    setPagePanelOpen,
    setSelectedEditTarget,
    setPreviewFullscreen,
  } = useSettings()
  const restoredPreferencesRef = useRef(false)
  const [shareHydration, setShareHydration] = useState<ShareHydrationState>(() => {
    const token = getShareTokenFromLocation()
    return token ? { status: 'decoding', token } : { status: 'idle' }
  })

  useEffect(() => {
    if (restoredPreferencesRef.current) {
      return
    }

    restoredPreferencesRef.current = true
    const preferences = initialLoadResultRef.current?.preferences
    if (preferences) {
      setTheme(preferences.theme)
      setPanelOrder(preferences.panelOrder)
      setMultiPageEnabled(preferences.multiPageEnabled)
      setPagePanelOpen(preferences.pagePanelOpen)
      setSelectedEditTarget(preferences.selectedEditTarget)
      setPreviewFullscreen(preferences.previewFullscreen)
    }
  }, [
    setMultiPageEnabled,
    setPagePanelOpen,
    setPanelOrder,
    setPreviewFullscreen,
    setSelectedEditTarget,
    setTheme,
  ])

  const effectiveEditTarget = resolveSelectedEditTarget(selectedEditTarget)

  useEffect(() => {
    if (shareHydration.status !== 'decoding' || !shareHydration.token) {
      return
    }

    let cancelled = false
    const token = shareHydration.token

    const run = async () => {
      const result = await decodeShareToken(token)
      if (cancelled) {
        return
      }

      if (result.snapshot && result.checksumValid) {
        setShareHydration({
          status: 'ready',
          token,
          snapshot: result.snapshot,
          metadata: result.metadata,
          openingIntent: result.openingIntent,
        })
      } else {
        setShareHydration({
          status: 'error',
          token,
          error: result.error ?? DEFAULT_SHARE_DECODE_ERROR,
        })
      }

      stripShareQueryParam()
    }

    run().catch((error) => {
      if (cancelled) {
        return
      }
      console.error('Web share URL decode failed', error)
      setShareHydration({
        status: 'error',
        token,
        error: DEFAULT_SHARE_DECODE_ERROR,
      })
      stripShareQueryParam()
    })

    return () => {
      cancelled = true
    }
  }, [shareHydration.status, shareHydration.token])

  const updateProject = (updates: ProjectUpdate) => {
    setProjectState((prev) => {
      let nextProject: Project = {
        ...prev,
        lastModified: new Date().toISOString(),
      }

      if (updates.name !== undefined) {
        nextProject = { ...nextProject, name: updates.name }
      }

      if (updates.viewportSize !== undefined) {
        nextProject = { ...nextProject, viewportSize: updates.viewportSize }
      }

      if (updates.panelLayout !== undefined) {
        nextProject = { ...nextProject, panelLayout: updates.panelLayout }
      }

      if (updates.activePageId !== undefined) {
        nextProject = setActivePage(nextProject, updates.activePageId)
      }

      if (updates.jsxCode !== undefined || updates.hooksCode !== undefined) {
        if (updates.sourceTarget) {
          nextProject = updateSourceForTarget(nextProject, updates.sourceTarget, {
            jsx: updates.jsxCode,
            hooks: updates.hooksCode,
          })
        } else {
          const editTarget = resolveSelectedEditTarget(updates.editTarget ?? selectedEditTarget)
          nextProject = updateSourceForEditTarget(nextProject, editTarget, {
            jsx: updates.jsxCode,
            hooks: updates.hooksCode,
          })
        }
      }

      return normalizeProjectSelection(nextProject)
    })
  }

  const applyProjectTransform = (transform: (project: Project) => Project) => {
    setProjectState((prev) =>
      normalizeProjectSelection({
        ...transform(prev),
        lastModified: new Date().toISOString(),
      })
    )
  }

  const createPage = () => {
    applyProjectTransform((prev) => createProjectPage(prev))
  }

  const renamePage = (pageId: ArcadePageId, name: string) => {
    applyProjectTransform((prev) => renameProjectPage(prev, pageId, name))
  }

  const deletePage = (pageId: ArcadePageId) => {
    applyProjectTransform((prev) => deleteProjectPage(prev, pageId))
  }

  const setStartPage = (pageId: ArcadePageId) => {
    applyProjectTransform((prev) => setProjectStartPage(prev, pageId))
  }

  const replaceCurrentWorkingCopy = (
    newProject: Project,
    preferences: WebArcadeWorkingCopyPreferences
  ) => {
    const normalizedProject = normalizeProjectSelection(newProject)
    notifyAgentSessionProjectReplaced()
    setProjectState(normalizedProject)
    setEditorState(createDefaultEditorState())
    setPreviewState(createDefaultPreviewState(normalizedProject.viewportSize))
    setTheme(preferences.theme)
    setPanelOrder(preferences.panelOrder)
    setMultiPageEnabled(preferences.multiPageEnabled)
    setPagePanelOpen(preferences.pagePanelOpen)
    setSelectedEditTarget(preferences.selectedEditTarget)
    setPreviewFullscreen(preferences.previewFullscreen)
  }

  const replaceProject = (newProject: Project) => {
    replaceCurrentWorkingCopy(newProject, DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES)
  }

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }))
  }

  const updatePreviewState = useCallback((updates: Partial<PreviewState>) => {
    setPreviewState((prev) => ({ ...prev, ...updates }))
  }, [])

  const recordSandboxConsoleMessage = (message: SandboxConsoleMessage) => {
    setPreviewState((prev) => ({
      ...prev,
      sandboxConsoleMessages: appendSandboxConsoleMessage(prev.sandboxConsoleMessages, message),
    }))
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
    const activeSource = getSourceForEditTarget(project, effectiveEditTarget)
    const currentCode = editorState.activeTab === 'JSX' ? activeSource.jsx : activeSource.hooks

    // Parse template: replace ${N:placeholder} with placeholder text
    let parsedTemplate = snippet.template
    parsedTemplate = parsedTemplate.replace(
      /\$\{(\d+):([^}]+)\}/g,
      (_match, _num, placeholder) => placeholder
    )

    // Simply append at end with proper spacing
    const newCode = currentCode.trimEnd() + '\n\n' + parsedTemplate

    // Update project with new code
    if (editorState.activeTab === 'JSX') {
      updateProject({ jsxCode: newCode, editTarget: effectiveEditTarget })
    } else {
      updateProject({ hooksCode: newCode, editTarget: effectiveEditTarget })
    }
  }

  const resetToIntro = () => {
    const confirmed = window.confirm(
      'Reset editor? This will replace only this Web Arcade working copy with the default Untitled Project.'
    )
    if (confirmed) {
      replaceCurrentWorkingCopy(createDefaultProject(), DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES)
    }
  }

  const loadFormSummaryTemplate = () => {
    const confirmed = window.confirm(
      'Load form summary page template? This will replace your current code.'
    )
    if (confirmed) {
      // Clear any potential storage conflicts by updating project cleanly
      notifyAgentSessionProjectReplaced()
      setProjectState((prev) => ({
        ...updateActivePageSource(prev, {
          jsx: FORM_SUMMARY_JSX_CODE,
          hooks: '',
        }),
        lastModified: new Date().toISOString(),
      }))
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
    }
  }

  const loadHooksDemo = () => {
    const confirmed = window.confirm('Load Hooks demo? This will replace your current code.')
    if (confirmed) {
      notifyAgentSessionProjectReplaced()
      setProjectState((prev) => ({
        ...updateActivePageSource(prev, {
          jsx: HOOKS_DEMO_JSX_CODE,
          hooks: HOOKS_DEMO_HOOKS_CODE,
        }),
        lastModified: new Date().toISOString(),
      }))
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
    }
  }

  const applySharedSnapshot = () => {
    if (shareHydration.status !== 'ready' || !shareHydration.snapshot) {
      return
    }

    const snapshot = shareHydration.snapshot
    const nextPreviewFullscreen =
      shareHydration.openingIntent?.previewFullscreen === true
        ? true
        : previewFullscreen

    try {
      const nextProject = buildProjectFromSnapshot(snapshot)
      replaceCurrentWorkingCopy(nextProject, {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: snapshot.preview.theme,
        multiPageEnabled,
        pagePanelOpen,
        previewFullscreen: nextPreviewFullscreen,
      })
    } catch (error) {
      console.error('Failed to apply shared snapshot', error)
    } finally {
      setShareHydration({ status: 'idle' })
    }
  }

  const dismissShareHydration = () => {
    setShareHydration({ status: 'idle' })
  }

  const value: AppState = {
    project,
    editorState,
    previewState,
    previewIframeRef,
    isComponentPaletteOpen,
    isSettingsOpen,
    updateProject,
    createPage,
    renamePage,
    deletePage,
    setStartPage,
    replaceProject,
    updateEditorState,
    updatePreviewState,
    recordSandboxConsoleMessage,
    toggleComponentPalette,
    closeComponentPalette,
    toggleSettings,
    insertSnippet,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
    shareHydration,
    applySharedSnapshot,
    dismissShareHydration,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

const DEFAULT_SHARE_DECODE_ERROR: ShareDecodeError = {
  code: 'decode-failed',
  message: 'We could not decode this Web share URL. Please request a new one.',
}

const buildProjectFromSnapshot = (snapshot: ProjectSnapshot): Project => {
  const freshProject = createDefaultProject()
  const now = new Date().toISOString()
  const nextJsx =
    findSnapshotContent(snapshot, SNAPSHOT_FILE_IDS.jsx) ??
    findSnapshotContentByName(snapshot, 'App.tsx') ??
    findSnapshotContent(snapshot, snapshot.activeFileId) ??
    findFirstTsxContent(snapshot) ??
    ''
  const nextHooks =
    findSnapshotContent(snapshot, SNAPSHOT_FILE_IDS.hooks) ??
    findSnapshotContentByName(snapshot, 'hooks.ts') ??
    ''

  return {
    ...freshProject,
    source: createSinglePageProjectSource(nextJsx, nextHooks),
    activePageId: FIRST_PAGE_ID,
    viewportSize: snapshot.preview.viewport,
    version: CURRENT_PROJECT_VERSION,
    createdAt: now,
    lastModified: now,
  }
}

const findSnapshotContent = (snapshot: ProjectSnapshot, fileId: string): string | undefined => {
  return snapshot.files.find((file) => file.id === fileId)?.content
}

const findSnapshotContentByName = (snapshot: ProjectSnapshot, name: string): string | undefined => {
  return snapshot.files.find((file) => file.name === name)?.content
}

const findFirstTsxContent = (snapshot: ProjectSnapshot): string | undefined => {
  return snapshot.files.find((file) => file.language === 'tsx')?.content
}

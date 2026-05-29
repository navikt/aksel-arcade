import {
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

import type { Project, ProjectSnapshot, ShareUrlMetadata } from '@/types/project'
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
import { loadProject, SNAPSHOT_FILE_IDS } from '@/services/storage'
import type { ComponentSnippet } from '@/types/snippets'
import { useSettings } from '@/contexts/SettingsContext'
import { getViewportWidth } from '@/types/viewports'
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
  error?: ShareDecodeError
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
  updateProject: (updates: Partial<Project>) => void
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
  // T098: Load project from LocalStorage on initialization
  const [project, setProjectState] = useState<Project>(() => {
    const result = loadProject()
    if (result.error) {
      console.error('Failed to load project:', result.error)
      return createDefaultProject()
    }
    return result.project || createDefaultProject()
  })

  const [editorState, setEditorState] = useState<EditorState>(createDefaultEditorState())
  const [previewState, setPreviewState] = useState<PreviewState>(createDefaultPreviewState())
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const [isComponentPaletteOpen, setIsComponentPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { setTheme } = useSettings()
  const [shareHydration, setShareHydration] = useState<ShareHydrationState>(() => {
    const token = getShareTokenFromLocation()
    return token ? { status: 'decoding', token } : { status: 'idle' }
  })

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
      console.error('Share link decode failed', error)
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

  const updateProject = (updates: Partial<Project>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updates,
      lastModified: new Date().toISOString(),
    }))
  }

  const replaceProject = (newProject: Project) => {
    notifyAgentSessionProjectReplaced()
    setProjectState(newProject)
  }

  const updateEditorState = (updates: Partial<EditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }))
  }

  const updatePreviewState = (updates: Partial<PreviewState>) => {
    setPreviewState((prev) => ({ ...prev, ...updates }))
  }

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
    const currentCode = editorState.activeTab === 'JSX' ? project.jsxCode : project.hooksCode

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
      notifyAgentSessionProjectReplaced()
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
      notifyAgentSessionProjectReplaced()
      setProjectState({
        ...project,
        jsxCode: FORM_SUMMARY_JSX_CODE,
        hooksCode: '', // Empty hooks for template
        lastModified: new Date().toISOString(),
      })
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
    }
  }

  const loadHooksDemo = () => {
    const confirmed = window.confirm('Load Hooks demo? This will replace your current code.')
    if (confirmed) {
      notifyAgentSessionProjectReplaced()
      setProjectState({
        ...project,
        jsxCode: HOOKS_DEMO_JSX_CODE,
        hooksCode: HOOKS_DEMO_HOOKS_CODE,
        lastModified: new Date().toISOString(),
      })
      // Reset editor state to JSX tab
      setEditorState(createDefaultEditorState())
    }
  }

  const applySharedSnapshot = () => {
    if (shareHydration.status !== 'ready' || !shareHydration.snapshot) {
      return
    }

    const snapshot = shareHydration.snapshot

    try {
      const nextProject = buildProjectFromSnapshot(snapshot)
      notifyAgentSessionProjectReplaced()
      setProjectState(nextProject)

      const nextEditorState = createDefaultEditorState()
      setEditorState(nextEditorState)

      setPreviewState((prev) => ({
        ...prev,
        currentViewport: snapshot.preview.viewport,
        viewportWidth: getViewportWidth(snapshot.preview.viewport),
      }))

      setTheme(snapshot.preview.theme)
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
  message: 'We could not decode this share link. Please request a new one.',
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
    jsxCode: nextJsx,
    hooksCode: nextHooks,
    viewportSize: snapshot.preview.viewport,
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

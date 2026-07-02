import { useContext, useEffect, useState } from 'react'
import { Box, Page } from '@navikt/ds-react'
import { AppContext } from './hooks/useProject'
import { useAutoSave } from './hooks/useAutoSave'
import { ThemeProvider } from './components/Layout/ThemeProvider'
import { AppHeader } from './components/Header/AppHeader'
import { EditorPane } from './components/Editor/EditorPane'
import { PreviewPane } from './components/Preview/PreviewPane'
import { WarningNotification } from './components/Header/WarningNotification'
import { SplitPane } from './components/Layout/SplitPane'
import { validateProjectSize } from './services/storage'
import type { Project } from './types/project'
import type { DesktopMcpServerState } from './services/desktopMcp'
import { WEB_ARCADE_CAPABILITIES, type ShellCapabilities } from './services/shellCapabilities'
import { useSettings } from './contexts/SettingsContext'
import { useDesktopMcpProjectResourceBridge } from './hooks/useDesktopMcpProjectResourceBridge'
import './App.css'

interface AppProps {
  shellCapabilities?: ShellCapabilities
  desktopMcpServerState?: DesktopMcpServerState | null
}

function App({
  shellCapabilities = WEB_ARCADE_CAPABILITIES,
  desktopMcpServerState = null,
}: AppProps) {
  const context = useContext(AppContext)
  if (!context) throw new Error('App must be used within AppProvider')

  const {
    project,
    updateProject,
    replaceProjectState,
    replaceProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
    previewState,
    previewIframeRef,
    updatePreviewState,
    shareHydration,
    applySharedSnapshot,
    dismissShareHydration,
  } = context

  const {
    theme,
    panelOrder,
    multiPageEnabled,
    pagePanelOpen,
    selectedEditTarget,
    previewFullscreen,
    setTheme,
  } = useSettings()

  const workingCopyPreferences = {
    theme,
    panelOrder,
    multiPageEnabled,
    pagePanelOpen,
    selectedEditTarget,
    previewFullscreen,
  }

  useDesktopMcpProjectResourceBridge({
    project,
    previewState,
    previewIframeRef,
    theme,
    workingCopyPreferences,
    setTheme,
    replaceProjectState,
    updateProject,
    updatePreviewState,
  })

  // T097: Auto-save integration
  const { saveStatus, saveError } = useAutoSave(project, workingCopyPreferences)

  // T094, T095, T096: Project size monitoring
  const [projectSizeBytes, setProjectSizeBytes] = useState(0)
  const [sizeWarning, setSizeWarning] = useState<string | null>(null)

  useEffect(() => {
    const sizeStatus = validateProjectSize(project)
    setProjectSizeBytes(sizeStatus.sizeBytes)

    // T095: Show warning when > 4MB
    if (sizeStatus.warning) {
      setSizeWarning(sizeStatus.warning)
    } else {
      setSizeWarning(null)
    }

    // T096: Show error if > 5MB (though this should be prevented by save)
    if (!sizeStatus.valid && sizeStatus.message) {
      setSizeWarning(sizeStatus.message)
    }
  }, [project])

  const handleProjectNameChange = (name: string) => {
    updateProject({ name })
  }

  // T092: Handle imported project
  const handleProjectImported = (importedProject: Project) => {
    replaceProject(importedProject)
  }

  const hasNotifications =
    (
      shareHydration.status === 'ready'
      && (!!shareHydration.snapshot || !!shareHydration.sharedProject)
    ) ||
    shareHydration.status === 'error' ||
    !!sizeWarning ||
    !!saveError

  const notificationsClassName = previewFullscreen
    ? 'app-shell__notifications app-shell__notifications--inline'
    : 'app-shell__notifications'

  return (
    <ThemeProvider>
      <Page.Block
        gutters={false}
        className={previewFullscreen ? 'app-shell app-shell--preview-fullscreen' : 'app-shell'}
      >
        {hasNotifications && (
          <div className={notificationsClassName}>
            {shareHydration.status === 'ready' &&
              (shareHydration.snapshot || shareHydration.sharedProject) && (
              <WarningNotification
                variant="warning"
                message="Load Web share URL?"
                description="Loading this Web share URL will replace only this Web Arcade working copy."
                actions={[
                  { label: 'Load Web share URL', variant: 'primary', onClick: applySharedSnapshot },
                  { label: 'Keep my work', variant: 'secondary', onClick: dismissShareHydration },
                ]}
                onClose={dismissShareHydration}
              />
            )}

            {shareHydration.status === 'error' && (
              <WarningNotification
                variant="error"
                message="Web share URL could not be opened"
                description={shareHydration.error?.message}
                onClose={dismissShareHydration}
              />
            )}

            {sizeWarning && (
              <WarningNotification message={sizeWarning} onClose={() => setSizeWarning(null)} />
            )}

            {saveError && <WarningNotification message={`Save error: ${saveError}`} />}
          </div>
        )}

        <div
          className="app-shell__chrome"
          hidden={previewFullscreen}
          aria-hidden={previewFullscreen}
        >
          <AppHeader
            projectName={project.name}
            onProjectNameChange={handleProjectNameChange}
            currentProject={project}
            onProjectImported={handleProjectImported}
            saveStatus={saveStatus}
            projectSizeBytes={projectSizeBytes}
            onResetToIntro={resetToIntro}
            onLoadFormSummaryTemplate={loadFormSummaryTemplate}
            onLoadHooksDemo={loadHooksDemo}
            shellCapabilities={shellCapabilities}
            desktopMcpServerState={desktopMcpServerState}
          />
        </div>

        <Box
          as="main"
          className={
            previewFullscreen
              ? 'app-shell__workspace app-shell__workspace--preview-fullscreen'
              : 'app-shell__workspace'
          }
        >
          <SplitPane
            left={<EditorPane />}
            right={<PreviewPane shellCapabilities={shellCapabilities} />}
            defaultLeftWidth={50}
            minLeftWidth={20}
            minRightWidth={20}
          />
        </Box>
      </Page.Block>
    </ThemeProvider>
  )
}

export default App

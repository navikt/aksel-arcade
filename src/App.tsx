import { useContext, useState, useEffect } from 'react'
import { Box, Page } from '@navikt/ds-react'
import { AppContext } from './hooks/useProject'
import { useAutoSave } from './hooks/useAutoSave'
import { ThemeProvider } from './components/Layout/ThemeProvider'
import { AppHeader } from './components/Header/AppHeader'
import { EditorPane } from './components/Editor/EditorPane'
import { PreviewPane } from './components/Preview/PreviewPane'
import { WarningNotification } from './components/Header/WarningNotification'
import { SplitPane } from './components/Layout/SplitPane'
import { validateProjectSize, clearStorage } from './services/storage'
import type { Project } from './types/project'
import { WEB_ARCADE_CAPABILITIES, type ShellCapabilities } from './services/shellCapabilities'
import './App.css'

interface AppProps {
  shellCapabilities?: ShellCapabilities
}

function App({ shellCapabilities = WEB_ARCADE_CAPABILITIES }: AppProps) {
  const context = useContext(AppContext)
  if (!context) throw new Error('App must be used within AppProvider')

  const {
    project,
    updateProject,
    replaceProject,
    resetToIntro,
    loadFormSummaryTemplate,
    loadHooksDemo,
    shareHydration,
    applySharedSnapshot,
    dismissShareHydration,
  } = context

  // T097: Auto-save integration
  const { saveStatus, saveError } = useAutoSave(project)

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

  return (
    <ThemeProvider>
      <Page.Block gutters={false} className="app-shell">
        {shareHydration.status === 'ready' && shareHydration.snapshot && (
          <WarningNotification
            variant="warning"
            message="Load shared project?"
            description="Loading this shared project will replace your current work."
            actions={[
              { label: 'Load shared project', variant: 'primary', onClick: applySharedSnapshot },
              { label: 'Keep my work', variant: 'secondary', onClick: dismissShareHydration },
            ]}
            onClose={dismissShareHydration}
          />
        )}

        {shareHydration.status === 'error' && (
          <WarningNotification
            variant="error"
            message="Share link could not be opened"
            description={shareHydration.error?.message}
            onClose={dismissShareHydration}
          />
        )}

        {sizeWarning && (
          <WarningNotification message={sizeWarning} onClose={() => setSizeWarning(null)} />
        )}

        {saveError && <WarningNotification message={`Save error: ${saveError}`} />}

        <AppHeader
          projectName={project.name}
          onProjectNameChange={handleProjectNameChange}
          currentProject={project}
          onProjectImported={handleProjectImported}
          saveStatus={saveStatus}
          projectSizeBytes={projectSizeBytes}
          onResetToIntro={resetToIntro}
          onClearStorage={clearStorage}
          onLoadFormSummaryTemplate={loadFormSummaryTemplate}
          onLoadHooksDemo={loadHooksDemo}
          shellCapabilities={shellCapabilities}
        />

        <Box as="main" className="app-shell__workspace">
          <SplitPane
            left={<EditorPane />}
            right={<PreviewPane />}
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

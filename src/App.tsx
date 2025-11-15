import { useContext, useState, useEffect } from 'react'
import { Page } from '@navikt/ds-react'
import { AppContext } from './hooks/useProject'
import { useAutoSave } from './hooks/useAutoSave'
import { SettingsProvider } from './contexts/SettingsContext'
import { ThemeProvider } from './components/Layout/ThemeProvider'
import { AppHeader } from './components/Header/AppHeader'
import { EditorPane } from './components/Editor/EditorPane'
import { PreviewPane } from './components/Preview/PreviewPane'
import { WarningNotification } from './components/Header/WarningNotification'
import { SplitPane } from './components/Layout/SplitPane'
import { validateProjectSize } from './services/storage'
import type { Project } from './types/project'
import './App.css'

function App() {
  const context = useContext(AppContext)
  if (!context) throw new Error('App must be used within AppProvider')

  const { project, updateProject, setProject } = context

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
    setProject(importedProject)
  }

  return (
    <SettingsProvider>
      <ThemeProvider>
        <Page.Block gutters={false} style={{ width: '100%', height: '100vh' }}>
          {sizeWarning && (
            <WarningNotification 
              message={sizeWarning} 
              onClose={() => setSizeWarning(null)} 
            />
          )}
          
          {saveError && (
            <WarningNotification 
              message={`Save error: ${saveError}`}
            />
          )}
          
          <AppHeader 
            projectName={project.name} 
            onProjectNameChange={handleProjectNameChange}
            currentProject={project}
            onProjectImported={handleProjectImported}
            saveStatus={saveStatus}
            projectSizeBytes={projectSizeBytes}
          />
          
          <div style={{ height: 'calc(100vh - 60px)', width: '100%' }}>
            <SplitPane
              left={<EditorPane />}
              right={<PreviewPane />}
              defaultLeftWidth={50}
              minLeftWidth={20}
              minRightWidth={20}
            />
          </div>
        </Page.Block>
      </ThemeProvider>
    </SettingsProvider>
  )
}

export default App


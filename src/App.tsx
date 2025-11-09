import { useContext } from 'react'
import { AppContext } from './hooks/useProject'
import { ThemeProvider } from './components/Layout/ThemeProvider'
import { SplitPane } from './components/Layout/SplitPane'
import { AppHeader } from './components/Header/AppHeader'
import { EditorPane } from './components/Editor/EditorPane'
import { PreviewPane } from './components/Preview/PreviewPane'
import './App.css'

function App() {
  const context = useContext(AppContext)
  if (!context) throw new Error('App must be used within AppProvider')

  const { project, updateProject } = context

  const handleProjectNameChange = (name: string) => {
    updateProject({ name })
  }

  return (
    <ThemeProvider>
      <div className="app">
        <AppHeader projectName={project.name} onProjectNameChange={handleProjectNameChange} />
        
        <SplitPane
          left={<EditorPane />}
          right={<PreviewPane />}
          defaultLeftWidth={50}
          minLeftWidth={300}
          minRightWidth={320}
        />
      </div>
    </ThemeProvider>
  )
}

export default App


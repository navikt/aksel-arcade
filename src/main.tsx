import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './hooks/useProject.tsx'
import { SettingsProvider } from './contexts/SettingsContext'
import { readDesktopMcpServerState, type DesktopMcpServerState } from './services/desktopMcp'
import {
  resolveInitialShellCapabilities,
  type ShellCapabilities,
} from './services/shellCapabilities'
import '@navikt/ds-css'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Aksel Arcade root element was not found.')
}

const root = createRoot(rootElement)

const renderApp = ({
  shellCapabilities,
  desktopMcpServerState,
}: {
  shellCapabilities: ShellCapabilities
  desktopMcpServerState: DesktopMcpServerState | null
}) => {
  root.render(
    <StrictMode>
      <SettingsProvider>
        <AppProvider>
          <App
            shellCapabilities={shellCapabilities}
            desktopMcpServerState={desktopMcpServerState}
          />
        </AppProvider>
      </SettingsProvider>
    </StrictMode>
  )
}

const renderBootstrapError = (error: unknown) => {
  root.render(
    <div role="alert" style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Aksel Arcade could not start</h1>
      <p>{error instanceof Error ? error.message : 'Unknown startup error'}</p>
    </div>
  )
}

void Promise.all([resolveInitialShellCapabilities(), readDesktopMcpServerState()]).then(
  ([shellCapabilities, desktopMcpServerState]) =>
    renderApp({
      shellCapabilities,
      desktopMcpServerState,
    }),
  renderBootstrapError
)

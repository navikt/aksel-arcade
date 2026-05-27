import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './hooks/useProject.tsx'
import { SettingsProvider } from './contexts/SettingsContext'
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

const renderApp = (shellCapabilities: ShellCapabilities) => {
  root.render(
    <StrictMode>
      <SettingsProvider>
        <AppProvider>
          <App shellCapabilities={shellCapabilities} />
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

void resolveInitialShellCapabilities().then(renderApp, renderBootstrapError)

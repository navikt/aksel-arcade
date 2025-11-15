import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './hooks/useProject.tsx'
import '@navikt/ds-css/darkside'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

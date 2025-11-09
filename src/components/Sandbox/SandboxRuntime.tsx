// This component runs inside the sandboxed iframe (public/sandbox.html)
// It receives transpiled code via postMessage and renders it to the DOM

// This file is meant to be loaded in the sandbox iframe
// For now, we'll keep the sandbox logic in public/sandbox.html
// This is a placeholder for future refactoring

// Note: Actual runtime in public/sandbox.html uses:
// - createRoot from 'react-dom/client'
// - Theme from '@navikt/ds-react/Theme' (loaded via /src/sandboxAksel.ts)
// - MainToSandboxMessage and SandboxToMainMessage types

export const SandboxRuntime = () => {
  return (
    <div>
      <p>This component is for type reference only.</p>
      <p>Actual sandbox runtime is in public/sandbox.html</p>
    </div>
  )
}

// The actual runtime logic will be in public/sandbox.html
// We'll update that file to handle proper React rendering with Aksel theme

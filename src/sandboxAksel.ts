/**
 * Sandbox Aksel bundle
 * Following current Aksel setup: https://aksel.nav.no/grunnleggende/kode/migration-guide
 *
 * import "@navikt/ds-css";
 * import { Theme } from "@navikt/ds-react/Theme";
 */

// Import Aksel CSS once so the sandbox and app use the same v8 package.
import '@navikt/ds-css'

// Import React (must be same instance as Aksel uses)
import * as React from 'react'
import { createRoot } from 'react-dom/client'

// Import Theme component
import { Theme } from '@navikt/ds-react/Theme'

// Import all Aksel components
import * as RawAkselComponents from '@navikt/ds-react'

// Import all Aksel icons
import * as AkselIcons from '@navikt/aksel-icons'
import {
  AKSEL_RUNTIME_NAME_ALIASES,
  AKSEL_SAFE_COMPATIBILITY_ALIASES,
  AKSEL_UNSUPPORTED_LEGACY_GUIDANCE,
} from './data/akselRuntimeCompatibility'

export {
  AKSEL_RUNTIME_NAME_ALIASES,
  AKSEL_SAFE_COMPATIBILITY_ALIASES,
  AKSEL_UNSUPPORTED_LEGACY_GUIDANCE,
} from './data/akselRuntimeCompatibility'

type AkselRuntimeComponents = Record<string, unknown>

export function createUnsupportedAkselComponent(name: string, message: string) {
  const UnsupportedAkselComponent = () => {
    throw new Error(message)
  }
  UnsupportedAkselComponent.displayName = name
  return UnsupportedAkselComponent
}

export function applyAkselRuntimeCompatibility<T extends object>(
  components: T
): AkselRuntimeComponents & T {
  const runtimeComponents = Object.fromEntries(Object.entries(components)) as AkselRuntimeComponents

  for (const [alias, target] of Object.entries({
    ...AKSEL_SAFE_COMPATIBILITY_ALIASES,
    ...AKSEL_RUNTIME_NAME_ALIASES,
  })) {
    if (runtimeComponents[target]) {
      runtimeComponents[alias] = runtimeComponents[target]
    }
  }

  for (const [name, message] of Object.entries(AKSEL_UNSUPPORTED_LEGACY_GUIDANCE)) {
    if (!runtimeComponents[name]) {
      runtimeComponents[name] = createUnsupportedAkselComponent(name, message)
    }
  }

  return runtimeComponents as AkselRuntimeComponents & T
}

const AkselComponents = applyAkselRuntimeCompatibility(RawAkselComponents)

// Export for both dev (Vite module) and production (esbuild IIFE)
// In dev: imported as ES module
// In production: bundled as IIFE with globalName 'sandboxBundle'
export default {
  React,
  createRoot,
  Theme,
  AkselComponents,
  AkselIcons,
}

// Also export named for flexibility
export { React, createRoot, Theme, AkselComponents, AkselIcons }

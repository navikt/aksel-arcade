/**
 * Sandbox Aksel bundle
 * Following official Aksel setup: https://aksel.nav.no/grunnleggende/kode/migration-guide
 * 
 * import "@navikt/ds-css/darkside";
 * import { Theme } from "@navikt/ds-react/Theme";
 */

// Import Darkside CSS - this is the correct way per Aksel docs
import '@navikt/ds-css/darkside';

// Import React (must be same instance as Aksel uses)
import * as React from 'react';
import { createRoot } from 'react-dom/client';

// Import Theme component
import { Theme } from '@navikt/ds-react/Theme';

// Import all Aksel components
import * as AkselComponents from '@navikt/ds-react';

// Import all Aksel icons
import * as AkselIcons from '@navikt/aksel-icons';

// Export for both dev (Vite module) and production (esbuild IIFE)
// In dev: imported as ES module
// In production: bundled as IIFE with globalName 'sandboxBundle'
export default {
  React,
  createRoot,
  Theme,
  AkselComponents,
  AkselIcons,
};

// Also export named for flexibility
export {
  React,
  createRoot,
  Theme,
  AkselComponents,
  AkselIcons,
};

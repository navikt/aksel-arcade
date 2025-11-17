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

// Bundle all exports into a single object to prevent code-splitting
// This prevents Vite from splitting external re-exports into vendor chunks
const sandbox = {
  React,
  createRoot,
  Theme,
  AkselComponents,
  AkselIcons,
};

export default sandbox;

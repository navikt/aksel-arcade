/**
 * Aksel v8 Metadata Template
 *
 * This metadata is included in Arcade project package exports to provide AI assistants
 * with complete context for building production apps outside our editor.
 *
 * Update this file when:
 * - Aksel package versions change
 * - Documentation URLs change
 * - Setup instructions need revision
 * - New token categories are added
 */

import { getCatalogComponent } from './akselCatalog'

export interface AkselMetadata {
  designSystem: string
  designSystemVersion: string
  framework: string
  runtime: string
  packages: {
    react: string
    reactDom: string
    css: string
    tokens: string | null
    icons: string
  }
  packageVersions: Record<string, string>
  setup: {
    install: string
    cssImport: string
    themeWrapper: string
    themeImport: string
    minVersion: string
  }
  authoring: {
    playground: string
    production: string
  }
  tokens: {
    prefix: string
    categories: string[]
    documentation: string
    examples: {
      colors: string[]
      spacing: string[]
      typography: string[]
    }
  }
  breakpoints: Record<string, string>
  documentation: {
    main: string
    components: string
    tokens: string
    setup: string
    migration: string
  }
}

/**
 * Current Aksel v8 metadata
 * Used when generating AI-enriched Arcade project package exports
 */
export const AKSEL_METADATA: AkselMetadata = {
  designSystem: 'Aksel v8',
  designSystemVersion: '8.11.0',
  framework: 'React 19+',
  runtime: 'browser',

  packages: {
    react: '@navikt/ds-react',
    reactDom: 'react-dom',
    css: '@navikt/ds-css',
    tokens: null,
    icons: '@navikt/aksel-icons',
  },
  packageVersions: {
    react: '19.2.0',
    'react-dom': '19.2.0',
    '@navikt/ds-react': '8.11.0',
    '@navikt/ds-css': '8.11.0',
    '@navikt/aksel-icons': '8.11.0',
  },

  setup: {
    install:
      'npm install --save-exact react react-dom @navikt/ds-react@8.11.0 @navikt/ds-css@8.11.0 @navikt/aksel-icons@8.11.0',
    cssImport: "import '@navikt/ds-css';",
    themeWrapper: '<Theme theme="dark">{app}</Theme>',
    themeImport: "import { Theme } from '@navikt/ds-react/Theme';",
    minVersion: '@navikt/ds-react 8.11.0',
  },

  authoring: {
    playground:
      'Aksel Arcade authoring is import-free: React, Aksel components, Aksel icons, and supported hooks are injected by the sandbox runtime.',
    production:
      'When moving a prototype into a production app, add explicit imports from @navikt/ds-react, @navikt/aksel-icons, @navikt/ds-react/Theme, and import @navikt/ds-css once at the app root.',
  },

  tokens: {
    prefix: '--ax',
    categories: ['colors', 'spacing', 'typography', 'borders', 'shadows', 'breakpoints'],
    documentation: 'https://aksel.nav.no/grunnleggende/styling/design-tokens',
    examples: {
      colors: [
        '--ax-bg-default',
        '--ax-bg-raised',
        '--ax-bg-sunken',
        '--ax-text-neutral',
        '--ax-text-neutral-subtle',
        '--ax-border-neutral',
        '--ax-border-neutral-subtle',
        '--ax-border-focus',
      ],
      spacing: [
        '--ax-space-2',
        '--ax-space-4',
        '--ax-space-8',
        '--ax-space-12',
        '--ax-space-16',
        '--ax-space-20',
        '--ax-space-32',
      ],
      typography: ['--ax-font-family', '--ax-font-family-mono'],
    },
  },

  breakpoints: {
    xs: '320px',
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1440px',
  },

  documentation: {
    main: 'https://aksel.nav.no',
    components: 'https://aksel.nav.no/komponenter',
    tokens: 'https://aksel.nav.no/grunnleggende/styling/design-tokens',
    setup: 'https://aksel.nav.no/grunnleggende/introduksjon/kom-i-gang-med-kodepakkene',
    migration: 'https://aksel.nav.no/grunnleggende/kode/migration-guide',
  },
}

/**
 * AI-friendly instructions for building apps from exported JSON
 */
export const AI_INSTRUCTIONS = `This is a React prototype built with the Aksel v8 design system.

Arcade source code is intentionally import-free while you prototype:
${AKSEL_METADATA.authoring.playground}

To build a standalone production app:

1. Install exact dependencies:
   ${AKSEL_METADATA.setup.install}

2. Import Aksel CSS in your root file:
   ${AKSEL_METADATA.setup.cssImport}

3. Import and wrap your app with Theme component:
   ${AKSEL_METADATA.setup.themeImport}
   ${AKSEL_METADATA.setup.themeWrapper}

4. Import Aksel components:
   import { Button, TextField, ... } from '@navikt/ds-react';

5. Use design tokens with ${AKSEL_METADATA.tokens.prefix} prefix:
   Examples: ${AKSEL_METADATA.tokens.examples.colors.slice(0, 3).join(', ')}

6. Use production imports when copying code out of Arcade:
   ${AKSEL_METADATA.authoring.production}

7. Responsive breakpoints:
   ${Object.entries(AKSEL_METADATA.breakpoints)
     .map(([key, val]) => `${key}: ${val}`)
     .join(', ')}

Important constraints:
- Pinned Aksel package version: ${AKSEL_METADATA.designSystemVersion}
- Exact package versions: ${Object.entries(AKSEL_METADATA.packageVersions)
  .map(([name, version]) => `${name}@${version}`)
  .join(', ')}
- All CSS variables use ${AKSEL_METADATA.tokens.prefix} prefix (not --a or --ac)
- Theme wrapper is required for light/dark theme semantics
- Components must be imported from ${AKSEL_METADATA.packages.react}

Documentation:
- Main: ${AKSEL_METADATA.documentation.main}
- Components: ${AKSEL_METADATA.documentation.components}
- Setup guide: ${AKSEL_METADATA.documentation.setup}
`

/**
 * Generate component usage metadata from JSX code
 * Analyzes code to detect which Aksel components are being used
 */
export const extractUsedComponents = (
  jsxCode: string
): Array<{
  name: string
  import: string
  docs: string
}> => {
  // Simple regex-based detection (could be enhanced with AST parsing)
  const componentPattern = /<([A-Z][a-zA-Z]+)/g
  const matches = jsxCode.matchAll(componentPattern)
  const componentNames = new Set<string>()

  for (const match of matches) {
    componentNames.add(match[1])
  }

  // Map to Aksel components (exclude HTML elements like Fragment)
  const akselComponents = Array.from(componentNames)
    .filter((name) => !['Fragment'].includes(name))
    .map((name) => {
      const catalogEntry = getCatalogComponent(name)

      return {
        name,
        import: catalogEntry?.package ?? AKSEL_METADATA.packages.react,
        docs:
          catalogEntry?.docs ??
          `${AKSEL_METADATA.documentation.components}/core/${name.toLowerCase()}`,
      }
    })

  return akselComponents
}

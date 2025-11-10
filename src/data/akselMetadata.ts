/**
 * Aksel Darkside Metadata Template
 * 
 * This metadata is included in JSON exports to provide AI assistants
 * with complete context for building production apps outside our editor.
 * 
 * Update this file when:
 * - Aksel package versions change
 * - Documentation URLs change
 * - Setup instructions need revision
 * - New token categories are added
 */

export interface AkselMetadata {
  designSystem: string;
  designSystemVersion: string;
  framework: string;
  runtime: string;
  packages: {
    react: string;
    css: string;
    tokens: string;
    icons: string;
  };
  setup: {
    install: string;
    cssImport: string;
    themeWrapper: string;
    themeImport: string;
    minVersion: string;
  };
  tokens: {
    prefix: string;
    categories: string[];
    documentation: string;
    examples: {
      colors: string[];
      spacing: string[];
      typography: string[];
    };
  };
  breakpoints: Record<string, string>;
  documentation: {
    main: string;
    components: string;
    tokens: string;
    darkside: string;
    migration: string;
  };
}

/**
 * Current Aksel Darkside metadata
 * Used when generating AI-enriched JSON exports
 */
export const AKSEL_METADATA: AkselMetadata = {
  designSystem: 'Aksel Darkside',
  designSystemVersion: '7.33.1', // Update when packages are upgraded
  framework: 'React 19+',
  runtime: 'browser',

  packages: {
    react: '@navikt/ds-react',
    css: '@navikt/ds-css/darkside',
    tokens: '@navikt/ds-tokens/darkside-css',
    icons: '@navikt/aksel-icons',
  },

  setup: {
    install: 'npm install react react-dom @navikt/ds-react @navikt/ds-css @navikt/aksel-icons',
    cssImport: "import '@navikt/ds-css/darkside';",
    themeWrapper: '<Theme theme="darkside">{app}</Theme>',
    themeImport: "import { Theme } from '@navikt/ds-react/Theme';",
    minVersion: '@navikt/ds-react ^7.25.0 (minimum for Darkside support)',
  },

  tokens: {
    prefix: '--ax',
    categories: [
      'colors',
      'spacing',
      'typography',
      'borders',
      'shadows',
      'breakpoints',
    ],
    documentation: 'https://aksel.nav.no/grunnleggende/darkside/design-tokens',
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
      typography: [
        '--ax-font-family',
        '--ax-font-family-mono',
      ],
    },
  },

  breakpoints: {
    XS: '320px',
    SM: '480px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px',
  },

  documentation: {
    main: 'https://aksel.nav.no',
    components: 'https://aksel.nav.no/komponenter',
    tokens: 'https://aksel.nav.no/grunnleggende/darkside/design-tokens',
    darkside: 'https://aksel.nav.no/grunnleggende/darkside/sette-opp-prosjekt-med-darkside',
    migration: 'https://aksel.nav.no/grunnleggende/darkside/migrere-til-darkside',
  },
};

/**
 * AI-friendly instructions for building apps from exported JSON
 */
export const AI_INSTRUCTIONS = `This is a React prototype built with Aksel Darkside design system.

To build a standalone production app:

1. Install dependencies:
   ${AKSEL_METADATA.setup.install}

2. Import Darkside CSS in your root file:
   ${AKSEL_METADATA.setup.cssImport}

3. Import and wrap your app with Theme component:
   ${AKSEL_METADATA.setup.themeImport}
   ${AKSEL_METADATA.setup.themeWrapper}

4. Import Aksel components:
   import { Button, TextField, ... } from '@navikt/ds-react';

5. Use design tokens with ${AKSEL_METADATA.tokens.prefix} prefix:
   Examples: ${AKSEL_METADATA.tokens.examples.colors.slice(0, 3).join(', ')}

6. Responsive breakpoints:
   ${Object.entries(AKSEL_METADATA.breakpoints).map(([key, val]) => `${key}: ${val}`).join(', ')}

Important constraints:
- Minimum version: ${AKSEL_METADATA.setup.minVersion}
- All CSS variables use ${AKSEL_METADATA.tokens.prefix} prefix (not --a or --ac)
- Theme wrapper is required for Darkside to work
- Components must be imported from ${AKSEL_METADATA.packages.react}

Documentation:
- Main: ${AKSEL_METADATA.documentation.main}
- Components: ${AKSEL_METADATA.documentation.components}
- Darkside guide: ${AKSEL_METADATA.documentation.darkside}
`;

/**
 * Generate component usage metadata from JSX code
 * Analyzes code to detect which Aksel components are being used
 */
export const extractUsedComponents = (jsxCode: string): Array<{
  name: string;
  import: string;
  docs: string;
}> => {
  // Simple regex-based detection (could be enhanced with AST parsing)
  const componentPattern = /<([A-Z][a-zA-Z]+)/g;
  const matches = jsxCode.matchAll(componentPattern);
  const componentNames = new Set<string>();

  for (const match of matches) {
    componentNames.add(match[1]);
  }

  // Map to Aksel components (exclude HTML elements like Fragment)
  const akselComponents = Array.from(componentNames)
    .filter(name => !['Fragment'].includes(name))
    .map(name => ({
      name,
      import: AKSEL_METADATA.packages.react,
      docs: `${AKSEL_METADATA.documentation.components}/core/${name.toLowerCase()}`,
    }));

  return akselComponents;
};

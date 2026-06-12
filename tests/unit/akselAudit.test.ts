import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_CATALOG_EXCEPTIONS,
  ACCEPTED_DOCS_EXCEPTIONS,
} from '../../src/data/akselAuditExceptions'
import type { AkselAutocompleteEntry } from '../../scripts/lib/akselDocs'
import { collectDocsEntries } from '../../scripts/lib/akselDocs'
import { formatAkselAuditReport, runAkselAudit } from '../../scripts/lib/akselAudit'

const FIXTURE_DIR = path.resolve('tests/fixtures/aksel-audit')

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8')
}

async function readFixtureEntries(): Promise<AkselAutocompleteEntry[]> {
  const llmDocs = readFixture('llm.md')
  return collectDocsEntries(llmDocs, async (link) => {
    const fileName = `${link.url.split('/').pop() ?? ''}`
    return readFixture(fileName)
  })
}

describe('Aksel audit workflow helpers', () => {
  it('separates accepted exceptions from new potential drift and formats a focused report', async () => {
    const freshDocsEntries = await readFixtureEntries()
    const generatedDocsEntries = freshDocsEntries.map((entry) => {
      if (entry.name !== 'Combobox') {
        return entry
      }

      return {
        ...entry,
        props: entry.props.filter((prop) => prop.name !== 'size'),
      }
    })

    const report = runAkselAudit({
      targetVersion: '8.11.0',
      packageJsonVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      lockfileVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      metadataVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      catalogVersion: '8.11.0',
      runtimeAliases: { Combobox: 'UNSAFE_Combobox' },
      safeCompatibilityAliases: { BoxNew: 'Box' },
      runtimeComponentExports: ['Page', 'UNSAFE_Combobox', 'Alert', 'Box'],
      runtimeIconExports: ['AirplaneIcon', 'XMarkIcon'],
      freshDocsEntries,
      docsCoverageEntries: freshDocsEntries.filter(
        (entry) => entry.status === 'current' && !entry.name.includes('.Toggle')
      ),
      generatedDocsEntries,
      catalogEntries: [
        {
          name: 'Page',
          group: 'layout',
          status: 'current',
          package: '@navikt/ds-react',
          importName: 'Page',
          importGuidance: "import { Page } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          description: 'Page container.',
          props: [],
          snippet: {
            code: '<Page>Content</Page>',
            description: 'Page example.',
          },
        },
        {
          name: 'Page.Block',
          group: 'layout',
          status: 'current',
          package: '@navikt/ds-react',
          importName: 'Page',
          importGuidance: "import { Page } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          description: 'Page block.',
          props: [],
          snippet: {
            code: '<Page.Block width="lg">Content</Page.Block>',
            description: 'Page block example.',
          },
        },
        {
          name: 'Alert',
          group: 'component',
          status: 'legacy',
          package: '@navikt/ds-react',
          importName: 'Alert',
          importGuidance: "import { Alert } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/core/alert',
          description: 'Legacy alert.',
          props: [],
          snippet: {
            code: '<Alert>Legacy</Alert>',
            description: 'Legacy alert example.',
          },
        },
        {
          name: 'BoxNew',
          group: 'layout',
          status: 'legacy',
          package: '@navikt/ds-react',
          importName: 'BoxNew',
          importGuidance: "import { Box } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/primitives/box',
          description: 'Legacy Box alias.',
          props: [],
          snippet: {
            code: '<Box>Legacy</Box>',
            description: 'Legacy Box example.',
          },
        },
      ],
      addMenuNames: ['Alert'],
      snippetNames: [],
      autocompleteNames: ['Ingress'],
      iconCatalogNames: ['AirplaneIcon'],
      hiddenNewAuthoringRoots: ['Alert', 'Modal'],
      authoringPropsByComponent: {
        Combobox: generatedDocsEntries.find((entry) => entry.name === 'Combobox')?.props ?? [],
        Page: freshDocsEntries.find((entry) => entry.name === 'Page')?.props ?? [],
        'Page.Block': freshDocsEntries.find((entry) => entry.name === 'Page.Block')?.props ?? [],
        Navpoleonskake: [],
        Ingress: [],
      },
      acceptedDocsExceptions: ACCEPTED_DOCS_EXCEPTIONS,
      acceptedCatalogExceptions: ACCEPTED_CATALOG_EXCEPTIONS,
    })

    expect(report.acceptedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'runtime',
          name: 'Combobox',
          exceptionId: 'combobox-runtime-alias',
        }),
        expect.objectContaining({
          category: 'catalog',
          name: 'Navpoleonskake',
          exceptionId: 'navpoleonskake-docs-noise',
        }),
        expect.objectContaining({
          category: 'catalog',
          name: 'Alert',
          exceptionId: 'alert-legacy-compatibility',
        }),
        expect.objectContaining({
          category: 'catalog',
          name: 'BoxNew',
          exceptionId: 'boxnew-safe-alias',
        }),
      ])
    )
    expect(report.potentialFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'catalog',
          name: 'Combobox',
        }),
        expect.objectContaining({
          category: 'generated-docs',
          name: 'Combobox.size',
        }),
        expect.objectContaining({
          category: 'authoring',
          name: 'Combobox.size',
        }),
        expect.objectContaining({
          category: 'discovery',
          name: 'Alert',
        }),
        expect.objectContaining({
          category: 'discovery',
          name: 'Ingress',
        }),
        expect.objectContaining({
          category: 'icons',
          name: 'XMarkIcon',
        }),
      ])
    )

    const formatted = formatAkselAuditReport(report)
    expect(formatted).toContain('Potential catalog drift')
    expect(formatted).toContain('Accepted runtime exceptions')
    expect(formatted).toContain('Combobox is only runtime-supported through the alias UNSAFE_Combobox')
    expect(formatted).toContain('Navpoleonskake is documented for current authoring but missing from the curated insertion catalog')
    expect(formatted).toContain('ask the user before encoding them as accepted Arcade policy')
  })

  it('does not auto-accept a runtime alias exception when the alias target changes', () => {
    const report = runAkselAudit({
      targetVersion: '8.11.0',
      packageJsonVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      lockfileVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      metadataVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      catalogVersion: '8.11.0',
      runtimeAliases: { Combobox: 'DIFFERENT_ALIAS' },
      safeCompatibilityAliases: {},
      runtimeComponentExports: ['DIFFERENT_ALIAS'],
      runtimeIconExports: [],
      freshDocsEntries: [
        {
          name: 'Combobox',
          group: 'component',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/core/combobox',
          props: [],
        },
      ],
      docsCoverageEntries: [
        {
          name: 'Combobox',
          group: 'component',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/core/combobox',
          props: [],
        },
      ],
      generatedDocsEntries: [
        {
          name: 'Combobox',
          group: 'component',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/core/combobox',
          props: [],
        },
      ],
      catalogEntries: [
        {
          name: 'Combobox',
          group: 'component',
          status: 'current',
          package: '@navikt/ds-react',
          importName: 'Combobox',
          importGuidance: "import { Combobox } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/core/combobox',
          description: 'Combobox example.',
          props: [],
          snippet: {
            code: '<Combobox label="Select" options={[]} />',
            description: 'Combobox example.',
          },
        },
      ],
      addMenuNames: [],
      snippetNames: [],
      autocompleteNames: [],
      iconCatalogNames: [],
      hiddenNewAuthoringRoots: ['Alert', 'Modal'],
      authoringPropsByComponent: {
        Combobox: [],
      },
      acceptedDocsExceptions: ACCEPTED_DOCS_EXCEPTIONS,
      acceptedCatalogExceptions: ACCEPTED_CATALOG_EXCEPTIONS,
    })

    expect(report.acceptedFindings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'runtime',
          name: 'Combobox',
          exceptionId: 'combobox-runtime-alias',
        }),
      ])
    )
    expect(report.potentialFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'runtime',
          name: 'Combobox',
          message:
            'Combobox is only runtime-supported through the alias DIFFERENT_ALIAS.',
        }),
      ])
    )
  })

  it('does not let a compound entry inherit the parent docs status through importName matching', () => {
    const report = runAkselAudit({
      targetVersion: '8.11.0',
      packageJsonVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      lockfileVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      metadataVersions: {
        '@navikt/ds-react': '8.11.0',
        '@navikt/ds-css': '8.11.0',
        '@navikt/aksel-icons': '8.11.0',
      },
      catalogVersion: '8.11.0',
      runtimeAliases: {},
      safeCompatibilityAliases: {},
      runtimeComponentExports: ['Page'],
      runtimeIconExports: [],
      freshDocsEntries: [
        {
          name: 'Page',
          group: 'primitive',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          props: [],
        },
        {
          name: 'Page.Block',
          group: 'primitive',
          status: 'deprecated',
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          props: [],
        },
      ],
      docsCoverageEntries: [
        {
          name: 'Page',
          group: 'primitive',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          props: [],
        },
      ],
      generatedDocsEntries: [
        {
          name: 'Page',
          group: 'primitive',
          status: 'current',
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          props: [],
        },
        {
          name: 'Page.Block',
          group: 'primitive',
          status: 'deprecated',
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          props: [],
        },
      ],
      catalogEntries: [
        {
          name: 'Page',
          group: 'layout',
          status: 'current',
          package: '@navikt/ds-react',
          importName: 'Page',
          importGuidance: "import { Page } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          description: 'Page example.',
          props: [],
          snippet: {
            code: '<Page>Content</Page>',
            description: 'Page example.',
          },
        },
        {
          name: 'Page.Block',
          group: 'layout',
          status: 'current',
          package: '@navikt/ds-react',
          importName: 'Page',
          importGuidance: "import { Page } from '@navikt/ds-react';",
          docs: 'https://aksel.nav.no/komponenter/primitives/page',
          description: 'Page block example.',
          props: [],
          snippet: {
            code: '<Page.Block width="lg">Content</Page.Block>',
            description: 'Page block example.',
          },
        },
      ],
      addMenuNames: [],
      snippetNames: [],
      autocompleteNames: [],
      iconCatalogNames: [],
      hiddenNewAuthoringRoots: ['Alert', 'Modal'],
      authoringPropsByComponent: {
        Page: [],
        'Page.Block': [],
      },
      acceptedDocsExceptions: ACCEPTED_DOCS_EXCEPTIONS,
      acceptedCatalogExceptions: ACCEPTED_CATALOG_EXCEPTIONS,
    })

    expect(report.potentialFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'catalog',
          name: 'Page.Block',
          message:
            'Page.Block is cataloged as current, but fresh docs now report status deprecated.',
        }),
      ])
    )
  })
})

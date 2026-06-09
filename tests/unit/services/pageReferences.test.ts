import { describe, expect, it } from 'vitest'
import {
  analyzeProjectPageReferences,
  findPageReferences,
  getDeletePageImpact,
  getStalePageReferenceMessage,
} from '@/services/pageReferences'
import { createArcadePage, createArcadeSourceFile } from '@/services/projectSource'
import type { ProjectSource } from '@/types/project'

describe('pageReferences service', () => {
  it('finds goToPage and page-id href/to references with positions while ignoring external links', () => {
    const code = [
      "const go = () => goToPage('page02')",
      '<Link href="page03">Details</Link>',
      '<LinkCard to={"page01"} />',
      '<Link href="https://nav.no">External</Link>',
    ].join('\n')

    const references = findPageReferences(code, ['page01', 'page02'])

    expect(references).toEqual([
      {
        targetPageId: 'page02',
        kind: 'goToPage',
        status: 'valid',
        from: code.indexOf('page02'),
        to: code.indexOf('page02') + 'page02'.length,
        line: 0,
        column: code.split('\n')[0]?.indexOf('page02') ?? -1,
      },
      {
        targetPageId: 'page03',
        kind: 'href',
        status: 'stale',
        from: code.indexOf('page03'),
        to: code.indexOf('page03') + 'page03'.length,
        line: 1,
        column: code.split('\n')[1]?.indexOf('page03') ?? -1,
      },
      {
        targetPageId: 'page01',
        kind: 'to',
        status: 'valid',
        from: code.indexOf('page01'),
        to: code.indexOf('page01') + 'page01'.length,
        line: 2,
        column: code.split('\n')[2]?.indexOf('page01') ?? -1,
      },
    ])
    expect(getStalePageReferenceMessage(references[1]!)).toBe('Page page03 no longer exists.')
  })

  it('marks every page as broken when Global config contains a stale page reference', () => {
    const source: ProjectSource = {
      globalConfig: createArcadeSourceFile('<Link href="page03">Shared nav</Link>', ''),
      pages: [
        createArcadePage('page01', 'Page 1', createArcadeSourceFile('<Box>Start</Box>', '')),
        createArcadePage('page02', 'Page 2', createArcadeSourceFile('<Box>Details</Box>', '')),
      ],
      startPageId: 'page01',
      nextPageNumber: 3,
    }

    const analysis = analyzeProjectPageReferences(source)

    expect(analysis.globalConfigStaleReferences).toHaveLength(1)
    expect(analysis.staleReferencesByPageId.page01).toEqual([])
    expect(analysis.staleReferencesByPageId.page02).toEqual([])
    expect(analysis.brokenNavigationPageIds).toEqual(['page01', 'page02'])
  })

  it('counts delete impact across surviving pages and Global config only', () => {
    const source: ProjectSource = {
      globalConfig: createArcadeSourceFile('<Link href="page02">Shared nav</Link>', ''),
      pages: [
        createArcadePage(
          'page01',
          'Page 1',
          createArcadeSourceFile("<Button onClick={() => goToPage('page02')}>Go</Button>", '')
        ),
        createArcadePage('page02', 'Details', createArcadeSourceFile('<Link href="page02">Self</Link>', '')),
      ],
      startPageId: 'page01',
      nextPageNumber: 3,
    }

    expect(getDeletePageImpact(source, 'page02')).toEqual({
      referenceCount: 2,
      pageCount: 1,
      globalConfigReferenceCount: 1,
    })
  })
})

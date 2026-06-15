import { describe, expect, it } from 'vitest'
import { CURRENT_PROJECT_VERSION, type Project } from '@/types/project'
import {
  FIRST_PAGE_ID,
  createPage,
  createSinglePageProjectSource,
  deletePage,
  getActiveSource,
  getSourceForEditTarget,
  renamePage,
  resolveSelectedEditTarget,
  setStartPage,
  updateGlobalConfigSource,
  updateSourceForEditTarget,
} from '@/services/projectSource'

const createTestProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Project source test',
  source: createSinglePageProjectSource('<Box>Page 1</Box>', 'export const usePage = () => "one"'),
  activePageId: FIRST_PAGE_ID,
  viewportSize: 'MD',
  panelLayout: 'editor-left',
  version: CURRENT_PROJECT_VERSION,
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
})

describe('projectSource service', () => {
  it('creates the canonical migrated single-page source with Page 1 and empty global config', () => {
    const source = createSinglePageProjectSource('<Box>Legacy JSX</Box>', 'export const useLegacy = () => "legacy"')

    expect(source).toEqual({
      globalConfig: { jsx: '', hooks: '' },
      pages: [
        {
          id: FIRST_PAGE_ID,
          name: 'Page 1',
          source: {
            jsx: '<Box>Legacy JSX</Box>',
            hooks: 'export const useLegacy = () => "legacy"',
          },
        },
      ],
      startPageId: FIRST_PAGE_ID,
      nextPageNumber: 2,
    })
  })

  it('never reuses a page id after delete, even when the deleted page was the highest id', () => {
    const project = createTestProject()
    const withPage02 = createPage(project)
    const withPage03 = createPage(withPage02)
    const deletedHighestPage = deletePage(withPage03, 'page03')
    const withNewPage = createPage(deletedHighestPage)

    expect(withNewPage.source.pages.map((page) => page.id)).toEqual(['page01', 'page02', 'page04'])
    expect(withNewPage.activePageId).toBe('page04')
    expect(withNewPage.source.nextPageNumber).toBe(5)
  })

  it('changes only the display name on rename and reassigns the start page to the first remaining page on delete', () => {
    const project = createTestProject()
    const withPage02 = createPage(project)
    const renamed = renamePage(withPage02, 'page02', 'Details')
    const withStartPage02 = setStartPage(renamed, 'page02')
    const deletedStartPage = deletePage(withStartPage02, 'page02')

    expect(renamed.source.pages).toEqual([
      {
        id: 'page01',
        name: 'Page 1',
        source: { jsx: '<Box>Page 1</Box>', hooks: 'export const usePage = () => "one"' },
      },
      {
        id: 'page02',
        name: 'Details',
        source: { jsx: '', hooks: '' },
      },
    ])
    expect(deletedStartPage.source.startPageId).toBe('page01')
    expect(deletedStartPage.activePageId).toBe('page01')
    expect(deletedStartPage.source.pages.map((page) => page.id)).toEqual(['page01'])
  })

  it('rejects deleting the last remaining page', () => {
    expect(() => deletePage(createTestProject(), 'page01')).toThrow(
      'Cannot delete the last remaining Arcade page'
    )
  })

  it('reads and writes the selected edit target without mutating the other source', () => {
    const project = updateGlobalConfigSource(createTestProject(), {
      jsx: '<Box>Shared chrome</Box>',
      hooks: 'export const useShared = () => "shared"',
    })

    expect(getSourceForEditTarget(project, 'global-config')).toEqual({
      jsx: '<Box>Shared chrome</Box>',
      hooks: 'export const useShared = () => "shared"',
    })

    const updatedGlobalConfig = updateSourceForEditTarget(project, 'global-config', {
      jsx: '<Box>Updated shared chrome</Box>',
    })

    expect(updatedGlobalConfig.source.globalConfig.jsx).toBe('<Box>Updated shared chrome</Box>')
    expect(getActiveSource(updatedGlobalConfig).jsx).toBe('<Box>Page 1</Box>')
  })

  it('keeps the selected edit target on the canonical pages-based model', () => {
    expect(resolveSelectedEditTarget('global-config')).toBe('global-config')
    expect(resolveSelectedEditTarget('page')).toBe('page')
  })
})

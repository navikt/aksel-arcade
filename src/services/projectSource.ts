import type {
  ArcadePage,
  ArcadePageId,
  ArcadeSourceFile,
  Project,
  ProjectSource,
  SelectedEditTarget,
} from '@/types/project'

export const FIRST_PAGE_ID = 'page01' as const
export const FIRST_PAGE_NAME = 'Page 1' as const

const PAGE_ID_PATTERN = /^page(\d+)$/

export const createArcadeSourceFile = (jsx = '', hooks = ''): ArcadeSourceFile => ({
  jsx,
  hooks,
})

export const cloneArcadeSourceFile = (source: ArcadeSourceFile): ArcadeSourceFile => ({
  jsx: source.jsx,
  hooks: source.hooks,
})

export const createArcadePage = (
  id: ArcadePageId,
  name: string,
  source: ArcadeSourceFile = createArcadeSourceFile()
): ArcadePage => ({
  id,
  name,
  source: cloneArcadeSourceFile(source),
})

export const cloneArcadePage = (page: ArcadePage): ArcadePage => ({
  id: page.id,
  name: page.name,
  source: cloneArcadeSourceFile(page.source),
})

export const cloneProjectSource = (source: ProjectSource): ProjectSource => ({
  globalConfig: cloneArcadeSourceFile(source.globalConfig),
  pages: source.pages.map(cloneArcadePage),
  startPageId: source.startPageId,
  nextPageNumber: source.nextPageNumber,
})

export const createSinglePageProjectSource = (jsxCode: string, hooksCode: string): ProjectSource => ({
  globalConfig: createArcadeSourceFile(),
  pages: [createArcadePage(FIRST_PAGE_ID, FIRST_PAGE_NAME, createArcadeSourceFile(jsxCode, hooksCode))],
  startPageId: FIRST_PAGE_ID,
  nextPageNumber: 2,
})

export const isArcadePageId = (value: unknown): value is ArcadePageId =>
  typeof value === 'string' && PAGE_ID_PATTERN.test(value)

export const getPageById = (
  source: Pick<ProjectSource, 'pages'>,
  pageId: ArcadePageId
): ArcadePage | undefined => source.pages.find((page) => page.id === pageId)

export const getFirstPage = (source: Pick<ProjectSource, 'pages'>): ArcadePage => {
  const firstPage = source.pages[0]
  if (!firstPage) {
    throw new Error('Arcade project source must contain at least one page')
  }

  return firstPage
}

export const getStartPage = (project: Pick<Project, 'source'>): ArcadePage =>
  getPageById(project.source, project.source.startPageId) ?? getFirstPage(project.source)

export const getActivePage = (project: Pick<Project, 'source' | 'activePageId'>): ArcadePage =>
  getPageById(project.source, project.activePageId) ??
  getPageById(project.source, project.source.startPageId) ??
  getFirstPage(project.source)

export const getStartPageSource = (project: Pick<Project, 'source'>): ArcadeSourceFile =>
  getStartPage(project).source

export const getActiveSource = (
  project: Pick<Project, 'source' | 'activePageId'>
): ArcadeSourceFile => getActivePage(project).source

export const getSourceForEditTarget = (
  project: Pick<Project, 'source' | 'activePageId'>,
  editTarget: SelectedEditTarget
): ArcadeSourceFile =>
  editTarget === 'global-config' ? project.source.globalConfig : getActiveSource(project)

export const updatePageSource = (
  project: Project,
  pageId: ArcadePageId,
  updates: Partial<ArcadeSourceFile>
): Project => {
  let didUpdate = false
  const pages = project.source.pages.map((page) => {
    if (page.id !== pageId) {
      return page
    }

    didUpdate = true
    return {
      ...page,
      source: {
        jsx: updates.jsx ?? page.source.jsx,
        hooks: updates.hooks ?? page.source.hooks,
      },
    }
  })

  if (!didUpdate) {
    throw new Error(`Unknown Arcade page "${pageId}"`)
  }

  return {
    ...project,
    source: {
      ...project.source,
      pages,
    },
  }
}

export const updateActivePageSource = (
  project: Project,
  updates: Partial<ArcadeSourceFile>
): Project => updatePageSource(project, getActivePage(project).id, updates)

export const updateGlobalConfigSource = (
  project: Project,
  updates: Partial<ArcadeSourceFile>
): Project => ({
  ...project,
  source: {
    ...project.source,
    globalConfig: {
      jsx: updates.jsx ?? project.source.globalConfig.jsx,
      hooks: updates.hooks ?? project.source.globalConfig.hooks,
    },
  },
})

export const updateSourceForEditTarget = (
  project: Project,
  editTarget: SelectedEditTarget,
  updates: Partial<ArcadeSourceFile>
): Project =>
  editTarget === 'global-config'
    ? updateGlobalConfigSource(project, updates)
    : updateActivePageSource(project, updates)

export const resolveSelectedEditTarget = (
  multiPageEnabled: boolean,
  selectedEditTarget: SelectedEditTarget
): SelectedEditTarget => (multiPageEnabled ? selectedEditTarget : 'page')

export const nextPageId = (source: Pick<ProjectSource, 'nextPageNumber'>): ArcadePageId =>
  formatPageId(source.nextPageNumber)

export const createPage = (project: Project): Project => {
  const pageId = nextPageId(project.source)
  const pageNumber = project.source.nextPageNumber

  return {
    ...project,
    source: {
      ...project.source,
      pages: [
        ...project.source.pages,
        createArcadePage(pageId, `Page ${pageNumber}`, createArcadeSourceFile()),
      ],
      nextPageNumber: project.source.nextPageNumber + 1,
    },
    activePageId: pageId,
  }
}

export const renamePage = (project: Project, pageId: ArcadePageId, name: string): Project => {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('Arcade page name must not be empty')
  }

  let didUpdate = false
  const pages = project.source.pages.map((page) => {
    if (page.id !== pageId) {
      return page
    }

    didUpdate = true
    return {
      ...page,
      name: normalizedName,
    }
  })

  if (!didUpdate) {
    throw new Error(`Unknown Arcade page "${pageId}"`)
  }

  return {
    ...project,
    source: {
      ...project.source,
      pages,
    },
  }
}

export const deletePage = (project: Project, pageId: ArcadePageId): Project => {
  if (!getPageById(project.source, pageId)) {
    throw new Error(`Unknown Arcade page "${pageId}"`)
  }

  if (project.source.pages.length <= 1) {
    throw new Error('Cannot delete the last remaining Arcade page')
  }

  const pages = project.source.pages.filter((page) => page.id !== pageId)
  const firstRemainingPage = getFirstPage({ pages })
  const startPageId =
    project.source.startPageId === pageId ? firstRemainingPage.id : project.source.startPageId
  const activePageId = project.activePageId === pageId ? startPageId : project.activePageId

  return normalizeProjectSelection({
    ...project,
    source: {
      ...project.source,
      pages,
      startPageId,
    },
    activePageId,
  })
}

export const setStartPage = (project: Project, pageId: ArcadePageId): Project => {
  if (!getPageById(project.source, pageId)) {
    throw new Error(`Unknown Arcade page "${pageId}"`)
  }

  return {
    ...project,
    source: {
      ...project.source,
      startPageId: pageId,
    },
  }
}

export const setActivePage = (project: Project, pageId: ArcadePageId): Project => {
  if (!getPageById(project.source, pageId)) {
    throw new Error(`Unknown Arcade page "${pageId}"`)
  }

  return {
    ...project,
    activePageId: pageId,
  }
}

export const normalizeProjectSelection = (project: Project): Project => {
  const firstPage = getFirstPage(project.source)
  const startPageId = getPageById(project.source, project.source.startPageId)?.id ?? firstPage.id
  const activePageId = getPageById(project.source, project.activePageId)?.id ?? startPageId
  const currentNextPageNumber =
    Number.isInteger(project.source.nextPageNumber) && project.source.nextPageNumber > 1
      ? project.source.nextPageNumber
      : getHighestPageNumber(project.source.pages) + 1
  const nextPageNumber = Math.max(currentNextPageNumber, getHighestPageNumber(project.source.pages) + 1)

  if (
    startPageId === project.source.startPageId &&
    activePageId === project.activePageId &&
    nextPageNumber === project.source.nextPageNumber
  ) {
    return project
  }

  return {
    ...project,
    source: {
      ...project.source,
      startPageId,
      nextPageNumber,
    },
    activePageId,
  }
}

const getHighestPageNumber = (pages: ArcadePage[]): number =>
  pages.reduce((maxPageNumber, page) => Math.max(maxPageNumber, parsePageIdNumber(page.id) ?? 0), 0)

const parsePageIdNumber = (pageId: string): number | null => {
  const match = pageId.match(PAGE_ID_PATTERN)
  if (!match) {
    return null
  }

  return Number.parseInt(match[1], 10)
}

const formatPageId = (pageNumber: number): ArcadePageId =>
  `page${String(pageNumber).padStart(2, '0')}` as ArcadePageId

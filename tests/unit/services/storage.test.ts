import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveProject,
  loadProject,
  exportProject,
  createArcadeProjectPackage,
  importProject,
  validateProjectSize,
  ARCADE_PROJECT_IMPORT_ACCEPT,
  ARCADE_PROJECT_PACKAGE_EXTENSION,
  ARCADE_PROJECT_PACKAGE_FORMAT,
  ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
  ARCADE_PROJECT_PACKAGE_MIME_TYPE,
  DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
  WEB_ARCADE_WORKING_COPY_STORAGE_KEY,
  type WebArcadeWorkingCopyPreferences,
} from '@/services/storage'
import { CURRENT_PROJECT_VERSION, type Project } from '@/types/project'
import {
  FIRST_PAGE_ID,
  createArcadePage,
  createArcadeSourceFile,
  createSinglePageProjectSource,
  getStartPageSource,
} from '@/services/projectSource'
import {
  setupLocalStorageMock,
  setupSessionStorageMock,
  resetLocalStorageMock,
  resetSessionStorageMock,
  type MockSessionStorage,
} from '../../helpers/mockLocalStorage'

const createTestProject = (
  overrides: Partial<Project> & { jsxCode?: string; hooksCode?: string } = {}
): Project => {
  const {
    jsxCode = '<Button>Test</Button>',
    hooksCode = '',
    source,
    activePageId = FIRST_PAGE_ID,
    version = CURRENT_PROJECT_VERSION,
    ...projectOverrides
  } = overrides

  return {
    id: crypto.randomUUID(),
    name: 'Test Project',
    source: source ?? createSinglePageProjectSource(jsxCode, hooksCode),
    activePageId,
    viewportSize: 'MD',
    panelLayout: 'editor-left',
    version,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    ...projectOverrides,
  }
}

const createLegacyPortableProject = (project: Project) => ({
  version: project.version,
  id: project.id,
  name: project.name,
  createdAt: project.createdAt,
  lastModified: project.lastModified,
  code: {
    jsxCode: getStartPageSource(project).jsx,
    hooksCode: getStartPageSource(project).hooks,
  },
  ui: {
    viewportSize: project.viewportSize,
    panelLayout: project.panelLayout,
  },
})

const createLegacySinglePagePackage = (project: Project) => ({
  format: ARCADE_PROJECT_PACKAGE_FORMAT,
  formatVersion: 2,
  project: {
    name: project.name,
    source: {
      jsx: getStartPageSource(project).jsx,
      hooks: getStartPageSource(project).hooks,
    },
    preview: {
      viewport: project.viewportSize,
    },
  },
})

const createLegacyPortablePackage = (project: Project) => ({
  format: ARCADE_PROJECT_PACKAGE_FORMAT,
  formatVersion: 1,
  project: createLegacyPortableProject(project),
})

const getPrimarySource = (project: Project) => getStartPageSource(project)

const createLossyMultiPageProject = (
  overrides: Partial<Project> = {}
): Project =>
  createTestProject({
    name: 'Lossy Multi-page Project',
    source: {
      globalConfig: createArcadeSourceFile(
        'const SharedChrome = () => <Box>Shared chrome</Box>',
        'export const sharedConfig = "shared"'
      ),
      pages: [
        createArcadePage(
          FIRST_PAGE_ID,
          'Page 1',
          createArcadeSourceFile(
            '<Box>Non-start page</Box>',
            'export const useFirstPage = () => "first"'
          )
        ),
        createArcadePage(
          'page02',
          'Page 2',
          createArcadeSourceFile(
            '<Box>Portable start page</Box>',
            'export const usePortableStartPage = () => "start"'
          )
        ),
      ],
      startPageId: 'page02',
      nextPageNumber: 3,
    },
    activePageId: 'page02',
    ...overrides,
  })

const createLegacyStoredProject = (project: Project) => ({
  version: '1.0.0',
  id: project.id,
  name: project.name,
  jsxCode: getPrimarySource(project).jsx,
  hooksCode: getPrimarySource(project).hooks,
  viewportSize: project.viewportSize,
  panelLayout: project.panelLayout,
  createdAt: project.createdAt,
  lastModified: project.lastModified,
})

const collectObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys)
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectObjectKeys(nestedValue),
  ])
}

describe('Storage Service', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    setupSessionStorageMock()
    resetLocalStorageMock()
    resetSessionStorageMock()
  })

  describe('saveProject', () => {
    it('should save valid project to tab-scoped sessionStorage', () => {
      const project = createTestProject()

      const result = saveProject(project)

      expect(result.success).toBe(true)
      expect(result.sizeBytes).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()

      // Verify the browser-wide legacy key is ignored and not written.
      expect(localStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)).toBeNull()

      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.project.name).toBe('Test Project')
      expect(parsed.preferences).toEqual({
        theme: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.theme,
        panelOrder: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.panelOrder,
        pagePanelOpen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen,
        selectedEditTarget: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget,
        previewFullscreen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.previewFullscreen,
      })
    })

    it('should reject projects larger than 5MB', () => {
      const largeCode = 'x'.repeat(6 * 1024 * 1024) // 6MB
      const project = createTestProject({
        name: 'Large Project',
        jsxCode: largeCode,
      })

      const result = saveProject(project)

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds 5MB limit')
    })

    it('should warn when project size approaches 4MB', () => {
      const largeCode = 'x'.repeat(4.5 * 1024 * 1024) // 4.5MB
      const project = createTestProject({
        name: 'Large Project',
        jsxCode: largeCode,
      })

      const result = saveProject(project)

      expect(result.success).toBe(true)
      expect(result.warning).toContain('approaching 5MB limit')
    })

    it('should reject invalid project schema', () => {
      const invalidProject = {
        id: 'not-a-uuid',
        name: '',
        jsxCode: 123, // Should be string
      } as unknown as Project

      const result = saveProject(invalidProject)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Validation error')
    })

    it('should update lastModified timestamp', () => {
      const project = createTestProject({
        createdAt: '2025-01-01T00:00:00.000Z',
        lastModified: '2025-01-01T00:00:00.000Z',
      })

      const result = saveProject(project)
      expect(result.success).toBe(true)

      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const parsed = JSON.parse(stored!)

      // lastModified should be updated to current time
      expect(parsed.project.lastModified).not.toBe('2025-01-01T00:00:00.000Z')
      expect(new Date(parsed.project.lastModified).getTime()).toBeGreaterThan(
        new Date('2025-01-01T00:00:00.000Z').getTime()
      )
    })

    it('preserves lastModified when saving workspace-only preference changes', () => {
      const project = createTestProject({
        createdAt: '2025-01-01T00:00:00.000Z',
        lastModified: '2025-01-02T00:00:00.000Z',
      })

      const result = saveProject(project, {
        updateLastModified: false,
        preferences: {
          ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
          previewFullscreen: true,
        },
      })

      expect(result.success).toBe(true)

      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const parsed = JSON.parse(stored!)

      expect(parsed.project.lastModified).toBe('2025-01-02T00:00:00.000Z')
      expect(parsed.preferences.previewFullscreen).toBe(true)
    })

    it('should save Web Arcade working copy preferences with the project', () => {
      const project = createTestProject({
        name: 'Preference Project',
        viewportSize: 'XL',
        panelLayout: 'editor-right',
      })
      const preferences: WebArcadeWorkingCopyPreferences = {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: true,
        previewFullscreen: true,
      }

      const result = saveProject(project, { preferences })

      expect(result.success).toBe(true)
      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const parsed = JSON.parse(stored!)
      expect(parsed.project).toMatchObject({
        name: 'Preference Project',
        viewportSize: 'XL',
        panelLayout: 'editor-right',
      })
      expect(parsed.preferences).toEqual({
        theme: 'light',
        panelOrder: 'preview-left',
        pagePanelOpen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen,
        selectedEditTarget: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget,
        previewFullscreen: true,
      })
      expect(parsed.preferences).not.toHaveProperty('multiPageEnabled')
    })
  })

  describe('loadProject', () => {
    it('should return default project when storage is empty', () => {
      const result = loadProject()

      expect(result.project).toBeTruthy()
      expect(result.fromStorage).toBe(false)
      expect(result.migrated).toBe(false)
      expect(result.error).toBeUndefined()
      expect(result.project!.name).toBe('Untitled Project')
      expect(result.preferences).toEqual(DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES)
      expect(result.preferences.pagePanelOpen).toBe(false)
    })

    it('should restore saved project correctly', () => {
      const project = createTestProject({
        name: 'My Saved Project',
        jsxCode: '<Box>Content</Box>',
        hooksCode: 'const useCustom = () => {}',
        viewportSize: 'LG',
        panelLayout: 'editor-right',
      })

      saveProject(project)
      const result = loadProject()

      expect(result.project).toBeTruthy()
      expect(result.fromStorage).toBe(true)
      expect(result.project!.name).toBe('My Saved Project')
      expect(getPrimarySource(result.project!).jsx).toBe('<Box>Content</Box>')
      expect(getPrimarySource(result.project!).hooks).toBe('const useCustom = () => {}')
      expect(result.project!.viewportSize).toBe('LG')
      expect(result.project!.panelLayout).toBe('editor-right')
    })

    it('migrates legacy single-page projects to the canonical pages source', () => {
      const legacyProject = createLegacyStoredProject(
        createTestProject({
          name: 'Legacy Migrated Project',
          jsxCode: '<Box>Legacy JSX</Box>',
          hooksCode: 'export const useLegacy = () => "legacy"',
          viewportSize: 'LG',
        })
      )
      sessionStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, JSON.stringify(legacyProject))

      const result = loadProject()

      expect(result.fromStorage).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.migrated).toBe(true)
      expect(result.project).toMatchObject({
        name: 'Legacy Migrated Project',
        activePageId: FIRST_PAGE_ID,
        viewportSize: 'LG',
        source: {
          globalConfig: { jsx: '', hooks: '' },
          startPageId: FIRST_PAGE_ID,
          nextPageNumber: 2,
        },
      })
      expect(result.project?.source.pages).toEqual([
        {
          id: FIRST_PAGE_ID,
          name: 'Page 1',
          source: {
            jsx: '<Box>Legacy JSX</Box>',
            hooks: 'export const useLegacy = () => "legacy"',
          },
        },
      ])
    })

    it('should handle corrupted JSON gracefully', () => {
      sessionStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, '{invalid json')

      const result = loadProject()

      expect(result.project).toBeNull()
      expect(result.fromStorage).toBe(true)
      expect(result.error).toContain('Failed to parse')
    })

    it('should handle invalid project schema', () => {
      const invalid = { id: 'bad', name: 123 }
      sessionStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, JSON.stringify(invalid))

      const result = loadProject()

      expect(result.project).toBeNull()
      expect(result.error).toContain('Migration failed')
    })

    it('should ignore legacy browser-wide saved project data', () => {
      const legacyProject = createTestProject({
        name: 'Legacy browser-wide project',
        jsxCode: '<Box>Legacy should be ignored</Box>',
      })
      localStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, JSON.stringify(legacyProject))

      const result = loadProject()

      expect(result.fromStorage).toBe(false)
      expect(result.project).toBeTruthy()
      expect(result.project!.name).toBe('Untitled Project')
      expect(getPrimarySource(result.project!).jsx).not.toContain('Legacy should be ignored')
      expect(localStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)).toBeTruthy()
    })

    it('should restore tab-scoped Web Arcade working copy preferences', () => {
      const project = createTestProject({
        name: 'Restored working copy',
        viewportSize: 'LG',
        panelLayout: 'editor-right',
      })
      const preferences: WebArcadeWorkingCopyPreferences = {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: true,
        previewFullscreen: true,
      }

      saveProject(project, { preferences })
      const result = loadProject()

      expect(result.fromStorage).toBe(true)
      expect(result.project).toMatchObject({
        name: 'Restored working copy',
        viewportSize: 'LG',
        panelLayout: 'editor-right',
      })
      expect(result.preferences).toEqual({
        ...preferences,
        multiPageEnabled: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.multiPageEnabled,
      })
    })

    it('defaults newer workspace preferences when restoring older working copies', () => {
      const project = createTestProject({ name: 'Older stored preferences' })
      saveProject(project, {
        preferences: {
          ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
          theme: 'light',
          panelOrder: 'preview-left',
          multiPageEnabled: true,
        },
      })

      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const parsed = JSON.parse(stored!)
      delete parsed.preferences.pagePanelOpen
      delete parsed.preferences.selectedEditTarget
      delete parsed.preferences.previewFullscreen
      sessionStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, JSON.stringify(parsed))

      const result = loadProject()

      expect(result.preferences).toEqual({
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.multiPageEnabled,
        pagePanelOpen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen,
        selectedEditTarget: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget,
        previewFullscreen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.previewFullscreen,
      })
    })

    it('restores legacy multiPageEnabled false working copies as permanent pages-enabled sessions', () => {
      const project = createTestProject({ name: 'Legacy false multi-page preference' })
      saveProject(project)

      const stored = sessionStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const parsed = JSON.parse(stored!)
      parsed.preferences.multiPageEnabled = false
      sessionStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, JSON.stringify(parsed))

      const result = loadProject()

      expect(result.preferences.multiPageEnabled).toBe(true)
    })

    it('should model duplicated tabs as forked sessionStorage working copies', () => {
      const originalTabStorage = setupSessionStorageMock()
      const initialProject = createTestProject({
        name: 'Duplicated source tab',
        jsxCode: '<Box>Original JSX</Box>',
        hooksCode: 'export const useOriginal = () => "original"',
        viewportSize: 'XL',
        panelLayout: 'editor-right',
      })
      const initialPreferences: WebArcadeWorkingCopyPreferences = {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: true,
        previewFullscreen: true,
      }
      saveProject(initialProject, { preferences: initialPreferences })

      const duplicatedPayload = originalTabStorage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
      const duplicatedTabStorage = setupSessionStorageMock()
      duplicatedTabStorage.setItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY, duplicatedPayload!)

      const duplicatedLoad = loadProject()
      expect(duplicatedLoad.project).toMatchObject({
        name: 'Duplicated source tab',
        viewportSize: 'XL',
        panelLayout: 'editor-right',
      })
      expect(getPrimarySource(duplicatedLoad.project!).jsx).toBe('<Box>Original JSX</Box>')
      expect(getPrimarySource(duplicatedLoad.project!).hooks).toBe(
        'export const useOriginal = () => "original"'
      )
      expect(duplicatedLoad.preferences).toEqual({
        ...initialPreferences,
        multiPageEnabled: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.multiPageEnabled,
      })

      saveProject(
        {
          ...duplicatedLoad.project!,
          name: 'Duplicated tab edit',
          source: createSinglePageProjectSource(
            '<Box>Duplicate tab JSX</Box>',
            getPrimarySource(duplicatedLoad.project!).hooks
          ),
          viewportSize: 'SM',
        },
        {
          preferences: {
            ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
            theme: 'dark',
            panelOrder: 'code-left',
            multiPageEnabled: false,
            previewFullscreen: false,
          },
        }
      )

      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalTabStorage,
        configurable: true,
        writable: true,
      })
      saveProject(
        {
          ...initialProject,
          name: 'Original tab edit',
          source: createSinglePageProjectSource(
            getPrimarySource(initialProject).jsx,
            'export const useOriginal = () => "edited original"'
          ),
          panelLayout: 'editor-left',
        },
        { preferences: initialPreferences }
      )

      const originalStored = parseStoredProject(originalTabStorage)
      const duplicatedStored = parseStoredProject(duplicatedTabStorage)
      expect(originalStored.project).toMatchObject({
        name: 'Original tab edit',
        viewportSize: 'XL',
        panelLayout: 'editor-left',
      })
      expect(getPrimarySource(originalStored.project).jsx).toBe('<Box>Original JSX</Box>')
      expect(getPrimarySource(originalStored.project).hooks).toBe(
        'export const useOriginal = () => "edited original"'
      )
      expect(originalStored.preferences).toEqual({
        theme: 'light',
        panelOrder: 'preview-left',
        pagePanelOpen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen,
        selectedEditTarget: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget,
        previewFullscreen: true,
      })
      expect(duplicatedStored.project).toMatchObject({
        name: 'Duplicated tab edit',
        viewportSize: 'SM',
        panelLayout: 'editor-right',
      })
      expect(getPrimarySource(duplicatedStored.project).jsx).toBe('<Box>Duplicate tab JSX</Box>')
      expect(getPrimarySource(duplicatedStored.project).hooks).toBe(
        'export const useOriginal = () => "original"'
      )
      expect(duplicatedStored.preferences).toEqual({
        theme: 'dark',
        panelOrder: 'code-left',
        pagePanelOpen: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.pagePanelOpen,
        selectedEditTarget: DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.selectedEditTarget,
        previewFullscreen: false,
      })
    })
  })

  describe('validateProjectSize', () => {
    it('should calculate project size correctly', () => {
      const project = createTestProject({
        name: 'Test',
        jsxCode: 'x'.repeat(1000),
        hooksCode: 'y'.repeat(1000),
      })

      const result = validateProjectSize(project)

      expect(result.valid).toBe(true)
      expect(result.sizeBytes).toBeGreaterThan(2000) // At least the code size
      expect(result.warning).toBeUndefined()
    })

    it('should mark projects > 5MB as invalid', () => {
      const project = createTestProject({
        name: 'Huge Project',
        jsxCode: 'x'.repeat(6 * 1024 * 1024),
      })

      const result = validateProjectSize(project)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('exceeds 5MB limit')
    })

    it('should warn for projects > 4MB', () => {
      const project = createTestProject({
        name: 'Large Project',
        jsxCode: 'x'.repeat(4.5 * 1024 * 1024),
      })

      const result = validateProjectSize(project)

      expect(result.valid).toBe(true)
      expect(result.warning).toContain('approaching 5MB limit')
    })
  })

  describe('exportProject', () => {
    it('should create a downloadable Arcade project package blob', () => {
      // Mock URL.createObjectURL
      const mockUrl = 'blob:mock-url'
      const capturedBlobs: Blob[] = []
      global.URL.createObjectURL = ((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          capturedBlobs.push(blob)
        }
        return mockUrl
      }) as typeof URL.createObjectURL
      global.URL.revokeObjectURL = () => {}

      // Mock document.createElement to capture download
      let capturedHref = ''
      let capturedDownload = ''
      let clickCalled = false

      const mockAnchor = {
        set href(value: string) {
          capturedHref = value
        },
        get href() {
          return capturedHref
        },
        set download(value: string) {
          capturedDownload = value
        },
        get download() {
          return capturedDownload
        },
        click: () => {
          clickCalled = true
        },
      }

      const originalCreateElement = document.createElement.bind(document)
      document.createElement = ((tagName: string) => {
        if (tagName === 'a') return mockAnchor as unknown as HTMLAnchorElement
        return originalCreateElement(tagName)
      }) as typeof document.createElement

      const project = createTestProject({
        name: 'Export Test',
        jsxCode: '<Button>Click</Button>',
      })

      exportProject(project)

      expect(capturedHref).toBe(mockUrl)
      expect(capturedDownload).toContain('export-test')
      expect(capturedDownload).toContain(ARCADE_PROJECT_PACKAGE_EXTENSION)
      const capturedBlob = capturedBlobs[0]
      if (!capturedBlob) {
        throw new Error('Expected exportProject to create a package blob')
      }
      expect(capturedBlob.type).toBe(ARCADE_PROJECT_PACKAGE_MIME_TYPE)
      expect(clickCalled).toBe(true)

      // Cleanup
      document.createElement = originalCreateElement
    })

    it('creates clean package data with current project content only', () => {
      const project = {
        ...createTestProject({
          name: 'Portable Package Test',
          jsxCode: '<HStack><Button>Click</Button></HStack>',
          hooksCode: 'export const useCounter = () => 1',
          viewportSize: 'LG',
          panelLayout: 'editor-right',
        }),
        agentSession: {
          id: 'agent-session-secret',
          credential: 'credential-secret',
          endpoint: 'http://127.0.0.1:1234',
        },
        agentPermissions: ['read', 'write'],
        checkpoints: [{ id: 'checkpoint-secret', summary: 'rollback-secret' }],
        diagnostics: [{ message: 'diagnostic-secret' }],
        previewEvidence: { dom: 'evidence-secret' },
        transport: { token: 'transport-secret' },
      } as Project & Record<string, unknown>

      const packageData = createArcadeProjectPackage(project)
      const serialized = JSON.stringify(packageData)

      expect(packageData).toEqual({
        format: ARCADE_PROJECT_PACKAGE_FORMAT,
        formatVersion: ARCADE_PROJECT_PACKAGE_FORMAT_VERSION,
        project: {
          name: 'Portable Package Test',
          source: {
            globalConfig: {
              jsx: '',
              hooks: '',
            },
            pages: [
              {
                id: FIRST_PAGE_ID,
                name: 'Page 1',
                source: {
                  jsx: '<HStack><Button>Click</Button></HStack>',
                  hooks: 'export const useCounter = () => 1',
                },
              },
            ],
            startPageId: FIRST_PAGE_ID,
            nextPageNumber: 2,
          },
          preview: {
            viewport: 'LG',
          },
        },
      })
      expect(serialized).not.toContain('agent-session-secret')
      expect(serialized).not.toContain('credential-secret')
      expect(serialized).not.toContain('http://127.0.0.1:1234')
      expect(serialized).not.toContain('checkpoint-secret')
      expect(serialized).not.toContain('rollback-secret')
      expect(serialized).not.toContain('diagnostic-secret')
      expect(serialized).not.toContain('evidence-secret')
      expect(serialized).not.toContain('transport-secret')
      expect(serialized).not.toContain('multiPageEnabled')
      expect(serialized).not.toContain('openingIntent')
      expect(serialized).not.toContain('previewFullscreen')
      expect(serialized).not.toContain(project.id)
      expect(serialized).not.toContain(project.createdAt)
      expect(serialized).not.toContain(project.lastModified)
      expect(collectObjectKeys(packageData).join(' ')).not.toMatch(
        /agent|session|credential|endpoint|permission|checkpoint|diagnostic|evidence|transport|meta|exportedAt|createdAt|lastModified|panelLayout/i
      )
    })

    it('exports the full Arcade project source when a project contains multiple pages and Global config', () => {
      const project = createLossyMultiPageProject({
        name: 'Portable Multi-page Package',
      })

      const packageData = createArcadeProjectPackage(project)
      const serialized = JSON.stringify(packageData)

      expect(packageData.project).toEqual({
        name: 'Portable Multi-page Package',
        source: {
          globalConfig: {
            jsx: 'const SharedChrome = () => <Box>Shared chrome</Box>',
            hooks: 'export const sharedConfig = "shared"',
          },
          pages: [
            {
              id: FIRST_PAGE_ID,
              name: 'Page 1',
              source: {
                jsx: '<Box>Non-start page</Box>',
                hooks: 'export const useFirstPage = () => "first"',
              },
            },
            {
              id: 'page02',
              name: 'Page 2',
              source: {
                jsx: '<Box>Portable start page</Box>',
                hooks: 'export const usePortableStartPage = () => "start"',
              },
            },
          ],
          startPageId: 'page02',
          nextPageNumber: 3,
        },
        preview: {
          viewport: 'MD',
        },
      })
      expect(serialized).toContain('Non-start page')
      expect(serialized).toContain('Shared chrome')
      expect(serialized).toContain('sharedConfig')
      expect(serialized).toContain('useFirstPage')
    })

    it('exports the clean package shape without metadata', async () => {
      const mockUrl = 'blob:mock-url'
      let capturedBlob: Blob | null = null
      const originalCreateObjectURL = global.URL.createObjectURL
      const originalRevokeObjectURL = global.URL.revokeObjectURL

      global.URL.createObjectURL = ((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          capturedBlob = blob
        }
        return mockUrl
      }) as typeof URL.createObjectURL
      global.URL.revokeObjectURL = () => {}

      const project = createTestProject({
        name: 'Export Shape Test',
        jsxCode: '<HStack><Button>Click</Button></HStack>',
      })

      try {
        exportProject(project)

        if (!capturedBlob) {
          throw new Error('Expected exportProject to create a JSON blob')
        }

        const exportedText = await readBlobText(capturedBlob)
        const exported = JSON.parse(exportedText) as {
          format: string
          formatVersion: number
          project: {
            name: string
            source: {
              globalConfig: { jsx: string; hooks: string }
              pages: Array<{
                id: string
                name: string
                source: { jsx: string; hooks: string }
              }>
              startPageId: string
              nextPageNumber: number
            }
            preview: { viewport: string }
          }
        }

        expect(exported.format).toBe(ARCADE_PROJECT_PACKAGE_FORMAT)
        expect(exported.formatVersion).toBe(ARCADE_PROJECT_PACKAGE_FORMAT_VERSION)
        expect(exported.project).toEqual({
          name: 'Export Shape Test',
          source: {
            globalConfig: {
              jsx: '',
              hooks: '',
            },
            pages: [
              {
                id: FIRST_PAGE_ID,
                name: 'Page 1',
                source: {
                  jsx: '<HStack><Button>Click</Button></HStack>',
                  hooks: '',
                },
              },
            ],
            startPageId: FIRST_PAGE_ID,
            nextPageNumber: 2,
          },
          preview: {
            viewport: 'MD',
          },
        })
        expect(Object.keys(exported).sort()).toEqual(['format', 'formatVersion', 'project'])
        expect(Object.keys(exported.project).sort()).toEqual(['name', 'preview', 'source'])
        expect(Object.keys(exported.project.source).sort()).toEqual([
          'globalConfig',
          'nextPageNumber',
          'pages',
          'startPageId',
        ])
        expect(Object.keys(exported.project.preview)).toEqual(['viewport'])
        expect(exportedText).not.toContain(project.id)
        expect(exportedText).not.toMatch(
          /meta|AI|instruction|documentation|setup|production|exportedAt|createdAt|lastModified|panelLayout|diagnostic|evidence/i
        )
      } finally {
        global.URL.createObjectURL = originalCreateObjectURL
        global.URL.revokeObjectURL = originalRevokeObjectURL
      }
    })
  })

  const readBlobText = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })

  describe('importProject', () => {
    // Helper to create a mock File with working .text() method
    const createMockFile = (content: string, filename: string, type = 'application/json'): File => {
      const blob = new Blob([content], { type })
      const file = new File([blob], filename, { type })
      // Add text() method for jsdom compatibility
      Object.defineProperty(file, 'text', {
        value: async () => content,
      })
      return file
    }

    it('should import Arcade project packages from .akselarcade files', async () => {
      const sourceProject = createTestProject({
        name: 'Package Import Test',
        jsxCode: '<VStack><Heading>Packaged</Heading></VStack>',
        hooksCode: 'export const usePackaged = () => "ok"',
        viewportSize: 'XL',
        panelLayout: 'editor-right',
        createdAt: '2026-05-20T00:00:00.000Z',
        lastModified: '2026-05-21T00:00:00.000Z',
      })
      const packageData = createArcadeProjectPackage(sourceProject)

      const file = createMockFile(
        JSON.stringify(packageData),
        'package-import.akselarcade',
        ARCADE_PROJECT_PACKAGE_MIME_TYPE
      )

      const result = await importProject(file)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.project).toMatchObject({
        name: 'Package Import Test',
        viewportSize: 'XL',
        panelLayout: 'editor-left',
        version: CURRENT_PROJECT_VERSION,
        activePageId: FIRST_PAGE_ID,
      })
      expect(result.project!.source).toEqual(sourceProject.source)
      expect(getPrimarySource(result.project!).jsx).toBe('<VStack><Heading>Packaged</Heading></VStack>')
      expect(getPrimarySource(result.project!).hooks).toBe('export const usePackaged = () => "ok"')
      expect(result.project!.id).not.toBe(sourceProject.id)
      expect(result.project!.createdAt).not.toBe(sourceProject.createdAt)
      expect(new Date(result.project!.lastModified).getTime()).toBeGreaterThanOrEqual(
        new Date(sourceProject.lastModified).getTime()
      )
      expect(JSON.stringify(result.project)).not.toMatch(
        /agent-session-secret|credential-secret|127\.0\.0\.1|checkpoint-secret|diagnostic-secret|evidence-secret|transport-secret/
      )
      expect(collectObjectKeys(result.project).join(' ')).not.toMatch(
        /agent|session|credential|endpoint|permission|checkpoint|diagnostic|evidence|transport/i
      )
    })

    it('should validate the .akselarcade extension case-insensitively without trusting MIME', async () => {
      const sourceProject = createTestProject({
        name: 'Case-insensitive Package Import Test',
        jsxCode: '<Box>Case-insensitive package</Box>',
        hooksCode: 'export const useCaseInsensitivePackage = () => "ok"',
        viewportSize: 'SM',
      })
      const packageData = createArcadeProjectPackage(sourceProject)

      const file = createMockFile(
        JSON.stringify(packageData),
        'package-import.AKSELARCADE',
        'application/json'
      )

      const result = await importProject(file)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.project).toMatchObject({
        name: 'Case-insensitive Package Import Test',
        viewportSize: 'SM',
      })
      expect(getPrimarySource(result.project!).jsx).toBe('<Box>Case-insensitive package</Box>')
      expect(getPrimarySource(result.project!).hooks).toBe(
        'export const useCaseInsensitivePackage = () => "ok"'
      )
    })

    it('imports a full-source multi-page export losslessly as a multi-page Arcade project', async () => {
      const sourceProject = createLossyMultiPageProject({
        name: 'Portable Multi-page Import',
        viewportSize: 'XL',
      })
      const packageData = createArcadeProjectPackage(sourceProject)

      const file = createMockFile(
        JSON.stringify(packageData),
        'portable-multi-page.akselarcade',
        ARCADE_PROJECT_PACKAGE_MIME_TYPE
      )

      const result = await importProject(file)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.project).toMatchObject({
        name: 'Portable Multi-page Import',
        viewportSize: 'XL',
        activePageId: 'page02',
      })
      expect(result.project?.source).toEqual(sourceProject.source)
      expect(result.project?.source.pages).toHaveLength(2)
      expect(result.project?.source.startPageId).toBe('page02')
      expect(getPrimarySource(result.project!).jsx).toBe('<Box>Portable start page</Box>')
      expect(getPrimarySource(result.project!).hooks).toBe(
        'export const usePortableStartPage = () => "start"'
      )
    })

    it('rejects package data polluted with fullscreen-only share fields', async () => {
      const sourceProject = createTestProject({
        name: 'Fullscreen Boundary Package Import Test',
        jsxCode: '<Box>Fullscreen boundary package</Box>',
        hooksCode: 'export const useFullscreenBoundaryPackage = () => "ok"',
      })
      const cleanPackageData = createArcadeProjectPackage(sourceProject)
      const pollutedPackages: Array<{
        expectedField: string
        packageData: Record<string, unknown>
      }> = [
        {
          expectedField: 'openingIntent',
          packageData: {
            ...cleanPackageData,
            openingIntent: { previewFullscreen: true },
          },
        },
        {
          expectedField: 'previewFullscreen',
          packageData: {
            ...cleanPackageData,
            project: {
              ...cleanPackageData.project,
              preview: {
                ...cleanPackageData.project.preview,
                previewFullscreen: true,
              },
            },
          },
        },
      ]

      for (const { expectedField, packageData } of pollutedPackages) {
        const file = createMockFile(
          JSON.stringify(packageData),
          `fullscreen-boundary-${expectedField}.akselarcade`,
          ARCADE_PROJECT_PACKAGE_MIME_TYPE
        )

        const result = await importProject(file)

        expect(result.success).toBe(false)
        expect(result.project).toBeNull()
        expect(result.error).toContain('Package is not a clean .akselarcade Arcade project package')
        expect(result.error).toContain(expectedField)
      }
    })

    it('should reject clean package content when the file is not .akselarcade', async () => {
      const sourceProject = createTestProject({
        name: 'Wrong Extension Test',
        jsxCode: '<Box>Wrong extension</Box>',
      })
      const packageData = createArcadeProjectPackage(sourceProject)
      const file = createMockFile(JSON.stringify(packageData), 'package-import.json')

      const result = await importProject(file)

      expect(result.success).toBe(false)
      expect(result.project).toBeNull()
      expect(result.error).toContain('Only clean .akselarcade Arcade project packages')
    })

    it('should reject legacy raw JSON project files', async () => {
      const project = {
        ...createTestProject({
          name: 'Legacy Raw JSON Test',
          jsxCode: '<Box>Legacy raw JSON</Box>',
          viewportSize: 'SM',
          version: '1.0.0',
        }),
        agentSession: { credential: 'legacy-credential-secret' },
        diagnostics: [{ message: 'legacy-diagnostic-secret' }],
        transport: { endpoint: 'http://127.0.0.1:4321' },
      } satisfies Project & Record<string, unknown>

      const file = createMockFile(JSON.stringify(project), 'legacy-raw.akselarcade')

      const result = await importProject(file)

      expect(result.success).toBe(false)
      expect(result.project).toBeNull()
      expect(result.error).toContain('Package is not a clean .akselarcade Arcade project package')
      expect(result.error).toContain('Invalid clean Arcade project package fields')
      expect(result.error).toContain('"agentSession"')
    })

    it('imports legacy v2 single-page Arcade project packages as one-page projects', async () => {
      const sourceProject = createTestProject({
        name: 'Legacy v2 Package Import Test',
        jsxCode: '<Box>Legacy v2 package</Box>',
        hooksCode: 'export const useLegacyV2Package = () => "ok"',
        viewportSize: 'LG',
      })
      const legacyPackage = createLegacySinglePagePackage(sourceProject)

      const file = createMockFile(
        JSON.stringify(legacyPackage),
        'legacy-v2-package.akselarcade',
        ARCADE_PROJECT_PACKAGE_MIME_TYPE
      )

      const result = await importProject(file)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.project).toMatchObject({
        name: 'Legacy v2 Package Import Test',
        viewportSize: 'LG',
        panelLayout: 'editor-left',
        activePageId: FIRST_PAGE_ID,
      })
      expect(result.project?.source.pages).toHaveLength(1)
      expect(getPrimarySource(result.project!).jsx).toBe('<Box>Legacy v2 package</Box>')
      expect(getPrimarySource(result.project!).hooks).toBe(
        'export const useLegacyV2Package = () => "ok"'
      )
    })

    it('imports legacy v1 single-page Arcade project packages as one-page projects', async () => {
      const sourceProject = createTestProject({
        name: 'Legacy Package Import Test',
        jsxCode: '<Box>Legacy package</Box>',
        hooksCode: 'export const useLegacyPackage = () => "ok"',
        viewportSize: 'SM',
        panelLayout: 'editor-right',
      })
      const legacyPackage = createLegacyPortablePackage(sourceProject)

      const file = createMockFile(
        JSON.stringify(legacyPackage),
        'legacy-package.akselarcade',
        ARCADE_PROJECT_PACKAGE_MIME_TYPE
      )

      const result = await importProject(file)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.project).toMatchObject({
        name: 'Legacy Package Import Test',
        viewportSize: 'SM',
        panelLayout: 'editor-left',
        activePageId: FIRST_PAGE_ID,
      })
      expect(result.project?.source.pages).toHaveLength(1)
      expect(getPrimarySource(result.project!).jsx).toBe('<Box>Legacy package</Box>')
      expect(getPrimarySource(result.project!).hooks).toBe(
        'export const useLegacyPackage = () => "ok"'
      )
    })

    it('should reject noisy packages with metadata, identity, preferences, or unknown fields', async () => {
      const sourceProject = createTestProject({
        name: 'Noisy Package Test',
        jsxCode: '<Box>Noisy package</Box>',
        hooksCode: 'export const useNoisyPackage = () => "reject"',
        viewportSize: 'LG',
        panelLayout: 'editor-right',
      })
      const packageData = createArcadeProjectPackage(sourceProject)
      const noisyPackages = [
        {
          label: 'top-level metadata',
          payload: {
            ...packageData,
            meta: { aiInstructions: 'legacy-package-ai-secret' },
            exportedAt: '2026-05-20T00:00:00.000Z',
          },
          expectedField: '"meta"',
        },
        {
          label: 'project identity and workspace preferences',
          payload: {
            ...packageData,
            project: {
              ...packageData.project,
              id: sourceProject.id,
              createdAt: sourceProject.createdAt,
              lastModified: sourceProject.lastModified,
              panelLayout: 'editor-right',
            },
          },
          expectedField: '"id"',
        },
        {
          label: 'source diagnostics',
          payload: {
            ...packageData,
            project: {
              ...packageData.project,
              source: {
                ...packageData.project.source,
                diagnostics: [{ message: 'diagnostic-secret' }],
              },
            },
          },
          expectedField: '"diagnostics"',
        },
        {
          label: 'preview workspace state',
          payload: {
            ...packageData,
            project: {
              ...packageData.project,
              preview: {
                ...packageData.project.preview,
                zoom: 1,
              },
            },
          },
          expectedField: '"zoom"',
        },
      ]

      for (const noisyPackage of noisyPackages) {
        const file = createMockFile(
          JSON.stringify(noisyPackage.payload),
          `${noisyPackage.label}.akselarcade`,
          ARCADE_PROJECT_PACKAGE_MIME_TYPE
        )

        const result = await importProject(file)

        expect(result.success).toBe(false)
        expect(result.project).toBeNull()
        expect(result.error).toContain('Package is not a clean .akselarcade Arcade project package')
        expect(result.error).toContain('Invalid clean Arcade project')
        expect(result.error).toContain(noisyPackage.expectedField)
      }
    })

    it('should reject invalid JSON', async () => {
      const file = createMockFile('{invalid json', 'test.akselarcade')

      const result = await importProject(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid .akselarcade Arcade project package JSON')
    })

    it('should reject invalid project structure', async () => {
      const invalid = { id: 'bad', name: 123 }
      const json = JSON.stringify(invalid)
      const file = createMockFile(json, 'test.akselarcade')

      const result = await importProject(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Package is not a clean .akselarcade Arcade project package')
    })

    it('should expose only clean Arcade project package import file types', () => {
      expect(ARCADE_PROJECT_IMPORT_ACCEPT).toContain(ARCADE_PROJECT_PACKAGE_EXTENSION)
      expect(ARCADE_PROJECT_IMPORT_ACCEPT).toContain(ARCADE_PROJECT_PACKAGE_MIME_TYPE)
      expect(ARCADE_PROJECT_IMPORT_ACCEPT).not.toContain('.json')
      expect(ARCADE_PROJECT_IMPORT_ACCEPT).not.toContain('application/json')
    })
  })
})

const parseStoredProject = (storage: MockSessionStorage) => {
  const stored = storage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
  if (!stored) {
    throw new Error('Expected Web Arcade working copy to be stored')
  }
  return JSON.parse(stored) as {
    project: Project
    preferences: Partial<WebArcadeWorkingCopyPreferences>
  }
}

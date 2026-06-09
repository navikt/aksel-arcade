import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { useAutoSave } from '@/hooks/useAutoSave'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { createDefaultProject } from '@/utils/projectDefaults'
import {
  createShareSnapshot,
  DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
  saveProject,
  SNAPSHOT_FILE_IDS,
  WEB_ARCADE_WORKING_COPY_STORAGE_KEY,
  type WebArcadeWorkingCopyPreferences,
} from '@/services/storage'
import {
  encodeSharePayload,
  createShareToken,
  LEGACY_SHARE_FORMAT_VERSION,
} from '@/utils/shareEncoding'
import { decodeShareToken } from '@/utils/shareDecoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import { CURRENT_PROJECT_VERSION, type Project, type ProjectSnapshot } from '@/types/project'
import { FIRST_PAGE_ID, createSinglePageProjectSource, getStartPageSource } from '@/services/projectSource'
import { getViewportWidth } from '@/types/viewports'
import { repairPackedSnapshotJson, unpackSnapshot } from '@/utils/snapshotPacking'
import { setupSessionStorageMock, type MockSessionStorage } from '../helpers/mockLocalStorage'

const Harness = () => {
  const {
    project,
    editorState,
    previewState,
    updateEditorState,
    resetToIntro,
    shareHydration,
    applySharedSnapshot,
    dismissShareHydration,
  } = useProject()
  const { theme, panelOrder } = useSettings()
  const source = getStartPageSource(project)

  return (
    <div>
      <div data-testid="project-id">{project.id}</div>
      <div data-testid="project-name">{project.name}</div>
      <div data-testid="project-version">{project.version}</div>
      <div data-testid="project-created-at">{project.createdAt}</div>
      <div data-testid="project-last-modified">{project.lastModified}</div>
      <div data-testid="project-panel-layout">{project.panelLayout}</div>
      <div data-testid="project-viewport">{project.viewportSize}</div>
      <div data-testid="jsx-code">{source.jsx}</div>
      <div data-testid="hooks-code">{source.hooks}</div>
      <div data-testid="editor-active-tab">{editorState.activeTab}</div>
      <div data-testid="preview-current-viewport">{previewState.currentViewport}</div>
      <div data-testid="preview-viewport-width">{previewState.viewportWidth}</div>
      <div data-testid="settings-theme">{theme}</div>
      <div data-testid="settings-panel-order">{panelOrder}</div>
      <div data-testid="share-status">{shareHydration.status}</div>
      <button onClick={() => updateEditorState({ activeTab: 'Hooks' })}>Set local Hooks tab</button>
      <button onClick={resetToIntro}>Reset editor</button>
      {shareHydration.status === 'ready' && (
        <div>
          <span>share-ready</span>
          <button onClick={applySharedSnapshot}>Load shared project</button>
          <button onClick={dismissShareHydration}>Dismiss</button>
        </div>
      )}
      {shareHydration.status === 'error' && (
        <div>
          share-error
          {shareHydration.error?.code && (
            <span data-testid="share-error-code">{shareHydration.error.code}</span>
          )}
          {shareHydration.error?.message && (
            <span data-testid="share-error-message">{shareHydration.error.message}</span>
          )}
        </div>
      )}
    </div>
  )
}

const PersistedHarness = () => {
  const { project, shareHydration, applySharedSnapshot } = useProject()
  const { theme, panelOrder, multiPageEnabled, pagePanelOpen, selectedEditTarget } = useSettings()
  const source = getStartPageSource(project)
  useAutoSave(project, {
    theme,
    panelOrder,
    multiPageEnabled,
    pagePanelOpen,
    selectedEditTarget,
  })

  return (
    <div>
      <div data-testid="project-name">{project.name}</div>
      <div data-testid="jsx-code">{source.jsx}</div>
      <div data-testid="settings-theme">{theme}</div>
      <div data-testid="settings-panel-order">{panelOrder}</div>
      {shareHydration.status === 'ready' && (
        <button onClick={applySharedSnapshot}>Load Web share URL</button>
      )}
    </div>
  )
}

const renderHarness = () => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </SettingsProvider>
  )
}

const renderPersistedHarness = () => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <PersistedHarness />
      </AppProvider>
    </SettingsProvider>
  )
}

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/share')

const createWorkingCopyProject = (
  overrides: Partial<Project> & { jsxCode?: string; hooksCode?: string }
): Project => {
  const {
    jsxCode = 'export default function App() { return <div>Default JSX</div> }',
    hooksCode = '',
    source,
    activePageId = FIRST_PAGE_ID,
    version = CURRENT_PROJECT_VERSION,
    ...projectOverrides
  } = overrides

  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Working copy project',
    source: source ?? createSinglePageProjectSource(jsxCode, hooksCode),
    activePageId,
    viewportSize: 'MD',
    panelLayout: 'editor-left',
    version,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-02T00:00:00.000Z',
    ...projectOverrides,
  }
}

const setPrimarySource = (project: Project, jsxCode: string, hooksCode = '') => {
  project.source = createSinglePageProjectSource(jsxCode, hooksCode)
}

const loadCorruptedPackedFixture = async (): Promise<{
  corruptedPacked: string
  expectedSnapshot: ProjectSnapshot
}> => {
  const raw = await fs.readFile(
    path.join(fixturesDir, 'packed-with-unescaped-quotes.json'),
    'utf-8'
  )
  return JSON.parse(raw) as {
    corruptedPacked: string
    expectedSnapshot: ProjectSnapshot
  }
}

describe('share decode integration', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('hydrates project state from share query parameter and clears it', async () => {
    const token = await createShareTokenForCode('Shared integration test')
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}&foo=bar`)

    renderHarness()

    await screen.findByText('share-ready')

    await user.click(screen.getByRole('button', { name: /load shared project/i }))

    await waitFor(() => {
      expect(screen.queryByText('share-ready')).toBeNull()
    })

    expect(screen.getByTestId('jsx-code').textContent).toContain('Shared integration test')
    expect(window.location.search).not.toContain('share=')
  })

  it('restores a tab-scoped Web Arcade working copy across reload', async () => {
    const workingCopyProject = createWorkingCopyProject({
      name: 'Reloaded working copy',
      jsxCode: 'export default function App() { return <div>Reloaded JSX</div> }',
      hooksCode: 'export function useReloadedHook() { return "Reloaded Hooks" }',
      viewportSize: 'LG',
      panelLayout: 'editor-right',
    })
    saveProject(workingCopyProject, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: false,
      },
    })

    renderHarness()

    expect(screen.getByTestId('project-name').textContent).toBe('Reloaded working copy')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Reloaded JSX')
    expect(screen.getByTestId('hooks-code').textContent).toContain('Reloaded Hooks')
    expect(screen.getByTestId('project-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('project-panel-layout').textContent).toBe('editor-right')
    expect(screen.getByTestId('preview-current-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('preview-viewport-width').textContent).toBe(
      String(getViewportWidth('LG'))
    )
    await waitFor(() => {
      expect(screen.getByTestId('settings-theme').textContent).toBe('light')
      expect(screen.getByTestId('settings-panel-order').textContent).toBe('preview-left')
    })
  })

  it('resets only the current Web Arcade working copy to a fresh default project', async () => {
    const previousProject = createWorkingCopyProject({
      name: 'Reset source working copy',
      jsxCode: 'export default function App() { return <div>Reset source JSX</div> }',
      hooksCode: 'export function useResetSourceHook() { return "Reset source Hooks" }',
      viewportSize: 'XL',
      panelLayout: 'editor-right',
    })
    saveProject(previousProject, {
      preferences: {
        ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
        theme: 'light',
        panelOrder: 'preview-left',
        multiPageEnabled: false,
      },
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderHarness()

      await waitFor(() => {
        expect(screen.getByTestId('settings-theme').textContent).toBe('light')
        expect(screen.getByTestId('settings-panel-order').textContent).toBe('preview-left')
      })
      await user.click(screen.getByRole('button', { name: /set local hooks tab/i }))

      await user.click(screen.getByRole('button', { name: /reset editor/i }))

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Web Arcade working copy'))
      expect(screen.getByTestId('project-id').textContent).not.toBe(previousProject.id)
      expect(screen.getByTestId('project-name').textContent).toBe('Untitled Project')
      expect(screen.getByTestId('jsx-code').textContent).toContain('Welcome to Aksel Arcade')
      expect(screen.getByTestId('hooks-code').textContent).toContain('Define custom hooks here')
      expect(screen.getByTestId('project-viewport').textContent).toBe('MD')
      expect(screen.getByTestId('project-panel-layout').textContent).toBe('editor-left')
      expect(screen.getByTestId('preview-current-viewport').textContent).toBe('MD')
      expect(screen.getByTestId('preview-viewport-width').textContent).toBe(
        String(getViewportWidth('MD'))
      )
      expect(screen.getByTestId('editor-active-tab').textContent).toBe('JSX')
      expect(screen.getByTestId('settings-theme').textContent).toBe(
        DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.theme
      )
      expect(screen.getByTestId('settings-panel-order').textContent).toBe(
        DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.panelOrder
      )
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('loads v3 Web share URLs as fresh local projects from shared source and preview preferences', async () => {
    const previousProject = createWorkingCopyProject({
      name: 'Previous local project',
      jsxCode: 'export default function App() { return <div>Previous JSX</div> }',
      hooksCode: 'export function usePreviousHook() { return "Previous Hooks" }',
      viewportSize: 'XS',
      panelLayout: 'editor-right',
    })
    saveProject(previousProject)

    const senderProject = createDefaultProject()
    senderProject.name = 'Sender project name'
    senderProject.version = CURRENT_PROJECT_VERSION
    setPrimarySource(
      senderProject,
      'export default function App() { return <Heading>Shared v3 JSX</Heading> }',
      'export function useSharedHook() { return "Shared v3 Hooks" }'
    )

    const token = await createShareTokenForSnapshot(
      createShareSnapshot(senderProject, {
        activeFileId: SNAPSHOT_FILE_IDS.hooks,
        preview: {
          viewport: 'LG',
          zoom: 0.75,
          theme: 'light',
          sandboxFlags: { outlines: true },
        },
        settings: {
          autosave: false,
          linting: false,
          showLineNumbers: false,
        },
      })
    )
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}&foo=bar`)

    renderHarness()

    await screen.findByText('share-ready')
    expect(screen.getByTestId('project-id').textContent).toBe(previousProject.id)
    expect(screen.getByTestId('project-name').textContent).toBe(previousProject.name)

    await user.click(screen.getByRole('button', { name: /set local hooks tab/i }))
    expect(screen.getByTestId('editor-active-tab').textContent).toBe('Hooks')

    await user.click(screen.getByRole('button', { name: /load shared project/i }))

    await waitFor(() => {
      expect(screen.getByTestId('share-status').textContent).toBe('idle')
    })

    expect(screen.getByTestId('project-id').textContent).not.toBe(previousProject.id)
    expect(screen.getByTestId('project-id').textContent).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(screen.getByTestId('project-name').textContent).toBe('Untitled Project')
    expect(screen.getByTestId('project-name').textContent).not.toBe(senderProject.name)
    expect(screen.getByTestId('project-created-at').textContent).not.toBe(previousProject.createdAt)
    expect(screen.getByTestId('project-last-modified').textContent).not.toBe(
      previousProject.lastModified
    )
    expect(screen.getByTestId('project-version').textContent).toBe(CURRENT_PROJECT_VERSION)
    expect(screen.getByTestId('project-panel-layout').textContent).toBe('editor-left')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Shared v3 JSX')
    expect(screen.getByTestId('hooks-code').textContent).toContain('Shared v3 Hooks')
    expect(screen.getByTestId('project-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('preview-current-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('preview-viewport-width').textContent).toBe(
      String(getViewportWidth('LG'))
    )
    expect(screen.getByTestId('settings-theme').textContent).toBe('light')
    expect(screen.getByTestId('settings-panel-order').textContent).toBe(
      DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.panelOrder
    )
    expect(screen.getByTestId('editor-active-tab').textContent).toBe('JSX')
    expect(window.location.search).not.toContain('share=')
  })

  it('applies a Web share URL only to the current tab working copy', async () => {
    const originalTabStorage = setupSessionStorageMock()
    const originalTabProject = createWorkingCopyProject({
      name: 'Original tab working copy',
      jsxCode: 'export default function App() { return <div>Original isolated JSX</div> }',
      hooksCode: 'export function useOriginalIsolatedHook() { return "Original Hooks" }',
      viewportSize: 'LG',
      panelLayout: 'editor-right',
    })
    const originalTabPreferences: WebArcadeWorkingCopyPreferences = {
      ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
      theme: 'light',
      panelOrder: 'preview-left',
      multiPageEnabled: false,
    }
    saveProject(originalTabProject, { preferences: originalTabPreferences })
    const originalTab = renderHarness()

    expect(within(originalTab.container).getByTestId('project-name').textContent).toBe(
      'Original tab working copy'
    )
    await waitFor(() => {
      expect(within(originalTab.container).getByTestId('settings-theme').textContent).toBe('light')
      expect(within(originalTab.container).getByTestId('settings-panel-order').textContent).toBe(
        'preview-left'
      )
    })

    const currentTabStorage = setupSessionStorageMock()
    const currentTabProject = createWorkingCopyProject({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Current tab before Web share URL',
      jsxCode: 'export default function App() { return <div>Current tab JSX</div> }',
      hooksCode: 'export function useCurrentTabHook() { return "Current Hooks" }',
      viewportSize: 'XS',
      panelLayout: 'editor-left',
      createdAt: '2024-02-01T00:00:00.000Z',
      lastModified: '2024-02-02T00:00:00.000Z',
    })
    saveProject(currentTabProject)

    const sharedProject = createDefaultProject()
    setPrimarySource(
      sharedProject,
      'export default function App() { return <div>Shared isolated JSX</div> }',
      'export function useSharedIsolatedHook() { return "Shared Hooks" }'
    )
    const token = await createShareTokenForSnapshot(
      createShareSnapshot(sharedProject, {
        preview: {
          viewport: 'XL',
          theme: 'light',
        },
      })
    )
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}`)

    const currentTab = renderPersistedHarness()
    const currentTabQueries = within(currentTab.container)
    fireEvent.click(await currentTabQueries.findByRole('button', { name: /load web share url/i }))

    await waitFor(() => {
      expect(currentTabQueries.getByTestId('jsx-code').textContent).toContain('Shared isolated JSX')
    })
    await waitFor(
      () => {
        const stored = parseStoredWorkingCopy(currentTabStorage)
        expect(stored.project.name).toBe('Untitled Project')
        expect(getStartPageSource(stored.project).jsx).toContain('Shared isolated JSX')
        expect(stored.project.viewportSize).toBe('XL')
        expect(stored.preferences).toEqual({
          ...DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES,
          theme: 'light',
        })
      },
      { timeout: 2500 }
    )

    const storedOriginalTab = parseStoredWorkingCopy(originalTabStorage)
    expect(storedOriginalTab.project).toMatchObject({
      name: 'Original tab working copy',
      viewportSize: 'LG',
      panelLayout: 'editor-right',
    })
    expect(getStartPageSource(storedOriginalTab.project).jsx).toBe(
      'export default function App() { return <div>Original isolated JSX</div> }'
    )
    expect(getStartPageSource(storedOriginalTab.project).hooks).toBe(
      'export function useOriginalIsolatedHook() { return "Original Hooks" }'
    )
    expect(storedOriginalTab.preferences).toEqual(originalTabPreferences)
    expect(within(originalTab.container).getByTestId('project-name').textContent).toBe(
      'Original tab working copy'
    )
    expect(within(originalTab.container).getByTestId('jsx-code').textContent).toContain(
      'Original isolated JSX'
    )
    expect(within(originalTab.container).getByTestId('settings-panel-order').textContent).toBe(
      'preview-left'
    )
  })

  it('loads legacy v2 full-snapshot share URLs as fresh local projects', async () => {
    const previousProject = createWorkingCopyProject({
      name: 'Previous local project',
      jsxCode: 'export default function App() { return <div>Previous JSX</div> }',
      hooksCode: 'export function usePreviousHook() { return "Previous Hooks" }',
      viewportSize: 'XS',
      panelLayout: 'editor-right',
    })
    saveProject(previousProject)

    const senderProject = createDefaultProject()
    senderProject.name = 'Sender legacy project name'
    senderProject.version = '9.9.9'
    setPrimarySource(
      senderProject,
      'export default function App() { return <Heading>Shared legacy JSX</Heading> }',
      'export function useSharedHook() { return "Shared legacy Hooks" }'
    )

    const legacySnapshot = createShareSnapshot(senderProject, {
      activeFileId: SNAPSHOT_FILE_IDS.hooks,
      preview: {
        viewport: 'MD',
        zoom: 0.5,
        theme: 'light',
        sandboxFlags: { outlines: true },
      },
      settings: {
        autosave: false,
        linting: false,
        showLineNumbers: false,
      },
    })
    legacySnapshot.updatedAt = 1234567890
    const token = await createLegacyV2ShareTokenForSnapshot(legacySnapshot)
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}&foo=bar`)

    renderHarness()

    await screen.findByText('share-ready')
    expect(screen.getByTestId('project-id').textContent).toBe(previousProject.id)

    await user.click(screen.getByRole('button', { name: /set local hooks tab/i }))
    expect(screen.getByTestId('editor-active-tab').textContent).toBe('Hooks')

    await user.click(screen.getByRole('button', { name: /load shared project/i }))

    await waitFor(() => {
      expect(screen.getByTestId('share-status').textContent).toBe('idle')
    })

    expect(screen.getByTestId('project-id').textContent).not.toBe(previousProject.id)
    expect(screen.getByTestId('project-name').textContent).toBe('Untitled Project')
    expect(screen.getByTestId('project-name').textContent).not.toBe(senderProject.name)
    expect(screen.getByTestId('project-created-at').textContent).not.toBe(previousProject.createdAt)
    expect(screen.getByTestId('project-last-modified').textContent).not.toBe(
      previousProject.lastModified
    )
    expect(screen.getByTestId('project-version').textContent).toBe(CURRENT_PROJECT_VERSION)
    expect(screen.getByTestId('project-panel-layout').textContent).toBe('editor-left')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Shared legacy JSX')
    expect(screen.getByTestId('hooks-code').textContent).toContain('Shared legacy Hooks')
    expect(screen.getByTestId('project-viewport').textContent).toBe('MD')
    expect(screen.getByTestId('preview-current-viewport').textContent).toBe('MD')
    expect(screen.getByTestId('preview-viewport-width').textContent).toBe(
      String(getViewportWidth('MD'))
    )
    expect(screen.getByTestId('settings-theme').textContent).toBe('light')
    expect(screen.getByTestId('settings-panel-order').textContent).toBe(
      DEFAULT_WEB_ARCADE_WORKING_COPY_PREFERENCES.panelOrder
    )
    expect(screen.getByTestId('editor-active-tab').textContent).toBe('JSX')
    expect(window.location.search).not.toContain('share=')
  })

  it('surfaces tamper errors when payload checksum fails', async () => {
    const token = await createShareTokenForCode('Should tamper fail')
    const tampered = tamperChecksum(token)
    window.history.replaceState({}, '', `/?share=${encodeURIComponent(tampered)}`)

    renderHarness()

    await screen.findByText('share-error')
  })

  it('hydrates temporary legacy packed-deflate share tokens', async () => {
    const summarySnapshot = createLegacyPackedSnapshot('Packed deflate legacy')
    const strategy = getCompressionStrategy('packed-deflate-b91')
    if (!strategy) {
      throw new Error('packed-deflate-b91 strategy is not registered')
    }

    const encoded = await strategy.encode({ snapshot: summarySnapshot })
    const envelope = await encodeSharePayload(summarySnapshot, {
      formatVersion: LEGACY_SHARE_FORMAT_VERSION,
      serialized: encoded.serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)

    const sanityCheck = await decodeShareToken(token)
    expect(sanityCheck.checksumValid).toBe(true)

    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}`)

    renderHarness()
    await screen.findByText('share-ready')

    await user.click(screen.getByRole('button', { name: /load shared project/i }))

    await waitFor(() => {
      expect(screen.queryByText('share-ready')).toBeNull()
    })

    expect(window.location.search).not.toContain('share=')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Packed deflate legacy')
  })

  it('hydrates temporary legacy packed-brotli q11 share tokens', async () => {
    const hooksSnapshot = createLegacyPackedSnapshot('Packed brotli legacy')
    const strategy = getCompressionStrategy('packed-brotli-q11-b91')
    if (!strategy) {
      throw new Error('packed-brotli-q11-b91 strategy is not registered')
    }

    const encoded = await strategy.encode({ snapshot: hooksSnapshot })
    const envelope = await encodeSharePayload(hooksSnapshot, {
      formatVersion: LEGACY_SHARE_FORMAT_VERSION,
      serialized: encoded.serialized,
      checksumSource: encoded.checksumSource,
      compressed: encoded.payload,
      strategyId: strategy.id,
    })
    const token = createShareToken(envelope)
    const sanityCheck = await decodeShareToken(token)
    expect(sanityCheck.checksumValid).toBe(true)

    window.history.replaceState({}, '', `/?share=${encodeURIComponent(token)}`)

    renderHarness()
    await screen.findByText('share-ready')

    await user.click(screen.getByRole('button', { name: /load shared project/i }))

    await waitFor(() => {
      expect(screen.queryByText('share-ready')).toBeNull()
    })

    expect(window.location.search).not.toContain('share=')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Packed brotli legacy')
  })

  it('repairs stray quotes inside packed snapshots before decoding', async () => {
    /**
     * Fixture regeneration snippet (if schemas change):
     *
     * ```sh
     * node --input-type=module - <<'NODE'
     * import fs from 'node:fs/promises'
     * import path from 'node:path'
     * import { pathToFileURL } from 'node:url'
     * import * as esbuild from 'esbuild'
     *
     * const projectRoot = process.cwd()
     * const cacheDir = path.join(projectRoot, 'node_modules/.cache/aksel-arcade')
     * await fs.mkdir(cacheDir, { recursive: true })
     * const entry = path.join(projectRoot, 'src/utils/snapshotPacking.ts')
     * const outFile = path.join(cacheDir, 'snapshot-packing.fixture.mjs')
     *
     * await esbuild.build({
     *   entryPoints: [entry],
     *   outfile: outFile,
     *   bundle: true,
     *   platform: 'node',
     *   format: 'esm',
     *   target: ['node18'],
     *   sourcemap: false,
     *   tsconfigRaw: {
     *     compilerOptions: {
     *       baseUrl: projectRoot,
     *       paths: { '@/*': ['src/*'] },
     *     },
     *   },
     * })
     *
     * const { serializePackedSnapshot } = await import(pathToFileURL(outFile).href)
     * const expectedSnapshot = {
     *   version: '3.0.0',
     *   files: [
     *     {
     *       id: 'jsx-file',
     *       name: 'App.tsx',
     *       language: 'tsx',
     *       content: 'export default function App() {\n  return <div className="quote">Packed</div>\n}\n',
     *       order: 0,
     *     },
     *   ],
     *   activeFileId: 'jsx-file',
     *   preview: {
     *     viewport: 'MD',
     *     zoom: 1,
     *     theme: 'dark',
     *     sandboxFlags: { animations: true, outlines: false },
     *   },
     *   settings: { autosave: true, linting: false, showLineNumbers: true },
     *   updatedAt: 1764000000000,
     * }
     * const packed = serializePackedSnapshot(expectedSnapshot)
     * const corruptedPacked = packed.replace(/className=\\"quote\\"/g, 'className="quote"')
     *
     * await fs.writeFile(
     *   path.join(projectRoot, 'tests/fixtures/share/packed-with-unescaped-quotes.json'),
     *   JSON.stringify({ corruptedPacked, expectedSnapshot }, null, 2),
     *   'utf-8',
     * )
     * NODE
     * ```
     */
    const { corruptedPacked, expectedSnapshot } = await loadCorruptedPackedFixture()
    expect(corruptedPacked).toContain('className="quote"')

    const repairedPayload = repairPackedSnapshotJson(corruptedPacked)
    expect(repairedPayload).toBeTruthy()
    if (repairedPayload) {
      expect(repairedPayload).not.toContain('className="quote"')
      expect(repairedPayload).toContain('className=\\"quote\\"')
      expect(repairedPayload).not.toEqual(corruptedPacked)
    }

    const snapshot = unpackSnapshot(corruptedPacked)
    expect(snapshot).toEqual(expectedSnapshot)
  })
})

const createShareTokenForCode = async (code: string): Promise<string> => {
  const project = createDefaultProject()
  setPrimarySource(project, code)

  const snapshot = createShareSnapshot(project)
  return createShareTokenForSnapshot(snapshot)
}

const createShareTokenForSnapshot = async (snapshot: ProjectSnapshot): Promise<string> => {
  const envelope = await encodeSharePayload(snapshot)
  return createShareToken(envelope)
}

const createLegacyV2ShareTokenForSnapshot = async (snapshot: ProjectSnapshot): Promise<string> => {
  const envelope = await encodeSharePayload(snapshot, {
    formatVersion: LEGACY_SHARE_FORMAT_VERSION,
  })
  return createShareToken(envelope)
}

const createLegacyPackedSnapshot = (label: string): ProjectSnapshot => {
  const project = createDefaultProject()
  setPrimarySource(
    project,
    `export default function App() { return <div>${label}</div> }`,
    `export function usePackedLegacyHook() { return "${label}" }`
  )
  return createShareSnapshot(project, {
    preview: {
      viewport: 'LG',
      theme: 'dark',
      zoom: 0.8,
      sandboxFlags: { outlines: true },
    },
  })
}

const parseStoredWorkingCopy = (storage: MockSessionStorage) => {
  const stored = storage.getItem(WEB_ARCADE_WORKING_COPY_STORAGE_KEY)
  if (!stored) {
    throw new Error('Expected Web Arcade working copy to be stored')
  }

  return JSON.parse(stored) as {
    project: Project
    preferences: WebArcadeWorkingCopyPreferences
  }
}

const tamperChecksum = (token: string): string => {
  const [version, metadata, checksum, payload] = token.split('.', 4)
  if (!version || !metadata || !checksum || !payload) {
    return token
  }
  const flipped = checksum[0] === 'A' ? 'B' : 'A'
  const corruptedChecksum = `${flipped}${checksum.slice(1)}`
  return `${version}.${metadata}.${corruptedChecksum}.${payload}`
}

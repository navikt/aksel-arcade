import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot, SNAPSHOT_FILE_IDS } from '@/services/storage'
import {
  encodeSharePayload,
  createShareToken,
  LEGACY_SHARE_FORMAT_VERSION,
} from '@/utils/shareEncoding'
import { decodeShareToken } from '@/utils/shareDecoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import type { Project, ProjectSnapshot } from '@/types/project'
import { getViewportWidth } from '@/types/viewports'
import { repairPackedSnapshotJson, unpackSnapshot } from '@/utils/snapshotPacking'

const Harness = () => {
  const {
    project,
    editorState,
    previewState,
    updateEditorState,
    shareHydration,
    applySharedSnapshot,
    dismissShareHydration,
  } = useProject()
  const { theme } = useSettings()

  return (
    <div>
      <div data-testid="project-id">{project.id}</div>
      <div data-testid="project-name">{project.name}</div>
      <div data-testid="project-version">{project.version}</div>
      <div data-testid="project-created-at">{project.createdAt}</div>
      <div data-testid="project-last-modified">{project.lastModified}</div>
      <div data-testid="project-panel-layout">{project.panelLayout}</div>
      <div data-testid="project-viewport">{project.viewportSize}</div>
      <div data-testid="jsx-code">{project.jsxCode}</div>
      <div data-testid="hooks-code">{project.hooksCode}</div>
      <div data-testid="editor-active-tab">{editorState.activeTab}</div>
      <div data-testid="preview-current-viewport">{previewState.currentViewport}</div>
      <div data-testid="preview-viewport-width">{previewState.viewportWidth}</div>
      <div data-testid="settings-theme">{theme}</div>
      <div data-testid="share-status">{shareHydration.status}</div>
      <button onClick={() => updateEditorState({ activeTab: 'Hooks' })}>Set local Hooks tab</button>
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

const renderHarness = () => {
  return render(
    <SettingsProvider>
      <AppProvider>
        <Harness />
      </AppProvider>
    </SettingsProvider>
  )
}

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/share')
const STORAGE_KEY = 'aksel-arcade:project'

const loadShareFixture = async (fileName: string): Promise<ProjectSnapshot> => {
  const raw = await fs.readFile(path.join(fixturesDir, fileName), 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
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

  it('loads v3 Web share URLs as fresh local projects from shared source and preview preferences', async () => {
    const previousProject: Project = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Previous local project',
      jsxCode: 'export default function App() { return <div>Previous JSX</div> }',
      hooksCode: 'export function usePreviousHook() { return "Previous Hooks" }',
      viewportSize: 'XS',
      panelLayout: 'editor-right',
      version: '1.0.0',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-02T00:00:00.000Z',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousProject))

    const senderProject = createDefaultProject()
    senderProject.name = 'Sender project name'
    senderProject.version = '2.0.0'
    senderProject.jsxCode =
      'export default function App() { return <Heading>Shared v3 JSX</Heading> }'
    senderProject.hooksCode = 'export function useSharedHook() { return "Shared v3 Hooks" }'

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
    expect(screen.getByTestId('project-version').textContent).toBe('1.0.0')
    expect(screen.getByTestId('project-panel-layout').textContent).toBe('editor-left')
    expect(screen.getByTestId('jsx-code').textContent).toContain('Shared v3 JSX')
    expect(screen.getByTestId('hooks-code').textContent).toContain('Shared v3 Hooks')
    expect(screen.getByTestId('project-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('preview-current-viewport').textContent).toBe('LG')
    expect(screen.getByTestId('preview-viewport-width').textContent).toBe(
      String(getViewportWidth('LG'))
    )
    expect(screen.getByTestId('settings-theme').textContent).toBe('light')
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

  it('hydrates packed-deflate share tokens from fixtures', async () => {
    const summarySnapshot = await loadShareFixture('summary-page.json')
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
  })

  it('hydrates packed-brotli q11 tokens from fixtures', async () => {
    const hooksSnapshot = await loadShareFixture('hooks-demo.json')
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
  project.jsxCode = code

  const snapshot = createShareSnapshot(project)
  return createShareTokenForSnapshot(snapshot)
}

const createShareTokenForSnapshot = async (snapshot: ProjectSnapshot): Promise<string> => {
  const envelope = await encodeSharePayload(snapshot)
  return createShareToken(envelope)
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

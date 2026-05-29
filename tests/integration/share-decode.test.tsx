import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, useProject } from '@/hooks/useProject'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { createDefaultProject } from '@/utils/projectDefaults'
import { createShareSnapshot } from '@/services/storage'
import { encodeSharePayload, createShareToken, LEGACY_SHARE_FORMAT_VERSION } from '@/utils/shareEncoding'
import { decodeShareToken } from '@/utils/shareDecoding'
import { getCompressionStrategy } from '@/services/compressionStrategies'
import type { ProjectSnapshot } from '@/types/project'
import { repairPackedSnapshotJson, unpackSnapshot } from '@/utils/snapshotPacking'

const Harness = () => {
  const { project, shareHydration, applySharedSnapshot, dismissShareHydration } = useProject()

  return (
    <div>
      <div data-testid="jsx-code">{project.jsxCode}</div>
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

const loadShareFixture = async (fileName: string): Promise<ProjectSnapshot> => {
  const raw = await fs.readFile(path.join(fixturesDir, fileName), 'utf-8')
  return JSON.parse(raw) as ProjectSnapshot
}

const loadCorruptedPackedFixture = async (): Promise<{
  corruptedPacked: string
  expectedSnapshot: ProjectSnapshot
}> => {
  const raw = await fs.readFile(path.join(fixturesDir, 'packed-with-unescaped-quotes.json'), 'utf-8')
  return JSON.parse(raw) as {
    corruptedPacked: string
    expectedSnapshot: ProjectSnapshot
  }
}

describe('share decode integration', () => {
  const user = userEvent.setup()

  beforeEach(() => {
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

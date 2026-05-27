import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { commandName, startDesktopDev } from '../../../scripts/desktop-dev.mjs'

class FakeChildProcess extends EventEmitter {
  exitCode = null
  killed = false

  kill = vi.fn(() => {
    this.killed = true
  })
}

const createSpawnFixture = () => {
  const calls = []
  const spawnProcess = vi.fn((command, args, options) => {
    const child = new FakeChildProcess()
    calls.push({ args, child, command, options })
    return child
  })

  return { calls, spawnProcess }
}

const createRunnerOptions = (overrides = {}) => ({
  env: {},
  log: vi.fn(),
  logError: vi.fn(),
  platform: 'darwin',
  rendererUrl: 'http://127.0.0.1:5173/aksel-arcade/',
  setExitCode: vi.fn(),
  waitForRendererReady: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

describe('desktop dev runner', () => {
  it('uses Windows command shims only on Windows', () => {
    expect(commandName('vite', 'darwin')).toBe('vite')
    expect(commandName('vite', 'win32')).toBe('vite.cmd')
  })

  it('reuses an existing Vite renderer instead of starting a second strict-port server', async () => {
    const { calls, spawnProcess } = createSpawnFixture()
    const checkRendererReady = vi.fn().mockResolvedValue(true)
    const waitForRendererReady = vi.fn()
    const options = createRunnerOptions({
      checkRendererReady,
      spawnProcess,
      waitForRendererReady,
    })

    const result = await startDesktopDev(options)

    expect(result?.viteProcess).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      args: ['desktop/main.cjs'],
      command: 'electron',
    })
    expect(calls[0].options.env.AKSEL_ARCADE_RENDERER_URL).toBe(options.rendererUrl)
    expect(waitForRendererReady).not.toHaveBeenCalled()
    expect(options.log).toHaveBeenCalledWith(
      `Using existing Vite renderer at ${options.rendererUrl}`
    )
    expect(options.setExitCode).not.toHaveBeenCalled()
  })

  it('starts Vite before Electron when no renderer is already available', async () => {
    const { calls, spawnProcess } = createSpawnFixture()
    const checkRendererReady = vi.fn().mockResolvedValue(false)
    const waitForRendererReady = vi.fn().mockResolvedValue(undefined)
    const options = createRunnerOptions({
      checkRendererReady,
      spawnProcess,
      waitForRendererReady,
    })

    const result = await startDesktopDev(options)

    expect(result?.viteProcess).toBe(calls[0].child)
    expect(result?.electronProcess).toBe(calls[1].child)
    expect(calls.map(({ command }) => command)).toEqual(['vite', 'electron'])
    expect(calls[0].args).toEqual(['--host', '127.0.0.1', '--strictPort'])
    expect(calls[0].options.env.BROWSER).toBe('none')
    expect(waitForRendererReady).toHaveBeenCalledWith(options.rendererUrl)
    expect(options.setExitCode).not.toHaveBeenCalled()
  })

  it('fails fast when a custom renderer URL is configured but unavailable', async () => {
    const { calls, spawnProcess } = createSpawnFixture()
    const rendererUrl = 'http://127.0.0.1:5180/aksel-arcade/'
    const options = createRunnerOptions({
      checkRendererReady: vi.fn().mockResolvedValue(false),
      env: { AKSEL_ARCADE_RENDERER_URL: rendererUrl },
      rendererUrl,
      spawnProcess,
    })

    const result = await startDesktopDev(options)

    expect(result).toBeNull()
    expect(calls).toHaveLength(0)
    expect(options.logError).toHaveBeenCalledWith(
      expect.stringContaining('AKSEL_ARCADE_RENDERER_URL is set')
    )
    expect(options.setExitCode).toHaveBeenCalledWith(1)
  })
})

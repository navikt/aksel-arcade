import http from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RENDERER_URL = process.env.AKSEL_ARCADE_RENDERER_URL ?? 'http://127.0.0.1:5173/aksel-arcade/'
const RENDERER_TIMEOUT_MS = 30_000
const RENDERER_PROBE_TIMEOUT_MS = 1_000
const RENDERER_RETRY_MS = 250

export const commandName = (name, platform = process.platform) =>
  platform === 'win32' ? `${name}.cmd` : name

const children = new Set()

const spawnChild = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  })
  children.add(child)
  child.once('exit', () => {
    children.delete(child)
  })
  return child
}

const stopChildren = () => {
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
  }
}

export const isRendererReady = (url, probeTimeoutMs = RENDERER_PROBE_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    let settled = false
    let request

    const finish = (ready) => {
      if (settled) {
        return
      }
      settled = true
      resolve(ready)
    }

    try {
      request = http.get(url, (response) => {
        response.resume()
        finish(
          Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 500)
        )
      })

      request.on('error', () => finish(false))
      request.setTimeout(probeTimeoutMs, () => {
        request.destroy()
        finish(false)
      })
    } catch (error) {
      reject(error)
    }
  })

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitForRenderer = async (
  url,
  {
    timeoutMs = RENDERER_TIMEOUT_MS,
    retryMs = RENDERER_RETRY_MS,
    probeTimeoutMs = RENDERER_PROBE_TIMEOUT_MS,
  } = {}
) => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await isRendererReady(url, probeTimeoutMs)) {
      return
    }

    await delay(retryMs)
  }

  throw new Error(`Timed out waiting for Vite at ${url}`)
}

export const waitUntilRendererReady = (
  viteProcess,
  rendererUrl,
  waitForRendererReady = waitForRenderer
) =>
  new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      viteProcess.off('exit', handleViteExit)
      viteProcess.off('error', handleViteError)
    }
    const fail = (error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }
    const succeed = () => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve()
    }
    const handleViteExit = (code) => {
      fail(
        new Error(`Vite exited before Desktop Arcade launched with code ${code ?? 'unknown'}.`)
      )
    }
    const handleViteError = (error) => {
      fail(
        new Error(
          `Vite could not be started: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }

    viteProcess.once('exit', handleViteExit)
    viteProcess.once('error', handleViteError)
    waitForRendererReady(rendererUrl).then(succeed, fail)
  })

export const startDesktopDev = async ({
  env = process.env,
  platform = process.platform,
  rendererUrl = RENDERER_URL,
  spawnProcess = spawnChild,
  checkRendererReady = isRendererReady,
  waitForRendererReady = waitForRenderer,
  log = console.log,
  logError = console.error,
  setExitCode = (code) => {
    process.exitCode = code
  },
} = {}) => {
  try {
    const rendererAlreadyRunning = await checkRendererReady(rendererUrl)
    const customRendererUrl = Boolean(env.AKSEL_ARCADE_RENDERER_URL)
    let viteProcess = null

    if (rendererAlreadyRunning) {
      log(`Using existing Vite renderer at ${rendererUrl}`)
    } else if (customRendererUrl) {
      throw new Error(
        `AKSEL_ARCADE_RENDERER_URL is set, but no renderer responded at ${rendererUrl}. Start that renderer separately or unset AKSEL_ARCADE_RENDERER_URL.`
      )
    } else {
      viteProcess = spawnProcess(
        commandName('vite', platform),
        ['--host', '127.0.0.1', '--strictPort'],
        {
          env: {
            ...env,
            BROWSER: 'none',
          },
        }
      )
      await waitUntilRendererReady(viteProcess, rendererUrl, waitForRendererReady)
    }

    const electronProcess = spawnProcess(commandName('electron', platform), ['desktop/main.cjs'], {
      env: {
        ...env,
        AKSEL_ARCADE_RENDERER_URL: rendererUrl,
      },
    })

    electronProcess.once('error', (error) => {
      stopChildren()
      logError(
        `Electron could not be started: ${error instanceof Error ? error.message : String(error)}`
      )
      setExitCode(1)
    })
    electronProcess.once('exit', (code) => {
      stopChildren()
      setExitCode(code ?? 0)
    })

    return {
      electronProcess,
      viteProcess,
    }
  } catch (error) {
    stopChildren()
    logError(error instanceof Error ? error.message : error)
    setExitCode(1)
    return null
  }
}

const installSignalHandlers = () => {
  process.once('SIGINT', () => {
    stopChildren()
    process.exit(130)
  })

  process.once('SIGTERM', () => {
    stopChildren()
    process.exit(143)
  })
}

const isMainModule = () =>
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule()) {
  installSignalHandlers()
  await startDesktopDev()
}

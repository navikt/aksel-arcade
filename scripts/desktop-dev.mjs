import http from 'node:http'
import { spawn } from 'node:child_process'

const RENDERER_URL = process.env.AKSEL_ARCADE_RENDERER_URL ?? 'http://127.0.0.1:5173/aksel-arcade/'
const RENDERER_TIMEOUT_MS = 30_000

const commandName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name)

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

const waitForRenderer = (url) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + RENDERER_TIMEOUT_MS
    let settled = false

    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          settled = true
          resolve()
          return
        }
        scheduleRetry()
      })

      request.on('error', scheduleRetry)
      request.setTimeout(1_000, () => {
        request.destroy()
        scheduleRetry()
      })
    }

    const scheduleRetry = () => {
      if (settled) {
        return
      }

      if (Date.now() >= deadline) {
        settled = true
        reject(new Error(`Timed out waiting for Vite at ${url}`))
        return
      }
      setTimeout(attempt, 250)
    }

    attempt()
  })

const viteProcess = spawnChild(commandName('vite'), ['--host', '127.0.0.1', '--strictPort'], {
  env: {
    ...process.env,
    BROWSER: 'none',
    VITE_AKSEL_ARCADE_SURFACE: 'desktop',
  },
})

const waitUntilRendererReady = () =>
  new Promise((resolve, reject) => {
    const handleViteExit = (code) => {
      reject(
        new Error(`Vite exited before Desktop Arcade launched with code ${code ?? 'unknown'}.`)
      )
    }

    viteProcess.once('exit', handleViteExit)
    waitForRenderer(RENDERER_URL).then(
      () => {
        viteProcess.off('exit', handleViteExit)
        resolve()
      },
      (error) => {
        viteProcess.off('exit', handleViteExit)
        reject(error)
      }
    )
  })

try {
  await waitUntilRendererReady()

  const electronProcess = spawnChild(commandName('electron'), ['desktop/main.cjs'], {
    env: {
      ...process.env,
      AKSEL_ARCADE_RENDERER_URL: RENDERER_URL,
    },
  })

  electronProcess.once('exit', (code) => {
    stopChildren()
    process.exitCode = code ?? 0
  })
} catch (error) {
  stopChildren()
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

process.once('SIGINT', () => {
  stopChildren()
  process.exit(130)
})

process.once('SIGTERM', () => {
  stopChildren()
  process.exit(143)
})

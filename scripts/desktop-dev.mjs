import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'

const DEFAULT_RENDERER_HOST = '127.0.0.1'
const DEFAULT_RENDERER_PORT = 5173
const DESKTOP_MCP_HOST = '127.0.0.1'
const DESKTOP_MCP_PORT = 3846
const RENDERER_PATH = '/aksel-arcade/'
const RENDERER_TIMEOUT_MS = 30_000
const MAX_PORT_ATTEMPTS = 50

const commandName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name)

const isPortAvailable = (host, port) =>
  new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false)
        return
      }
      reject(error)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })

const findAvailablePort = async (host, startPort) => {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset
    if (await isPortAvailable(host, port)) {
      return port
    }
  }

  throw new Error(
    `Could not find an available Desktop Arcade renderer port from ${startPort} to ${
      startPort + MAX_PORT_ATTEMPTS - 1
    }.`
  )
}

const getPort = (url) => {
  if (url.port) {
    return Number(url.port)
  }

  return url.protocol === 'https:' ? 443 : 80
}

const normalizeRendererUrl = (url) => (url.endsWith('/') ? url : `${url}/`)

const assertDesktopMcpPortAvailable = async () => {
  if (await isPortAvailable(DESKTOP_MCP_HOST, DESKTOP_MCP_PORT)) {
    return
  }

  throw new Error(
    `Desktop Arcade MCP port ${DESKTOP_MCP_PORT} on ${DESKTOP_MCP_HOST} is already in use. Stop the existing Desktop Arcade/Electron process before running desktop:dev again.`
  )
}

const createRendererConfig = async () => {
  if (process.env.AKSEL_ARCADE_RENDERER_URL) {
    const url = new URL(process.env.AKSEL_ARCADE_RENDERER_URL)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('AKSEL_ARCADE_RENDERER_URL must be an http(s) URL for desktop dev.')
    }

    const port = getPort(url)
    const viteHost =
      url.hostname === 'localhost' || url.hostname === DEFAULT_RENDERER_HOST
        ? DEFAULT_RENDERER_HOST
        : url.hostname

    if (!(await isPortAvailable(viteHost, port))) {
      throw new Error(
        `Desktop Arcade renderer port ${port} on ${viteHost} is already in use. Stop that server or choose a different AKSEL_ARCADE_RENDERER_URL.`
      )
    }

    return {
      port,
      url: normalizeRendererUrl(url.toString()),
      viteHost,
    }
  }

  const port = await findAvailablePort(DEFAULT_RENDERER_HOST, DEFAULT_RENDERER_PORT)

  return {
    port,
    url: `http://${DEFAULT_RENDERER_HOST}:${port}${RENDERER_PATH}`,
    viteHost: DEFAULT_RENDERER_HOST,
  }
}

const rendererConfig = await createRendererConfig()
const RENDERER_URL = rendererConfig.url

await assertDesktopMcpPortAvailable()

execFileSync(process.execPath, ['scripts/build-desktop-main.mjs'], {
  stdio: 'inherit',
})

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

console.log(`Starting Desktop Arcade renderer at ${RENDERER_URL}`)

const viteProcess = spawnChild(
  commandName('vite'),
  ['--host', rendererConfig.viteHost, '--port', String(rendererConfig.port), '--strictPort'],
  {
    env: {
      ...process.env,
      BROWSER: 'none',
    },
  }
)

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

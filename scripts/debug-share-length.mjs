#!/usr/bin/env node
import { createServer } from 'vite'
import { chromium } from 'playwright'

const HOST = process.env.AKSEL_ARCADE_HOST ?? '127.0.0.1'
const PORT = Number(process.env.AKSEL_ARCADE_PORT ?? '4173')
const BASE_URL = `http://${HOST}:${PORT}/aksel-arcade/`
const SHARE_BUTTON_LABEL = 'Share project'
const FORCE_STRATEGY_ID = process.env.FORCE_STRATEGY_ID ?? null
const SETTINGS_LABEL = 'Settings'
const COPY_LABEL = /copy share link/i
const SHARE_COMPLETION_TIMEOUT_MS = 20000

const TEMPLATES = [
  {
    label: 'Hooks demo',
    expectWarning: false,
  },
  {
    label: 'Oppsummeringsside for søknadsdialoger',
    expectWarning: true,
  },
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const waitUntilEnabled = async (locator, timeoutMs = SHARE_COMPLETION_TIMEOUT_MS) => {
  const started = Date.now()
  while (true) {
    if (!(await locator.isDisabled())) {
      return
    }
    if (Date.now() - started >= timeoutMs) {
      throw new Error('Timed out waiting for share button to enable')
    }
    await sleep(200)
  }
}

const collectTemplateShare = async ({ page, label, expectWarning }) => {
  await page.getByRole('button', { name: SETTINGS_LABEL }).click()
  await page.getByRole('menuitem', { name: label }).click()

  await page.waitForTimeout(1500)

  await page.evaluate((forcedStrategy) => {
    window.__akselShareDebug = window.__akselShareDebug ?? {}
    if (forcedStrategy) {
      window.__akselShareDebug.forceStrategyId = forcedStrategy
    } else if (window.__akselShareDebug.forceStrategyId) {
      delete window.__akselShareDebug.forceStrategyId
    }
    delete window.__akselShareDebug.forceWarningThresholdHit
  }, FORCE_STRATEGY_ID)

  await page.getByLabel(SHARE_BUTTON_LABEL).click()

  const copyButton = page.getByRole('button', { name: COPY_LABEL })
  await copyButton.waitFor({ state: 'visible', timeout: SHARE_COMPLETION_TIMEOUT_MS })
  await waitUntilEnabled(copyButton)

  const shareInfo = await page.evaluate(() => {
    const handle = window.__akselShareDebug ?? {}
    const envelope = handle.lastEnvelope ?? null
    return {
      link: handle.lastLink ?? null,
      strategyId: handle.currentStrategyId ?? null,
      warning: Boolean(handle.warningThresholdHit),
      payloadChars: envelope?.compressed?.length ?? null,
      approxBytes: envelope?.approxBytes ?? null,
    }
  })

  await page.evaluate(() => {
    window.__COPIED_SHARE_URL__ = ''
  })
  await copyButton.click()
  const copiedUrl = await page.waitForFunction(() => window.__COPIED_SHARE_URL__ || null)
  const shareUrl = await copiedUrl.jsonValue()

  let snapshotStats = null
  try {
    const token = typeof shareUrl === 'string' ? new URL(shareUrl).searchParams.get('share') : null
    if (token) {
      snapshotStats = await page.evaluate(async (shareToken) => {
        const [{ decodeShareToken }, { serializePackedSnapshot }] = await Promise.all([
          import('/aksel-arcade/src/utils/shareDecoding.ts'),
          import('/aksel-arcade/src/utils/snapshotPacking.ts'),
        ])
        const result = await decodeShareToken(shareToken)
        if (!result.snapshot) {
          return null
        }
        const serialized = JSON.stringify(result.snapshot)
        const packed = serializePackedSnapshot(result.snapshot)
        return {
          serializedLength: serialized.length,
          packedLength: packed.length,
          fileCount: result.snapshot.files.length,
        }
      }, token)
    }
  } catch (error) {
    console.warn(`Failed to decode snapshot for ${label}:`, error)
  }

  return {
    template: label,
    expectWarning,
    warning: shareInfo.warning,
    strategyId: shareInfo.strategyId,
    shareUrl,
    charLength: typeof shareUrl === 'string' ? shareUrl.length : null,
    debugLinkLength: shareInfo.link ? shareInfo.link.length : null,
    payloadChars: shareInfo.payloadChars,
    approxBytes: shareInfo.approxBytes,
    snapshotStats,
  }
}

const main = async () => {
  const server = await createServer({
    server: {
      host: HOST,
      port: PORT,
      strictPort: true,
    },
  })
  await server.listen()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  context.on('dialog', dialog => dialog.accept())
  await context.addInitScript(() => {
    window.__COPIED_SHARE_URL__ = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text) => {
          window.__COPIED_SHARE_URL__ = text
          return Promise.resolve()
        },
      },
      configurable: true,
    })
  })

  try {
    const page = await context.newPage()
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: SETTINGS_LABEL }).first().waitFor({ state: 'visible', timeout: 30000 })

    const results = []
    for (const template of TEMPLATES) {
      const data = await collectTemplateShare({ page, ...template })
      results.push(data)
      await page.keyboard.press('Escape')
    }

    console.table(results.map(item => ({
      Template: item.template,
      Strategy: item.strategyId ?? 'unknown',
      Chars: item.charLength ?? 'n/a',
      Warning: item.warning,
      DebugLink: item.debugLinkLength ?? 'n/a',
      Payload: item.payloadChars ?? 'n/a',
      Serialized: item.snapshotStats?.serializedLength ?? 'n/a',
      Packed: item.snapshotStats?.packedLength ?? 'n/a',
    })))
    console.log('\nDetailed share stats:')
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await context.close()
    await browser.close()
    await server.close()
  }
}

main().catch(error => {
  console.error('Share debug failed:', error)
  process.exitCode = 1
})

#!/usr/bin/env node
import { chromium } from 'playwright'
import { createServer } from 'vite'

const HOST = process.env.AKSEL_ARCADE_HOST ?? '127.0.0.1'
const PORT = Number(process.env.AKSEL_ARCADE_PORT ?? '4173')
const BASE_URL = process.env.AKSEL_ARCADE_URL ?? `http://${HOST}:${PORT}/aksel-arcade/`
const SUMMARY_TEMPLATE_LABEL = 'Oppsummeringsside for søknadsdialoger'
const SHARE_BUTTON_LABEL = 'Share project'
const STRATEGY_ID = 'packed-deflate-b91'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const collectConsoleLogs = page => {
  const logs = []
  page.on('console', message => {
    logs.push({
      type: message.type(),
      text: message.text(),
    })
  })
  return logs
}

const waitForCopyButtonEnabled = async locator => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (!(await locator.isDisabled())) {
      return
    }
    await sleep(500)
  }
  throw new Error('Copy button did not become enabled within 30s')
}

const main = async () => {
  const viteServer = await createServer({
    server: {
      port: PORT,
      host: HOST,
      strictPort: true,
    },
  })
  await viteServer.listen()

  try {
    const browser = await chromium.launch({ headless: true })

    try {
      const senderContext = await browser.newContext()
      await senderContext.addInitScript(() => {
        window.__COPIED_SHARE_URL__ = ''
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: text => {
              window.__COPIED_SHARE_URL__ = text
              return Promise.resolve()
            },
          },
          configurable: true,
        })
      })

      const senderPage = await senderContext.newPage()
      senderPage.on('dialog', dialog => dialog.accept())
      const senderLogs = collectConsoleLogs(senderPage)
      await senderPage.goto(BASE_URL)

      await senderPage.getByTestId('project-controls-settings').click()
      await senderPage.getByRole('menuitem', { name: SUMMARY_TEMPLATE_LABEL }).click()

      const previewFrame = senderPage.frameLocator('[data-testid="preview-iframe"]')
      await previewFrame.getByText(/Oppsummering/i).first().waitFor({ timeout: 60000 })

      await senderPage.evaluate(strategyId => {
        window.__akselShareDebug = window.__akselShareDebug ?? {}
        window.__akselShareDebug.forceStrategyId = strategyId
      }, STRATEGY_ID)

      await senderPage.getByLabel(SHARE_BUTTON_LABEL).click()

      const copyButton = senderPage.getByRole('button', { name: /copy share link/i })
      await copyButton.waitFor({ state: 'visible' })
      await waitForCopyButtonEnabled(copyButton)

      const shareHandle = await senderPage.waitForFunction(strategyId => {
        const handle = window.__akselShareDebug
        if (!handle?.lastLink || handle.currentStrategyId !== strategyId) {
          return null
        }
        return {
          link: handle.lastLink,
          token: handle.lastToken,
          warningThresholdHit: Boolean(handle.warningThresholdHit),
        }
      }, STRATEGY_ID, { timeout: 60000 })
      const shareInfo = await shareHandle.jsonValue()

      await copyButton.click()
      const copiedHandle = await senderPage.waitForFunction(
        () => window.__COPIED_SHARE_URL__ || null,
      )
      const copiedUrl = await copiedHandle.jsonValue()

      const recipientContext = await browser.newContext()
      const recipientPage = await recipientContext.newPage()
      const recipientLogs = collectConsoleLogs(recipientPage)

      await recipientPage.goto(copiedUrl)
      const loadButton = recipientPage.getByRole('button', { name: /load shared project/i })
      await loadButton.waitFor({ state: 'visible', timeout: 20000 })
      await loadButton.click()

      await recipientPage.waitForFunction(() => !window.location.search.includes('share='), null, {
        timeout: 15000,
      })

      const recipientPreview = recipientPage.frameLocator('[data-testid="preview-iframe"]')
      await recipientPreview.getByText(/Oppsummering/i).first().waitFor({ timeout: 60000 })

      const telemetryHandle = await recipientPage.evaluate(() => {
        const raw = localStorage.getItem('telemetryQueue')
        const queue = raw ? JSON.parse(raw) : []
        const decode = [...queue].reverse().find(event => event.type === 'share_decode')
        return decode ?? null
      })

      console.log(
        JSON.stringify(
          {
            shareUrl: copiedUrl,
            warningThresholdHit: shareInfo.warningThresholdHit,
            telemetry: telemetryHandle,
            senderConsole: senderLogs,
            recipientConsole: recipientLogs,
          },
          null,
          2,
        ),
      )
    } finally {
      await browser.close()
    }
  } finally {
    await viteServer.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

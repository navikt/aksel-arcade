import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const desktopRendererUrl = 'aksel-arcade://app/index.html'
const desktopMcpUrl = 'http://127.0.0.1:3846/mcp'

const waitForDefaultPreview = async (page: Page) => {
  await expect(page.locator('[data-testid="preview-iframe"]')).toBeVisible({ timeout: 15_000 })
}

const postMcpRequest = async (payload: Record<string, unknown>) => {
  const response = await fetch(desktopMcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(payload),
  })

  expect(response.status).toBe(200)
  return parseJsonOrSse(await response.text())
}

const callTool = async (id: number, name: string, argumentsPayload: Record<string, unknown>) =>
  postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name,
      arguments: argumentsPayload,
    },
  })

const callApplyChanges = async (argumentsPayload: Record<string, unknown>) =>
  callTool(1, 'apply_changes', argumentsPayload)

const readMcpResource = async (id: number, uri: string) => {
  const payload = await postMcpRequest({
    jsonrpc: '2.0',
    id,
    method: 'resources/read',
    params: {
      uri,
    },
  })

  expect(payload).toMatchObject({
    result: {
      contents: [
        {
          uri,
        },
      ],
    },
  })

  return payload.result.contents[0] as {
    uri: string
    mimeType: string
    text: string
  }
}

const readJsonMcpResource = async (id: number, uri: string) =>
  JSON.parse((await readMcpResource(id, uri)).text) as Record<string, unknown>

const parseJsonOrSse = (bodyText: string) => {
  if (!bodyText.startsWith('event:')) {
    return JSON.parse(bodyText) as Record<string, unknown>
  }

  const dataLines = bodyText
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length))

  return JSON.parse(dataLines.join('\n')) as Record<string, unknown>
}

const waitForDiagnosticsIdle = async (timeoutMs = 15_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const diagnostics = await readJsonMcpResource(90, 'arcade://project/diagnostics')
    if (diagnostics.status === 'idle') {
      return diagnostics
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error('Desktop MCP diagnostics did not settle to idle in time.')
}

const enableAnnotationMode = async (page: Page) => {
  const toggle = page.getByRole('button', { name: /annotation mode/i })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
}

const createAnnotation = async (page: Page, targetName: string, text: string) => {
  const previewFrame = page.frameLocator('[data-testid="preview-iframe"]')
  await previewFrame.getByRole('button', { name: targetName }).click()
  await page.getByLabel(/^annotation text$/i).fill(text)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByLabel(/^annotation text$/i)).toBeHidden()
}

const findAnnotationByComment = (
  annotations: Array<Record<string, unknown>>,
  comment: string
): Record<string, unknown> => {
  const annotation = annotations.find((entry) => entry.comment === comment)
  if (!annotation) {
    throw new Error(`Missing annotation with comment "${comment}".`)
  }
  return annotation
}

test.describe('Issue #347 Desktop MCP SDK mutation tools', () => {
  test.beforeAll(() => {
    execFileSync(npmCommand, ['run', 'desktop:build'], { stdio: 'inherit' })
  })

  test('applies durable changes and mutates annotation workflows through the SDK tools', async () => {
    test.setTimeout(180_000)

    const app: ElectronApplication = await electron.launch({
      args: ['desktop/main.cjs'],
      env: {
        ...process.env,
        AKSEL_ARCADE_RENDERER_URL: desktopRendererUrl,
      },
    })

    try {
      const page = await app.firstWindow()
      await waitForDefaultPreview(page)

      const manifestBefore = await readJsonMcpResource(2, 'arcade://project/manifest')
      const entryPage =
        (manifestBefore.pages as Array<Record<string, unknown>>).find(
          (entry) => entry.id === manifestBefore.activePageId
        ) ?? (manifestBefore.pages as Array<Record<string, unknown>>)[0]
      const entryPageJsxUri = ((entryPage.source as Record<string, unknown>).jsx as { uri: string }).uri

      const initialApplyChanges = await callApplyChanges({
        summary: 'Install annotation mutation demo content',
        expectedProjectRevision: manifestBefore.projectRevision,
        operations: [
          {
            type: 'replace_source',
            resourceUri: entryPageJsxUri,
            content: `<main>
  <h1>Mutation workflow demo</h1>
  <p>Desktop MCP updates the visible page.</p>
  <button type="button">Acknowledge target</button>
  <button type="button">Dismiss target</button>
  <button type="button">Dead target</button>
</main>`,
          },
        ],
      })
      expect(initialApplyChanges).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
          },
        },
      })

      await waitForDiagnosticsIdle()
      const previewFrame = page.frameLocator('[data-testid="preview-iframe"]')
      await expect(
        previewFrame.getByRole('heading', { name: 'Mutation workflow demo' })
      ).toBeVisible({ timeout: 15_000 })
      await expect(previewFrame.getByText('Desktop MCP updates the visible page.')).toBeVisible()

      const staleApplyChanges = await callTool(3, 'apply_changes', {
        summary: 'Trigger stale state',
        expectedProjectRevision: manifestBefore.projectRevision,
        operations: [
          {
            type: 'rename_project',
            name: 'Should fail',
          },
        ],
      })
      expect(staleApplyChanges).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            toolName: 'apply_changes',
            code: 'stale-project-revision',
          },
        },
      })

      await enableAnnotationMode(page)
      await createAnnotation(page, 'Acknowledge target', 'Ack me')
      await createAnnotation(page, 'Dismiss target', 'Dismiss me')
      await createAnnotation(page, 'Dead target', 'Dead me')

      const listedAnnotations = await callTool(4, 'list_annotations', { status: 'all' })
      const annotations = (
        listedAnnotations.result.structuredContent as {
          annotations: Array<Record<string, unknown>>
        }
      ).annotations

      const acknowledgeAnnotation = findAnnotationByComment(annotations, 'Ack me')
      const dismissAnnotation = findAnnotationByComment(annotations, 'Dismiss me')
      const deadTargetAnnotation = findAnnotationByComment(annotations, 'Dead me')

      const acknowledged = await callTool(5, 'acknowledge_annotation', {
        annotationId: acknowledgeAnnotation.id as string,
      })
      expect(acknowledged).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
            toolName: 'acknowledge_annotation',
            annotationId: acknowledgeAnnotation.id,
            annotation: {
              status: 'acknowledged',
            },
          },
        },
      })

      const replied = await callTool(6, 'reply_to_annotation', {
        annotationId: acknowledgeAnnotation.id as string,
        message: 'Handled by agent',
      })
      expect(replied).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
            toolName: 'reply_to_annotation',
            annotationId: acknowledgeAnnotation.id,
            annotation: {
              thread: [
                {
                  role: 'agent',
                  content: 'Handled by agent',
                },
              ],
            },
          },
        },
      })

      const resolved = await callTool(7, 'resolve_annotation', {
        annotationId: acknowledgeAnnotation.id as string,
        summary: 'Completed in source',
      })
      expect(resolved).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
            toolName: 'resolve_annotation',
            annotationId: acknowledgeAnnotation.id,
            annotation: {
              status: 'resolved',
            },
          },
        },
      })

      const dismissed = await callTool(8, 'dismiss_annotation', {
        annotationId: dismissAnnotation.id as string,
        reason: 'Not needed',
      })
      expect(dismissed).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
            toolName: 'dismiss_annotation',
            annotationId: dismissAnnotation.id,
            annotation: {
              status: 'dismissed',
              thread: [
                {
                  role: 'agent',
                  content: 'Not needed',
                },
              ],
            },
          },
        },
      })

      const annotationsAfterMutations = await callTool(9, 'list_annotations', {
        status: 'all',
      })
      const annotationHistory = (
        annotationsAfterMutations.result.structuredContent as {
          annotations: Array<Record<string, unknown>>
        }
      ).annotations
      expect(findAnnotationByComment(annotationHistory, 'Ack me').status).toBe('resolved')
      expect(findAnnotationByComment(annotationHistory, 'Dismiss me').status).toBe('dismissed')

      const manifestAfterMutations = await readJsonMcpResource(10, 'arcade://project/manifest')
      const removeDeadTarget = await callTool(11, 'apply_changes', {
        summary: 'Remove the dead-target element',
        expectedProjectRevision: manifestAfterMutations.projectRevision,
        operations: [
          {
            type: 'replace_source',
            resourceUri: entryPageJsxUri,
            content: `<main>
  <h1>Mutation workflow demo</h1>
  <p>Desktop MCP updates the visible page.</p>
  <button type="button">Acknowledge target</button>
  <button type="button">Dismiss target</button>
</main>`,
          },
        ],
      })
      expect(removeDeadTarget).toMatchObject({
        result: {
          structuredContent: {
            ok: true,
          },
        },
      })

      await waitForDiagnosticsIdle()
      await expect(previewFrame.getByRole('button', { name: 'Dead target' })).toHaveCount(0)

      const deadTargetFailure = await callTool(12, 'acknowledge_annotation', {
        annotationId: deadTargetAnnotation.id as string,
      })
      expect(deadTargetFailure).toMatchObject({
        result: {
          isError: true,
          structuredContent: {
            toolName: 'acknowledge_annotation',
            code: 'dead-target-annotation',
            annotationId: deadTargetAnnotation.id,
          },
        },
      })
    } finally {
      await app.close()
    }
  })
})

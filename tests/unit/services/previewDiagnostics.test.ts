import { describe, expect, it } from 'vitest'
import {
  MAX_SANDBOX_CONSOLE_MESSAGES,
  appendSandboxConsoleMessage,
  collectPreviewDiagnostics,
  createSandboxConsoleMessage,
} from '@/services/previewDiagnostics'
import { createDefaultPreviewState } from '@/utils/projectDefaults'

describe('preview diagnostics', () => {
  it('normalizes sandbox console payloads into stable string messages', () => {
    const message = createSandboxConsoleMessage(
      {
        level: 'info',
        args: ['Saved', { count: 2 }, undefined],
      },
      '2026-05-26T08:00:00.000Z'
    )

    expect(message).toEqual({
      level: 'log',
      message: 'Saved {"count":2} undefined',
      args: ['Saved', '{"count":2}', 'undefined'],
      timestamp: '2026-05-26T08:00:00.000Z',
    })
  })

  it('keeps sandbox console history bounded to the latest messages', () => {
    const messages = Array.from({ length: MAX_SANDBOX_CONSOLE_MESSAGES + 2 }, (_, index) =>
      createSandboxConsoleMessage(
        {
          level: 'warn',
          args: [`message ${index}`],
        },
        `2026-05-26T08:00:${String(index).padStart(2, '0')}.000Z`
      )
    )

    const bounded = messages.reduce(appendSandboxConsoleMessage, [])

    expect(bounded).toHaveLength(MAX_SANDBOX_CONSOLE_MESSAGES)
    expect(bounded[0]?.message).toBe('message 2')
    expect(bounded.at(-1)?.message).toBe(`message ${MAX_SANDBOX_CONSOLE_MESSAGES + 1}`)
  })

  it('bounds individual console entries by argument length and count', () => {
    const message = createSandboxConsoleMessage(
      {
        level: 'error',
        args: ['x'.repeat(1_200), ...Array.from({ length: 11 }, (_, index) => index)],
      },
      '2026-05-26T08:00:00.000Z'
    )

    expect(message.args).toHaveLength(11)
    expect(message.args[0]).toBe(`${'x'.repeat(1_000)}...`)
    expect(message.args.at(-1)).toBe('... 2 more')
  })

  it('collects diagnostics from preview state without exposing mutable state references', () => {
    const previewState = {
      ...createDefaultPreviewState(),
      status: 'error' as const,
      compileError: {
        message: 'Compile failed',
        line: 1,
        column: 2,
        stack: 'compile stack',
      },
      sandboxConsoleMessages: [
        createSandboxConsoleMessage(
          {
            level: 'error',
            args: ['console failed'],
          },
          '2026-05-26T08:00:00.000Z'
        ),
      ],
    }

    const diagnostics = collectPreviewDiagnostics(previewState)
    diagnostics.sandboxConsoleMessages[0]?.args.push('mutated')

    expect(diagnostics).toMatchObject({
      status: 'error',
      compileError: {
        message: 'Compile failed',
        line: 1,
        column: 2,
        stack: 'compile stack',
      },
      runtimeError: null,
    })
    expect(previewState.sandboxConsoleMessages[0]?.args).toEqual(['console failed'])
  })
})

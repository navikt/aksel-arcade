import type {
  CompileError,
  PreviewState,
  PreviewStatus,
  RuntimeError,
  SandboxConsoleLevel,
  SandboxConsoleMessage,
} from '@/types/preview'

export const MAX_SANDBOX_CONSOLE_MESSAGES = 25
const MAX_SANDBOX_CONSOLE_ARGS = 10
const MAX_SANDBOX_CONSOLE_ARG_LENGTH = 1_000

export interface SandboxConsolePayload {
  level: unknown
  args: unknown[]
}

export interface PreviewDiagnostics {
  status: PreviewStatus
  compileError: CompileError | null
  runtimeError: RuntimeError | null
  sandboxConsoleMessages: SandboxConsoleMessage[]
}

export const createSandboxConsoleMessage = (
  payload: SandboxConsolePayload,
  timestamp = new Date().toISOString()
): SandboxConsoleMessage => {
  const rawArgs = Array.isArray(payload.args) ? payload.args : []
  const args = rawArgs.slice(0, MAX_SANDBOX_CONSOLE_ARGS).map(formatConsoleArgument)

  if (rawArgs.length > MAX_SANDBOX_CONSOLE_ARGS) {
    args.push(`... ${rawArgs.length - MAX_SANDBOX_CONSOLE_ARGS} more`)
  }

  return {
    level: normalizeConsoleLevel(payload.level),
    message: args.join(' '),
    args,
    timestamp,
  }
}

export const appendSandboxConsoleMessage = (
  messages: SandboxConsoleMessage[],
  message: SandboxConsoleMessage
): SandboxConsoleMessage[] =>
  [...messages, message].slice(-MAX_SANDBOX_CONSOLE_MESSAGES)

export const collectPreviewDiagnostics = (previewState: PreviewState): PreviewDiagnostics =>
  clonePreviewDiagnostics({
    status: previewState.status,
    compileError: previewState.compileError,
    runtimeError: previewState.runtimeError,
    sandboxConsoleMessages: previewState.sandboxConsoleMessages,
  })

export const clonePreviewDiagnostics = (
  diagnostics: PreviewDiagnostics
): PreviewDiagnostics => ({
  status: diagnostics.status,
  compileError: diagnostics.compileError ? { ...diagnostics.compileError } : null,
  runtimeError: diagnostics.runtimeError ? { ...diagnostics.runtimeError } : null,
  sandboxConsoleMessages: diagnostics.sandboxConsoleMessages.map((message) => ({
    ...message,
    args: [...message.args],
  })),
})

const normalizeConsoleLevel = (level: unknown): SandboxConsoleLevel => {
  if (level === 'warn' || level === 'error') {
    return level
  }

  return 'log'
}

const formatConsoleArgument = (value: unknown): string => {
  if (typeof value === 'string') {
    return truncateConsoleArgument(value)
  }

  if (value instanceof Error) {
    return truncateConsoleArgument(`${value.name}: ${value.message}`)
  }

  try {
    const json = JSON.stringify(value)
    if (typeof json === 'string') {
      return truncateConsoleArgument(json)
    }
  } catch {
    // Fall back to String below for circular objects or host objects.
  }

  return truncateConsoleArgument(String(value))
}

const truncateConsoleArgument = (value: string): string =>
  value.length > MAX_SANDBOX_CONSOLE_ARG_LENGTH
    ? `${value.slice(0, MAX_SANDBOX_CONSOLE_ARG_LENGTH)}...`
    : value

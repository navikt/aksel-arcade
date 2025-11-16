import type { CompileError, RuntimeError } from '@/types/preview'

export const formatCompileError = (error: CompileError): string => {
  const location = error.line !== null ? ` (line ${error.line + 1})` : ''
  return `Compile Error${location}: ${error.message}`
}

export const formatRuntimeError = (error: RuntimeError): string => {
  let message = `Runtime Error: ${error.message}`

  if (error.componentStack) {
    message += `\n\nComponent Stack:${error.componentStack}`
  }

  return message
}

export const extractErrorLine = (error: Error): number | null => {
  // Try to extract line number from stack trace
  const match = error.stack?.match(/:(\d+):\d+/)
  return match ? parseInt(match[1], 10) : null
}

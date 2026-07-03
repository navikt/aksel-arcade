export const createToolSuccessResult = <T extends object>(message: string, structuredContent: T) => ({
  content: [
    {
      type: 'text' as const,
      text: message,
    },
  ],
  structuredContent,
})

export const createToolErrorResult = <TToolName extends string>(
  toolName: TToolName,
  code: string,
  message: string,
  extras: Record<string, unknown> = {}
) => ({
  content: [
    {
      type: 'text' as const,
      text: message,
    },
  ],
  isError: true,
  structuredContent: {
    code,
    toolName,
    message,
    ...extras,
  },
})

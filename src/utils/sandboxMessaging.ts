import type { MainToSandboxMessage } from '@/types/messages'

type SandboxMessageLocation = Pick<Location, 'origin' | 'protocol'>

export const getSandboxMessageTargetOrigin = (
  _location: SandboxMessageLocation = window.location
): string => '*'

export const postMessageToSandbox = (
  targetWindow: Window,
  message: MainToSandboxMessage,
  location: SandboxMessageLocation = window.location
) => {
  targetWindow.postMessage(message, getSandboxMessageTargetOrigin(location))
}

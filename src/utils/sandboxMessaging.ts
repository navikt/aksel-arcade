import type { MainToSandboxMessage } from '@/types/messages'

type SandboxMessageLocation = Pick<Location, 'origin' | 'protocol'>

export const getSandboxMessageTargetOrigin = (
  location: SandboxMessageLocation = window.location
): string => (location.protocol === 'file:' ? '*' : location.origin)

export const postMessageToSandbox = (
  targetWindow: Window,
  message: MainToSandboxMessage,
  location: SandboxMessageLocation = window.location
) => {
  targetWindow.postMessage(message, getSandboxMessageTargetOrigin(location))
}

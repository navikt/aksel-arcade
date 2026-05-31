import type { MainToSandboxMessage } from '@/types/messages'

type SandboxMessageLocation = Pick<Location, 'origin' | 'protocol'>

const sandboxMessagePorts = new WeakMap<Window, MessagePort>()

export const getSandboxMessageTargetOrigin = (
  _location: SandboxMessageLocation = window.location
): string => '*'

export const registerSandboxMessagePort = (targetWindow: Window, port: MessagePort) => {
  sandboxMessagePorts.set(targetWindow, port)
}

export const unregisterSandboxMessagePort = (targetWindow: Window) => {
  sandboxMessagePorts.delete(targetWindow)
}

export const postMessageToSandbox = (
  targetWindow: Window,
  message: MainToSandboxMessage,
  location: SandboxMessageLocation = window.location,
  transfer?: Transferable[]
) => {
  if (message.type === 'CONNECT_SANDBOX') {
    targetWindow.postMessage(message, getSandboxMessageTargetOrigin(location), transfer)
    return
  }

  sandboxMessagePorts.get(targetWindow)?.postMessage(message)
}

const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'
const START_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:start-agent-transport-session'
const STOP_AGENT_TRANSPORT_CHANNEL = 'aksel-arcade:stop-agent-transport-session'

contextBridge.exposeInMainWorld(
  '__AKSEL_ARCADE_DESKTOP__',
  Object.freeze({
    getShellCapabilities: () => ipcRenderer.invoke(SHELL_CAPABILITIES_CHANNEL),
    startAgentTransportSession: (session) =>
      ipcRenderer.invoke(START_AGENT_TRANSPORT_CHANNEL, session),
    stopAgentTransportSession: (sessionId, reason) =>
      ipcRenderer.invoke(STOP_AGENT_TRANSPORT_CHANNEL, { sessionId, reason }),
  })
)

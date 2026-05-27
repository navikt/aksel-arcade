const { contextBridge, ipcRenderer } = require('electron')

const SHELL_CAPABILITIES_CHANNEL = 'aksel-arcade:get-shell-capabilities'

contextBridge.exposeInMainWorld(
  '__AKSEL_ARCADE_DESKTOP__',
  Object.freeze({
    getShellCapabilities: () => ipcRenderer.invoke(SHELL_CAPABILITIES_CHANNEL),
  })
)

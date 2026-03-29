const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  ping: () => "pong",
});

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  isElectron: true,
});

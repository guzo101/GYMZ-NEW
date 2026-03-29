const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  ping: () => "pong",
});

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  isElectron: true,
  onDeepLink: (callback) => {
    ipcRenderer.on("deep-link", (_, url) => callback(url));
  },
});

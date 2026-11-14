const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("paintVaultDesktop", {
  getStartupState: () => ipcRenderer.invoke("startup:get"),
  openLogsFolder: () => ipcRenderer.invoke("startup:logs"),
  onStartupState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("startup:state", handler);
    return () => ipcRenderer.removeListener("startup:state", handler);
  },
  getLanguage: () => ipcRenderer.invoke("language:get"),
  setLanguage: (language) => ipcRenderer.invoke("language:set", language),
  getConnection: () => ipcRenderer.invoke("connection:get"),
  setConnection: (choice) => ipcRenderer.invoke("connection:set", choice),
  saveBinary: (input) => ipcRenderer.invoke("file:save-binary", input),
  saveBackup: (input) => ipcRenderer.invoke("file:save-backup", input),
  restoreBackup: (file, input) =>
    ipcRenderer.invoke("file:restore-backup", { ...input, path: webUtils.getPathForFile(file) }),
  getUpdateState: () => ipcRenderer.invoke("update:get"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  respondToUpdate: (input) => ipcRenderer.invoke("update:respond", input),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("update:state", handler);
    return () => ipcRenderer.removeListener("update:state", handler);
  },
});

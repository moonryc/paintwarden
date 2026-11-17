const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("paintwardenDesktop", {
  titleBar: {
    platform: process.platform,
    getState: () => ipcRenderer.invoke("window:get"),
    doubleClick: () => ipcRenderer.invoke("window:double-click"),
    onState: (listener) => {
      const handler = (_event, state) => listener(state);
      ipcRenderer.on("window:state", handler);
      return () => ipcRenderer.removeListener("window:state", handler);
    },
  },
  getSupportSummary: (language) => ipcRenderer.invoke("support:summary", language),
  saveSupportBundle: (language) => ipcRenderer.invoke("support:save", language),
  openBugReport: (language) => ipcRenderer.invoke("support:report", language),
  getStartupState: () => ipcRenderer.invoke("startup:get"),
  openLogsFolder: () => ipcRenderer.invoke("startup:logs"),
  onStartupState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("startup:state", handler);
    return () => ipcRenderer.removeListener("startup:state", handler);
  },
  getLanguage: () => ipcRenderer.invoke("language:get"),
  setLanguage: (language) => ipcRenderer.invoke("language:set", language),
  getPhoneAccess: () => ipcRenderer.invoke("phone-access:get"),
  setPhoneAccess: (enabled) => ipcRenderer.invoke("phone-access:set", enabled),
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

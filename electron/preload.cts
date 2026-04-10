const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  showMainWindow: () => ipcRenderer.send("window:show-main"),
  toggleMiniMode: () => ipcRenderer.invoke("window:toggle-mini-mode") as Promise<boolean>,
  getMiniModeEnabled: () =>
    ipcRenderer.invoke("window:get-mini-mode-enabled") as Promise<boolean>,
  onMiniModeChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, enabled: boolean) => {
      callback(enabled);
    };

    ipcRenderer.on("mini-mode:changed", handler);

    return () => {
      ipcRenderer.removeListener("mini-mode:changed", handler);
    };
  },
  playTimerSound: () => ipcRenderer.invoke("timer:play-sound") as Promise<void>,
  enterTimerAttentionMode: () =>
    ipcRenderer.invoke("timer:enter-attention-mode") as Promise<void>,
  restoreFromTimerAttentionMode: () =>
    ipcRenderer.invoke("timer:restore-from-attention-mode") as Promise<void>,
});

import { contextBridge, ipcRenderer } from "electron";

import type { CodexCompanionApi } from "../shared/contracts";

const api: CodexCompanionApi = {
  getDashboard: (force) => ipcRenderer.invoke("dashboard:get", force),
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  updatePreferences: (patch) => ipcRenderer.invoke("preferences:update", patch),
  refreshDashboard: () => ipcRenderer.invoke("dashboard:refresh"),
  updateWidgetPreferences: (patch) =>
    ipcRenderer.invoke("widget:update-preferences", patch),
  onPreferencesUpdated: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      preferences: Parameters<typeof listener>[0]
    ) => {
      listener(preferences);
    };

    ipcRenderer.on("preferences:updated", subscription);
    return () => {
      ipcRenderer.removeListener("preferences:updated", subscription);
    };
  },
  onDashboardUpdated: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      snapshot: Parameters<typeof listener>[0]
    ) => {
      listener(snapshot);
    };

    ipcRenderer.on("dashboard:updated", subscription);
    return () => {
      ipcRenderer.removeListener("dashboard:updated", subscription);
    };
  },
  openPage: (page) => ipcRenderer.invoke("app:open-page", page),
  showWidget: () => ipcRenderer.invoke("widget:show"),
  hideWidget: () => ipcRenderer.invoke("widget:hide")
};

contextBridge.exposeInMainWorld("codexCompanion", api);

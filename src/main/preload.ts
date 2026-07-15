import { contextBridge, ipcRenderer } from "electron";

import type { CodexCompanionApi } from "../shared/contracts";

const api: CodexCompanionApi = {
  getDashboard: (force) => ipcRenderer.invoke("dashboard:get", force),
  getNotifications: () => ipcRenderer.invoke("notifications:get"),
  markNotificationsRead: (keys) => ipcRenderer.invoke("notifications:mark-read", keys),
  getGitIntegrationStatus: () => ipcRenderer.invoke("git:status"),
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  setUpdatePreferences: (patch) =>
    ipcRenderer.invoke("updates:set-preferences", patch),
  openUpdateRelease: () => ipcRenderer.invoke("updates:open-release"),
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
  onNotificationsUpdated: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      notifications: Parameters<typeof listener>[0]
    ) => {
      listener(notifications);
    };

    ipcRenderer.on("notifications:updated", subscription);
    return () => {
      ipcRenderer.removeListener("notifications:updated", subscription);
    };
  },
  onUpdateStateChanged: (listener) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof listener>[0]
    ) => {
      listener(state);
    };

    ipcRenderer.on("updates:state-changed", subscription);
    return () => {
      ipcRenderer.removeListener("updates:state-changed", subscription);
    };
  },
  openPage: (page) => ipcRenderer.invoke("app:open-page", page),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  selectDirectory: () => ipcRenderer.invoke("app:select-directory"),
  showWidget: () => ipcRenderer.invoke("widget:show"),
  hideWidget: () => ipcRenderer.invoke("widget:hide")
};

contextBridge.exposeInMainWorld("codexCompanion", api);

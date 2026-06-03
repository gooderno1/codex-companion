import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  AppPage,
  AppPreferences,
  DashboardSnapshot,
  WidgetPreferences
} from "../shared/contracts";
import { DashboardService } from "./collectors/dashboardCollector";
import { SettingsStore } from "./state/settingsStore";
import { SnapshotStore } from "./state/snapshotStore";

let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let dashboardService: DashboardService;
let currentPreferences: AppPreferences | null = null;
let latestSnapshot: DashboardSnapshot | null = null;
let persistBoundsTimer: NodeJS.Timeout | null = null;
const WIDGET_DISABLED = true;

const preloadPath = path.join(__dirname, "preload.js");

function isDevelopment() {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function resolveRendererUrl(page: AppPage): string {
  const route = `#/${page}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}/${route}`;
  }

  const indexPath = path.join(app.getAppPath(), "dist", "index.html");
  return `${pathToFileURL(indexPath).toString()}${route}`;
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
      </defs>
      <path d="M22 10c7-4 16-4 23 0 10 6 15 18 13 29" fill="none" stroke="url(#orbit)" stroke-width="4" stroke-linecap="round"/>
      <path d="M42 54c-7 4-16 4-23 0C9 48 4 36 6 25" fill="none" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>
      <circle cx="48" cy="12" r="4.5" fill="#ffffff" stroke="#2563EB" stroke-width="3"/>
      <circle cx="54" cy="43" r="4.5" fill="#ffffff" stroke="#2563EB" stroke-width="3"/>
      <circle cx="10" cy="31" r="4.5" fill="#ffffff" stroke="#2563EB" stroke-width="3"/>
      <path d="M32 16 18 24v16l14 8 14-8V24Z" fill="none" stroke="#06B6D4" stroke-width="4" stroke-linejoin="round"/>
      <rect x="24" y="26" width="6" height="6" rx="1.5" fill="#1F2937"/>
      <rect x="34" y="26" width="6" height="6" rx="1.5" fill="#1F2937"/>
      <rect x="24" y="36" width="6" height="6" rx="1.5" fill="#1F2937"/>
      <rect x="34" y="36" width="6" height="6" rx="1.5" fill="#1F2937"/>
    </svg>
  `;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
}

function defaultWidgetBounds(preferences: WidgetPreferences) {
  const display = screen.getPrimaryDisplay().workArea;
  const size =
    preferences.preset === "mini-capsule"
      ? { width: 360, height: 78 }
      : { width: 720, height: 108 };

  return {
    x: Math.round(display.x + (display.width - size.width) / 2),
    y: display.y + 24,
    width: size.width,
    height: size.height
  };
}

function normalizeWidgetBounds(
  preferences: WidgetPreferences,
  existingBounds?: Electron.Rectangle | null
) {
  const fallback = defaultWidgetBounds(preferences);
  const base =
    preferences.bounds ??
    existingBounds ?? {
      x: fallback.x,
      y: fallback.y,
      width: fallback.width,
      height: fallback.height
    };

  const width = preferences.preset === "mini-capsule" ? 360 : 720;
  const height = preferences.preset === "mini-capsule" ? 78 : 108;

  return {
    x: base.x,
    y: base.y,
    width,
    height
  };
}

async function broadcastPreferences(preferences: AppPreferences) {
  currentPreferences = preferences;
  mainWindow?.webContents.send("preferences:updated", preferences);
  if (!WIDGET_DISABLED) {
    widgetWindow?.webContents.send("preferences:updated", preferences);
  }
  refreshTrayMenu();
}

async function applyWidgetPreferences(preferences: AppPreferences) {
  if (WIDGET_DISABLED) {
    const next = await dashboardService.updateWidgetPreferences({ visible: false });
    await broadcastPreferences(next);
    return;
  }

  if (!widgetWindow) {
    return;
  }

  const bounds = normalizeWidgetBounds(
    preferences.widget,
    widgetWindow.getBounds()
  );

  const currentBounds = widgetWindow.getBounds();
  if (
    currentBounds.x !== bounds.x ||
    currentBounds.y !== bounds.y ||
    currentBounds.width !== bounds.width ||
    currentBounds.height !== bounds.height
  ) {
    widgetWindow.setBounds(bounds);
  }

  widgetWindow.setOpacity(
    Math.max(0.4, Math.min(1, preferences.widget.opacity))
  );
  widgetWindow.setIgnoreMouseEvents(preferences.widget.clickThrough, {
    forward: true
  });

  if (preferences.widget.visible) {
    widgetWindow.showInactive();
  } else {
    widgetWindow.hide();
  }

  await broadcastPreferences(preferences);
}

async function loadSnapshot(force = false) {
  latestSnapshot = await dashboardService.getSnapshot(force);
  if (!force) {
    dashboardService.refreshSnapshotInBackground();
  }
  refreshTrayMenu();
  return latestSnapshot;
}

function refreshTrayMenu() {
  if (!tray || !currentPreferences) {
    return;
  }

  const summary =
    latestSnapshot?.widget.metrics
      .map((metric) => `${metric.label} ${metric.value}`)
      .join(" | ") ?? "等待首个快照";

  tray.setToolTip(`Codex Companion\n${summary}`);

  const menu = Menu.buildFromTemplate([
    {
      label: "打开主界面",
      click: async () => {
        await openPage("overview");
      }
    },
    ...(WIDGET_DISABLED
      ? []
      : [
          {
            label: "显示挂件",
            type: "checkbox" as const,
            checked: currentPreferences.widget.visible,
            click: async () => {
              const next = await dashboardService.updateWidgetPreferences({
                visible: !currentPreferences?.widget.visible
              });
              await applyWidgetPreferences(next);
            }
          },
          {
            label: "锁定位置",
            type: "checkbox" as const,
            checked: currentPreferences.widget.locked,
            click: async () => {
              const next = await dashboardService.updateWidgetPreferences({
                locked: !currentPreferences?.widget.locked
              });
              await applyWidgetPreferences(next);
            }
          },
          {
            label: "点击穿透",
            type: "checkbox" as const,
            checked: currentPreferences.widget.clickThrough,
            click: async () => {
              const next = await dashboardService.updateWidgetPreferences({
                clickThrough: !currentPreferences?.widget.clickThrough
              });
              await applyWidgetPreferences(next);
            }
          },
          {
            label: "隐私模式",
            type: "checkbox" as const,
            checked: currentPreferences.widget.privacyMode,
            click: async () => {
              const next = await dashboardService.updateWidgetPreferences({
                privacyMode: !currentPreferences?.widget.privacyMode
              });
              await applyWidgetPreferences(next);
            }
          },
          {
            label:
              currentPreferences.widget.preset === "signal-bar"
                ? "切换到极简胶囊"
                : "切换到顶部信号条",
            click: async () => {
              const next = await dashboardService.updateWidgetPreferences({
                preset:
                  currentPreferences?.widget.preset === "signal-bar"
                    ? "mini-capsule"
                    : "signal-bar"
              });
              await applyWidgetPreferences(next);
            }
          }
        ]),
    { type: "separator" },
    {
      label: "刷新数据",
      click: async () => {
        await loadSnapshot(true);
      }
    },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

async function openPage(page: AppPage) {
  if (page === "widget") {
    return;
  }

  if (!mainWindow) {
    return;
  }

  await mainWindow.loadURL(resolveRendererUrl(page));
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: "Codex Companion",
    backgroundColor: "#F5FAFF",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadURL(resolveRendererUrl("overview"));

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });
}

function schedulePersistWidgetBounds() {
  if (!widgetWindow) {
    return;
  }

  if (persistBoundsTimer) {
    clearTimeout(persistBoundsTimer);
  }

  persistBoundsTimer = setTimeout(async () => {
    if (!widgetWindow) {
      return;
    }

    const bounds = widgetWindow.getBounds();
    const next = await dashboardService.updateWidgetPreferences({ bounds });
    await broadcastPreferences(next);
  }, 250);
}

function createWidgetWindow(preferences: AppPreferences) {
  widgetWindow = new BrowserWindow({
    ...normalizeWidgetBounds(preferences.widget),
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: "Codex Companion Widget",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.setAlwaysOnTop(true, "screen-saver");
  widgetWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  });
  void widgetWindow.loadURL(resolveRendererUrl("widget"));

  widgetWindow.on("move", () => {
    if (!currentPreferences?.widget.locked) {
      schedulePersistWidgetBounds();
    }
  });

  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle("dashboard:get", async (_event, force?: boolean) =>
    loadSnapshot(Boolean(force))
  );
  ipcMain.handle("dashboard:refresh", async () => loadSnapshot(true));
  ipcMain.handle("preferences:get", async () => dashboardService.getPreferences());
  ipcMain.handle(
    "widget:update-preferences",
    async (_event, patch: Partial<WidgetPreferences>) => {
      const next = await dashboardService.updateWidgetPreferences(patch);
      await applyWidgetPreferences(next);
      return next;
    }
  );
  ipcMain.handle("app:open-page", async (_event, page: AppPage) => {
    await openPage(page);
  });
  ipcMain.handle("widget:show", async () => {
    if (WIDGET_DISABLED) {
      return dashboardService.getPreferences();
    }
    const next = await dashboardService.updateWidgetPreferences({ visible: true });
    await applyWidgetPreferences(next);
    return next;
  });
  ipcMain.handle("widget:hide", async () => {
    if (WIDGET_DISABLED) {
      return dashboardService.getPreferences();
    }
    const next = await dashboardService.updateWidgetPreferences({ visible: false });
    await applyWidgetPreferences(next);
    return next;
  });
}

async function bootstrap() {
  const settingsStore = new SettingsStore(app.getPath("userData"));
  const snapshotStore = new SnapshotStore(app.getPath("userData"));
  dashboardService = new DashboardService(settingsStore, snapshotStore);
  currentPreferences = await dashboardService.getPreferences();

  createMainWindow();
  if (!WIDGET_DISABLED) {
    createWidgetWindow(currentPreferences);
  }

  tray = new Tray(createTrayIcon().resize({ width: 18, height: 18 }));
  tray.on("double-click", () => {
    void openPage("overview");
  });

  registerIpcHandlers();
  await applyWidgetPreferences(currentPreferences);
  void loadSnapshot(false);

  if (isDevelopment()) {
    mainWindow?.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  void bootstrap();
});

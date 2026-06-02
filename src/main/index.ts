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
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2F8CFF"/>
          <stop offset="100%" stop-color="#12BFD1"/>
        </linearGradient>
      </defs>
      <rect x="6" y="14" width="52" height="36" rx="10" fill="url(#g)" opacity="0.92"/>
      <rect x="14" y="24" width="14" height="4" rx="2" fill="#F5FAFF"/>
      <rect x="14" y="34" width="22" height="4" rx="2" fill="#F5FAFF" opacity="0.9"/>
      <circle cx="47" cy="32" r="7" fill="#F5FAFF"/>
      <circle cx="47" cy="32" r="3" fill="#2F8CFF"/>
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
  widgetWindow?.webContents.send("preferences:updated", preferences);
  refreshTrayMenu();
}

async function applyWidgetPreferences(preferences: AppPreferences) {
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
    {
      label: "显示挂件",
      type: "checkbox",
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
      type: "checkbox",
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
      type: "checkbox",
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
      type: "checkbox",
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
    },
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
    widgetWindow?.showInactive();
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
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 820,
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
    const next = await dashboardService.updateWidgetPreferences({ visible: true });
    await applyWidgetPreferences(next);
  });
  ipcMain.handle("widget:hide", async () => {
    const next = await dashboardService.updateWidgetPreferences({ visible: false });
    await applyWidgetPreferences(next);
  });
}

async function bootstrap() {
  const settingsStore = new SettingsStore(app.getPath("userData"));
  const snapshotStore = new SnapshotStore(app.getPath("userData"));
  dashboardService = new DashboardService(settingsStore, snapshotStore);
  currentPreferences = await dashboardService.getPreferences();

  createMainWindow();
  createWidgetWindow(currentPreferences);

  tray = new Tray(createTrayIcon().resize({ width: 18, height: 18 }));
  tray.on("double-click", () => {
    void openPage("overview");
  });

  registerIpcHandlers();
  await applyWidgetPreferences(currentPreferences);
  await loadSnapshot(true);

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

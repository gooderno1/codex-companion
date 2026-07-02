import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  Tray
} from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

import type {
  AppPage,
  AppPreferences,
  DashboardNotificationEntry,
  DashboardSnapshot,
  RefreshTrigger,
  WidgetPreferences
} from "../shared/contracts";
import { DashboardService } from "./collectors/dashboardCollector";
import { CodexSessionCacheStore } from "./state/codexSessionCacheStore";
import { DashboardNotificationService } from "./notifications";
import { SettingsStore } from "./state/settingsStore";
import { SnapshotStore } from "./state/snapshotStore";

let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let dashboardService: DashboardService;
let dashboardNotificationService: DashboardNotificationService | null = null;
let currentPreferences: AppPreferences | null = null;
let latestSnapshot: DashboardSnapshot | null = null;
let persistBoundsTimer: NodeJS.Timeout | null = null;
const WIDGET_DISABLED = true;
const DASHBOARD_REFRESH_INTERVAL_MS = 5 * 60_000;
const STARTUP_BACKGROUND_REFRESH_DELAY_MS = 15_000;
let dashboardRefreshTimer: NodeJS.Timeout | null = null;
let dashboardRefreshTask: Promise<DashboardSnapshot> | null = null;
let startupRefreshTimer: NodeJS.Timeout | null = null;

const preloadPath = path.join(__dirname, "preload.js");

if (process.platform === "win32") {
  app.setAppUserModelId("com.gooderno1.codex-companion");
}

if (process.env.CODEX_COMPANION_CAPTURE_PATH) {
  app.disableHardwareAcceleration();
}

function isDevelopment() {
  return Boolean(process.env.VITE_DEV_SERVER_URL);
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveRendererUrl(page: AppPage): string {
  const overviewMode = process.env.CODEX_COMPANION_OVERVIEW_MODE;
  const overviewQuery =
    page === "overview" && overviewMode === "billing" ? "?overviewMode=billing" : "";
  const route = `#/${page}${overviewQuery}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}/${route}`;
  }

  const indexPath = path.join(app.getAppPath(), "dist", "index.html");
  return `${pathToFileURL(indexPath).toString()}${route}`;
}

function resolveInitialPage(): AppPage {
  const capturePage = process.env.CODEX_COMPANION_CAPTURE_PAGE;
  if (
    capturePage === "overview" ||
    capturePage === "ledger" ||
    capturePage === "repositories" ||
    capturePage === "settings" ||
    capturePage === "widget"
  ) {
    return capturePage;
  }

  return "overview";
}

function scheduleMainWindowCapture() {
  const capturePath = process.env.CODEX_COMPANION_CAPTURE_PATH;
  if (!capturePath || !mainWindow) {
    return;
  }

  const delayMs = numberFromEnv("CODEX_COMPANION_CAPTURE_DELAY_MS", 5000);
  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      void (async () => {
        let captureFailed = false;
        try {
          if (!mainWindow) {
            throw new Error("主窗口不存在");
          }

          const snapshot = await refreshDashboardAndBroadcast();
          if (snapshot.generatedFrom !== "live") {
            throw new Error("截图前数据采集未生成 live 快照，已拒绝使用缓存截图");
          }
          await delay(1_000);

          let lastCaptureError: unknown = null;
          let image: Electron.NativeImage | null = null;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              await delay(attempt * 750);
              const bounds = mainWindow.getBounds();
              image = await mainWindow.capturePage({
                x: 0,
                y: 0,
                width: bounds.width,
                height: bounds.height
              });
              break;
            } catch (error) {
              lastCaptureError = error;
              await delay(750);
            }
          }

          if (!image) {
            throw lastCaptureError ?? new Error("截图结果为空");
          }

          await writeFile(capturePath, image.toPNG());
        } catch (error) {
          captureFailed = true;
          console.error(
            `截图失败：${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          isQuitting = true;
          app.exit(captureFailed ? 1 : 0);
        }
      })();
    }, delayMs);
  });
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function setPixel(
  pixels: Buffer,
  size: number,
  x: number,
  y: number,
  color: [number, number, number, number]
) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function createTrayPngBuffer(size = 32): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const outerRadius = size * 0.43;
  const ringOuter = size * 0.29;
  const ringInner = size * 0.19;
  const blue: [number, number, number, number] = [37, 99, 235, 255];
  const teal: [number, number, number, number] = [6, 182, 212, 255];
  const white: [number, number, number, number] = [255, 255, 255, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.hypot(dx, dy);

      if (distance <= outerRadius) {
        const mix = Math.max(0, Math.min(1, (x + y) / (size * 2)));
        setPixel(pixels, size, x, y, [
          Math.round(blue[0] * (1 - mix) + teal[0] * mix),
          Math.round(blue[1] * (1 - mix) + teal[1] * mix),
          Math.round(blue[2] * (1 - mix) + teal[2] * mix),
          255
        ]);
      }

      const inRing = distance >= ringInner && distance <= ringOuter;
      const openRight = dx > 0 && Math.abs(dy) < ringInner * 0.72;
      if (inRing && !openRight) {
        setPixel(pixels, size, x, y, white);
      }
    }
  }

  const dotRadius = Math.max(2, size * 0.09);
  const dotCenterX = Math.round(size * 0.72);
  const dotCenterY = Math.round(size * 0.5);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x - dotCenterX, y - dotCenterY) <= dotRadius) {
        setPixel(pixels, size, x, y, teal);
      }
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const sourceStart = y * size * 4;
    const targetStart = y * (size * 4 + 1);
    scanlines[targetStart] = 0;
    pixels.copy(scanlines, targetStart + 1, sourceStart, sourceStart + size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createTrayIcon() {
  const icon = nativeImage.createFromBuffer(createTrayPngBuffer(32));
  icon.setTemplateImage(false);
  return icon;
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

function sendDashboardUpdate(
  targetWindow: BrowserWindow | null,
  snapshot: DashboardSnapshot
) {
  if (!targetWindow || targetWindow.webContents.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send("dashboard:updated", snapshot);
}

function sendNotificationsUpdate(
  targetWindow: BrowserWindow | null,
  notifications: DashboardNotificationEntry[]
) {
  if (!targetWindow || targetWindow.webContents.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send("notifications:updated", notifications);
}

async function broadcastDashboardNotifications() {
  if (!dashboardNotificationService) {
    return [];
  }

  const notifications = await dashboardNotificationService.getNotifications();
  sendNotificationsUpdate(mainWindow, notifications);
  if (!WIDGET_DISABLED) {
    sendNotificationsUpdate(widgetWindow, notifications);
  }
  return notifications;
}

function broadcastDashboardSnapshot(snapshot: DashboardSnapshot) {
  latestSnapshot = snapshot;
  sendDashboardUpdate(mainWindow, snapshot);
  if (!WIDGET_DISABLED) {
    sendDashboardUpdate(widgetWindow, snapshot);
  }
  refreshTrayMenu();
  void showDashboardNotifications(snapshot);
}

async function showDashboardNotifications(snapshot: DashboardSnapshot) {
  if (
    !dashboardNotificationService ||
    process.env.CODEX_COMPANION_CAPTURE_PATH
  ) {
    return;
  }

  try {
    const notifications =
      await dashboardNotificationService.takeUnsentNotifications(snapshot);
    await broadcastDashboardNotifications();

    if (!Notification.isSupported()) {
      return;
    }

    for (const item of notifications) {
      const notification = new Notification({
        title: item.title,
        body: item.body,
        silent: false
      });
      notification.on("click", () => {
        void openPage(item.page);
      });
      notification.show();
    }
  } catch (error) {
    console.error(
      `系统通知失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function refreshDashboardAndBroadcast(
  trigger: RefreshTrigger = "manual"
): Promise<DashboardSnapshot> {
  if (dashboardRefreshTask) {
    return dashboardRefreshTask;
  }

  dashboardRefreshTask = dashboardService
    .getSnapshot(true, trigger)
    .then((snapshot) => {
      broadcastDashboardSnapshot(snapshot);
      return snapshot;
    })
    .finally(() => {
      dashboardRefreshTask = null;
    });

  return dashboardRefreshTask;
}

function startDashboardAutoRefresh() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = setInterval(() => {
    void refreshDashboardAndBroadcast("auto").catch((error) => {
      console.error(
        `自动刷新失败：${error instanceof Error ? error.message : String(error)}`
      );
    });
  }, DASHBOARD_REFRESH_INTERVAL_MS);
}

function stopDashboardAutoRefresh() {
  if (!dashboardRefreshTimer) {
    return;
  }

  clearInterval(dashboardRefreshTimer);
  dashboardRefreshTimer = null;
}

function scheduleStartupBackgroundRefresh() {
  if (startupRefreshTimer) {
    clearTimeout(startupRefreshTimer);
  }

  startupRefreshTimer = setTimeout(() => {
    startupRefreshTimer = null;
    void refreshDashboardAndBroadcast("startup").catch((error) => {
      console.error(
        `启动后台刷新失败：${error instanceof Error ? error.message : String(error)}`
      );
    });
  }, STARTUP_BACKGROUND_REFRESH_DELAY_MS);
}

async function loadSnapshot(force = false) {
  latestSnapshot = await dashboardService.getSnapshot(force);
  if (!force && latestSnapshot.generatedFrom === "pending") {
    const backgroundRefresh = dashboardService.refreshSnapshotInBackground("startup");
    if (backgroundRefresh) {
      void backgroundRefresh
        .then((snapshot) => {
          broadcastDashboardSnapshot(snapshot);
        })
        .catch((error) => {
          console.error(
            `后台刷新失败：${error instanceof Error ? error.message : String(error)}`
          );
        });
    }
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
        await refreshDashboardAndBroadcast("manual");
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
    width: numberFromEnv("CODEX_COMPANION_WINDOW_WIDTH", 1360),
    height: numberFromEnv("CODEX_COMPANION_WINDOW_HEIGHT", 900),
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

  scheduleMainWindowCapture();
  void mainWindow.loadURL(resolveRendererUrl(resolveInitialPage()));

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
    force ? refreshDashboardAndBroadcast("manual") : loadSnapshot(false)
  );
  ipcMain.handle("dashboard:refresh", async () => refreshDashboardAndBroadcast("manual"));
  ipcMain.handle("notifications:get", async () =>
    dashboardNotificationService?.getNotifications() ?? []
  );
  ipcMain.handle("notifications:mark-read", async (_event, keys?: string[]) => {
    const notifications =
      (await dashboardNotificationService?.markNotificationsRead(keys)) ?? [];
    await broadcastDashboardNotifications();
    return notifications;
  });
  ipcMain.handle("preferences:get", async () => dashboardService.getPreferences());
  ipcMain.handle(
    "preferences:update",
    async (_event, patch: Partial<AppPreferences>) => {
      const next = await dashboardService.updatePreferences(patch);
      currentPreferences = next;
      await broadcastPreferences(next);
      return next;
    }
  );
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
  ipcMain.handle("app:select-directory", async () => {
    const options = {
      title: "选择 Git 仓库根目录",
      properties: ["openDirectory", "createDirectory"]
    } satisfies Electron.OpenDialogOptions;
    const result = (mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)) as
      | string[]
      | { canceled: boolean; filePaths: string[] };

    if (Array.isArray(result)) {
      return result[0] ?? null;
    }

    return result.canceled ? null : result.filePaths[0] ?? null;
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
  const userDataPath = app.getPath("userData");
  const settingsStore = new SettingsStore(userDataPath);
  const snapshotStore = new SnapshotStore(userDataPath);
  const codexSessionCacheStore = new CodexSessionCacheStore(userDataPath);
  dashboardService = new DashboardService(
    settingsStore,
    snapshotStore,
    codexSessionCacheStore
  );
  dashboardNotificationService = new DashboardNotificationService(userDataPath);
  currentPreferences = await dashboardService.getPreferences();

  createMainWindow();
  if (!WIDGET_DISABLED) {
    createWidgetWindow(currentPreferences);
  }

  tray = new Tray(createTrayIcon());
  tray.on("double-click", () => {
    void openPage("overview");
  });

  registerIpcHandlers();
  await applyWidgetPreferences(currentPreferences);
  void broadcastDashboardNotifications();
  void loadSnapshot(false);
  scheduleStartupBackgroundRefresh();
  startDashboardAutoRefresh();

  if (isDevelopment()) {
    mainWindow?.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("before-quit", () => {
  isQuitting = true;
  stopDashboardAutoRefresh();
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  void bootstrap();
});

import { app } from "electron";
import { autoUpdater } from "electron-updater";
import type { ProgressInfo } from "builder-util-runtime";
import os from "node:os";
import path from "node:path";

import type {
  UpdatePreferences,
  UpdateState
} from "../shared/contracts";
import {
  downloadSizeFromInfo,
  normalizeUpdateError,
  RELEASES_URL,
  releaseUrlForVersion,
  sanitizeReleaseNotes
} from "./updateUtils";
import {
  resolveUpdateCapabilities,
  shouldAutomaticallyDownloadUpdate
} from "./updatePolicy";
import {
  consumeInstallHandoff,
  launchWindowsInstallHelper
} from "./windowsUpdateInstaller";

const STARTUP_CHECK_DELAY_MS = 15_000;
const PERIODIC_CHECK_INTERVAL_MS = 6 * 60 * 60_000;

// 临时允许未签名的 Windows NSIS 安装版在应用内下载并由用户明确确认安装。
// 可信 publisher 接入前禁止退出时静默安装；签名接入时必须同时配置
// electron-builder 的 win.publisherName，并关闭此临时开关。
const ALLOW_UNSIGNED_UPDATE_INSTALL = true;
const TRUSTED_WINDOWS_PUBLISHER: string | null = null;

function updaterCacheDirectory(): string {
  const baseCachePath =
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return path.join(baseCachePath, "codex-companion-updater");
}

interface UpdateServiceOptions {
  preferences: UpdatePreferences;
  onStateChanged: (state: UpdateState) => void;
}

function cloneState(state: UpdateState): UpdateState {
  return {
    ...state,
    progress: state.progress ? { ...state.progress } : null
  };
}

export class UpdateService {
  private preferences: UpdatePreferences;
  private state: UpdateState;
  private startupTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private checkTask: Promise<UpdateState> | null = null;
  private downloadTask: Promise<UpdateState> | null = null;
  private downloadedInstallerPath: string | null = null;
  private started = false;

  private readonly supported =
    app.isPackaged &&
    process.platform === "win32" &&
    !process.env.PORTABLE_EXECUTABLE_DIR;

  private readonly capabilities = resolveUpdateCapabilities({
    supported: this.supported,
    trustedPublisherConfigured: Boolean(TRUSTED_WINDOWS_PUBLISHER),
    allowUnsignedInstall: ALLOW_UNSIGNED_UPDATE_INSTALL
  });

  public constructor(private readonly options: UpdateServiceOptions) {
    this.preferences = options.preferences;
    this.state = {
      phase: this.supported ? "idle" : "unsupported",
      currentVersion: app.getVersion(),
      availableVersion: null,
      releaseDate: null,
      releaseNotes: null,
      releaseUrl: RELEASES_URL,
      downloadSize: null,
      progress: null,
      lastCheckedAt: null,
      errorCode: null,
      errorMessage: this.supported
        ? null
        : "开发模式、便携版或当前平台不支持自动升级，请从 Releases 手动下载安装。",
      canCheck: this.supported,
      canAutoInstall: this.capabilities.canAutoInstall,
      canInstallOnQuit: this.capabilities.canInstallOnQuit,
      trustMode: this.capabilities.trustMode
    };
  }

  public start() {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.supported) {
      this.emitState();
      return;
    }

    autoUpdater.logger = null;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit =
      this.capabilities.canInstallOnQuit && this.preferences.installOnQuit;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.fullChangelog = false;
    autoUpdater.disableWebInstaller = true;

    autoUpdater.on("checking-for-update", () => {
      this.patchState({
        phase: "checking",
        errorCode: null,
        errorMessage: null,
        progress: null
      });
    });
    autoUpdater.on("update-not-available", () => {
      this.downloadedInstallerPath = null;
      this.patchState({
        phase: "up-to-date",
        availableVersion: null,
        releaseDate: null,
        releaseNotes: null,
        releaseUrl: RELEASES_URL,
        downloadSize: null,
        progress: null,
        lastCheckedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null
      });
    });
    autoUpdater.on("update-available", (info) => {
      this.downloadedInstallerPath = null;
      this.patchState({
        phase: "available",
        availableVersion: info.version,
        releaseDate: info.releaseDate || null,
        releaseNotes: sanitizeReleaseNotes(info.releaseNotes),
        releaseUrl: releaseUrlForVersion(info.version),
        downloadSize: downloadSizeFromInfo(info),
        progress: null,
        lastCheckedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null
      });

      if (
        shouldAutomaticallyDownloadUpdate({
          canAutoInstall: this.capabilities.canAutoInstall,
          autoDownload: this.preferences.autoDownload,
          ignoredVersion: this.preferences.ignoredVersion,
          availableVersion: info.version
        })
      ) {
        void this.downloadUpdate();
      }
    });
    autoUpdater.on("download-progress", (progress) => {
      this.handleDownloadProgress(progress);
    });
    autoUpdater.on("update-downloaded", (event) => {
      this.downloadedInstallerPath = event.downloadedFile;
      this.patchState({
        phase: "downloaded",
        availableVersion: event.version,
        releaseDate: event.releaseDate || this.state.releaseDate,
        releaseNotes: sanitizeReleaseNotes(event.releaseNotes) ?? this.state.releaseNotes,
        releaseUrl: releaseUrlForVersion(event.version),
        downloadSize: downloadSizeFromInfo(event) ?? this.state.downloadSize,
        progress: this.state.progress
          ? { ...this.state.progress, percent: 100 }
          : null,
        errorCode: null,
        errorMessage: null
      });
    });
    autoUpdater.on("error", (error) => {
      this.patchState({
        phase: "error",
        progress: null,
        lastCheckedAt: new Date().toISOString(),
        ...normalizeUpdateError(error)
      });
    });

    this.refreshSchedule(true);
    this.emitState();
    void this.reconcileInstallHandoff();
  }

  public stop() {
    this.clearSchedule();
  }

  public getState(): UpdateState {
    return cloneState(this.state);
  }

  public getReleaseUrl(): string {
    return this.state.releaseUrl.startsWith(RELEASES_URL)
      ? this.state.releaseUrl
      : RELEASES_URL;
  }

  public setPreferences(preferences: UpdatePreferences) {
    const autoCheckChanged = this.preferences.autoCheck !== preferences.autoCheck;
    const autoDownloadEnabled =
      !this.preferences.autoDownload && preferences.autoDownload;
    const shouldStartDownload =
      autoDownloadEnabled &&
      this.state.phase === "available" &&
      shouldAutomaticallyDownloadUpdate({
        canAutoInstall: this.capabilities.canAutoInstall,
        autoDownload: preferences.autoDownload,
        ignoredVersion: preferences.ignoredVersion,
        availableVersion: this.state.availableVersion
      });
    this.preferences = preferences;
    autoUpdater.autoInstallOnAppQuit =
      this.capabilities.canInstallOnQuit && preferences.installOnQuit;
    if (autoCheckChanged) {
      this.refreshSchedule(preferences.autoCheck);
    }
    this.emitState();
    if (shouldStartDownload) {
      void this.downloadUpdate();
    }
  }

  public checkForUpdates(): Promise<UpdateState> {
    if (!this.supported) {
      return Promise.resolve(this.getState());
    }
    if (this.checkTask) {
      return this.checkTask;
    }

    this.checkTask = autoUpdater
      .checkForUpdates()
      .then(() => this.getState())
      .catch((error: unknown) => {
        this.patchState({
          phase: "error",
          progress: null,
          lastCheckedAt: new Date().toISOString(),
          ...normalizeUpdateError(error)
        });
        return this.getState();
      })
      .finally(() => {
        this.checkTask = null;
      });
    return this.checkTask;
  }

  public downloadUpdate(): Promise<UpdateState> {
    if (!this.capabilities.canAutoInstall || this.state.phase !== "available") {
      return Promise.resolve(this.getState());
    }
    if (this.downloadTask) {
      return this.downloadTask;
    }

    this.patchState({
      phase: "downloading",
      progress: {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: this.state.downloadSize ?? 0
      },
      errorCode: null,
      errorMessage: null
    });

    this.downloadTask = autoUpdater
      .downloadUpdate()
      .then(() => this.getState())
      .catch((error: unknown) => {
        this.patchState({
          phase: "error",
          progress: null,
          ...normalizeUpdateError(error)
        });
        return this.getState();
      })
      .finally(() => {
        this.downloadTask = null;
      });
    return this.downloadTask;
  }

  public async quitAndInstall(): Promise<boolean> {
    if (
      !this.capabilities.canAutoInstall ||
      this.state.phase !== "downloaded" ||
      !this.state.availableVersion ||
      !this.downloadedInstallerPath
    ) {
      return false;
    }

    try {
      this.patchState({ phase: "installing", errorCode: null, errorMessage: null });
      this.clearSchedule();
      await launchWindowsInstallHelper({
        installerPath: this.downloadedInstallerPath,
        expectedVersion: this.state.availableVersion,
        updaterCacheDirectory: updaterCacheDirectory(),
        helperDirectory: path.join(app.getPath("userData"), "updates", "install-helper"),
        parentPid: process.pid
      });
      app.quit();
      return true;
    } catch (error) {
      this.patchState({
        phase: "error",
        progress: null,
        ...normalizeUpdateError(error)
      });
      return false;
    }
  }

  private async reconcileInstallHandoff() {
    const handoff = await consumeInstallHandoff(
      path.join(app.getPath("userData"), "updates", "install-helper")
    );
    if (
      handoff &&
      ["parent_timeout", "launch_failed", "install_failed"].includes(handoff.stage)
    ) {
      this.patchState({
        phase: "error",
        progress: null,
        errorCode: "install-helper-failed",
        errorMessage: "上次自动安装未完成，请重试或从 Releases 手动安装。"
      });
    }
  }

  private handleDownloadProgress(progress: ProgressInfo) {
    this.patchState({
      phase: "downloading",
      progress: {
        percent: Math.max(0, Math.min(100, progress.percent)),
        bytesPerSecond: Math.max(0, progress.bytesPerSecond),
        transferred: Math.max(0, progress.transferred),
        total: Math.max(0, progress.total)
      },
      errorCode: null,
      errorMessage: null
    });
  }

  private patchState(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch };
    this.emitState();
  }

  private emitState() {
    this.options.onStateChanged(this.getState());
  }

  private refreshSchedule(runStartupCheck: boolean) {
    this.clearSchedule();
    if (!this.started || !this.supported || !this.preferences.autoCheck) {
      return;
    }

    if (runStartupCheck) {
      this.startupTimer = setTimeout(() => {
        this.startupTimer = null;
        void this.checkForUpdates();
      }, STARTUP_CHECK_DELAY_MS);
    }

    this.periodicTimer = setInterval(() => {
      void this.checkForUpdates();
    }, PERIODIC_CHECK_INTERVAL_MS);
  }

  private clearSchedule() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }
}

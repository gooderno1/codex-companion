import type { StartupState } from "../shared/contracts";

export interface LaunchAtLoginApp {
  readonly isPackaged: boolean;
  getLoginItemSettings(): { openAtLogin: boolean };
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
}

export function isLaunchAtLoginSupported(
  electronApp: LaunchAtLoginApp,
  platform = process.platform
): boolean {
  return platform === "win32" && electronApp.isPackaged;
}

export function readLaunchAtLoginState(
  electronApp: LaunchAtLoginApp,
  platform = process.platform
): StartupState {
  if (!isLaunchAtLoginSupported(electronApp, platform)) {
    return {
      supported: false,
      enabled: false,
      message:
        platform === "win32"
          ? "开发模式不会注册开机启动项；请在 Windows 安装版中配置。"
          : "当前版本仅支持 Windows 安装版的开机自启。"
    };
  }

  const enabled = electronApp.getLoginItemSettings().openAtLogin;
  return {
    supported: true,
    enabled,
    message: enabled
      ? "已注册到 Windows 登录启动项。"
      : "未注册到 Windows 登录启动项。"
  };
}

export function applyLaunchAtLoginPreference(
  electronApp: LaunchAtLoginApp,
  enabled: boolean,
  platform = process.platform
): StartupState {
  if (!isLaunchAtLoginSupported(electronApp, platform)) {
    throw new Error(
      platform === "win32"
        ? "开发模式不支持配置开机自启，请使用 Windows 安装版。"
        : "当前版本仅支持 Windows 安装版的开机自启。"
    );
  }

  electronApp.setLoginItemSettings({ openAtLogin: enabled });
  const state = readLaunchAtLoginState(electronApp, platform);
  if (state.enabled !== enabled) {
    throw new Error("Windows 登录启动项状态未按预期更新，请检查系统权限后重试。");
  }
  return state;
}

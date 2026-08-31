import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyLaunchAtLoginPreference,
  isLaunchAtLoginSupported,
  readLaunchAtLoginState
} = require("../dist-electron/main/launchAtLogin.js");
const { SettingsStore } = require("../dist-electron/main/state/settingsStore.js");

function createMockApp({ isPackaged, openAtLogin = false }) {
  let enabled = openAtLogin;
  return {
    isPackaged,
    getLoginItemSettings: () => ({ openAtLogin: enabled }),
    setLoginItemSettings: (settings) => {
      enabled = settings.openAtLogin;
    }
  };
}

const packagedApp = createMockApp({ isPackaged: true });
assert.equal(isLaunchAtLoginSupported(packagedApp, "win32"), true);
assert.equal(readLaunchAtLoginState(packagedApp, "win32").enabled, false);
assert.equal(
  applyLaunchAtLoginPreference(packagedApp, true, "win32").enabled,
  true
);
assert.equal(
  applyLaunchAtLoginPreference(packagedApp, false, "win32").enabled,
  false
);

const developmentApp = createMockApp({ isPackaged: false });
assert.equal(isLaunchAtLoginSupported(developmentApp, "win32"), false);
assert.throws(
  () => applyLaunchAtLoginPreference(developmentApp, true, "win32"),
  /开发模式不支持配置开机自启/
);
assert.equal(isLaunchAtLoginSupported(packagedApp, "darwin"), false);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-companion-startup-"));
try {
  const store = new SettingsStore(temporaryDirectory);
  assert.equal((await store.read()).startup.launchAtLogin, false);
  assert.equal(
    (
      await store.update((current) => ({
        ...current,
        startup: { launchAtLogin: true }
      }))
    ).startup.launchAtLogin,
    true
  );

  const oldSettings = {
    codexHome: path.join(temporaryDirectory, ".codex"),
    repoRoots: [temporaryDirectory],
    billingMonthStartDay: 1,
    widget: {
      preset: "signal-bar",
      locked: false,
      clickThrough: false,
      opacity: 0.94,
      privacyMode: false,
      visible: false,
      bounds: null
    },
    notifications: { deliveryMode: "balanced" },
    updates: {
      autoCheck: true,
      autoDownload: true,
      ignoredVersion: null,
      installOnQuit: false
    }
  };
  await writeFile(
    path.join(temporaryDirectory, "settings.json"),
    `${JSON.stringify(oldSettings, null, 2)}\n`,
    "utf8"
  );
  const migrated = await store.read();
  assert.equal(migrated.startup.launchAtLogin, false);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const mainSource = await readFile(new URL("../src/main/index.ts", import.meta.url), "utf8");
const rendererSource = await readFile(
  new URL("../src/renderer/App.tsx", import.meta.url),
  "utf8"
);
assert.match(mainSource, /startup:set-preferences/);
assert.match(mainSource, /syncLaunchAtLoginPreference/);
assert.match(rendererSource, /<strong>\{startupBusy \? "正在更新" : "开机自启"\}<\/strong>/);

console.log("开机自启专项校验通过：默认关闭、旧配置迁移、安装版注册与开发模式门禁均符合预期。");

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  downloadSizeFromInfo,
  normalizeUpdateError,
  RELEASES_URL,
  releaseUrlForVersion,
  sanitizeReleaseNotes
} = require("../dist-electron/main/updateUtils.js");
const { SettingsStore } = require("../dist-electron/main/state/settingsStore.js");
const { resolveUpdateCapabilities } = require("../dist-electron/main/updatePolicy.js");
const {
  buildWindowsInstallHelperScript,
  expectedInstallerFileName,
  validateDownloadedInstaller
} = require("../dist-electron/main/windowsUpdateInstaller.js");

assert.deepEqual(
  resolveUpdateCapabilities({
    supported: true,
    trustedPublisherConfigured: false,
    allowUnsignedInstall: true
  }),
  {
    canAutoInstall: true,
    canInstallOnQuit: false,
    trustMode: "unsigned-temporary"
  }
);
assert.deepEqual(
  resolveUpdateCapabilities({
    supported: true,
    trustedPublisherConfigured: true,
    allowUnsignedInstall: false
  }),
  {
    canAutoInstall: true,
    canInstallOnQuit: true,
    trustMode: "trusted-publisher"
  }
);
assert.deepEqual(
  resolveUpdateCapabilities({
    supported: false,
    trustedPublisherConfigured: false,
    allowUnsignedInstall: true
  }),
  {
    canAutoInstall: false,
    canInstallOnQuit: false,
    trustMode: "unsupported"
  }
);

assert.equal(
  sanitizeReleaseNotes("<p>安全更新<br>修复 &amp; 优化</p>"),
  "安全更新\n修复 & 优化"
);
assert.equal(sanitizeReleaseNotes(null), null);
assert.ok(!sanitizeReleaseNotes("<script>alert(1)</script>说明").includes("<script>"));
assert.equal(
  releaseUrlForVersion("0.4.1"),
  `${RELEASES_URL}/tag/v0.4.1`
);
assert.equal(releaseUrlForVersion("../../bad"), RELEASES_URL);
assert.equal(
  downloadSizeFromInfo({ files: [{ size: 12 }, { size: 30 }] }),
  42
);
assert.equal(
  normalizeUpdateError(new Error("C:\\Users\\someone\\latest.yml returned 404")).errorCode,
  "metadata-missing"
);
assert.ok(
  !normalizeUpdateError(new Error("token=secret C:\\Users\\someone")).errorMessage.includes("secret")
);
assert.equal(
  expectedInstallerFileName("0.4.2"),
  "Codex.Companion.Setup.0.4.2.exe"
);
assert.throws(() => expectedInstallerFileName("../../bad"));

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-companion-updater-"));
try {
  process.env.CODEX_HOME = path.join(tempRoot, ".codex");
  const store = new SettingsStore(tempRoot);
  const defaults = await store.read();
  assert.deepEqual(defaults.updates, {
    autoCheck: true,
    autoDownload: true,
    ignoredVersion: null,
    installOnQuit: false
  });

  await writeFile(
    path.join(tempRoot, "settings.json"),
    JSON.stringify({
      ...defaults,
      updates: {
        autoCheck: "invalid",
        autoDownload: false,
        ignoredVersion: " 0.4.1 ",
        installOnQuit: true
      }
    })
  );
  const normalized = await store.read();
  assert.deepEqual(normalized.updates, {
    autoCheck: true,
    autoDownload: false,
    ignoredVersion: "0.4.1",
    installOnQuit: true
  });

  const updaterCache = path.join(tempRoot, "codex-companion-updater");
  const pendingDirectory = path.join(updaterCache, "pending");
  const installerPath = path.join(
    pendingDirectory,
    "Codex.Companion.Setup.0.4.2.exe"
  );
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(pendingDirectory, { recursive: true })
  );
  await writeFile(installerPath, "fixture");
  assert.equal(
    await validateDownloadedInstaller({
      installerPath,
      expectedVersion: "0.4.2",
      updaterCacheDirectory: updaterCache
    }),
    installerPath
  );
  await assert.rejects(
    validateDownloadedInstaller({
      installerPath,
      expectedVersion: "0.4.3",
      updaterCacheDirectory: updaterCache
    })
  );

  const helperScript = buildWindowsInstallHelperScript({
    installerPath,
    handoffPath: path.join(tempRoot, "handoff.json"),
    logPath: path.join(tempRoot, "helper.log"),
    parentPid: 1234,
    requestId: "fixture",
    taskName: "CodexCompanionUpdate-fixture",
    taskSchedulerPath: "C:\\Windows\\System32\\schtasks.exe"
  });
  assert.match(helperScript, /Get-Process -Id \$parentPid/);
  assert.match(helperScript, /'--updated', '\/S', '--force-run'/);
  assert.match(helperScript, /install_succeeded/);
  assert.match(helperScript, /\/Delete \/TN \$taskName \/F/);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("自动升级状态、外部安装 helper、错误脱敏、Release URL 与设置迁移校验通过。");

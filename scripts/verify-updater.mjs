import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
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
  buildWindowsHiddenLauncherScript,
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
    await realpath(installerPath)
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

  const hiddenLauncher = buildWindowsHiddenLauncherScript({
    powerShellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    scriptPath: "C:\\Users\\fixture\\install-helper.ps1"
  });
  assert.match(hiddenLauncher, /WScript\.Shell/);
  assert.match(hiddenLauncher, /shell\.Run\(command, 0, True\)/);
  assert.match(hiddenLauncher, /-WindowStyle Hidden/);

  if (process.platform === "win32") {
    const hiddenScriptPath = path.join(tempRoot, "hidden-helper-smoke.ps1");
    const hiddenLauncherPath = path.join(tempRoot, "hidden-helper-smoke.vbs");
    const hiddenMarkerPath = path.join(tempRoot, "hidden-helper-smoke.json");
    const markerLiteral = hiddenMarkerPath.replaceAll("'", "''");
    await writeFile(
      hiddenScriptPath,
      `\uFEFF$process = Get-Process -Id $PID\r\n` +
        `$payload = @{ pid = $PID; mainWindowHandle = [int64]$process.MainWindowHandle } | ConvertTo-Json -Compress\r\n` +
        `$utf8NoBom = [System.Text.UTF8Encoding]::new($false)\r\n` +
        `[System.IO.File]::WriteAllText('${markerLiteral}', $payload, $utf8NoBom)\r\n`,
      "utf8"
    );
    await writeFile(
      hiddenLauncherPath,
      `\uFEFF${buildWindowsHiddenLauncherScript({
        powerShellPath: path.join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe"
        ),
        scriptPath: hiddenScriptPath
      })}`,
      "utf16le"
    );
    await execFileAsync(
      path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "wscript.exe"),
      ["//B", "//NoLogo", hiddenLauncherPath],
      { windowsHide: true, timeout: 10_000 }
    );
    const hiddenMarker = JSON.parse(await readFile(hiddenMarkerPath, "utf8"));
    assert.equal(hiddenMarker.mainWindowHandle, 0);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("自动升级状态、外部安装 helper、错误脱敏、Release URL 与设置迁移校验通过。");

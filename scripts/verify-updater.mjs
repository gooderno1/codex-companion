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
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("自动升级状态、错误脱敏、Release URL 与设置迁移校验通过。");

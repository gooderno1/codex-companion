#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CAPTURE_DELAY_MS = "6000";
const VIEWPORTS = [
  { width: 1360, height: 900 },
  { width: 1080, height: 720 }
];

async function readPackageVersion() {
  const packageContent = await readFile(path.join(ROOT, "package.json"), "utf8");
  const packageJson = JSON.parse(packageContent);
  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new Error("package.json 缺少 version 字段。");
  }

  return packageJson.version;
}

function screenshotSuffixFromVersion(version) {
  const match = version.match(/-dev\.(\d+)$/);
  if (!match) {
    throw new Error(`当前版本 ${version} 不是开发迭代版本，无法推导截图后缀。`);
  }

  return `dev${match[1]}`;
}

function electronCliPath() {
  return path.join(ROOT, "node_modules", "electron", "cli.js");
}

async function main() {
  const version = await readPackageVersion();
  const suffix = screenshotSuffixFromVersion(version);
  const outputDir = path.join(ROOT, "local_dev_work");
  await mkdir(outputDir, { recursive: true });

  const electronCli = electronCliPath();
  for (const viewport of VIEWPORTS) {
    const outputPath = path.join(
      outputDir,
      `overview-${viewport.width}x${viewport.height}-${suffix}.png`
    );

    const result = spawnSync(process.execPath, [electronCli, "."], {
      cwd: ROOT,
      env: {
        ...process.env,
        CODEX_COMPANION_CAPTURE_PATH: outputPath,
        CODEX_COMPANION_CAPTURE_DELAY_MS: CAPTURE_DELAY_MS,
        CODEX_COMPANION_WINDOW_WIDTH: String(viewport.width),
        CODEX_COMPANION_WINDOW_HEIGHT: String(viewport.height)
      },
      encoding: "utf8",
      stdio: "inherit"
    });

    if (result.status !== 0) {
      throw new Error(
        `生成 ${viewport.width}x${viewport.height} 截图失败，退出码：${String(result.status)}。`
      );
    }

    console.log(`已生成 ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(`总览页截图生成失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

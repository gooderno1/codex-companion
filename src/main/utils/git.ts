import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { GitIntegrationStatus } from "../../shared/contracts";

const execFileAsync = promisify(execFile);

export async function runGit(
  args: string[],
  cwd: string
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    });

    return stdout.trim();
  } catch {
    return null;
  }
}

export async function findGitRoot(startPath: string): Promise<string | null> {
  let current = path.resolve(startPath);

  while (true) {
    try {
      await access(path.join(current, ".git"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

async function runGitConfig(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: os.homedir(),
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function readGitIntegrationStatus(): Promise<GitIntegrationStatus> {
  const checkedAt = new Date().toISOString();
  const version = await runGitConfig(["--version"]);

  if (!version) {
    return {
      available: false,
      version: null,
      userName: null,
      userEmail: null,
      checkedAt,
      cloudAuth: "not-required",
      message: "未检测到可执行的 git 命令；代码仓库页只能等待本机 Git 可用后再扫描。"
    };
  }

  const [userName, userEmail] = await Promise.all([
    runGitConfig(["config", "--global", "user.name"]),
    runGitConfig(["config", "--global", "user.email"])
  ]);

  return {
    available: true,
    version,
    userName,
    userEmail,
    checkedAt,
    cloudAuth: "not-required",
    message:
      userName && userEmail
        ? "已检测到本机 Git 身份；当前版本只读取本地仓库，不检测 GitHub 登录，也不需要 GitHub token。"
        : "已检测到 git 命令，但全局 user.name 或 user.email 未配置；本地扫描仍可运行，提交身份建议在 Git 中补齐。"
  };
}

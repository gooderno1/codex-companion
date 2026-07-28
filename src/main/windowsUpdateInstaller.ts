import { spawn } from "node:child_process";
import { access, mkdir, readFile, realpath, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type InstallHandoffStage =
  | "helper_started"
  | "parent_timeout"
  | "installer_started"
  | "launch_failed"
  | "install_succeeded"
  | "install_failed";

interface InstallHandoff {
  requestId: string;
  stage: InstallHandoffStage;
  exitCode: number | null;
  timestamp: string;
}

export interface WindowsInstallHelperOptions {
  installerPath: string;
  expectedVersion: string;
  updaterCacheDirectory: string;
  helperDirectory: string;
  parentPid: number;
}

const HANDOFF_FILE_NAME = "install-handoff.json";
const LOG_FILE_NAME = "install-helper.log";
const SCRIPT_FILE_NAME = "install-helper.ps1";
const HELPER_START_TIMEOUT_MS = 5_000;

function escapePowerShellLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function expectedInstallerFileName(version: string): string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("更新版本号格式不受支持");
  }
  return `Codex.Companion.Setup.${version}.exe`;
}

export async function validateDownloadedInstaller({
  installerPath,
  expectedVersion,
  updaterCacheDirectory
}: Pick<
  WindowsInstallHelperOptions,
  "installerPath" | "expectedVersion" | "updaterCacheDirectory"
>): Promise<string> {
  const expectedName = expectedInstallerFileName(expectedVersion);
  const [resolvedInstaller, resolvedCache] = await Promise.all([
    realpath(installerPath),
    realpath(updaterCacheDirectory)
  ]);
  const installerStat = await stat(resolvedInstaller);

  if (!installerStat.isFile()) {
    throw new Error("下载的更新安装包不是普通文件");
  }
  if (!isPathInside(resolvedCache, resolvedInstaller)) {
    throw new Error("下载的更新安装包不在受控缓存目录");
  }
  if (path.basename(resolvedInstaller).toLowerCase() !== expectedName.toLowerCase()) {
    throw new Error("下载的更新安装包名称与目标版本不一致");
  }

  return resolvedInstaller;
}

export function buildWindowsInstallHelperScript({
  installerPath,
  handoffPath,
  logPath,
  parentPid,
  requestId,
  taskName,
  taskSchedulerPath
}: {
  installerPath: string;
  handoffPath: string;
  logPath: string;
  parentPid: number;
  requestId: string;
  taskName: string;
  taskSchedulerPath: string;
}): string {
  const installer = escapePowerShellLiteral(installerPath);
  const handoff = escapePowerShellLiteral(handoffPath);
  const log = escapePowerShellLiteral(logPath);
  const request = escapePowerShellLiteral(requestId);
  const scheduledTask = escapePowerShellLiteral(taskName);
  const taskScheduler = escapePowerShellLiteral(taskSchedulerPath);

  return [
    "$ErrorActionPreference = 'Stop'",
    `$installerPath = '${installer}'`,
    `$handoffPath = '${handoff}'`,
    `$logPath = '${log}'`,
    `$requestId = '${request}'`,
    `$taskName = '${scheduledTask}'`,
    `$taskSchedulerPath = '${taskScheduler}'`,
    `$parentPid = ${parentPid}`,
    "function Write-InstallLog([string]$message) {",
    "  try {",
    "    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'",
    "    Add-Content -LiteralPath $logPath -Value \"[$timestamp] $message\" -Encoding UTF8",
    "  } catch {}",
    "}",
    "function Write-Handoff([string]$stage, [Nullable[int]]$exitCode = $null) {",
    "  try {",
    "    $payload = @{ requestId = $requestId; stage = $stage; exitCode = $exitCode; timestamp = [DateTimeOffset]::UtcNow.ToString('o') } | ConvertTo-Json -Compress",
    "    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)",
    "    [System.IO.File]::WriteAllText($handoffPath, $payload, $utf8NoBom)",
    "  } catch {}",
    "}",
    "function Remove-InstallTask() {",
    "  try { & $taskSchedulerPath /Delete /TN $taskName /F | Out-Null } catch {}",
    "}",
    "Write-Handoff 'helper_started'",
    "Write-InstallLog \"helper started; parent_pid=$parentPid\"",
    "$deadline = [DateTime]::UtcNow.AddMinutes(2)",
    "while ((Get-Process -Id $parentPid -ErrorAction SilentlyContinue) -and ([DateTime]::UtcNow -lt $deadline)) {",
    "  Start-Sleep -Milliseconds 250",
    "}",
    "if (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) {",
    "  Write-Handoff 'parent_timeout' 1",
    "  Write-InstallLog 'old application did not exit before timeout'",
    "  Remove-InstallTask",
    "  exit 1",
    "}",
    "Start-Sleep -Milliseconds 750",
    "try {",
    "  $arguments = @('--updated', '/S', '--force-run')",
    "  $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -PassThru -ErrorAction Stop",
    "  Write-Handoff 'installer_started'",
    "  $process.WaitForExit()",
    "  $process.Refresh()",
    "  $exitCode = $process.ExitCode",
    "  if ($exitCode -eq 0) {",
    "    Write-Handoff 'install_succeeded' 0",
    "    Write-InstallLog 'installer completed successfully'",
    "    Remove-InstallTask",
    "    exit 0",
    "  }",
    "  Write-Handoff 'install_failed' $exitCode",
    "  Write-InstallLog \"installer exited with code=$exitCode\"",
    "  Remove-InstallTask",
    "  exit 1",
    "} catch {",
    "  Write-Handoff 'launch_failed' 1",
    "  Write-InstallLog 'installer launch failed'",
    "  Remove-InstallTask",
    "  exit 1",
    "}"
  ].join("\r\n");
}

async function waitForHelperStart(
  handoffPath: string,
  requestId: string
): Promise<void> {
  const deadline = Date.now() + HELPER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const handoff = JSON.parse(await readFile(handoffPath, "utf8")) as Partial<InstallHandoff>;
      if (handoff.requestId === requestId && typeof handoff.stage === "string") {
        return;
      }
    } catch {
      // PowerShell 进程可能已经启动，但还没有完成首个原子状态写入。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("更新安装 helper 启动超时");
}

async function runTaskScheduler(
  taskSchedulerPath: string,
  args: string[]
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(taskSchedulerPath, args, {
      windowsHide: true,
      stdio: "ignore"
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error("Windows 更新任务调度失败"));
    });
  });
}

export async function launchWindowsInstallHelper(
  options: WindowsInstallHelperOptions
): Promise<{ requestId: string; handoffPath: string }> {
  const installerPath = await validateDownloadedInstaller(options);
  await mkdir(options.helperDirectory, { recursive: true });

  const requestId = `${Date.now()}-${process.pid}`;
  const taskName = `CodexCompanionUpdate-${requestId}`;
  const scriptPath = path.join(options.helperDirectory, SCRIPT_FILE_NAME);
  const handoffPath = path.join(options.helperDirectory, HANDOFF_FILE_NAME);
  const logPath = path.join(options.helperDirectory, LOG_FILE_NAME);
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const powerShellPath = path.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  const taskSchedulerPath = path.join(systemRoot, "System32", "schtasks.exe");
  const script = buildWindowsInstallHelperScript({
    installerPath,
    handoffPath,
    logPath,
    parentPid: options.parentPid,
    requestId,
    taskName,
    taskSchedulerPath
  });

  await unlink(handoffPath).catch(() => undefined);
  await writeFile(scriptPath, `\uFEFF${script}`, "utf8");
  await Promise.all([access(powerShellPath), access(taskSchedulerPath)]);

  const taskCommand =
    `"${powerShellPath}" -NoProfile -NonInteractive -ExecutionPolicy Bypass ` +
    `-WindowStyle Hidden -File "${scriptPath}"`;
  if (taskCommand.length > 261) {
    throw new Error("更新 helper 路径过长，无法注册 Windows 安装任务");
  }

  try {
    await runTaskScheduler(taskSchedulerPath, [
      "/Create",
      "/TN",
      taskName,
      "/TR",
      taskCommand,
      "/SC",
      "ONCE",
      "/ST",
      "23:59",
      "/RL",
      "LIMITED",
      "/F"
    ]);
    await runTaskScheduler(taskSchedulerPath, ["/Run", "/TN", taskName]);
    await waitForHelperStart(handoffPath, requestId);
  } catch (error) {
    await runTaskScheduler(taskSchedulerPath, ["/Delete", "/TN", taskName, "/F"]).catch(
      () => undefined
    );
    throw error;
  }

  return { requestId, handoffPath };
}

export async function consumeInstallHandoff(
  helperDirectory: string
): Promise<InstallHandoff | null> {
  const handoffPath = path.join(helperDirectory, HANDOFF_FILE_NAME);
  try {
    const parsed = JSON.parse(await readFile(handoffPath, "utf8")) as Partial<InstallHandoff>;
    await unlink(handoffPath).catch(() => undefined);
    if (
      typeof parsed.requestId !== "string" ||
      typeof parsed.stage !== "string" ||
      typeof parsed.timestamp !== "string"
    ) {
      return null;
    }
    return {
      requestId: parsed.requestId,
      stage: parsed.stage as InstallHandoffStage,
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : null,
      timestamp: parsed.timestamp
    };
  } catch {
    return null;
  }
}

#!/usr/bin/env node
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const STATIC_REQUIRED_FILES = [
  "docs/assets/design/v0.3.3/overview-natural-time.png",
  "docs/ui-contract/overview-v0.1.md",
  "docs/component-map.md",
  "docs/design-review/overview-block-audit-v0.1.md",
  "docs/design-review/overview-visual-measurement-v0.1.md",
  "docs/design-tokens-v0.1.md",
  "docs/data-contract-v0.2.md",
  "docs/data-audit/overview-token-quota-audit-v0.1.md",
  "docs/goal-audit/overview-goal-completion-audit-v0.1.md",
  "src/main/index.ts",
  "src/main/preload.ts",
  "src/main/collectors/codexCollector.ts",
  "src/main/collectors/dashboardCollector.ts",
  "src/shared/contracts.ts",
  "src/renderer/App.tsx",
  "src/renderer/styles.css",
  "src/renderer/icons.tsx",
  "src/renderer/design-tokens.ts"
];

const STATIC_TEXT_ASSERTIONS = [
  {
    file: "docs/ui-contract/overview-v0.1.md",
    includes: ["左侧导航", "顶部工具栏", "顶部四卡", "中部两张额度卡", "项目概览", "页脚数据来源"]
  },
  {
    file: "docs/component-map.md",
    includes: ["BrandMark", "Glyph", "MetricCard", "QuotaWindowCard", "OverviewPage", "FooterNote"]
  },
  {
    file: "docs/design-review/overview-block-audit-v0.1.md",
    includes: ["左侧", "顶部", "额度", "项目概览"]
  },
  {
    file: "docs/design-review/overview-visual-measurement-v0.1.md",
    includes: ["项目概览默认周期复测"]
  },
  {
    file: "docs/goal-audit/overview-goal-completion-audit-v0.1.md",
    includes: ["npm run verify:design", "npm run verify:quota", "npm run verify:overview"]
  },
  {
    file: "docs/data-contract-v0.2.md",
    includes: [
      "total_token_usage",
      "rate_limits.primary",
      "rate_limits.secondary",
      "quotaEvidence",
      "estimatedValueBasisUsedPercent",
      "60"
    ]
  },
  {
    file: "docs/data-audit/overview-token-quota-audit-v0.1.md",
    includes: ["dev-ledger", "不输出原始会话正文", "rate_limits", "quotaEvidence.usedPercent"]
  },
  {
    file: "src/main/index.ts",
    includes: [
      "const WIDGET_DISABLED = true",
      "CODEX_COMPANION_CAPTURE_PATH",
      "CODEX_COMPANION_OVERVIEW_MODE",
      "DASHBOARD_REFRESH_INTERVAL_MS",
      '"dashboard:updated"',
      "broadcastDashboardSnapshot",
      "startDashboardAutoRefresh",
      "截图前数据采集未生成 live 快照"
    ]
  },
  {
    file: "src/main/preload.ts",
    includes: ["onDashboardUpdated", '"dashboard:updated"']
  },
  {
    file: "src/shared/contracts.ts",
    includes: ["onDashboardUpdated", "DashboardSnapshot"]
  },
  {
    file: "src/main/collectors/codexCollector.ts",
    includes: [
      "CODEX_HISTORY_LOOKBACK_DAYS",
      "diffTokenBreakdown",
      "total_token_usage",
      "last_token_usage",
      "payload.rate_limits",
      "window_minutes"
    ]
  },
  {
    file: "src/main/collectors/dashboardCollector.ts",
    includes: [
      "quotaEvidence",
      "buildDisplayedQuotaWindow",
      "estimatedValueBasisUsedPercent",
      "primaryPeriod.quotaEvidence?.usedPercent",
      "weeklyLimitPeriod.quotaEvidence?.usedPercent"
    ]
  },
  {
    file: "src/renderer/App.tsx",
    includes: [
      'from "./icons"',
      "function QuotaWindowCard",
      "function OverviewPage",
      "project-row-icon",
      "quota-models-head",
      "formatQuotaPeriodRange",
      "剩余量",
      "tok",
      "resolveOverviewModeFromHash",
      "onDashboardUpdated",
      "card.sourceStatus",
      'sourceStatus: billingMonth ? globalSourceStatus : "unobserved"'
    ]
  },
  {
    file: "src/renderer/styles.css",
    includes: [
      "grid-template-columns: minmax(300px, 1fr) auto minmax(300px, 1fr)",
      "position: absolute",
      "clamp(52px, 4.2vw, 64px)",
      "justify-self: center"
    ]
  },
  {
    file: "src/renderer/icons.tsx",
    includes: ["export function BrandMark", "export function Glyph", "export type IconName", "var(--accent-blue)"]
  }
];

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    return {
      ok: false,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    };
  }

  return {
    ok: true,
    output: result.stdout.trim()
  };
}

async function fileExists(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  await access(absolutePath);
  const fileStat = await stat(absolutePath);
  return fileStat.size;
}

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

async function main() {
  const errors = [];
  const checkedFiles = [];
  let version = "";
  let screenshotSuffix = "";

  try {
    version = await readPackageVersion();
    screenshotSuffix = screenshotSuffixFromVersion(version);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const requiredFiles = [
    ...STATIC_REQUIRED_FILES,
    `local_dev_work/overview-1360x900-${screenshotSuffix}.png`,
    `local_dev_work/overview-1080x720-${screenshotSuffix}.png`,
    `local_dev_work/overview-billing-1360x900-${screenshotSuffix}.png`,
    `local_dev_work/overview-billing-1080x720-${screenshotSuffix}.png`
  ];

  const textAssertions = [
    ...STATIC_TEXT_ASSERTIONS,
    {
      file: "docs/design-review/overview-block-audit-v0.1.md",
      includes: [version]
    },
    {
      file: "docs/design-review/overview-visual-measurement-v0.1.md",
      includes: [
        `overview-1360x900-${screenshotSuffix}.png`,
        `overview-1080x720-${screenshotSuffix}.png`,
        `overview-billing-1360x900-${screenshotSuffix}.png`,
        `overview-billing-1080x720-${screenshotSuffix}.png`
      ]
    },
    {
      file: "docs/goal-audit/overview-goal-completion-audit-v0.1.md",
      includes: [
        version,
        `overview-1360x900-${screenshotSuffix}.png`,
        `overview-1080x720-${screenshotSuffix}.png`,
        `overview-billing-1360x900-${screenshotSuffix}.png`,
        `overview-billing-1080x720-${screenshotSuffix}.png`
      ]
    }
  ];

  for (const file of requiredFiles) {
    try {
      const size = await fileExists(file);
      if (size <= 0) {
        errors.push(`${file} 为空。`);
      } else {
        checkedFiles.push(file);
      }
    } catch {
      errors.push(`${file} 缺失。`);
    }
  }

  for (const assertion of textAssertions) {
    try {
      const content = await readFile(path.join(ROOT, assertion.file), "utf8");
      for (const keyword of assertion.includes) {
        if (!content.includes(keyword)) {
          errors.push(`${assertion.file} 缺少关键内容：${keyword}`);
        }
      }
    } catch {
      errors.push(`${assertion.file} 无法读取。`);
    }
  }

  const designCheck = runNodeScript(path.join(ROOT, "scripts", "verify-design-tokens.mjs"));
  if (!designCheck.ok) {
    errors.push(`verify-design-tokens 失败：\n${designCheck.output}`);
  }

  const quotaCheck = runNodeScript(path.join(ROOT, "scripts", "verify-quota-snapshot.mjs"));
  if (!quotaCheck.ok) {
    errors.push(`verify-quota-snapshot 失败：\n${quotaCheck.output}`);
  }

  if (errors.length > 0) {
    console.error("总览页验收失败：");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`总览页验收通过：${checkedFiles.length} 个交付物存在且关键内容完整。`);
  console.log(`当前版本截图：${screenshotSuffix}。`);
  console.log(designCheck.output);
  console.log(quotaCheck.output);
}

main().catch((error) => {
  console.error(`总览页验收异常：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

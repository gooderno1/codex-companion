#!/usr/bin/env node
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

const REQUIRED_FILES = [
  "docs/assets/design/v0.3.15/ledger-page.png",
  "docs/ledger-page-design-plan-2026-06-04.md",
  "docs/ui-contract/ledger-v0.1.md",
  "docs/ui-contract/ledger-intensity-modules-v0.1.md",
  "src/shared/contracts.ts",
  "src/main/collectors/dashboardCollector.ts",
  "src/renderer/App.tsx",
  "src/renderer/styles.css"
];

const TEXT_ASSERTIONS = [
  {
    file: "docs/ui-contract/ledger-v0.1.md",
    includes: ["Token 走势拆解", "周期洞察", "模型贡献", "日 / 周 / 月", "多曲线走势", "近7天", "近30天", "累计"]
  },
  {
    file: "docs/ui-contract/ledger-intensity-modules-v0.1.md",
    includes: [
      "总 Token = 输入总量 + 输出",
      "输入总量 = 原始输入 + 缓存输入",
      "缓存输入占比",
      "推理 Token"
    ]
  },
  {
    file: "src/shared/contracts.ts",
    includes: ["LedgerTimeBucket", "LedgerAnalysisPeriod", "weeklyPeriods", "trend", "analysis"]
  },
  {
    file: "src/main/collectors/dashboardCollector.ts",
    includes: [
      "buildTimeBuckets",
      "buildLedgerAnalysisPeriod",
      "weeklyLedgerPeriods",
      "sevenNaturalDayStart",
      "thirtyDayStart",
      "cumulativeStart"
    ]
  },
  {
    file: "src/renderer/App.tsx",
    includes: [
      "Token 走势拆解",
      "周期洞察",
      "周额度账本",
      "模型贡献",
      "会话归因",
      "原始输入",
      "缓存输入",
      "推理 Token",
      "LEDGER_TREND_SERIES",
      "LEDGER_ANALYSIS_TABS",
      "ModelSortHeader",
      "trendBuckets(snapshot, period)",
      "visibleSeries",
      "selectedBucketKey",
      "visibleTrendSeries",
      "selectedTrendBucketKey",
      "isTrendDetailOpen",
      "smoothTrendPath",
      "TokenTrendExpandedView",
      "放大查看",
      "明细",
      "trend-line-svg",
      "trend-detail-table",
      "resolveLedgerAnalysis(snapshot, modelPeriod)"
    ]
  },
  {
    file: "src/renderer/styles.css",
    includes: [
      ".ledger-layout",
      ".ledger-top-grid",
      ".ledger-middle-grid",
      ".ledger-line-chart",
      ".trend-line-path",
      ".trend-series-toggle",
      ".ledger-trend-detail",
      ".ledger-trend-overlay",
      ".trend-expanded-panel",
      ".trend-expanded-panel .ledger-trend-detail",
      ".icon-action-button",
      ".detail-toggle-button",
      ".detail-hidden",
      ".detail-open",
      "box-shadow: 0 18px 38px",
      ".trend-detail-table",
      ".insight-grid",
      ".ledger-model-table",
      ".ledger-session-card"
    ]
  }
];

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

async function assertFileExists(relativePath, errors) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    await access(absolutePath);
    const fileStat = await stat(absolutePath);
    if (fileStat.size <= 0) {
      errors.push(`${relativePath} 为空。`);
    }
  } catch {
    errors.push(`${relativePath} 缺失。`);
  }
}

async function assertTextIncludes(assertion, errors) {
  let content = "";
  try {
    content = await readFile(path.join(ROOT, assertion.file), "utf8");
  } catch {
    errors.push(`${assertion.file} 无法读取。`);
    return;
  }

  for (const keyword of assertion.includes) {
    if (!content.includes(keyword)) {
      errors.push(`${assertion.file} 缺少关键内容：${keyword}`);
    }
  }
}

async function assertLedgerPageScope(errors) {
  const content = await readFile(path.join(ROOT, "src", "renderer", "App.tsx"), "utf8");
  const start = content.indexOf("function LedgerPage");
  const end = content.indexOf("function RepositoriesPage");

  if (start < 0 || end < 0 || end <= start) {
    errors.push("App.tsx 无法定位 LedgerPage 到 RepositoriesPage 的实现范围。");
    return;
  }

  const ledgerScope = content.slice(start, end);
  const forbidden = ["QuotaWindowCard", "5H", "月额度"];
  for (const keyword of forbidden) {
    if (ledgerScope.includes(keyword)) {
      errors.push(`LedgerPage 不应继续展示旧额度入口：${keyword}`);
    }
  }
}

async function main() {
  const errors = [];

  await Promise.all(REQUIRED_FILES.map((file) => assertFileExists(file, errors)));
  await Promise.all(TEXT_ASSERTIONS.map((assertion) => assertTextIncludes(assertion, errors)));
  await assertLedgerPageScope(errors);

  if (errors.length > 0) {
    console.error("账本页一致性校验失败：");
    console.error(formatList(errors));
    process.exitCode = 1;
    return;
  }

  console.log("账本页一致性校验通过：设计图、数据合同、采集器和页面实现关键内容一致。");
}

main().catch((error) => {
  console.error(`账本页一致性校验异常：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PRIMARY_WINDOW_MINUTES = 300;
const SECONDARY_WINDOW_MINUTES = 10080;
const ONE_MINUTE_MS = 60 * 1000;

function readArg(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function defaultSnapshotPath() {
  if (process.env.CODEX_COMPANION_SNAPSHOT_PATH) {
    return process.env.CODEX_COMPANION_SNAPSHOT_PATH;
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "codex-companion", "snapshot.json");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "codex-companion", "snapshot.json");
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "codex-companion", "snapshot.json");
}

function parseIsoMs(value) {
  if (typeof value !== "string") {
    return null;
  }

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function numberInRange(value, min, max) {
  return isNumber(value) && value >= min && value <= max;
}

function closeTo(left, right, tolerance = 0.01) {
  return Math.abs(left - right) <= tolerance;
}

function clampPercent(value) {
  if (!isNumber(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, value));
}

function formatPercent(value) {
  return isNumber(value) ? `${value.toFixed(2).replace(/\.00$/, "")}%` : "--";
}

function formatMoney(value) {
  return isNumber(value) ? `$${value.toFixed(2)}` : "--";
}

function makeReporter() {
  const errors = [];
  const warnings = [];

  return {
    errors,
    warnings,
    assert(condition, message) {
      if (!condition) {
        errors.push(message);
      }
    },
    warn(condition, message) {
      if (!condition) {
        warnings.push(message);
      }
    }
  };
}

function verifyWindow({
  report,
  label,
  expectedKey,
  expectedWindowMinutes,
  window,
  period
}) {
  report.assert(window && typeof window === "object", `${label}: limitWindow 缺失。`);
  report.assert(period && typeof period === "object", `${label}: windowPeriod 缺失。`);
  if (!window || !period) {
    return null;
  }

  report.assert(window.key === expectedKey, `${label}: key 应为 ${expectedKey}，当前为 ${window.key ?? "空"}。`);
  report.assert(window.sourceStatus === "observed", `${label}: sourceStatus 应为 observed，当前为 ${window.sourceStatus ?? "空"}。`);
  report.assert(window.windowMinutes === expectedWindowMinutes, `${label}: windowMinutes 应为 ${expectedWindowMinutes}。`);

  report.assert(numberInRange(window.usedPercent, 0, 100), `${label}: usedPercent 必须在 0-100。`);
  report.assert(numberInRange(window.remainingPercent, 0, 100), `${label}: remainingPercent 必须在 0-100。`);
  if (isNumber(window.usedPercent) && isNumber(window.remainingPercent)) {
    report.assert(
      closeTo(window.remainingPercent, 100 - window.usedPercent),
      `${label}: 圆环余量必须等于 100 - 页面显示 usedPercent。`
    );
  }

  const resetsAtMs = parseIsoMs(window.resetsAt);
  const observedAtMs = parseIsoMs(window.observedAt);
  const periodStartMs = parseIsoMs(period.startAt);
  const periodEndMs = parseIsoMs(period.endAt);
  report.assert(resetsAtMs !== null, `${label}: resetsAt 必须是有效 ISO 时间。`);
  report.assert(observedAtMs !== null, `${label}: observedAt 必须是有效 ISO 时间。`);
  report.assert(periodStartMs !== null, `${label}: period.startAt 必须是有效 ISO 时间。`);
  report.assert(periodEndMs !== null, `${label}: period.endAt 必须是有效 ISO 时间。`);

  if (resetsAtMs !== null && periodEndMs !== null) {
    report.assert(
      Math.abs(periodEndMs - resetsAtMs) <= ONE_MINUTE_MS,
      `${label}: 当前周期 endAt 必须与 resetsAt 对齐。`
    );
  }

  if (resetsAtMs !== null && periodStartMs !== null) {
    const expectedStartMs = resetsAtMs - expectedWindowMinutes * ONE_MINUTE_MS;
    report.assert(
      Math.abs(periodStartMs - expectedStartMs) <= ONE_MINUTE_MS,
      `${label}: 当前周期 startAt 必须等于 resetsAt - windowMinutes。`
    );
  }

  const evidence = period.quotaEvidence;
  report.assert(evidence && typeof evidence === "object", `${label}: quotaEvidence 缺失。`);
  if (evidence) {
    report.assert(Number.isInteger(evidence.observations) && evidence.observations > 0, `${label}: observations 必须大于 0。`);
    report.assert(Number.isInteger(evidence.resetCount) && evidence.resetCount >= 0, `${label}: resetCount 必须大于等于 0。`);
    report.assert(Number.isInteger(evidence.rechargeCount) && evidence.rechargeCount >= 0, `${label}: rechargeCount 必须大于等于 0。`);
    const resetEvents = Array.isArray(evidence.resetEvents) ? evidence.resetEvents : [];
    const rechargeEvents = Array.isArray(evidence.rechargeEvents) ? evidence.rechargeEvents : [];
    report.assert(Array.isArray(evidence.resetEvents), `${label}: resetEvents 必须是数组。`);
    report.assert(Array.isArray(evidence.rechargeEvents), `${label}: rechargeEvents 必须是数组。`);
    report.assert(Array.isArray(evidence.usageSegments), `${label}: usageSegments 必须是数组。`);
    report.assert(isNumber(evidence.usedPercent) && evidence.usedPercent >= 0, `${label}: quotaEvidence.usedPercent 必须是非负数。`);
    report.assert(numberInRange(evidence.maxObservedUsedPercent, 0, 100), `${label}: maxObservedUsedPercent 必须在 0-100。`);
    report.assert(parseIsoMs(evidence.lastObservedAt) !== null, `${label}: lastObservedAt 必须是有效 ISO 时间。`);
    report.assert(
      resetEvents.length === evidence.resetCount,
      `${label}: resetEvents.length 必须等于 resetCount。`
    );
    report.assert(
      rechargeEvents.length === evidence.rechargeCount,
      `${label}: rechargeEvents.length 必须等于 rechargeCount。`
    );

    for (const [index, event] of resetEvents.entries()) {
      const eventLabel = `${label}: resetEvents[${index}]`;
      report.assert(parseIsoMs(event.at) !== null, `${eventLabel}.at 必须是有效 ISO 时间。`);
      report.assert(parseIsoMs(event.beforeObservedAt) !== null, `${eventLabel}.beforeObservedAt 必须是有效 ISO 时间。`);
      report.assert(numberInRange(event.beforeUsedPercent, 0, 100), `${eventLabel}.beforeUsedPercent 必须在 0-100。`);
      report.assert(numberInRange(event.afterUsedPercent, 0, 100), `${eventLabel}.afterUsedPercent 必须在 0-100。`);
      report.assert(event.beforeUsedPercent - event.afterUsedPercent >= 5, `${eventLabel} 必须体现至少 5 个百分点的下降。`);
      report.assert(parseIsoMs(event.afterWindowResetsAt) !== null, `${eventLabel}.afterWindowResetsAt 必须是有效 ISO 时间。`);
      report.assert(event.evidence && typeof event.evidence === "object", `${eventLabel}.evidence 缺失。`);
      if (event.evidence) {
        report.assert(Array.isArray(event.evidence.evidenceTypes), `${eventLabel}.evidence.evidenceTypes 必须是数组。`);
        report.assert(
          event.evidence.highWaterEvidence === true ||
            event.evidence.boundaryAlignedEvidence === true ||
            event.evidence.stabilizedBoundaryEvidence === true,
          `${eventLabel} 必须具备高水位、边界贴近或稳定边界回看证据。`
        );
        report.assert(
          parseIsoMs(event.evidence.afterBoundaryAt) !== null,
          `${eventLabel}.evidence.afterBoundaryAt 必须是有效 ISO 时间。`
        );
      }

      report.assert(event.confirmation && typeof event.confirmation === "object", `${eventLabel}.confirmation 缺失。`);
      if (event.confirmation) {
        report.assert(event.confirmation.status === "confirmed", `${eventLabel}.confirmation.status 必须为 confirmed。`);
        report.assert(
          event.confirmation.reason === "stable-window-boundary",
          `${eventLabel}.confirmation.reason 必须为 stable-window-boundary。`
        );
        report.assert(
          Number.isInteger(event.confirmation.stableObservationCount) &&
            event.confirmation.stableObservationCount > 0,
          `${eventLabel}.confirmation.stableObservationCount 必须大于 0。`
        );
      }
    }

    for (const [index, event] of rechargeEvents.entries()) {
      const eventLabel = `${label}: rechargeEvents[${index}]`;
      report.assert(Number.isInteger(event.rechargeIndex) && event.rechargeIndex > 0, `${eventLabel}.rechargeIndex 必须大于 0。`);
      report.assert(parseIsoMs(event.at) !== null, `${eventLabel}.at 必须是有效 ISO 时间。`);
      report.assert(parseIsoMs(event.windowStartedAt) !== null, `${eventLabel}.windowStartedAt 必须是有效 ISO 时间。`);
      report.assert(parseIsoMs(event.expiresAt) !== null, `${eventLabel}.expiresAt 必须是有效 ISO 时间。`);
      report.assert(parseIsoMs(event.previousUsageStartedAt) !== null, `${eventLabel}.previousUsageStartedAt 必须是有效 ISO 时间。`);
      report.assert(parseIsoMs(event.previousUsageEndedAt) !== null, `${eventLabel}.previousUsageEndedAt 必须是有效 ISO 时间。`);
      report.assert(numberInRange(event.previousUsedPercent, 0, 100), `${eventLabel}.previousUsedPercent 必须在 0-100。`);
    }

    if (isNumber(evidence.usedPercent)) {
      const expectedDisplayedUsedPercent = clampPercent(evidence.usedPercent);
      const expectedDisplayedRemainingPercent =
        evidence.remainingPercent === null
          ? Math.max(0, 100 - evidence.usedPercent)
          : evidence.remainingPercent;

      report.assert(
        isNumber(window.usedPercent) &&
          expectedDisplayedUsedPercent !== null &&
          closeTo(window.usedPercent, expectedDisplayedUsedPercent),
        `${label}: limitWindow.usedPercent 必须使用当前周期 quotaEvidence.usedPercent 的显示口径。`
      );
      report.assert(
        isNumber(window.remainingPercent) &&
          closeTo(window.remainingPercent, expectedDisplayedRemainingPercent),
        `${label}: 圆环余量必须使用当前周期 quotaEvidence.remainingPercent。`
      );
      report.assert(
        isNumber(window.estimatedValueBasisUsedPercent) &&
          closeTo(window.estimatedValueBasisUsedPercent, evidence.usedPercent),
        `${label}: estimatedValueBasisUsedPercent 必须使用周期累计 quotaEvidence.usedPercent。`
      );
    }
  }

  report.assert(isNumber(period.tokens?.total) && period.tokens.total >= 0, `${label}: period.tokens.total 必须是非负数。`);
  report.assert(isNumber(period.apiCostUsd) && period.apiCostUsd >= 0, `${label}: period.apiCostUsd 必须是非负数。`);
  report.assert(Number.isInteger(period.sessions) && period.sessions >= 0, `${label}: period.sessions 必须是非负整数。`);

  if (
    isNumber(window.estimatedSpentUsd) &&
    window.estimatedSpentUsd > 0 &&
    isNumber(window.estimatedValueBasisUsedPercent) &&
    window.estimatedValueBasisUsedPercent > 0
  ) {
    const expectedFullValue = window.estimatedSpentUsd / (window.estimatedValueBasisUsedPercent / 100);
    report.assert(
      isNumber(window.estimatedFullValueUsd) && closeTo(window.estimatedFullValueUsd, expectedFullValue, 0.05),
      `${label}: estimatedFullValueUsd 必须按周期累计百分比分母计算。`
    );
  }

  return {
    label,
    remainingPercent: window.remainingPercent,
    displayedUsedPercent: window.usedPercent,
    cycleUsedPercent: period.quotaEvidence?.usedPercent ?? null,
    observations: period.quotaEvidence?.observations ?? null,
    resetCount: period.quotaEvidence?.resetCount ?? null,
    rechargeCount: period.quotaEvidence?.rechargeCount ?? null,
    tokens: period.tokens.total,
    apiCostUsd: period.apiCostUsd,
    estimatedFullValueUsd: window.estimatedFullValueUsd
  };
}

async function main() {
  const snapshotPath = path.resolve(readArg("--snapshot") ?? defaultSnapshotPath());
  const raw = await readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(raw);
  const report = makeReporter();

  report.assert(snapshot?.overview?.limitWindows?.length >= 2, "overview.limitWindows 至少需要包含 5H 与周额度。");
  report.assert(snapshot?.overview?.windowPeriods, "overview.windowPeriods 缺失。");

  const primarySummary = verifyWindow({
    report,
    label: "5H 额度",
    expectedKey: "primary",
    expectedWindowMinutes: PRIMARY_WINDOW_MINUTES,
    window: snapshot.overview?.limitWindows?.[0],
    period: snapshot.overview?.windowPeriods?.fiveHour
  });

  const weeklySummary = verifyWindow({
    report,
    label: "周额度",
    expectedKey: "secondary",
    expectedWindowMinutes: SECONDARY_WINDOW_MINUTES,
    window: snapshot.overview?.limitWindows?.[1],
    period: snapshot.overview?.windowPeriods?.weekLimit
  });

  if (report.errors.length > 0) {
    console.error("额度快照校验失败：");
    for (const error of report.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`额度快照校验通过：${path.basename(snapshotPath)}`);
  for (const summary of [primarySummary, weeklySummary].filter(Boolean)) {
    console.log(
      [
        `${summary.label}`,
        `周期余量 ${formatPercent(summary.remainingPercent)}`,
        `显示已用 ${formatPercent(summary.displayedUsedPercent)}`,
        `周期累计 ${formatPercent(summary.cycleUsedPercent)}`,
        `Token ${summary.tokens.toLocaleString("en-US")}`,
        `API 等价成本 ${formatMoney(summary.apiCostUsd)}`,
        `观测 ${summary.observations} 次`,
        `充值 ${summary.rechargeCount} 次`,
        `满额估值 ${formatMoney(summary.estimatedFullValueUsd)}`
      ].join("；")
    );
  }

  if (report.warnings.length > 0) {
    console.log("提示：");
    for (const warning of report.warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(`额度快照校验异常：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

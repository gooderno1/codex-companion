#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const { matchingPreviousPeriodEnd } = require(
  path.join(process.cwd(), "dist-electron/main/utils/time.js")
);
const { SettingsStore } = require(
  path.join(process.cwd(), "dist-electron/main/state/settingsStore.js")
);
const { describeOverviewComparison } = require(
  path.join(process.cwd(), "dist-electron/shared/overviewComparison.js")
);

function iso(value) {
  return value.toISOString();
}

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-01T15:30:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z")
    )
  ),
  "2026-08-31T15:30:00.000Z",
  "昨日同期应保留当前日已经过时长"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-07T00:00:00.000Z"),
      new Date("2026-09-09T10:15:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-07T00:00:00.000Z")
    )
  ),
  "2026-09-02T10:15:00.000Z",
  "上周同期应落到相同星期和时刻"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-31T12:00:00.000Z"),
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z")
    )
  ),
  "2026-03-01T00:00:00.000Z",
  "上月天数较少时应封顶到上月周期末"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-01T12:00:00.000Z"),
      new Date("2026-09-01T11:00:00.000Z"),
      new Date("2026-08-25T12:00:00.000Z"),
      new Date("2026-09-01T12:00:00.000Z")
    )
  ),
  "2026-08-25T12:00:00.000Z",
  "异常的负进度不得越过上一周期起点"
);

assert.deepEqual(
  describeOverviewComparison({
    current: 150,
    previous: 100,
    compareLabel: "上周同期",
    display: "percentage",
    unit: "token"
  }),
  {
    text: "较上周同期 +50.0%",
    fullText: "较上周同期 +50.0%"
  }
);

assert.deepEqual(
  describeOverviewComparison({
    current: 0,
    previous: 0,
    compareLabel: "昨日同期",
    display: "percentage",
    unit: "line"
  }),
  {
    text: "较昨日同期 0.0%",
    fullText: "较昨日同期 0.0%"
  }
);

assert.deepEqual(
  describeOverviewComparison({
    current: 6_541,
    previous: 0,
    compareLabel: "昨日同期",
    display: "percentage",
    unit: "line"
  }),
  {
    text: "较昨日同期 +65.4万%",
    fullText: "较昨日同期 +654,100.0%"
  },
  "零分母应按 1 计算，并紧凑显示超大百分比"
);

assert.deepEqual(
  describeOverviewComparison({
    current: 125_778_327,
    previous: 0,
    compareLabel: "上月同期",
    display: "percentage",
    unit: "token"
  }),
  {
    text: "较上月同期 +125.8亿%",
    fullText: "较上月同期 +12,577,832,700.0%"
  }
);

assert.deepEqual(
  describeOverviewComparison({
    current: 125_778_327,
    previous: 0,
    compareLabel: "上月同期",
    display: "absolute",
    unit: "token"
  }),
  {
    text: "较上月同期 +1.3亿 tok",
    fullText: "较上月同期 +125,778,327 tok"
  }
);

assert.deepEqual(
  describeOverviewComparison({
    current: 6_541,
    previous: 0,
    compareLabel: "昨日同期",
    display: "absolute",
    unit: "line"
  }),
  {
    text: "较昨日同期 +6,541 行",
    fullText: "较昨日同期 +6,541 行"
  }
);

const settingsDirectory = await mkdtemp(
  path.join(os.tmpdir(), "codex-companion-overview-comparison-")
);
try {
  await writeFile(
    path.join(settingsDirectory, "settings.json"),
    JSON.stringify({ billingMonthStartDay: 1 }),
    "utf8"
  );
  const store = new SettingsStore(settingsDirectory);
  const migrated = await store.read();
  assert.equal(
    migrated.overview.comparisonDisplay,
    "percentage",
    "旧设置应迁移为默认百分比"
  );
  const updated = await store.update((current) => ({
    ...current,
    overview: { comparisonDisplay: "absolute" }
  }));
  assert.equal(updated.overview.comparisonDisplay, "absolute");
  assert.equal((await store.read()).overview.comparisonDisplay, "absolute");
} finally {
  await rm(settingsDirectory, { recursive: true, force: true });
}

console.log("总览同期边界、零分母、绝对变化量与偏好迁移校验通过。");

#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { buildQuotaWindowUsage } = require("../dist-electron/main/collectors/dashboardCollector.js");
const { collectCodexData } = require("../dist-electron/main/collectors/codexCollector.js");
const { estimateApiCostUsd, estimateCodexCredits, resolvePricingRate } = require("../dist-electron/main/collectors/pricing.js");

const oldEnd = "2026-09-19T10:58:40.000Z";
const newEnd = "2026-09-23T08:07:10.000Z";
const resetStart = "2026-09-16T08:07:10.000Z";
function observation(timestamp, usedPercent, resetsAt = newEnd, sessionId = "fixture", limitId = "codex") {
  return {
    timestamp, sessionId,
    rateLimits: {
      observedAt: timestamp, limitId, limitName: null, planType: "pro",
      primary: { usedPercent, windowMinutes: 10080, resetsAt }, secondary: null
    }
  };
}
function tokens(input, cachedInput = 0, output = 0) {
  return { input, cachedInput, output, reasoningOutput: 0, total: input + output };
}
const latest = observation("2026-09-17T04:00:00.000Z", 51);
const observations = [
  observation("2026-09-16T08:00:00.000Z", 97, oldEnd),
  // 新周期实际已开始，但此条仍携带旧窗口的 98%。
  observation("2026-09-16T08:07:20.955Z", 98, oldEnd),
  observation("2026-09-16T08:07:24.000Z", 96, oldEnd, "second-session"),
  observation("2026-09-16T08:07:47.951Z", 0),
  observation("2026-09-16T08:45:00.000Z", 10),
  observation("2026-09-16T09:00:00.000Z", 100, newEnd, "other-pool", "codex_bengalfox"),
  latest
];
const events = [
  ["2026-09-16T08:00:00.000Z", 100],
  ["2026-09-16T08:07:20.955Z", 200],
  ["2026-09-16T08:45:00.000Z", 300]
].map(([timestamp, input]) => ({ timestamp, tokens: tokens(input), apiCostUsd: input / 100, creditsEstimate: 0, sessionId: "fixture", model: "gpt-6-astra", cwd: null }));
const usage = buildQuotaWindowUsage({ latestRateSnapshot: latest.rateLimits, events, quotaObservations: observations, windowKind: "weekly", resetAwareTimeline: true });
assert.equal(usage.currentCycle.usedPercent, 51);
assert.equal(usage.currentCycle.remainingPercent, 49);
assert.equal(Date.parse(usage.currentCycle.startAt), Date.parse(resetStart));
assert.equal(usage.currentCycle.tokens.total, 500, "延迟额度快照不能改变真实 Token 时间归属");
assert.equal(usage.currentCycle.apiCostUsd, 5);
assert.equal(usage.currentCycle.usageSegments.length, 1);
const closed = usage.cycles.find((cycle) => cycle.resetCount === 1);
assert.ok(closed, "旧周期必须保留核心包确认的 reset");
assert.equal(closed.usedPercent, 98, "旧窗口高水位应留在旧周期");
assert.equal(closed.tokens.total, 100);
assert.equal(closed.resetEvents[0].confirmation.status, "confirmed");

const closeBoundaries = observations.map((entry) => ({
  ...entry,
  rateLimits: {
    ...entry.rateLimits,
    primary: { ...entry.rateLimits.primary, resetsAt: entry.rateLimits.primary.resetsAt === oldEnd ? "2026-09-23T08:05:10.000Z" : newEnd }
  }
}));
const closeUsage = buildQuotaWindowUsage({ latestRateSnapshot: latest.rateLimits, events, quotaObservations: closeBoundaries, windowKind: "weekly", resetAwareTimeline: true });
assert.equal(closeUsage.currentCycle.usedPercent, 51, "新旧窗口边界相距小于 5min 时不能将新观测误归旧周期");
assert.equal(closeUsage.currentCycle.observations, usage.currentCycle.observations);

const noReset = buildQuotaWindowUsage({ latestRateSnapshot: latest.rateLimits, events: [], quotaObservations: [observation("2026-09-16T09:00:00.000Z", 90), latest], windowKind: "weekly", resetAwareTimeline: true });
assert.equal(noReset.currentCycle.usedPercent, 90, "同一窗口无已确认 reset 时保留原有高水位口径");
assert.equal(buildQuotaWindowUsage({ latestRateSnapshot: latest.rateLimits, events: [], quotaObservations: observations, windowKind: "five-hour" }).currentCycle, null);

const sample = tokens(1_000_000, 800_000, 100_000);
assert.equal(estimateApiCostUsd("gpt-6-astra", sample), 7.8);
assert.equal(estimateApiCostUsd("gpt-6-astra-2026-09-15", sample), 7.8);
assert.equal(estimateApiCostUsd(" GPT-6 Astra ", sample), 7.8);
assert.equal(estimateApiCostUsd("gpt-6-astra", tokens(1_000_000, 1_000_000)), 1, "全缓存输入只收缓存价");
assert.equal(estimateApiCostUsd("gpt-5.5", sample), 4.4, "旧模型也不能重复收缓存输入费");
assert.equal(estimateCodexCredits("gpt-5.5", sample), 110);
assert.equal(estimateCodexCredits("gpt-6-astra", sample), 195, "使用已核实的独立 credit 费率");
assert.equal(resolvePricingRate("gpt-5.4-mini-2026-03-17").inputUsdPerMillion, 0.75);
for (const model of ["gpt-6", "gpt-6-astra-pro", "gpt-5.6-unknown", "gpt-5-unknown", "constructor"]) {
  assert.equal(resolvePricingRate(model), null, `未知模型不能套用其他单价：${model}`);
}

const fixtureHome = await mkdtemp(path.join(os.tmpdir(), "companion-usage-regression-"));
try {
  await mkdir(path.join(fixtureHome, "sessions"));
  const timestamp = "2026-09-17T04:00:00.000Z";
  const lines = [
    { type: "session_meta", payload: { id: "fixture", timestamp } },
    { type: "turn_context", payload: { model: "gpt-6-astra" } },
    { type: "event_msg", timestamp, payload: { type: "token_count", info: { total_token_usage: { input_tokens: 1_000_000, cached_input_tokens: 800_000, output_tokens: 100_000, total_tokens: 1_100_000 } } } }
  ];
  await writeFile(path.join(fixtureHome, "sessions", "rollout-2026-09-17T04-00-00-fixture.jsonl"), lines.map((line) => JSON.stringify(line)).join("\n"));
  let cache = null;
  const sessionCacheStore = { read: async () => cache, write: async (value) => { cache = value; } };
  const options = { codexHome: fixtureHome, sessionCacheStore };
  await collectCodexData(new Date(timestamp), options);
  cache.version = 2;
  for (const entry of Object.values(cache.entries)) {
    for (const event of entry.result.events) { event.apiCostUsd = 0; event.creditsEstimate = 0; }
    entry.result.session.apiCostUsd = 0;
  }
  const refreshed = await collectCodexData(new Date(timestamp), options);
  assert.equal(refreshed.cacheStats.parsedFiles, 1, "升级后须重新解析未改动的旧成本缓存");
  assert.equal(refreshed.events[0].apiCostUsd, 7.8);
  assert.equal(refreshed.events[0].creditsEstimate, 195);
  assert.equal(refreshed.events[0].creditPricingStatus, "priced");
  assert.equal(refreshed.sessions[0].apiCostUsd, 7.8);
  const reused = await collectCodexData(new Date(timestamp), options);
  assert.equal(reused.cacheStats.reusedFiles, 1);
  assert.equal(reused.events[0].apiCostUsd, 7.8);
} finally {
  await rm(fixtureHome, { recursive: true, force: true });
}
console.log("用量回归通过：reset 边界归属、旧周期证据、Token 时间归属、额度池隔离、GPT-6 定价、缓存去重计费与旧缓存迁移。");

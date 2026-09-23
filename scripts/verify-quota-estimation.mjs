import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, appendFile, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
const require = createRequire(import.meta.url);
const { aggregateQuotaEstimation, validateEstimationRequest } = require("../dist-electron/main/quotaEstimation.js");
const { priceEstimation } = require("../dist-electron/main/quotaEstimationPricing.js");
const { QuotaEstimationIndex } = require("../dist-electron/main/state/quotaEstimationIndex.js");
const { QuotaEstimationService } = require("../dist-electron/main/quotaEstimationService.js");
const start = Date.parse("2026-09-01T00:00:00Z"), hour = 3600000;
const now = start + 9 * 86400000;
const request = { startAt: new Date(start).toISOString(), endAt: new Date(now).toISOString(), catalogVersion: "2026-09-23" };
const token = input => ({ input, cachedInput: 0, output: 0, reasoningOutput: 0, total: input });
const event = (h, model = "gpt-6-astra", n = 3000000) => ({ sessionId: "fixture", timestamp: new Date(start + h * hour).toISOString(), model, tokens: token(n) });
const observation = (h, p, { primary = true, pool = "codex", plan = "pro", reset = start + 7 * 86400000 } = {}) => ({ sessionId: "fixture", timestamp: new Date(start + h * hour).toISOString(), rateLimits: {
  primary: primary ? { usedPercent: p, windowMinutes: 10080, resetsAt: new Date(reset).toISOString() } : null,
  secondary: !primary ? { usedPercent: p, windowMinutes: 10080, resetsAt: new Date(reset).toISOString() } : null,
  limitId: pool, planType: plan, limitName: null, observedAt: new Date(start + h * hour).toISOString()
} });
const data = { events: [.5, 1.5, 2.5].map(h => event(h)), observations: [0, 1, 2, 3].map(h => observation(h, 10 + h * 10)) };
const aggregate = (value, req = request) => aggregateQuotaEstimation(value, req, now);
let result = aggregate(data);
assert.equal(result.summary.costUsd, 90);
assert.equal(result.windows.length, 1);
assert.equal(result.windows[0].capacityUsd, 300, "$90 / 30% = $300");
assert.equal(result.windows[0].samples.length, 3);
assert.equal(result.windows[0].evidence, "moderate");
assert.equal(result.windows[0].p10Usd, 300);
assert.equal(result.windows[0].samples[0].alignmentLowUsd, 300);
assert.deepEqual(aggregate({ ...data, observations: [0, 1, 2, 3].map(h => observation(h, 10 + h * 10, { primary: false })) }).windows.map(w => w.capacityUsd), [300], "duration 定位周窗口，不依赖 primary/secondary");
assert.equal(aggregate({ ...data, events: [...data.events, data.events[0]] }).summary.costUsd, 90, "重放事件不重复计价");
assert.equal(aggregate({ ...data, observations: data.observations.flatMap(o => [o, o]) }).windows[0].capacityUsd, 300, "重复额度观测不增加样本");
assert.equal(aggregate({ ...data, observations: [0, 1, 2, 3].map(h => observation(h, 10 + h * 10, { pool: "codex_bengalfox" })) }).windows.length, 0);
const withSpark = aggregate({ ...data, events: [...data.events, event(.6, "gpt-5.3-codex-spark", 100000000)] });
assert.equal(withSpark.windows[0].capacityUsd, 300, "Spark 独立额度池用量不混入主池容量");
assert.equal(withSpark.summary.unpricedTokens, 100000000);
const unknown = aggregate({ ...data, events: [event(.5, "unpriced-model", 100000000), ...data.events] });
assert.equal(unknown.windows[0].samples.length, 2, "昂贵未知用量区间应剔除");
assert.equal(unknown.windows[0].evidence, "exploratory");
assert.equal(aggregate({ events: [event(.5, "new-model")], observations: [] }).summary.costUsd, null);
assert.equal(aggregate({ ...data, observations: [observation(0, 98), observation(1, 100)] }).windows[0].capacityUsd, null, "截顶不能参与除法");
assert.equal(aggregate({ events: [event(25)], observations: [observation(0, 10), observation(49, 30)] }).windows.every(w => w.capacityUsd === null), true, "超过48小时采样中断不桥接");
const changedPlan = aggregate({ ...data, observations: [observation(0, 10), observation(1, 20), observation(2, 30, { plan: "plus" }), observation(3, 40, { plan: "plus" })] });
assert.equal(changedPlan.windows.flatMap(w => w.samples).some(s => s.startAt === observation(1, 20).timestamp && s.endAt === observation(2, 30).timestamp), false);
const drop = aggregate({ events: [.5, 1.5, 2.5, 3.5].map(h => event(h)), observations: [observation(0, 10), observation(1, 20), observation(2, 5), observation(3, 15), observation(4, 25)] });
assert.equal(drop.windows.length, 2, "同边界大幅回落切片，不能归为已用额增量");
assert.equal(drop.windows[1].boundary, "比例回落，原因未确认");
const resetEnd = start + 7 * 86400000 + hour;
const resetData = { events: [.5, 1.5, 2.5, 3.5].map(h => event(h)), observations: [observation(0, 80),
  observation(1, 0, { reset: resetEnd }), observation(1.5, 85), ...[2, 3, 4].map(h => observation(h, (h - 1) * 10, { reset: resetEnd }))] };
const resetResult = aggregate(resetData);
assert.equal(resetResult.exclusions["已替代旧窗口迟到观测"], 1, "共享核心确认 reset 后剔除旧窗口回流");
assert.equal(resetResult.windows.flatMap(w => w.samples).some(s => Date.parse(s.startAt) < start + hour && Date.parse(s.endAt) > start + hour), false, "拟合不能跨确认的重置边界");
assert.equal(resetResult.windows.find(w => w.resetsAt === new Date(resetEnd).toISOString()).samples.length, 3);
const filtered = aggregate(data, { ...request, startAt: new Date(start + hour).toISOString() });
assert.equal(filtered.summary.costUsd, 60);
assert.equal(filtered.windows.flatMap(w => w.samples).every(s => Date.parse(s.startAt) >= start + hour), true);
const tokenSample = { input: 1000000, cachedInput: 800000, output: 20000, reasoningOutput: 10000, total: 1020000 };
assert.equal(priceEstimation("gpt-6-astra", tokenSample, request.endAt, "2026-09-19", "snapshot"), 3.8);
assert.equal(priceEstimation("gpt-5.6-sol", tokenSample, request.endAt, "2026-09-17", "snapshot"), null);
assert.equal(priceEstimation("gpt-5.6", tokenSample, request.endAt, "2026-09-19", "snapshot"), 1.52);
assert.equal(priceEstimation("gpt-6-pro", tokenSample, request.endAt, "2026-09-19", "snapshot"), null);
assert.equal(priceEstimation("gpt-6-astra", tokenSample, request.endAt, "2026-09-19", "historical"), null, "核对日不能代替生效日");
assert.equal(aggregate(data, { ...request, priceMode: "historical" }).summary.costUsd, null);
assert.throws(() => validateEstimationRequest({ ...request, catalogVersion: "future" }, now));
assert.throws(() => validateEstimationRequest({ ...request, startAt: request.endAt }, now));
const empty = aggregate({ events: [], observations: [] }, { ...request, startAt: "2026-07-01T00:00:00Z" });
assert.equal(empty.months.length, 3); assert.equal(empty.months.every(m => m.costUsd === null), true);

const fixture = await mkdtemp(path.join(os.tmpdir(), "companion-quota-estimation-"));
let index, service;
try {
  const home = path.join(fixture, "home"), store = path.join(fixture, "store");
  await mkdir(path.join(home, "sessions"), { recursive: true }); await mkdir(path.join(home, "archived_sessions"));
  const file = path.join(home, "sessions", "rollout.jsonl");
  const usage = (h, n) => ({ type: "event_msg", timestamp: event(h).timestamp, payload: { type: "token_count", info: { total_token_usage: { input_tokens: n, cached_input_tokens: 0, output_tokens: 0, total_tokens: n } }, rate_limits: { primary: { used_percent: 10 + h * 10, window_minutes: 10080, resets_at: (start + 7 * 86400000) / 1000 }, limit_id: "codex", plan_type: "pro" } } });
  const records = [{ type: "session_meta", payload: { id: "fixture", cwd: "PRIVATE_PATH_NOT_STORED", timestamp: request.startAt } }, { type: "turn_context", payload: { model: "gpt-6-sol" } }, usage(.5, 1000000)];
  await writeFile(file, records.map(JSON.stringify).join("\n") + "\n");
  const original = await readFile(file);
  index = new QuotaEstimationIndex(store, home);
  assert.equal((await index.refresh()).parsedFiles, 1);
  let raw = await index.query(start, now);
  assert.equal(raw.events.length, 1); assert.equal(raw.observations.length, 1);
  assert.equal(JSON.stringify(raw).includes("PRIVATE_PATH_NOT_STORED"), false);
  assert.equal(JSON.stringify(raw.events).includes("apiCostUsd"), false, "原始索引不保存派生成本");
  assert.equal(aggregate(raw).summary.costUsd, 2);
  assert.equal(aggregate(raw, { ...request, catalogVersion: "2026-09-19" }).summary.costUsd, null);
  assert.equal((await index.refresh()).reusedFiles, 1, "切换价格不重解析文件");
  index.close(); index = new QuotaEstimationIndex(store, home);
  assert.equal((await index.refresh()).parsedFiles, 0, "重启复用原始索引");
  assert.deepEqual(await readFile(file), original);
  await appendFile(file, JSON.stringify(usage(1.5, 1500000)) + "\n");
  assert.equal((await index.refresh()).parsedFiles, 1);
  raw = await index.query(start, now);
  assert.equal(raw.events.reduce((n, e) => n + e.tokens.total, 0), 1500000);
  const destination = path.join(home, "archived_sessions", "rollout.jsonl");
  await rename(file, destination); await index.refresh();
  assert.equal((await index.query(start, now)).events.length, 2, "归档移动不重复计数");
  const db = new DatabaseSync(path.join(store, (await readdir(store)).find(f => f.endsWith(".sqlite"))), { readOnly: true });
  assert.match(JSON.stringify(db.prepare("EXPLAIN QUERY PLAN SELECT payload FROM usage WHERE at>=? AND at<? ORDER BY at").all(start, now)), /usage_at/);
  assert.match(JSON.stringify(db.prepare("EXPLAIN QUERY PLAN SELECT payload FROM observations WHERE at>=? AND at<? ORDER BY at").all(start, now)), /observations_at/);
  db.close(); index.close();
  service = new QuotaEstimationService({ read: async () => ({ codexHome: home }) }, store);
  const first = await service.query(request), second = await service.query({ ...request, catalogVersion: "2026-09-19" });
  assert.equal(first.summary.costUsd, 3); assert.equal(second.summary.costUsd, null);
  assert.equal(second.performance.parsedFiles, 0, "后台线程切换价格只重算估值");
  service.close(); service = null;
} finally {
  service?.close(); index?.close();
  const resolved = path.resolve(fixture);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith("companion-quota-estimation-"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

for (const [model,cost] of [["gpt-6-sol",.76],["gpt-6-luna",.038]]) {
  assert.ok(Math.abs(priceEstimation(model,tokenSample,request.endAt,"2026-09-23","snapshot")-cost)<1e-10);
  assert.equal(priceEstimation(model,tokenSample,request.endAt,"2026-09-19","snapshot"),null);
  assert.equal(priceEstimation(model,tokenSample,request.endAt,"2026-09-23","historical"),null);
}
console.log("额度估算验证通过：公式、池 / 时长、分段、缺失价格、范围、原始索引、重启复用及后台重估。");

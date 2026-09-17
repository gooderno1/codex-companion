#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { buildDisplayedQuotaWindow, buildQuotaWindowUsage, resolveLocalRateSnapshot, clearCachedCurrentQuota, canUseCurrentQuotaCache, normalizeOfficialUsageSnapshot, DashboardService } = require("../dist-electron/main/collectors/dashboardCollector.js");
const { buildDashboardNotificationCandidates } = require("../dist-electron/main/notifications.js");
const o = (timestamp, usedPercent, resetsAt = "2026-09-23T08:00:00Z", limitId = "codex") => ({
  timestamp, sessionId: "fixture", rateLimits: { observedAt: timestamp, limitId, limitName: null, planType: "pro", primary: { usedPercent, windowMinutes: 10080, resetsAt }, secondary: null }
});
const oldEnd = "2026-09-19T08:00:00Z";
const observations = [o("2026-09-16T07:59:00Z", 98, oldEnd), o("2026-09-16T08:00:10Z", 98, oldEnd), o("2026-09-16T08:00:30Z", 0), o("2026-09-16T08:02:00Z", 1)];
const pending = buildQuotaWindowUsage({ latestRateSnapshot: observations.at(-1).rateLimits, quotaObservations: observations, events: [], windowKind: "weekly", resetAwareTimeline: true });
assert.equal(pending.currentCycle.remainingPercent, 99);
assert.equal(pending.currentCycle.resetCount, 0, "当前值恢复不伪造 reset 确认");
const delayed = [...observations, o("2026-09-16T08:35:00Z", 5), o("2026-09-16T08:40:00Z", 98, oldEnd), o("2026-09-16T08:41:00Z", 100, "2026-09-23T08:00:00Z", "codex_bengalfox")];
const selected = resolveLocalRateSnapshot(delayed.at(-2).rateLimits, delayed, new Date("2026-09-16T09:00:00Z"));
assert.equal(selected.primary.usedPercent, 5);
assert.equal(selected.primary.observedAt, "2026-09-16T08:35:00Z");
assert.equal(selected.secondary, null);
assert.equal(resolveLocalRateSnapshot(selected, delayed, new Date("2026-09-24T00:00:00Z")), null);
const raw = { usedPercent: 51, remainingPercent: 2, resetsAt: "2026-09-23T08:00:00Z", windowMinutes: 10080, observedAt: "2026-09-17T04:00:00Z" };
const displayed = buildDisplayedQuotaWindow(raw);
assert.equal(displayed.remainingPercent, 49, "余量从当前已用比例计算，不接受历史传入的 2%");
assert.equal(displayed.resetsAt, raw.resetsAt);
assert.equal(buildDisplayedQuotaWindow(undefined), undefined);
assert.equal(buildDisplayedQuotaWindow({ ...raw, usedPercent: null }).remainingPercent, null);
const emptyOfficial = normalizeOfficialUsageSnapshot({ observedAt: raw.observedAt, rateLimits: { primary: null, secondary: null, limitId: "codex", planType: "pro", limitName: null } });
assert.equal(emptyOfficial.primary, null);
assert.equal(emptyOfficial.secondary, null, "官方成功响应缺少窗口时不补历史槽位");

const period = { startAt: "2026-09-16T08:00:00Z", endAt: "2026-09-23T08:00:00Z", quotaEvidence: { usedPercent: 98, remainingPercent: 2 } };
const window = { ...displayed, quotaSource: "official-usage", sourceStatus: "observed" };
const snapshot = {
  generatedFrom: "live", generatedAt: "2026-09-17T04:00:00Z", quotaDisplayVersion: 2,
  overview: { limitWindows: [{ sourceStatus: "unobserved" }, window], windowPeriods: { fiveHour: period, weekLimit: period }, bankedResetCredits: { availableCount: 0 } },
  ledger: { limitWindows: [window] }, widget: { metrics: [{ key: "planRemaining", value: "2%" }] }, sourceHealth: {}
};
assert.equal(buildDashboardNotificationCandidates(snapshot).length, 0, "历史剩余 2% 不应触发当前低额提醒");
window.remainingPercent = 5;
assert.equal(buildDashboardNotificationCandidates(snapshot).filter(item => item.category === "quota").length, 1);
window.remainingPercent = null;
assert.equal(buildDashboardNotificationCandidates(snapshot).length, 0, "当前未知时不能回退到历史余量提醒");
const cleared = clearCachedCurrentQuota(snapshot);
assert.equal(cleared.overview.limitWindows[1].remainingPercent, null);
assert.equal(cleared.ledger.limitWindows[0].remainingPercent, null);
assert.equal(cleared.widget.metrics[0].value, "未观测");
assert.equal(cleared.generatedAt, snapshot.generatedAt, "失败回退不伪造采集时间");
assert.equal(cleared.overview.windowPeriods.weekLimit.quotaEvidence.usedPercent, 98, "清空当前值不能删除历史证据");

for (const cache of [
  { ...snapshot, quotaDisplayVersion: undefined, generatedAt: new Date().toISOString() },
  { ...snapshot, generatedAt: new Date(Date.now() - 120_000).toISOString() },
  { ...snapshot, generatedAt: new Date().toISOString(), overview: { ...snapshot.overview, limitWindows: [{ sourceStatus: "observed", resetsAt: new Date(Date.now() - 1).toISOString() }] } }
]) {
  const service = new DashboardService({}, { read: async () => cache });
  assert.equal(await service.getCachedSnapshot(), null, "旧语义、过期缓存不得重新显示为当前额度");
}
const at = new Date();
const validCache = { ...snapshot, generatedAt: at.toISOString(), overview: { ...snapshot.overview, limitWindows: [{ sourceStatus: "observed", resetsAt: new Date(at.getTime() + 30_000).toISOString() }] } };
assert.equal(canUseCurrentQuotaCache(validCache, at), true);
assert.equal(canUseCurrentQuotaCache(validCache, new Date(at.getTime() + 30_001)), false, "进程内缓存也须在窗口到期时失效");
console.log("当前额度回归通过：确认前余量、官方值、窗口截止、本地迟到/过期/池隔离、通知、挂件和启动缓存迁移。");

import { analyzeQuotaObservations } from "@lifeinhand/codex-usage-core";
import type { QuotaObservation } from "./collectors/codexCollector";
import type { EstimationEvent } from "./state/quotaEstimationIndex";
import type { EstimationMonth, EstimationSlice, EstimationWindow, QuotaEstimationRequest, QuotaEstimationResponse } from "../shared/quotaEstimation";
import { emptyTokens, sumTokens } from "./collectors/metrics";
import { defaultEstimationCatalog, estimationCatalog, estimationCatalogs, priceEstimation } from "./quotaEstimationPricing";

const DAY = 86_400_000, WEEK = 7 * DAY, ROUNDING = 120_000;
export const localEstimationDay = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function validateEstimationRequest(request: QuotaEstimationRequest, now = Date.now()) {
  if (!request || (request.startAt !== null && typeof request.startAt !== "string") || typeof request.endAt !== "string") throw new Error("时间范围格式无效。");
  const start = request.startAt === null ? 0 : Date.parse(request.startAt), end = Math.min(Date.parse(request.endAt), now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) throw new Error("请选择有效日期，开始时间须早于结束时间，且不能完全位于未来。");
  if (request.priceMode && request.priceMode !== "snapshot" && request.priceMode !== "historical") throw new Error("价格口径无效。");
  const catalog = estimationCatalog(request.catalogVersion);
  return { startAt: request.startAt === null ? null : new Date(start).toISOString(), endAt: new Date(end).toISOString(), catalogVersion: catalog.catalogVersion, priceMode: request.priceMode ?? "snapshot" as const };
}
function slice(key: string): EstimationSlice { return { key, tokens: emptyTokens(), costUsd: null, unpricedTokens: 0, unpricedEvents: 0, events: 0 }; }
function add(target: EstimationSlice, event: EstimationEvent, cost: number | null) {
  target.events++; target.tokens = sumTokens(target.tokens, event.tokens);
  if (cost === null) { target.unpricedTokens += event.tokens.total; target.unpricedEvents++; }
  else target.costUsd = (target.costUsd ?? 0) + cost;
}
function percentile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * q, lower = Math.floor(at);
  return sorted[lower] + (sorted[Math.ceil(at)] - sorted[lower]) * (at - lower);
}
const iso = (at: number) => new Date(at).toISOString();
const count = (target: Record<string, number>, reason: string) => { target[reason] = (target[reason] ?? 0) + 1; };
interface Point { t: number; p: number; end: number; plan: string | null; pool: "codex" | "legacy"; sourceId: string }

export function aggregateQuotaEstimation(data: { events: EstimationEvent[]; observations: QuotaObservation[] }, request: QuotaEstimationRequest, now = Date.now(), analyzeResets = analyzeQuotaObservations) {
  const range = validateEstimationRequest(request, now), start = range.startAt ? Date.parse(range.startAt) : 0, end = Date.parse(range.endAt);
  const exclusions: Record<string, number> = {}, summary = slice("summary"), months = new Map<string, EstimationMonth>();
  const seen = new Set<string>();
  const events = data.events.filter(event => {
    const at = Date.parse(event.timestamp);
    if (!Number.isFinite(at) || at >= end || Object.values(event.tokens).some(n => !Number.isFinite(n) || n < 0)) { count(exclusions, "无效用量记录"); return false; }
    const key = JSON.stringify([event.sessionId, event.timestamp, event.model, event.tokens.input, event.tokens.cachedInput, event.tokens.output, event.tokens.reasoningOutput, event.tokens.total]);
    if (seen.has(key)) { count(exclusions, "重复用量记录"); return false; }
    seen.add(key); return true;
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const prices = events.map(event => priceEstimation(event.model, event.tokens, event.timestamp, range.catalogVersion, range.priceMode));
  events.forEach((event, index) => {
    const at = Date.parse(event.timestamp);
    if (at < start) return;
    const day = localEstimationDay(at), month = day.slice(0, 7), cost = prices[index];
    add(summary, event, cost);
    let item = months.get(month);
    if (!item) { item = { ...slice(month), activeDays: 0, partial: false, models: [], days: [] }; months.set(month, item); }
    add(item, event, cost);
    for (const [list, key] of [[item.models, event.model], [item.days, day]] as const) {
      let row = list.find(s => s.key === key);
      if (!row) { row = slice(key); list.push(row); }
      add(row, event, cost);
    }
  });
  // 包含选择范围中的无记录月份；全历史从第一条实际用量开始，不生成 1970 年以来的空月份。
  const first = start || (events.length ? Date.parse(events[0].timestamp) : end);
  const cursor = new Date(first); cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
  for (let i = 0; cursor.getTime() < end && i < 1200; i++, cursor.setMonth(cursor.getMonth() + 1)) {
    const key = localEstimationDay(cursor.getTime()).slice(0, 7);
    if (!months.has(key)) months.set(key, { ...slice(key), activeDays: 0, partial: false, models: [], days: [] });
  }
  for (const month of months.values()) {
    const [y, m] = month.key.split("-").map(Number), begin = new Date(y, m - 1, 1).getTime(), finish = new Date(y, m, 1).getTime();
    month.partial = start > begin || end < finish;
    month.activeDays = month.days.length;
    month.days.sort((a, b) => b.key.localeCompare(a.key));
    month.models.sort((a, b) => b.tokens.total - a.tokens.total);
  }

  // 完整排序后的前缀和使每个比例区间求和为 O(log n)，不重复扫描全部 Token。
  const times = events.map(event => Date.parse(event.timestamp));
  const costs = [0], totals = [0], unknowns = [0];
  events.forEach((event, i) => {
    const separatePool = event.model.toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, "") === "gpt-5.3-codex-spark";
    costs.push(costs[i] + (separatePool ? 0 : prices[i] ?? 0));
    totals.push(totals[i] + (separatePool ? 0 : event.tokens.total));
    unknowns.push(unknowns[i] + (!separatePool && prices[i] === null ? event.tokens.total : 0));
  });
  const upper = (t: number) => { let lo = 0, hi = times.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid; } return lo; };
  const delta = (values: number[], a: number, b: number) => values[upper(b)] - values[upper(a)];
  const points: Point[] = [];
  for (const o of data.observations) {
    const t = Date.parse(o.timestamp), rate = o.rateLimits;
    if (!Number.isFinite(t) || t >= end) continue;
    if (rate.limitId && rate.limitId !== "codex") { count(exclusions, "其他额度池观测"); continue; }
    const window = [rate.primary, rate.secondary].find(w => w?.windowMinutes === 10080);
    if (!window || window.usedPercent === null || !Number.isFinite(window.usedPercent) || !window.resetsAt) { count(exclusions, "缺少有效周窗口"); continue; }
    const reset = Date.parse(window.resetsAt), p = window.usedPercent;
    if (!Number.isFinite(reset) || t >= reset || t < reset - WEEK - ROUNDING || p < 0 || p >= 99) { count(exclusions, "过期、无效或截顶观测"); continue; }
    points.push({ t, p, end: reset, plan: rate.planType, pool: rate.limitId ? "codex" : "legacy", sourceId: o.sessionId });
  }
  points.sort((a, b) => a.t - b.t);
  // 使用共享核心检测结果，只消费 confirmed 边界，不在应用中重写 reset 规则。
  const resets = analyzeResets(points.map(p => ({ observedAt: iso(p.t), usedPercent: p.p, resetsAt: iso(p.end), windowMinutes: 10080, sourceId: p.sourceId })), { comparisonScope: "timeline" }).resetEvents
    .filter(r => r.confirmation?.status === "confirmed" && r.beforeWindowResetsAt && r.afterWindowResetsAt)
    .map(r => ({ t: Date.parse(r.boundaryAt ?? r.at), before: Date.parse(r.beforeWindowResetsAt!), after: Date.parse(r.afterWindowResetsAt!) }));
  const transitions: number[] = [];
  points.forEach((p, i) => { if (i && (points[i - 1].plan !== p.plan || points[i - 1].pool !== p.pool)) transitions.push(p.t); });
  const anchors: number[] = [], resetAnchors = new Map<number, number>();
  for (const value of [...new Set(points.map(p => p.end))].sort((a, b) => a - b)) {
    if (!anchors.length || value - anchors.at(-1)! > ROUNDING) anchors.push(value);
    resetAnchors.set(value, anchors.at(-1)!);
  }
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    if (resets.some(r => Math.abs(p.end - r.before) <= ROUNDING && Math.abs(r.before - r.after) > ROUNDING && p.t >= r.t)) { count(exclusions, "已替代旧窗口迟到观测"); continue; }
    const key = JSON.stringify([resetAnchors.get(p.end), p.plan, p.pool]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const windows: EstimationWindow[] = [];
  for (const [key, rows] of groups) {
    const bins = new Map<number, Point[]>();
    for (const row of rows) { const bucket = Math.floor(row.t / 300_000); if (!bins.has(bucket)) bins.set(bucket, []); bins.get(bucket)!.push(row); }
    const reduced = [...bins.values()].map(list => ({ ...list[0], t: percentile(list.map(p => p.t), .5), p: percentile(list.map(p => p.p), .5) }));
    let segment: Point[] = [], reason = "周窗口观测";
    const flush = () => {
      if (!segment.length || segment.at(-1)!.t < start) { segment = []; return; }
      const first = segment[0], last = segment.at(-1)!;
      const window: EstimationWindow = { id: `${key}:${first.t}`, resetsAt: iso(resetAnchors.get(first.end)!), startAt: iso(Math.max(start, first.t)), endAt: iso(last.t), plan: first.plan, pool: first.pool,
        capacityUsd: null, p10Usd: null, p90Usd: null, costUsd: 0, deltaPercent: 0, evidence: "insufficient", changeDetected: false, boundary: reason, samples: [], excluded: {} };
      let a = first;
      for (const b of segment.slice(1)) {
        if (b.p < a.p) { count(window.excluded, "小幅回退观测"); continue; }
        if (b.p - a.p < 10) continue;
        const dp = b.p - a.p, cost = delta(costs, a.t, b.t), tokens = delta(totals, a.t, b.t), unknown = delta(unknowns, a.t, b.t);
        const rejected = a.t < start ? "跨选择范围" : b.t - a.t > 2 * DAY ? "区间超过48小时" :
          resets.some(r => a.t < r.t && r.t <= b.t) ? "跨核心确认边界" : transitions.some(t => a.t < t && t <= b.t) ? "跨套餐或额度池变化" :
          tokens <= 0 || cost <= 0 ? "缺少已定价用量" : unknown / tokens > .02 ? "未知模型Token超过2%" : null;
        if (rejected) count(window.excluded, rejected);
        else {
          const shifted = [-ROUNDING, 0, ROUNDING].map(offset => 100 * delta(costs, a.t + offset, b.t + offset) / dp);
          window.samples.push({ startAt: iso(a.t), endAt: iso(b.t), fromPercent: a.p, toPercent: b.p, deltaPercent: dp, costUsd: cost, tokens, unpricedTokens: unknown,
            capacityUsd: 100 * cost / dp, alignmentLowUsd: Math.min(...shifted), alignmentHighUsd: Math.max(...shifted) });
        }
        a = b;
      }
      if (last.t > a.t && last.p - a.p < 10) count(window.excluded, "尾段不足10个百分点");
      if (window.samples.length) {
        window.costUsd = window.samples.reduce((n, s) => n + s.costUsd, 0);
        window.deltaPercent = window.samples.reduce((n, s) => n + s.deltaPercent, 0);
        window.capacityUsd = 100 * window.costUsd / window.deltaPercent;
        window.p10Usd = percentile(window.samples.map(s => s.capacityUsd), .1);
        window.p90Usd = percentile(window.samples.map(s => s.capacityUsd), .9);
        window.evidence = window.samples.length >= 3 && window.deltaPercent >= 30 && (window.p90Usd - window.p10Usd) / window.capacityUsd <= .5 ? "moderate" : "exploratory";
        window.startAt = window.samples[0].startAt; window.endAt = window.samples.at(-1)!.endAt;
      }
      windows.push(window); segment = [];
    };
    let high = -1;
    for (const p of reduced) {
      const previous = segment.at(-1);
      const reset = previous && resets.some(r => previous.t < r.t && r.t <= p.t);
      const transition = previous && transitions.some(t => previous.t < t && t <= p.t);
      const drop = p.p < high - 3;
      const gap = previous && p.t - previous.t > 2 * DAY;
      if (previous && (reset || transition || drop || gap)) { flush(); high = -1; reason = reset ? "核心确认的重置边界" : transition ? "套餐 / 额度池变化" : drop ? "比例回落，原因未确认" : "采样中断超过48小时"; }
      if (p.p < high) { count(exclusions, "小幅回退观测"); continue; }
      segment.push(p); high = p.p;
    }
    flush();
  }
  windows.sort((a, b) => a.startAt.localeCompare(b.startAt));
  let previous: EstimationWindow | undefined;
  for (const window of windows) {
    if (window.evidence !== "moderate" || window.capacityUsd === null) continue;
    if (previous?.capacityUsd && previous.pool === window.pool && previous.plan === window.plan && Date.parse(window.startAt) - Date.parse(previous.endAt) <= WEEK) {
      const last = window.samples.slice(-3), reference = previous.capacityUsd;
      window.changeDetected = last.length === 3 && (last.every(s => s.alignmentLowUsd > reference * 1.2) || last.every(s => s.alignmentHighUsd < reference * .8));
    }
    previous = window;
  }
  const warnings = ["仅代表本机可见用量；账户、其他设备及云端活动覆盖未知。",
    "标准短上下文 API 等价成本，不含未知 Fast、缓存写入、工具、地区及长上下文调整；不是订阅实付。",
    "周窗口按时长识别；估值不覆盖官方当前余量。P10–P90 为经验离散范围，不是置信区间。"];
  if (range.priceMode === "historical" && !estimationCatalogs().some(c => c.historicalAvailable)) warnings.unshift("尚无可靠历史生效价格，按当时价格的金额保持未定价；可切换固定快照重估。");
  return { generatedAt: iso(now), range: { startAt: range.startAt, endAt: range.endAt }, catalogVersion: range.catalogVersion ?? defaultEstimationCatalog,
    priceMode: range.priceMode, catalogs: estimationCatalogs(), summary, months: [...months.values()].sort((a, b) => b.key.localeCompare(a.key)), windows, warnings, exclusions };
}

export type EstimationAggregate = Omit<QuotaEstimationResponse, "coverage" | "performance">;

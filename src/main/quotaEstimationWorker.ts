import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { analyzeQuotaObservations } from "@lifeinhand/codex-usage-core";
import type { QuotaEstimationRequest } from "../shared/quotaEstimation";
import { aggregateQuotaEstimation, validateEstimationRequest } from "./quotaEstimation";
import { QuotaEstimationIndex } from "./state/quotaEstimationIndex";

const port = parentPort!;
const index = new QuotaEstimationIndex(workerData.directory, workerData.codexHome);
let refreshedAt = 0, fileCount = 0;
let queue = Promise.resolve();
// 价格选择不会改变 reset 证据。完整输入指纹复用核心结果，任何观测变化即失效。
const resetCache = new Map<string, ReturnType<typeof analyzeQuotaObservations>>();
const analyzeResets: typeof analyzeQuotaObservations = (observations, options) => {
  const key = createHash("sha256").update(JSON.stringify([observations, options])).digest("hex");
  const saved = resetCache.get(key);
  if (saved) return saved;
  const result = analyzeQuotaObservations(observations, options);
  if (resetCache.size >= 2) resetCache.delete(resetCache.keys().next().value!);
  resetCache.set(key, result);
  return result;
};
port.on("message", ({ id, request }: { id: number; request: QuotaEstimationRequest }) => {
  queue = queue.then(async () => {
    try {
      const started = performance.now(), range = validateEstimationRequest(request);
      const needsRefresh = request.force || Date.now() - refreshedAt >= 60_000;
      const stats = needsRefresh ? await index.refresh() : { parsedFiles: 0, reusedFiles: fileCount };
      if (needsRefresh) { refreshedAt = Date.now(); fileCount = stats.parsedFiles + stats.reusedFiles; }
      const indexedAt = performance.now();
      const start = range.startAt ? Date.parse(range.startAt) : 0;
      const data = await index.query(Math.max(0, start - 7 * 86_400_000 - 120_000), Date.parse(range.endAt));
      const result = { ...aggregateQuotaEstimation(data, range, Date.now(), analyzeResets), coverage: data.coverage,
        performance: { ...stats, indexMs: Math.round(indexedAt - started), queryMs: Math.round(performance.now() - indexedAt) } };
      port.postMessage({ id, result });
    } catch (error) { port.postMessage({ id, error: error instanceof Error ? error.message : "历史额度读取失败。" }); }
  });
});

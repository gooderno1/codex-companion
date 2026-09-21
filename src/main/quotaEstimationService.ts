import path from "node:path";
import { Worker } from "node:worker_threads";
import type { QuotaEstimationRequest, QuotaEstimationResponse } from "../shared/quotaEstimation";
import { validateEstimationRequest } from "./quotaEstimation";
import type { SettingsStore } from "./state/settingsStore";

export class QuotaEstimationService {
  private worker: Worker | null = null;
  private home = "";
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: QuotaEstimationResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private settings: Pick<SettingsStore, "read">, private directory: string) {}
  async query(request: QuotaEstimationRequest): Promise<QuotaEstimationResponse> {
    const validated = validateEstimationRequest(request);
    const { codexHome } = await this.settings.read();
    if (this.worker && this.home !== codexHome) this.close();
    if (!this.worker) {
      this.home = codexHome;
      const worker = new Worker(path.join(__dirname, "quotaEstimationWorker.js"), { workerData: { directory: this.directory, codexHome } });
      this.worker = worker;
      worker.on("message", ({ id, result, error }) => {
        const task = this.pending.get(id);
        if (!task) return;
        clearTimeout(task.timer); this.pending.delete(id);
        if (error) task.reject(new Error(error)); else task.resolve(result);
      });
      const failed = () => { if (this.worker === worker) this.close(); };
      worker.on("error", failed); worker.on("exit", failed);
    }
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { if (this.pending.has(id)) this.close(); }, 5 * 60_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ id, request: { ...validated, force: request.force === true } });
    });
  }
  close() {
    const worker = this.worker; this.worker = null;
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error("历史额度读取已中断，请重试。")); }
    this.pending.clear();
    if (worker) void worker.terminate();
  }
}

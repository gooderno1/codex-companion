import type { ActivityDetailsRequest, ActivityDetailsResponse, ActivityProject, ActivitySession, ActivitySlice, ActivityTotals } from "../shared/activityDetails";
import { UNATTRIBUTED_PROJECT } from "../shared/activityDetails";
import type { CodeActivity } from "../shared/contracts";
import { collectCodexData, type CodexSessionCache, type CodexTokenEvent, type CollectedCodexData } from "./collectors/codexCollector";
import { collectGitData, type CollectedGitData } from "./collectors/gitCollector";
import { emptyTokens, sumTokens } from "./collectors/metrics";
import { resolvePricingRate } from "./collectors/pricing";
import { SettingsStore } from "./state/settingsStore";
import { CodexSessionCacheStore } from "./state/codexSessionCacheStore";
import { runGit } from "./utils/git";

export function validateActivityRange(request: ActivityDetailsRequest, now = new Date()) {
  if (!request || (request.startAt !== null && typeof request.startAt !== "string") || typeof request.endAt !== "string") throw new Error("时间范围格式无效。");
  const start = request.startAt === null ? 0 : Date.parse(request.startAt);
  const requestedEnd = Date.parse(request.endAt);
  const end = Math.min(requestedEnd, now.getTime());
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) throw new Error("请选择有效日期，开始时间须早于结束时间，且不能完全位于未来。");
  return { startAt: request.startAt === null ? null : new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

function totals(): ActivityTotals {
  return { tokens: emptyTokens(), apiCostUsd: 0, events: 0, firstEventAt: null, lastEventAt: null, models: [], days: [] };
}
function addSlice(slices: ActivitySlice[], key: string, event: CodexTokenEvent) {
  let slice = slices.find(item => item.key === key);
  if (!slice) { slice = { key, tokens: emptyTokens(), apiCostUsd: 0, events: 0, priced: true }; slices.push(slice); }
  slice.tokens = sumTokens(slice.tokens, event.tokens);
  slice.apiCostUsd += event.apiCostUsd;
  slice.events++;
  slice.priced = slice.priced && resolvePricingRate(event.model) !== null;
}
function addEvent(target: ActivityTotals, event: CodexTokenEvent) {
  target.tokens = sumTokens(target.tokens, event.tokens);
  target.apiCostUsd += event.apiCostUsd;
  target.events++;
  if (!target.firstEventAt || Date.parse(event.timestamp) < Date.parse(target.firstEventAt)) target.firstEventAt = event.timestamp;
  if (!target.lastEventAt || Date.parse(event.timestamp) > Date.parse(target.lastEventAt)) target.lastEventAt = event.timestamp;
  const date = new Date(event.timestamp);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  addSlice(target.models, event.model, event);
  addSlice(target.days, day, event);
}

/** 仅输出结构化统计字段，按事件范围重新计量，不使用会话全量合计。 */
export function aggregateActivityDetails(codex: CollectedCodexData, git: CollectedGitData, range: ActivityDetailsResponse["range"], generatedAt: string): ActivityDetailsResponse {
  const projects = new Map<string, ActivityProject>(git.items.map(repo => [repo.id, { ...totals(), id: repo.id, name: repo.name, path: repo.path, sessions: 0, code: null }]));
  const sessions = new Map<string, ActivitySession>();
  const metadata = new Map(codex.sessions.map(session => [session.sessionId, session]));
  const start = range.startAt ? Date.parse(range.startAt) : 0, end = Date.parse(range.endAt);
  let firstEventAt: string | null = null, lastEventAt: string | null = null;
  for (const event of codex.events) {
    const at = Date.parse(event.timestamp);
    if (!Number.isFinite(at) || at > Date.parse(generatedAt)) continue;
    if (!firstEventAt || at < Date.parse(firstEventAt)) firstEventAt = event.timestamp;
    if (!lastEventAt || at > Date.parse(lastEventAt)) lastEventAt = event.timestamp;
    if (at < start || at >= end) continue;
    const projectId = git.sessionRepoMap.get(event.sessionId) ?? UNATTRIBUTED_PROJECT;
    if (!projects.has(projectId)) projects.set(projectId, { ...totals(), id: projectId, name: "未归因", path: null, sessions: 0, code: null });
    const project = projects.get(projectId)!;
    let session = sessions.get(event.sessionId);
    if (!session) {
      const meta = metadata.get(event.sessionId);
      session = { ...totals(), sessionId: event.sessionId, projectId, cwd: meta?.cwd ?? event.cwd, startedAt: meta?.startedAt ?? null };
      sessions.set(event.sessionId, session);
      project.sessions++;
    }
    addEvent(project, event);
    addEvent(session, event);
  }
  for (const item of [...projects.values(), ...sessions.values()]) {
    item.models.sort((a, b) => b.tokens.total - a.tokens.total);
    item.days.sort((a, b) => b.key.localeCompare(a.key));
  }
  return { generatedAt, range, coverage: { firstEventAt, lastEventAt, files: codex.sessionFilesScanned + codex.archivedFilesScanned }, projects: [...projects.values()], sessions: [...sessions.values()] };
}

export async function readActivityCode(repoPath: string, range: ActivityDetailsResponse["range"]): Promise<CodeActivity | null> {
  const args = ["log", "HEAD", `--since=${range.startAt ?? new Date(0).toISOString()}`, `--until=${new Date(Date.parse(range.endAt) - 1).toISOString()}`, "--numstat", "--format=tformat:COMMIT"];
  const output = await runGit(args, repoPath);
  if (output === null) return null;
  const code = { commits: 0, additions: 0, deletions: 0, changedLines: 0, net: 0 };
  for (const line of output.split(/\r?\n/)) {
    if (line === "COMMIT") code.commits++;
    const match = /^(\d+)\t(\d+)\t/.exec(line);
    if (match) { code.additions += Number(match[1]); code.deletions += Number(match[2]); }
  }
  code.changedLines = code.additions + code.deletions;
  code.net = code.additions - code.deletions;
  return code;
}

export class ActivityDetailsService {
  private parsedCache: CodexSessionCache | null = null;
  private pending: Promise<{ codex: CollectedCodexData; git: CollectedGitData; generatedAt: string }> | null = null;
  private loading = false;
  private loadedAt = 0;
  private settingsKey = "";
  constructor(private settings: SettingsStore, private standardCache: CodexSessionCacheStore) {}

  async query(request: ActivityDetailsRequest): Promise<ActivityDetailsResponse> {
    const range = validateActivityRange(request);
    const preferences = await this.settings.read();
    const key = JSON.stringify([preferences.codexHome, preferences.repoRoots]);
    if (!this.pending || key !== this.settingsKey || (!this.loading && (request.force || Date.now() - this.loadedAt > 5 * 60_000))) {
      this.settingsKey = key;
      this.loadedAt = Date.now();
      this.loading = true;
      const generatedAt = new Date(this.loadedAt).toISOString();
      const task = (async () => {
        const cache = this.parsedCache ?? await this.standardCache.read();
        const codex = await collectCodexData(new Date(generatedAt), {
          codexHome: preferences.codexHome, allHistory: true,
          sessionCacheStore: { read: async () => cache, write: async value => { this.parsedCache = value; } }
        });
        return { codex, git: await collectGitData({ repoRoots: preferences.repoRoots, sessions: codex.sessions }), generatedAt };
      })();
      this.pending = task;
      void task.then(() => { if (this.pending === task) this.loading = false; }, () => { if (this.pending === task) { this.pending = null; this.loading = false; } });
    }
    const { codex, git, generatedAt } = await this.pending;
    const result = aggregateActivityDetails(codex, git, range, generatedAt);
    await Promise.all(result.projects.map(async project => { if (project.path) project.code = await readActivityCode(project.path, range); }));
    return result;
  }
}

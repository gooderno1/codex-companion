import type { ActivityDetailsRequest, ActivityDetailsResponse, ActivityProject, ActivitySession, ActivitySlice, ActivityTotals } from "../shared/activityDetails";
import type { CodeActivity } from "../shared/contracts";
import { type CodexTokenEvent, type CollectedCodexData } from "./collectors/codexCollector";
import { readCodexProjects, projectForSession, type CodexProjectCatalog } from "./codexProjects";
import { ActivityIndex } from "./state/activityIndex";
import { emptyTokens, sumTokens } from "./collectors/metrics";
import { resolvePricingRate } from "./collectors/pricing";
import { SettingsStore } from "./state/settingsStore";
import { CodexSessionCacheStore } from "./state/codexSessionCacheStore";
import { findGitRoot, runGit } from "./utils/git";

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
export function aggregateActivityDetails(codex: Pick<CollectedCodexData, "events" | "sessions" | "sessionFilesScanned" | "archivedFilesScanned">, catalog: CodexProjectCatalog, range: ActivityDetailsResponse["range"], generatedAt: string): ActivityDetailsResponse {
  const projects = new Map<string, ActivityProject>(catalog.projects.map(project => [project.id, { ...totals(), id: project.id, name: project.name, path: project.rootPaths[0] ?? null, rootPaths: project.rootPaths, sessions: 0, code: null }]));
  const sessions = new Map<string, ActivitySession>();
  const metadata = new Map(codex.sessions.map(session => [session.sessionId, session]));
  const assignments = new Map(codex.sessions.map(session => [session.sessionId, projectForSession(catalog, session)]));
  const start = range.startAt ? Date.parse(range.startAt) : 0, end = Date.parse(range.endAt);
  let firstEventAt: string | null = null, lastEventAt: string | null = null;
  for (const event of codex.events) {
    const at = Date.parse(event.timestamp);
    if (!Number.isFinite(at) || at > Date.parse(generatedAt)) continue;
    if (!firstEventAt || at < Date.parse(firstEventAt)) firstEventAt = event.timestamp;
    if (!lastEventAt || at > Date.parse(lastEventAt)) lastEventAt = event.timestamp;
    if (at < start || at >= end) continue;
    let projectId = assignments.get(event.sessionId);
    if (!projectId) { projectId = projectForSession(catalog, event); assignments.set(event.sessionId, projectId); }
    if (!projects.has(projectId)) projects.set(projectId, { ...totals(), id: projectId, name: "无项目 / 未匹配", path: null, rootPaths: [], sessions: 0, code: null });
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
  private indexes = new Map<string, ActivityIndex>();
  private codeCache = new Map<string, { at: number; result: import("../shared/activityDetails").ActivityCodeResponse }>();
  constructor(private settings: SettingsStore, private standardCache: CodexSessionCacheStore, private directory = standardCache.storageDirectory) {}
  async query(request: ActivityDetailsRequest): Promise<ActivityDetailsResponse> {
    const started = performance.now();
    const range = validateActivityRange(request);
    const preferences = await this.settings.read();
    let index = this.indexes.get(preferences.codexHome);
    if (!index) { index = new ActivityIndex(this.directory, preferences.codexHome, this.standardCache); this.indexes.set(preferences.codexHome, index); }
    const [stats, catalog] = await Promise.all([index.refresh(), readCodexProjects(preferences.codexHome)]);
    const indexedAt = performance.now();
    const codex = await index.query(range);
    const result = aggregateActivityDetails(codex, catalog, range, new Date().toISOString());
    result.coverage = codex.coverage;
    result.warnings = catalog.warnings;
    result.performance = { ...stats, indexMs: Math.round(indexedAt - started), queryMs: Math.round(performance.now() - indexedAt) };
    return result;
  }
  async queryCode(request: ActivityDetailsRequest & { projectId: string }): Promise<import("../shared/activityDetails").ActivityCodeResponse> {
    const range = validateActivityRange(request);
    const preferences = await this.settings.read();
    const catalog = await readCodexProjects(preferences.codexHome);
    const project = catalog.projects.find(item => item.id === request.projectId);
    if (!project) throw new Error("Codex 项目不存在，请重新读取项目清单。");
    const key = JSON.stringify([preferences.codexHome, project, range]);
    const cached = this.codeCache.get(key);
    if (!request.force && cached && Date.now() - cached.at < 60_000) return cached.result;
    const roots = [...new Set((await Promise.all(project.rootPaths.map(root => findGitRoot(root)))).filter((root): root is string => Boolean(root)))];
    const repositories = await Promise.all(roots.map(async root => ({ path: root, code: await readActivityCode(root, range) })));
    const result = { repositories };
    if (this.codeCache.size > 100) this.codeCache.clear();
    this.codeCache.set(key, { at: Date.now(), result });
    return result;
  }
  close() { for (const index of this.indexes.values()) index.close(); this.indexes.clear(); }
}

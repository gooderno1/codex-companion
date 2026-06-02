import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import type { SourceStatus, TokenBreakdown } from "../../shared/contracts";
import { walkFiles } from "../utils/fs";
import { startOfMonth, startOfWeek, subtractDays } from "../utils/time";
import { estimateApiCostUsd, estimateCodexCredits } from "./pricing";
import { emptyTokens, roundTo, sumTokens } from "./metrics";

export interface ObservedLimitWindow {
  usedPercent: number | null;
  windowMinutes: number | null;
  resetsAt: string | null;
}

export interface LatestRateSnapshot {
  observedAt: string;
  primary: ObservedLimitWindow | null;
  secondary: ObservedLimitWindow | null;
  planType: string | null;
}

export interface CodexTokenEvent {
  sessionId: string;
  timestamp: string;
  cwd: string | null;
  model: string;
  tokens: TokenBreakdown;
  apiCostUsd: number;
  creditsEstimate: number;
}

export interface CodexSessionSummary {
  sessionId: string;
  cwd: string | null;
  startedAt: string | null;
  lastEventAt: string | null;
  tokens: TokenBreakdown;
  apiCostUsd: number;
  creditsEstimate: number;
  dominantModel: string;
}

export interface CollectedCodexData {
  codexHome: string;
  sessionFilesScanned: number;
  archivedFilesScanned: number;
  events: CodexTokenEvent[];
  sessions: CodexSessionSummary[];
  latestRateSnapshot: LatestRateSnapshot | null;
  lastObservedAt: string | null;
  sourceStatus: SourceStatus;
  notes: string[];
}

interface SessionParseResult {
  events: CodexTokenEvent[];
  session: CodexSessionSummary | null;
  latestRateSnapshot: LatestRateSnapshot | null;
}

function resolveCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function parseTokenBreakdown(payload: Record<string, unknown> | undefined): TokenBreakdown {
  return {
    input: Number(payload?.input_tokens ?? 0),
    cachedInput: Number(payload?.cached_input_tokens ?? 0),
    output: Number(payload?.output_tokens ?? 0),
    reasoningOutput: Number(payload?.reasoning_output_tokens ?? 0),
    total: Number(payload?.total_tokens ?? 0)
  };
}

function extractApproxDate(filePath: string): Date | null {
  const folderMatch = filePath.match(
    /[\\/]sessions[\\/](\d{4})[\\/](\d{2})[\\/](\d{2})[\\/]/
  );
  if (folderMatch) {
    return new Date(
      Number(folderMatch[1]),
      Number(folderMatch[2]) - 1,
      Number(folderMatch[3]),
      0,
      0,
      0,
      0
    );
  }

  const fileMatch = filePath.match(/rollout-(\d{4})-(\d{2})-(\d{2})T/);
  if (fileMatch) {
    return new Date(
      Number(fileMatch[1]),
      Number(fileMatch[2]) - 1,
      Number(fileMatch[3]),
      0,
      0,
      0,
      0
    );
  }

  return null;
}

function shouldIncludeFile(filePath: string, cutoff: Date): boolean {
  if (!filePath.endsWith(".jsonl")) {
    return false;
  }

  const approximateDate = extractApproxDate(filePath);
  if (!approximateDate) {
    return true;
  }

  return approximateDate >= cutoff;
}

function compareIso(left: string | null, right: string | null): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return -1;
  }

  if (!right) {
    return 1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

function normalizeRateSnapshot(
  timestamp: string,
  rateLimits: Record<string, unknown> | undefined
): LatestRateSnapshot | null {
  if (!rateLimits) {
    return null;
  }

  const primary = rateLimits.primary as Record<string, unknown> | undefined;
  const secondary = rateLimits.secondary as Record<string, unknown> | undefined;

  if (!primary && !secondary) {
    return null;
  }

  return {
    observedAt: timestamp,
    primary: primary
      ? {
          usedPercent: Number(primary.used_percent ?? 0),
          windowMinutes: Number(primary.window_minutes ?? 0) || null,
          resetsAt:
            typeof primary.resets_at === "number"
              ? new Date(primary.resets_at * 1000).toISOString()
              : null
        }
      : null,
    secondary: secondary
      ? {
          usedPercent: Number(secondary.used_percent ?? 0),
          windowMinutes: Number(secondary.window_minutes ?? 0) || null,
          resetsAt:
            typeof secondary.resets_at === "number"
              ? new Date(secondary.resets_at * 1000).toISOString()
              : null
        }
      : null,
    planType:
      typeof rateLimits.plan_type === "string" ? rateLimits.plan_type : null
  };
}

async function parseSessionFile(filePath: string): Promise<SessionParseResult> {
  const fileName = path.basename(filePath, ".jsonl");
  const events: CodexTokenEvent[] = [];
  let sessionId = fileName;
  let cwd: string | null = null;
  let startedAt: string | null = null;
  let lastEventAt: string | null = null;
  let currentModel = "unknown";
  let tokens = emptyTokens();
  let apiCostUsd = 0;
  let creditsEstimate = 0;
  let latestRateSnapshot: LatestRateSnapshot | null = null;
  const modelTokenTotals = new Map<string, number>();

  const stream = createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY
  });

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = parsed.type;
    const payload = parsed.payload as Record<string, unknown> | undefined;

    if (type === "session_meta" && payload) {
      sessionId =
        typeof payload.id === "string" && payload.id.trim()
          ? payload.id
          : sessionId;
      cwd = typeof payload.cwd === "string" ? payload.cwd : cwd;
      startedAt = typeof payload.timestamp === "string" ? payload.timestamp : startedAt;
      continue;
    }

    if (type === "turn_context" && payload) {
      currentModel = typeof payload.model === "string" ? payload.model : currentModel;
      cwd = typeof payload.cwd === "string" ? payload.cwd : cwd;
      continue;
    }

    if (type !== "event_msg" || !payload || payload.type !== "token_count") {
      continue;
    }

    const timestamp =
      typeof parsed.timestamp === "string" ? parsed.timestamp : startedAt;
    if (!timestamp) {
      continue;
    }

    const info = payload.info as Record<string, unknown> | undefined;
    const usage =
      (info?.last_token_usage as Record<string, unknown> | undefined) ??
      (info?.total_token_usage as Record<string, unknown> | undefined);
    const tokenBreakdown = parseTokenBreakdown(usage);
    if (tokenBreakdown.total <= 0) {
      continue;
    }

    const model = currentModel;
    const eventApiCost = roundTo(estimateApiCostUsd(model, tokenBreakdown), 6);
    const eventCredits = roundTo(estimateCodexCredits(model, tokenBreakdown), 6);
    events.push({
      sessionId,
      timestamp,
      cwd,
      model,
      tokens: tokenBreakdown,
      apiCostUsd: eventApiCost,
      creditsEstimate: eventCredits
    });

    tokens = sumTokens(tokens, tokenBreakdown);
    apiCostUsd += eventApiCost;
    creditsEstimate += eventCredits;
    lastEventAt = timestamp;
    modelTokenTotals.set(
      model,
      (modelTokenTotals.get(model) ?? 0) + tokenBreakdown.total
    );

    const snapshot = normalizeRateSnapshot(
      timestamp,
      payload.rate_limits as Record<string, unknown> | undefined
    );
    if (
      snapshot &&
      (!latestRateSnapshot ||
        compareIso(snapshot.observedAt, latestRateSnapshot.observedAt) > 0)
    ) {
      latestRateSnapshot = snapshot;
    }
  }

  stream.close();

  if (events.length === 0 && !startedAt) {
    return {
      events,
      session: null,
      latestRateSnapshot
    };
  }

  let dominantModel = "unknown";
  let maxTokens = -1;
  for (const [model, totalTokens] of modelTokenTotals.entries()) {
    if (totalTokens > maxTokens) {
      dominantModel = model;
      maxTokens = totalTokens;
    }
  }

  return {
    events,
    session: {
      sessionId,
      cwd,
      startedAt,
      lastEventAt,
      tokens,
      apiCostUsd: roundTo(apiCostUsd, 6),
      creditsEstimate: roundTo(creditsEstimate, 6),
      dominantModel
    },
    latestRateSnapshot
  };
}

function inferSourceStatus(
  fileCount: number,
  eventCount: number,
  lastObservedAt: string | null,
  now: Date
): SourceStatus {
  if (eventCount === 0) {
    return fileCount > 0 ? "pending" : "unobserved";
  }

  if (!lastObservedAt) {
    return "pending";
  }

  const ageMinutes =
    (now.getTime() - new Date(lastObservedAt).getTime()) / 60_000;
  return ageMinutes > 45 ? "stale" : "observed";
}

export async function collectCodexData(
  now = new Date()
): Promise<CollectedCodexData> {
  const codexHome = resolveCodexHome();
  const sessionsRoot = path.join(codexHome, "sessions");
  const archivedRoot = path.join(codexHome, "archived_sessions");
  const cutoff = new Date(
    Math.min(
      startOfMonth(now).getTime(),
      startOfWeek(now).getTime(),
      subtractDays(now, 8).getTime()
    )
  );
  const ignoreDirectories = new Set<string>([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "coverage"
  ]);

  const [sessionFiles, archivedFiles] = await Promise.all([
    walkFiles(sessionsRoot, {
      maxDepth: 4,
      include: (filePath) => shouldIncludeFile(filePath, cutoff),
      ignoreDirectories
    }),
    walkFiles(archivedRoot, {
      maxDepth: 1,
      include: (filePath) => shouldIncludeFile(filePath, cutoff),
      ignoreDirectories
    })
  ]);

  const selectedFiles = [...sessionFiles, ...archivedFiles];
  const results = await Promise.all(
    selectedFiles.map((filePath) => parseSessionFile(filePath))
  );

  const events: CodexTokenEvent[] = [];
  const sessions: CodexSessionSummary[] = [];
  let latestRateSnapshot: LatestRateSnapshot | null = null;
  let lastObservedAt: string | null = null;

  for (const result of results) {
    events.push(...result.events);
    if (result.session) {
      sessions.push(result.session);
      if (compareIso(result.session.lastEventAt, lastObservedAt) > 0) {
        lastObservedAt = result.session.lastEventAt;
      }
    }

    if (
      result.latestRateSnapshot &&
      (!latestRateSnapshot ||
        compareIso(
          result.latestRateSnapshot.observedAt,
          latestRateSnapshot.observedAt
        ) > 0)
    ) {
      latestRateSnapshot = result.latestRateSnapshot;
    }
  }

  const notes: string[] = [];
  const sourceStatus = inferSourceStatus(
    selectedFiles.length,
    events.length,
    lastObservedAt,
    now
  );

  if (sourceStatus === "unobserved") {
    notes.push("未找到可解析的 Codex 会话文件。");
  }

  if (sourceStatus === "pending") {
    notes.push("已发现会话文件，但最近窗口内没有可用 token_count 记录。");
  }

  if (sourceStatus === "stale" && lastObservedAt) {
    notes.push(`最新可观测 token 事件停留在 ${lastObservedAt}。`);
  }

  if (!latestRateSnapshot) {
    notes.push("当前未观测到可用的 rate_limits 快照，月额度卡片将保持未观测状态。");
  }

  return {
    codexHome,
    sessionFilesScanned: sessionFiles.length,
    archivedFilesScanned: archivedFiles.length,
    events,
    sessions,
    latestRateSnapshot,
    lastObservedAt,
    sourceStatus,
    notes
  };
}

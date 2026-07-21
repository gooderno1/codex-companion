import type {
  AppPreferences,
  BankedResetCreditObservation,
  BankedResetCreditRateLimitSnapshot,
  BankedResetCreditsSummary,
  DashboardSnapshot,
  LedgerAnalysisPeriod,
  LedgerTimeBucket,
  LimitWindow,
  OverviewProjectItem,
  PeriodMetric,
  QuotaResetEvent,
  QuotaUsageSegment,
  RefreshHistoryEntry,
  RefreshTelemetry,
  RefreshTrigger,
  SessionAttribution,
  SourceStatus,
  WidgetMetric
} from "../../shared/contracts";
import {
  analyzeQuotaObservations,
  analyzeBankedResetCreditObservations,
  classifyCodexQuotaWindowDuration,
  CODEX_FIVE_HOUR_WINDOW_MINUTES,
  CODEX_WEEKLY_WINDOW_MINUTES,
  createBankedResetCreditObservationFromSnapshot,
  DEFAULT_BANKED_RESET_CREDIT_PUBLIC_GRANT_SEEDS,
  readCodexAccountRateLimits,
  type BankedResetCreditInitialGrantSeed,
  type BankedResetCreditObservation as CoreBankedResetCreditObservation,
  type CodexRateLimitSnapshot,
  type CodexQuotaWindowKind,
  type QuotaCycleObservation
} from "@lifeinhand/codex-usage-core";
import { SnapshotStore } from "../state/snapshotStore";
import { SettingsStore } from "../state/settingsStore";
import {
  addMinutes,
  startOfBillingMonth,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "../utils/time";
import {
  collectCodexData,
  type CodexSessionCacheStoreLike,
  type CodexTokenEvent,
  type CodexSessionSummary,
  type LatestRateSnapshot,
  type ObservedLimitWindow,
  type QuotaObservation
} from "./codexCollector";
import { collectGitData } from "./gitCollector";
import {
  API_RATE_SOURCE,
  CODEX_RATE_SOURCE
} from "./pricing";
import {
  emptyCodeActivity,
  emptyTokens,
  roundTo,
  sumCodeActivity,
  sumTokens
} from "./metrics";

function clampPercentage(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, roundTo(value, 2)));
}

const QUOTA_RESET_BOUNDARY_SNAP_WINDOW_MS = 5 * 60 * 1000;
const DAY_MINUTES = 24 * 60;
const BANKED_RESET_OBSERVATION_HISTORY_LIMIT = 160;
const BANKED_RESET_INITIAL_GRANT_SEEDS: BankedResetCreditInitialGrantSeed[] = [
  {
    id: "codex-companion-assumed-first-banked-reset-2026-06-14",
    acquiredAt: "2026-06-14T00:00:00.000Z",
    sourceId: "user-confirmed-assumption",
    estimateBasis: "assumed-grant"
  },
  {
    id: "codex-companion-observed-banked-reset-2026-07-01",
    acquiredAt: "2026-07-01T19:58:24.705Z",
    sourceId: "codex-companion-v0.3.2-dev.2-local-observation",
    estimateBasis: "observed-grant"
  }
];
const BANKED_RESET_CORE_ANALYSIS_OPTIONS = {
  validityDays: 30,
  expirationSafetyMarginDays: 1,
  publicGrantSeeds: DEFAULT_BANKED_RESET_CREDIT_PUBLIC_GRANT_SEEDS,
  initialGrantSeeds: BANKED_RESET_INITIAL_GRANT_SEEDS
};

interface CollectDashboardSnapshotOptions {
  codexSessionCacheStore?: CodexSessionCacheStoreLike;
  trigger?: RefreshTrigger;
  refreshHistory?: RefreshHistoryEntry[];
  previousBankedResetCredits?: BankedResetCreditsSummary | null;
}

function emptyBankedResetCreditsSummary(sourceStatus: SourceStatus, note: string | null): BankedResetCreditsSummary {
  return {
    sourceStatus,
    observedAt: null,
    availableCount: null,
    inferredGrantCount: 0,
    inferredUseCount: 0,
    inferredExpirationCount: 0,
    inferredUnknownDecreaseCount: 0,
    nextEstimatedExpiresAt: null,
    nextSafeEstimatedExpiresAt: null,
    nextExpiresAt: null,
    nextExpiryBasis: null,
    officialDetailCount: 0,
    officialDetailsComplete: false,
    activeCredits: [],
    events: [],
    observations: [],
    note
  };
}

function sanitizeBankedResetWindow(
  windowInfo: CodexRateLimitSnapshot["primary"]
): BankedResetCreditRateLimitSnapshot["primary"] {
  if (!windowInfo) {
    return null;
  }

  return {
    usedPercent: windowInfo.usedPercent,
    windowDurationMins: windowInfo.windowDurationMins,
    resetsAt: windowInfo.resetsAt,
    resetsAtUnixSeconds: windowInfo.resetsAtUnixSeconds ?? null
  };
}

function sanitizeBankedResetRateLimitSnapshot(
  snapshot: CodexRateLimitSnapshot | null | undefined
): BankedResetCreditRateLimitSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    limitId: snapshot.limitId,
    limitName: snapshot.limitName,
    planType: snapshot.planType,
    primary: sanitizeBankedResetWindow(snapshot.primary),
    secondary: sanitizeBankedResetWindow(snapshot.secondary),
    credits: null,
    rateLimitReachedType: snapshot.rateLimitReachedType
  };
}

function sanitizeBankedResetObservation(
  observation: CoreBankedResetCreditObservation
): BankedResetCreditObservation {
  return {
    observedAt: observation.observedAt,
    availableCount: observation.availableCount,
    officialCredits: observation.officialCredits ?? null,
    rateLimits: sanitizeBankedResetRateLimitSnapshot(observation.rateLimits),
    rateLimitsByLimitId: observation.rateLimitsByLimitId
      ? Object.fromEntries(
          Object.entries(observation.rateLimitsByLimitId)
            .map(([limitId, snapshot]) => [limitId, sanitizeBankedResetRateLimitSnapshot(snapshot)] as const)
            .filter((entry): entry is readonly [string, BankedResetCreditRateLimitSnapshot] => entry[1] !== null)
        )
      : null,
    sourceId: observation.sourceId ?? null
  };
}

function normalizeBankedResetObservationHistory(
  observations: BankedResetCreditObservation[]
): BankedResetCreditObservation[] {
  const deduped = new Map<string, BankedResetCreditObservation>();
  for (const observation of observations) {
    const observedMs = new Date(observation.observedAt).getTime();
    if (!Number.isFinite(observedMs) || !Number.isFinite(observation.availableCount)) {
      continue;
    }

    const key = `${observation.observedAt}:${observation.availableCount}:${observation.sourceId ?? ""}`;
    deduped.set(key, observation);
  }

  return [...deduped.values()]
    .sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime())
    .slice(-BANKED_RESET_OBSERVATION_HISTORY_LIMIT);
}

async function collectBankedResetCreditsSummary(
  previousSummary: BankedResetCreditsSummary | null = null
): Promise<BankedResetCreditsSummary> {
  const previousObservations = previousSummary?.observations ?? [];
  const history = normalizeBankedResetObservationHistory(previousObservations);
  const activeCreditBaseline =
    previousSummary?.observedAt && previousSummary.activeCredits.length > 0
      ? {
          observedAt: previousSummary.observedAt,
          activeCredits: previousSummary.activeCredits
        }
      : undefined;

  try {
    const snapshot = await readCodexAccountRateLimits({
      clientName: "codex-companion",
      clientVersion: "0.4.1"
    });
    const currentObservation = sanitizeBankedResetObservation(
      createBankedResetCreditObservationFromSnapshot(snapshot, "codex-app-server")
    );
    const observations = normalizeBankedResetObservationHistory([...history, currentObservation]);
    const analysis = analyzeBankedResetCreditObservations(
      observations,
      {
        ...BANKED_RESET_CORE_ANALYSIS_OPTIONS,
        activeCreditBaseline
      }
    );

    return {
      sourceStatus: "observed",
      observedAt: currentObservation.observedAt,
      availableCount: analysis.currentAvailableCount,
      inferredGrantCount: analysis.inferredGrantCount,
      inferredUseCount: analysis.inferredUseCount,
      inferredExpirationCount: analysis.inferredExpirationCount,
      inferredUnknownDecreaseCount: analysis.inferredUnknownDecreaseCount,
      nextEstimatedExpiresAt: analysis.nextEstimatedExpiresAt,
      nextSafeEstimatedExpiresAt: analysis.nextSafeEstimatedExpiresAt,
      nextExpiresAt: analysis.nextExpiresAt,
      nextExpiryBasis: analysis.nextExpiryBasis,
      officialDetailCount: analysis.officialDetailCount,
      officialDetailsComplete: analysis.officialDetailsComplete,
      activeCredits: analysis.activeCredits,
      events: analysis.events.map((event) => ({
        kind: event.kind,
        at: event.at,
        count: event.count,
        beforeAvailableCount: event.beforeAvailableCount,
        afterAvailableCount: event.afterAvailableCount,
        estimatedExpiresAt: event.estimatedExpiresAt ?? null,
        sourceId: event.sourceId ?? null,
        affectedLimitIds: event.evidence.affectedLimitIds
      })),
      observations,
      note: analysis.officialDetailCount > 0
        ? analysis.officialDetailsComplete
          ? "到期时间来自 Codex 官方逐笔明细。"
          : `Codex 官方返回 ${analysis.officialDetailCount} 条逐笔明细；可用总数仍以 availableCount 为准，其余库存继续使用估算回退。`
        : analysis.activeCredits.some((credit) => credit.estimateBasis === "existing-at-first-observation")
          ? "首次观测前仍有未匹配的赠送重置无法反推获取时间；已确认初始、公开发放或后续观测获得的次数按 30 天有效期估算。"
          : "过期时间按 6 月 14 日假定时间、公开发放时间或获得观测时间加 30 天估算，并提前 1 天提醒。"
    };
  } catch (error) {
    if (history.length > 0) {
      const analysis = analyzeBankedResetCreditObservations(
        history,
        {
          ...BANKED_RESET_CORE_ANALYSIS_OPTIONS,
          activeCreditBaseline
        }
      );
      const latest = history.at(-1) ?? null;

      return {
        sourceStatus: "stale",
        observedAt: latest?.observedAt ?? null,
        availableCount: analysis.currentAvailableCount,
        inferredGrantCount: analysis.inferredGrantCount,
        inferredUseCount: analysis.inferredUseCount,
        inferredExpirationCount: analysis.inferredExpirationCount,
        inferredUnknownDecreaseCount: analysis.inferredUnknownDecreaseCount,
        nextEstimatedExpiresAt: analysis.nextEstimatedExpiresAt,
        nextSafeEstimatedExpiresAt: analysis.nextSafeEstimatedExpiresAt,
        nextExpiresAt: analysis.nextExpiresAt,
        nextExpiryBasis: analysis.nextExpiryBasis,
        officialDetailCount: analysis.officialDetailCount,
        officialDetailsComplete: analysis.officialDetailsComplete,
        activeCredits: analysis.activeCredits,
        events: analysis.events.map((event) => ({
          kind: event.kind,
          at: event.at,
          count: event.count,
          beforeAvailableCount: event.beforeAvailableCount,
          afterAvailableCount: event.afterAvailableCount,
          estimatedExpiresAt: event.estimatedExpiresAt ?? null,
          sourceId: event.sourceId ?? null,
          affectedLimitIds: event.evidence.affectedLimitIds
        })),
        observations: history,
        note: `本轮读取 Codex app-server 失败，显示上次观测：${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }

    return emptyBankedResetCreditsSummary(
      "unobserved",
      `未能读取 Codex app-server banked reset：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function emptyRefreshTelemetry(
  startedAt: string | null = null,
  trigger: RefreshTrigger = "background"
): RefreshTelemetry {
  return {
    trigger,
    startedAt,
    completedAt: null,
    durationMs: null,
    codexDurationMs: null,
    gitDurationMs: null,
    codexFilesTotal: 0,
    codexFilesParsed: 0,
    codexFilesReused: 0,
    codexCachePruned: 0
  };
}

function ensureRefreshTelemetry(snapshot: DashboardSnapshot): DashboardSnapshot {
  const sourceHealth = snapshot.sourceHealth as DashboardSnapshot["sourceHealth"] & {
    refresh?: RefreshTelemetry;
    refreshHistory?: RefreshHistoryEntry[];
  };
  const overview = snapshot.overview as DashboardSnapshot["overview"] & {
    bankedResetCredits?: BankedResetCreditsSummary;
  };

  if (sourceHealth.refresh && sourceHealth.refreshHistory && overview.bankedResetCredits) {
    return snapshot;
  }

  return {
    ...snapshot,
    sourceHealth: {
      ...snapshot.sourceHealth,
      refresh: sourceHealth.refresh ?? {
        ...emptyRefreshTelemetry(null),
        completedAt: snapshot.generatedAt
      },
      refreshHistory: sourceHealth.refreshHistory ?? []
    },
    overview: {
      ...snapshot.overview,
      bankedResetCredits:
        overview.bankedResetCredits ??
        emptyBankedResetCreditsSummary("unobserved", "旧缓存没有赠送重置观测，请刷新。")
    }
  };
}

function buildRefreshHistoryEntry(
  snapshot: DashboardSnapshot,
  message: string | null = null
): RefreshHistoryEntry {
  const refresh = snapshot.sourceHealth.refresh;
  const completedAt =
    refresh.completedAt ?? snapshot.generatedAt ?? new Date().toISOString();

  return {
    id: `${completedAt}-${refresh.trigger}-${snapshot.generatedFrom}`,
    trigger: refresh.trigger,
    generatedFrom: snapshot.generatedFrom,
    sourceStatus: snapshot.sourceHealth.sourceStatus,
    completedAt,
    durationMs: refresh.durationMs,
    codexDurationMs: refresh.codexDurationMs,
    gitDurationMs: refresh.gitDurationMs,
    codexFilesTotal: refresh.codexFilesTotal,
    codexFilesParsed: refresh.codexFilesParsed,
    codexFilesReused: refresh.codexFilesReused,
    codexCachePruned: refresh.codexCachePruned,
    message
  };
}

function appendRefreshHistory(
  snapshot: DashboardSnapshot,
  previousHistory: RefreshHistoryEntry[],
  message: string | null = null
): DashboardSnapshot {
  return {
    ...snapshot,
    sourceHealth: {
      ...snapshot.sourceHealth,
      refreshHistory: [
        buildRefreshHistoryEntry(snapshot, message),
        ...previousHistory
      ].slice(0, 30)
    }
  };
}

interface QuotaCycleMetric {
  cycleKey: string;
  startAt: string;
  endAt: string;
  tokens: ReturnType<typeof emptyTokens>;
  sessions: number;
  apiCostUsd: number;
  creditsEstimate: number;
  usedPercent: number | null;
  remainingPercent: number | null;
  maxObservedUsedPercent: number | null;
  lastObservedAt: string | null;
  resetCount: number;
  observations: number;
  resetEvents: QuotaResetEvent[];
  usageSegments: QuotaUsageSegment[];
}

interface QuotaWindowUsage {
  currentCycle: QuotaCycleMetric | null;
  cycles: QuotaCycleMetric[];
}

interface QuotaCycleBounds {
  key: string;
  startAt: string;
  endAt: string;
  scheduledEndAt?: string;
  startedByResetAt?: string | null;
  closedByReset?: boolean;
  closedByResetAt?: string | null;
  closingResetEvent?: QuotaResetEvent | null;
}

interface QuotaCycleBucket {
  cycleKey: string;
  startAt: string;
  endAt: string;
  tokens: ReturnType<typeof emptyTokens>;
  apiCostUsd: number;
  creditsEstimate: number;
  sessionIds: Set<string>;
  observations: QuotaCycleObservation[];
  boundaryResetEvents: QuotaResetEvent[];
  maxObservedUsedPercent: number | null;
  lastObservedAt: string | null;
  lastObservedUsedPercent: number | null;
}

type NormalizedQuotaResetEvent = QuotaResetEvent & {
  boundaryAt: string;
  afterCycleStartAt: string;
  afterCycleEndAt: string;
};

function getObservedWindow(
  snapshot: LatestRateSnapshot | null,
  windowKey: "primary" | "secondary"
): ObservedLimitWindow | null {
  return windowKey === "primary" ? snapshot?.primary ?? null : snapshot?.secondary ?? null;
}

type ObservableQuotaWindowKind = Exclude<CodexQuotaWindowKind, "unknown">;

interface ObservedWindowSelection {
  windowKey: "primary" | "secondary";
  window: ObservedLimitWindow;
}

function getObservedWindowByKind(
  snapshot: LatestRateSnapshot | null,
  windowKind: ObservableQuotaWindowKind
): ObservedWindowSelection | null {
  for (const windowKey of ["primary", "secondary"] as const) {
    const window = getObservedWindow(snapshot, windowKey);
    if (window && classifyCodexQuotaWindowDuration(window.windowMinutes) === windowKind) {
      return { windowKey, window };
    }
  }

  return null;
}

function isSameQuotaPool(
  left: LatestRateSnapshot,
  right: LatestRateSnapshot | null
): boolean {
  if (!right) {
    return true;
  }

  if (left.limitId || right.limitId) {
    return left.limitId === right.limitId;
  }

  if (left.limitName || right.limitName) {
    return left.limitName === right.limitName;
  }

  return true;
}

function isUsableQuotaWindow(
  windowInfo: ObservedLimitWindow | null
) {
  const windowMinutes = Number(windowInfo?.windowMinutes ?? 0);
  return Number.isFinite(windowMinutes) && windowMinutes > 0 && Boolean(windowInfo?.resetsAt);
}

function resolveQuotaCycleBounds(
  timestamp: string,
  anchorEndAt: string,
  windowMinutes: number
): QuotaCycleBounds | null {
  const timestampMs = new Date(timestamp).getTime();
  const anchorEndMs = new Date(anchorEndAt).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  if (!Number.isFinite(timestampMs) || !Number.isFinite(anchorEndMs) || windowMs <= 0) {
    return null;
  }

  const cycleIndex = Math.floor((timestampMs - anchorEndMs) / windowMs) + 1;
  const endMs = anchorEndMs + cycleIndex * windowMs;
  const startMs = endMs - windowMs;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(endMs).toISOString();

  return {
    key: `${startAt}/${endAt}`,
    startAt,
    endAt
  };
}

function toIsoStringOrNull(value: number) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function normalizeQuotaResetBoundary(
  event: QuotaResetEvent,
  windowMinutes: number,
  currentWindow: ObservedLimitWindow
): NormalizedQuotaResetEvent | null {
  const windowMs = Number(windowMinutes) * 60 * 1000;
  const afterWindowEndMs = new Date(event.afterWindowResetsAt ?? 0).getTime();
  const currentWindowEndMs = new Date(currentWindow.resetsAt ?? 0).getTime();
  const currentWindowStartMs = currentWindowEndMs - windowMs;
  const fallbackBoundaryMs = new Date(event.at).getTime();
  let boundaryMs =
    Number.isFinite(afterWindowEndMs) && windowMs > 0
      ? afterWindowEndMs - windowMs
      : fallbackBoundaryMs;
  let afterCycleEndMs =
    Number.isFinite(afterWindowEndMs) && windowMs > 0
      ? afterWindowEndMs
      : boundaryMs + windowMs;

  if (
    Number.isFinite(currentWindowStartMs) &&
    Number.isFinite(boundaryMs) &&
    Math.abs(boundaryMs - currentWindowStartMs) <= QUOTA_RESET_BOUNDARY_SNAP_WINDOW_MS
  ) {
    boundaryMs = currentWindowStartMs;
    afterCycleEndMs = currentWindowEndMs;
  }

  const boundaryAt = toIsoStringOrNull(boundaryMs);
  const afterCycleEndAt =
    toIsoStringOrNull(afterCycleEndMs) ?? event.afterWindowResetsAt ?? null;

  if (!boundaryAt || !afterCycleEndAt) {
    return null;
  }

  return {
    ...event,
    boundaryAt,
    afterCycleStartAt: boundaryAt,
    afterCycleEndAt
  };
}

function normalizeQuotaResetBoundaries(
  resetEvents: QuotaResetEvent[],
  windowMinutes: number,
  currentWindow: ObservedLimitWindow
) {
  const normalizedEvents = resetEvents
    .map((event) => normalizeQuotaResetBoundary(event, windowMinutes, currentWindow))
    .filter((event): event is NormalizedQuotaResetEvent => Boolean(event))
    .sort((left, right) => new Date(left.boundaryAt).getTime() - new Date(right.boundaryAt).getTime());

  const merged: NormalizedQuotaResetEvent[] = [];
  for (const event of normalizedEvents) {
    const duplicateIndex = merged.findIndex((item) => item.boundaryAt === event.boundaryAt);
    if (duplicateIndex < 0) {
      merged.push(event);
      continue;
    }

    const previous = merged[duplicateIndex];
    const shouldReplace =
      event.beforeUsedPercent > previous.beforeUsedPercent ||
      (event.beforeUsedPercent === previous.beforeUsedPercent &&
        new Date(event.at).getTime() < new Date(previous.at).getTime());

    if (shouldReplace) {
      merged[duplicateIndex] = event;
    }
  }

  return merged;
}

function resolveResetAwareQuotaCycleBounds(
  timestamp: string,
  currentWindow: ObservedLimitWindow,
  resetEvents: NormalizedQuotaResetEvent[]
): QuotaCycleBounds | null {
  const timestampMs = new Date(timestamp).getTime();
  const windowMinutes = Number(currentWindow.windowMinutes ?? 0);
  const windowMs = windowMinutes * 60 * 1000;

  if (!Number.isFinite(timestampMs) || !Number.isFinite(windowMs) || windowMs <= 0) {
    return null;
  }

  const normalizedResetEvents = resetEvents
    .map((event) => ({
      ...event,
      boundaryMs: new Date(event.boundaryAt).getTime(),
      afterCycleEndMs: new Date(event.afterCycleEndAt).getTime()
    }))
    .filter((event) => Number.isFinite(event.boundaryMs) && Number.isFinite(event.afterCycleEndMs))
    .sort((left, right) => left.boundaryMs - right.boundaryMs);

  if (normalizedResetEvents.length === 0) {
    return resolveQuotaCycleBounds(
      timestamp,
      currentWindow.resetsAt as string,
      currentWindow.windowMinutes as number
    );
  }

  let baseBounds: QuotaCycleBounds | null;
  let previousResetIndex = -1;
  for (let index = 0; index < normalizedResetEvents.length; index += 1) {
    if (normalizedResetEvents[index].boundaryMs <= timestampMs) {
      previousResetIndex = index;
    } else {
      break;
    }
  }

  if (previousResetIndex >= 0) {
    const previousReset = normalizedResetEvents[previousResetIndex];
    if (timestampMs < previousReset.afterCycleEndMs) {
      baseBounds = {
        key: `${previousReset.boundaryAt}/${previousReset.afterCycleEndAt}`,
        startAt: previousReset.boundaryAt,
        endAt: previousReset.afterCycleEndAt,
        scheduledEndAt: previousReset.afterCycleEndAt,
        startedByResetAt: previousReset.at
      };
    } else {
      baseBounds = resolveQuotaCycleBounds(
        timestamp,
        previousReset.afterCycleEndAt,
        windowMinutes
      );
    }
  } else {
    const firstReset = normalizedResetEvents[0];
    baseBounds = resolveQuotaCycleBounds(
      timestamp,
      firstReset.beforeWindowResetsAt ?? currentWindow.resetsAt ?? "",
      windowMinutes
    );
  }

  if (!baseBounds) {
    return null;
  }

  const startMs = new Date(baseBounds.startAt).getTime();
  const endMs = new Date(baseBounds.endAt).getTime();
  const closingReset = normalizedResetEvents.find(
    (event) => event.boundaryMs > startMs + 1000 && event.boundaryMs < endMs - 1000
  );

  if (!closingReset) {
    return {
      ...baseBounds,
      scheduledEndAt: baseBounds.scheduledEndAt ?? baseBounds.endAt,
      closingResetEvent: null
    };
  }

  const endAt = closingReset.boundaryAt;
  return {
    ...baseBounds,
    key: `${baseBounds.startAt}/${endAt}`,
    endAt,
    scheduledEndAt: baseBounds.endAt,
    closedByReset: true,
    closedByResetAt: closingReset.at,
    closingResetEvent: closingReset
  };
}

function buildQuotaWindowUsage(args: {
  latestRateSnapshot: LatestRateSnapshot | null;
  events: CodexTokenEvent[];
  quotaObservations: QuotaObservation[];
  windowKind: ObservableQuotaWindowKind;
  resetAwareTimeline?: boolean;
}): QuotaWindowUsage {
  const currentSelection = getObservedWindowByKind(args.latestRateSnapshot, args.windowKind);
  const currentWindow = currentSelection?.window ?? null;
  if (!isUsableQuotaWindow(currentWindow)) {
    return { currentCycle: null, cycles: [] };
  }

  const usableWindow = currentWindow as ObservedLimitWindow;
  const anchorEndAt = usableWindow.resetsAt;
  const windowMinutes = usableWindow.windowMinutes;
  if (!anchorEndAt || !windowMinutes) {
    return { currentCycle: null, cycles: [] };
  }

  const quotaObservationEntries: QuotaCycleObservation[] = [];
  for (const observation of args.quotaObservations) {
    if (!isSameQuotaPool(observation.rateLimits, args.latestRateSnapshot)) {
      continue;
    }

    const windowInfo = getObservedWindowByKind(observation.rateLimits, args.windowKind)?.window ?? null;
    if (!isUsableQuotaWindow(windowInfo)) {
      continue;
    }

    const usedPercent = clampPercentage(windowInfo?.usedPercent ?? null);
    if (usedPercent === null) {
      continue;
    }

    quotaObservationEntries.push({
      observedAt: observation.timestamp,
      usedPercent,
      resetsAt: windowInfo?.resetsAt ?? null,
      windowMinutes: windowInfo?.windowMinutes ?? null,
      sourceId: observation.sessionId
    });
  }

  const timelineAnalysis = args.resetAwareTimeline
    ? analyzeQuotaObservations(quotaObservationEntries, {
        comparisonScope: "timeline"
      })
    : null;
  const boundaryResetEvents = timelineAnalysis
    ? normalizeQuotaResetBoundaries(timelineAnalysis.resetEvents, windowMinutes, usableWindow)
    : [];

  const buckets = new Map<string, QuotaCycleBucket>();

  const getBucket = (timestamp: string) => {
    const bounds = args.resetAwareTimeline
      ? resolveResetAwareQuotaCycleBounds(timestamp, usableWindow, boundaryResetEvents)
      : (() => {
          const plainBounds = resolveQuotaCycleBounds(timestamp, anchorEndAt, windowMinutes);
          return plainBounds ? { ...plainBounds, closingResetEvent: null } : null;
        })();
    if (!bounds) {
      return null;
    }

    const existing = buckets.get(bounds.key);
    if (existing) {
      return existing;
    }

    const bucket: QuotaCycleBucket = {
      cycleKey: bounds.key,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      tokens: emptyTokens(),
      apiCostUsd: 0,
      creditsEstimate: 0,
      sessionIds: new Set<string>(),
      observations: [],
      boundaryResetEvents: bounds.closingResetEvent ? [bounds.closingResetEvent] : [],
      maxObservedUsedPercent: null,
      lastObservedAt: null,
      lastObservedUsedPercent: null
    };
    buckets.set(bounds.key, bucket);
    return bucket;
  };

  for (const event of args.events) {
    const bucket = getBucket(event.timestamp);
    if (!bucket) {
      continue;
    }

    bucket.tokens = sumTokens(bucket.tokens, event.tokens);
    bucket.apiCostUsd += event.apiCostUsd;
    bucket.creditsEstimate += event.creditsEstimate;
    bucket.sessionIds.add(event.sessionId);
  }

  for (const observation of quotaObservationEntries) {
    const bucket = getBucket(observation.observedAt);
    if (!bucket) {
      continue;
    }

    bucket.observations.push(observation);
    bucket.maxObservedUsedPercent =
      bucket.maxObservedUsedPercent === null
        ? observation.usedPercent
        : Math.max(bucket.maxObservedUsedPercent, observation.usedPercent);
    if (
      !bucket.lastObservedAt ||
      new Date(observation.observedAt).getTime() >= new Date(bucket.lastObservedAt).getTime()
    ) {
      bucket.lastObservedAt = observation.observedAt;
      bucket.lastObservedUsedPercent = observation.usedPercent;
    }
  }

  let currentCycleKey: string | null = null;

  if (args.latestRateSnapshot) {
    const latestUsedPercent = clampPercentage(usableWindow.usedPercent);
    const currentBucket = getBucket(args.latestRateSnapshot.observedAt);
    currentCycleKey = currentBucket?.cycleKey ?? null;
    if (currentBucket && latestUsedPercent !== null) {
      currentBucket.observations.push({
        observedAt: args.latestRateSnapshot.observedAt,
        usedPercent: latestUsedPercent,
        resetsAt: usableWindow.resetsAt,
        windowMinutes: usableWindow.windowMinutes,
        sourceId: "current"
      });
      currentBucket.maxObservedUsedPercent =
        currentBucket.maxObservedUsedPercent === null
          ? latestUsedPercent
          : Math.max(currentBucket.maxObservedUsedPercent, latestUsedPercent);
      currentBucket.lastObservedAt = args.latestRateSnapshot.observedAt;
      currentBucket.lastObservedUsedPercent = latestUsedPercent;
    }
  }

  const cycles = [...buckets.values()]
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .map((bucket): QuotaCycleMetric => {
      const analysis = analyzeQuotaObservations(bucket.observations);
      const resetEvents = args.resetAwareTimeline
        ? bucket.boundaryResetEvents
        : analysis.resetEvents;
      const usedPercent =
        (args.resetAwareTimeline ? null : analysis.cumulativeUsedPercent) ??
        bucket.maxObservedUsedPercent ??
        bucket.lastObservedUsedPercent;

      return {
        cycleKey: bucket.cycleKey,
        startAt: bucket.startAt,
        endAt: bucket.endAt,
        tokens: bucket.tokens,
        sessions: bucket.sessionIds.size,
        apiCostUsd: roundTo(bucket.apiCostUsd, 6),
        creditsEstimate: roundTo(bucket.creditsEstimate, 6),
        usedPercent,
        remainingPercent:
          usedPercent === null ? null : clampPercentage(100 - usedPercent),
        maxObservedUsedPercent: bucket.maxObservedUsedPercent,
        lastObservedAt: bucket.lastObservedAt,
        resetCount: resetEvents.length,
        observations: bucket.observations.length,
        resetEvents,
        usageSegments: analysis.usageSegments
      };
    });

  return {
    currentCycle:
      cycles.find((cycle) => cycle.cycleKey === currentCycleKey) ?? null,
    cycles
  };
}

function aggregateEvents(
  events: CodexTokenEvent[],
  startAt: Date,
  endAt: Date
) {
  const sessionIds = new Set<string>();
  let tokens = emptyTokens();
  let apiCostUsd = 0;
  let creditsEstimate = 0;

  for (const event of events) {
    const timestamp = new Date(event.timestamp);
    if (timestamp < startAt || timestamp > endAt) {
      continue;
    }

    sessionIds.add(event.sessionId);
    tokens = sumTokens(tokens, event.tokens);
    apiCostUsd += event.apiCostUsd;
    creditsEstimate += event.creditsEstimate;
  }

  return {
    tokens,
    sessions: sessionIds.size,
    apiCostUsd: roundTo(apiCostUsd, 6),
    creditsEstimate: roundTo(creditsEstimate, 6)
  };
}

function buildPeriodMetric(
  key: string,
  label: string,
  startAt: Date,
  endAt: Date,
  events: CodexTokenEvent[],
  code = emptyCodeActivity()
): PeriodMetric {
  const aggregate = aggregateEvents(events, startAt, endAt);
  return {
    key,
    label,
    tokens: aggregate.tokens,
    sessions: aggregate.sessions,
    apiCostUsd: aggregate.apiCostUsd,
    creditsEstimate: aggregate.creditsEstimate,
    code,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString()
  };
}

function buildQuotaCyclePeriodMetric(
  key: string,
  label: string,
  cycle: QuotaCycleMetric | null,
  fallbackStartAt: Date,
  fallbackEndAt: Date,
  code = emptyCodeActivity()
): PeriodMetric {
  if (!cycle) {
    return buildPeriodMetric(key, label, fallbackStartAt, fallbackEndAt, [], code);
  }

  return {
    key,
    label,
    tokens: cycle.tokens,
    sessions: cycle.sessions,
    apiCostUsd: cycle.apiCostUsd,
    creditsEstimate: cycle.creditsEstimate,
    code,
    startAt: cycle.startAt,
    endAt: cycle.endAt,
    quotaEvidence: {
      usedPercent: cycle.usedPercent,
      remainingPercent: cycle.remainingPercent,
      maxObservedUsedPercent: cycle.maxObservedUsedPercent,
      lastObservedAt: cycle.lastObservedAt,
      resetCount: cycle.resetCount,
      observations: cycle.observations,
      resetEvents: cycle.resetEvents,
      usageSegments: cycle.usageSegments
    }
  };
}

function resolveWindowSourceStatus(
  snapshot: LatestRateSnapshot | null,
  sourceStatus: SourceStatus
): SourceStatus {
  if (!snapshot) {
    return sourceStatus === "observed" ? "pending" : sourceStatus;
  }

  return sourceStatus;
}

function buildLimitWindow(
  key: string,
  label: string,
  sourceStatus: SourceStatus,
  window:
    | {
        usedPercent: number | null;
        remainingPercent: number | null;
        resetsAt: string | null;
        observedAt: string | null;
        windowMinutes: number | null;
      }
    | undefined,
  estimatedSpentUsd: number | null,
  note: string | null = null,
  estimatedValueBasisUsedPercent: number | null = null,
  sourceSlot: "primary" | "secondary" | null = null
): LimitWindow {
  const usedPercent = clampPercentage(window?.usedPercent ?? null);
  const remainingPercent = clampPercentage(window?.remainingPercent ?? null);
  const rawValueBasisUsedPercent = estimatedValueBasisUsedPercent ?? usedPercent;
  const valueBasisUsedPercent =
    rawValueBasisUsedPercent === null || Number.isNaN(rawValueBasisUsedPercent)
      ? null
      : Math.max(0, roundTo(rawValueBasisUsedPercent, 2));
  const estimatedFullValueUsd =
    estimatedSpentUsd !== null && valueBasisUsedPercent !== null && valueBasisUsedPercent > 0
      ? roundTo(estimatedSpentUsd / (valueBasisUsedPercent / 100), 4)
      : null;

  return {
    key,
    label,
    sourceSlot,
    sourceStatus,
    usedPercent,
    remainingPercent,
    resetsAt: window?.resetsAt ?? null,
    observedAt: window?.observedAt ?? null,
    windowMinutes: window?.windowMinutes ?? null,
    estimatedSpentUsd,
    estimatedValueBasisUsedPercent: valueBasisUsedPercent,
    estimatedFullValueUsd,
    estimatedRemainingValueUsd:
      estimatedFullValueUsd !== null && estimatedSpentUsd !== null
        ? roundTo(Math.max(0, estimatedFullValueUsd - estimatedSpentUsd), 4)
        : null,
    note
  };
}

function buildDisplayedQuotaWindow(
  rawWindow:
    | {
        usedPercent: number | null;
        remainingPercent: number | null;
        resetsAt: string | null;
        observedAt: string | null;
        windowMinutes: number | null;
      }
    | undefined,
  period: PeriodMetric
) {
  if (!rawWindow) {
    return undefined;
  }

  const cycleUsedPercent = period.quotaEvidence?.usedPercent ?? null;
  const displayedUsedPercent = cycleUsedPercent ?? rawWindow.usedPercent;
  const displayedRemainingPercent =
    cycleUsedPercent === null
      ? rawWindow.remainingPercent
      : Math.max(0, 100 - cycleUsedPercent);
  const displayedResetsAt = period.quotaEvidence ? period.endAt : rawWindow.resetsAt;

  return {
    ...rawWindow,
    resetsAt: displayedResetsAt,
    usedPercent: displayedUsedPercent,
    remainingPercent: displayedRemainingPercent
  };
}

function toneFromRemaining(remainingPercent: number | null): WidgetMetric["tone"] {
  if (remainingPercent === null) {
    return "neutral";
  }

  if (remainingPercent <= 15) {
    return "danger";
  }

  if (remainingPercent <= 35) {
    return "warning";
  }

  return "success";
}

function widgetStatusLabel(
  sourceStatus: SourceStatus,
  weeklyWindow: LimitWindow,
  primaryWindow: LimitWindow
): string {
  if (sourceStatus === "stale") {
    return "数据过期";
  }

  if (sourceStatus === "pending" || sourceStatus === "unobserved") {
    return "待观测";
  }

  if (
    (weeklyWindow.usedPercent ?? 0) >= 85 ||
    (primaryWindow.usedPercent ?? 0) >= 85
  ) {
    return "预算偏紧";
  }

  return "正常";
}

function serializeSessions(
  sessions: CodexSessionSummary[],
  sessionRepoMap: Map<string, string>
): SessionAttribution[] {
  return sessions
    .map((session) => ({
      sessionId: session.sessionId,
      cwd: session.cwd,
      repoId: sessionRepoMap.get(session.sessionId) ?? null,
      startedAt: session.startedAt,
      lastEventAt: session.lastEventAt,
      tokens: session.tokens,
      apiCostUsd: session.apiCostUsd,
      creditsEstimate: session.creditsEstimate,
      dominantModel: session.dominantModel
    }))
    .sort((left, right) =>
      (right.lastEventAt ?? "").localeCompare(left.lastEventAt ?? "")
    );
}

function buildModelMetrics(events: CodexTokenEvent[], period: PeriodMetric) {
  const modelMap = new Map<
    string,
    {
      tokens: ReturnType<typeof emptyTokens>;
      apiCostUsd: number;
      creditsEstimate: number;
      events: number;
      sessionIds: Set<string>;
    }
  >();

  const startAt = new Date(period.startAt);
  const endAt = new Date(period.endAt);

  for (const event of events) {
    const timestamp = new Date(event.timestamp);
    if (timestamp < startAt || timestamp > endAt) {
      continue;
    }

    const current = modelMap.get(event.model) ?? {
      tokens: emptyTokens(),
      apiCostUsd: 0,
      creditsEstimate: 0,
      events: 0,
      sessionIds: new Set<string>()
    };
    current.tokens = sumTokens(current.tokens, event.tokens);
    current.apiCostUsd += event.apiCostUsd;
    current.creditsEstimate += event.creditsEstimate;
    current.events += 1;
    current.sessionIds.add(event.sessionId);
    modelMap.set(event.model, current);
  }

  return [...modelMap.entries()]
    .map(([model, metric]) => ({
      model,
      tokens: metric.tokens,
      apiCostUsd: roundTo(metric.apiCostUsd, 6),
      creditsEstimate: roundTo(metric.creditsEstimate, 6),
      events: metric.events,
      sessions: metric.sessionIds.size,
      sharePercent:
        period.tokens.total > 0
          ? roundTo((metric.tokens.total / period.tokens.total) * 100, 2)
          : 0
    }))
    .sort((left, right) => right.tokens.total - left.tokens.total);
}

function buildTimeBuckets(args: {
  events: CodexTokenEvent[];
  startAt: Date;
  endAt: Date;
  unit: "hour" | "day" | "week";
}): LedgerTimeBucket[] {
  const buckets: LedgerTimeBucket[] = [];
  let cursor = new Date(args.startAt);
  let index = 0;

  while (cursor < args.endAt && index < 400) {
    const bucketStart = new Date(cursor);
    const bucketEnd =
      args.unit === "hour"
        ? addMinutes(bucketStart, 60)
        : args.unit === "day"
          ? addMinutes(bucketStart, DAY_MINUTES)
          : addMinutes(bucketStart, 7 * DAY_MINUTES);
    const cappedEnd = bucketEnd > args.endAt ? args.endAt : bucketEnd;
    const aggregate = aggregateEvents(args.events, bucketStart, cappedEnd);
    const label =
      args.unit === "hour"
        ? bucketStart.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          })
        : args.unit === "day"
          ? bucketStart.toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit"
            })
          : `${bucketStart.toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit"
            })} - ${addMinutes(cappedEnd, -1).toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit"
            })}`;

    buckets.push({
      key: `${args.unit}-${bucketStart.toISOString()}`,
      label,
      startAt: bucketStart.toISOString(),
      endAt: cappedEnd.toISOString(),
      tokens: aggregate.tokens,
      sessions: aggregate.sessions,
      apiCostUsd: aggregate.apiCostUsd,
      creditsEstimate: aggregate.creditsEstimate
    });

    cursor = bucketEnd;
    index += 1;
  }

  if (buckets.length === 0) {
    const aggregate = aggregateEvents(args.events, args.startAt, args.endAt);
    buckets.push({
      key: `${args.unit}-${args.startAt.toISOString()}`,
      label: args.startAt.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit"
      }),
      startAt: args.startAt.toISOString(),
      endAt: args.endAt.toISOString(),
      tokens: aggregate.tokens,
      sessions: aggregate.sessions,
      apiCostUsd: aggregate.apiCostUsd,
      creditsEstimate: aggregate.creditsEstimate
    });
  }

  return buckets;
}

function buildPeakSession(
  sessions: SessionAttribution[],
  startAt: Date,
  endAt: Date
): SessionAttribution | null {
  return sessions
    .filter((session) => {
      if (!session.lastEventAt) {
        return false;
      }
      const lastEventAt = new Date(session.lastEventAt);
      return lastEventAt >= startAt && lastEventAt <= endAt;
    })
    .sort((left, right) => right.tokens.total - left.tokens.total)[0] ?? null;
}

function buildLedgerAnalysisPeriod(args: {
  key: LedgerAnalysisPeriod["key"];
  label: string;
  startAt: Date;
  endAt: Date;
  events: CodexTokenEvent[];
  sessions: SessionAttribution[];
}): LedgerAnalysisPeriod {
  const period = buildPeriodMetric(
    args.key,
    args.label,
    args.startAt,
    args.endAt,
    args.events
  );

  return {
    key: args.key,
    label: args.label,
    period,
    buckets: buildTimeBuckets({
      events: args.events,
      startAt: args.startAt,
      endAt: args.endAt,
      unit: "day"
    }),
    models: buildModelMetrics(args.events, period),
    peakSession: buildPeakSession(args.sessions, args.startAt, args.endAt)
  };
}

function aggregateCodeFromRepos(
  repoItems: Awaited<ReturnType<typeof collectGitData>>["items"],
  field:
    | "today"
    | "yesterday"
    | "sevenDays"
    | "naturalWeek"
    | "month"
    | "fiveHour"
    | "weekLimit"
    | "billingMonth"
) {
  return repoItems.reduce(
    (total, repo) =>
      sumCodeActivity(total, repo.activity[field] ?? emptyCodeActivity()),
    emptyCodeActivity()
  );
}

function latestIsoValue(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function buildProjectOverviewPeriod(args: {
  repoItems: Awaited<ReturnType<typeof collectGitData>>["items"];
  events: CodexTokenEvent[];
  sessionRepoMap: Map<string, string>;
  startAt: Date;
  endAt: Date;
  activityField:
    | "today"
    | "naturalWeek"
    | "month"
    | "fiveHour"
    | "weekLimit"
    | "billingMonth";
}): OverviewProjectItem[] {
  const aggregateMap = new Map<
    string,
    {
      tokenTotal: number;
      apiCostUsd: number;
      sessionIds: Set<string>;
      latestTokenAt: string | null;
    }
  >();

  for (const event of args.events) {
    const timestamp = new Date(event.timestamp);
    if (timestamp < args.startAt || timestamp > args.endAt) {
      continue;
    }

    const repoId = args.sessionRepoMap.get(event.sessionId);
    if (!repoId) {
      continue;
    }

    const current = aggregateMap.get(repoId) ?? {
      tokenTotal: 0,
      apiCostUsd: 0,
      sessionIds: new Set<string>(),
      latestTokenAt: null
    };

    current.tokenTotal += event.tokens.total;
    current.apiCostUsd += event.apiCostUsd;
    current.sessionIds.add(event.sessionId);
    current.latestTokenAt = latestIsoValue(current.latestTokenAt, event.timestamp);
    aggregateMap.set(repoId, current);
  }

  return args.repoItems
    .map((repo) => {
      const aggregate = aggregateMap.get(repo.id);
      const activity = repo.activity[args.activityField] ?? emptyCodeActivity();
      const recentCommitAt =
        repo.recentCommits.find((commit) => {
          const authoredAt = new Date(commit.authoredAt);
          return authoredAt >= args.startAt && authoredAt <= args.endAt;
        })?.authoredAt ?? null;
      const recentActivityAt = latestIsoValue(
        aggregate?.latestTokenAt ?? null,
        recentCommitAt
      );

      return {
        id: repo.id,
        name: repo.name,
        tokenTotal: roundTo(aggregate?.tokenTotal ?? 0, 2),
        apiCostUsd: roundTo(aggregate?.apiCostUsd ?? 0, 6),
        codeChangedLines: activity.changedLines,
        commits: activity.commits,
        sessions: aggregate?.sessionIds.size ?? 0,
        recentActivityAt
      };
    })
    .sort((left, right) => {
      if (right.tokenTotal !== left.tokenTotal) {
        return right.tokenTotal - left.tokenTotal;
      }

      if (right.codeChangedLines !== left.codeChangedLines) {
        return right.codeChangedLines - left.codeChangedLines;
      }

      return (right.recentActivityAt ?? "").localeCompare(left.recentActivityAt ?? "");
    });
}

function buildPendingDashboardSnapshot(
  preferences: AppPreferences,
  now = new Date()
): DashboardSnapshot {
  const todayStart = startOfDay(now);
  const naturalWeekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const sevenNaturalDayStart = startOfDay(addMinutes(now, -6 * DAY_MINUTES));
  const thirtyDayStart = startOfDay(addMinutes(now, -29 * DAY_MINUTES));
  const emptyPeriod = (
    key: string,
    label: string,
    startAt: Date,
    endAt: Date
  ): PeriodMetric => ({
    key,
    label,
    tokens: emptyTokens(),
    sessions: 0,
    apiCostUsd: 0,
    creditsEstimate: 0,
    code: emptyCodeActivity(),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString()
  });
  const emptyAnalysis = (
    key: LedgerAnalysisPeriod["key"],
    label: string,
    startAt: Date,
    endAt: Date
  ): LedgerAnalysisPeriod => ({
    key,
    label,
    period: emptyPeriod(key, label, startAt, endAt),
    buckets: buildTimeBuckets({ events: [], startAt, endAt, unit: "day" }),
    models: [],
    peakSession: null
  });
  const today = emptyPeriod("today", "自然今日", todayStart, now);
  const naturalWeek = emptyPeriod(
    "naturalWeek",
    "自然本周",
    naturalWeekStart,
    now
  );
  const month = emptyPeriod("month", "自然本月", monthStart, now);
  const sevenDays = emptyPeriod(
    "sevenDays",
    "近 7 日",
    addMinutes(now, -7 * 24 * 60),
    now
  );
  const fiveHour = emptyPeriod(
    "currentFiveHour",
    "当前 5 小时窗口",
    addMinutes(now, -5 * 60),
    now
  );
  const weekLimit = emptyPeriod(
    "currentWeekLimit",
    "当前周额度窗口",
    naturalWeekStart,
    now
  );
  const pendingWindow = (key: string, label: string): LimitWindow => ({
    key,
    label,
    sourceStatus: "pending",
    usedPercent: null,
    remainingPercent: null,
    resetsAt: null,
    observedAt: null,
    windowMinutes: null,
    estimatedSpentUsd: null,
    estimatedValueBasisUsedPercent: null,
    estimatedFullValueUsd: null,
    estimatedRemainingValueUsd: null,
    note: "正在后台读取 Codex rate_limits 与本地会话数据。"
  });
  const limitWindows = [
    pendingWindow("fiveHour", "5 小时额度"),
    pendingWindow("weekLimit", "周额度"),
    pendingWindow("observableMonth", "可观测月额度")
  ];

  return {
    generatedAt: now.toISOString(),
    generatedFrom: "pending",
    sourceHealth: {
      codexHome: preferences.codexHome,
      repoRoots: preferences.repoRoots,
      sessionFilesScanned: 0,
      archivedFilesScanned: 0,
      repoCount: 0,
      lastObservedAt: null,
      sourceStatus: "pending",
      refresh: emptyRefreshTelemetry(now.toISOString(), "startup"),
      refreshHistory: [],
      notes: ["正在后台读取本机 Codex 与 Git 数据。"]
    },
    overview: {
      today,
      sevenDays,
      naturalWeek,
      month,
      previous: {
        yesterday: emptyPeriod("yesterday", "昨日", addMinutes(todayStart, -24 * 60), todayStart),
        naturalWeek: emptyPeriod(
          "previousNaturalWeek",
          "上一个自然周",
          addMinutes(naturalWeekStart, -7 * 24 * 60),
          naturalWeekStart
        ),
        month: emptyPeriod(
          "previousMonth",
          "上一个自然月",
          new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
          monthStart
        ),
        fiveHour: null,
        weekLimit: null,
        billingMonth: null
      },
      windowPeriods: {
        fiveHour,
        weekLimit,
        billingMonth: null
      },
      limitWindows,
      modelWindows: {
        fiveHour: [],
        weekLimit: []
      },
      projectOverview: {
        natural: {
          day: [],
          week: [],
          month: []
        },
        billing: {
          fiveHour: [],
          weekLimit: [],
          billingMonth: []
        }
      },
      apiValueSummaryUsd: null,
      bankedResetCredits: emptyBankedResetCreditsSummary(
        "pending",
        "正在后台读取 Codex 赠送重置次数。"
      )
    },
    ledger: {
      periods: [today, naturalWeek, month, fiveHour, weekLimit],
      weeklyPeriods: [weekLimit],
      trend: {
        day: buildTimeBuckets({ events: [], startAt: todayStart, endAt: now, unit: "hour" }),
        week: buildTimeBuckets({ events: [], startAt: sevenNaturalDayStart, endAt: now, unit: "day" }),
        monthByDate: buildTimeBuckets({ events: [], startAt: thirtyDayStart, endAt: now, unit: "day" }),
        monthByWeek: buildTimeBuckets({ events: [], startAt: thirtyDayStart, endAt: now, unit: "week" })
      },
      analysis: {
        sevenDays: emptyAnalysis("sevenDays", "近7天", sevenNaturalDayStart, now),
        thirtyDays: emptyAnalysis("thirtyDays", "近30天", thirtyDayStart, now),
        cumulative: emptyAnalysis("cumulative", "累计", monthStart, now)
      },
      models: [],
      sessions: [],
      limitWindows
    },
    repositories: {
      roots: preferences.repoRoots,
      items: [],
      summary: {
        totalTracked: 0,
        attributedRepoCount: 0,
        attributedTokens: 0,
        todayChangedLines: 0,
        sevenDayChangedLines: 0,
        monthChangedLines: 0
      }
    },
    widget: {
      statusLabel: "采集中",
      updatedLabel: "正在后台采集",
      metrics: [
        {
          key: "todayTokens",
          label: "今日 Token",
          value: "--",
          hint: "正在采集",
          tone: "neutral"
        }
      ]
    },
    pricingMeta: {
      apiRateSource: API_RATE_SOURCE,
      codexRateSource: CODEX_RATE_SOURCE,
      updatedAt: now.toISOString()
    }
  };
}

async function collectDashboardSnapshot(
  preferences: AppPreferences,
  options: CollectDashboardSnapshotOptions = {},
  now = new Date()
): Promise<DashboardSnapshot> {
  const trigger = options.trigger ?? "background";
  const refreshStartedAt = new Date();
  const refreshStartedMs = Date.now();
  const codexStartedMs = Date.now();
  const codex = await collectCodexData(now, {
    codexHome: preferences.codexHome,
    sessionCacheStore: options.codexSessionCacheStore
  });
  const codexDurationMs = Date.now() - codexStartedMs;
  const bankedResetCredits = await collectBankedResetCreditsSummary(
    options.previousBankedResetCredits ?? null
  );
  const fiveHourSelection = getObservedWindowByKind(codex.latestRateSnapshot, "five-hour");
  const weeklySelection = getObservedWindowByKind(codex.latestRateSnapshot, "weekly");
  const fiveHourQuotaUsage = buildQuotaWindowUsage({
    latestRateSnapshot: codex.latestRateSnapshot,
    events: codex.events,
    quotaObservations: codex.quotaObservations,
    windowKind: "five-hour"
  });
  const weeklyQuotaUsage = buildQuotaWindowUsage({
    latestRateSnapshot: codex.latestRateSnapshot,
    events: codex.events,
    quotaObservations: codex.quotaObservations,
    windowKind: "weekly",
    resetAwareTimeline: true
  });
  const fiveHourWindowRange = fiveHourQuotaUsage.currentCycle
    ? {
        start: new Date(fiveHourQuotaUsage.currentCycle.startAt),
        end: new Date(fiveHourQuotaUsage.currentCycle.endAt)
      }
    : fiveHourSelection?.window.resetsAt && fiveHourSelection.window.windowMinutes
      ? {
          start: addMinutes(
            new Date(fiveHourSelection.window.resetsAt),
            -fiveHourSelection.window.windowMinutes
          ),
          end: new Date(fiveHourSelection.window.resetsAt)
        }
      : null;
  const secondaryWindowRange = weeklyQuotaUsage.currentCycle
    ? {
        start: new Date(weeklyQuotaUsage.currentCycle.startAt),
        end: new Date(weeklyQuotaUsage.currentCycle.endAt)
      }
    : weeklySelection?.window.resetsAt && weeklySelection.window.windowMinutes
      ? {
          start: addMinutes(
            new Date(weeklySelection.window.resetsAt),
            -weeklySelection.window.windowMinutes
          ),
          end: new Date(weeklySelection.window.resetsAt)
        }
      : null;
  const billingMonthStart = startOfBillingMonth(
    now,
    preferences.billingMonthStartDay
  );
  const previousBillingMonthStart = startOfBillingMonth(
    addMinutes(billingMonthStart, -1),
    preferences.billingMonthStartDay
  );
  const gitStartedMs = Date.now();
  const git = await collectGitData({
    repoRoots: preferences.repoRoots,
    sessions: codex.sessions,
    activityWindows: [
      ...(fiveHourWindowRange
        ? [{ key: "fiveHour" as const, start: fiveHourWindowRange.start, end: fiveHourWindowRange.end }]
        : []),
      ...(secondaryWindowRange
        ? [{ key: "weekLimit" as const, start: secondaryWindowRange.start, end: secondaryWindowRange.end }]
        : []),
      { key: "billingMonth" as const, start: billingMonthStart, end: now }
    ],
    now
  });
  const gitDurationMs = Date.now() - gitStartedMs;

  const todayStart = startOfDay(now);
  const sevenDayStart = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const naturalWeekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const sevenNaturalDayStart = startOfDay(addMinutes(now, -6 * DAY_MINUTES));
  const thirtyDayStart = startOfDay(addMinutes(now, -29 * DAY_MINUTES));
  const firstEventAt =
    codex.events.reduce<Date | null>((earliest, event) => {
      const timestamp = new Date(event.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        return earliest;
      }
      return earliest === null || timestamp < earliest ? timestamp : earliest;
    }, null) ?? todayStart;
  const cumulativeStart = startOfDay(firstEventAt);

  const todayPeriod = buildPeriodMetric(
    "today",
    "自然今日",
    todayStart,
    now,
    codex.events,
    aggregateCodeFromRepos(git.items, "today")
  );
  const sevenDayPeriod = buildPeriodMetric(
    "sevenDays",
    "近 7 日",
    sevenDayStart,
    now,
    codex.events,
    aggregateCodeFromRepos(git.items, "sevenDays")
  );
  const naturalWeekPeriod = buildPeriodMetric(
    "naturalWeek",
    "自然本周",
    naturalWeekStart,
    now,
    codex.events,
    aggregateCodeFromRepos(git.items, "naturalWeek")
  );
  const monthPeriod = buildPeriodMetric(
    "month",
    "自然本月",
    monthStart,
    now,
    codex.events,
    aggregateCodeFromRepos(git.items, "month")
  );
  const yesterdayStart = addMinutes(todayStart, -24 * 60);
  const yesterdayPeriod = buildPeriodMetric(
    "yesterday",
    "昨日",
    yesterdayStart,
    todayStart,
    codex.events,
    aggregateCodeFromRepos(git.items, "yesterday")
  );
  const previousNaturalWeekStart = addMinutes(naturalWeekStart, -7 * 24 * 60);
  const previousNaturalWeekPeriod = buildPeriodMetric(
    "previousNaturalWeek",
    "上一个自然周",
    previousNaturalWeekStart,
    naturalWeekStart,
    codex.events
  );
  const previousMonthStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1,
    0,
    0,
    0,
    0
  );
  const previousMonthPeriod = buildPeriodMetric(
    "previousMonth",
    "上一个自然月",
    previousMonthStart,
    monthStart,
    codex.events
  );

  const primaryPeriod = fiveHourWindowRange
    ? buildQuotaCyclePeriodMetric(
        "currentFiveHour",
        "当前 5 小时窗口",
        fiveHourQuotaUsage.currentCycle,
        fiveHourWindowRange.start,
        fiveHourWindowRange.end,
        aggregateCodeFromRepos(git.items, "fiveHour")
      )
    : buildPeriodMetric(
        "currentFiveHour",
        "当前 5 小时窗口",
        todayStart,
        now,
        [],
        emptyCodeActivity()
      );
  const weeklyLimitPeriod = secondaryWindowRange
    ? buildQuotaCyclePeriodMetric(
        "currentWeekLimit",
        "当前周额度窗口",
        weeklyQuotaUsage.currentCycle,
        secondaryWindowRange.start,
        secondaryWindowRange.end,
        aggregateCodeFromRepos(git.items, "weekLimit")
      )
    : buildPeriodMetric(
        "currentWeekLimit",
        "当前周额度窗口",
        naturalWeekStart,
        now,
        [],
        emptyCodeActivity()
      );
  const previousFiveHourPeriod =
    fiveHourQuotaUsage.cycles.length > 1
      ? buildQuotaCyclePeriodMetric(
          "previousFiveHour",
          "上一 5 小时窗口",
          fiveHourQuotaUsage.cycles.at(-2) ?? null,
          fiveHourWindowRange?.start ?? todayStart,
          fiveHourWindowRange?.end ?? now
        )
      : null;
  const previousWeekLimitPeriod =
    weeklyQuotaUsage.cycles.length > 1
      ? buildQuotaCyclePeriodMetric(
          "previousWeekLimit",
          "上一周额度窗口",
          weeklyQuotaUsage.cycles.at(-2) ?? null,
          secondaryWindowRange?.start ?? naturalWeekStart,
          secondaryWindowRange?.end ?? now
        )
      : null;
  const billingMonthPeriod = buildPeriodMetric(
    "billingMonth",
    "当前计费月",
    billingMonthStart,
    now,
    codex.events,
    aggregateCodeFromRepos(git.items, "billingMonth")
  );
  const previousBillingMonthPeriod = buildPeriodMetric(
    "previousBillingMonth",
    "上个计费月",
    previousBillingMonthStart,
    billingMonthStart,
    codex.events
  );

  const primaryWindow = buildLimitWindow(
    "fiveHour",
    "5 小时额度",
    fiveHourSelection
      ? resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus)
      : codex.latestRateSnapshot
        ? "unobserved"
        : resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus),
    buildDisplayedQuotaWindow(
      fiveHourSelection
        ? {
            ...fiveHourSelection.window,
            remainingPercent:
              fiveHourSelection.window.usedPercent === null
                ? null
                : 100 - fiveHourSelection.window.usedPercent,
            observedAt: codex.latestRateSnapshot?.observedAt ?? null
          }
        : undefined,
      primaryPeriod
    ),
    primaryPeriod.apiCostUsd,
    fiveHourSelection
      ? `数据来自 rate_limits.${fiveHourSelection.windowKey} 的 ${CODEX_FIVE_HOUR_WINDOW_MINUTES} 分钟窗口。`
      : "当前 Codex 额度契约未提供 5 小时窗口。",
    primaryPeriod.quotaEvidence?.usedPercent ?? null,
    fiveHourSelection?.windowKey ?? null
  );
  const weeklyWindow = buildLimitWindow(
    "weekLimit",
    "周额度",
    weeklySelection
      ? resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus)
      : codex.latestRateSnapshot
        ? "unobserved"
        : resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus),
    buildDisplayedQuotaWindow(
      weeklySelection
        ? {
            ...weeklySelection.window,
            remainingPercent:
              weeklySelection.window.usedPercent === null
                ? null
                : 100 - weeklySelection.window.usedPercent,
            observedAt: codex.latestRateSnapshot?.observedAt ?? null
          }
        : undefined,
      weeklyLimitPeriod
    ),
    weeklyLimitPeriod.apiCostUsd,
    weeklySelection
      ? `数据来自 rate_limits.${weeklySelection.windowKey} 的 ${CODEX_WEEKLY_WINDOW_MINUTES} 分钟窗口。`
      : "当前 Codex 额度契约未提供周额度窗口。",
    weeklyLimitPeriod.quotaEvidence?.usedPercent ?? null,
    weeklySelection?.windowKey ?? null
  );
  const observableMonthWindow = buildLimitWindow(
    "observableMonth",
    "可观测月额度",
    codex.latestRateSnapshot ? "unobserved" : codex.sourceStatus,
    undefined,
    null,
    "当前本地 Codex 快照未暴露月额度字段，首版仅展示自然月使用量。"
  );

  const widgetMetrics: WidgetMetric[] = [
    {
      key: "todayTokens",
      label: "今日 Token",
      value: `${todayPeriod.tokens.total.toLocaleString()} tok`,
      hint: `${todayPeriod.code.changedLines.toLocaleString()} 行改动`,
      tone: "primary"
    },
    {
      key: "planRemaining",
      label: "套餐剩余",
      value:
        weeklyWindow.remainingPercent === null
          ? "未观测"
          : `${weeklyWindow.remainingPercent.toFixed(1)}%`,
      hint:
        weeklyWindow.estimatedRemainingValueUsd === null
          ? "等待更多额度快照"
          : `约 $${weeklyWindow.estimatedRemainingValueUsd.toFixed(2)} 价值空间`,
      tone: toneFromRemaining(weeklyWindow.remainingPercent)
    },
    {
      key: "weekTokens",
      label: "本周 Token",
      value: `${naturalWeekPeriod.tokens.total.toLocaleString()} tok`,
      hint: `$${naturalWeekPeriod.apiCostUsd.toFixed(2)} API 等价`,
      tone: "neutral"
    },
    {
      key: "monthTokens",
      label: "本月 Token",
      value: `${monthPeriod.tokens.total.toLocaleString()} tok`,
      hint: `${monthPeriod.sessions} 个会话`,
      tone: "neutral"
    }
  ];

  const sessions = serializeSessions(codex.sessions, git.sessionRepoMap);
  const modelMetrics = buildModelMetrics(codex.events, monthPeriod);
  const fiveHourModels = buildModelMetrics(codex.events, primaryPeriod).slice(0, 3);
  const weekLimitModels = buildModelMetrics(codex.events, weeklyLimitPeriod).slice(0, 3);
  const ledgerTrend = {
    day: buildTimeBuckets({ events: codex.events, startAt: todayStart, endAt: now, unit: "hour" }),
    week: buildTimeBuckets({
      events: codex.events,
      startAt: sevenNaturalDayStart,
      endAt: now,
      unit: "day"
    }),
    monthByDate: buildTimeBuckets({
      events: codex.events,
      startAt: thirtyDayStart,
      endAt: now,
      unit: "day"
    }),
    monthByWeek: buildTimeBuckets({
      events: codex.events,
      startAt: thirtyDayStart,
      endAt: now,
      unit: "week"
    })
  };
  const ledgerAnalysis = {
    sevenDays: buildLedgerAnalysisPeriod({
      key: "sevenDays",
      label: "近7天",
      startAt: sevenNaturalDayStart,
      endAt: now,
      events: codex.events,
      sessions
    }),
    thirtyDays: buildLedgerAnalysisPeriod({
      key: "thirtyDays",
      label: "近30天",
      startAt: thirtyDayStart,
      endAt: now,
      events: codex.events,
      sessions
    }),
    cumulative: buildLedgerAnalysisPeriod({
      key: "cumulative",
      label: "累计",
      startAt: cumulativeStart,
      endAt: now,
      events: codex.events,
      sessions
    })
  };
  const weeklyLedgerPeriods =
    weeklyQuotaUsage.cycles.length > 0
      ? weeklyQuotaUsage.cycles
          .slice(-6)
          .reverse()
          .map((cycle) =>
            buildQuotaCyclePeriodMetric(
              `weekLimit-${cycle.cycleKey}`,
              "周额度周期",
              cycle,
              new Date(cycle.startAt),
              new Date(cycle.endAt)
            )
          )
      : [weeklyLimitPeriod];
  const naturalProjectDay = buildProjectOverviewPeriod({
    repoItems: git.items,
    events: codex.events,
    sessionRepoMap: git.sessionRepoMap,
    startAt: todayStart,
    endAt: now,
    activityField: "today"
  });
  const naturalProjectWeek = buildProjectOverviewPeriod({
    repoItems: git.items,
    events: codex.events,
    sessionRepoMap: git.sessionRepoMap,
    startAt: naturalWeekStart,
    endAt: now,
    activityField: "naturalWeek"
  });
  const naturalProjectMonth = buildProjectOverviewPeriod({
    repoItems: git.items,
    events: codex.events,
    sessionRepoMap: git.sessionRepoMap,
    startAt: monthStart,
    endAt: now,
    activityField: "month"
  });
  const billingProjectFiveHour = fiveHourWindowRange
    ? buildProjectOverviewPeriod({
        repoItems: git.items,
        events: codex.events,
        sessionRepoMap: git.sessionRepoMap,
        startAt: fiveHourWindowRange.start,
        endAt: fiveHourWindowRange.end,
        activityField: "fiveHour"
      })
    : [];
  const billingProjectWeekLimit = secondaryWindowRange
    ? buildProjectOverviewPeriod({
        repoItems: git.items,
        events: codex.events,
        sessionRepoMap: git.sessionRepoMap,
        startAt: secondaryWindowRange.start,
        endAt: secondaryWindowRange.end,
        activityField: "weekLimit"
      })
    : [];
  const billingProjectMonth = buildProjectOverviewPeriod({
    repoItems: git.items,
    events: codex.events,
    sessionRepoMap: git.sessionRepoMap,
    startAt: billingMonthStart,
    endAt: now,
    activityField: "billingMonth"
  });
  const refreshCompletedAt = new Date();

  return {
    generatedAt: now.toISOString(),
    generatedFrom: "live",
    sourceHealth: {
      codexHome: codex.codexHome,
      repoRoots: git.roots,
      sessionFilesScanned: codex.sessionFilesScanned,
      archivedFilesScanned: codex.archivedFilesScanned,
      repoCount: git.items.length,
      lastObservedAt: codex.lastObservedAt,
      sourceStatus: codex.sourceStatus,
      refresh: {
        trigger,
        startedAt: refreshStartedAt.toISOString(),
        completedAt: refreshCompletedAt.toISOString(),
        durationMs: refreshCompletedAt.getTime() - refreshStartedMs,
        codexDurationMs,
        gitDurationMs,
        codexFilesTotal: codex.cacheStats.totalFiles,
        codexFilesParsed: codex.cacheStats.parsedFiles,
        codexFilesReused: codex.cacheStats.reusedFiles,
        codexCachePruned: codex.cacheStats.prunedFiles
      },
      refreshHistory: options.refreshHistory ?? [],
      notes: [
        ...codex.notes,
        "代码改动基于 Git 已提交历史与当前工作区 diff，不读取云端仓库信息。",
        `计费月 Token 默认按每月第 ${preferences.billingMonthStartDay} 天 00:00 起算；月额度字段仍以 Codex rate_limits 是否暴露为准。`
      ]
    },
    overview: {
      today: todayPeriod,
      sevenDays: sevenDayPeriod,
      naturalWeek: naturalWeekPeriod,
      month: monthPeriod,
      previous: {
        yesterday: yesterdayPeriod,
        naturalWeek: previousNaturalWeekPeriod,
        month: previousMonthPeriod,
        fiveHour: previousFiveHourPeriod,
        weekLimit: previousWeekLimitPeriod,
        billingMonth: previousBillingMonthPeriod
      },
      windowPeriods: {
        fiveHour: primaryPeriod,
        weekLimit: weeklyLimitPeriod,
        billingMonth: billingMonthPeriod
      },
      limitWindows: [primaryWindow, weeklyWindow, observableMonthWindow],
      modelWindows: {
        fiveHour: fiveHourModels,
        weekLimit: weekLimitModels
      },
      projectOverview: {
        natural: {
          day: naturalProjectDay,
          week: naturalProjectWeek,
          month: naturalProjectMonth
        },
        billing: {
          fiveHour: billingProjectFiveHour,
          weekLimit: billingProjectWeekLimit,
          billingMonth: billingProjectMonth
        }
      },
      apiValueSummaryUsd: weeklyWindow.estimatedFullValueUsd,
      bankedResetCredits
    },
    ledger: {
      periods: [
        todayPeriod,
        naturalWeekPeriod,
        monthPeriod,
        primaryPeriod,
        weeklyLimitPeriod
      ],
      weeklyPeriods: weeklyLedgerPeriods,
      trend: ledgerTrend,
      analysis: ledgerAnalysis,
      models: modelMetrics,
      sessions,
      limitWindows: [primaryWindow, weeklyWindow, observableMonthWindow]
    },
    repositories: {
      roots: git.roots,
      items: git.items.sort((left, right) => right.tokens.total - left.tokens.total),
      summary: {
        totalTracked: git.items.length,
        attributedRepoCount: git.items.reduce(
          (sum, repo) => sum + (repo.sessionCount > 0 || repo.tokens.total > 0 ? 1 : 0),
          0
        ),
        attributedTokens: git.items.reduce(
          (sum, repo) => sum + repo.tokens.total,
          0
        ),
        todayChangedLines: git.items.reduce(
          (sum, repo) => sum + repo.activity.today.changedLines,
          0
        ),
        sevenDayChangedLines: git.items.reduce(
          (sum, repo) => sum + repo.activity.sevenDays.changedLines,
          0
        ),
        monthChangedLines: git.items.reduce(
          (sum, repo) => sum + repo.activity.month.changedLines,
          0
        )
      }
    },
    widget: {
      statusLabel: widgetStatusLabel(codex.sourceStatus, weeklyWindow, primaryWindow),
      updatedLabel: codex.lastObservedAt
        ? `最近观测 ${new Date(codex.lastObservedAt).toLocaleString("zh-CN")}`
        : "等待首个快照",
      metrics: widgetMetrics
    },
    pricingMeta: {
      apiRateSource: API_RATE_SOURCE,
      codexRateSource: CODEX_RATE_SOURCE,
      updatedAt: now.toISOString()
    }
  };
}

export class DashboardService {
  private cachedSnapshot: DashboardSnapshot | null = null;
  private cachedAt = 0;
  private collectingSnapshot: Promise<DashboardSnapshot> | null = null;

  public constructor(
    private readonly settingsStore: SettingsStore,
    private readonly snapshotStore: SnapshotStore,
    private readonly codexSessionCacheStore?: CodexSessionCacheStoreLike
  ) {}

  public getPreferences(): Promise<AppPreferences> {
    return this.settingsStore.read();
  }

  public updateWidgetPreferences(
    patch: Partial<AppPreferences["widget"]>
  ): Promise<AppPreferences> {
    return this.settingsStore.update((current) => ({
      ...current,
      widget: {
        ...current.widget,
        ...patch
      }
    }));
  }

  public updateUpdatePreferences(
    patch: Partial<AppPreferences["updates"]>
  ): Promise<AppPreferences> {
    return this.settingsStore.update((current) => ({
      ...current,
      updates: {
        ...current.updates,
        ...patch
      }
    }));
  }

  public updatePreferences(patch: Partial<AppPreferences>): Promise<AppPreferences> {
    return this.settingsStore.update((current) => ({
      ...current,
      ...patch,
      billingMonthStartDay:
        typeof patch.billingMonthStartDay === "number"
          ? Math.max(1, Math.min(31, Math.trunc(patch.billingMonthStartDay)))
          : current.billingMonthStartDay,
      widget: {
        ...current.widget,
        ...patch.widget
      },
      updates: {
        ...current.updates,
        ...patch.updates
      }
    }));
  }

  public async getSnapshot(
    force = false,
    trigger: RefreshTrigger = force ? "manual" : "background"
  ): Promise<DashboardSnapshot> {
    if (
      !force &&
      this.cachedSnapshot &&
      Date.now() - this.cachedAt < 60_000
    ) {
      return this.cachedSnapshot;
    }

    if (!force) {
      const cached = await this.getCachedSnapshot();
      if (cached) {
        return cached;
      }

      const preferences = await this.settingsStore.read();
      const pending = buildPendingDashboardSnapshot(preferences);
      this.cachedSnapshot = pending;
      this.cachedAt = Date.now();
      void this.refreshSnapshotInBackground("startup")?.catch(() => {
        // Foreground calls surface collection failures through getSnapshot(true).
      });
      return pending;
    }

    return this.collectSnapshot(trigger);
  }

  public async getCachedSnapshot(): Promise<DashboardSnapshot | null> {
    if (this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    const cached = await this.snapshotStore.read();
    if (!cached) {
      return null;
    }

    const normalized = ensureRefreshTelemetry(cached);
    this.cachedSnapshot = {
      ...normalized,
      generatedFrom: "cache"
    };
    this.cachedAt = Date.now();
    return this.cachedSnapshot;
  }

  public refreshSnapshotInBackground(
    trigger: RefreshTrigger = "background"
  ): Promise<DashboardSnapshot> | null {
    if (this.collectingSnapshot) {
      return this.collectingSnapshot;
    }

    return this.collectSnapshot(trigger);
  }

  private async collectSnapshot(trigger: RefreshTrigger): Promise<DashboardSnapshot> {
    if (this.collectingSnapshot) {
      return this.collectingSnapshot;
    }

    this.collectingSnapshot = this.collectSnapshotInner(trigger).finally(() => {
      this.collectingSnapshot = null;
    });

    return this.collectingSnapshot;
  }

  private async collectSnapshotInner(trigger: RefreshTrigger): Promise<DashboardSnapshot> {
    const refreshStartedAt = new Date();
    const refreshStartedMs = Date.now();
    const preferences = await this.settingsStore.read();
    const cachedBeforeCollect = this.cachedSnapshot ?? (await this.snapshotStore.read());
    const previousHistory =
      cachedBeforeCollect?.sourceHealth.refreshHistory ?? [];
    try {
      const snapshot = appendRefreshHistory(
        await collectDashboardSnapshot(preferences, {
          codexSessionCacheStore: this.codexSessionCacheStore,
          trigger,
          refreshHistory: previousHistory,
          previousBankedResetCredits:
            cachedBeforeCollect?.overview.bankedResetCredits ?? null
        }),
        previousHistory
      );
      this.cachedSnapshot = snapshot;
      this.cachedAt = Date.now();
      await this.snapshotStore.write(snapshot);
      return snapshot;
    } catch (error) {
      const cached = await this.snapshotStore.read();
      if (!cached) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "未知采集异常";
      const normalized = ensureRefreshTelemetry(cached);
      const completedAt = new Date();
      const fallback: DashboardSnapshot = {
        ...normalized,
        generatedAt: completedAt.toISOString(),
        generatedFrom: "cache",
        sourceHealth: {
          ...normalized.sourceHealth,
          refresh: {
            ...emptyRefreshTelemetry(refreshStartedAt.toISOString(), trigger),
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - refreshStartedMs
          },
          notes: [...normalized.sourceHealth.notes, `实时采集失败，已回退缓存：${message}`]
        }
      };
      const fallbackWithHistory = appendRefreshHistory(
        fallback,
        normalized.sourceHealth.refreshHistory,
        `实时采集失败，已回退缓存：${message}`
      );
      this.cachedSnapshot = fallbackWithHistory;
      this.cachedAt = Date.now();
      await this.snapshotStore.write(fallbackWithHistory);
      return fallbackWithHistory;
    }
  }
}

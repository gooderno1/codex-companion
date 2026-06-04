import type {
  AppPreferences,
  DashboardSnapshot,
  LimitWindow,
  OverviewProjectItem,
  PeriodMetric,
  QuotaResetEvent,
  QuotaUsageSegment,
  SessionAttribution,
  SourceStatus,
  WidgetMetric
} from "../../shared/contracts";
import { SnapshotStore } from "../state/snapshotStore";
import { SettingsStore } from "../state/settingsStore";
import { addMinutes, startOfDay, startOfMonth, startOfWeek } from "../utils/time";
import {
  collectCodexData,
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

const WEEKLY_RATE_LIMIT_WINDOW_MINUTES = 7 * 24 * 60;
const QUOTA_RESET_DROP_THRESHOLD_PERCENT = 5;
const QUOTA_RESET_MIN_SEGMENT_PERCENT = 50;
const QUOTA_RESET_DEDUPE_WINDOW_MS = 12 * 60 * 60 * 1000;

interface QuotaCycleObservation {
  observedAt: string;
  usedPercent: number;
  resetsAt: string | null;
  sourceId: string | null;
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

function getObservedWindow(
  snapshot: LatestRateSnapshot | null,
  windowKey: "primary" | "secondary"
): ObservedLimitWindow | null {
  return windowKey === "primary" ? snapshot?.primary ?? null : snapshot?.secondary ?? null;
}

function isUsableQuotaWindow(
  windowInfo: ObservedLimitWindow | null,
  expectedWindowMinutes: number | null = null
) {
  const windowMinutes = Number(windowInfo?.windowMinutes ?? 0);
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0 || !windowInfo?.resetsAt) {
    return false;
  }

  if (expectedWindowMinutes === null) {
    return true;
  }

  return Math.abs(windowMinutes - expectedWindowMinutes) <= 60;
}

function resolveQuotaCycleBounds(
  timestamp: string,
  anchorEndAt: string,
  windowMinutes: number
) {
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

function isQuotaResetObservation(
  previous: QuotaCycleObservation,
  current: QuotaCycleObservation
) {
  const previousResetMs = new Date(previous.resetsAt ?? 0).getTime();
  const currentResetMs = new Date(current.resetsAt ?? 0).getTime();
  const resetMovedForward = currentResetMs > previousResetMs + 60 * 1000;
  const droppedFromPrevious =
    previous.usedPercent - current.usedPercent >= QUOTA_RESET_DROP_THRESHOLD_PERCENT;
  const startsFromMeaningfulUsage =
    previous.usedPercent >= QUOTA_RESET_MIN_SEGMENT_PERCENT;

  return (
    Number.isFinite(previousResetMs) &&
    Number.isFinite(currentResetMs) &&
    resetMovedForward &&
    droppedFromPrevious &&
    startsFromMeaningfulUsage
  );
}

function analyzeQuotaObservations(observations: QuotaCycleObservation[]) {
  const ordered = observations
    .filter((item) => Number.isFinite(item.usedPercent))
    .sort((left, right) => {
      const timeDiff = new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return right.usedPercent - left.usedPercent;
    });

  const sourceGroups = new Map<string, QuotaCycleObservation[]>();
  for (const observation of ordered) {
    const sourceId = observation.sourceId ?? "__unknown__";
    const group = sourceGroups.get(sourceId) ?? [];
    group.push(observation);
    sourceGroups.set(sourceId, group);
  }

  const resetCandidates: Array<{
    at: string;
    beforeObservedAt: string;
    beforeUsedPercent: number;
    afterUsedPercent: number;
    beforeWindowResetsAt: string | null;
    afterWindowResetsAt: string | null;
  }> = [];

  for (const group of sourceGroups.values()) {
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1];
      const current = group[index];
      if (!isQuotaResetObservation(previous, current)) {
        continue;
      }

      resetCandidates.push({
        at: current.observedAt,
        beforeObservedAt: previous.observedAt,
        beforeUsedPercent: previous.usedPercent,
        afterUsedPercent: current.usedPercent,
        beforeWindowResetsAt: previous.resetsAt,
        afterWindowResetsAt: current.resetsAt
      });
    }
  }

  const resetEvents: typeof resetCandidates = [];
  for (const candidate of resetCandidates.sort(
    (left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()
  )) {
    const candidateAtMs = new Date(candidate.at).getTime();
    const duplicate = resetEvents.some((event) => {
      const eventAtMs = new Date(event.at).getTime();
      const eventAfterResetMs = new Date(event.afterWindowResetsAt ?? 0).getTime();
      const candidateAfterResetMs = new Date(candidate.afterWindowResetsAt ?? 0).getTime();
      return (
        Number.isFinite(candidateAtMs) &&
        Number.isFinite(eventAtMs) &&
        Math.abs(candidateAtMs - eventAtMs) <= QUOTA_RESET_DEDUPE_WINDOW_MS &&
        Math.abs(candidate.beforeUsedPercent - event.beforeUsedPercent) <= 1 &&
        (!Number.isFinite(eventAfterResetMs) ||
          !Number.isFinite(candidateAfterResetMs) ||
          Math.abs(candidateAfterResetMs - eventAfterResetMs) <=
            QUOTA_RESET_DEDUPE_WINDOW_MS)
      );
    });

    if (!duplicate) {
      resetEvents.push(candidate);
    }
  }

  const usageSegments =
    resetEvents.length > 0
      ? resetEvents.map((event, index) => ({
          usedPercent: event.beforeUsedPercent,
          maxObservedAt: event.beforeObservedAt,
          startAt: index === 0 ? ordered[0]?.observedAt ?? event.beforeObservedAt : resetEvents[index - 1].at,
          endAt: event.at
        }))
      : [];

  if (resetEvents.length === 0) {
    const maxObservation = ordered.reduce<QuotaCycleObservation | null>(
      (best, item) => (item.usedPercent > (best?.usedPercent ?? -1) ? item : best),
      null
    );
    if (maxObservation) {
      usageSegments.push({
        usedPercent: maxObservation.usedPercent,
        maxObservedAt: maxObservation.observedAt,
        startAt: ordered[0]?.observedAt ?? maxObservation.observedAt,
        endAt: ordered.at(-1)?.observedAt ?? maxObservation.observedAt
      });
    }
  }

  const lastReset = resetEvents.at(-1);
  if (lastReset) {
    const lastResetWindowMs = new Date(lastReset.afterWindowResetsAt ?? 0).getTime();
    const postResetMax = ordered
      .filter((item) => {
        const itemResetMs = new Date(item.resetsAt ?? 0).getTime();
        return (
          new Date(item.observedAt).getTime() > new Date(lastReset.at).getTime() &&
          (!Number.isFinite(lastResetWindowMs) ||
            !Number.isFinite(itemResetMs) ||
            itemResetMs >= lastResetWindowMs - 60 * 1000)
        );
      })
      .reduce<QuotaCycleObservation | null>(
        (best, item) => (item.usedPercent > (best?.usedPercent ?? -1) ? item : best),
        null
      );
    if (postResetMax && postResetMax.usedPercent > 0) {
      usageSegments.push({
        usedPercent: postResetMax.usedPercent,
        maxObservedAt: postResetMax.observedAt,
        startAt: lastReset.at,
        endAt: ordered.at(-1)?.observedAt ?? postResetMax.observedAt
      });
    }
  }

  const cumulativeUsedPercent =
    usageSegments.length > 0
      ? roundTo(
          usageSegments.reduce((sum, segment) => sum + segment.usedPercent, 0),
          2
        )
      : null;

  return {
    cumulativeUsedPercent,
    resetCount: resetEvents.length,
    resetEvents,
    usageSegments
  };
}

function buildQuotaWindowUsage(args: {
  latestRateSnapshot: LatestRateSnapshot | null;
  events: CodexTokenEvent[];
  quotaObservations: QuotaObservation[];
  windowKey: "primary" | "secondary";
  expectedWindowMinutes?: number | null;
}): QuotaWindowUsage {
  const currentWindow = getObservedWindow(args.latestRateSnapshot, args.windowKey);
  if (!isUsableQuotaWindow(currentWindow, args.expectedWindowMinutes ?? null)) {
    return { currentCycle: null, cycles: [] };
  }

  const usableWindow = currentWindow as ObservedLimitWindow;
  const anchorEndAt = usableWindow.resetsAt;
  const windowMinutes = usableWindow.windowMinutes;
  if (!anchorEndAt || !windowMinutes) {
    return { currentCycle: null, cycles: [] };
  }

  const buckets = new Map<
    string,
    {
      cycleKey: string;
      startAt: string;
      endAt: string;
      tokens: ReturnType<typeof emptyTokens>;
      apiCostUsd: number;
      creditsEstimate: number;
      sessionIds: Set<string>;
      observations: QuotaCycleObservation[];
      maxObservedUsedPercent: number | null;
      lastObservedAt: string | null;
      lastObservedUsedPercent: number | null;
    }
  >();

  const getBucket = (timestamp: string) => {
    const bounds = resolveQuotaCycleBounds(timestamp, anchorEndAt, windowMinutes);
    if (!bounds) {
      return null;
    }

    const existing = buckets.get(bounds.key);
    if (existing) {
      return existing;
    }

    const bucket = {
      cycleKey: bounds.key,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      tokens: emptyTokens(),
      apiCostUsd: 0,
      creditsEstimate: 0,
      sessionIds: new Set<string>(),
      observations: [],
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

  for (const observation of args.quotaObservations) {
    const windowInfo = getObservedWindow(observation.rateLimits, args.windowKey);
    if (!isUsableQuotaWindow(windowInfo, args.expectedWindowMinutes ?? null)) {
      continue;
    }

    const usedPercent = clampPercentage(windowInfo?.usedPercent ?? null);
    if (usedPercent === null) {
      continue;
    }

    const bucket = getBucket(observation.timestamp);
    if (!bucket) {
      continue;
    }

    bucket.observations.push({
      observedAt: observation.timestamp,
      usedPercent,
      resetsAt: windowInfo?.resetsAt ?? null,
      sourceId: observation.sessionId
    });
    bucket.maxObservedUsedPercent =
      bucket.maxObservedUsedPercent === null
        ? usedPercent
        : Math.max(bucket.maxObservedUsedPercent, usedPercent);
    if (
      !bucket.lastObservedAt ||
      new Date(observation.timestamp).getTime() >= new Date(bucket.lastObservedAt).getTime()
    ) {
      bucket.lastObservedAt = observation.timestamp;
      bucket.lastObservedUsedPercent = usedPercent;
    }
  }

  if (args.latestRateSnapshot) {
    const latestUsedPercent = clampPercentage(usableWindow.usedPercent);
    const currentBucket = getBucket(args.latestRateSnapshot.observedAt);
    if (currentBucket && latestUsedPercent !== null) {
      currentBucket.observations.push({
        observedAt: args.latestRateSnapshot.observedAt,
        usedPercent: latestUsedPercent,
        resetsAt: usableWindow.resetsAt,
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
      const usedPercent =
        analysis.cumulativeUsedPercent ??
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
        resetCount: analysis.resetCount,
        observations: bucket.observations.length,
        resetEvents: analysis.resetEvents,
        usageSegments: analysis.usageSegments
      };
    });

  const currentCycleKey = args.latestRateSnapshot
    ? resolveQuotaCycleBounds(
        args.latestRateSnapshot.observedAt,
        anchorEndAt,
        windowMinutes
      )?.key ?? null
    : null;

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
  estimatedValueBasisUsedPercent: number | null = null
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
        ? roundTo(estimatedFullValueUsd - estimatedSpentUsd, 4)
        : null,
    note
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

function aggregateCodeFromRepos(
  repoItems: Awaited<ReturnType<typeof collectGitData>>["items"],
  field:
    | "today"
    | "sevenDays"
    | "naturalWeek"
    | "month"
    | "fiveHour"
    | "weekLimit"
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
    | "weekLimit";
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
    pendingWindow("primary", "5 小时额度"),
    pendingWindow("secondary", "周额度"),
    pendingWindow("observableMonth", "可观测月额度")
  ];

  return {
    generatedAt: now.toISOString(),
    generatedFrom: "pending",
    sourceHealth: {
      codexHome: "",
      repoRoots: preferences.repoRoots,
      sessionFilesScanned: 0,
      archivedFilesScanned: 0,
      repoCount: 0,
      lastObservedAt: null,
      sourceStatus: "pending",
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
          weekLimit: []
        }
      },
      apiValueSummaryUsd: null
    },
    ledger: {
      periods: [today, naturalWeek, month, fiveHour, weekLimit],
      models: [],
      sessions: [],
      limitWindows
    },
    repositories: {
      roots: preferences.repoRoots,
      items: [],
      summary: {
        totalTracked: 0,
        attributedTokens: 0,
        todayChangedLines: 0,
        weekChangedLines: 0,
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
  now = new Date()
): Promise<DashboardSnapshot> {
  const codex = await collectCodexData(now);
  const primaryQuotaUsage = buildQuotaWindowUsage({
    latestRateSnapshot: codex.latestRateSnapshot,
    events: codex.events,
    quotaObservations: codex.quotaObservations,
    windowKey: "primary"
  });
  const weeklyQuotaUsage = buildQuotaWindowUsage({
    latestRateSnapshot: codex.latestRateSnapshot,
    events: codex.events,
    quotaObservations: codex.quotaObservations,
    windowKey: "secondary",
    expectedWindowMinutes: WEEKLY_RATE_LIMIT_WINDOW_MINUTES
  });
  const primaryWindowRange = primaryQuotaUsage.currentCycle
    ? {
        start: new Date(primaryQuotaUsage.currentCycle.startAt),
        end: new Date(primaryQuotaUsage.currentCycle.endAt)
      }
    : codex.latestRateSnapshot?.primary?.resetsAt &&
        codex.latestRateSnapshot.primary.windowMinutes
      ? {
          start: addMinutes(
            new Date(codex.latestRateSnapshot.primary.resetsAt),
            -codex.latestRateSnapshot.primary.windowMinutes
          ),
          end: new Date(codex.latestRateSnapshot.primary.resetsAt)
        }
      : null;
  const secondaryWindowRange = weeklyQuotaUsage.currentCycle
    ? {
        start: new Date(weeklyQuotaUsage.currentCycle.startAt),
        end: new Date(weeklyQuotaUsage.currentCycle.endAt)
      }
    : codex.latestRateSnapshot?.secondary?.resetsAt &&
        codex.latestRateSnapshot.secondary.windowMinutes
      ? {
          start: addMinutes(
            new Date(codex.latestRateSnapshot.secondary.resetsAt),
            -codex.latestRateSnapshot.secondary.windowMinutes
          ),
          end: new Date(codex.latestRateSnapshot.secondary.resetsAt)
        }
      : null;
  const git = await collectGitData({
    repoRoots: preferences.repoRoots,
    sessions: codex.sessions,
    activityWindows: [
      ...(primaryWindowRange
        ? [{ key: "fiveHour" as const, start: primaryWindowRange.start, end: primaryWindowRange.end }]
        : []),
      ...(secondaryWindowRange
        ? [{ key: "weekLimit" as const, start: secondaryWindowRange.start, end: secondaryWindowRange.end }]
        : [])
    ],
    now
  });

  const todayStart = startOfDay(now);
  const sevenDayStart = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const naturalWeekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

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
    codex.events
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

  const primaryPeriod = primaryWindowRange
    ? buildQuotaCyclePeriodMetric(
        "currentFiveHour",
        "当前 5 小时窗口",
        primaryQuotaUsage.currentCycle,
        primaryWindowRange.start,
        primaryWindowRange.end,
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
    primaryQuotaUsage.cycles.length > 1
      ? buildQuotaCyclePeriodMetric(
          "previousFiveHour",
          "上一 5 小时窗口",
          primaryQuotaUsage.cycles.at(-2) ?? null,
          primaryWindowRange?.start ?? todayStart,
          primaryWindowRange?.end ?? now
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
  const billingMonthPeriod: PeriodMetric | null = null;
  const previousBillingMonthPeriod: PeriodMetric | null = null;

  const primaryWindow = buildLimitWindow(
    "primary",
    "5 小时额度",
    resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus),
    codex.latestRateSnapshot?.primary
      ? {
          ...codex.latestRateSnapshot.primary,
          remainingPercent:
            codex.latestRateSnapshot.primary.usedPercent === null
              ? null
              : 100 - codex.latestRateSnapshot.primary.usedPercent,
          observedAt: codex.latestRateSnapshot.observedAt
      }
      : undefined,
    primaryPeriod.apiCostUsd,
    "圆环=最近余量；右侧=当前周期累计。",
    primaryPeriod.quotaEvidence?.usedPercent ?? null
  );
  const weeklyWindow = buildLimitWindow(
    "secondary",
    "周额度",
    resolveWindowSourceStatus(codex.latestRateSnapshot, codex.sourceStatus),
    codex.latestRateSnapshot?.secondary
      ? {
          ...codex.latestRateSnapshot.secondary,
          remainingPercent:
            codex.latestRateSnapshot.secondary.usedPercent === null
              ? null
              : 100 - codex.latestRateSnapshot.secondary.usedPercent,
          observedAt: codex.latestRateSnapshot.observedAt
      }
      : undefined,
    weeklyLimitPeriod.apiCostUsd,
    "圆环=最近余量；右侧=当前周期累计。",
    weeklyLimitPeriod.quotaEvidence?.usedPercent ?? null
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
  const billingProjectFiveHour = primaryWindowRange
    ? buildProjectOverviewPeriod({
        repoItems: git.items,
        events: codex.events,
        sessionRepoMap: git.sessionRepoMap,
        startAt: primaryWindowRange.start,
        endAt: primaryWindowRange.end,
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
      notes: [
        ...codex.notes,
        "代码改动基于 Git 已提交历史与当前工作区 diff，不读取云端仓库信息。"
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
          weekLimit: billingProjectWeekLimit
        }
      },
      apiValueSummaryUsd: weeklyWindow.estimatedFullValueUsd
    },
    ledger: {
      periods: [
        todayPeriod,
        naturalWeekPeriod,
        monthPeriod,
        primaryPeriod,
        weeklyLimitPeriod
      ],
      models: modelMetrics,
      sessions,
      limitWindows: [primaryWindow, weeklyWindow, observableMonthWindow]
    },
    repositories: {
      roots: git.roots,
      items: git.items.sort((left, right) => right.tokens.total - left.tokens.total),
      summary: {
        totalTracked: git.items.length,
        attributedTokens: git.items.reduce(
          (sum, repo) => sum + repo.tokens.total,
          0
        ),
        todayChangedLines: git.items.reduce(
          (sum, repo) => sum + repo.activity.today.changedLines,
          0
        ),
        weekChangedLines: git.items.reduce(
          (sum, repo) => sum + repo.activity.naturalWeek.changedLines,
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
        ? `最近刷新 ${new Date(codex.lastObservedAt).toLocaleString("zh-CN")}`
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
    private readonly snapshotStore: SnapshotStore
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

  public async getSnapshot(force = false): Promise<DashboardSnapshot> {
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
      void this.refreshSnapshotInBackground()?.catch(() => {
        // Foreground calls surface collection failures through getSnapshot(true).
      });
      return pending;
    }

    return this.collectSnapshot();
  }

  public async getCachedSnapshot(): Promise<DashboardSnapshot | null> {
    if (this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    const cached = await this.snapshotStore.read();
    if (!cached) {
      return null;
    }

    this.cachedSnapshot = {
      ...cached,
      generatedFrom: "cache"
    };
    this.cachedAt = Date.now();
    return this.cachedSnapshot;
  }

  public refreshSnapshotInBackground(): Promise<DashboardSnapshot> | null {
    if (this.collectingSnapshot) {
      return this.collectingSnapshot;
    }

    return this.collectSnapshot();
  }

  private async collectSnapshot(): Promise<DashboardSnapshot> {
    if (this.collectingSnapshot) {
      return this.collectingSnapshot;
    }

    this.collectingSnapshot = this.collectSnapshotInner().finally(() => {
      this.collectingSnapshot = null;
    });

    return this.collectingSnapshot;
  }

  private async collectSnapshotInner(): Promise<DashboardSnapshot> {
    const preferences = await this.settingsStore.read();
    try {
      const snapshot = await collectDashboardSnapshot(preferences);
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
      const fallback: DashboardSnapshot = {
        ...cached,
        generatedAt: new Date().toISOString(),
        generatedFrom: "cache",
        sourceHealth: {
          ...cached.sourceHealth,
          notes: [...cached.sourceHealth.notes, `实时采集失败，已回退缓存：${message}`]
        }
      };
      this.cachedSnapshot = fallback;
      this.cachedAt = Date.now();
      return fallback;
    }
  }
}

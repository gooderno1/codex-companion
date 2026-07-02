import path from "node:path";

import type {
  AppPage,
  DashboardSnapshot,
  LimitWindow,
  PeriodMetric
} from "../shared/contracts";
import { readJsonFile, writeJsonFile } from "./utils/fs";

const NOTIFICATION_STATE_FILE_NAME = "notification-state.json";
const SENT_RECORD_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const BANKED_RESET_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOW_QUOTA_WARNING_THRESHOLD = 20;
const LOW_QUOTA_DANGER_THRESHOLD = 10;

export interface DashboardNotification {
  key: string;
  title: string;
  body: string;
  page: AppPage;
}

interface SentNotificationRecord {
  key: string;
  title: string;
  body: string;
  lastSentAt: string;
}

interface NotificationState {
  sent: Record<string, SentNotificationRecord>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNotificationState(value: unknown): NotificationState {
  const sentValue = isRecord(value) && isRecord(value.sent) ? value.sent : {};
  const sent: Record<string, SentNotificationRecord> = {};

  for (const [key, recordValue] of Object.entries(sentValue)) {
    if (!isRecord(recordValue)) {
      continue;
    }

    const lastSentAt = recordValue.lastSentAt;
    if (typeof lastSentAt !== "string") {
      continue;
    }

    sent[key] = {
      key,
      title: typeof recordValue.title === "string" ? recordValue.title : "",
      body: typeof recordValue.body === "string" ? recordValue.body : "",
      lastSentAt
    };
  }

  return { sent };
}

function pruneSentNotifications(
  sent: Record<string, SentNotificationRecord>,
  nowMs: number
): Record<string, SentNotificationRecord> {
  const kept: Record<string, SentNotificationRecord> = {};

  for (const [key, record] of Object.entries(sent)) {
    const sentMs = new Date(record.lastSentAt).getTime();
    if (!Number.isFinite(sentMs) || nowMs - sentMs > SENT_RECORD_TTL_MS) {
      continue;
    }

    kept[key] = record;
  }

  return kept;
}

function dateMs(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }

  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : null;
}

function formatNotificationDate(iso: string | null | undefined): string {
  if (!iso) {
    return "时间待确认";
  }

  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) {
    return "时间待确认";
  }

  return value.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatNotificationPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function quotaRemainingPercent(windowData: LimitWindow, period: PeriodMetric): number | null {
  const value = period.quotaEvidence?.remainingPercent ?? windowData.remainingPercent;
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function buildLowQuotaNotifications(snapshot: DashboardSnapshot): DashboardNotification[] {
  const windows: Array<{
    key: "fiveHour" | "weekLimit";
    label: string;
    windowData: LimitWindow;
    period: PeriodMetric;
  }> = [
    {
      key: "fiveHour",
      label: "5H 额度",
      windowData: snapshot.overview.limitWindows[0],
      period: snapshot.overview.windowPeriods.fiveHour
    },
    {
      key: "weekLimit",
      label: "周额度",
      windowData: snapshot.overview.limitWindows[1],
      period: snapshot.overview.windowPeriods.weekLimit
    }
  ];

  return windows.flatMap(({ key, label, windowData, period }) => {
    if (!windowData || windowData.sourceStatus !== "observed") {
      return [];
    }

    const remainingPercent = quotaRemainingPercent(windowData, period);
    if (remainingPercent === null || remainingPercent > LOW_QUOTA_WARNING_THRESHOLD) {
      return [];
    }

    const tier =
      remainingPercent <= LOW_QUOTA_DANGER_THRESHOLD ? "danger" : "warning";
    const threshold =
      tier === "danger" ? LOW_QUOTA_DANGER_THRESHOLD : LOW_QUOTA_WARNING_THRESHOLD;
    const cycleKey = `${period.startAt}:${period.endAt}`;
    const cycleLabel = `${formatNotificationDate(period.startAt)} - ${formatNotificationDate(
      period.endAt
    )}`;

    return [
      {
        key: `quota:${key}:${cycleKey}:${tier}`,
        title: `${label}剩余不足 ${threshold}%`,
        body: `当前剩余 ${formatNotificationPercent(
          remainingPercent
        )}，周期 ${cycleLabel}。数据来自本机 rate_limits 快照。`,
        page: "overview" as AppPage
      }
    ];
  });
}

function sortBankedResetCredits(
  credits: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"]
) {
  return [...credits].sort((left, right) => {
    const leftMs =
      dateMs(left.safeEstimatedExpiresAt) ??
      dateMs(left.estimatedExpiresAt) ??
      dateMs(left.firstObservedAt) ??
      Number.POSITIVE_INFINITY;
    const rightMs =
      dateMs(right.safeEstimatedExpiresAt) ??
      dateMs(right.estimatedExpiresAt) ??
      dateMs(right.firstObservedAt) ??
      Number.POSITIVE_INFINITY;
    return leftMs - rightMs;
  });
}

function buildBankedResetGroupKey(
  kind: string,
  credits: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"]
): string {
  return `banked-reset:${kind}:${credits
    .map(
      (credit) =>
        `${credit.id}:${credit.safeEstimatedExpiresAt ?? credit.estimatedExpiresAt ?? credit.firstObservedAt}`
    )
    .sort()
    .join("|")}`;
}

function buildBankedResetNotifications(snapshot: DashboardSnapshot): DashboardNotification[] {
  const summary = snapshot.overview.bankedResetCredits;
  const availableCount = summary.availableCount ?? 0;
  if (
    availableCount <= 0 ||
    (summary.sourceStatus !== "observed" && summary.sourceStatus !== "stale")
  ) {
    return [];
  }

  const nowMs = dateMs(snapshot.generatedAt) ?? Date.now();
  const credits = sortBankedResetCredits(summary.activeCredits);
  if (credits.length === 0) {
    return [];
  }

  const estimableCredits = credits.filter(
    (credit) => credit.estimateBasis !== "existing-at-first-observation"
  );
  const expired = estimableCredits.filter((credit) => {
    const expiresMs = dateMs(credit.estimatedExpiresAt);
    return expiresMs !== null && expiresMs <= nowMs;
  });
  const due = estimableCredits.filter((credit) => {
    const safeMs = dateMs(credit.safeEstimatedExpiresAt);
    const expiresMs = dateMs(credit.estimatedExpiresAt);
    return safeMs !== null && safeMs <= nowMs && !(expiresMs !== null && expiresMs <= nowMs);
  });
  const soon = estimableCredits.filter((credit) => {
    const safeMs = dateMs(credit.safeEstimatedExpiresAt);
    return (
      safeMs !== null &&
      safeMs > nowMs &&
      safeMs - nowMs <= BANKED_RESET_NOTICE_WINDOW_MS
    );
  });
  const unknown = credits.filter(
    (credit) => credit.estimateBasis === "existing-at-first-observation"
  );

  if (expired.length > 0) {
    const earliest = expired[0];
    return [
      {
        key: buildBankedResetGroupKey("expired", expired),
        title: "赠送重置可能已到期",
        body: `有 ${expired.length} 次赠送重置按估算已到过期时间，最早 ${formatNotificationDate(
          earliest.estimatedExpiresAt
        )}；当前共 ${availableCount} 次可用。`,
        page: "overview"
      }
    ];
  }

  if (due.length > 0) {
    const earliest = due[0];
    return [
      {
        key: buildBankedResetGroupKey("due", due),
        title: "赠送重置建议尽快使用",
        body: `有 ${due.length} 次赠送重置已到保守提醒时间，预计最早 ${formatNotificationDate(
          earliest.estimatedExpiresAt
        )} 过期；当前共 ${availableCount} 次可用。`,
        page: "overview"
      }
    ];
  }

  if (soon.length > 0) {
    const earliest = soon[0];
    return [
      {
        key: buildBankedResetGroupKey("soon", soon),
        title: "赠送重置即将到提醒时间",
        body: `有 ${soon.length} 次赠送重置将在 24 小时内到达建议使用时间，最早 ${formatNotificationDate(
          earliest.safeEstimatedExpiresAt
        )}；预计 ${formatNotificationDate(earliest.estimatedExpiresAt)} 过期。`,
        page: "overview"
      }
    ];
  }

  if (unknown.length > 0) {
    return [
      {
        key: buildBankedResetGroupKey("unknown", unknown),
        title: "赠送重置过期时间待确认",
        body: `有 ${unknown.length} 次赠送重置早于首次观测获得，无法反推过期时间；建议优先确认或使用。`,
        page: "overview"
      }
    ];
  }

  return [];
}

export function buildDashboardNotificationCandidates(
  snapshot: DashboardSnapshot
): DashboardNotification[] {
  if (snapshot.generatedFrom !== "live") {
    return [];
  }

  return [
    ...buildBankedResetNotifications(snapshot),
    ...buildLowQuotaNotifications(snapshot)
  ];
}

export class DashboardNotificationService {
  private readonly statePath: string;

  public constructor(userDataPath: string) {
    this.statePath = path.join(userDataPath, NOTIFICATION_STATE_FILE_NAME);
  }

  public async takeUnsentNotifications(
    snapshot: DashboardSnapshot
  ): Promise<DashboardNotification[]> {
    const candidates = buildDashboardNotificationCandidates(snapshot);
    if (candidates.length === 0) {
      return [];
    }

    const state = normalizeNotificationState(await readJsonFile<unknown>(this.statePath));
    const now = new Date();
    const sent = pruneSentNotifications(state.sent, now.getTime());
    const unsent = candidates.filter((candidate) => !sent[candidate.key]);

    if (unsent.length === 0) {
      return [];
    }

    for (const notification of unsent) {
      sent[notification.key] = {
        key: notification.key,
        title: notification.title,
        body: notification.body,
        lastSentAt: now.toISOString()
      };
    }

    await writeJsonFile(this.statePath, { sent });
    return unsent;
  }
}

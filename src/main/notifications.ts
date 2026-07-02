import path from "node:path";

import type {
  AppPage,
  DashboardNotificationCategory,
  DashboardNotificationEntry,
  DashboardNotificationTone,
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
const NOTIFICATION_HISTORY_LIMIT = 80;

export interface DashboardNotification {
  key: string;
  title: string;
  body: string;
  page: AppPage;
  category: DashboardNotificationCategory;
  tone: DashboardNotificationTone;
}

interface NotificationState {
  notifications: DashboardNotificationEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNotificationState(value: unknown): NotificationState {
  const notificationValues =
    isRecord(value) && Array.isArray(value.notifications)
      ? value.notifications
      : [];
  const notifications: DashboardNotificationEntry[] = [];

  for (const recordValue of notificationValues) {
    if (!isRecord(recordValue)) {
      continue;
    }

    const key = recordValue.key;
    const createdAt = recordValue.createdAt;
    const lastTriggeredAt = recordValue.lastTriggeredAt;
    if (
      typeof key !== "string" ||
      typeof createdAt !== "string" ||
      typeof lastTriggeredAt !== "string"
    ) {
      continue;
    }

    notifications.push({
      key,
      title: typeof recordValue.title === "string" ? recordValue.title : "",
      body: typeof recordValue.body === "string" ? recordValue.body : "",
      page: normalizeNotificationPage(recordValue.page),
      category: normalizeNotificationCategory(recordValue.category),
      tone: normalizeNotificationTone(recordValue.tone),
      createdAt,
      lastTriggeredAt,
      systemNotifiedAt:
        typeof recordValue.systemNotifiedAt === "string"
          ? recordValue.systemNotifiedAt
          : null,
      readAt: typeof recordValue.readAt === "string" ? recordValue.readAt : null
    });
  }

  if (notifications.length > 0) {
    return { notifications: sortNotifications(notifications) };
  }

  const legacySent = isRecord(value) && isRecord(value.sent) ? value.sent : {};
  for (const [key, recordValue] of Object.entries(legacySent)) {
    if (!isRecord(recordValue)) {
      continue;
    }

    const lastSentAt = recordValue.lastSentAt;
    if (typeof lastSentAt !== "string") {
      continue;
    }

    notifications.push({
      key,
      title: typeof recordValue.title === "string" ? recordValue.title : "",
      body: typeof recordValue.body === "string" ? recordValue.body : "",
      page: "overview",
      category: key.startsWith("quota:") ? "quota" : "banked-reset",
      tone: key.includes(":danger") ? "danger" : "warning",
      createdAt: lastSentAt,
      lastTriggeredAt: lastSentAt,
      systemNotifiedAt: lastSentAt,
      readAt: null
    });
  }

  return { notifications: sortNotifications(notifications) };
}

function pruneSentNotifications(
  notifications: DashboardNotificationEntry[],
  nowMs: number
): DashboardNotificationEntry[] {
  const kept: DashboardNotificationEntry[] = [];

  for (const notification of notifications) {
    const triggeredMs = new Date(notification.lastTriggeredAt).getTime();
    if (!Number.isFinite(triggeredMs) || nowMs - triggeredMs > SENT_RECORD_TTL_MS) {
      continue;
    }

    kept.push(notification);
  }

  return sortNotifications(kept).slice(0, NOTIFICATION_HISTORY_LIMIT);
}

function normalizeNotificationPage(value: unknown): AppPage {
  return value === "ledger" ||
    value === "repositories" ||
    value === "settings" ||
    value === "widget" ||
    value === "overview"
    ? value
    : "overview";
}

function normalizeNotificationCategory(value: unknown): DashboardNotificationCategory {
  return value === "quota" ? "quota" : "banked-reset";
}

function normalizeNotificationTone(value: unknown): DashboardNotificationTone {
  return value === "danger" || value === "info" || value === "warning"
    ? value
    : "warning";
}

function sortNotifications(
  notifications: DashboardNotificationEntry[]
): DashboardNotificationEntry[] {
  return [...notifications].sort(
    (left, right) =>
      new Date(right.lastTriggeredAt).getTime() - new Date(left.lastTriggeredAt).getTime()
  );
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
        page: "overview" as AppPage,
        category: "quota",
        tone: tier === "danger" ? "danger" : "warning"
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
        page: "overview",
        category: "banked-reset",
        tone: "danger"
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
        page: "overview",
        category: "banked-reset",
        tone: "warning"
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
        page: "overview",
        category: "banked-reset",
        tone: "warning"
      }
    ];
  }

  if (unknown.length > 0) {
    return [
      {
        key: buildBankedResetGroupKey("unknown", unknown),
        title: "赠送重置过期时间待确认",
        body: `有 ${unknown.length} 次赠送重置早于首次观测获得，无法反推过期时间；建议优先确认或使用。`,
        page: "overview",
        category: "banked-reset",
        tone: "warning"
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

  public async getNotifications(): Promise<DashboardNotificationEntry[]> {
    const state = await this.readState();
    return state.notifications;
  }

  public async markNotificationsRead(
    keys?: string[]
  ): Promise<DashboardNotificationEntry[]> {
    const state = await this.readState();
    const keySet = keys ? new Set(keys) : null;
    const readAt = new Date().toISOString();
    const notifications = state.notifications.map((notification) => {
      if (notification.readAt || (keySet && !keySet.has(notification.key))) {
        return notification;
      }

      return {
        ...notification,
        readAt
      };
    });

    await this.writeState({ notifications });
    return sortNotifications(notifications);
  }

  public async takeUnsentNotifications(
    snapshot: DashboardSnapshot
  ): Promise<DashboardNotificationEntry[]> {
    const candidates = buildDashboardNotificationCandidates(snapshot);
    if (candidates.length === 0) {
      return [];
    }

    const now = new Date();
    const state = await this.readState();
    const existingByKey = new Map(
      pruneSentNotifications(state.notifications, now.getTime()).map((notification) => [
        notification.key,
        notification
      ])
    );
    const unsent: DashboardNotificationEntry[] = [];

    for (const candidate of candidates) {
      const existing = existingByKey.get(candidate.key);
      if (existing) {
        existingByKey.set(candidate.key, {
          ...existing,
          title: candidate.title,
          body: candidate.body,
          page: candidate.page,
          category: candidate.category,
          tone: candidate.tone,
          lastTriggeredAt: now.toISOString()
        });
        continue;
      }

      const notification: DashboardNotificationEntry = {
        ...candidate,
        createdAt: now.toISOString(),
        lastTriggeredAt: now.toISOString(),
        systemNotifiedAt: now.toISOString(),
        readAt: null
      };
      existingByKey.set(candidate.key, notification);
      unsent.push(notification);
    }

    if (unsent.length > 0 || candidates.length > 0) {
      await this.writeState({
        notifications: sortNotifications([...existingByKey.values()]).slice(
          0,
          NOTIFICATION_HISTORY_LIMIT
        )
      });
    }

    return unsent;
  }

  private async readState(): Promise<NotificationState> {
    return normalizeNotificationState(await readJsonFile<unknown>(this.statePath));
  }

  private async writeState(state: NotificationState): Promise<void> {
    await writeJsonFile(this.statePath, {
      notifications: sortNotifications(state.notifications).slice(
        0,
        NOTIFICATION_HISTORY_LIMIT
      )
    });
  }
}

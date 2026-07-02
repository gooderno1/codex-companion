import path from "node:path";

import type {
  AppPage,
  DashboardNotificationCategory,
  DashboardNotificationEntry,
  DashboardNotificationTone,
  DashboardSnapshot,
  LimitWindow,
  NotificationDeliveryMode,
  NotificationPreferences,
  PeriodMetric
} from "../shared/contracts";
import { readJsonFile, writeJsonFile } from "./utils/fs";

const NOTIFICATION_STATE_FILE_NAME = "notification-state.json";
const SENT_RECORD_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const LOW_QUOTA_WARNING_THRESHOLD = 20;
const LOW_QUOTA_DANGER_THRESHOLD = 10;
const NOTIFICATION_HISTORY_LIMIT = 80;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const BANKED_RESET_EXPIRATION_MILESTONES = [
  { key: "1h", label: "1 小时", ms: HOUR_MS, tone: "danger" },
  { key: "12h", label: "12 小时", ms: 12 * HOUR_MS, tone: "danger" },
  { key: "1d", label: "1 天", ms: DAY_MS, tone: "warning" },
  { key: "3d", label: "3 天", ms: 3 * DAY_MS, tone: "warning" },
  { key: "7d", label: "1 周", ms: 7 * DAY_MS, tone: "warning" }
] as const;

type BankedResetExpirationMilestone =
  (typeof BANKED_RESET_EXPIRATION_MILESTONES)[number];

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

function normalizeNotificationPreferences(
  preferences?: NotificationPreferences | null
): NotificationPreferences {
  const deliveryMode = preferences?.deliveryMode;
  return {
    deliveryMode:
      deliveryMode === "important" ||
      deliveryMode === "quiet" ||
      deliveryMode === "off" ||
      deliveryMode === "balanced"
        ? deliveryMode
        : "balanced"
  };
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
    return { notifications: collapseDuplicateNotifications(notifications) };
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

  return { notifications: collapseDuplicateNotifications(notifications) };
}

function latestIso(left: string | null, right: string | null): string | null {
  const leftMs = dateMs(left);
  const rightMs = dateMs(right);
  if (leftMs === null) {
    return right;
  }
  if (rightMs === null) {
    return left;
  }
  return rightMs > leftMs ? right : left;
}

function earliestIso(left: string, right: string): string {
  const leftMs = dateMs(left);
  const rightMs = dateMs(right);
  if (leftMs === null) {
    return right;
  }
  if (rightMs === null) {
    return left;
  }
  return rightMs < leftMs ? right : left;
}

function notificationContentKey(
  notification: Pick<
    DashboardNotificationEntry,
    "title" | "body" | "page" | "category" | "tone"
  >
): string {
  return [
    notification.page,
    notification.category,
    notification.tone,
    notification.title,
    notification.body
  ].join("\u001f");
}

function collapseDuplicateNotifications(
  notifications: DashboardNotificationEntry[]
): DashboardNotificationEntry[] {
  const byContent = new Map<string, DashboardNotificationEntry>();

  for (const notification of sortNotifications(notifications)) {
    const contentKey = notificationContentKey(notification);
    const existing = byContent.get(contentKey);
    if (!existing) {
      byContent.set(contentKey, notification);
      continue;
    }

    byContent.set(contentKey, {
      ...existing,
      key: existing.key.length <= notification.key.length ? existing.key : notification.key,
      createdAt: earliestIso(existing.createdAt, notification.createdAt),
      lastTriggeredAt:
        latestIso(existing.lastTriggeredAt, notification.lastTriggeredAt) ??
        existing.lastTriggeredAt,
      systemNotifiedAt: latestIso(existing.systemNotifiedAt, notification.systemNotifiedAt),
      readAt:
        existing.readAt && notification.readAt
          ? latestIso(existing.readAt, notification.readAt)
          : null
    });
  }

  return sortNotifications([...byContent.values()]).slice(0, NOTIFICATION_HISTORY_LIMIT);
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

  return collapseDuplicateNotifications(kept);
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
  const stableDates = credits
    .map((credit) => credit.safeEstimatedExpiresAt ?? credit.estimatedExpiresAt ?? credit.firstObservedAt)
    .sort()
    .join("|");
  return `banked-reset:${kind}:${credits.length}:${stableDates}`;
}

function bankedResetExpirationMilestone(
  expiresAt: string | null | undefined,
  nowMs: number
): BankedResetExpirationMilestone | "expired" | null {
  const expiresMs = dateMs(expiresAt);
  if (expiresMs === null) {
    return null;
  }

  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) {
    return "expired";
  }

  return (
    BANKED_RESET_EXPIRATION_MILESTONES.find(
      (milestone) => remainingMs <= milestone.ms
    ) ?? null
  );
}

function buildBankedResetExpirationKey(
  milestone: BankedResetExpirationMilestone | "expired",
  expiresAt: string
) {
  return `banked-reset:expiration:${milestone === "expired" ? "expired" : milestone.key}:${expiresAt}`;
}

function countCreditsByExpiration(
  credits: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"]
) {
  const counts = new Map<string, number>();

  for (const credit of credits) {
    if (!credit.estimatedExpiresAt) {
      continue;
    }

    counts.set(
      credit.estimatedExpiresAt,
      (counts.get(credit.estimatedExpiresAt) ?? 0) + 1
    );
  }

  return counts;
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
    (credit) =>
      credit.estimateBasis !== "existing-at-first-observation" &&
      credit.estimatedExpiresAt
  );
  const unknown = credits.filter(
    (credit) => credit.estimateBasis === "existing-at-first-observation"
  );
  const expirationCounts = countCreditsByExpiration(estimableCredits);
  const expirationNotifications = [...expirationCounts.entries()].flatMap(
    ([expiresAt, count]): DashboardNotification[] => {
      const milestone = bankedResetExpirationMilestone(expiresAt, nowMs);
      if (!milestone) {
        return [];
      }

      if (milestone === "expired") {
        return [
          {
            key: buildBankedResetExpirationKey(milestone, expiresAt),
            title: "赠送重置可能已到期",
            body: `有 ${count} 次赠送重置按估算已到过期时间 ${formatNotificationDate(
              expiresAt
            )}；当前共 ${availableCount} 次可用。`,
            page: "overview",
            category: "banked-reset",
            tone: "danger"
          }
        ];
      }

      return [
        {
          key: buildBankedResetExpirationKey(milestone, expiresAt),
          title: `赠送重置将在 ${milestone.label} 内过期`,
          body: `有 ${count} 次赠送重置预计 ${formatNotificationDate(
            expiresAt
          )} 过期；这是 ${milestone.label} 前的一次性提醒，当前共 ${availableCount} 次可用。`,
          page: "overview",
          category: "banked-reset",
          tone: milestone.tone
        }
      ];
    }
  );

  if (expirationNotifications.length > 0) {
    return expirationNotifications;
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

function isImportantNotification(candidate: DashboardNotification): boolean {
  return (
    candidate.tone === "danger" ||
    candidate.key.startsWith("banked-reset:expiration:1h") ||
    candidate.key.startsWith("banked-reset:expiration:12h")
  );
}

function shouldStoreCandidate(
  candidate: DashboardNotification,
  mode: NotificationDeliveryMode
): boolean {
  if (mode === "off") {
    return false;
  }

  if (mode === "important") {
    return isImportantNotification(candidate);
  }

  return true;
}

function shouldShowSystemNotification(
  candidate: DashboardNotification,
  mode: NotificationDeliveryMode
): boolean {
  if (mode === "off" || mode === "quiet") {
    return false;
  }

  if (mode === "important") {
    return isImportantNotification(candidate);
  }

  return true;
}

function findEquivalentNotification(
  existingByKey: Map<string, DashboardNotificationEntry>,
  candidate: DashboardNotification
): [string, DashboardNotificationEntry] | null {
  const candidateContentKey = notificationContentKey(candidate);
  for (const entry of existingByKey.entries()) {
    if (notificationContentKey(entry[1]) === candidateContentKey) {
      return entry;
    }
  }

  return null;
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
    snapshot: DashboardSnapshot,
    preferences?: NotificationPreferences | null
  ): Promise<DashboardNotificationEntry[]> {
    const normalizedPreferences = normalizeNotificationPreferences(preferences);
    const candidates = buildDashboardNotificationCandidates(snapshot).filter(
      (candidate) =>
        shouldStoreCandidate(candidate, normalizedPreferences.deliveryMode)
    );
    if (candidates.length === 0) {
      return [];
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const state = await this.readState();
    const existingByKey = new Map(
      pruneSentNotifications(state.notifications, nowMs).map((notification) => [
        notification.key,
        notification
      ])
    );
    const unsent: DashboardNotificationEntry[] = [];

    for (const candidate of candidates) {
      const equivalent = findEquivalentNotification(existingByKey, candidate);
      const existing = existingByKey.get(candidate.key) ?? equivalent?.[1];
      if (existing) {
        if (equivalent && equivalent[0] !== candidate.key) {
          existingByKey.delete(equivalent[0]);
        }
        existingByKey.set(candidate.key, {
          ...existing,
          key: candidate.key,
          title: candidate.title,
          body: candidate.body,
          page: candidate.page,
          category: candidate.category,
          tone: candidate.tone,
          lastTriggeredAt: existing.lastTriggeredAt,
          systemNotifiedAt: existing.systemNotifiedAt,
          readAt: existing.readAt
        });
        continue;
      }

      const showSystem = shouldShowSystemNotification(
        candidate,
        normalizedPreferences.deliveryMode
      );
      const notification: DashboardNotificationEntry = {
        ...candidate,
        createdAt: nowIso,
        lastTriggeredAt: nowIso,
        systemNotifiedAt: showSystem ? nowIso : null,
        readAt: null
      };
      existingByKey.set(candidate.key, notification);
      if (showSystem) {
        unsent.push(notification);
      }
    }

    if (unsent.length > 0 || candidates.length > 0) {
      await this.writeState({
        notifications: collapseDuplicateNotifications([...existingByKey.values()])
      });
    }

    return unsent;
  }

  private async readState(): Promise<NotificationState> {
    return normalizeNotificationState(await readJsonFile<unknown>(this.statePath));
  }

  private async writeState(state: NotificationState): Promise<void> {
    await writeJsonFile(this.statePath, {
      notifications: collapseDuplicateNotifications(state.notifications)
    });
  }
}

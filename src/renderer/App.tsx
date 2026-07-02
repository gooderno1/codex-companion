import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties
} from "react";

import appPackage from "../../package.json";
import type {
  AppPage,
  AppPreferences,
  DashboardNotificationEntry,
  DashboardSnapshot,
  GitIntegrationStatus,
  LedgerAnalysisPeriod,
  LedgerTimeBucket,
  LimitWindow,
  ModelMetric,
  OverviewProjectItem,
  PeriodMetric,
  RepoMetric,
  RefreshHistoryEntry,
  RefreshTrigger,
  SourceStatus,
  TokenBreakdown,
  WidgetMetric
} from "../shared/contracts";
import { BrandMark, Glyph, type IconName } from "./icons";

const NAV_ITEMS: Array<{
  page: Extract<AppPage, "overview" | "ledger" | "repositories" | "notifications">;
  label: string;
  icon: IconName;
}> = [
  { page: "overview", label: "总览", icon: "overview" },
  { page: "ledger", label: "Codex 账本", icon: "ledger" },
  { page: "repositories", label: "代码仓库", icon: "repo" },
  { page: "notifications", label: "通知", icon: "bell" }
];

const PAGE_META: Record<
  Extract<AppPage, "overview" | "ledger" | "repositories" | "notifications" | "refresh-history" | "settings">,
  { title: string; subtitle: string }
> = {
  overview: {
    title: "总览",
    subtitle: "Codex 使用、额度与本地工程活动"
  },
  ledger: {
    title: "Codex 账本",
    subtitle: "构成强度、周期细账与会话归因"
  },
  repositories: {
    title: "代码仓库",
    subtitle: "同步 Git 仓库活动与 Codex 投入"
  },
  notifications: {
    title: "通知",
    subtitle: "额度提醒、赠送重置和通知历史"
  },
  "refresh-history": {
    title: "刷新历史",
    subtitle: "手动、自动和启动刷新记录"
  },
  settings: {
    title: "设置",
    subtitle: "数据源、计费口径、Git 与本机边界"
  }
};

type OverviewMode = "natural" | "billing";
type NaturalProjectPeriod = "day" | "week" | "month";
type BillingProjectPeriod = "fiveHour" | "weekLimit" | "billingMonth";
type ProjectSort = "name" | "token" | "cost" | "code" | "commits" | "sessions" | "recent";
type RepoSort = "name" | "today" | "sevenDays" | "month" | "codex" | "recentCommit";
type SortDirection = "asc" | "desc";
type ProjectIconTone = "blue" | "teal" | "green" | "amber" | "rose";
type QuotaTone = "blue" | "green";
type LedgerTrendPeriod = "day" | "week" | "month";
type LedgerTrendSeriesKey =
  | "total"
  | "input"
  | "rawInput"
  | "cachedInput"
  | "output"
  | "reasoningOutput";
type LedgerAnalysisKey = "sevenDays" | "thirtyDays" | "cumulative";
type ModelContributionSort = "model" | "share" | "token" | "cost" | "events";

interface ProjectSortState {
  key: ProjectSort;
  direction: SortDirection;
}

interface RepoSortState {
  key: RepoSort;
  direction: SortDirection;
}

interface ModelContributionSortState {
  key: ModelContributionSort;
  direction: SortDirection;
}

type TrendSeriesVisibility = Record<LedgerTrendSeriesKey, boolean>;

interface OverviewMetricCardData {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone: "blue" | "teal" | "amber" | "neutral" | "muted";
  sourceStatus: SourceStatus;
}

function resolvePageFromHash(): AppPage {
  const hash = window.location.hash.replace(/^#\//, "").split("?")[0];
  if (
    hash === "ledger" ||
    hash === "repositories" ||
    hash === "notifications" ||
    hash === "refresh-history" ||
    hash === "settings" ||
    hash === "widget"
  ) {
    return hash;
  }
  return "overview";
}

function resolveOverviewModeFromHash(): OverviewMode {
  const [, query = ""] = window.location.hash.split("?");
  const params = new URLSearchParams(query);
  return params.get("overviewMode") === "natural" ? "natural" : "billing";
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatCompactToken(value: number | null) {
  if (value === null) {
    return "未观测";
  }

  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)} 亿`;
  }

  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)} 万`;
  }

  return formatNumber(Math.round(value));
}

function formatUsd(value: number | null) {
  if (value === null) {
    return "未观测";
  }

  if (value >= 100) {
    return `$${value.toFixed(0)}`;
  }

  if (value >= 10) {
    return `$${value.toFixed(1)}`;
  }

  return `$${value.toFixed(2)}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function describeDelta(
  current: number | null,
  previous: number | null,
  compareLabel: string
) {
  if (current === null || previous === null) {
    return "数据待补齐";
  }

  if (previous === 0 && current === 0) {
    return `较${compareLabel} 持平`;
  }

  if (previous === 0) {
    return `较${compareLabel} 新增`;
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return `较${compareLabel} ${formatSignedPercent(delta)}`;
}

function formatTime(iso: string | null) {
  if (!iso) {
    return "--:--";
  }

  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatDurationMs(value: number | null) {
  if (value === null) {
    return "耗时待记录";
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  return `${(value / 1000).toFixed(1)} 秒`;
}

function formatMonthDay(iso: string | null) {
  if (!iso) {
    return "--";
  }

  return new Date(iso).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) {
    return "--";
  }

  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatQuotaPeriodRange(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return "--";
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  const durationMs = end.getTime() - start.getTime();

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return `${formatTime(startIso)} - ${formatTime(endIso)}`;
  }

  if (isSameLocalDate(start, end)) {
    return `${formatTime(startIso)} - ${formatTime(endIso)}`;
  }

  if (durationMs < 24 * 60 * 60 * 1000) {
    return `${formatDateTime(startIso)} - ${formatDateTime(endIso)}`;
  }

  return `${formatMonthDay(startIso)} - ${formatMonthDay(endIso)}`;
}

function formatShortDate(iso: string | null) {
  if (!iso) {
    return "--";
  }

  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatRelativeTime(iso: string | null, baseIso?: string | null) {
  if (!iso) {
    return "--";
  }

  const value = new Date(iso);
  const base = baseIso ? new Date(baseIso) : new Date();
  const diffMs = base.getTime() - value.getTime();

  if (!Number.isFinite(diffMs)) {
    return formatShortDate(iso);
  }

  const absMinutes = Math.round(Math.abs(diffMs) / (60 * 1000));
  const absHours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));
  const absDays = Math.round(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
  const suffix = diffMs >= 0 ? "前" : "后";

  if (absMinutes < 1) {
    return "刚刚";
  }

  if (absMinutes < 60) {
    return `${absMinutes} 分钟${suffix}`;
  }

  if (absHours < 24) {
    return `${absHours} 小时${suffix}`;
  }

  if (absDays < 7) {
    return `${absDays} 天${suffix}`;
  }

  return formatShortDate(iso);
}

function sourceStatusLabel(status: SourceStatus) {
  const mapping: Record<SourceStatus, string> = {
    observed: "已观测",
    pending: "待刷新",
    unobserved: "未观测",
    stale: "数据过期"
  };

  return mapping[status];
}

function sourceStatusClass(status: SourceStatus) {
  return `status-${status}`;
}

function bankedResetCreditSortTime(credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]) {
  const value = credit.safeEstimatedExpiresAt ?? credit.estimatedExpiresAt ?? credit.firstObservedAt;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function isUnknownBankedResetCredit(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]
) {
  return credit.estimateBasis === "existing-at-first-observation";
}

function formatBankedResetExpiryLine(summary: DashboardSnapshot["overview"]["bankedResetCredits"]) {
  const count = summary.availableCount ?? 0;
  if (summary.sourceStatus === "pending") {
    return "正在读取赠送重置次数";
  }

  if (summary.sourceStatus === "unobserved" && count === 0) {
    return "暂未读取到赠送重置次数";
  }

  if (count <= 0) {
    return "当前没有可用赠送重置";
  }

  const earliest = [...summary.activeCredits].sort(
    (left, right) => bankedResetCreditSortTime(left) - bankedResetCreditSortTime(right)
  )[0];
  if (!earliest) {
    return "过期时间待后续采样确认";
  }

  const unknownCount = summary.activeCredits.filter(isUnknownBankedResetCredit).length;
  const earliestKnown = [...summary.activeCredits]
    .filter((credit) => !isUnknownBankedResetCredit(credit))
    .sort((left, right) => bankedResetCreditExpirySortTime(left) - bankedResetCreditExpirySortTime(right))[0];

  if (unknownCount > 0) {
    if (earliestKnown) {
      return `${unknownCount} 次过期时间无法反推；${formatBankedResetKnownExpirySummary(
        earliestKnown,
        "最早已知预计过期"
      )}`;
    }

    return "过期时间无法反推，建议尽快使用";
  }

  return formatBankedResetKnownExpirySummary(earliest, "最早预计过期");
}

function bankedResetCreditExpirySortTime(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]
) {
  const value = credit.estimatedExpiresAt ?? credit.safeEstimatedExpiresAt ?? credit.firstObservedAt;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function formatBankedResetKnownExpirySummary(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number],
  label: string
) {
  const expiryText = credit.estimatedExpiresAt
    ? formatDateTime(credit.estimatedExpiresAt)
    : "待后续采样确认";
  if (credit.safeEstimatedExpiresAt) {
    return `${label} ${expiryText}；建议 ${formatDateTime(credit.safeEstimatedExpiresAt)} 前使用`;
  }

  return `${label} ${expiryText}`;
}

function formatBankedResetCreditAcquire(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]
) {
  if (credit.acquiredAt) {
    let suffix = "";
    if (credit.estimateBasis === "public-grant") {
      suffix = "（公开发放估算）";
    }
    if (credit.estimateBasis === "assumed-grant") {
      suffix = "（按确认口径假定）";
    }
    return `${formatDateTime(credit.acquiredAt)}${suffix}`;
  }

  return `早于 ${formatDateTime(credit.firstObservedAt)}`;
}

function formatBankedResetCreditExpiry(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]
) {
  if (credit.estimateBasis === "existing-at-first-observation") {
    return "预计过期 无法反推";
  }

  let suffix = "";
  if (credit.estimateBasis === "public-grant") {
    suffix = "（按公开发放时间 + 30 天估算）";
  }
  if (credit.estimateBasis === "assumed-grant") {
    suffix = "（按假定获取时间 + 30 天估算）";
  }
  return `预计过期 ${formatDateTime(credit.estimatedExpiresAt)}${suffix}`;
}

function formatBankedResetCreditSafeUse(
  credit: DashboardSnapshot["overview"]["bankedResetCredits"]["activeCredits"][number]
) {
  if (isUnknownBankedResetCredit(credit)) {
    return "建议尽快使用";
  }

  return `建议 ${formatDateTime(credit.safeEstimatedExpiresAt)} 前使用`;
}

function BankedResetCreditStrip({
  summary
}: {
  summary: DashboardSnapshot["overview"]["bankedResetCredits"];
}) {
  const activeCredits = [...summary.activeCredits].sort(
    (left, right) => bankedResetCreditSortTime(left) - bankedResetCreditSortTime(right)
  );
  const availableCount = summary.availableCount ?? 0;
  const hasDetails = activeCredits.length > 0 || summary.events.length > 0 || summary.note;

  return (
    <details className={`banked-reset-strip ${hasDetails ? "" : "is-empty"}`}>
      <summary>
        <span className="banked-reset-summary">
          <span className="banked-reset-icon">
            <Glyph name="clock" />
          </span>
          <span>
            赠送重置可用 <strong>{availableCount}</strong> 次 · {formatBankedResetExpiryLine(summary)}
          </span>
        </span>
        <span className={`status-pill ${sourceStatusClass(summary.sourceStatus)}`}>
          {sourceStatusLabel(summary.sourceStatus)}
        </span>
      </summary>

      {hasDetails ? (
        <div className="banked-reset-details">
          <div className="banked-reset-detail-grid">
            {activeCredits.length > 0 ? (
              activeCredits.map((credit, index) => (
                <article className="banked-reset-detail-item" key={credit.id}>
                  <span>赠送重置 #{index + 1}</span>
                  <strong>{formatBankedResetCreditExpiry(credit)}</strong>
                  <p>获取 {formatBankedResetCreditAcquire(credit)}</p>
                  <p>{formatBankedResetCreditSafeUse(credit)}</p>
                </article>
              ))
            ) : (
              <article className="banked-reset-detail-item">
                <span>当前库存</span>
                <strong>{availableCount} 次</strong>
                <p>暂无逐个明细</p>
                <p>等待后续采样确认</p>
              </article>
            )}
          </div>
          <div className="banked-reset-footer">
            <span>推断获得 {summary.inferredGrantCount} 次</span>
            <span>推断使用 {summary.inferredUseCount} 次</span>
            <span>可能过期 {summary.inferredExpirationCount} 次</span>
            {summary.inferredUnknownDecreaseCount > 0 ? (
              <span>减少待判定 {summary.inferredUnknownDecreaseCount} 次</span>
            ) : null}
            {summary.note ? <span>{summary.note}</span> : null}
          </div>
        </div>
      ) : null}
    </details>
  );
}

type RefreshFeedback = {
  phase: "loading" | "refreshing" | "done" | "error";
  title: string;
  detail: string;
};

function refreshSourceLabel(snapshot: DashboardSnapshot) {
  if (snapshot.generatedFrom === "live") {
    return "实时快照";
  }

  if (snapshot.generatedFrom === "cache") {
    return "缓存快照";
  }

  return "待刷新快照";
}

function refreshTelemetryDetail(snapshot: DashboardSnapshot) {
  const refresh = snapshot.sourceHealth.refresh;
  const parts = [
    refreshSourceLabel(snapshot),
    formatDurationMs(refresh.durationMs),
    `新解析 ${refresh.codexFilesParsed} 个`,
    `复用 ${refresh.codexFilesReused} 个`
  ];

  if (refresh.codexCachePruned > 0) {
    parts.push(`清理 ${refresh.codexCachePruned} 个旧缓存`);
  }

  if (snapshot.sourceHealth.lastObservedAt) {
    parts.push(`最新观测 ${formatDateTime(snapshot.sourceHealth.lastObservedAt)}`);
  }

  return parts.join(" · ");
}

function refreshTriggerLabel(trigger: RefreshTrigger) {
  const mapping: Record<RefreshTrigger, string> = {
    manual: "手动刷新",
    auto: "自动刷新",
    startup: "启动刷新",
    background: "后台刷新"
  };

  return mapping[trigger];
}

function generatedFromLabel(value: DashboardSnapshot["generatedFrom"]) {
  const mapping: Record<DashboardSnapshot["generatedFrom"], string> = {
    live: "实时",
    cache: "缓存",
    pending: "采集中"
  };

  return mapping[value];
}

function notificationCategoryLabel(category: DashboardNotificationEntry["category"]) {
  const mapping: Record<DashboardNotificationEntry["category"], string> = {
    "banked-reset": "赠送重置",
    quota: "额度提醒"
  };

  return mapping[category];
}

function notificationToneLabel(tone: DashboardNotificationEntry["tone"]) {
  const mapping: Record<DashboardNotificationEntry["tone"], string> = {
    info: "提示",
    warning: "提醒",
    danger: "紧急"
  };

  return mapping[tone];
}

function notificationToneClass(tone: DashboardNotificationEntry["tone"]) {
  return `notification-${tone}`;
}

function gitIdentityLabel(gitStatus: GitIntegrationStatus | null) {
  if (!gitStatus) {
    return "检测中";
  }

  if (!gitStatus.available) {
    return "Git 不可用";
  }

  return gitStatus.userName && gitStatus.userEmail ? "本机身份已配置" : "身份待补齐";
}

function maskValue(value: string, privacyMode: boolean) {
  return privacyMode ? "••••" : value;
}

function metricToneClass(tone: WidgetMetric["tone"]) {
  return `tone-${tone}`;
}

function SectionCard({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={`surface-card${className ? ` ${className}` : ""}`}>{children}</section>;
}

function TextTabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline"
}: {
  items: Array<{ value: T; label: string; disabled?: boolean; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  variant?: "underline" | "chip";
}) {
  return (
    <div className={`text-tabs text-tabs-${variant}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === value ? "active" : ""}
          disabled={item.disabled}
          title={item.title}
          onClick={() => {
            if (!item.disabled) {
              onChange(item.value);
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function deltaToneClass(detail: string) {
  if (detail.includes("-")) {
    return "is-negative";
  }

  if (detail.includes("+") || detail.includes("新增")) {
    return "is-positive";
  }

  return "is-neutral";
}

function projectIconTone(projectName: string): ProjectIconTone {
  const tones: ProjectIconTone[] = ["blue", "teal", "green", "amber", "rose"];
  const hash = [...projectName].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  return tones[hash % tones.length];
}

function repoDisplayName(repo: RepoMetric) {
  return repo.fullName ?? "未配置远端";
}

function latestRepoCommitAt(repo: RepoMetric) {
  return repo.recentCommits[0]?.authoredAt ?? repo.lastCodexAt ?? repo.lastSyncedAt;
}

function buildRepositoryCards(snapshot: DashboardSnapshot): OverviewMetricCardData[] {
  const { summary } = snapshot.repositories;
  const sourceStatus = snapshot.sourceHealth.sourceStatus;

  return [
    {
      key: "repoToday",
      label: "今日改动",
      value: `${formatNumber(summary.todayChangedLines)} 行`,
      detail: "已同步仓库中的今日累计",
      icon: "code",
      tone: "blue",
      sourceStatus
    },
    {
      key: "repoSevenDays",
      label: "近 7 日改动",
      value: `${formatNumber(summary.sevenDayChangedLines)} 行`,
      detail: "滚动 7 日累计改动",
      icon: "calendar",
      tone: "teal",
      sourceStatus
    },
    {
      key: "repoMonth",
      label: "本月改动",
      value: `${formatNumber(summary.monthChangedLines)} 行`,
      detail: "自然月累计改动",
      icon: "month",
      tone: "amber",
      sourceStatus
    },
    {
      key: "repoSynced",
      label: "同步仓库",
      value: formatNumber(summary.totalTracked),
      detail: `${formatNumber(summary.attributedRepoCount)} 个有 Codex 归因`,
      icon: "repo",
      tone: "neutral",
      sourceStatus
    }
  ];
}

function MetricCard({
  card
}: {
  card: OverviewMetricCardData;
}) {
  const shouldShowStatus = card.sourceStatus !== "observed";

  return (
    <article className={`metric-card metric-${card.tone}${shouldShowStatus ? " has-status" : ""}`}>
      <div className="metric-card-main">
        <span className="metric-icon">
          <Glyph name={card.icon} />
        </span>
        <div className="metric-card-copy">
          <div className="metric-card-title">{card.label}</div>
          <div className="metric-card-value">{card.value}</div>
          <div className={`metric-card-detail ${deltaToneClass(card.detail)}`}>{card.detail}</div>
        </div>
      </div>
      {shouldShowStatus ? (
        <span className={`metric-status ${sourceStatusClass(card.sourceStatus)}`}>
          {sourceStatusLabel(card.sourceStatus)}
        </span>
      ) : null}
    </article>
  );
}

function QuotaWindowCard({
  title,
  windowData,
  period,
  models,
  tone = "blue"
}: {
  title: string;
  windowData: LimitWindow;
  period: PeriodMetric;
  models: ModelMetric[];
  tone?: QuotaTone;
}) {
  const ringStyle = {
    "--quota-progress": `${Math.max(0, Math.min(windowData.remainingPercent ?? 0, 100))}%`
  } as CSSProperties;
  const quotaEvidence = period.quotaEvidence;

  return (
    <SectionCard className={`quota-card quota-${tone}`}>
      <div className="quota-card-head">
        <div className="quota-title">
          <span className="quota-title-icon">
            <Glyph name="clock" />
          </span>
          <h3>{title}</h3>
        </div>
        <span className={`status-pill ${sourceStatusClass(windowData.sourceStatus)}`}>
          {sourceStatusLabel(windowData.sourceStatus)}
        </span>
      </div>

      <div className="quota-card-body">
        <div className="quota-ring-block">
          <div className="quota-ring" style={ringStyle}>
            <div className="quota-ring-inner">
              <span>剩余量</span>
              <strong>
                {windowData.remainingPercent === null
                  ? "--"
                  : `${windowData.remainingPercent.toFixed(0)}%`}
              </strong>
            </div>
          </div>
          <div className="quota-reset-label">
            重置 {formatDateTime(windowData.resetsAt)} · 周期{" "}
            {formatQuotaPeriodRange(period.startAt, period.endAt)}
          </div>
        </div>

        <div className="quota-metrics">
          {[
            { icon: "token" as const, label: "Token 用量", value: `${formatCompactToken(period.tokens.total)} tok` },
            { icon: "cost" as const, label: "API 等价成本", value: formatUsd(period.apiCostUsd) },
            { icon: "code" as const, label: "代码行数", value: `${formatNumber(period.code.changedLines)} 行` },
            { icon: "session" as const, label: "会话数", value: String(period.sessions) }
          ].map((item) => (
            <div className="quota-metric-row" key={item.label}>
              <span className="quota-metric-label">
                <span className="quota-metric-icon">
                  <Glyph name={item.icon} />
                </span>
                {item.label}
              </span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="quota-models">
        <div className="quota-models-head">
          <div className="quota-models-title">Top 3 模型占比</div>
          {quotaEvidence ? (
            <span className="quota-evidence">
              观测 {quotaEvidence.observations} 次 · 重置 {quotaEvidence.resetCount} 次
            </span>
          ) : null}
        </div>
        {models.length > 0 ? (
          models.map((model) => (
            <div className="quota-model-row" key={model.model}>
              <div className="quota-model-label">
                <strong>{model.model}</strong>
                <span>{formatCompactToken(model.tokens.total)}</span>
              </div>
              <div className="quota-model-bar">
                <span style={{ width: `${Math.min(model.sharePercent, 100)}%` }} />
              </div>
              <div className="quota-model-share">{model.sharePercent.toFixed(1)}%</div>
            </div>
          ))
        ) : (
          <div className="empty-inline">暂无模型样本</div>
        )}
      </div>
    </SectionCard>
  );
}

function buildOverviewCards(
  snapshot: DashboardSnapshot,
  mode: OverviewMode
): OverviewMetricCardData[] {
  const billingMonth = snapshot.overview.windowPeriods.billingMonth;
  const globalSourceStatus = snapshot.sourceHealth.sourceStatus;

  if (mode === "natural") {
    return [
      {
        key: "todayTokens",
        label: "今日 Token",
        value: formatCompactToken(snapshot.overview.today.tokens.total),
        detail: describeDelta(
          snapshot.overview.today.tokens.total,
          snapshot.overview.previous.yesterday.tokens.total,
          "昨日"
        ),
        icon: "token",
        tone: "blue",
        sourceStatus: globalSourceStatus
      },
      {
        key: "weekTokens",
        label: "本周 Token",
        value: formatCompactToken(snapshot.overview.naturalWeek.tokens.total),
        detail: describeDelta(
          snapshot.overview.naturalWeek.tokens.total,
          snapshot.overview.previous.naturalWeek.tokens.total,
          "上周"
        ),
        icon: "calendar",
        tone: "teal",
        sourceStatus: globalSourceStatus
      },
      {
        key: "monthTokens",
        label: "本月 Token",
        value: formatCompactToken(snapshot.overview.month.tokens.total),
        detail: describeDelta(
          snapshot.overview.month.tokens.total,
          snapshot.overview.previous.month.tokens.total,
          "上月"
        ),
        icon: "month",
        tone: "amber",
        sourceStatus: globalSourceStatus
      },
      {
        key: "todayCode",
        label: "今日代码改动",
        value: `${formatNumber(snapshot.overview.today.code.changedLines)} 行`,
        detail: describeDelta(
          snapshot.overview.today.code.changedLines,
          snapshot.overview.previous.yesterday.code.changedLines,
          "昨日"
        ),
        icon: "code",
        tone: "neutral",
        sourceStatus: globalSourceStatus
      }
    ];
  }

  return [
    {
      key: "todayTokens",
      label: "今日 Token",
      value: formatCompactToken(snapshot.overview.today.tokens.total),
      detail: describeDelta(
        snapshot.overview.today.tokens.total,
        snapshot.overview.previous.yesterday.tokens.total,
        "昨日"
      ),
      icon: "token",
      tone: "blue",
      sourceStatus: globalSourceStatus
    },
    {
      key: "weekTokens",
      label: "本周 Token",
      value: formatCompactToken(snapshot.overview.windowPeriods.weekLimit.tokens.total),
      detail: describeDelta(
        snapshot.overview.windowPeriods.weekLimit.tokens.total,
        snapshot.overview.previous.weekLimit?.tokens.total ?? null,
        "上个额度周"
      ),
      icon: "calendar",
      tone: "teal",
      sourceStatus: globalSourceStatus
    },
    {
      key: "monthTokens",
      label: "本月 Token",
      value: billingMonth ? formatCompactToken(billingMonth.tokens.total) : "未观测",
      detail: billingMonth
        ? describeDelta(
            billingMonth.tokens.total,
            snapshot.overview.previous.billingMonth?.tokens.total ?? null,
            "上个计费月"
          )
        : "计费月数据待补齐",
      icon: "month",
      tone: billingMonth ? "amber" : "muted",
      sourceStatus: billingMonth ? globalSourceStatus : "unobserved"
    },
    {
      key: "todayCode",
      label: "今日代码改动",
      value: `${formatNumber(snapshot.overview.today.code.changedLines)} 行`,
      detail: describeDelta(
        snapshot.overview.today.code.changedLines,
        snapshot.overview.previous.yesterday.code.changedLines,
        "昨日"
      ),
      icon: "code",
      tone: "neutral",
      sourceStatus: globalSourceStatus
    }
  ];
}

function sortProjectRows(rows: OverviewProjectItem[], sort: ProjectSortState) {
  return [...rows].sort((left, right) => {
    let comparison: number;

    if (sort.key === "name") {
      comparison = left.name.localeCompare(right.name, "zh-CN");
    } else if (sort.key === "cost") {
      comparison = left.apiCostUsd - right.apiCostUsd;
    } else if (sort.key === "code") {
      comparison = left.codeChangedLines - right.codeChangedLines;
    } else if (sort.key === "commits") {
      comparison = left.commits - right.commits;
    } else if (sort.key === "sessions") {
      comparison = left.sessions - right.sessions;
    } else if (sort.key === "recent") {
      comparison = (left.recentActivityAt ?? "").localeCompare(right.recentActivityAt ?? "");
    } else {
      comparison = left.tokenTotal - right.tokenTotal;
    }

    if (comparison !== 0) {
      return sort.direction === "asc" ? comparison : -comparison;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function ProjectSortHeader({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: ProjectSort;
  sort: ProjectSortState;
  onSort: (key: ProjectSort) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const indicator = isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
  const nextDirection = isActive && sort.direction === "asc" ? "倒序" : "正序";

  return (
    <th className={isActive ? "sort-active" : ""} aria-sort={ariaSort}>
      <button
        type="button"
        className={`project-sort-heading${isActive ? " active" : ""}`}
        onClick={() => onSort(sortKey)}
        aria-label={`按${label}${nextDirection}排序`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

function sortRepoRows(rows: RepoMetric[], sort: RepoSortState) {
  return [...rows].sort((left, right) => {
    let comparison: number;

    if (sort.key === "name") {
      comparison = left.name.localeCompare(right.name, "zh-CN");
    } else if (sort.key === "today") {
      comparison = left.activity.today.changedLines - right.activity.today.changedLines;
    } else if (sort.key === "sevenDays") {
      comparison = left.activity.sevenDays.changedLines - right.activity.sevenDays.changedLines;
    } else if (sort.key === "month") {
      comparison = left.activity.month.changedLines - right.activity.month.changedLines;
    } else if (sort.key === "codex") {
      comparison = left.tokens.total - right.tokens.total;
    } else {
      comparison = (latestRepoCommitAt(left) ?? "").localeCompare(latestRepoCommitAt(right) ?? "");
    }

    if (comparison !== 0) {
      return sort.direction === "asc" ? comparison : -comparison;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function RepoSortHeader({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: RepoSort;
  sort: RepoSortState;
  onSort: (key: RepoSort) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const indicator = isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
  const nextDirection = isActive && sort.direction === "asc" ? "倒序" : "正序";

  return (
    <th className={isActive ? "sort-active" : ""} aria-sort={ariaSort}>
      <button
        type="button"
        className={`project-sort-heading${isActive ? " active" : ""}`}
        onClick={() => onSort(sortKey)}
        aria-label={`按${label}${nextDirection}排序`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

function FooterNote({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <footer className="footer-note">
      <span className="footer-source">
        数据来源：Codex 本地 sessions、archived_sessions、本地 Git；不读取云端仓库信息。
      </span>
      <span className="footer-chip">session {snapshot.sourceHealth.sessionFilesScanned}</span>
      <span className="footer-chip">archived {snapshot.sourceHealth.archivedFilesScanned}</span>
      <span className="footer-chip">仓库 {snapshot.sourceHealth.repoCount}</span>
      <span className="footer-pricing">
        定价来源：{snapshot.pricingMeta.apiRateSource}；{snapshot.pricingMeta.codexRateSource}
      </span>
    </footer>
  );
}

function RepositoriesFooter({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <footer className="footer-note repositories-footer">
      <span className="footer-source">
        数据来源：Codex 本地 sessions、archived_sessions、定时同步 Git 快照；不读取 GitHub 云端元数据。
      </span>
      <span className="footer-chip">最近同步 {formatTime(snapshot.generatedAt)}</span>
      <span className="footer-chip">仓库 {snapshot.repositories.summary.totalTracked}</span>
      <span className="footer-chip">归因 {snapshot.repositories.summary.attributedRepoCount}</span>
    </footer>
  );
}

function RefreshHistoryTable({
  history,
  limit
}: {
  history: RefreshHistoryEntry[];
  limit?: number;
}) {
  const visibleHistory = typeof limit === "number" ? history.slice(0, limit) : history;

  if (visibleHistory.length === 0) {
    return <div className="table-empty">暂无刷新历史。完成一次手动或自动刷新后会显示记录。</div>;
  }

  return (
    <div className="settings-table-wrap">
      <table className="settings-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>来源</th>
            <th>结果</th>
            <th>耗时</th>
            <th>Codex 文件</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {visibleHistory.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDateTime(entry.completedAt)}</td>
              <td>{refreshTriggerLabel(entry.trigger)}</td>
              <td>{generatedFromLabel(entry.generatedFrom)}</td>
              <td>{formatDurationMs(entry.durationMs)}</td>
              <td>
                新解析 {entry.codexFilesParsed} · 复用 {entry.codexFilesReused}
              </td>
              <td>{entry.message ?? sourceStatusLabel(entry.sourceStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RefreshTriggerFilter = "all" | RefreshTrigger;

function RefreshHistoryPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [triggerFilter, setTriggerFilter] = useState<RefreshTriggerFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 12;
  const history = snapshot.sourceHealth.refreshHistory;
  const filteredHistory = useMemo(
    () =>
      history.filter((entry) =>
        triggerFilter === "all" ? true : entry.trigger === triggerFilter
      ),
    [history, triggerFilter]
  );
  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedHistory = filteredHistory.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  );
  const latestRefresh = history[0] ?? null;
  const liveCount = history.filter((entry) => entry.generatedFrom === "live").length;
  const fallbackCount = history.filter((entry) => entry.generatedFrom !== "live").length;

  function changeTriggerFilter(value: RefreshTriggerFilter) {
    setTriggerFilter(value);
    setPageIndex(0);
  }

  return (
    <div className="history-page">
      <section className="history-summary-grid">
        <article>
          <span>全部刷新</span>
          <strong>{formatNumber(history.length)}</strong>
        </article>
        <article>
          <span>实时快照</span>
          <strong>{formatNumber(liveCount)}</strong>
        </article>
        <article>
          <span>缓存或待采集</span>
          <strong>{formatNumber(fallbackCount)}</strong>
        </article>
      </section>

      <SectionCard className="history-workbench">
        <div className="history-page-toolbar">
          <div>
            <h3>刷新记录</h3>
            <p>
              {latestRefresh
                ? `最近一次：${refreshTriggerLabel(latestRefresh.trigger)} · ${formatDateTime(latestRefresh.completedAt)}`
                : "暂无刷新记录"}
            </p>
          </div>
          <div className="history-toolbar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                window.location.hash = "#/settings";
              }}
            >
              返回设置
            </button>
            <TextTabs<RefreshTriggerFilter>
              items={[
                { value: "all", label: "全部" },
                { value: "manual", label: "手动" },
                { value: "auto", label: "自动" },
                { value: "startup", label: "启动" },
                { value: "background", label: "后台" }
              ]}
              value={triggerFilter}
              onChange={changeTriggerFilter}
              variant="chip"
            />
          </div>
        </div>

        <RefreshHistoryTable history={pagedHistory} />

        <div className="history-pagination">
          <button
            type="button"
            className="secondary-button"
            disabled={safePageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            上一页
          </button>
          <span>
            第 {safePageIndex + 1} / {pageCount} 页 · 共 {formatNumber(filteredHistory.length)} 条
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={safePageIndex >= pageCount - 1}
            onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
          >
            下一页
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function normalizeRepoRootsList(values: string[]) {
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  }

  return normalized;
}

function parseRepoRootsInput(value: string) {
  return normalizeRepoRootsList(value.split(/[;\n]/));
}

function sameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
}

function codexDetected(snapshot: DashboardSnapshot | null) {
  return Boolean(
    snapshot &&
      (snapshot.sourceHealth.sourceStatus === "observed" ||
        snapshot.sourceHealth.sessionFilesScanned + snapshot.sourceHealth.archivedFilesScanned > 0)
  );
}

function gitDetected(snapshot: DashboardSnapshot | null) {
  return Boolean(snapshot && snapshot.repositories.summary.totalTracked > 0);
}

function detectionLabel(detected: boolean, pending: boolean) {
  if (pending) {
    return "检测中";
  }

  return detected ? "已检测到" : "未检测到";
}

function detectionClass(detected: boolean, pending: boolean) {
  if (pending) {
    return "is-pending";
  }

  return detected ? "is-ok" : "is-missing";
}

function DataSourceStatusPanel({
  snapshot,
  preferences
}: {
  snapshot: DashboardSnapshot | null;
  preferences: AppPreferences | null;
}) {
  const pending = snapshot?.generatedFrom === "pending";
  const isCodexDetected = codexDetected(snapshot);
  const isGitDetected = gitDetected(snapshot);
  const codexFileCount =
    (snapshot?.sourceHealth.sessionFilesScanned ?? 0) +
    (snapshot?.sourceHealth.archivedFilesScanned ?? 0);

  return (
    <div className="setup-status-grid">
      <article className={`setup-status-item ${detectionClass(isCodexDetected, pending)}`}>
        <div>
          <span>Codex 数据目录</span>
          <strong>{preferences?.codexHome ?? snapshot?.sourceHealth.codexHome ?? "等待检测"}</strong>
        </div>
        <em>{detectionLabel(isCodexDetected, pending)}</em>
        <small>{isCodexDetected ? `已发现 ${formatNumber(codexFileCount)} 个会话文件` : "未命中时请手动选择 .codex 目录"}</small>
      </article>
      <article className={`setup-status-item ${detectionClass(isGitDetected, pending)}`}>
        <div>
          <span>Git 仓库根目录</span>
          <strong>{(preferences?.repoRoots ?? snapshot?.sourceHealth.repoRoots ?? []).join("；") || "等待检测"}</strong>
        </div>
        <em>{detectionLabel(isGitDetected, pending)}</em>
        <small>{isGitDetected ? `已发现 ${formatNumber(snapshot?.repositories.summary.totalTracked ?? 0)} 个仓库` : "未命中时请手动选择代码项目上级目录"}</small>
      </article>
    </div>
  );
}

function FirstLoadPanel({
  snapshot,
  preferences
}: {
  snapshot: DashboardSnapshot | null;
  preferences: AppPreferences | null;
}) {
  return (
    <section className="first-load-panel">
      <div className="first-load-copy">
        <h3>正在首次自动检测本机数据源</h3>
        <p>应用会先尝试默认 Codex 目录和常见代码目录。首次扫描需要解析 Codex 会话并遍历 Git 仓库，耗时可能明显长于后续刷新。</p>
      </div>
      <DataSourceStatusPanel snapshot={snapshot} preferences={preferences} />
    </section>
  );
}

function NotificationCenter({
  notifications,
  onMarkRead
}: {
  notifications: DashboardNotificationEntry[];
  onMarkRead: (keys?: string[]) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const recentNotifications = notifications.slice(0, 8);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        className={`action-button notification-trigger${unreadCount > 0 ? " has-unread" : ""}`}
        title="提醒中心"
        aria-label={`提醒中心，${unreadCount} 条未读`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="button-icon">
          <Glyph name="bell" />
        </span>
        {unreadCount > 0 ? (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-popover" role="dialog" aria-label="提醒详情">
          <div className="notification-popover-head">
            <div>
              <h3>提醒中心</h3>
              <span>{unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读提醒"}</span>
            </div>
            <div className="notification-popover-actions">
              <button
                type="button"
                className="secondary-button notification-read-all"
                onClick={() => {
                  window.location.hash = "#/notifications";
                  setIsOpen(false);
                }}
              >
                查看全部
              </button>
              <button
                type="button"
                className="secondary-button notification-read-all"
                disabled={unreadCount === 0}
                onClick={() => void onMarkRead()}
              >
                全部已读
              </button>
            </div>
          </div>

          <div className="notification-list">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((item) => (
                <article
                  key={item.key}
                  className={`notification-item notification-${item.tone}${
                    item.readAt ? "" : " is-unread"
                  }`}
                >
                  <div className="notification-item-head">
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {notificationCategoryLabel(item.category)} · {notificationToneLabel(item.tone)}
                      </span>
                    </div>
                    <time>{formatDateTime(item.lastTriggeredAt)}</time>
                  </div>
                  <p>{item.body}</p>
                  <div className="notification-item-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        void window.codexCompanion.openPage(item.page);
                        setIsOpen(false);
                      }}
                    >
                      查看页面
                    </button>
                    {!item.readAt ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void onMarkRead([item.key])}
                      >
                        标记已读
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="notification-empty">
                当前没有应用内提醒。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type NotificationStatusFilter = "all" | "unread" | "read";
type NotificationCategoryFilter = "all" | DashboardNotificationEntry["category"];

function NotificationPage({
  notifications,
  onMarkRead
}: {
  notifications: DashboardNotificationEntry[];
  onMarkRead: (keys?: string[]) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(notifications[0]?.key ?? null);
  const pageSize = 10;

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        const statusMatched =
          statusFilter === "all" ||
          (statusFilter === "unread" && !item.readAt) ||
          (statusFilter === "read" && Boolean(item.readAt));
        const categoryMatched =
          categoryFilter === "all" || item.category === categoryFilter;

        return statusMatched && categoryMatched;
      }),
    [categoryFilter, notifications, statusFilter]
  );
  const pageCount = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedNotifications = filteredNotifications.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize
  );
  const selectedNotification =
    filteredNotifications.find((item) => item.key === selectedKey) ??
    filteredNotifications[0] ??
    null;
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const dangerCount = notifications.filter((item) => item.tone === "danger").length;

  function handleStatusFilterChange(value: NotificationStatusFilter) {
    setStatusFilter(value);
    setPageIndex(0);
  }

  function handleCategoryFilterChange(value: NotificationCategoryFilter) {
    setCategoryFilter(value);
    setPageIndex(0);
  }

  return (
    <div className="notifications-page">
      <section className="notification-summary-grid">
        <article>
          <span>全部通知</span>
          <strong>{formatNumber(notifications.length)}</strong>
        </article>
        <article>
          <span>未读</span>
          <strong>{formatNumber(unreadCount)}</strong>
        </article>
        <article>
          <span>紧急</span>
          <strong>{formatNumber(dangerCount)}</strong>
        </article>
      </section>

      <SectionCard className="notifications-workbench">
        <div className="notifications-list-panel">
          <div className="notification-page-toolbar">
            <div>
              <h3>通知历史</h3>
              <p>保留最近最多 80 条提醒，系统通知只是这些记录的外部提示。</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={unreadCount === 0}
              onClick={() => void onMarkRead()}
            >
              全部已读
            </button>
          </div>
          <div className="notification-page-filters">
            <TextTabs<NotificationStatusFilter>
              items={[
                { value: "all", label: "全部" },
                { value: "unread", label: "未读" },
                { value: "read", label: "已读" }
              ]}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              variant="chip"
            />
            <TextTabs<NotificationCategoryFilter>
              items={[
                { value: "all", label: "全部类型" },
                { value: "banked-reset", label: "赠送重置" },
                { value: "quota", label: "额度" }
              ]}
              value={categoryFilter}
              onChange={handleCategoryFilterChange}
              variant="chip"
            />
          </div>

          <div className="notification-page-list">
            {pagedNotifications.length > 0 ? (
              pagedNotifications.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`notification-page-row ${notificationToneClass(item.tone)}${
                    item.readAt ? "" : " is-unread"
                  }${selectedNotification?.key === item.key ? " is-selected" : ""}`}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <em>
                      {notificationCategoryLabel(item.category)} · {notificationToneLabel(item.tone)}
                    </em>
                  </span>
                  <time>{formatDateTime(item.lastTriggeredAt)}</time>
                </button>
              ))
            ) : (
              <div className="notification-empty">当前筛选下没有通知。</div>
            )}
          </div>

          <div className="notification-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            >
              上一页
            </button>
            <span>
              第 {safePageIndex + 1} / {pageCount} 页 · 共 {formatNumber(filteredNotifications.length)} 条
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
            >
              下一页
            </button>
          </div>
        </div>

        <aside className="notification-detail-panel">
          {selectedNotification ? (
            <>
              <div className="notification-detail-head">
                <span className={`notification-tone-pill ${notificationToneClass(selectedNotification.tone)}`}>
                  {notificationToneLabel(selectedNotification.tone)}
                </span>
                <strong>{selectedNotification.title}</strong>
                <p>{selectedNotification.body}</p>
              </div>
              <dl className="notification-detail-grid">
                <div>
                  <dt>类型</dt>
                  <dd>{notificationCategoryLabel(selectedNotification.category)}</dd>
                </div>
                <div>
                  <dt>首次创建</dt>
                  <dd>{formatDateTime(selectedNotification.createdAt)}</dd>
                </div>
                <div>
                  <dt>最近触发</dt>
                  <dd>{formatDateTime(selectedNotification.lastTriggeredAt)}</dd>
                </div>
                <div>
                  <dt>系统通知</dt>
                  <dd>{selectedNotification.systemNotifiedAt ? formatDateTime(selectedNotification.systemNotifiedAt) : "未弹出"}</dd>
                </div>
                <div>
                  <dt>读取状态</dt>
                  <dd>{selectedNotification.readAt ? `已读 ${formatDateTime(selectedNotification.readAt)}` : "未读"}</dd>
                </div>
              </dl>
              <div className="notification-detail-actions">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => void window.codexCompanion.openPage(selectedNotification.page)}
                >
                  查看关联页面
                </button>
                {!selectedNotification.readAt ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onMarkRead([selectedNotification.key])}
                  >
                    标记已读
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="notification-empty">选择一条通知查看详情。</div>
          )}
        </aside>
      </SectionCard>
    </div>
  );
}

function SettingsPage({
  snapshot,
  preferences,
  gitStatus,
  onSaveBillingMonthStartDay,
  onSaveCodexHome,
  onSaveRepoRoots
}: {
  snapshot: DashboardSnapshot | null;
  preferences: AppPreferences | null;
  gitStatus: GitIntegrationStatus | null;
  onSaveBillingMonthStartDay: (day: number) => Promise<void>;
  onSaveCodexHome: (codexHome: string) => Promise<void>;
  onSaveRepoRoots: (roots: string[]) => Promise<void>;
}) {
  const currentDay = preferences?.billingMonthStartDay ?? 1;
  const currentCodexHome = preferences?.codexHome ?? snapshot?.sourceHealth.codexHome ?? "";
  const currentRepoRoots = normalizeRepoRootsList(
    preferences?.repoRoots ?? snapshot?.sourceHealth.repoRoots ?? []
  );
  const [draftDay, setDraftDay] = useState(currentDay);
  const [draftCodexHome, setDraftCodexHome] = useState(currentCodexHome);
  const [draftRepoRoots, setDraftRepoRoots] = useState(currentRepoRoots);
  const [draftRepoRootInput, setDraftRepoRootInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [codexSaving, setCodexSaving] = useState(false);
  const [repoSaving, setRepoSaving] = useState(false);

  async function saveBillingDay() {
    setSaving(true);
    try {
      await onSaveBillingMonthStartDay(normalizedDraftDay);
    } finally {
      setSaving(false);
    }
  }

  function addDraftRepoRoots(nextRoots: string[]) {
    setDraftRepoRoots((current) => normalizeRepoRootsList([...current, ...nextRoots]));
  }

  async function chooseCodexHome() {
    const selected = await window.codexCompanion.selectDirectory();
    if (selected) {
      setDraftCodexHome(selected);
    }
  }

  async function saveCodexHome(codexHome = draftCodexHome) {
    setCodexSaving(true);
    try {
      await onSaveCodexHome(codexHome.trim());
    } finally {
      setCodexSaving(false);
    }
  }

  function addDraftRepoRootInput() {
    const parsed = parseRepoRootsInput(draftRepoRootInput);
    if (parsed.length === 0) {
      return;
    }

    addDraftRepoRoots(parsed);
    setDraftRepoRootInput("");
  }

  async function chooseRepoRoot() {
    const selected = await window.codexCompanion.selectDirectory();
    if (selected) {
      addDraftRepoRoots([selected]);
    }
  }

  async function saveRepoRoots() {
    setRepoSaving(true);
    try {
      await onSaveRepoRoots(normalizeRepoRootsList(draftRepoRoots));
    } finally {
      setRepoSaving(false);
    }
  }

  const safeDraftDay = Number.isFinite(draftDay) ? draftDay : currentDay;
  const normalizedDraftDay = Math.max(1, Math.min(31, Math.trunc(safeDraftDay)));
  const canSave = normalizedDraftDay !== currentDay && !saving;
  const canSaveCodexHome =
    !codexSaving && draftCodexHome.trim() !== currentCodexHome;
  const normalizedDraftRepoRoots = normalizeRepoRootsList(draftRepoRoots);
  const canSaveRepoRoots =
    !repoSaving && !sameStringList(normalizedDraftRepoRoots, currentRepoRoots);
  const pendingDetection = snapshot?.generatedFrom === "pending";
  const isCodexDetected = codexDetected(snapshot);
  const isGitDetected = gitDetected(snapshot);
  const refreshHistory = snapshot?.sourceHealth.refreshHistory ?? [];
  const latestRefresh = refreshHistory[0] ?? null;

  return (
    <div className="page-stack settings-page">
      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>Codex 数据目录</h3>
            <p>用于读取本机 Codex sessions、archived_sessions 和 rate_limits。</p>
          </div>
          <span className={`detection-pill ${detectionClass(isCodexDetected, pendingDetection)}`}>
            {detectionLabel(isCodexDetected, pendingDetection)}
          </span>
        </div>
        <div className="repo-root-editor">
          <div className="repo-root-input-row">
            <input
              type="text"
              value={draftCodexHome}
              placeholder="选择或输入 .codex 目录"
              onChange={(event) => setDraftCodexHome(event.target.value)}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void chooseCodexHome()}
            >
              选择目录
            </button>
          </div>

          <div className="settings-action-row">
            <button
              type="button"
              className="action-button"
              disabled={!canSaveCodexHome}
              onClick={() => void saveCodexHome()}
            >
              {codexSaving ? "保存中" : "保存并刷新 Codex"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={codexSaving}
              onClick={() => void saveCodexHome("")}
            >
              恢复默认路径
            </button>
          </div>
        </div>
        <p className="settings-note">
          默认路径来自 `CODEX_HOME` 或当前用户目录下的 `.codex`；配置只保存在本机。
        </p>
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>仓库根目录</h3>
            <p>用于扫描本机 Git 仓库，并把 Codex 会话归因到具体项目。</p>
          </div>
          <span className={`detection-pill ${detectionClass(isGitDetected, pendingDetection)}`}>
            {detectionLabel(isGitDetected, pendingDetection)}
          </span>
        </div>
        <div className="repo-root-editor">
          <div className="repo-root-input-row">
            <input
              type="text"
              value={draftRepoRootInput}
              placeholder="输入目录路径；多个路径可用分号或换行分隔"
              onChange={(event) => setDraftRepoRootInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDraftRepoRootInput();
                }
              }}
            />
            <button type="button" className="action-button" onClick={addDraftRepoRootInput}>
              添加
            </button>
            <button type="button" className="secondary-button" onClick={() => void chooseRepoRoot()}>
              选择目录
            </button>
          </div>

          <div className="repo-root-list">
            {normalizedDraftRepoRoots.length > 0 ? (
              normalizedDraftRepoRoots.map((root) => (
                <div className="repo-root-item" key={root}>
                  <strong>{root}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftRepoRoots((current) => current.filter((item) => item !== root))
                    }
                  >
                    移除
                  </button>
                </div>
              ))
            ) : (
              <div className="repo-root-empty">当前列表为空；保存后会回到自动发现路径。</div>
            )}
          </div>

          <div className="settings-action-row">
            <button
              type="button"
              className="action-button"
              disabled={!canSaveRepoRoots}
              onClick={() => void saveRepoRoots()}
            >
              {repoSaving ? "保存中" : "保存并刷新仓库"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={repoSaving || sameStringList(normalizedDraftRepoRoots, currentRepoRoots)}
              onClick={() => setDraftRepoRoots(currentRepoRoots)}
            >
              撤销修改
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={repoSaving}
              onClick={() => setDraftRepoRoots([])}
            >
              恢复默认目录
            </button>
          </div>
        </div>
        <p className="settings-note">
          建议选择包含多个 Git 项目的上级目录；路径只保存在本机 Electron userData 配置中。
        </p>
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>计费口径</h3>
            <p>用于总览页计费时间、计费月 Token 和项目概览计费月。</p>
          </div>
        </div>
        <div className="settings-form-row">
          <label htmlFor="billing-month-start">计费月起始日</label>
          <input
            id="billing-month-start"
            type="number"
            min={1}
            max={31}
            value={Number.isFinite(draftDay) ? draftDay : ""}
            onChange={(event) => setDraftDay(Number(event.target.value))}
          />
          <button
            type="button"
            className="action-button"
            disabled={!canSave}
            onClick={() => void saveBillingDay()}
          >
            保存并刷新
          </button>
        </div>
        <p className="settings-note">
          当前为每月第 {currentDay} 天 00:00 起算；如果某月没有该日期，会由系统日期规则自然回落到可表示日期。
        </p>
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>Git 与授权</h3>
            <p>当前版本只读取本机 Git；不检测 GitHub 登录，也不请求 GitHub token。</p>
          </div>
          <span className={`detection-pill ${gitStatus?.available ? "is-ok" : "is-missing"}`}>
            {gitIdentityLabel(gitStatus)}
          </span>
        </div>
        <div className="settings-source-grid">
          <span>命令状态</span>
          <strong>{gitStatus?.available ? "可用" : "不可用或未检测"}</strong>
          <span>Git 版本</span>
          <strong>{gitStatus?.version ?? "等待检测"}</strong>
          <span>user.name</span>
          <strong>{gitStatus?.userName ?? "未配置"}</strong>
          <span>user.email</span>
          <strong>{gitStatus?.userEmail ?? "未配置"}</strong>
          <span>云端授权</span>
          <strong>当前无需 GitHub 授权</strong>
        </div>
        <p className="settings-note">
          {gitStatus?.message ?? "正在检测本机 Git 状态。"} 后续如果加入 GitHub PR、Issue 或云端同步能力，再在这里提供登录检测和授权引导。
        </p>
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>刷新历史</h3>
            <p>设置页只显示最近 5 条摘要；完整记录可分页查看。</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              window.location.hash = "#/refresh-history";
            }}
          >
            查看全部
          </button>
        </div>
        {latestRefresh ? (
          <div className="refresh-summary-card">
            <span>{refreshTriggerLabel(latestRefresh.trigger)} · {generatedFromLabel(latestRefresh.generatedFrom)}</span>
            <strong>{formatDurationMs(latestRefresh.durationMs)}</strong>
            <p>新解析 {latestRefresh.codexFilesParsed} · 复用 {latestRefresh.codexFilesReused}</p>
          </div>
        ) : null}
        <RefreshHistoryTable history={refreshHistory} limit={5} />
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>本机数据边界</h3>
            <p>应用独立读取本机 Codex 与 Git 数据，不使用 DevLedger 运行结果。</p>
          </div>
        </div>
        <div className="settings-source-grid">
          <span>Codex 数据</span>
          <strong>{snapshot?.sourceHealth.codexHome || "等待快照"}</strong>
          <span>仓库根目录</span>
          <strong>{snapshot?.sourceHealth.repoRoots.join("；") || "等待快照"}</strong>
          <span>本地快照</span>
          <strong>%APPDATA%/codex-companion/snapshot.json</strong>
          <span>增量缓存</span>
          <strong>%APPDATA%/codex-companion/codex-session-cache.json</strong>
          <span>通知历史</span>
          <strong>%APPDATA%/codex-companion/notification-state.json</strong>
        </div>
      </SectionCard>
    </div>
  );
}

function OverviewPage({
  snapshot,
  mode,
  footer
}: {
  snapshot: DashboardSnapshot;
  mode: OverviewMode;
  footer: React.ReactNode;
}) {
  const [sort, setSort] = useState<ProjectSortState>({
    key: "recent",
    direction: "desc"
  });
  const [naturalPeriod, setNaturalPeriod] = useState<NaturalProjectPeriod>("week");
  const [billingPeriod, setBillingPeriod] = useState<BillingProjectPeriod>("weekLimit");

  const cards = useMemo(() => buildOverviewCards(snapshot, mode), [snapshot, mode]);

  const rows = useMemo(() => {
    const sourceRows =
      mode === "natural"
        ? snapshot.overview.projectOverview.natural[naturalPeriod]
        : snapshot.overview.projectOverview.billing[billingPeriod];
    return sortProjectRows(sourceRows, sort);
  }, [billingPeriod, mode, naturalPeriod, snapshot, sort]);

  const handleProjectSort = (key: ProjectSort) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <div className="overview-layout">
      <section className="metric-grid">
        {cards.map((card) => (
          <MetricCard key={card.key} card={card} />
        ))}
      </section>

      <BankedResetCreditStrip summary={snapshot.overview.bankedResetCredits} />

      <section className="quota-grid">
        <QuotaWindowCard
          title="5H 额度窗口"
          windowData={snapshot.overview.limitWindows[0]}
          period={snapshot.overview.windowPeriods.fiveHour}
          models={snapshot.overview.modelWindows.fiveHour}
          tone="blue"
        />
        <QuotaWindowCard
          title="周额度窗口"
          windowData={snapshot.overview.limitWindows[1]}
          period={snapshot.overview.windowPeriods.weekLimit}
          models={snapshot.overview.modelWindows.weekLimit}
          tone="green"
        />
      </section>

      <SectionCard className="project-card">
        <div className="section-toolbar">
          <div className="project-title-row">
            <h3>项目概览</h3>
            <TextTabs
              items={
                mode === "natural"
                  ? [
                      { value: "day", label: "日" },
                      { value: "week", label: "周" },
                      { value: "month", label: "月" }
                    ]
                  : [
                      { value: "fiveHour", label: "5H" },
                      { value: "weekLimit", label: "周额度" },
                      { value: "billingMonth", label: "计费月" }
                    ]
              }
              value={mode === "natural" ? naturalPeriod : billingPeriod}
              onChange={(value) =>
                mode === "natural"
                  ? setNaturalPeriod(value as NaturalProjectPeriod)
                  : setBillingPeriod(value as BillingProjectPeriod)
              }
            />
          </div>
        </div>

        <div className="project-table-wrap">
          <table className="project-table">
            <thead>
              <tr>
                <ProjectSortHeader label="项目" sortKey="name" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="Token" sortKey="token" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="API 等价成本" sortKey="cost" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="代码行数" sortKey="code" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="提交" sortKey="commits" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="会话" sortKey="sessions" sort={sort} onSort={handleProjectSort} />
                <ProjectSortHeader label="最近活动" sortKey="recent" sort={sort} onSort={handleProjectSort} />
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="project-name-cell">
                      <span className="project-name-content">
                        <span className={`project-row-icon project-icon-${projectIconTone(row.name)}`}>
                          <Glyph name="repo" />
                        </span>
                        <span>{row.name}</span>
                      </span>
                    </td>
                    <td>{formatCompactToken(row.tokenTotal)}</td>
                    <td>{formatUsd(row.apiCostUsd)}</td>
                    <td>{formatNumber(row.codeChangedLines)} 行</td>
                    <td>{row.commits}</td>
                    <td>{row.sessions}</td>
                    <td>{formatShortDate(row.recentActivityAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    当前周期暂无可展示的项目活动
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {footer}
      </SectionCard>
    </div>
  );
}

const LEDGER_TREND_TABS: Array<{
  value: LedgerTrendPeriod;
  label: string;
  disabled?: boolean;
  title?: string;
}> = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" }
];

const LEDGER_TREND_SERIES: Array<{
  key: LedgerTrendSeriesKey;
  label: string;
  color: string;
  defaultVisible: boolean;
}> = [
  { key: "total", label: "总 Token", color: "#2563eb", defaultVisible: true },
  { key: "input", label: "输入总量", color: "#7c3aed", defaultVisible: true },
  { key: "rawInput", label: "原始输入", color: "#f59e0b", defaultVisible: false },
  { key: "cachedInput", label: "缓存输入", color: "#0891b2", defaultVisible: true },
  { key: "output", label: "输出", color: "#16a34a", defaultVisible: true },
  { key: "reasoningOutput", label: "推理 Token", color: "#e11d48", defaultVisible: false }
];

const DEFAULT_TREND_SERIES_VISIBILITY = LEDGER_TREND_SERIES.reduce<
  TrendSeriesVisibility
>(
  (visibility, series) => ({
    ...visibility,
    [series.key]: series.defaultVisible
  }),
  {
    total: true,
    input: true,
    rawInput: false,
    cachedInput: true,
    output: true,
    reasoningOutput: false
  }
);

const TREND_SVG_WIDTH = 640;
const TREND_SVG_HEIGHT = 190;
const TREND_SVG_PADDING = {
  top: 14,
  right: 14,
  bottom: 22,
  left: 16
};

const LEDGER_ANALYSIS_TABS: Array<{ value: LedgerAnalysisKey; label: string }> = [
  { value: "sevenDays", label: "近7天" },
  { value: "thirtyDays", label: "近30天" },
  { value: "cumulative", label: "累计" }
];

const EMPTY_TOKEN_BREAKDOWN: TokenBreakdown = {
  input: 0,
  cachedInput: 0,
  output: 0,
  reasoningOutput: 0,
  total: 0
};

function rawInputTokens(tokens: TokenBreakdown) {
  return Math.max(0, tokens.input - tokens.cachedInput);
}

function cachedInputRatio(tokens: TokenBreakdown) {
  return tokens.input > 0 ? (tokens.cachedInput / tokens.input) * 100 : 0;
}

function formatPercent(value: number | null, digits = 1) {
  return value === null ? "未观测" : `${value.toFixed(digits)}%`;
}

function formatDateRange(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return "--";
  }
  return `${formatMonthDay(startIso)} - ${formatMonthDay(endIso)}`;
}

function formatFullDateRange(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return "--";
  }
  return `${formatDateTime(startIso)} - ${formatDateTime(endIso)}`;
}

function formatSessionCode(sessionId: string) {
  return sessionId.length > 8 ? sessionId.slice(0, 8) : sessionId;
}

function periodToBucket(period: PeriodMetric): LedgerTimeBucket {
  return {
    key: period.key,
    label: period.label,
    startAt: period.startAt,
    endAt: period.endAt,
    tokens: period.tokens,
    sessions: period.sessions,
    apiCostUsd: period.apiCostUsd,
    creditsEstimate: period.creditsEstimate
  };
}

function fallbackAnalysis(
  key: LedgerAnalysisKey,
  period: PeriodMetric,
  sessions: DashboardSnapshot["ledger"]["sessions"],
  models: ModelMetric[]
): LedgerAnalysisPeriod {
  const peakSession =
    sessions
      .filter((session) => {
        if (!session.lastEventAt) {
          return false;
        }
        const lastEventAt = new Date(session.lastEventAt);
        return lastEventAt >= new Date(period.startAt) && lastEventAt <= new Date(period.endAt);
      })
      .sort((left, right) => right.tokens.total - left.tokens.total)[0] ?? null;

  return {
    key,
    label: key === "sevenDays" ? "近7天" : key === "thirtyDays" ? "近30天" : "累计",
    period,
    buckets: [periodToBucket(period)],
    models,
    peakSession
  };
}

function resolveLedgerAnalysis(
  snapshot: DashboardSnapshot,
  key: LedgerAnalysisKey
): LedgerAnalysisPeriod {
  const existing = snapshot.ledger.analysis?.[key];
  if (existing) {
    return existing;
  }

  const fallbackPeriod =
    key === "sevenDays"
      ? snapshot.overview.sevenDays
      : key === "thirtyDays"
        ? snapshot.overview.month
        : snapshot.ledger.periods[2] ?? snapshot.overview.month;

  return fallbackAnalysis(key, fallbackPeriod, snapshot.ledger.sessions, snapshot.ledger.models);
}

function selectDefaultTrendBucket(buckets: LedgerTimeBucket[]) {
  if (buckets.length === 0) {
    return null;
  }

  return buckets.reduce((selected, bucket) =>
    bucket.tokens.total > selected.tokens.total ? bucket : selected
  );
}

function trendBuckets(snapshot: DashboardSnapshot, period: LedgerTrendPeriod) {
  const trend = snapshot.ledger.trend;
  if (period === "day") {
    return trend?.day ?? [periodToBucket(snapshot.overview.today)];
  }
  if (period === "month") {
    return trend?.monthByDate ?? trend?.monthByWeek ?? [periodToBucket(snapshot.overview.month)];
  }
  return trend?.week ?? [periodToBucket(snapshot.overview.sevenDays)];
}

function trendPeriodMeta(period: LedgerTrendPeriod) {
  if (period === "day") {
    return "日视图 · 小时粒度";
  }
  if (period === "month") {
    return "月视图 · 日期粒度";
  }
  return "周视图 · 日期粒度";
}

function trendDetailTitle(period: LedgerTrendPeriod) {
  if (period === "day") {
    return "当前小时";
  }
  return "当前日期";
}

function trendSeriesValue(tokens: TokenBreakdown, key: LedgerTrendSeriesKey) {
  if (key === "input") {
    return tokens.input;
  }
  if (key === "rawInput") {
    return rawInputTokens(tokens);
  }
  if (key === "cachedInput") {
    return tokens.cachedInput;
  }
  if (key === "output") {
    return tokens.output;
  }
  if (key === "reasoningOutput") {
    return tokens.reasoningOutput;
  }
  return tokens.total;
}

function trendPointX(index: number, bucketCount: number) {
  const innerWidth = TREND_SVG_WIDTH - TREND_SVG_PADDING.left - TREND_SVG_PADDING.right;
  if (bucketCount <= 1) {
    return TREND_SVG_PADDING.left + innerWidth / 2;
  }
  return TREND_SVG_PADDING.left + (innerWidth / (bucketCount - 1)) * index;
}

function trendPointY(value: number, maxValue: number) {
  const innerHeight = TREND_SVG_HEIGHT - TREND_SVG_PADDING.top - TREND_SVG_PADDING.bottom;
  if (maxValue <= 0) {
    return TREND_SVG_PADDING.top + innerHeight;
  }
  const ratio = Math.max(0, Math.min(1, value / maxValue));
  return TREND_SVG_PADDING.top + innerHeight - innerHeight * ratio;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function smoothTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) {
    return linePath(points);
  }

  const segments = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    const localMinY = Math.min(previous.y, current.y, next.y, following.y);
    const localMaxY = Math.max(previous.y, current.y, next.y, following.y);
    const controlOneX = clamp(current.x + (next.x - previous.x) / 6, current.x, next.x);
    const controlTwoX = clamp(next.x - (following.x - current.x) / 6, current.x, next.x);
    const controlOneY = clamp(current.y + (next.y - previous.y) / 6, localMinY, localMaxY);
    const controlTwoY = clamp(next.y - (following.y - current.y) / 6, localMinY, localMaxY);

    segments.push(
      `C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`
    );
  }

  return segments.join(" ");
}

function shouldShowTrendLabel(index: number, bucketCount: number) {
  if (bucketCount <= 10) {
    return true;
  }
  const step = Math.ceil(bucketCount / 8);
  return index === 0 || index === bucketCount - 1 || index % step === 0;
}

function bucketTooltip(bucket: LedgerTimeBucket) {
  const tokens = bucket.tokens;
  return [
    `${formatFullDateRange(bucket.startAt, bucket.endAt)}`,
    `总 Token：${formatCompactToken(tokens.total)}`,
    `输入总量：${formatCompactToken(tokens.input)}`,
    `原始输入：${formatCompactToken(rawInputTokens(tokens))}`,
    `缓存输入：${formatCompactToken(tokens.cachedInput)}`,
    `缓存输入占比：${formatPercent(cachedInputRatio(tokens))}`,
    `输出：${formatCompactToken(tokens.output)}`,
    `推理 Token：${formatCompactToken(tokens.reasoningOutput)}`,
    `会话数：${bucket.sessions}`,
    `API 等价成本：${formatUsd(bucket.apiCostUsd)}`
  ].join("\n");
}

function ModelSortHeader({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: ModelContributionSort;
  sort: ModelContributionSortState;
  onSort: (key: ModelContributionSort) => void;
}) {
  const isActive = sort.key === sortKey;
  const indicator = isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className={isActive ? "sort-active" : ""}>
      <button
        type="button"
        className={`project-sort-heading${isActive ? " active" : ""}`}
        onClick={() => onSort(sortKey)}
        aria-label={`按${label}排序`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}

function sortModels(models: ModelMetric[], sort: ModelContributionSortState) {
  return [...models].sort((left, right) => {
    let comparison: number;

    if (sort.key === "model") {
      comparison = left.model.localeCompare(right.model, "zh-CN");
    } else if (sort.key === "share") {
      comparison = left.sharePercent - right.sharePercent;
    } else if (sort.key === "cost") {
      comparison = left.apiCostUsd - right.apiCostUsd;
    } else if (sort.key === "events") {
      comparison = left.events - right.events;
    } else {
      comparison = left.tokens.total - right.tokens.total;
    }

    if (comparison !== 0) {
      return sort.direction === "asc" ? comparison : -comparison;
    }

    return left.model.localeCompare(right.model, "zh-CN");
  });
}

function resolveTrendView(
  snapshot: DashboardSnapshot,
  period: LedgerTrendPeriod,
  selectedBucketKey: string | null,
  visibleSeries: TrendSeriesVisibility
) {
  const buckets = trendBuckets(snapshot, period);
  const defaultBucket = selectDefaultTrendBucket(buckets);
  const selectedBucket =
    buckets.find((bucket) => bucket.key === selectedBucketKey) ?? defaultBucket;
  const selectedTokens = selectedBucket?.tokens ?? EMPTY_TOKEN_BREAKDOWN;
  const activeSeries = LEDGER_TREND_SERIES.filter((series) => visibleSeries[series.key]);
  const maxValue = Math.max(
    1,
    ...buckets.flatMap((bucket) =>
      activeSeries.map((series) => trendSeriesValue(bucket.tokens, series.key))
    )
  );
  const midValue = formatCompactToken(maxValue / 2);
  const topValue = formatCompactToken(maxValue);

  return {
    buckets,
    selectedBucket,
    selectedTokens,
    activeSeries,
    maxValue,
    midValue,
    topValue
  };
}

function trendDetailRows(selectedTokens: TokenBreakdown) {
  return LEDGER_TREND_SERIES.map((series) => {
    const value = trendSeriesValue(selectedTokens, series.key);
    return {
      ...series,
      value,
      share:
        selectedTokens.total > 0
          ? formatPercent((value / selectedTokens.total) * 100)
          : "--"
    };
  });
}

function trendDetailMetrics(selectedBucket: LedgerTimeBucket | null, selectedTokens: TokenBreakdown) {
  return [
    { label: "会话", value: String(selectedBucket?.sessions ?? 0) },
    { label: "API 等价成本", value: formatUsd(selectedBucket?.apiCostUsd ?? 0) },
    { label: "缓存输入占比", value: formatPercent(cachedInputRatio(selectedTokens)) }
  ];
}

function trendRangeLabel(buckets: LedgerTimeBucket[]) {
  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];

  if (!firstBucket || !lastBucket) {
    return "暂无趋势范围";
  }

  return formatDateRange(firstBucket.startAt, lastBucket.endAt);
}

function TrendSeriesControls({
  visibleSeries,
  onSeriesToggle
}: {
  visibleSeries: TrendSeriesVisibility;
  onSeriesToggle: (seriesKey: LedgerTrendSeriesKey) => void;
}) {
  return (
    <div className="trend-series-toggle-row" aria-label="曲线显示控制">
      {LEDGER_TREND_SERIES.map((series) => (
        <button
          type="button"
          className={`trend-series-toggle${visibleSeries[series.key] ? " active" : ""}`}
          key={series.key}
          style={{ "--series-color": series.color } as CSSProperties}
          aria-pressed={visibleSeries[series.key]}
          onClick={() => onSeriesToggle(series.key)}
        >
          <span className="trend-series-dot" aria-hidden="true" />
          {series.label}
        </button>
      ))}
    </div>
  );
}

function TrendLineChart({
  period,
  buckets,
  selectedBucket,
  activeSeries,
  maxValue,
  midValue,
  topValue,
  onBucketSelect
}: {
  period: LedgerTrendPeriod;
  buckets: LedgerTimeBucket[];
  selectedBucket: LedgerTimeBucket | null;
  activeSeries: typeof LEDGER_TREND_SERIES;
  maxValue: number;
  midValue: string;
  topValue: string;
  onBucketSelect: (bucketKey: string) => void;
}) {
  const gridLines = [1, 0.75, 0.5, 0.25, 0];
  const selectedX =
    selectedBucket && buckets.length > 0
      ? trendPointX(
          Math.max(
            0,
            buckets.findIndex((bucket) => bucket.key === selectedBucket.key)
          ),
          buckets.length
        )
      : null;
  const hitWidth =
    buckets.length > 1
      ? (TREND_SVG_WIDTH - TREND_SVG_PADDING.left - TREND_SVG_PADDING.right) /
        (buckets.length - 1)
      : TREND_SVG_WIDTH - TREND_SVG_PADDING.left - TREND_SVG_PADDING.right;

  return (
    <div className="ledger-line-chart">
      <div className="ledger-y-axis">
        <span>{topValue}</span>
        <span>{midValue}</span>
        <span>0</span>
      </div>
      <div className="trend-line-canvas">
        <svg
          className="trend-line-svg"
          viewBox={`0 0 ${TREND_SVG_WIDTH} ${TREND_SVG_HEIGHT}`}
          role="img"
          aria-label={`${trendPeriodMeta(period)} Token 曲线`}
        >
          {gridLines.map((line) => {
            const y = trendPointY(maxValue * line, maxValue);
            return (
              <line
                className="trend-grid-line"
                key={line}
                x1={TREND_SVG_PADDING.left}
                x2={TREND_SVG_WIDTH - TREND_SVG_PADDING.right}
                y1={y}
                y2={y}
              />
            );
          })}

          {selectedX !== null ? (
            <line
              className="trend-selected-guide"
              x1={selectedX}
              x2={selectedX}
              y1={TREND_SVG_PADDING.top}
              y2={TREND_SVG_HEIGHT - TREND_SVG_PADDING.bottom}
            />
          ) : null}

          {activeSeries.map((series) => {
            const points = buckets.map((bucket, index) => ({
              bucket,
              x: trendPointX(index, buckets.length),
              y: trendPointY(trendSeriesValue(bucket.tokens, series.key), maxValue),
              value: trendSeriesValue(bucket.tokens, series.key)
            }));

            return (
              <g className="trend-series" key={series.key}>
                {points.length > 1 ? (
                  <path
                    className="trend-line-path"
                    d={smoothTrendPath(points)}
                    stroke={series.color}
                  />
                ) : null}
                {points.map((point) => (
                  <circle
                    className={`trend-line-point${
                      selectedBucket?.key === point.bucket.key ? " is-selected" : ""
                    }`}
                    key={`${series.key}-${point.bucket.key}`}
                    cx={point.x}
                    cy={point.y}
                    r={selectedBucket?.key === point.bucket.key ? 4 : 2.8}
                    fill={series.color}
                  />
                ))}
              </g>
            );
          })}

          {buckets.map((bucket, index) => (
            <rect
              className="trend-hit-zone"
              key={bucket.key}
              x={trendPointX(index, buckets.length) - hitWidth / 2}
              y={TREND_SVG_PADDING.top}
              width={hitWidth}
              height={TREND_SVG_HEIGHT - TREND_SVG_PADDING.top - TREND_SVG_PADDING.bottom}
              onClick={() => onBucketSelect(bucket.key)}
            >
              <title>{bucketTooltip(bucket)}</title>
            </rect>
          ))}
        </svg>
        <div className="trend-x-axis" aria-label="趋势日期选择">
          {buckets.map((bucket, index) => (
            shouldShowTrendLabel(index, buckets.length) ? (
              <button
                type="button"
                className="trend-x-axis-button"
                key={bucket.key}
                onClick={() => onBucketSelect(bucket.key)}
              >
                {bucket.label}
              </button>
            ) : (
              <span key={bucket.key} />
            )
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendDetailPanel({
  period,
  selectedBucket,
  selectedTokens,
  showCacheSummary = true
}: {
  period: LedgerTrendPeriod;
  selectedBucket: LedgerTimeBucket | null;
  selectedTokens: TokenBreakdown;
  showCacheSummary?: boolean;
}) {
  const detailRows = trendDetailRows(selectedTokens);
  const detailMetrics = trendDetailMetrics(selectedBucket, selectedTokens).filter(
    (metric) => showCacheSummary || metric.label !== "缓存输入占比"
  );

  return (
    <aside className={`ledger-trend-detail is-open${showCacheSummary ? "" : " no-cache-summary"}`}>
      <div className="trend-detail-head">
        <div className="trend-detail-date">
          <span>{trendDetailTitle(period)}</span>
          <strong>{selectedBucket?.label ?? "--"}</strong>
        </div>
        <div className="trend-detail-summary">
          {detailMetrics.map((metric) => (
            <span className="trend-detail-metric" key={metric.label}>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="trend-detail-table-shell">
        <table className="trend-detail-table">
          <thead>
            <tr>
              <th>曲线</th>
              <th>数值</th>
              <th>占比</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <span
                    className="trend-table-series"
                    style={{ "--series-color": row.color } as CSSProperties}
                  >
                    <span aria-hidden="true" />
                    {row.label}
                  </span>
                </td>
                <td>{formatCompactToken(row.value)}</td>
                <td>{row.share}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

function TokenTrendCard({
  snapshot,
  period,
  onPeriodChange,
  selectedBucketKey,
  onBucketSelect,
  visibleSeries,
  onSeriesToggle,
  onExpand,
  isDetailOpen,
  onDetailToggle
}: {
  snapshot: DashboardSnapshot;
  period: LedgerTrendPeriod;
  onPeriodChange: (value: LedgerTrendPeriod) => void;
  selectedBucketKey: string | null;
  onBucketSelect: (bucketKey: string) => void;
  visibleSeries: TrendSeriesVisibility;
  onSeriesToggle: (seriesKey: LedgerTrendSeriesKey) => void;
  onExpand: () => void;
  isDetailOpen: boolean;
  onDetailToggle: () => void;
}) {
  const trendView = resolveTrendView(snapshot, period, selectedBucketKey, visibleSeries);

  return (
    <SectionCard className="ledger-trend-card">
      <div className="ledger-card-head">
        <div className="ledger-title-row">
          <h3>Token 走势拆解</h3>
          <TextTabs items={LEDGER_TREND_TABS} value={period} onChange={onPeriodChange} />
        </div>
        <div className="ledger-head-actions">
          <span className="ledger-trend-meta">{trendPeriodMeta(period)}</span>
          <button
            type="button"
            className={`detail-toggle-button${isDetailOpen ? " active" : ""}`}
            aria-pressed={isDetailOpen}
            title={isDetailOpen ? "隐藏当前粒度明细" : "展开当前粒度明细"}
            onClick={onDetailToggle}
          >
            <Glyph name="ledger" />
            {isDetailOpen ? "隐藏" : "明细"}
          </button>
          <button
            type="button"
            className="icon-action-button"
            title="放大查看"
            aria-label="放大查看 Token 走势拆解"
            onClick={onExpand}
          >
            <Glyph name="maximize" />
          </button>
        </div>
      </div>

      <div className={`ledger-trend-body${isDetailOpen ? " detail-open" : " detail-hidden"}`}>
        <div className="ledger-line-panel">
          <TrendSeriesControls visibleSeries={visibleSeries} onSeriesToggle={onSeriesToggle} />
          <TrendLineChart
            period={period}
            buckets={trendView.buckets}
            selectedBucket={trendView.selectedBucket}
            activeSeries={trendView.activeSeries}
            maxValue={trendView.maxValue}
            midValue={trendView.midValue}
            topValue={trendView.topValue}
            onBucketSelect={onBucketSelect}
          />
        </div>

        {isDetailOpen ? (
          <TrendDetailPanel
            period={period}
            selectedBucket={trendView.selectedBucket}
            selectedTokens={trendView.selectedTokens}
            showCacheSummary={false}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function TokenTrendExpandedView({
  snapshot,
  period,
  onPeriodChange,
  selectedBucketKey,
  onBucketSelect,
  visibleSeries,
  onSeriesToggle,
  onClose,
  isDetailOpen,
  onDetailToggle
}: {
  snapshot: DashboardSnapshot;
  period: LedgerTrendPeriod;
  onPeriodChange: (value: LedgerTrendPeriod) => void;
  selectedBucketKey: string | null;
  onBucketSelect: (bucketKey: string) => void;
  visibleSeries: TrendSeriesVisibility;
  onSeriesToggle: (seriesKey: LedgerTrendSeriesKey) => void;
  onClose: () => void;
  isDetailOpen: boolean;
  onDetailToggle: () => void;
}) {
  const trendView = resolveTrendView(snapshot, period, selectedBucketKey, visibleSeries);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="ledger-trend-overlay" role="dialog" aria-modal="true" aria-labelledby="trend-expanded-title">
      <button
        type="button"
        className="ledger-trend-overlay-backdrop"
        aria-label="关闭放大查看"
        onClick={onClose}
      />
      <section className="trend-expanded-panel" onClick={(event) => event.stopPropagation()}>
        <header className="trend-expanded-head">
          <div className="trend-expanded-title">
            <h3 id="trend-expanded-title">Token 走势拆解</h3>
            <span>{trendPeriodMeta(period)}</span>
          </div>
          <div className="trend-expanded-actions">
            <TextTabs items={LEDGER_TREND_TABS} value={period} onChange={onPeriodChange} />
            <button
              type="button"
              className={`detail-toggle-button${isDetailOpen ? " active" : ""}`}
              aria-pressed={isDetailOpen}
              title={isDetailOpen ? "隐藏当前粒度明细" : "展开当前粒度明细"}
              onClick={onDetailToggle}
            >
              <Glyph name="ledger" />
              {isDetailOpen ? "隐藏明细" : "显示明细"}
            </button>
            <button
              type="button"
              className="icon-action-button"
              title="关闭"
              aria-label="关闭放大查看"
              onClick={onClose}
            >
              <Glyph name="close" />
            </button>
          </div>
        </header>

        <TrendSeriesControls visibleSeries={visibleSeries} onSeriesToggle={onSeriesToggle} />

        <div className={`trend-expanded-body${isDetailOpen ? " detail-open" : " detail-hidden"}`}>
          {isDetailOpen ? (
            <TrendDetailPanel
              period={period}
              selectedBucket={trendView.selectedBucket}
              selectedTokens={trendView.selectedTokens}
            />
          ) : null}
          <div className="trend-expanded-chart">
            <TrendLineChart
              period={period}
              buckets={trendView.buckets}
              selectedBucket={trendView.selectedBucket}
              activeSeries={trendView.activeSeries}
              maxValue={trendView.maxValue}
              midValue={trendView.midValue}
              topValue={trendView.topValue}
              onBucketSelect={onBucketSelect}
            />
          </div>
        </div>

        <footer className="trend-expanded-footer">
          <span>{trendRangeLabel(trendView.buckets)}</span>
          <span>可见曲线 {trendView.activeSeries.length} 条</span>
          <span>本地快照趋势数据</span>
        </footer>
      </section>
    </div>
  );
}

function PeriodInsightCard({
  analysisKey,
  onAnalysisKeyChange,
  analysis
}: {
  analysisKey: LedgerAnalysisKey;
  onAnalysisKeyChange: (value: LedgerAnalysisKey) => void;
  analysis: LedgerAnalysisPeriod;
}) {
  const period = analysis.period;
  const peakBucket =
    analysis.buckets
      .filter((bucket) => bucket.tokens.total > 0)
      .sort((left, right) => right.tokens.total - left.tokens.total)[0] ?? null;
  const durationDays = Math.max(
    1,
    Math.ceil((new Date(period.endAt).getTime() - new Date(period.startAt).getTime()) / 86_400_000)
  );
  const averageTokens = period.tokens.total / durationDays;
  const cards = [
    {
      icon: "token" as const,
      label: "窗口累计",
      value: formatCompactToken(period.tokens.total),
      detail: "窗口内总 Token"
    },
    {
      icon: "clock" as const,
      label: "窗口均值",
      value: formatCompactToken(averageTokens),
      detail:
        analysisKey === "sevenDays"
          ? "7 日日均 Token"
          : analysisKey === "thirtyDays"
            ? "30 日日均 Token"
            : "观测期日均 Token"
    },
    {
      icon: "calendar" as const,
      label: "峰值位置",
      value: peakBucket ? peakBucket.label : "--",
      detail: "峰值出现的日期"
    },
    {
      icon: "cost" as const,
      label: "峰值用量",
      value: peakBucket ? formatCompactToken(peakBucket.tokens.total) : "--",
      detail: "峰值当天总 Token"
    },
    {
      icon: "session" as const,
      label: "单次峰值",
      value: analysis.peakSession ? formatCompactToken(analysis.peakSession.tokens.total) : "--",
      detail: analysis.peakSession ? `会话 ${formatSessionCode(analysis.peakSession.sessionId)}` : "暂无会话样本"
    },
    {
      icon: "month" as const,
      label: "缓存输入占比",
      value: formatPercent(cachedInputRatio(period.tokens)),
      detail: "缓存输入 / 输入总量"
    }
  ];

  return (
    <SectionCard className="ledger-insight-card">
      <div className="ledger-card-head">
        <h3>周期洞察</h3>
        <TextTabs
          items={LEDGER_ANALYSIS_TABS}
          value={analysisKey}
          onChange={onAnalysisKeyChange}
          variant="chip"
        />
      </div>
      <div className="insight-grid">
        {cards.map((card) => (
          <article className="insight-tile" key={card.label}>
            <span className="insight-icon">
              <Glyph name={card.icon} />
            </span>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function WeeklyLedgerCard({ periods }: { periods: PeriodMetric[] }) {
  const rows = periods.length > 0 ? periods : [];

  return (
    <SectionCard className="ledger-week-card">
      <div className="ledger-card-head">
        <h3>周额度账本</h3>
      </div>
      <div className="table-shell">
        <table className="project-table ledger-week-table">
          <thead>
            <tr>
              <th>起止日期</th>
              <th>累计已用</th>
              <th>Token</th>
              <th>API 等价成本</th>
              <th>满额周折算</th>
              <th>会话</th>
              <th>观测 / 重置</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((period) => {
              const evidence = period.quotaEvidence;
              const usedPercent = evidence?.usedPercent ?? null;
              const fullValue =
                usedPercent !== null && usedPercent > 0
                  ? period.apiCostUsd / (usedPercent / 100)
                  : null;

              return (
                <tr key={period.key}>
                  <td title={formatFullDateRange(period.startAt, period.endAt)}>
                    {formatDateRange(period.startAt, period.endAt)}
                  </td>
                  <td className={usedPercent !== null && usedPercent >= 100 ? "is-danger" : ""}>
                    {formatPercent(usedPercent, 0)}
                  </td>
                  <td>{formatCompactToken(period.tokens.total)}</td>
                  <td>{formatUsd(period.apiCostUsd)}</td>
                  <td>{fullValue === null ? "待观测" : formatUsd(fullValue)}</td>
                  <td>{period.sessions}</td>
                  <td>
                    <span className={`ledger-badge ${evidence?.resetCount ? "is-danger" : "is-ok"}`}>
                      {evidence ? (evidence.resetCount > 0 ? `重置 ${evidence.resetCount} 次` : "正常") : "待观测"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={7}>
                  暂无周额度周期样本
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="ledger-table-note">
        说明：周额度周期按稳定确认的重置边界切分；旧周期提前截止后不与新周期累加。满额周折算为 API 等价估计。
      </p>
    </SectionCard>
  );
}

function ModelContributionCard({
  analysisKey,
  onAnalysisKeyChange,
  analysis,
  sort,
  onSort
}: {
  analysisKey: LedgerAnalysisKey;
  onAnalysisKeyChange: (value: LedgerAnalysisKey) => void;
  analysis: LedgerAnalysisPeriod;
  sort: ModelContributionSortState;
  onSort: (key: ModelContributionSort) => void;
}) {
  const models = sortModels(analysis.models, sort);

  return (
    <SectionCard className="ledger-model-card">
      <div className="ledger-card-head">
        <h3>模型贡献</h3>
        <TextTabs
          items={LEDGER_ANALYSIS_TABS}
          value={analysisKey}
          onChange={onAnalysisKeyChange}
          variant="chip"
        />
      </div>
      <div className="table-shell">
        <table className="project-table ledger-model-table">
          <thead>
            <tr>
              <ModelSortHeader label="模型" sortKey="model" sort={sort} onSort={onSort} />
              <ModelSortHeader label="占比" sortKey="share" sort={sort} onSort={onSort} />
              <ModelSortHeader label="Token" sortKey="token" sort={sort} onSort={onSort} />
              <ModelSortHeader label="API 等价成本" sortKey="cost" sort={sort} onSort={onSort} />
              <ModelSortHeader label="事件数" sortKey="events" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.model}>
                <td>{model.model}</td>
                <td>
                  <span className="model-share-cell">
                    <span className="model-bar">
                      <span style={{ width: `${Math.min(model.sharePercent, 100)}%` }} />
                    </span>
                    {model.sharePercent.toFixed(1)}%
                  </span>
                </td>
                <td>{formatCompactToken(model.tokens.total)}</td>
                <td>{formatUsd(model.apiCostUsd)}</td>
                <td>{model.events}</td>
              </tr>
            ))}
            {models.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={5}>
                  当前周期暂无模型样本
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="ledger-table-note">基于当前可观测事件聚合，模型标签可能因阶段或采集来源不同而略有差异。</p>
    </SectionCard>
  );
}

function SessionAttributionCard({ sessions }: { sessions: DashboardSnapshot["ledger"]["sessions"] }) {
  return (
    <SectionCard className="ledger-session-card">
      <div className="ledger-card-head">
        <h3>会话归因</h3>
      </div>
      <div className="table-shell">
        <table className="project-table session-table">
          <thead>
            <tr>
              <th>最近时间</th>
              <th>会话 ID</th>
              <th>项目 / 仓库</th>
              <th>主模型</th>
              <th>Token</th>
              <th>API 等价成本</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 8).map((session) => (
              <tr key={session.sessionId}>
                <td>{formatShortDate(session.lastEventAt)}</td>
                <td title={session.sessionId}>{formatSessionCode(session.sessionId)}</td>
                <td title={session.cwd ?? undefined}>{session.repoId ?? session.cwd ?? "未归因"}</td>
                <td>{session.dominantModel}</td>
                <td>{formatCompactToken(session.tokens.total)}</td>
                <td>{formatUsd(session.apiCostUsd)}</td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={6}>
                  暂无可归因会话
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function LedgerPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [trendPeriod, setTrendPeriod] = useState<LedgerTrendPeriod>("week");
  const [selectedTrendBucketKey, setSelectedTrendBucketKey] = useState<string | null>(null);
  const [visibleTrendSeries, setVisibleTrendSeries] = useState(DEFAULT_TREND_SERIES_VISIBILITY);
  const [isTrendExpanded, setIsTrendExpanded] = useState(false);
  const [isTrendDetailOpen, setIsTrendDetailOpen] = useState(false);
  const [insightPeriod, setInsightPeriod] = useState<LedgerAnalysisKey>("sevenDays");
  const [modelPeriod, setModelPeriod] = useState<LedgerAnalysisKey>("sevenDays");
  const [modelSort, setModelSort] = useState<ModelContributionSortState>({
    key: "token",
    direction: "desc"
  });

  const insightAnalysis = resolveLedgerAnalysis(snapshot, insightPeriod);
  const modelAnalysis = resolveLedgerAnalysis(snapshot, modelPeriod);
  const weeklyPeriods = snapshot.ledger.weeklyPeriods?.length
    ? snapshot.ledger.weeklyPeriods
    : [snapshot.overview.windowPeriods.weekLimit];

  const handleModelSort = (key: ModelContributionSort) => {
    setModelSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleTrendPeriodChange = (value: LedgerTrendPeriod) => {
    setTrendPeriod(value);
  };

  const handleTrendBucketSelect = (bucketKey: string) => {
    setSelectedTrendBucketKey(bucketKey);
    setIsTrendDetailOpen(true);
  };

  const handleTrendSeriesToggle = (seriesKey: LedgerTrendSeriesKey) => {
    setVisibleTrendSeries((current) => {
      const visibleCount = Object.values(current).filter(Boolean).length;
      if (current[seriesKey] && visibleCount <= 1) {
        return current;
      }

      return {
        ...current,
        [seriesKey]: !current[seriesKey]
      };
    });
  };

  return (
    <div className="ledger-layout">
      <div className="ledger-top-grid">
        <TokenTrendCard
          snapshot={snapshot}
          period={trendPeriod}
          onPeriodChange={handleTrendPeriodChange}
          selectedBucketKey={selectedTrendBucketKey}
          onBucketSelect={handleTrendBucketSelect}
          visibleSeries={visibleTrendSeries}
          onSeriesToggle={handleTrendSeriesToggle}
          onExpand={() => setIsTrendExpanded(true)}
          isDetailOpen={isTrendDetailOpen}
          onDetailToggle={() => setIsTrendDetailOpen((current) => !current)}
        />
        <PeriodInsightCard
          analysisKey={insightPeriod}
          onAnalysisKeyChange={setInsightPeriod}
          analysis={insightAnalysis}
        />
      </div>

      <div className="ledger-middle-grid">
        <WeeklyLedgerCard periods={weeklyPeriods} />
        <ModelContributionCard
          analysisKey={modelPeriod}
          onAnalysisKeyChange={setModelPeriod}
          analysis={modelAnalysis}
          sort={modelSort}
          onSort={handleModelSort}
        />
      </div>

      <SessionAttributionCard sessions={snapshot.ledger.sessions} />

      {isTrendExpanded ? (
        <TokenTrendExpandedView
          snapshot={snapshot}
          period={trendPeriod}
          onPeriodChange={handleTrendPeriodChange}
          selectedBucketKey={selectedTrendBucketKey}
          onBucketSelect={handleTrendBucketSelect}
          visibleSeries={visibleTrendSeries}
          onSeriesToggle={handleTrendSeriesToggle}
          onClose={() => setIsTrendExpanded(false)}
          isDetailOpen={isTrendDetailOpen}
          onDetailToggle={() => setIsTrendDetailOpen((current) => !current)}
        />
      ) : null}
    </div>
  );
}

function RepositoriesPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RepoSortState>({
    key: "recentCommit",
    direction: "desc"
  });
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(
    snapshot.repositories.items[0]?.id ?? null
  );
  const deferredQuery = useDeferredValue(query);
  const cards = useMemo(() => buildRepositoryCards(snapshot), [snapshot]);

  const filteredRepos = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!keyword) {
      return snapshot.repositories.items;
    }

    return snapshot.repositories.items.filter((repo) => {
      const haystack = `${repo.name} ${repo.fullName ?? ""} ${repo.remoteUrl ?? ""} ${repo.path}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [deferredQuery, snapshot.repositories.items]);

  const sortedRepos = useMemo(
    () => sortRepoRows(filteredRepos, sort),
    [filteredRepos, sort]
  );
  const selectedRepo =
    sortedRepos.find((repo) => repo.id === selectedRepoId) ?? sortedRepos[0] ?? null;

  const handleRepoSort = (key: RepoSort) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <div className="repositories-layout">
      <div className="repo-page-toolbar">
        <label className="search-box repo-search-box">
          <span>搜索仓库</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按仓库名或远端标识搜索"
          />
        </label>
        <div className="repo-sort-hint">默认按最近提交排序 · 点击表头切换</div>
      </div>

      <section className="metric-grid">
        {cards.map((card) => (
          <MetricCard key={card.key} card={card} />
        ))}
      </section>

      <div className="repositories-workbench">
        <SectionCard className="repo-list-card">
          <div className="section-toolbar repo-list-toolbar">
            <div>
              <h3>Git 仓库详情</h3>
            </div>
            <span className="repo-list-meta">共 {formatNumber(sortedRepos.length)} 个仓库</span>
          </div>

          <div className="project-table-wrap repo-table-wrap">
            <table className="project-table repo-table">
              <thead>
                <tr>
                  <RepoSortHeader label="仓库" sortKey="name" sort={sort} onSort={handleRepoSort} />
                  <RepoSortHeader label="今日改动" sortKey="today" sort={sort} onSort={handleRepoSort} />
                  <RepoSortHeader
                    label="近 7 日改动"
                    sortKey="sevenDays"
                    sort={sort}
                    onSort={handleRepoSort}
                  />
                  <RepoSortHeader label="本月改动" sortKey="month" sort={sort} onSort={handleRepoSort} />
                  <RepoSortHeader label="Codex 投入" sortKey="codex" sort={sort} onSort={handleRepoSort} />
                  <RepoSortHeader
                    label="最近提交"
                    sortKey="recentCommit"
                    sort={sort}
                    onSort={handleRepoSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedRepos.length > 0 ? (
                  sortedRepos.map((repo) => {
                    const isSelected = selectedRepo?.id === repo.id;
                    return (
                      <tr
                        key={repo.id}
                        className={isSelected ? "repo-row-selected" : undefined}
                        onClick={() => setSelectedRepoId(repo.id)}
                      >
                        <td className="repo-name-cell">
                          <div className="repo-name-stack">
                            <span className={`project-row-icon project-icon-${projectIconTone(repo.name)}`}>
                              <Glyph name="repo" />
                            </span>
                            <div className="repo-name-copy">
                              <div className="repo-name-line">
                                <strong>{repo.name}</strong>
                                {repo.defaultBranch ? (
                                  <span className="repo-inline-badge">{repo.defaultBranch}</span>
                                ) : null}
                              </div>
                              <div className="repo-subline">{repoDisplayName(repo)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{formatNumber(repo.activity.today.changedLines)}</td>
                        <td>{formatNumber(repo.activity.sevenDays.changedLines)}</td>
                        <td>{formatNumber(repo.activity.month.changedLines)}</td>
                        <td className="repo-codex-cell">
                          <strong>{formatCompactToken(repo.tokens.total)}</strong>
                          <small>{formatUsd(repo.apiCostUsd)}</small>
                        </td>
                        <td>{formatRelativeTime(latestRepoCommitAt(repo), snapshot.generatedAt)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      当前搜索条件下没有匹配的仓库
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard className="repo-detail-card">
          <div className="section-toolbar repo-detail-toolbar">
            <div>
              <h3>已选仓库</h3>
            </div>
          </div>

          {selectedRepo ? (
            <>
              <div className="repo-detail-head">
                <div className="repo-detail-title">
                  <span className={`repo-detail-icon project-icon-${projectIconTone(selectedRepo.name)}`}>
                    <Glyph name="repo" />
                  </span>
                  <div className="repo-detail-copy">
                    <h4>{selectedRepo.name}</h4>
                    <p>{repoDisplayName(selectedRepo)}</p>
                  </div>
                </div>
                <div className="repo-detail-meta">
                  {selectedRepo.defaultBranch ? (
                    <span className="repo-inline-badge">{selectedRepo.defaultBranch}</span>
                  ) : null}
                  <span>最近提交：{formatRelativeTime(latestRepoCommitAt(selectedRepo), snapshot.generatedAt)}</span>
                </div>
              </div>

              <div className="repo-detail-stats">
                {[
                  ["今日改动", `${formatNumber(selectedRepo.activity.today.changedLines)} 行`],
                  ["近 7 日改动", `${formatNumber(selectedRepo.activity.sevenDays.changedLines)} 行`],
                  ["本月改动", `${formatNumber(selectedRepo.activity.month.changedLines)} 行`]
                ].map(([label, value]) => (
                  <article key={label} className="repo-detail-stat">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>

              <div className="repo-detail-panel">
                <div className="repo-detail-panel-head">
                  <h4>Codex 投入概览</h4>
                </div>
                <div className="repo-codex-overview">
                  <article className="repo-overview-item">
                    <span>累计 Token</span>
                    <strong>{formatCompactToken(selectedRepo.tokens.total)}</strong>
                  </article>
                  <article className="repo-overview-item">
                    <span>累计 API 等价成本</span>
                    <strong>{formatUsd(selectedRepo.apiCostUsd)}</strong>
                  </article>
                  <article className="repo-overview-item">
                    <span>关联会话</span>
                    <strong>{formatNumber(selectedRepo.sessionCount)}</strong>
                  </article>
                  <article className="repo-overview-item">
                    <span>最近 Codex 活动</span>
                    <strong>{formatRelativeTime(selectedRepo.lastCodexAt, snapshot.generatedAt)}</strong>
                  </article>
                </div>
              </div>

              <div className="repo-detail-panel">
                <div className="repo-detail-panel-head">
                  <h4>最近提交</h4>
                </div>
                <div className="repo-commit-list">
                  {selectedRepo.recentCommits.length > 0 ? (
                    selectedRepo.recentCommits.slice(0, 1).map((commit) => (
                      <article key={commit.hash} className="repo-commit-item">
                        <div className="repo-commit-copy">
                          <strong>{commit.summary}</strong>
                          <span>{repoDisplayName(selectedRepo)}</span>
                        </div>
                        <div className="repo-commit-meta">
                          <span className="repo-commit-hash">{commit.hash.slice(0, 7)}</span>
                          <span>{formatRelativeTime(commit.authoredAt, snapshot.generatedAt)}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-inline">当前仓库暂无最近提交记录</div>
                  )}
                </div>
              </div>

              <div className="repo-status-row">
                <span>远端地址：{selectedRepo.remoteUrl ?? "未配置远端"}</span>
                <span>最近同步：{formatShortDate(selectedRepo.lastSyncedAt ?? snapshot.generatedAt)}</span>
              </div>
            </>
          ) : (
            <div className="repo-detail-empty">
              <h4>请选择仓库</h4>
              <p>左侧列表没有命中时，这里只保留空状态，不展示伪造示例数据。</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function WidgetView({
  snapshot,
  preferences
}: {
  snapshot: DashboardSnapshot | null;
  preferences: AppPreferences | null;
}) {
  const widget = preferences?.widget;
  const privacyMode = widget?.privacyMode ?? false;
  const visibleMetrics =
    widget?.preset === "mini-capsule"
      ? snapshot?.widget.metrics.slice(0, 2) ?? []
      : snapshot?.widget.metrics ?? [];

  async function patchWidget(patch: Partial<AppPreferences["widget"]>) {
    return window.codexCompanion.updateWidgetPreferences(patch);
  }

  return (
    <div
      className={`widget-root ${widget?.preset ?? "signal-bar"} ${
        widget?.locked ? "locked" : "draggable"
      }`}
    >
      <div className="widget-shell">
        <button
          type="button"
          className="widget-brand no-drag"
          onClick={() => void window.codexCompanion.openPage("overview")}
        >
          <BrandMark />
          <div>
            <strong>Codex Companion</strong>
            <small>{snapshot?.widget.statusLabel ?? "待观测"}</small>
          </div>
        </button>

        <div className="widget-metrics">
          {visibleMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              className={`widget-metric no-drag ${metricToneClass(metric.tone)}`}
              onClick={() =>
                void window.codexCompanion.openPage(
                  metric.key === "planRemaining" ? "ledger" : "repositories"
                )
              }
            >
              <span>{metric.label}</span>
              <strong>{maskValue(metric.value, privacyMode)}</strong>
              <small>{privacyMode ? "隐私模式已启用" : metric.hint}</small>
            </button>
          ))}
        </div>

        <div className="widget-actions no-drag">
          <button type="button" onClick={() => void window.codexCompanion.refreshDashboard()}>
            刷新
          </button>
          <button
            type="button"
            onClick={() => void patchWidget({ privacyMode: !privacyMode })}
          >
            {privacyMode ? "显示" : "隐藏"}
          </button>
          <button
            type="button"
            onClick={() => void patchWidget({ locked: !widget?.locked })}
          >
            {widget?.locked ? "解锁" : "锁定"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<AppPage>(resolvePageFromHash());
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotificationEntry[]>([]);
  const [gitStatus, setGitStatus] = useState<GitIntegrationStatus | null>(null);
  const [overviewMode, setOverviewMode] = useState<OverviewMode>(resolveOverviewModeFromHash);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshFeedback, setRefreshFeedback] = useState<RefreshFeedback | null>(null);
  const refreshFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  function showRefreshFeedback(feedback: RefreshFeedback, autoHide = false) {
    if (refreshFeedbackTimerRef.current) {
      clearTimeout(refreshFeedbackTimerRef.current);
      refreshFeedbackTimerRef.current = null;
    }

    setRefreshFeedback(feedback);

    if (autoHide) {
      refreshFeedbackTimerRef.current = setTimeout(() => {
        setRefreshFeedback(null);
        refreshFeedbackTimerRef.current = null;
      }, 5_000);
    }
  }

  useEffect(() => {
    const handleHashChange = () => {
      setPage(resolvePageFromHash());
      setOverviewMode(resolveOverviewModeFromHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    void window.codexCompanion.getPreferences().then(setPreferences);
    const unsubscribe = window.codexCompanion.onPreferencesUpdated(setPreferences);
    return unsubscribe;
  }, []);

  useEffect(() => {
    void window.codexCompanion.getNotifications().then(setNotifications);
    const unsubscribe = window.codexCompanion.onNotificationsUpdated(setNotifications);
    return unsubscribe;
  }, []);

  useEffect(() => {
    void window.codexCompanion.getGitIntegrationStatus().then(setGitStatus);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshFeedbackTimerRef.current) {
        clearTimeout(refreshFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.codexCompanion.onDashboardUpdated((nextSnapshot) => {
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
      setLoading(false);
      showRefreshFeedback({
        phase: "done",
        title: nextSnapshot.generatedFrom === "live" ? "后台刷新完成" : "快照已更新",
        detail: refreshTelemetryDetail(nextSnapshot)
      }, true);
    });
    return unsubscribe;
  }, [startTransition]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const nextSnapshot = await window.codexCompanion.getDashboard();
        startTransition(() => setSnapshot(nextSnapshot));
        setError(null);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "读取仪表板失败";
        setError(message);
        showRefreshFeedback({
          phase: "error",
          title: "快照读取失败",
          detail: message
        }, true);
      } finally {
        setLoading(false);
      }
    })();
  }, [startTransition]);

  async function refresh(force = true) {
    try {
      setLoading(true);
      showRefreshFeedback({
        phase: "refreshing",
        title: "正在增量采集",
        detail: "正在比对 Codex 会话文件签名，并复用未变化的解析缓存"
      });
      const nextSnapshot = force
        ? await window.codexCompanion.refreshDashboard()
        : await window.codexCompanion.getDashboard();
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
      showRefreshFeedback({
        phase: "done",
        title: nextSnapshot.generatedFrom === "live" ? "刷新完成" : "已回退缓存",
        detail: refreshTelemetryDetail(nextSnapshot)
      }, true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "刷新失败";
      setError(message);
      showRefreshFeedback({
        phase: "error",
        title: "刷新失败",
        detail: message
      }, true);
    } finally {
      setLoading(false);
    }
  }

  async function saveBillingMonthStartDay(day: number) {
    const normalizedDay = Number.isFinite(day)
      ? Math.max(1, Math.min(31, Math.trunc(day)))
      : preferences?.billingMonthStartDay ?? 1;
    try {
      setLoading(true);
      showRefreshFeedback({
        phase: "refreshing",
        title: "正在保存计费口径",
        detail: `计费月将按每月第 ${normalizedDay} 天 00:00 起算，保存后立即刷新快照`
      });
      const nextPreferences = await window.codexCompanion.updatePreferences({
        billingMonthStartDay: normalizedDay
      });
      setPreferences(nextPreferences);
      const nextSnapshot = await window.codexCompanion.refreshDashboard();
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
      showRefreshFeedback({
        phase: "done",
        title: "计费口径已更新",
        detail: refreshTelemetryDetail(nextSnapshot)
      }, true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "保存设置失败";
      setError(message);
      showRefreshFeedback({
        phase: "error",
        title: "保存设置失败",
        detail: message
      }, true);
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationsRead(keys?: string[]) {
    const nextNotifications = await window.codexCompanion.markNotificationsRead(keys);
    setNotifications(nextNotifications);
  }

  async function saveCodexHome(codexHome: string) {
    try {
      setLoading(true);
      showRefreshFeedback({
        phase: "refreshing",
        title: "正在保存 Codex 数据目录",
        detail: codexHome
          ? "保存后将重新读取本机 Codex sessions 与额度快照"
          : "将恢复默认 Codex 数据目录，并重新读取本机 sessions"
      });
      const nextPreferences = await window.codexCompanion.updatePreferences({
        codexHome
      });
      setPreferences(nextPreferences);
      const nextSnapshot = await window.codexCompanion.refreshDashboard();
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
      showRefreshFeedback({
        phase: "done",
        title: "Codex 数据目录已更新",
        detail: refreshTelemetryDetail(nextSnapshot)
      }, true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "保存 Codex 数据目录失败";
      setError(message);
      showRefreshFeedback({
        phase: "error",
        title: "保存 Codex 数据目录失败",
        detail: message
      }, true);
    } finally {
      setLoading(false);
    }
  }

  async function saveRepoRoots(roots: string[]) {
    try {
      setLoading(true);
      showRefreshFeedback({
        phase: "refreshing",
        title: "正在保存仓库目录",
        detail: "保存后将重新扫描本机 Git 仓库，并更新代码仓库页"
      });
      const nextPreferences = await window.codexCompanion.updatePreferences({
        repoRoots: roots
      });
      setPreferences(nextPreferences);
      const nextSnapshot = await window.codexCompanion.refreshDashboard();
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
      showRefreshFeedback({
        phase: "done",
        title: "仓库目录已更新",
        detail: refreshTelemetryDetail(nextSnapshot)
      }, true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "保存仓库目录失败";
      setError(message);
      showRefreshFeedback({
        phase: "error",
        title: "保存仓库目录失败",
        detail: message
      }, true);
    } finally {
      setLoading(false);
    }
  }

  if (page === "widget") {
    return <WidgetView snapshot={snapshot} preferences={preferences} />;
  }

  const currentPage =
    page === "overview" ||
    page === "ledger" ||
    page === "repositories" ||
    page === "notifications" ||
    page === "refresh-history" ||
    page === "settings"
      ? page
      : "overview";
  const isFirstLoadPending =
    currentPage !== "settings" &&
    currentPage !== "notifications" &&
    currentPage !== "refresh-history" &&
    snapshot?.generatedFrom === "pending";
  const needsDataSetup =
    currentPage !== "settings" &&
    currentPage !== "notifications" &&
    currentPage !== "refresh-history" &&
    !isFirstLoadPending &&
    snapshot !== null &&
    (snapshot.sourceHealth.sourceStatus !== "observed" ||
      snapshot.repositories.summary.totalTracked === 0);
  const setupMessage =
    snapshot && !codexDetected(snapshot)
      ? "未检测到 Codex 会话数据，请确认 Codex 数据目录是否指向本机 .codex。"
      : "未检测到 Git 仓库，请确认仓库根目录是否包含本机代码项目。";

  return (
    <div className="app-shell">
      <aside className="sidebar-shell">
        <div className="sidebar-top">
          <div className="brand-block">
            <BrandMark />
            <div>
              <h1>Codex Companion</h1>
              <p className="brand-caption">非官方 Codex 本机仪表盘</p>
              <p className="brand-status">本机读取 · 无上传</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.page}
                type="button"
                className={currentPage === item.page ? "active" : ""}
                onClick={() => {
                  window.location.hash = `#/${item.page}`;
                }}
              >
                <span className="nav-icon">
                  <Glyph name={item.icon} />
                </span>
                <span className="nav-copy">
                  <strong>{item.label}</strong>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={`settings-entry${currentPage === "settings" || currentPage === "refresh-history" ? " active" : ""}`}
            onClick={() => {
              window.location.hash = "#/settings";
            }}
          >
            <span className="nav-icon">
              <Glyph name="settings" />
            </span>
            <span className="nav-copy">
              <strong>设置</strong>
            </span>
          </button>
          <div className="sidebar-meta">
            <span>{appPackage.version}</span>
            <span>非官方工具</span>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-copy">
            <h2>{PAGE_META[currentPage].title}</h2>
            <p>{PAGE_META[currentPage].subtitle}</p>
          </div>

          {currentPage === "overview" ? (
            <div className="topbar-center">
              <div className="topbar-mode-switch">
                <span className="topbar-switch-label">时间视角</span>
                <TextTabs
                  items={[
                    { value: "natural", label: "自然时间" },
                    { value: "billing", label: "计费时间" }
                  ]}
                  value={overviewMode}
                  onChange={setOverviewMode}
                />
              </div>
            </div>
          ) : (
            <div className="topbar-center topbar-placeholder" aria-hidden="true" />
          )}

          <div className="topbar-actions">
            <NotificationCenter
              notifications={notifications}
              onMarkRead={markNotificationsRead}
            />
            <span className={`status-pill ${sourceStatusClass(snapshot?.sourceHealth.sourceStatus ?? "pending")}`}>
              {sourceStatusLabel(snapshot?.sourceHealth.sourceStatus ?? "pending")}
            </span>
            <button
              type="button"
              className="action-button"
              disabled={loading}
              onClick={() => void refresh(true)}
            >
              <span className="button-icon">
                <Glyph name="refresh" />
              </span>
              {loading ? "采集中" : "刷新"}
            </button>
            <div className="snapshot-label">
              <span>快照</span>
              <strong>{formatTime(snapshot?.generatedAt ?? null)}</strong>
            </div>
          </div>
        </header>

        {refreshFeedback ? (
          <div className={`refresh-feedback refresh-feedback-${refreshFeedback.phase}`} role="status" aria-live="polite">
            <strong>{refreshFeedback.title}</strong>
            <span>{refreshFeedback.detail}</span>
          </div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {loading && !snapshot ? <div className="loading-card">正在读取本机 Codex 与 Git 数据…</div> : null}
        {isPending ? <div className="loading-hint">界面正在切换到最新快照…</div> : null}
        {isFirstLoadPending ? (
          <FirstLoadPanel snapshot={snapshot} preferences={preferences} />
        ) : null}
        {needsDataSetup ? (
          <div className="setup-banner">
            <div>
              <strong>需要手动确认本机数据源</strong>
              <span>{setupMessage}</span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                window.location.hash = "#/settings";
              }}
            >
              打开设置
            </button>
          </div>
        ) : null}

        <div className="page-viewport">
          {snapshot ? (
            <>
            {currentPage === "overview" ? (
              <OverviewPage snapshot={snapshot} mode={overviewMode} footer={<FooterNote snapshot={snapshot} />} />
            ) : null}
            {currentPage === "ledger" ? <LedgerPage snapshot={snapshot} /> : null}
            {currentPage === "repositories" ? <RepositoriesPage snapshot={snapshot} /> : null}
            {currentPage === "notifications" ? (
              <NotificationPage
                notifications={notifications}
                onMarkRead={markNotificationsRead}
              />
            ) : null}
            {currentPage === "refresh-history" ? (
              <RefreshHistoryPage snapshot={snapshot} />
            ) : null}
            {currentPage === "settings" ? (
              <SettingsPage
                key={`${preferences?.billingMonthStartDay ?? "settings"}:${preferences?.codexHome ?? ""}:${preferences?.repoRoots.join("|") ?? ""}:${preferences?.notifications.deliveryMode ?? ""}`}
                snapshot={snapshot}
                preferences={preferences}
                gitStatus={gitStatus}
                onSaveBillingMonthStartDay={saveBillingMonthStartDay}
                onSaveCodexHome={saveCodexHome}
                onSaveRepoRoots={saveRepoRoots}
              />
            ) : null}

            {currentPage === "ledger" ? <FooterNote snapshot={snapshot} /> : null}
            {currentPage === "repositories" ? <RepositoriesFooter snapshot={snapshot} /> : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

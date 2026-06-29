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
  DashboardSnapshot,
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
  page: Extract<AppPage, "overview" | "ledger" | "repositories">;
  label: string;
  icon: IconName;
}> = [
  { page: "overview", label: "总览", icon: "overview" },
  { page: "ledger", label: "Codex 账本", icon: "ledger" },
  { page: "repositories", label: "代码仓库", icon: "repo" }
];

const PAGE_META: Record<
  Extract<AppPage, "overview" | "ledger" | "repositories" | "settings">,
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
  settings: {
    title: "设置",
    subtitle: "计费口径、刷新历史与本机数据边界"
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
  if (hash === "ledger" || hash === "repositories" || hash === "settings" || hash === "widget") {
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
  history
}: {
  history: RefreshHistoryEntry[];
}) {
  if (history.length === 0) {
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
          {history.map((entry) => (
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

function SettingsPage({
  snapshot,
  preferences,
  onSaveBillingMonthStartDay
}: {
  snapshot: DashboardSnapshot | null;
  preferences: AppPreferences | null;
  onSaveBillingMonthStartDay: (day: number) => Promise<void>;
}) {
  const currentDay = preferences?.billingMonthStartDay ?? 1;
  const [draftDay, setDraftDay] = useState(currentDay);
  const [saving, setSaving] = useState(false);

  async function saveBillingDay() {
    setSaving(true);
    try {
      await onSaveBillingMonthStartDay(normalizedDraftDay);
    } finally {
      setSaving(false);
    }
  }

  const safeDraftDay = Number.isFinite(draftDay) ? draftDay : currentDay;
  const normalizedDraftDay = Math.max(1, Math.min(31, Math.trunc(safeDraftDay)));
  const canSave = normalizedDraftDay !== currentDay && !saving;

  return (
    <div className="page-stack settings-page">
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
            <h3>刷新历史</h3>
            <p>记录最近的手动、自动和启动后台刷新结果。</p>
          </div>
        </div>
        <RefreshHistoryTable history={snapshot?.sourceHealth.refreshHistory ?? []} />
      </SectionCard>

      <SectionCard className="settings-panel">
        <div className="section-toolbar">
          <div>
            <h3>数据边界</h3>
            <p>当前应用独立读取本机 Codex 与 Git 数据，不使用 DevLedger 运行结果。</p>
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
  { value: "day", label: "日", disabled: true, title: "日视角暂不可用，后续重新设计" },
  { value: "week", label: "周" },
  { value: "month", label: "月", disabled: true, title: "月视角暂不可用，后续重新设计" }
];

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

function trendBarHeight(value: number, maxValue: number, minVisiblePercent = 4) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  const percent = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return `${Math.max(minVisiblePercent, percent)}%`;
}

function trendSegmentWidth(value: number, total: number) {
  if (value <= 0 || total <= 0) {
    return "0%";
  }

  return `${Math.max(1.5, (value / total) * 100)}%`;
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
    return trend?.monthByWeek ?? trend?.monthByDate ?? [periodToBucket(snapshot.overview.month)];
  }
  return trend?.week ?? [periodToBucket(snapshot.overview.sevenDays)];
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

function TokenTrendCard({
  snapshot,
  period,
  onPeriodChange
}: {
  snapshot: DashboardSnapshot;
  period: LedgerTrendPeriod;
  onPeriodChange: (value: LedgerTrendPeriod) => void;
}) {
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const buckets = trendBuckets(snapshot, period);
  const defaultBucket = selectDefaultTrendBucket(buckets);
  const selectedBucket =
    buckets.find((bucket) => bucket.key === selectedBucketKey) ?? defaultBucket;
  const selectedTokens = selectedBucket?.tokens ?? EMPTY_TOKEN_BREAKDOWN;
  const selectedRawInput = rawInputTokens(selectedTokens);
  const selectedCompositionTotal = Math.max(
    1,
    selectedRawInput + selectedTokens.cachedInput + selectedTokens.output
  );
  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.tokens.total));
  const midValue = formatCompactToken(maxValue / 2);
  const topValue = formatCompactToken(maxValue);
  const reasoningWidth =
    selectedTokens.output > 0 && selectedTokens.reasoningOutput > 0
      ? trendSegmentWidth(selectedTokens.reasoningOutput, selectedTokens.output)
      : "0%";
  const compositionSegments = [
    {
      key: "raw",
      label: "原始输入",
      value: selectedRawInput,
      width: trendSegmentWidth(selectedRawInput, selectedCompositionTotal)
    },
    {
      key: "cached",
      label: "缓存输入",
      value: selectedTokens.cachedInput,
      width: trendSegmentWidth(selectedTokens.cachedInput, selectedCompositionTotal)
    },
    {
      key: "output",
      label: "输出",
      value: selectedTokens.output,
      width: trendSegmentWidth(selectedTokens.output, selectedCompositionTotal)
    }
  ];
  const detailMetrics = [
    { label: "输入总量", value: formatCompactToken(selectedTokens.input) },
    { label: "缓存占比", value: formatPercent(cachedInputRatio(selectedTokens)) },
    { label: "输出", value: formatCompactToken(selectedTokens.output) },
    { label: "推理 Token", value: formatCompactToken(selectedTokens.reasoningOutput) },
    { label: "会话", value: String(selectedBucket?.sessions ?? 0) },
    { label: "API 等价成本", value: formatUsd(selectedBucket?.apiCostUsd ?? 0) }
  ];

  return (
    <SectionCard className="ledger-trend-card">
      <div className="ledger-card-head">
        <div className="ledger-title-row">
          <h3>Token 走势拆解</h3>
          <TextTabs items={LEDGER_TREND_TABS} value={period} onChange={onPeriodChange} />
        </div>
        <span className="ledger-trend-meta">周视图 · 日期粒度</span>
      </div>

      <div className="ledger-trend-body">
        <div className="ledger-chart">
          <div className="ledger-y-axis">
            <span>{topValue}</span>
            <span>{midValue}</span>
            <span>0</span>
          </div>
          <div className="ledger-bar-area">
            {buckets.map((bucket) => {
              const value = bucket.tokens.total;
              const isSelected = selectedBucket?.key === bucket.key;

              return (
                <button
                  type="button"
                  className={`ledger-bar-column${isSelected ? " is-selected" : ""}`}
                  key={bucket.key}
                  title={bucketTooltip(bucket)}
                  onClick={() => setSelectedBucketKey(bucket.key)}
                  aria-label={`${bucket.label} 总 Token ${formatCompactToken(value)}`}
                >
                  <span className="ledger-bar-value">
                    {value > 0 ? formatCompactToken(value) : ""}
                  </span>
                  <span className="ledger-bar-stack" aria-hidden="true">
                    <span
                      className="ledger-total-bar"
                      style={{ height: trendBarHeight(value, maxValue) }}
                    />
                  </span>
                  <span className="ledger-bar-label">{bucket.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="ledger-trend-detail">
          <div className="trend-detail-head">
            <span>{selectedBucket?.label ?? "--"}</span>
            <strong>{formatCompactToken(selectedTokens.total)}</strong>
            <small>
              {selectedBucket ? formatDateRange(selectedBucket.startAt, selectedBucket.endAt) : "--"}
            </small>
          </div>

          <div className="trend-composition-block">
            <div
              className="trend-composition-bar"
              title={selectedBucket ? bucketTooltip(selectedBucket) : undefined}
            >
              {compositionSegments.map((segment) =>
                segment.value > 0 ? (
                  <span
                    className={`composition-segment composition-${segment.key}`}
                    key={segment.key}
                    style={{ width: segment.width }}
                    title={`${segment.label}：${formatCompactToken(segment.value)}`}
                  >
                    {segment.key === "output" && selectedTokens.reasoningOutput > 0 ? (
                      <span
                        className="composition-reasoning-marker"
                        style={{ width: reasoningWidth }}
                      />
                    ) : null}
                  </span>
                ) : null
              )}
            </div>
            <div className="ledger-chart-legend ledger-chart-legend-compact">
              <span className="legend-raw">原始输入</span>
              <span className="legend-cached">缓存输入</span>
              <span className="legend-output">输出</span>
              <span className="legend-reasoning">推理</span>
            </div>
          </div>

          <div className="trend-detail-grid">
            {detailMetrics.map((metric) => (
              <span className="trend-detail-metric" key={metric.label}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </span>
            ))}
          </div>
        </aside>
      </div>
    </SectionCard>
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
        说明：累计已用超过 100% 表示周期内发生重置，Token 跨多个分段累加。满额周折算为 API 等价估计。
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
    if (value === "week") {
      setTrendPeriod(value);
    }
  };

  return (
    <div className="ledger-layout">
      <div className="ledger-top-grid">
        <TokenTrendCard
          snapshot={snapshot}
          period={trendPeriod}
          onPeriodChange={handleTrendPeriodChange}
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

  if (page === "widget") {
    return <WidgetView snapshot={snapshot} preferences={preferences} />;
  }

  const currentPage =
    page === "overview" || page === "ledger" || page === "repositories" || page === "settings"
      ? page
      : "overview";

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
            className={`settings-entry${currentPage === "settings" ? " active" : ""}`}
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

        <div className="page-viewport">
          {snapshot ? (
            <>
            {currentPage === "overview" ? (
              <OverviewPage snapshot={snapshot} mode={overviewMode} footer={<FooterNote snapshot={snapshot} />} />
            ) : null}
            {currentPage === "ledger" ? <LedgerPage snapshot={snapshot} /> : null}
            {currentPage === "repositories" ? <RepositoriesPage snapshot={snapshot} /> : null}
            {currentPage === "settings" ? (
              <SettingsPage
                key={preferences?.billingMonthStartDay ?? "settings"}
                snapshot={snapshot}
                preferences={preferences}
                onSaveBillingMonthStartDay={saveBillingMonthStartDay}
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

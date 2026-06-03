import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties
} from "react";

import appPackage from "../../package.json";
import type {
  AppPage,
  AppPreferences,
  DashboardSnapshot,
  LimitWindow,
  ModelMetric,
  OverviewProjectItem,
  PeriodMetric,
  RepoMetric,
  SourceStatus,
  WidgetMetric
} from "../shared/contracts";

const NAV_ITEMS: Array<{
  page: Extract<AppPage, "overview" | "ledger" | "repositories">;
  label: string;
  detail: string;
  icon: IconName;
}> = [
  { page: "overview", label: "总览", detail: "用量、额度、项目概览", icon: "overview" },
  { page: "ledger", label: "Codex 账本", detail: "口径、模型、会话归因", icon: "ledger" },
  { page: "repositories", label: "代码仓库", detail: "仓库搜索与活动归因", icon: "repo" }
];

const PAGE_META: Record<
  Extract<AppPage, "overview" | "ledger" | "repositories">,
  { title: string; subtitle: string }
> = {
  overview: {
    title: "总览",
    subtitle: "Codex 使用、额度与本地工程活动"
  },
  ledger: {
    title: "Codex 账本",
    subtitle: "窗口口径、模型构成与会话归因"
  },
  repositories: {
    title: "代码仓库",
    subtitle: "本地仓库的 Token 归因与工程活跃"
  }
};

type IconName =
  | "overview"
  | "ledger"
  | "repo"
  | "settings"
  | "refresh"
  | "status"
  | "clock"
  | "token"
  | "calendar"
  | "month"
  | "code"
  | "cost"
  | "session";
type OverviewMode = "natural" | "billing";
type NaturalProjectPeriod = "day" | "week" | "month";
type BillingProjectPeriod = "fiveHour" | "weekLimit";
type ProjectSort = "token" | "cost" | "code" | "recent";

interface OverviewMetricCardData {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone: "blue" | "teal" | "amber" | "neutral" | "muted";
}

function resolvePageFromHash(): AppPage {
  const hash = window.location.hash.replace(/^#\//, "");
  if (hash === "ledger" || hash === "repositories" || hash === "widget") {
    return hash;
  }
  return "overview";
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
    return "数据待补齐";
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

function maskValue(value: string, privacyMode: boolean) {
  return privacyMode ? "••••" : value;
}

function metricToneClass(tone: WidgetMetric["tone"]) {
  return `tone-${tone}`;
}

function Glyph({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" />
        </svg>
      );
    case "ledger":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 4h14v16H5z" />
          <path {...common} d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "repo":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
          <path {...common} d="M12 4v16M4 7.5 12 11l8-3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1"
          />
          <circle {...common} cx="12" cy="12" r="3.5" />
        </svg>
      );
    case "refresh":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path {...common} d="M20 4v6h-6" />
        </svg>
      );
    case "status":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
          <path {...common} d="M12 8v4l3 2" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 8v5l3 2" />
        </svg>
      );
    case "token":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 12 12 4l8 8-8 8-8-8Z" />
          <path {...common} d="M9 12h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 5h14v15H5zM8 3v4M16 3v4M5 9h14" />
          <path {...common} d="M8.5 13h2M13.5 13h2M8.5 16.5h2M13.5 16.5h2" />
        </svg>
      );
    case "month":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 5h14v15H5zM8 3v4M16 3v4M5 9h14" />
          <path {...common} d="M9 13h6M9 17h4" />
        </svg>
      );
    case "code":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
        </svg>
      );
    case "cost":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 8h14v11H5zM8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8" />
          <path {...common} d="M9 13h6M12 10v6" />
        </svg>
      );
    case "session":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 6h14v10H8l-3 3z" />
          <path {...common} d="M9 10h6M9 13h4" />
        </svg>
      );
    default:
      return null;
  }
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <defs>
          <linearGradient id="brandMarkGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <path
          d="M43 8 55 15v11"
          fill="none"
          stroke="url(#brandMarkGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M43 56H22L8 48V16l14-8h21"
          fill="none"
          stroke="#2563eb"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M39 22 31 18 22 23v18l9 5 8-4"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="55" cy="28" r="4.5" fill="#ffffff" stroke="#06b6d4" strokeWidth="3" />
        <circle cx="44" cy="8" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
        <circle cx="44" cy="56" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
        <circle cx="31" cy="32" r="3.5" fill="#0f172a" />
      </svg>
    </div>
  );
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
  items: Array<{ value: T; label: string }>;
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
          onClick={() => onChange(item.value)}
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

  if (detail.includes("+")) {
    return "is-positive";
  }

  return "is-neutral";
}

function MetricCard({
  card,
  sourceStatus
}: {
  card: OverviewMetricCardData;
  sourceStatus: SourceStatus;
}) {
  return (
    <article className={`metric-card metric-${card.tone}`}>
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
      <span className={`metric-status ${sourceStatusClass(sourceStatus)}`}>
        {sourceStatusLabel(sourceStatus)}
      </span>
    </article>
  );
}

function QuotaWindowCard({
  title,
  windowData,
  period,
  models
}: {
  title: string;
  windowData: LimitWindow;
  period: PeriodMetric;
  models: ModelMetric[];
}) {
  const ringStyle = {
    "--quota-progress": `${Math.max(0, Math.min(windowData.usedPercent ?? 0, 100))}%`
  } as CSSProperties;
  const quotaEvidence = period.quotaEvidence;

  return (
    <SectionCard className="quota-card">
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
              <strong>
                {windowData.remainingPercent === null
                  ? "--"
                  : `${windowData.remainingPercent.toFixed(0)}%`}
              </strong>
              <span>剩余量</span>
            </div>
          </div>
          <div className="quota-reset-label">重置 {formatDateTime(windowData.resetsAt)}</div>
        </div>

        <div className="quota-metrics">
          {[
            { icon: "token" as const, label: "Token 用量", value: formatCompactToken(period.tokens.total) },
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
        <div className="quota-models-title">Top 3 模型占比</div>
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

      <div className="quota-note">
        <span>{windowData.note}</span>
        {quotaEvidence ? (
          <span className="quota-evidence">
            观测 {quotaEvidence.observations} 次 · 重置 {quotaEvidence.resetCount} 次
          </span>
        ) : null}
      </div>
    </SectionCard>
  );
}

function buildOverviewCards(
  snapshot: DashboardSnapshot,
  mode: OverviewMode
): OverviewMetricCardData[] {
  const billingMonth = snapshot.overview.windowPeriods.billingMonth;

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
        tone: "blue"
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
        tone: "teal"
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
        tone: "amber"
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
        tone: "neutral"
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
      tone: "blue"
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
      tone: "teal"
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
      tone: billingMonth ? "amber" : "muted"
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
      tone: "neutral"
    }
  ];
}

function sortProjectRows(rows: OverviewProjectItem[], sort: ProjectSort) {
  return [...rows].sort((left, right) => {
    if (sort === "cost") {
      return right.apiCostUsd - left.apiCostUsd;
    }

    if (sort === "code") {
      return right.codeChangedLines - left.codeChangedLines;
    }

    if (sort === "recent") {
      return (right.recentActivityAt ?? "").localeCompare(left.recentActivityAt ?? "");
    }

    return right.tokenTotal - left.tokenTotal;
  });
}

function OverviewPage({
  snapshot,
  mode
}: {
  snapshot: DashboardSnapshot;
  mode: OverviewMode;
}) {
  const [sort, setSort] = useState<ProjectSort>("token");
  const [naturalPeriod, setNaturalPeriod] = useState<NaturalProjectPeriod>("day");
  const [billingPeriod, setBillingPeriod] = useState<BillingProjectPeriod>("fiveHour");

  const cards = useMemo(() => buildOverviewCards(snapshot, mode), [snapshot, mode]);

  const rows = useMemo(() => {
    const sourceRows =
      mode === "natural"
        ? snapshot.overview.projectOverview.natural[naturalPeriod]
        : snapshot.overview.projectOverview.billing[billingPeriod];
    return sortProjectRows(sourceRows, sort);
  }, [billingPeriod, mode, naturalPeriod, snapshot, sort]);

  return (
    <div className="overview-layout">
      <section className="metric-grid">
        {cards.map((card) => (
          <MetricCard key={card.key} card={card} sourceStatus={snapshot.sourceHealth.sourceStatus} />
        ))}
      </section>

      <section className="quota-grid">
        <QuotaWindowCard
          title="5H 额度窗口"
          windowData={snapshot.overview.limitWindows[0]}
          period={snapshot.overview.windowPeriods.fiveHour}
          models={snapshot.overview.modelWindows.fiveHour}
        />
        <QuotaWindowCard
          title="周额度窗口"
          windowData={snapshot.overview.limitWindows[1]}
          period={snapshot.overview.windowPeriods.weekLimit}
          models={snapshot.overview.modelWindows.weekLimit}
        />
      </section>

      <SectionCard className="project-card">
        <div className="section-toolbar">
          <div>
            <h3>项目概览</h3>
          </div>
          <div className="project-toolbar">
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
                      { value: "weekLimit", label: "周额度" }
                    ]
              }
              value={mode === "natural" ? naturalPeriod : billingPeriod}
              onChange={(value) =>
                mode === "natural"
                  ? setNaturalPeriod(value as NaturalProjectPeriod)
                  : setBillingPeriod(value as BillingProjectPeriod)
              }
            />
            <TextTabs
              items={[
                { value: "token", label: "按 Token" },
                { value: "cost", label: "按成本" },
                { value: "code", label: "按代码行" },
                { value: "recent", label: "按最近活动" }
              ]}
              value={sort}
              onChange={setSort}
              variant="chip"
            />
          </div>
        </div>

        <div className="project-table-wrap">
          <table className="project-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>Token</th>
                <th>API 等价成本</th>
                <th>代码行数</th>
                <th>提交</th>
                <th>会话</th>
                <th>最近活动</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="project-name-cell">{row.name}</td>
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
      </SectionCard>
    </div>
  );
}

function LedgerPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="page-stack">
      <SectionCard>
        <div className="section-toolbar">
          <div>
            <div className="eyebrow">周期账本</div>
            <h3>自然时间与额度窗口的核心口径</h3>
          </div>
        </div>
        <div className="ledger-period-grid">
          {snapshot.ledger.periods.map((period) => (
            <article key={period.key} className="ledger-period-card">
              <div className="ledger-period-label">{period.label}</div>
              <strong>{formatCompactToken(period.tokens.total)}</strong>
              <div className="ledger-period-meta">
                <span>会话 {period.sessions}</span>
                <span>代码 {formatNumber(period.code.changedLines)} 行</span>
                <span>{formatUsd(period.apiCostUsd)}</span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <section className="quota-grid">
        <QuotaWindowCard
          title="5H 额度窗口"
          windowData={snapshot.ledger.limitWindows[0]}
          period={snapshot.overview.windowPeriods.fiveHour}
          models={snapshot.overview.modelWindows.fiveHour}
        />
        <QuotaWindowCard
          title="周额度窗口"
          windowData={snapshot.ledger.limitWindows[1]}
          period={snapshot.overview.windowPeriods.weekLimit}
          models={snapshot.overview.modelWindows.weekLimit}
        />
      </section>

      <SectionCard>
        <div className="section-toolbar">
          <div>
            <div className="eyebrow">模型构成</div>
            <h3>按自然月累计的模型用量</h3>
          </div>
        </div>
        <div className="model-stack">
          {snapshot.ledger.models.map((model) => (
            <div key={model.model} className="model-row">
              <div className="model-label">
                <strong>{model.model}</strong>
                <span>{model.sessions} 个会话</span>
              </div>
              <div className="model-bar">
                <span style={{ width: `${Math.min(model.sharePercent, 100)}%` }} />
              </div>
              <div className="model-value">
                <strong>{formatCompactToken(model.tokens.total)}</strong>
                <span>{formatUsd(model.apiCostUsd)}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="section-toolbar">
          <div>
            <div className="eyebrow">会话归因</div>
            <h3>最近 10 个 Codex 会话</h3>
          </div>
        </div>
        <div className="table-shell">
          <table className="project-table session-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>模型</th>
                <th>工作目录 / 仓库</th>
                <th>Token</th>
                <th>API 等价成本</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.ledger.sessions.slice(0, 10).map((session) => (
                <tr key={session.sessionId}>
                  <td>{formatShortDate(session.lastEventAt)}</td>
                  <td>{session.dominantModel}</td>
                  <td>{session.repoId ?? session.cwd ?? "未归因"}</td>
                  <td>{formatCompactToken(session.tokens.total)}</td>
                  <td>{formatUsd(session.apiCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RepositoriesPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredRepos = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!keyword) {
      return snapshot.repositories.items;
    }

    return snapshot.repositories.items.filter((repo) => {
      const haystack = `${repo.name} ${repo.path} ${repo.remoteUrl ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [deferredQuery, snapshot.repositories.items]);

  return (
    <div className="page-stack">
      <SectionCard>
        <div className="section-toolbar">
          <div>
            <div className="eyebrow">仓库根目录</div>
            <h3>按本地 Git 仓库查看 Codex 归因</h3>
          </div>
          <label className="search-box">
            <span>筛选仓库</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入仓库名、路径或远端地址"
            />
          </label>
        </div>
        <div className="root-strip">
          {snapshot.repositories.roots.length > 0 ? (
            snapshot.repositories.roots.map((root) => (
              <span className="root-chip" key={root}>
                {root}
              </span>
            ))
          ) : (
            <span className="root-chip">当前没有配置仓库根目录</span>
          )}
        </div>
      </SectionCard>

      <div className="repo-grid">
        {filteredRepos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: RepoMetric }) {
  return (
    <SectionCard className="repo-card">
      <div className="repo-card-head">
        <div>
          <div className="eyebrow">代码仓库</div>
          <h3>{repo.name}</h3>
        </div>
        <span className="repo-branch">{repo.defaultBranch ?? "未识别默认分支"}</span>
      </div>
      <div className="repo-path">{repo.path}</div>
      <div className="repo-stat-grid">
        <div className="repo-stat">
          <span>今日代码改动</span>
          <strong>{formatNumber(repo.activity.today.changedLines)} 行</strong>
          <small>{repo.activity.today.commits} 次提交</small>
        </div>
        <div className="repo-stat">
          <span>自然周代码改动</span>
          <strong>{formatNumber(repo.activity.naturalWeek.changedLines)} 行</strong>
          <small>{repo.activity.naturalWeek.commits} 次提交</small>
        </div>
        <div className="repo-stat">
          <span>累计 Token</span>
          <strong>{formatCompactToken(repo.tokens.total)}</strong>
          <small>{repo.sessionCount} 个归因会话</small>
        </div>
        <div className="repo-stat">
          <span>API 等价成本</span>
          <strong>{formatUsd(repo.apiCostUsd)}</strong>
          <small>最近活动 {formatShortDate(repo.lastCodexAt)}</small>
        </div>
      </div>
      <div className="repo-footprints">
        {repo.fileFootprint.map((footprint) => (
          <span key={footprint.language} className="footprint-chip">
            {footprint.language} · {footprint.fileCount} 文件
          </span>
        ))}
      </div>
      <div className="repo-commit-stack">
        {repo.recentCommits.slice(0, 3).map((commit) => (
          <div key={commit.hash} className="repo-commit">
            <strong>{commit.summary}</strong>
            <span>{formatShortDate(commit.authoredAt)}</span>
          </div>
        ))}
      </div>
    </SectionCard>
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
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("natural");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handleHashChange = () => setPage(resolvePageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    void window.codexCompanion.getPreferences().then(setPreferences);
    const unsubscribe = window.codexCompanion.onPreferencesUpdated(setPreferences);
    return unsubscribe;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const nextSnapshot = await window.codexCompanion.getDashboard();
        startTransition(() => setSnapshot(nextSnapshot));
        setError(null);
        if (nextSnapshot.generatedFrom !== "live") {
          void window.codexCompanion
            .refreshDashboard()
            .then((refreshedSnapshot) => {
              startTransition(() => setSnapshot(refreshedSnapshot));
            })
            .catch((reason) => {
              setError(
                reason instanceof Error ? reason.message : "后台刷新失败"
              );
            });
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "读取仪表板失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [startTransition]);

  async function refresh(force = true) {
    try {
      setLoading(true);
      const nextSnapshot = force
        ? await window.codexCompanion.refreshDashboard()
        : await window.codexCompanion.getDashboard();
      startTransition(() => setSnapshot(nextSnapshot));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  }

  if (page === "widget") {
    return <WidgetView snapshot={snapshot} preferences={preferences} />;
  }

  const currentPage =
    page === "overview" || page === "ledger" || page === "repositories"
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
                  <small>{item.detail}</small>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button type="button" className="settings-entry" disabled>
            <span className="nav-icon">
              <Glyph name="settings" />
            </span>
            <span className="nav-copy">
              <strong>设置</strong>
              <small>后续页面设计中</small>
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
          ) : (
            <div className="topbar-center topbar-placeholder">当前页保留默认数据视角</div>
          )}

          <div className="topbar-actions">
            <span className={`status-pill ${sourceStatusClass(snapshot?.sourceHealth.sourceStatus ?? "pending")}`}>
              <span className="pill-icon">
                <Glyph name="status" />
              </span>
              {sourceStatusLabel(snapshot?.sourceHealth.sourceStatus ?? "pending")}
            </span>
            <button type="button" className="action-button" onClick={() => void refresh(true)}>
              <span className="button-icon">
                <Glyph name="refresh" />
              </span>
              {loading ? "刷新中" : "刷新"}
            </button>
            <div className="snapshot-label">
              <span>快照</span>
              <strong>{formatTime(snapshot?.generatedAt ?? null)}</strong>
            </div>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {loading && !snapshot ? <div className="loading-card">正在读取本机 Codex 与 Git 数据…</div> : null}
        {isPending ? <div className="loading-hint">界面正在切换到最新快照…</div> : null}

        <div className="page-viewport">
          {snapshot ? (
            <>
            {currentPage === "overview" ? (
              <OverviewPage snapshot={snapshot} mode={overviewMode} />
            ) : null}
            {currentPage === "ledger" ? <LedgerPage snapshot={snapshot} /> : null}
            {currentPage === "repositories" ? <RepositoriesPage snapshot={snapshot} /> : null}

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
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";

import type {
  AppPage,
  AppPreferences,
  DashboardSnapshot,
  LimitWindow,
  RepoMetric,
  WidgetMetric
} from "../shared/contracts";

const NAV_ITEMS: Array<{ page: AppPage; label: string; detail: string }> = [
  { page: "overview", label: "总览页", detail: "今日、近 7 日、本月" },
  { page: "ledger", label: "Codex 账本", detail: "额度、成本、模型构成" },
  { page: "repositories", label: "代码仓库", detail: "仓库活跃度与归因" }
];

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

function formatUsd(value: number | null) {
  if (value === null) {
    return "未观测";
  }
  return `$${value.toFixed(2)}`;
}

function maskValue(value: string, privacyMode: boolean) {
  return privacyMode ? "••••" : value;
}

function sourceStatusLabel(status: LimitWindow["sourceStatus"]) {
  const mapping = {
    observed: "已观测",
    pending: "待刷新",
    unobserved: "未观测",
    stale: "数据过期"
  };

  return mapping[status];
}

function sourceStatusTone(status: LimitWindow["sourceStatus"]) {
  if (status === "observed") {
    return "success";
  }
  if (status === "stale") {
    return "warning";
  }
  if (status === "pending") {
    return "neutral";
  }
  return "danger";
}

function metricToneClass(tone: WidgetMetric["tone"]) {
  return `tone-${tone}`;
}

function LimitCard({ windowData }: { windowData: LimitWindow }) {
  const remainingText =
    windowData.remainingPercent === null
      ? "等待额度样本"
      : `剩余 ${windowData.remainingPercent.toFixed(1)}%`;

  return (
    <article className="limit-card">
      <div className="card-topline">
        <span>{windowData.label}</span>
        <span className={`status-pill ${sourceStatusTone(windowData.sourceStatus)}`}>
          {sourceStatusLabel(windowData.sourceStatus)}
        </span>
      </div>
      <div className="limit-value">
        {windowData.usedPercent === null
          ? "未观测"
          : `${windowData.usedPercent.toFixed(1)}% 已用`}
      </div>
      <div className="progress-track">
        <span
          className="progress-fill"
          style={{ width: `${windowData.usedPercent ?? 0}%` }}
        />
      </div>
      <div className="limit-meta">
        <span>{remainingText}</span>
        <span>
          {windowData.resetsAt
            ? `恢复 ${new Date(windowData.resetsAt).toLocaleString("zh-CN")}`
            : "等待恢复时间"}
        </span>
      </div>
      <div className="limit-note">{windowData.note}</div>
    </article>
  );
}

function OverviewPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="page-grid">
      <article className="hero-card">
        <div className="eyebrow">核心概览</div>
        <h1>Codex 今日负载与预算状态</h1>
        <p>
          只读本机 Codex 会话与 Git 仓库，不上传原始 session 文件。当前周额度价值按
          API 等价成本与已观测用量折算。
        </p>
        <div className="hero-metrics">
          <MetricPanel
            label="今日 Token"
            value={`${formatNumber(snapshot.overview.today.tokens.total)} tok`}
            detail={`${formatNumber(snapshot.overview.today.code.changedLines)} 行代码改动`}
          />
          <MetricPanel
            label="近 7 日 Token"
            value={`${formatNumber(snapshot.overview.sevenDays.tokens.total)} tok`}
            detail={`${formatNumber(snapshot.overview.sevenDays.code.changedLines)} 行代码改动`}
          />
          <MetricPanel
            label="本月 Token"
            value={`${formatNumber(snapshot.overview.month.tokens.total)} tok`}
            detail={`${snapshot.overview.month.sessions} 个会话`}
          />
          <MetricPanel
            label="周套餐价值折算"
            value={formatUsd(snapshot.overview.apiValueSummaryUsd)}
            detail={`${formatUsd(snapshot.overview.naturalWeek.apiCostUsd)} 已消耗 API 等价`}
          />
        </div>
      </article>

      <article className="info-card">
        <div className="eyebrow">可信度</div>
        <div className="info-stat">
          <span>数据源状态</span>
          <strong>{sourceStatusLabel(snapshot.sourceHealth.sourceStatus)}</strong>
        </div>
        <div className="info-stat">
          <span>最近观测</span>
          <strong>
            {snapshot.sourceHealth.lastObservedAt
              ? new Date(snapshot.sourceHealth.lastObservedAt).toLocaleString("zh-CN")
              : "尚无样本"}
          </strong>
        </div>
        <div className="info-stat">
          <span>会话扫描</span>
          <strong>
            {snapshot.sourceHealth.sessionFilesScanned +
              snapshot.sourceHealth.archivedFilesScanned}
            {" "}个文件
          </strong>
        </div>
        <div className="info-stat">
          <span>仓库归因</span>
          <strong>{snapshot.repositories.summary.totalTracked} 个本地仓库</strong>
        </div>
      </article>

      <div className="triple-grid">
        {snapshot.overview.limitWindows.map((windowData) => (
          <LimitCard key={windowData.key} windowData={windowData} />
        ))}
      </div>

      <article className="wide-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">数据说明</div>
            <h2>本轮采集备注</h2>
          </div>
        </div>
        <ul className="notes-list">
          {snapshot.sourceHealth.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function LedgerPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="page-grid">
      <article className="wide-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">额度账本</div>
            <h2>当前窗口与自然时间双口径</h2>
          </div>
        </div>
        <div className="ledger-grid">
          {snapshot.ledger.periods.map((period) => (
            <div key={period.key} className="ledger-period">
              <div className="ledger-title">{period.label}</div>
              <div className="ledger-row">
                <span>Token</span>
                <strong>{formatNumber(period.tokens.total)}</strong>
              </div>
              <div className="ledger-row">
                <span>会话数</span>
                <strong>{period.sessions}</strong>
              </div>
              <div className="ledger-row">
                <span>API 等价</span>
                <strong>{formatUsd(period.apiCostUsd)}</strong>
              </div>
              <div className="ledger-row">
                <span>代码改动</span>
                <strong>{formatNumber(period.code.changedLines)} 行</strong>
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="triple-grid">
        {snapshot.ledger.limitWindows.map((windowData) => (
          <LimitCard key={windowData.key} windowData={windowData} />
        ))}
      </div>

      <article className="wide-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">模型构成</div>
            <h2>按自然月累计 Token 与 API 等价成本</h2>
          </div>
        </div>
        <div className="model-list">
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
                <strong>{formatNumber(model.tokens.total)} tok</strong>
                <span>{formatUsd(model.apiCostUsd)}</span>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="wide-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">会话归因</div>
            <h2>最近 Codex 会话与仓库映射</h2>
          </div>
        </div>
        <div className="session-table">
          <div className="session-head">
            <span>时间</span>
            <span>模型</span>
            <span>工作目录 / 仓库</span>
            <span>Token</span>
            <span>API 等价</span>
          </div>
          {snapshot.ledger.sessions.slice(0, 10).map((session) => (
            <div className="session-row" key={session.sessionId}>
              <span>
                {session.lastEventAt
                  ? new Date(session.lastEventAt).toLocaleString("zh-CN")
                  : "未知"}
              </span>
              <span>{session.dominantModel}</span>
              <span>{session.repoId ?? session.cwd ?? "未归因"}</span>
              <span>{formatNumber(session.tokens.total)}</span>
              <span>{formatUsd(session.apiCostUsd)}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
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
    <section className="page-grid">
      <article className="wide-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">代码仓库</div>
            <h2>Codex 投入与本地代码产出关联</h2>
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
      </article>

      {filteredRepos.map((repo) => (
        <RepoCard key={repo.id} repo={repo} />
      ))}
    </section>
  );
}

function RepoCard({ repo }: { repo: RepoMetric }) {
  return (
    <article className="repo-card">
      <div className="card-topline">
        <div>
          <strong>{repo.name}</strong>
          <span>{repo.defaultBranch ?? "未识别默认分支"}</span>
        </div>
        <div className="repo-cost">{formatUsd(repo.apiCostUsd)}</div>
      </div>
      <div className="repo-path">{repo.path}</div>
      <div className="repo-stats">
        <MetricPanel
          label="今日改动"
          value={`${formatNumber(repo.activity.today.changedLines)} 行`}
          detail={`${repo.activity.today.commits} 次提交`}
        />
        <MetricPanel
          label="近 7 日改动"
          value={`${formatNumber(repo.activity.sevenDays.changedLines)} 行`}
          detail={`${repo.activity.sevenDays.commits} 次提交`}
        />
        <MetricPanel
          label="本月 Token"
          value={`${formatNumber(repo.tokens.total)} tok`}
          detail={`${repo.sessionCount} 个归因会话`}
        />
      </div>
      <div className="repo-footprints">
        {repo.fileFootprint.map((footprint) => (
          <span key={footprint.language} className="footprint-chip">
            {footprint.language} · {footprint.fileCount} 文件
          </span>
        ))}
      </div>
      <div className="repo-commits">
        {repo.recentCommits.slice(0, 3).map((commit) => (
          <div key={commit.hash} className="repo-commit">
            <strong>{commit.summary}</strong>
            <span>{commit.authoredAt}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function MetricPanel({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-panel">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
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
    const updated = await window.codexCompanion.updateWidgetPreferences(patch);
    return updated;
  }

  return (
    <div
      className={`widget-root ${widget?.preset ?? "signal-bar"} ${
        widget?.locked ? "locked" : "draggable"
      }`}
    >
      <div className="widget-shell">
        <button
          className="widget-brand no-drag"
          onClick={() => void window.codexCompanion.openPage("overview")}
        >
          <span className="widget-dot" />
          <div>
            <strong>Codex 伴侣</strong>
            <small>{snapshot?.widget.statusLabel ?? "待观测"}</small>
          </div>
        </button>

        <div className="widget-metrics">
          {visibleMetrics.map((metric) => (
            <button
              key={metric.key}
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
          <button onClick={() => void window.codexCompanion.refreshDashboard()}>
            刷新
          </button>
          <button
            onClick={() => void patchWidget({ privacyMode: !privacyMode })}
          >
            {privacyMode ? "显示" : "隐藏"}
          </button>
          <button onClick={() => void patchWidget({ locked: !widget?.locked })}>
            {widget?.locked ? "解锁" : "锁定"}
          </button>
          <button
            onClick={() =>
              void patchWidget({ preset: widget?.preset === "signal-bar" ? "mini-capsule" : "signal-bar" })
            }
          >
            预设
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

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <div className="brand-block">
          <span className="eyebrow">非官方桌面伴侣</span>
          <h1>Codex Companion</h1>
          <p>只服务 Codex，会话、额度与代码活动全部基于本机可验证数据。</p>
        </div>

        <nav className="main-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={page === item.page ? "active" : ""}
              onClick={() => {
                window.location.hash = `#/${item.page}`;
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </nav>

        <div className="aside-note">
          <strong>数据边界</strong>
          <span>默认 local-first，不上传原始 Codex session 或仓库内容。</span>
        </div>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">桌面总控台</span>
            <h2>{page === "overview" ? "总览页" : page === "ledger" ? "Codex 账本" : "代码仓库"}</h2>
          </div>
          <div className="topbar-actions">
            <button onClick={() => void window.codexCompanion.showWidget()}>
              显示挂件
            </button>
            <button onClick={() => void refresh(true)}>{loading ? "刷新中" : "刷新数据"}</button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {loading && !snapshot ? <div className="loading-card">正在读取本机 Codex 与 Git 数据…</div> : null}
        {isPending ? <div className="loading-hint">界面正在切换到最新快照…</div> : null}

        {snapshot ? (
          <>
            {page === "overview" ? <OverviewPage snapshot={snapshot} /> : null}
            {page === "ledger" ? <LedgerPage snapshot={snapshot} /> : null}
            {page === "repositories" ? <RepositoriesPage snapshot={snapshot} /> : null}

            <footer className="footer-note">
              <span>定价来源：{snapshot.pricingMeta.apiRateSource}</span>
              <span>{snapshot.pricingMeta.codexRateSource}</span>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}

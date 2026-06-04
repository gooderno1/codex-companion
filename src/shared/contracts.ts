export type SourceStatus = "observed" | "pending" | "unobserved" | "stale";

export type AppPage = "overview" | "ledger" | "repositories" | "widget";
export type WidgetPreset = "signal-bar" | "mini-capsule";

export interface TokenBreakdown {
  input: number;
  cachedInput: number;
  output: number;
  reasoningOutput: number;
  total: number;
}

export interface CodeActivity {
  commits: number;
  additions: number;
  deletions: number;
  changedLines: number;
  net: number;
}

export interface QuotaResetEvent {
  at: string;
  beforeObservedAt: string;
  beforeUsedPercent: number;
  afterUsedPercent: number;
  beforeWindowResetsAt: string | null;
  afterWindowResetsAt: string | null;
}

export interface QuotaUsageSegment {
  startAt: string;
  endAt: string;
  usedPercent: number;
  maxObservedAt: string;
}

export interface PeriodQuotaEvidence {
  usedPercent: number | null;
  remainingPercent: number | null;
  maxObservedUsedPercent: number | null;
  lastObservedAt: string | null;
  resetCount: number;
  observations: number;
  resetEvents: QuotaResetEvent[];
  usageSegments: QuotaUsageSegment[];
}

export interface PeriodMetric {
  key: string;
  label: string;
  tokens: TokenBreakdown;
  sessions: number;
  apiCostUsd: number;
  creditsEstimate: number;
  code: CodeActivity;
  startAt: string;
  endAt: string;
  quotaEvidence?: PeriodQuotaEvidence;
}

export interface LimitWindow {
  key: string;
  label: string;
  sourceStatus: SourceStatus;
  usedPercent: number | null;
  remainingPercent: number | null;
  resetsAt: string | null;
  observedAt: string | null;
  windowMinutes: number | null;
  estimatedSpentUsd: number | null;
  estimatedValueBasisUsedPercent: number | null;
  estimatedFullValueUsd: number | null;
  estimatedRemainingValueUsd: number | null;
  note: string | null;
}

export interface ModelMetric {
  model: string;
  tokens: TokenBreakdown;
  apiCostUsd: number;
  creditsEstimate: number;
  events: number;
  sessions: number;
  sharePercent: number;
}

export interface SessionAttribution {
  sessionId: string;
  cwd: string | null;
  repoId: string | null;
  startedAt: string | null;
  lastEventAt: string | null;
  tokens: TokenBreakdown;
  apiCostUsd: number;
  creditsEstimate: number;
  dominantModel: string;
}

export interface LedgerTimeBucket {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  tokens: TokenBreakdown;
  sessions: number;
  apiCostUsd: number;
  creditsEstimate: number;
}

export interface LedgerAnalysisPeriod {
  key: "sevenDays" | "thirtyDays" | "cumulative";
  label: string;
  period: PeriodMetric;
  buckets: LedgerTimeBucket[];
  models: ModelMetric[];
  peakSession: SessionAttribution | null;
}

export interface CommitMetric {
  hash: string;
  authoredAt: string;
  author: string;
  summary: string;
}

export interface FileFootprint {
  language: string;
  fileCount: number;
  bytes: number;
}

export interface RepoMetric {
  id: string;
  name: string;
  path: string;
  fullName: string | null;
  remoteUrl: string | null;
  defaultBranch: string | null;
  lastSyncedAt: string | null;
  activity: {
    today: CodeActivity;
    yesterday: CodeActivity;
    sevenDays: CodeActivity;
    naturalWeek: CodeActivity;
    month: CodeActivity;
    workingTree: CodeActivity;
    fiveHour?: CodeActivity;
    weekLimit?: CodeActivity;
  };
  tokens: TokenBreakdown;
  apiCostUsd: number;
  creditsEstimate: number;
  sessionCount: number;
  lastCodexAt: string | null;
  recentCommits: CommitMetric[];
  fileFootprint: FileFootprint[];
}

export interface OverviewProjectItem {
  id: string;
  name: string;
  tokenTotal: number;
  apiCostUsd: number;
  codeChangedLines: number;
  commits: number;
  sessions: number;
  recentActivityAt: string | null;
}

export interface WidgetMetric {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "neutral" | "success" | "warning" | "danger";
}

export interface DashboardSnapshot {
  generatedAt: string;
  generatedFrom: "live" | "cache" | "pending";
  sourceHealth: {
    codexHome: string;
    repoRoots: string[];
    sessionFilesScanned: number;
    archivedFilesScanned: number;
    repoCount: number;
    lastObservedAt: string | null;
    sourceStatus: SourceStatus;
    notes: string[];
  };
  overview: {
    today: PeriodMetric;
    sevenDays: PeriodMetric;
    naturalWeek: PeriodMetric;
    month: PeriodMetric;
    previous: {
      yesterday: PeriodMetric;
      naturalWeek: PeriodMetric;
      month: PeriodMetric;
      fiveHour: PeriodMetric | null;
      weekLimit: PeriodMetric | null;
      billingMonth: PeriodMetric | null;
    };
    windowPeriods: {
      fiveHour: PeriodMetric;
      weekLimit: PeriodMetric;
      billingMonth: PeriodMetric | null;
    };
    limitWindows: LimitWindow[];
    modelWindows: {
      fiveHour: ModelMetric[];
      weekLimit: ModelMetric[];
    };
    projectOverview: {
      natural: {
        day: OverviewProjectItem[];
        week: OverviewProjectItem[];
        month: OverviewProjectItem[];
      };
      billing: {
        fiveHour: OverviewProjectItem[];
        weekLimit: OverviewProjectItem[];
      };
    };
    apiValueSummaryUsd: number | null;
  };
  ledger: {
    periods: PeriodMetric[];
    weeklyPeriods: PeriodMetric[];
    trend: {
      day: LedgerTimeBucket[];
      week: LedgerTimeBucket[];
      monthByDate: LedgerTimeBucket[];
      monthByWeek: LedgerTimeBucket[];
    };
    analysis: {
      sevenDays: LedgerAnalysisPeriod;
      thirtyDays: LedgerAnalysisPeriod;
      cumulative: LedgerAnalysisPeriod;
    };
    models: ModelMetric[];
    sessions: SessionAttribution[];
    limitWindows: LimitWindow[];
  };
  repositories: {
    roots: string[];
    items: RepoMetric[];
    summary: {
      totalTracked: number;
      attributedRepoCount: number;
      attributedTokens: number;
      todayChangedLines: number;
      sevenDayChangedLines: number;
      monthChangedLines: number;
    };
  };
  widget: {
    statusLabel: string;
    updatedLabel: string;
    metrics: WidgetMetric[];
  };
  pricingMeta: {
    apiRateSource: string;
    codexRateSource: string;
    updatedAt: string;
  };
}

export interface WidgetPreferences {
  preset: WidgetPreset;
  locked: boolean;
  clickThrough: boolean;
  opacity: number;
  privacyMode: boolean;
  visible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface AppPreferences {
  repoRoots: string[];
  billingMonthStartDay: number;
  widget: WidgetPreferences;
}

export interface CodexCompanionApi {
  getDashboard(force?: boolean): Promise<DashboardSnapshot>;
  getPreferences(): Promise<AppPreferences>;
  refreshDashboard(): Promise<DashboardSnapshot>;
  updateWidgetPreferences(
    patch: Partial<WidgetPreferences>
  ): Promise<AppPreferences>;
  onPreferencesUpdated(
    listener: (preferences: AppPreferences) => void
  ): () => void;
  onDashboardUpdated(
    listener: (snapshot: DashboardSnapshot) => void
  ): () => void;
  openPage(page: AppPage): Promise<void>;
  showWidget(): Promise<void>;
  hideWidget(): Promise<void>;
}

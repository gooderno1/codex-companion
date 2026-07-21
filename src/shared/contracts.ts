export type SourceStatus = "observed" | "pending" | "unobserved" | "stale";

export type AppPage =
  | "overview"
  | "ledger"
  | "repositories"
  | "notifications"
  | "refresh-history"
  | "settings"
  | "widget";
export type WidgetPreset = "signal-bar" | "mini-capsule";
export type RefreshTrigger = "manual" | "auto" | "startup" | "background";
export type DashboardNotificationCategory = "banked-reset" | "quota";
export type DashboardNotificationTone = "info" | "warning" | "danger";
export type NotificationDeliveryMode = "balanced" | "important" | "quiet" | "off";
export type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error"
  | "unsupported";
export type UpdateTrustMode =
  | "unsigned-temporary"
  | "trusted-publisher"
  | "unsupported";

export interface UpdatePreferences {
  autoCheck: boolean;
  autoDownload: boolean;
  ignoredVersion: string | null;
  installOnQuit: boolean;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  releaseUrl: string;
  downloadSize: number | null;
  progress: UpdateProgress | null;
  lastCheckedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  canCheck: boolean;
  canAutoInstall: boolean;
  canInstallOnQuit: boolean;
  trustMode: UpdateTrustMode;
}

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
  beforeWindowMinutes?: number | null;
  afterWindowMinutes?: number | null;
  sourceId?: string | null;
  beforeSourceId?: string | null;
  comparisonScope?: "session" | "timeline";
  evidence?: {
    highWaterEvidence: boolean;
    boundaryAlignedEvidence: boolean;
    stabilizedBoundaryEvidence?: boolean;
    evidenceTypes: string[];
    afterBoundaryAt: string | null;
    afterWindowMinutes: number | null;
    lookbackWindowMs?: number;
    lookbackObservedAt?: string;
  };
  confirmation?: {
    status: "confirmed" | "rejected";
    reason: string;
    checkedObservationCount?: number;
    stableObservationCount?: number;
    firstStableObservedAt?: string;
    lastStableObservedAt?: string;
    stableBoundaryAt?: string | null;
    firstDriftObservedAt?: string;
    firstDriftBoundaryAt?: string | null;
    confirmationAfterMs?: number;
    confirmationWindowMs?: number;
  };
  boundaryAt?: string | null;
  afterCycleStartAt?: string | null;
  afterCycleEndAt?: string | null;
}

export interface QuotaUsageSegment {
  startAt: string;
  endAt: string;
  usedPercent: number;
  maxObservedAt: string;
  windowStartedAt?: string | null;
  expiresAt?: string | null;
  startedByResetAt?: string | null;
  closedByResetAt?: string | null;
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
  sourceSlot?: "primary" | "secondary" | null;
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

export type BankedResetCreditEventKind = "grant" | "use" | "expiration" | "decrease-unknown";
export type BankedResetCreditEstimateBasis =
  | "official-detail"
  | "observed-grant"
  | "public-grant"
  | "assumed-grant"
  | "existing-at-first-observation";

export interface BankedResetCreditActiveCredit {
  id: string;
  acquiredAt: string | null;
  firstObservedAt: string;
  expiresAt: string | null;
  expiryBasis: "official" | "estimated" | "unknown";
  estimatedExpiresAt: string | null;
  safeEstimatedExpiresAt: string | null;
  estimateBasis: BankedResetCreditEstimateBasis;
  resetType?: "codexRateLimits" | "unknown" | null;
  status?: "available" | "redeeming" | "redeemed" | "unknown" | null;
  title?: string | null;
  description?: string | null;
  sourceId?: string | null;
}

export interface BankedResetCreditEvent {
  kind: BankedResetCreditEventKind;
  at: string;
  count: number;
  beforeAvailableCount: number;
  afterAvailableCount: number;
  estimatedExpiresAt?: string | null;
  sourceId?: string | null;
  affectedLimitIds: string[];
}

export interface BankedResetCreditRateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: string | null;
  resetsAtUnixSeconds?: number | null;
}

export interface BankedResetCreditRateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  planType: string | null;
  primary: BankedResetCreditRateLimitWindow | null;
  secondary: BankedResetCreditRateLimitWindow | null;
  credits: null;
  rateLimitReachedType: string | null;
}

export interface BankedResetCreditObservation {
  observedAt: string;
  availableCount: number;
  officialCredits?: Array<{
    id: string;
    resetType: "codexRateLimits" | "unknown";
    status: "available" | "redeeming" | "redeemed" | "unknown";
    grantedAt: string;
    grantedAtUnixSeconds: number;
    expiresAt: string | null;
    expiresAtUnixSeconds: number | null;
    title: string | null;
    description: string | null;
  }> | null;
  rateLimits?: BankedResetCreditRateLimitSnapshot | null;
  rateLimitsByLimitId?: Record<string, BankedResetCreditRateLimitSnapshot> | null;
  sourceId?: string | null;
}

export interface BankedResetCreditsSummary {
  sourceStatus: SourceStatus;
  observedAt: string | null;
  availableCount: number | null;
  inferredGrantCount: number;
  inferredUseCount: number;
  inferredExpirationCount: number;
  inferredUnknownDecreaseCount: number;
  nextEstimatedExpiresAt: string | null;
  nextSafeEstimatedExpiresAt: string | null;
  nextExpiresAt: string | null;
  nextExpiryBasis: "official" | "estimated" | null;
  officialDetailCount: number;
  officialDetailsComplete: boolean;
  activeCredits: BankedResetCreditActiveCredit[];
  events: BankedResetCreditEvent[];
  observations: BankedResetCreditObservation[];
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
    billingMonth?: CodeActivity;
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

export interface RefreshTelemetry {
  trigger: RefreshTrigger;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  codexDurationMs: number | null;
  gitDurationMs: number | null;
  codexFilesTotal: number;
  codexFilesParsed: number;
  codexFilesReused: number;
  codexCachePruned: number;
}

export interface RefreshHistoryEntry {
  id: string;
  trigger: RefreshTrigger;
  generatedFrom: DashboardSnapshot["generatedFrom"];
  sourceStatus: SourceStatus;
  completedAt: string;
  durationMs: number | null;
  codexDurationMs: number | null;
  gitDurationMs: number | null;
  codexFilesTotal: number;
  codexFilesParsed: number;
  codexFilesReused: number;
  codexCachePruned: number;
  message: string | null;
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
    refresh: RefreshTelemetry;
    refreshHistory: RefreshHistoryEntry[];
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
        billingMonth: OverviewProjectItem[];
      };
    };
    apiValueSummaryUsd: number | null;
    bankedResetCredits: BankedResetCreditsSummary;
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

export interface NotificationPreferences {
  deliveryMode: NotificationDeliveryMode;
}

export interface AppPreferences {
  codexHome: string;
  repoRoots: string[];
  billingMonthStartDay: number;
  widget: WidgetPreferences;
  notifications: NotificationPreferences;
  updates: UpdatePreferences;
}

export interface DashboardNotificationEntry {
  key: string;
  title: string;
  body: string;
  page: AppPage;
  category: DashboardNotificationCategory;
  tone: DashboardNotificationTone;
  createdAt: string;
  lastTriggeredAt: string;
  systemNotifiedAt: string | null;
  readAt: string | null;
}

export interface GitIntegrationStatus {
  available: boolean;
  version: string | null;
  userName: string | null;
  userEmail: string | null;
  checkedAt: string;
  cloudAuth: "not-required";
  message: string;
}

export interface CodexCompanionApi {
  getDashboard(force?: boolean): Promise<DashboardSnapshot>;
  getNotifications(): Promise<DashboardNotificationEntry[]>;
  markNotificationsRead(keys?: string[]): Promise<DashboardNotificationEntry[]>;
  getGitIntegrationStatus(): Promise<GitIntegrationStatus>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  installUpdate(): Promise<void>;
  setUpdatePreferences(
    patch: Partial<UpdatePreferences>
  ): Promise<AppPreferences>;
  openUpdateRelease(): Promise<void>;
  getPreferences(): Promise<AppPreferences>;
  updatePreferences(patch: Partial<AppPreferences>): Promise<AppPreferences>;
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
  onNotificationsUpdated(
    listener: (notifications: DashboardNotificationEntry[]) => void
  ): () => void;
  onUpdateStateChanged(listener: (state: UpdateState) => void): () => void;
  openPage(page: AppPage): Promise<void>;
  openExternal(url: string): Promise<void>;
  selectDirectory(): Promise<string | null>;
  showWidget(): Promise<void>;
  hideWidget(): Promise<void>;
}

import type {
  UpdatePreferences,
  UpdateState
} from "../../../shared/contracts";

interface UpdateActions {
  busy: boolean;
  onCheck: () => Promise<void>;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onOpenRelease: () => Promise<void>;
  onSetPreferences: (patch: Partial<UpdatePreferences>) => Promise<void>;
}

function phaseLabel(state: UpdateState | null): string {
  if (!state) {
    return "正在读取";
  }
  const labels: Record<UpdateState["phase"], string> = {
    idle: "等待检查",
    checking: "正在检查",
    "up-to-date": "已是最新版",
    available: "发现新版本",
    downloading: "正在下载",
    downloaded: "等待安装",
    installing: "正在安装",
    error: "检查失败",
    unsupported: "仅支持手动安装"
  };
  return labels[state.phase];
}

function phaseClass(state: UpdateState | null): string {
  if (!state) {
    return "is-pending";
  }
  if (state.phase === "available" || state.phase === "downloaded") {
    return "is-update";
  }
  if (state.phase === "error") {
    return "is-error";
  }
  if (state.phase === "up-to-date") {
    return "is-ok";
  }
  return "is-pending";
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "尚未检查";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "时间未知"
    : date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function formatBytes(value: number | null): string {
  if (value === null || value <= 0) {
    return "大小未知";
  }
  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function updatePrimaryAction(
  state: UpdateState | null,
  actions: UpdateActions
): { label: string; run: () => Promise<void>; disabled: boolean } {
  if (!state || state.phase === "idle" || state.phase === "up-to-date" || state.phase === "error") {
    return {
      label: state?.phase === "error" ? "重试" : "检查更新",
      run: actions.onCheck,
      disabled: actions.busy || !state?.canCheck
    };
  }

  if (state.phase === "available") {
    return state.canAutoInstall
      ? { label: "下载更新", run: actions.onDownload, disabled: actions.busy }
      : { label: "打开 Releases", run: actions.onOpenRelease, disabled: actions.busy };
  }

  if (state.phase === "downloaded") {
    return {
      label: "重启并安装",
      run: actions.onInstall,
      disabled: actions.busy || !state.canAutoInstall
    };
  }

  if (state.phase === "unsupported") {
    return { label: "打开 Releases", run: actions.onOpenRelease, disabled: actions.busy };
  }

  return {
    label:
      state.phase === "checking"
        ? "检查中"
        : state.phase === "downloading"
          ? "下载中"
          : "安装中",
    run: async () => undefined,
    disabled: true
  };
}

export function UpdateSettingsCard({
  state,
  preferences,
  actions,
  onShowDetails
}: {
  state: UpdateState | null;
  preferences: UpdatePreferences | null;
  actions: UpdateActions;
  onShowDetails: () => void;
}) {
  const primary = updatePrimaryAction(state, actions);
  const progress = state?.progress;

  return (
    <section className="surface-card settings-panel update-settings-card">
      <div className="section-toolbar">
        <div>
          <h3>应用更新</h3>
        </div>
        <span className={`detection-pill ${phaseClass(state)}`}>{phaseLabel(state)}</span>
      </div>

      <div className="settings-source-grid update-summary-grid">
        <span>当前版本</span>
        <strong>{state?.currentVersion ?? "读取中"}</strong>
        <span>更新通道</span>
        <strong>稳定版</strong>
        <span>最近检查</span>
        <strong>{formatDateTime(state?.lastCheckedAt ?? null)}</strong>
        <span>可用版本</span>
        <strong>{state?.availableVersion ? `v${state.availableVersion}` : "暂无"}</strong>
      </div>

      <div className="update-preference-grid">
        <label className="update-toggle">
          <input
            type="checkbox"
            checked={preferences?.autoCheck ?? true}
            disabled={!preferences || actions.busy}
            onChange={(event) =>
              void actions.onSetPreferences({ autoCheck: event.target.checked })
            }
          />
          <span>
            <strong>自动检查</strong>
          </span>
        </label>
        <label className={`update-toggle${state?.canAutoInstall ? "" : " is-disabled"}`}>
          <input
            type="checkbox"
            checked={(preferences?.autoDownload ?? true) && Boolean(state?.canAutoInstall)}
            disabled={!preferences || actions.busy || !state?.canAutoInstall}
            onChange={(event) =>
              void actions.onSetPreferences({ autoDownload: event.target.checked })
            }
          />
          <span>
            <strong>自动下载</strong>
          </span>
        </label>
      </div>

      {progress ? (
        <div className="update-progress-block" aria-live="polite">
          <div className="update-progress-copy">
            <strong>{progress.percent.toFixed(0)}%</strong>
            <span>
              {formatBytes(progress.transferred)} / {formatBytes(progress.total)} · {formatBytes(progress.bytesPerSecond)}/s
            </span>
          </div>
          <div className="update-progress-track">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      ) : null}

      {state?.errorMessage ? <p className="update-error-copy">{state.errorMessage}</p> : null}

      <div className="settings-action-row">
        <button
          type="button"
          className="action-button"
          disabled={primary.disabled}
          onClick={() => void primary.run()}
        >
          {primary.label}
        </button>
        {state?.availableVersion ? (
          <button type="button" className="secondary-button" onClick={onShowDetails}>
            查看更新说明
          </button>
        ) : null}
        {primary.label !== "打开 Releases" ? (
          <button
            type="button"
            className="secondary-button"
            disabled={actions.busy}
            onClick={() => void actions.onOpenRelease()}
          >
            打开 Releases
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function UpdateBanner({
  state,
  preferences,
  actions,
  onShowDetails
}: {
  state: UpdateState | null;
  preferences: UpdatePreferences | null;
  actions: UpdateActions;
  onShowDetails: () => void;
}) {
  if (
    !state?.availableVersion ||
    (state.phase !== "available" && state.phase !== "downloaded") ||
    (state.phase === "available" && preferences?.ignoredVersion === state.availableVersion)
  ) {
    return null;
  }

  const primary = updatePrimaryAction(state, actions);
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div>
        <strong>
          {state.phase === "downloaded"
            ? `v${state.availableVersion} 已准备安装`
            : `发现新版本 v${state.availableVersion}`}
        </strong>
      </div>
      <div className="update-banner-actions">
        <button type="button" className="secondary-button" onClick={onShowDetails}>
          查看详情
        </button>
        <button
          type="button"
          className="action-button"
          disabled={primary.disabled}
          onClick={() => void primary.run()}
        >
          {primary.label}
        </button>
        {state.phase === "available" ? (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              void actions.onSetPreferences({ ignoredVersion: state.availableVersion })
            }
          >
            忽略此版本
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function UpdateDialog({
  state,
  actions,
  open,
  onClose
}: {
  state: UpdateState | null;
  actions: UpdateActions;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !state) {
    return null;
  }

  const primary = updatePrimaryAction(state, actions);
  return (
    <div className="update-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="update-dialog-head">
          <div>
            <span className="eyebrow">稳定版更新</span>
            <h3 id="update-dialog-title">
              {state.availableVersion ? `Codex Companion v${state.availableVersion}` : "应用更新"}
            </h3>
            <p>
              {state.releaseDate ? `发布于 ${formatDateTime(state.releaseDate)}` : "发布时间未知"}
              {state.downloadSize ? ` · ${formatBytes(state.downloadSize)}` : ""}
            </p>
          </div>
          <button type="button" className="dialog-close-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="update-release-notes">
          {state.releaseNotes ? <pre>{state.releaseNotes}</pre> : <p>该版本暂未提供更新摘要。</p>}
        </div>

        {state.progress ? (
          <div className="update-progress-block">
            <div className="update-progress-copy">
              <strong>{state.progress.percent.toFixed(0)}%</strong>
              <span>{formatBytes(state.progress.transferred)} / {formatBytes(state.progress.total)}</span>
            </div>
            <div className="update-progress-track">
              <span style={{ width: `${state.progress.percent}%` }} />
            </div>
          </div>
        ) : null}

        {state.errorMessage ? <p className="update-error-copy">{state.errorMessage}</p> : null}
        <div className="update-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            稍后
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void actions.onOpenRelease()}
          >
            打开 Releases
          </button>
          <button
            type="button"
            className="action-button"
            disabled={primary.disabled}
            onClick={() => void primary.run()}
          >
            {primary.label}
          </button>
        </div>
      </section>
    </div>
  );
}

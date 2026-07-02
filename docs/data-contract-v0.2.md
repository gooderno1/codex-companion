# Codex Companion 数据契约（v0.2）

- 文档创建时间：2026-06-02
- 对应版本：`v0.3.7`
- 适用范围：桌面主界面、桌面挂件、本地快照存储

## 1. 原始数据来源

### 1.1 Codex

- 默认读取 `~/.codex/sessions/**/*.jsonl`
- 默认读取 `~/.codex/archived_sessions/*.jsonl`
- Codex home 可在设置页维护，也可通过 `CODEX_HOME` 作为首次默认路径；保存后写入 Electron `userData/settings.json`
- 如果用户在设置页恢复默认 Codex 数据目录，应用回退到 `CODEX_HOME || ~/.codex`
- 派生增量缓存：`%APPDATA%/codex-companion/codex-session-cache.json`
  - 缓存只保存每个会话文件的路径、`size`、`mtimeMs` 和解析后的聚合结果
  - 缓存不保存原始 JSONL 行、用户输入正文或模型输出正文
  - 当文件签名变化、新增文件出现或文件离开最近 `60` 天窗口时，采集器会重新解析或清理对应缓存
- 重点字段：
  - `session_meta.id`
  - `session_meta.cwd`
  - `turn_context.model`
  - `event_msg.payload.info.total_token_usage`
  - `event_msg.payload.info.last_token_usage`
  - `event_msg.payload.rate_limits`

### 1.2 Git

- 会话 `cwd` 向上查找 `.git`
- 配置的本地仓库根目录递归扫描
- 仓库根目录可在设置页维护，也可通过 `CODEX_COMPANION_REPO_ROOTS` 作为首次默认候选；保存后写入 Electron `userData/settings.json`
- 如果用户在设置页清空仓库根目录并保存，应用回退到默认自动发现路径；不会保存一个导致仓库扫描永久为空的配置
- 设置页 `Git 与授权` 只读取本机 `git --version`、`git config --global user.name` 和 `git config --global user.email` 状态；当前版本不检测 GitHub 登录、不读取 GitHub 远端 API，也不保存 GitHub token；后续接入 GitHub 云端能力时再提供授权引导。本机未安装 Git 时，Codex 用量、额度、赠送重置和通知仍可用，代码仓库页、提交数、增删行和仓库归因降级为不可用，并在设置页和代码仓库页展示 Git for Windows 安装指引。
- 重点命令：
  - `git rev-list --count --since=... HEAD`
  - `git log --numstat --format=tformat:`
  - `git diff --numstat HEAD`
  - `git remote get-url origin`
  - `git branch --show-current`

## 2. 聚合口径

### 2.1 Token

- 单次增量优先使用同一 session 内连续 `total_token_usage` 快照差值
- 如果当前记录没有 `total_token_usage`，才降级使用 `last_token_usage`
- 会话总量为会话内真实增量累加，不直接累加所有 `total_token_usage`
- 自然日、近 7 日、自然周、自然月均按事件时间戳落桶
- 计费月 Token 默认按套餐信息中的每月 `1` 日 `00:00` 起算，因此当前默认与自然月一致；后续设置页可通过 `billingMonthStartDay` 选择每月第几天作为计费月起始日。
- 计费月 Token 是时间口径，不等同于月额度。当前 Codex 原始 `rate_limits` 仍未暴露稳定月额度窗口，所以 `可观测月额度` 继续保持 `未观测`。

### 2.2 额度

- Codex 用量、额度周期、reset 检测和 banked reset credit 观测共享逻辑来自远程 Git 依赖 `@lifeinhand/codex-usage-core@0.1.0-dev.8`，固定到 `gooderno1/codex-usage-core#v0.1.0-dev.8`；本项目负责把核心包输出映射为 `DashboardSnapshot`、总览页和账本页字段。
- `5 小时额度` 使用 `rate_limits.primary`
- `周额度` 使用 `rate_limits.secondary`
- 如果同一台机器同时观测到多个 Codex `rate_limits` 池，页面可见的 `5 小时额度 / 周额度` 必须优先选择主额度池 `rate_limits.limit_id = codex`；模型或实验池，例如 `codex_bengalfox`，不能因为观测时间更新而覆盖主额度显示。
- 当前额度周期内的 `quotaObservations` 必须和被选中的额度池一致；不同 `limit_id / limit_name` 的观测样本不能混入同一个 `quotaEvidence`，否则会把模型池的低水位误当成主额度余量。
- `可观测月额度` 仅在本地快照存在月级字段时展示；当前版本若无字段则明确标记 `未观测`
- 额度圆环的剩余百分比优先使用当前额度周期的累计口径：
  - `usedPercent = PeriodMetric.quotaEvidence.usedPercent`
  - `remainingPercent = PeriodMetric.quotaEvidence.remainingPercent`
  - 如果当前周期尚无 `quotaEvidence`，才降级为最近一次原始 `rate_limits` 的 `100 - used_percent`
- 额度卡右侧 Token、成本、会话数、模型占比使用当前额度周期内的 token 增量：
  - 周期结束时间：`PeriodMetric.endAt`，未发生稳定边界校准时等于最近一次 `rate_limits.<primary|secondary>.resets_at`
  - 周期长度：`rate_limits.<primary|secondary>.window_minutes`
  - 周期开始时间：`PeriodMetric.startAt`
- 无 token 增量但包含 `rate_limits` 的记录也保留为额度观测点，用于判断重置与周期边界
- 重置识别的适用范围：
  - `5 小时额度` 仍按同一 session 内相邻观测比较，用于普通短周期累计。
  - `周额度` 按选中额度池的全局时间线比较所有 `rate_limits.secondary` 观测，不再区分历史周期和当前周期。
  - 两者都只比较同一主额度池样本；不同 `limit_id / limit_name` 的观测必须排除。
- 重置候选触发条件：
  - `resets_at` 必须向后移动超过 `60s`。
  - `used_percent` 必须下降至少 `5` 个百分点。
  - `周额度` 额外支持稳定边界回看候选：在当前观测前 `24h` 内查找旧窗口最高有效 `used_percent`；若旧高点比当前观测高至少 `5` 个百分点，且新窗口起点比旧窗口起点后移超过 `15min`，可生成 `stabilized-boundary-drop` 候选。
  - 稳定边界回看只用于 `周额度 comparisonScope=timeline`；`5 小时额度` 不启用该回看规则。
- 重置候选证据条件，满足任一项即可：
  - 高水位证据：重置前 `used_percent >= 50`。
  - 边界贴近证据：重置后的新窗口起点 `resets_at - window_minutes` 与当前观测时间相差不超过 `5min`。
  - 稳定边界回看证据：`24h` 回看旧窗口高点下降满足阈值，并且新窗口边界已实质后移。
- 重置确认条件：
  - 候选产生后至少等待 `30min` 再确认。
  - 候选后 `6h` 内必须出现同一新窗口边界的稳定观测，边界误差不超过 `5min`。
  - 如果同一确认窗口内出现新窗口边界漂移超过 `15min` 的观测，则判定为低用量滚动恢复，不作为重置事件。
  - 同一新窗口起点在 `15min` 容差内只保留最早确认事件，避免相邻候选和回看候选重复计数。
- 重置排除条件：
  - 缺少可解析 `used_percent / resets_at / window_minutes` 的观测。
  - 下降不足 `5` 个百分点。
  - 既没有 `>=50` 高水位证据，也没有 `5min` 内的新窗口边界贴近证据，且不满足 `24h` 稳定边界回看证据。
  - 稳定边界回看中，新窗口起点相对旧窗口起点后移不超过 `15min`。
  - 候选后缺少稳定窗口确认，或确认窗口内发生 `>15min` 边界漂移。
- 重置后的累计口径：
  - `5 小时额度` 在同一普通周期内仍按 reset 前后观测高点累计。
  - `周额度` 将已确认重置边界作为新计费周起点；旧周期可被重置提前截止，新周期从 `afterWindowResetsAt - window_minutes` 开始，不再把重置前后用量累加为同一计费周超过 `100%` 的累计。
- `PeriodMetric.quotaEvidence` 暴露当前额度周期的可见证据：
  - `observations`：周期内有效 `rate_limits` 观测次数
  - `resetCount`：周期内按上述规则确认的额度重置次数
  - `resetEvents`：周期内识别到的重置事件摘要，只包含观测时间、重置前后百分比、窗口恢复时间、候选证据 `evidence` 和确认结果 `confirmation`，不包含原始会话正文
  - `resetEvents[].evidence.evidenceTypes` 可包含 `high-water-drop / boundary-aligned-drop / stabilized-boundary-drop`；当使用稳定边界回看时，同步记录 `stabilizedBoundaryEvidence=true / lookbackWindowMs / lookbackObservedAt`
  - `usageSegments`：周期内用于累计额度用量的分段摘要，只包含时间范围、分段最高百分比、最高点观测时间、窗口起点、窗口过期时间和 reset 开启/截止时间
  - `maxObservedUsedPercent`：周期内原始观测最高已用百分比
  - `usedPercent / remainingPercent`：考虑重置段后的周期累计已用百分比和余量百分比
  - `lastObservedAt`：周期内最近一次额度观测时间
- 总览页额度卡圆环中心和弧线都显示当前额度周期累计余量；圆环下方将重置时间和当前额度周期起止合并为一行，用于解释右侧 token / 成本为什么可能小于自然日累计；底部短注记只说明 `圆环=周期累计余量；右侧=当前周期累计`，并以 `观测 N 次 · 重置 N 次` 展示 `observations / resetCount`，不在总览页展开历史重置明细。
- `LimitWindow.usedPercent / remainingPercent` 是页面显示字段，必须优先使用当前额度周期的累计已用百分比和余量百分比；最近一次原始 `rate_limits.used_percent` 只作为缺少周期证据时的降级来源。原因是最近一次百分比可能在同周期内回落到低水位，不能代表本周期已消耗额度。
- `LimitWindow.resetsAt` 是页面显示字段，必须与当前 `PeriodMetric.endAt` 保持一致；最近一次原始 `rate_limits.resets_at` 只作为缺少周期证据时的降级来源，避免低用量滑动窗口漂移导致“重置时间”和“周期范围”不一致。
- `LimitWindow.estimatedFullValueUsd / estimatedRemainingValueUsd` 是套餐价值折算字段，也必须使用当前额度周期的累计已用百分比作为分母，优先取 `PeriodMetric.quotaEvidence.usedPercent`，不能使用最近一次原始 `rate_limits.used_percent`。
- 为了支持前几周计费周对比，Codex session 采集窗口至少覆盖最近 `60` 天；该口径对齐 `dev-ledger` 已验证的周周期历史记录，避免只扫描当前月/周导致上一计费周样本缺失。
- `DashboardSnapshot.overview.bankedResetCredits` 独立于普通额度窗口 reset，来自 Codex app-server 只读方法 `account/rateLimits/read` 的 `rateLimitResetCredits.availableCount`：
  - `availableCount`：当前可用赠送重置次数。
  - `activeCredits[]`：逐个可用 credit 明细，包含 `acquiredAt / firstObservedAt / estimatedExpiresAt / safeEstimatedExpiresAt / estimateBasis`。
  - `estimatedExpiresAt`：按调用方初始 seed、公开 seed 或本应用采样到 `availableCount` 增加时的获取观测时间加 `30d` 推断。
  - `safeEstimatedExpiresAt`：默认比 `estimatedExpiresAt` 提前 `1d`，总览页展示为建议使用时间；用户可见文案必须把 `estimatedExpiresAt` 明确标注为预计过期时间，不能只显示裸日期。
  - `estimateBasis=public-grant`：表示首次采样时的 credit 匹配到公开发放事件 seed。核心包默认匹配 `2026-06-30` 异常消耗修复补偿 reset；`2026-06-11` Codex banking 上线 free reset 默认不匹配，因为用户确认该次很可能已使用。
  - `estimateBasis=assumed-grant`：表示本项目按用户确认口径传入的假定初始 credit。当前首次未知 credit 统一假定获取时间为 `2026-06-14T00:00:00.000Z`，按 `2026-07-14T00:00:00.000Z` 估算过期。
  - `estimateBasis=observed-grant`：表示本项目曾经观测到 `availableCount` 增加。当前第三次 credit 以 `2026-07-01T19:58:24.705Z` 的本地观测新增为准；即使滚动历史裁剪掉早期 `2 -> 3` 差分，也通过核心包 `activeCreditBaseline` 延续该明细。
  - `estimateBasis=existing-at-first-observation`：表示首次采样时已经存在且未匹配公开 seed 或后续新增观测的 credit，无法反推获取时间和真实过期时间；页面展示为“早于首次观测获得 / 无法反推”，通知只生成一次待确认提醒。
  - `events[]`：仅保存 `grant / use / expiration / decrease-unknown` 的脱敏推断摘要，不保存原始 app-server 响应、账号、邮箱或余额。
  - `observations[]`：仅保存继续推断所需的脱敏观测历史，保留 `observedAt / availableCount / rateLimits` 的窗口百分比和 reset 时间，不保存 `credits.balance`。
- `overview.bankedResetCredits` 不得混入 `quotaEvidence.resetCount`，也不得称为现金充值、API credit 或账单余额。
- 参考验证样例：
  - `dev-ledger` 中 `2026-06-29` 的周额度从旧窗口 `used_percent=10 / resets_at=2026-07-02 13:11` 切换到新窗口 `used_percent=0 / resets_at=2026-07-06 09:01`。该事件虽低于 `50%` 高水位，但新窗口起点与观测时间贴近，并通过 `stable-window-boundary` 稳定确认。
  - `dev-ledger` 中 `2026-06-30T03:56:42.332Z` 的周额度相邻观测都是 `0%`，但 `24h` 回看旧窗口高点为 `15%`，旧高点观测时间为 `2026-06-29T18:16:43.673Z`；新窗口边界为 `2026-06-30T03:22:09Z`，后续 `84` 个稳定观测确认同一边界，因此识别为 `stabilized-boundary-drop` 周重置，当前周切到 `2026-06-30T03:22:09Z - 2026-07-07T03:22:09Z`。
  - `2026-06-24` 的多次低用量滑动窗口因确认窗口内边界漂移超过 `15min` 被排除。

### 2.3 成本与价值

- API 等价成本使用公开 API 定价按模型估算
- 周套餐价值折算公式：
  - `当前周额度周期 API 等价成本 / 当前周周期累计已用百分比 * 100`
- 剩余价值空间公式：
  - `折算总价值 - 当前周 API 等价成本`

### 2.4 仓库归因

- 通过会话 `cwd` 向上找到 Git 根目录
- 若无法找到 Git 根目录，则该会话保留 `未归因`
- 总览页项目概览保留所有已发现本地项目；当前周期无 Token、代码、提交和会话活动的项目显示 0 / `--`，不从表格中过滤。
- 顶部 `今日代码改动` 使用自然日 Git `changedLines = additions + deletions`；次级说明 `较昨日` 使用昨日自然日同口径作为分母。昨日有 Git 数据时必须计算百分比，不能因为 token 昨日窗口为空而把昨日代码默认为 0。
- 计费时间项目概览包含 `5H / 周额度 / 计费月` 三个周期；其中 `计费月` 的 Token、会话、成本和 Git 代码活动都使用 `billingMonthStartDay` 推导出的计费月起点，不能用自然月数据冒充。

### 2.5 刷新与增量采集

- 手动刷新、启动后台刷新和 5 分钟自动刷新都必须生成同一份 `DashboardSnapshot` 合同。
- Codex 会话采集必须优先使用增量缓存：同一 JSONL 文件的 `size + mtimeMs` 未变化时复用上次解析结果；只有新增或变更文件才重新流式解析。
- 增量缓存只用于减少重复读盘，不改变 Token、额度、模型、会话和仓库归因口径。
- 每次刷新必须在 `sourceHealth.refresh` 写入可见反馈字段：
  - `trigger`：刷新来源，取值为 `manual / auto / startup / background`
  - `startedAt / completedAt / durationMs`：本次刷新起止与总耗时
  - `codexDurationMs / gitDurationMs`：Codex 会话段与 Git 仓库段耗时
  - `codexFilesTotal`：本次纳入最近 60 天窗口的 Codex JSONL 文件数
  - `codexFilesParsed`：本次实际重新解析的 JSONL 文件数
  - `codexFilesReused`：本次从增量缓存复用的 JSONL 文件数
  - `codexCachePruned`：本次清理出缓存窗口的旧文件数
- 每次 live 刷新或缓存回退必须向 `sourceHealth.refreshHistory` 追加一条记录，最多保留最近 `30` 条；设置页只展示最近 `5` 条摘要，完整刷新历史页按 `manual / auto / startup / background` 筛选并分页查看。
- 顶部刷新反馈条只是临时状态提示，刷新完成或失败后约 `5s` 消失；长期追溯以 `sourceHealth.refreshHistory` 为准。
- 读取旧版 `snapshot.json` 时如果缺少 `sourceHealth.refresh`，主进程必须补齐默认结构，避免升级后首屏渲染异常。

### 2.6 应用内提醒与系统通知

- 提醒只在主进程处理 `generatedFrom=live` 的 `DashboardSnapshot` 后触发；缓存快照、pending 快照和截图模式不触发新提醒。
- 提醒只消费现有聚合字段，不重新解析 Codex session，也不改变 `codex-usage-core` 的 reset 检测口径。
- 通知按固定一次性规则生成；设置页不再展示通知策略入口。`notifications.deliveryMode` 仅为兼容旧版 `settings.json` 保留，默认按 `balanced` 处理。
- 触发范围：
  - 赠送重置：对可估算 `estimatedExpiresAt` 的 credit，按预计过期时间提前 `7d / 3d / 1d / 12h / 1h` 生成里程碑提醒；如果应用首次观测时已过期，可生成一次 `expired` 补偿提醒；`estimateBasis=existing-at-first-observation` 无法反推过期时间时只生成一次待确认提醒，且待确认提醒可与已知过期里程碑同时存在。
  - 额度提醒：`5H 额度` 或 `周额度` 当前周期 `remainingPercent <= 20%` 时生成一次 warning；`remainingPercent <= 10%` 时按同一周期生成一次 danger。
- 排除条件：
  - `sourceStatus=pending / unobserved` 的赠送重置不提醒。
  - `LimitWindow.sourceStatus` 非 `observed` 的额度窗口不提醒。
  - `可观测月额度` 暂不触发提醒，因为当前月额度字段仍未稳定观测。
- 状态存储：写入 Electron `userData/notification-state.json`，保存通知 key、标题、正文、页面、类别、级别、创建时间、最近触发时间、系统通知时间和已读时间。
- 展示方式：渲染层通过 `notifications:get` 读取应用内提醒，顶部铃铛展示最近 8 条快速摘要，通知页展示完整历史、筛选、分页和详情；通过 `notifications:updated` 接收更新，通过 `notifications:mark-read` 标记已读；系统通知只是同一条应用内提醒的外部提示。
- 去重方式：赠送重置过期提醒按 `banked-reset:expiration:<milestone>:<estimatedExpiresAt>` 生成稳定 key；待确认提醒按状态、数量和首次观测时间生成稳定 key；额度提醒按额度窗口、周期起止和阈值生成稳定 key。同一 key 已存在时只更新标题和正文，不更新最近触发时间、不重置未读、不重复创建系统弹窗。
- 隐私边界：提醒正文只包含聚合后的剩余百分比、周期范围和赠送重置估算时间，不展示账号、邮箱、原始 app-server 响应、余额字段、原始 JSONL、用户输入正文或模型输出正文。

## 3. 状态字段

- `已观测`：本次刷新已成功解析到至少一条 Codex token 事件；最近是否继续产生新 token 事件只影响 `lastObservedAt` 说明，不影响该状态。
- `待刷新`：发现会话文件，但没有解析到可用 token 事件，需等待后台采集或新会话数据。
- `未观测`：根本没有相关额度字段或没有可解析会话
- `数据过期`：保留给缓存快照或后续外部源时效不足的异常态；不能仅因最新 token 事件距离当前超过 45 分钟而触发。

补充约定：

- `lastObservedAt` 表示本地 Codex 会话中最近一次可观测 token 事件时间。
- 当 `lastObservedAt` 距离当前超过 `45` 分钟时，刷新反馈和 `sourceHealth.notes` 可以提示最近活动时间，但全局 `sourceStatus` 仍以本次采集是否成功为准。

## 4. 首版边界

- 不上传原始 session
- 不读取 GitHub 远端 API
- 不把未定价模型强行折算为虚构成本；未知模型当前记为 0 成本并等待后续补表
- 不把自然月 Token 或默认计费月 Token 伪装成真实月额度；月额度必须等待 Codex 原始 `rate_limits` 暴露可验证字段。

## 5. 审计记录

- `docs/data-audit/overview-token-quota-audit-v0.1.md`：复核总览页自然时间 Token 与额度窗口 Token 差异，确认当前实现没有把今日首个 `total_token_usage` 累计快照直接计为自然日增量。
- `docs/goal-audit/overview-goal-completion-audit-v0.1.md`：按原目标逐项复核设计对照、图标资产、真实额度数据和当前可交付状态。

## 6. 可执行校验

`v0.2.2-dev.37` 起提供只读额度快照校验命令：

```bash
npm run verify:quota
```

默认读取运行态 `snapshot.json`，也可以通过 `-- --snapshot <path>` 或 `CODEX_COMPANION_SNAPSHOT_PATH` 指定快照路径。

该命令只校验聚合后的快照字段，不读取或输出原始会话正文。校验范围包括：

- `5H` 与 `周额度` 窗口必须来自主额度池 `limit_id=codex` 的 `primary / secondary`；没有 `limit_id=codex` 时才允许降级到可解析的最新额度池。
- 窗口长度必须分别为 `300` 与 `10080` 分钟。
- 圆环余量必须等于当前周期 `quotaEvidence.remainingPercent`；缺少周期证据时才允许降级为 `100 - 最近 usedPercent`。
- 当前 `5H` 与当前周额度 `LimitWindow.resetsAt` 必须等于对应 `PeriodMetric.endAt`；周额度周期允许由已确认 reset 边界校准，不能强制回退到最新原始 `rate_limits.resets_at`。
- 当前周期必须包含 `quotaEvidence` 观测证据。
- 如快照内存在 `resetEvents[]`，每个事件必须包含 `evidence` 和 `confirmation.status=confirmed`，且确认原因必须为 `stable-window-boundary`；事件证据必须至少具备高水位、边界贴近或稳定边界回看中的一种。
- `estimatedValueBasisUsedPercent` 必须使用周期累计 `quotaEvidence.usedPercent`，不得回退到最近一次原始 `usedPercent`。
- `estimatedFullValueUsd` 必须按 `estimatedSpentUsd / 周期累计已用百分比` 计算。

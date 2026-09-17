# Codex Companion 数据契约（v0.2）

- 文档创建时间：2026-06-02
- 对应版本：`v0.6.2`
- 适用范围：桌面主界面、桌面挂件、本地快照存储

## 1. 原始数据来源

### 项目与会话按需详情（v0.6.1-dev.1）

- `activity:details` 接收 `startAt: ISO | null / endAt: ISO / force?: boolean`；`null` 表示全部本地保留记录，时间边界为左闭右开，未来终点截到请求时间。
- `ActivityDetailsService` 按需扫描全部 sessions 与 archived_sessions；主快照仍采用原 60 天快速扫描，详情不写入 `DashboardSnapshot`。
- 使用独立 SQLite 增量索引，初次可读常规缓存复用，不写回或驱逐常规缓存；每次查询检查文件变化，同目录并发索引刷新合并，跨重启复用。
- 返回 `projects / sessions / coverage / range / generatedAt`，仅含统计、路径、ID 和时间；不含原始对话、工具命令或凭据。
- 按事件时间重算范围 Token、成本、模型与本地日期日用量；会话创建时间是元数据，不用于把整条会话用量归入某一天。输入含缓存、输出含推理，不重复相加。
- 项目对应 Codex 项目身份，Git 为可选关联；`__unattributed__` 保留无项目 / 未匹配用量，项目与会话 Token 总量守恒。
- Git 通过独立 `activity:code` 按需查询，不阻塞列表。Git 行数和提交按当前 HEAD 可达历史查询，使用提交时间；二进制不计行数，不含未提交修改；读取失败为 `null`，不视为零，不将仓库活动强行归因到单个会话。
- 模型 `priced=false` 时显示未定价，汇总成本仅包含已知价格。覆盖起止来自有效本地事件，全部记录不代表被删除或仅云端的历史。
- 设计与验证见 `docs/activity-details-design-2026-09-17.md` 和 `npm run verify:activity`。

### 1.1 Codex

- 默认读取 `~/.codex/sessions/**/*.jsonl`
- 默认读取 `~/.codex/archived_sessions/*.jsonl`
- 当前额度优先读取 Codex 官方桌面端同源的 `https://chatgpt.com/backend-api/wham/usage`；鉴权信息来自 Codex home 下的 `auth.json`，仅在主进程内存使用
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
- 本地 session 兼容读取 `rate_limits.primary` 与 `rate_limits.secondary`；页面业务窗口按时长分类，不把槽位名当成永久业务语义。

### 1.2 Git

- 会话 `cwd` 向上查找 `.git`
- 配置的本地仓库根目录递归扫描
- 仓库根目录可在设置页维护，也可通过 `CODEX_COMPANION_REPO_ROOTS` 作为首次默认候选；保存后写入 Electron `userData/settings.json`
- 如果用户在设置页清空仓库根目录并保存，应用回退到默认自动发现路径；不会保存一个导致仓库扫描永久为空的配置
- Windows 开机自启偏好写入 Electron `userData/settings.json` 的 `startup.launchAtLogin`，默认值为 `false`。仅 Windows 正式安装版调用 Electron 登录启动项 API；保存时先确认系统状态已更新，再持久化偏好，持久化失败时尝试回滚系统状态。应用每次启动会按本地偏好重新校准；开发模式和非 Windows 平台不注册启动项。
- 总览变化显示偏好写入 Electron `userData/settings.json` 的 `overview.comparisonDisplay`，合法值为 `percentage / absolute`，默认 `percentage`；旧配置缺少该字段时自动补为默认值。切换只改变顶部四卡的变化说明，不触发 Codex / Git 重新采集。
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
- 总览变化值统一使用上一周期同期：当前周期从起点累计到快照 `generatedAt`，上一周期从对应起点累计相同已过时长，且结束时间不超过上一周期边界。`overview.previous.yesterday / naturalWeek / month / fiveHour / weekLimit / billingMonth` 均遵循该语义，不再保存完整上一周期作为顶部卡片分母。
- 用户可见对比标签固定为“昨日同期 / 上周同期 / 上月同期 / 上个额度周同期 / 上个计费月同期”，避免把同进度值误解为完整上一周期。
- 跨月同期若上一月天数更少，上一周期结束时间封顶到上一月末。例如 `3 月 31 日 12:00` 的本月 Token 对比 `2 月 1 日 00:00 - 3 月 1 日 00:00`，不会越过 2 月边界。
- 计费月 Token 默认按套餐信息中的每月 `1` 日 `00:00` 起算，因此当前默认与自然月一致；后续设置页可通过 `billingMonthStartDay` 选择每月第几天作为计费月起始日。
- 计费月 Token 是时间口径，不等同于月额度。当前 Codex 原始 `rate_limits` 仍未暴露稳定月额度窗口，所以 `可观测月额度` 继续保持 `未观测`。

### 2.2 额度

- Codex 用量、额度周期、reset 检测、官方 Usage 读取和 banked reset credit 观测共享逻辑来自远程 Git 依赖 `@lifeinhand/codex-usage-core@0.2.0-dev.3`，固定到 `gooderno1/codex-usage-core#v0.2.0-dev.3`；本项目负责把核心包输出映射为 `DashboardSnapshot`、总览页和账本页字段。赠送重置优先使用 `rateLimitResetCredits.credits[]` 的官方 `grantedAt / expiresAt`；明细缺失或被截断时继续使用估算，权威总数始终取 `availableCount`。
- 当前额度来源优先级为：官方 Usage 当前快照；请求失败时回退本地 session `rate_limits`。本地观测继续承担 token 增量、历史周期和 reset 证据，不因当前快照接入而删除。
- 官方 Usage 按 `limit_window_seconds / 60` 自适应映射窗口；响应新增 `300` 分钟窗口后无需更新槽位代码即可显示 5H。响应缺少某个窗口时保持未观测，不用缓存或历史窗口伪造当前值。
- `5 小时额度` 使用时长分类为 `five-hour` 的 `300` 分钟窗口；该窗口可位于 `primary` 或 `secondary`，不存在时 `limitWindows[0]` 输出 `key=fiveHour / sourceStatus=unobserved / sourceSlot=null`。
- `周额度` 使用时长分类为 `weekly` 的 `10080` 分钟窗口；该窗口可位于 `primary` 或 `secondary`，当前新版契约为 `primary=10080 / secondary=null`。
- 如果同一台机器同时观测到多个 Codex `rate_limits` 池，页面可见的 `5 小时额度 / 周额度` 必须优先选择主额度池 `rate_limits.limit_id = codex`；模型或实验池，例如 `codex_bengalfox`，不能因为观测时间更新而覆盖主额度显示。
- 当前额度周期内的 `quotaObservations` 必须和被选中的额度池一致；不同 `limit_id / limit_name` 的观测样本不能混入同一个 `quotaEvidence`，否则会把模型池的低水位误当成主额度余量。
- 周额度观测映射到页面周期时，若共享核心包已确认 reset，且观测写入时间不早于归一化 reset 边界、其 `resetsAt` 与 `beforeWindowResetsAt` 相差不超过既有边界校准容差 `5min` 并且更接近旧窗口截止时间，该观测仍归属 reset 前的周期。距离相等或更接近新窗口时不重分配，避免新旧边界相距小于 `5min` 时误归属。只调整观测的周期映射，不改观测原始时间，也不改同条记录的 Token 时间归属。
- 例如新周期从 `2026-09-16T08:07:10Z` 起算，`08:07:20.955Z` 写入的 `98% / resetsAt=2026-09-19T10:58:40Z` 是旧窗口；确认 reset 后应保留在旧周期。新窗口 `resetsAt=2026-09-23T08:07:10Z` 的高水位为 `51%` 时，当前余量为 `49%`。同一窗口的普通低水位回落、未确认 reset 和 5H 不触发这项映射修复。
- `可观测月额度` 仅在本地快照存在月级字段时展示；当前版本若无字段则明确标记 `未观测`
- 额度圆环、挂件和低额度提醒使用当前值：官方 Usage 成功时取官方 `usedPercent`；请求失败时取同池同类窗口的本地最新有效观测；`remainingPercent = 100 - usedPercent`。
- `quotaSource` 标明 `official-usage / local-session`；当前值不依赖 reset 是否确认，也不允许被 `quotaEvidence` 高水位覆盖。
- 本地回退排除过期、无效时间、非有限或越界百分比、非正时长，以及窗口起点比观测时间晚超过 `5min` 的未来样本。优先选择最新有效截止时间所标识的窗口，再在该截止时间前 `60s` 的时钟容差内取最新记录；不依赖用量下降或历史 reset 确认，迟到记录不得倒退当前窗口。
- 当前周历史证据按相同 `resetsAt` 和匹配时长筛选；确认前也不得混入旧窗口。同窗口高水位仍保留在 `quotaEvidence` 用于历史分析和价值估算。
- 官方成功响应缺少窗口时维持未观测；本地也没有有效窗口时不推算当前余量。
- 额度卡右侧 Token、成本、会话数、模型占比使用当前额度周期内的 token 增量：
  - 周期结束时间：`PeriodMetric.endAt`，未发生稳定边界校准时等于最近一次 `rate_limits.<primary|secondary>.resets_at`
  - 周期长度：`rate_limits.<primary|secondary>.window_minutes`
  - 周期开始时间：`PeriodMetric.startAt`
- 无 token 增量但包含 `rate_limits` 的记录也保留为额度观测点，用于判断重置与周期边界
- 重置识别的适用范围：
  - `5 小时额度` 仍按同一 session 内相邻观测比较，用于普通短周期累计。
  - `周额度` 按选中额度池的全局时间线比较所有 `10080` 分钟观测；历史观测可来自 `secondary`，新版观测可来自 `primary`，槽位迁移不改变业务窗口类型。
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
  - 已识别旧窗口的迟到记录不属于新边界漂移；按时长隔离确认样本。后续独立 reset 已确认时，以它的观测时间截止前一个确认区间。
  - 同一新窗口起点在 `15min` 容差内只保留最早确认事件，避免相邻候选和回看候选重复计数。
  - 不同窗口不再因为 `12h` 内用量相似被合并。
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
- 总览页额度卡圆环中心和弧线显示当前余量，注记为 `余量=官方当前值（或本地最新有效值）；右侧=当前周期累计`；历史 `observations / resetCount` 保留为独立证据。
- `LimitWindow.usedPercent / remainingPercent / resetsAt / observedAt` 来自同一个当前观测；历史高水位、历史截止时间不得覆盖它们。
- 当前周周期起止由当前窗口的 `resetsAt - windowMinutes` 与 `resetsAt` 锚定；历史 reset 尚未确认时也不能把当前 Token 归到旧周期。历史周期仍保留已确认 reset 证据。
- 快照 `quotaDisplayVersion=2` 标记当前值语义。旧语义、超过 `60s` 或额度窗口已到期的磁盘/进程内快照不得作为当前额度缓存返回；原快照仍可供历史 reset credit 分析。
- 采集异常回退时清空总览、账本额度与挂件的当前余量，标记数据过期；保留历史 Token 与证据，且保留原始 `generatedAt`，不得把失败刷新时间伪装成采集时间。
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

- API 等价成本使用公开 API 标准定价按模型估算，不代表订阅账单或精确 API 账单。
- `tokens.input` 为包含缓存的输入总量；非缓存输入为 `max(0, input - cachedInput)`。成本为 `(非缓存输入 × 输入单价 + cachedInput × 缓存单价 + output × 输出单价) / 1,000,000`；推理输出已包含在 `output` 内，不再加计。已知 Codex credit 同样使用非缓存输入，避免缓存重复计费。
- `gpt-6-astra` 按每百万非缓存输入 / 缓存输入 / 输出 `$10 / $1 / $50`，来源为 [OpenAI GPT-6 Astra 模型页](https://developers.openai.com/api/docs/models/gpt-6-astra)，核对日期 `2026-09-17`。`1,000,000` 输入（其中 `800,000` 缓存）和 `100,000` 输出的标准估算为 `$7.80`。
- 当前事件字段不足以还原每次请求的服务档位、缓存写入量及长上下文计价，因此成本不含上述调整。GPT-6 Astra 官方还定义了缓存写入 `$12.50/M`、超过 `272K` 输入的长上下文倍率及 Fast / Batch / Flex 档位；不能用周期累计 Token 触发这些请求级倍率。
- 模型匹配仅接受已登记名称或其 `-YYYY-MM-DD` 日期快照；`gpt-5.4-mini` 的日期快照保持 mini 单价。未登记的 `gpt-6`、`gpt-6-astra-pro`、`gpt-5.6-sol` 等型号不套用其他模型价格。GPT-6 Astra 的 Codex credit 尚未核实，保持未定价，不用 API 美元价格反推。
- 会话缓存含派生成本，缓存版本升级至 `2`；升级后旧版缓存即使文件尺寸和修改时间不变也要重新解析，下次刷新即可重算历史成本，随后继续增量复用。原始 Token 统计不变。
- 周套餐价值折算公式：
  - `当前周额度周期 API 等价成本 / 当前周周期累计已用百分比 * 100`
- 剩余价值空间公式：
  - `折算总价值 - 当前周 API 等价成本`

### 2.4 仓库归因

- 总览和会话归因以 Codex 的 `projects / project_roots / threads.project_id` 为主，数据库只读；兼容桌面 `local-projects`、迁移 ID 映射、旧版保存根目录及会话归属。
- 顺序：数据库显式归属 > 桌面显式归属 > 明确无项目 > 旧版 root hint > cwd 最长根路径匹配。相同根目录多个项目、显式已删除项目或无法匹配时，保留「无项目 / 未匹配」，不能用 Git 仓库替代项目。
- `SessionAttribution.projectId / projectName` 是 Codex 项目身份；原 `repoId` 仅保留用于独立仓库统计。项目无需 Git；关联仓库未知时 `codeAvailable=false`，代码行数和提交显示「—」。
- `projectAttributionVersion=1` 标记新快照口径；旧版仓库分组缓存不得重新作为项目表显示，失败回退也须清除旧项目分组。
- 总览页项目概览保留所有已发现本地项目；当前周期无 Token、代码、提交和会话活动的项目显示 0 / `--`，不从表格中过滤。
- 顶部 `今日代码改动` 使用自然日 Git `changedLines = additions + deletions`；次级说明 `较昨日同期` 使用昨日 `00:00` 到与当前相同时间进度的 Git 改动作为分母。例如今天 `15:30` 查看时，只统计昨天 `00:00 - 15:30`；不能拿完整昨日比较，也不能因为昨日 token 窗口为空而把昨日代码默认为 0。
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
- 展示方式：渲染层通过 `notifications:get` 读取应用内提醒，顶部铃铛展示最近 8 条快速摘要，通知页展示完整历史、筛选、分页和详情；通过 `notifications:updated` 接收更新，通过 `notifications:mark-read` 标记已读；系统通知只是同一条应用内提醒的外部提示。Windows 系统通知对象在等待点击期间由主进程保活；系统通知与顶部单条“查看详情”通过 `notifications:open` 携带 key，主进程发送 `app:navigate`，渲染层进入 `#/notifications?notification=<key>` 并定位对应分页和详情，不重新加载主页；通知记录携带的 `page` 只用于通知页内“查看关联页面”。
- 去重方式：赠送重置过期提醒按 `banked-reset:expiration:<milestone>:<estimatedExpiresAt>` 生成稳定 key；待确认提醒按状态、数量和首次观测时间生成稳定 key；额度提醒按额度窗口、周期起止和阈值生成稳定 key。同一 key 已存在时只更新标题和正文，不更新最近触发时间、不重置未读、不重复创建系统弹窗。
- 隐私边界：提醒正文只包含聚合后的剩余百分比、周期范围和赠送重置估算时间，不展示账号、邮箱、原始 app-server 响应、余额字段、原始 JSONL、用户输入正文或模型输出正文。

### 2.7 应用更新

- `UpdateState.phase` 只允许 `idle / checking / up-to-date / available / downloading / downloaded / installing / error / unsupported`。
- `currentVersion` 必须来自主进程 `app.getVersion()`；renderer 不自行决定可用版本或比较结果。
- `availableVersion / releaseDate / releaseNotes / downloadSize` 来自 GitHub update metadata；Release notes 必须清洗为最多 `4000` 字符纯文本。
- `progress` 只在下载态包含 `percent / bytesPerSecond / transferred / total`，百分比归一化到 `0..100`。
- `errorCode / errorMessage` 只允许稳定错误码和脱敏中文摘要，不包含 token、请求头、下载路径或底层堆栈。
- `canCheck` 只在 Windows 已打包 NSIS 形态为真；开发模式、便携版和其他平台输出 `unsupported`。
- `canAutoInstall` 在 Windows 已打包 NSIS 形态并满足当前更新政策时为真；临时未签名模式允许自动下载和用户确认安装，其他平台、开发模式和便携版固定为假。
- `trustMode` 只允许 `unsigned-temporary / trusted-publisher / unsupported`；`canInstallOnQuit` 仅在可信 publisher 模式为真，临时未签名模式固定为假。
- `preferences.updates` 保存 `autoCheck / autoDownload / ignoredVersion / installOnQuit`；默认自动检查和自动下载为真，但 `autoDownload` 仍受 `canAutoInstall` 门禁并排除 `ignoredVersion`。发现更新时满足门禁会立即下载；已经处于 `available` 时把 `autoDownload` 从关闭改为开启，也必须立即开始下载。`installOnQuit` 还必须受 `canInstallOnQuit` 门禁。
- renderer 通过 `updates:get-state / check / download / install / set-preferences / open-release` 触发受控动作，通过 `updates:state-changed` 接收状态；不能指定任意 feed 或 URL。
- `downloaded` 事件中的安装包路径只保留在主进程；确认安装时必须验证真实路径位于 `LOCALAPPDATA/codex-companion-updater`、文件名为 `Codex.Companion.Setup.<availableVersion>.exe`，再启动独立 Windows helper。
- helper 由当前用户的临时 Windows 计划任务启动，主程序必须观察到相同 `requestId` 的首个交接状态后才能退出；helper 等待当前主进程退出后才以 `--updated /S --force-run` 运行 NSIS，并把 `helper_started / parent_timeout / installer_started / launch_failed / install_succeeded / install_failed` 写入本机 `userData/updates/install-helper/install-handoff.json`，结束时删除临时任务；renderer 不读取路径、任务名和底层日志。

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

- `5H` 与 `周额度` 窗口必须来自主额度池 `limit_id=codex`；没有 `limit_id=codex` 时才允许降级到可解析的最新额度池。业务语义按时长识别，不按槽位名识别。
- 已观测窗口长度必须分别为 `300` 与 `10080` 分钟；当前契约没有 `300` 分钟窗口时，5H 卡必须明确输出未观测状态，周额度仍需从 `10080` 分钟 primary 正常生成。
- 圆环余量必须等于 `100 - 当前有效 usedPercent`，来源必须为官方 Usage 或本地最新有效窗口；历史 `quotaEvidence.remainingPercent` 可以不同，不能覆盖当前值。
- 当前 `5H` 与当前周额度 `LimitWindow.resetsAt` 必须等于对应 `PeriodMetric.endAt`，当前周期由当前有效窗口锚定；历史周期仍允许已确认 reset 边界校准，不得覆盖当前截止时间。
- 当前周期必须包含 `quotaEvidence` 观测证据。
- 如快照内存在 `resetEvents[]`，每个事件必须包含 `evidence` 和 `confirmation.status=confirmed`，且确认原因必须为 `stable-window-boundary`；事件证据必须至少具备高水位、边界贴近或稳定边界回看中的一种。
- `estimatedValueBasisUsedPercent` 必须使用周期累计 `quotaEvidence.usedPercent`，不得回退到最近一次原始 `usedPercent`。
- `estimatedFullValueUsd` 必须按 `estimatedSpentUsd / 周期累计已用百分比` 计算。

## 历史详情持久化查询（v0.6.1-dev.1）

- Companion 用户数据目录保存 `activity-index-<Codex目录摘要>.sqlite`，使用 WAL、文件主键及 `events_at` 时间索引；不写入 Codex 的 state 数据库。
- `files` 仅含路径、size、mtime 和结构化会话统计；`events` 仅含所属文件、序号、事件时间和结构化 Token / 模型 / 成本数据，不保存 JSONL 原文或对话内容。
- 文件签名不变时复用；变化时事务替换全部该文件事件，避免累计增量被重复叠加；归档移动、截断、删除均更新。读取期间变化的文件标记待重读。
- 每次查询按 `at >= start AND at < end` 使用时间索引，首次须建立全历史索引；首末覆盖时间使用全索引，范围外事件不进入统计。
- 索引版本关联 `CODEX_SESSION_CACHE_VERSION`；解析规则或价格变化提升版本后自动重建。首次可复用相同版本且签名一致的普通缓存，不改写普通缓存。
- 同一目录并发索引刷新合并；目录不同使用不同数据库。Git 通过 `activity:code` 按项目 ID 查询，不接受任意路径；按项目 / 根目录 / 时间范围缓存 60 秒，强制读取跳过缓存。
- 详情显示全部 Codex 项目，包括当前范围零用量项目；无项目的用量另列保留。共享同一 Git 仓库的项目独立统计 Token，仓库提交不可直接跨项目相加。

## 会话名称与 Token 显示（v0.6.2-dev.1）

- `ActivitySession.name: string | null` 和 `SessionAttribution.name?: string | null` 使用 Codex 自动生成或用户修改的名称；旧快照字段缺失仍可读取。
- 来源优先级：最新 state SQLite 的非空 `threads.name` > `session_index.jsonl` 中同 ID 最新有效 `thread_name` > 无名称。索引重复行按 `updated_at` 取最新，同时间取靠后行；损坏行跳过，旧 schema 或数据库不可读时继续使用名称索引。
- 不将 `threads.title`、首条输入或正文截断当作名称。本机核查：148 条 name 与 thread_name 一致，但 472 / 525 条 title 等于首条输入。
- 名称在每次详情查询及主快照刷新时独立读取，改名不触发 Token 文件重新解析；主快照保存名称，历史统计 SQLite 不新增正文或名称字段。
- 账本会话列表、详情列表和对象标题优先显示名称；会话 ID 用作稳定选择键和辅助信息，详情保留完整 ID。名称缺失时回退 ID；名称和 ID 都参与搜索。
- Token 共用总览 `formatCompactToken`：小于 10,000 为整数；10,000 起为万，100,000,000 起为亿。万值在原值低于 100,000 时保留 1 位小数，否则 0 位；亿值在原值低于 1,000,000,000 时保留 1 位，否则 0 位。
- 示例：12,500 → 1.3 万，123,456,789 → 1.2 亿；详情悬停显示完整的 123,456,789 Token。显示换算不改变原始数据、筛选、排序或求和。
- 详情汇总、项目 / 会话列表、Token 分项、模型表及每日用量表全部使用同一函数；会话数、事件数、Git 行数保持整数，成本保持美元。

## v0.6.2-dev.2 表头双向排序

- 详情主列表、模型构成、每日用量及账本会话表使用 `TableSortHeader`；共享比较规则见 `src/shared/tableSort.ts`。
- 新字段首次点击升序，再次点击降序；箭头、高亮及 aria-sort 表达当前状态。详情工具栏字段与方向同步，可选择最近活动时间。
- 主列表默认最近活动降序；模型默认 Token 降序；每日默认日期降序。项目 / 会话视图分别保留排序，切换对象重置子表排序。
- 按原始 Token、金额和时间戳比较；名称按中文自然顺序比较，同值按 ID / key 稳定排序。缺失时间和模型未定价成本始终置后；主列表 / 每日部分定价成本仍按已知合计排序并保留星号提示。
- 筛选后对全部结果排序再分页，排序回到第一页，保持范围、搜索、项目筛选和已选对象。账本对当前快照已加载的全部会话排序后展示前 8 条。
- 排序仅在渲染端进行，不触发 IPC、数据库、会话解析或 Git 读取，不改变汇总结果。
- 详细交互与验证范围见 `docs/activity-sorting-design-2026-09-17.md`。

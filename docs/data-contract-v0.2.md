# Codex Companion 数据契约（v0.2）

- 文档创建时间：2026-06-02
- 对应开发版本：`v0.2.2-dev.61`
- 适用范围：桌面主界面、桌面挂件、本地快照存储

## 1. 原始数据来源

### 1.1 Codex

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/archived_sessions/*.jsonl`
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
  - 周期结束时间：最近一次 `rate_limits.<primary|secondary>.resets_at`
  - 周期长度：`rate_limits.<primary|secondary>.window_minutes`
  - 周期开始时间：`resets_at - window_minutes`
- 无 token 增量但包含 `rate_limits` 的记录也保留为额度观测点，用于判断重置与周期边界
- 如果同一额度周期内观测到 reset，周期使用百分比按 reset 前后观测高点累计；圆环中心和弧线都显示该周期累计后的剩余百分比
- `PeriodMetric.quotaEvidence` 暴露当前额度周期的可见证据：
  - `observations`：周期内有效 `rate_limits` 观测次数
  - `resetCount`：周期内按相邻同 session 观测识别到的额度重置次数
  - `resetEvents`：周期内识别到的重置事件摘要，只包含观测时间、重置前后百分比和窗口恢复时间，不包含原始会话正文
  - `usageSegments`：周期内用于累计额度用量的分段摘要，只包含时间范围、分段最高百分比和最高点观测时间
  - `maxObservedUsedPercent`：周期内原始观测最高已用百分比
  - `usedPercent / remainingPercent`：考虑重置段后的周期累计已用百分比和余量百分比
  - `lastObservedAt`：周期内最近一次额度观测时间
- 总览页额度卡圆环中心和弧线都显示当前额度周期累计余量；圆环下方将重置时间和当前额度周期起止合并为一行，用于解释右侧 token / 成本为什么可能小于自然日累计；底部短注记只说明 `圆环=周期累计余量；右侧=当前周期累计`，并以 `观测 N 次 · 重置 N 次` 展示 `observations / resetCount`，不在总览页展开历史重置明细。
- `LimitWindow.usedPercent / remainingPercent` 是页面显示字段，必须优先使用当前额度周期的累计已用百分比和余量百分比；最近一次原始 `rate_limits.used_percent` 只作为缺少周期证据时的降级来源。原因是最近一次百分比可能在同周期内回落到低水位，不能代表本周期已消耗额度。
- `LimitWindow.estimatedFullValueUsd / estimatedRemainingValueUsd` 是套餐价值折算字段，也必须使用当前额度周期的累计已用百分比作为分母，优先取 `PeriodMetric.quotaEvidence.usedPercent`，不能使用最近一次原始 `rate_limits.used_percent`。
- 为了支持前几周计费周对比，Codex session 采集窗口至少覆盖最近 `60` 天；该口径对齐 `dev-ledger` 已验证的周周期历史记录，避免只扫描当前月/周导致上一计费周样本缺失。

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

## 3. 状态字段

- `已观测`：最近窗口内有有效 `rate_limits` 和 token 事件
- `待刷新`：发现会话文件，但最近窗口未命中有效额度样本
- `未观测`：根本没有相关额度字段或没有可解析会话
- `数据过期`：最新观测时间距离当前超过 45 分钟

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
- 当前周期起止必须由 `resetsAt - windowMinutes` 推导。
- 当前周期必须包含 `quotaEvidence` 观测证据。
- `estimatedValueBasisUsedPercent` 必须使用周期累计 `quotaEvidence.usedPercent`，不得回退到最近一次原始 `usedPercent`。
- `estimatedFullValueUsd` 必须按 `estimatedSpentUsd / 周期累计已用百分比` 计算。

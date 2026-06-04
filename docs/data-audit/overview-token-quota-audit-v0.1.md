# 总览页 Token / 额度数据审计（v0.1）

- 创建时间：2026-06-04
- 审计基线：`v0.2.2-dev.37`
- 参考项目：`D:\MyFile\Obisidian\LifeInHand\1. 项目\个人品牌-学习进步\CodeLib\MyCode\dev-ledger`
- 审计范围：总览页顶部自然时间 Token、5H / 周额度卡 Token、额度余量与周期边界
- 隐私边界：只读取 `token_count` 数值字段和时间戳，不输出原始会话正文、用户输入、模型回复或本地路径明细

## 1. 审计问题

真实快照中，顶部 `今日 Token` 明显大于 `5H 额度窗口` 中的 Token：

- `今日 Token`：自然日 0 点以来的 Token 增量
- `5H 额度窗口 Token`：当前 Codex `rate_limits.primary` 窗口内的 Token 增量

这个差异可能有两种原因：

- 合理原因：自然日与当前 5H 窗口不是同一个周期，5H 窗口刚开始时自然日累计会显著更大。
- 错误原因：首个 `total_token_usage` 累计快照被当作当前周期增量，导致自然日 Token 虚高。

本轮审计重点验证第二种风险是否存在。

## 2. 当前实现口径

`src/main/collectors/codexCollector.ts` 当前逻辑：

- 遍历完整 session 文件。
- 对同一 session 内连续 `total_token_usage` 做差值。
- 只有当前记录没有 `total_token_usage` 时，才降级使用 `last_token_usage`。
- 差值小于等于 0 的记录跳过。
- 仪表盘再按事件时间落入自然日、自然周、自然月或额度周期。

这与 `dev-ledger` 的 `analyzeSessionSnapshots()` 思路一致：先得到连续快照增量，再按周期聚合。

## 3. 审计方法

本轮用只读 Node 聚合脚本复核两种方法：

- 错误方法：只在“今日”窗口内维护前序快照，会把今日第一条累计快照误算为今日增量。
- 正确方法：先按完整 session 文件维护前序快照，再把差值事件按今日窗口过滤。

只记录聚合摘要：

- 扫描 JSONL 文件数
- 今日有效增量事件数
- 今日首个被计入增量的累计快照数
- 今日 Token 总量
- 首个累计快照贡献占比
- 最大单次增量事件

## 4. 审计结果

错误方法会显示首个累计快照贡献异常高：

- 首快照贡献约 `5824 万 Token`
- 首快照贡献占比约 `44.52%`

但这是审计脚本方法错误，不是当前应用实现。

按完整 session 连续差值后，结果为：

- 扫描 JSONL 文件数：`353`
- 今日有效增量事件数：`459`
- 今日首个被计入增量的累计快照数：`0`
- 首个累计快照贡献：`0`
- 首个累计快照占比：`0%`
- 最大单次增量约 `24.3 万 Token`

结论：当前应用没有把今日首个 `total_token_usage` 累计快照直接计为自然日增量。

## 5. 额度差异解释

当前快照示例：

- `todayTokens`：约 `6953 万`
- `fiveHourTokens`：约 `22 万`
- `fiveHour.startAt/endAt`：`2026-06-03T19:34:15Z` 到 `2026-06-04T00:34:15Z`
- `weekLimit.startAt/endAt`：`2026-06-02T13:18:53Z` 到 `2026-06-09T13:18:53Z`

差异解释：

- `todayTokens` 是本地自然日累计。
- `fiveHourTokens` 是当前 5H 额度窗口累计。
- 当 5H 窗口刚开始时，`fiveHourTokens` 显著小于 `todayTokens` 是合理结果。
- `v0.2.2-dev.23` 已在额度卡展示周期起止，降低误读风险。

## 6. 当前结论

当前总览页额度数据仍按真实 Codex `rate_limits` 与本地 session 增量聚合：

- 额度余量来自最近一次 `rate_limits.primary / secondary.used_percent`。
- 额度周期边界来自 `resets_at` 和 `window_minutes`。
- 额度卡右侧 Token / 成本 / 会话来自当前额度周期内的连续快照增量。
- 顶部四卡来自自然时间周期内的连续快照增量。

`v0.2.2-dev.23` 审计未发现“首个累计快照误计入今日增量”的证据。

## 7. `v0.2.2-dev.31` 价值折算口径复查

继续对照 `dev-ledger` 后，发现当前应用在 `v0.2.2-dev.30` 快照中存在一个隐藏数据口径问题：

- 周额度最近一次原始 `rate_limits.secondary.used_percent`：`1%`
- 当前周额度周期 `quotaEvidence.usedPercent`：`28%`
- 周额度周期 API 等价成本：约 `$897.86`
- 旧的 `LimitWindow.estimatedFullValueUsd` 使用最近一次 `1%` 作为分母，得到约 `$89786.35`
- 按 `dev-ledger` 的套餐价值折算口径，应使用周期累计 `28%` 作为分母，结果约为 `$3206.65`

原因说明：

- 最近一次 `used_percent` 适合表达圆环中心的“最近额度余量”。
- 周期累计 `usedPercent` 适合表达“当前额度周期已经消耗了多少额度”。
- 价值折算回答的是“本周期这些 token / 成本对应多少额度占比”，因此必须使用周期累计百分比，不应使用最近一次百分比。

本轮修正要求：

- `LimitWindow.estimatedFullValueUsd / estimatedRemainingValueUsd` 改为优先使用 `PeriodMetric.quotaEvidence.usedPercent`。
- `PeriodMetric.quotaEvidence` 补充 `resetEvents / usageSegments`，与 `dev-ledger` 的可追溯口径保持一致。
- 总览页可见 UI 暂不增加复杂字段，仍保持圆环显示最近余量、右侧显示周期累计 Token / 成本 / 代码 / 会话。

`v0.2.2-dev.31` 运行态验证结果：

- 周额度圆环仍按最近一次原始观测显示：`usedPercent=1%`、`remainingPercent=99%`
- 周额度价值折算分母改为周期累计：`estimatedValueBasisUsedPercent=28%`
- 周额度周期 API 等价成本：约 `$926.83`
- 修正后的满额估值：约 `$3310.09`
- 周期证据已输出 `usageSegments`，当前周期 `resetEvents=[]`、`observations=1320`

## 8. 后续建议

- 若后续继续增强可信度，可以在快照中增加内部诊断字段，例如 `tokenIncrementEvents`、`largestTokenIncrement` 和 `periodWindowLabel`，但总览页默认不展开。
- 若用户希望进一步核对数值，可增加一个本地只读诊断命令，输出聚合摘要，不输出原始会话内容。

## 9. `v0.2.2-dev.37` 可执行额度快照校验

为避免后续只能人工查看 `snapshot.json` 判断额度数据是否真实，本轮新增只读校验命令：

```bash
npm run verify:quota
```

校验对象：

- 默认运行态快照：`C:\Users\85406\AppData\Roaming\codex-companion\snapshot.json`
- 可通过 `CODEX_COMPANION_SNAPSHOT_PATH` 或 `npm run verify:quota -- --snapshot <path>` 指定其他快照

校验内容：

- `5H` 与 `周额度` 分别绑定 `primary / secondary`。
- `windowMinutes` 分别为 `300 / 10080`。
- 圆环余量优先等于当前周期 `quotaEvidence.remainingPercent`；缺少周期证据时才降级为 `100 - 最近 usedPercent`。
- 周期起止来自 `resetsAt - windowMinutes`，而不是自然时间硬编码。
- 当前周期包含 `quotaEvidence.observations / resetCount / resetEvents / usageSegments`。
- 价值折算分母使用 `quotaEvidence.usedPercent`，防止再次回退到最近一次 `rate_limits.used_percent`。

本命令只读取聚合快照，不读取或输出原始会话正文、用户输入、模型回复或本地路径明细。

`v0.2.2-dev.37` 当时本机运行结果：

- `5H 额度`：最近余量 `100%`，周期累计 `0%`，Token `109,547`，观测 `2` 次，重置 `0` 次。
- `周额度`：最近余量 `99%`，最近已用 `1%`，周期累计 `28%`，Token `219,799,653`，观测 `1494` 次，重置 `0` 次。
- 周额度满额估值使用周期累计 `28%` 作为分母，校验结果约 `$3879.63`。

## 10. `v0.2.2-dev.53` 圆环剩余量口径修正

继续对照 `dev-ledger` 和当前运行态后，确认 `v0.2.2-dev.52` 仍存在一个可见误导：

- 周额度最近一次原始 `rate_limits.secondary.used_percent` 可能回落到 `0%`。
- 但同一周额度周期的 `quotaEvidence.usedPercent` 已累计到 `6%`。
- 页面圆环如果继续显示最近原始余量，会显示 `100%`，与当前周已消耗 `6%` 的事实冲突。

`dev-ledger/public/dashboard-data.local.json` 当前已有前几周计费周记录，可用于校验口径：

- `2026-05-21T01:02:50Z - 2026-05-28T01:02:50Z`：周期累计 `119%`，重置 `2` 次，余量 `0%`。
- `2026-05-28T01:02:50Z - 2026-06-04T01:02:50Z`：周期累计 `117%`，重置 `1` 次，余量 `0%`。
- `2026-06-04T01:02:50Z - 2026-06-11T01:02:50Z`：周期累计 `6%`，余量 `94%`。

本轮修正要求：

- `LimitWindow.usedPercent / remainingPercent` 从最近原始观测改为页面显示口径，优先使用当前周期 `quotaEvidence.usedPercent / remainingPercent`。
- 最近原始 `rate_limits.used_percent` 只作为缺少周期证据时的降级来源。
- `verify:quota` 不再断言圆环等于 `100 - 最近 usedPercent`，改为断言圆环等于 `quotaEvidence.remainingPercent`。
- Codex session 采集窗口扩展到近 `60` 天，保证上几周计费周期可从原始 session 重建；不硬编码依赖 `dev-ledger` 的本地生成文件路径。
- 总览页圆环内文案调整为 `剩余量` 在上、百分比在圆心。

`v0.2.2-dev.53` 本机 `npm run verify:quota` 结果：

- `5H 额度`：周期余量 `100%`，显示已用 `0%`，周期累计 `0%`，Token `103,225`，观测 `2` 次，重置 `0` 次。
- `周额度`：周期余量 `91%`，显示已用 `9%`，周期累计 `9%`，Token `88,675,900`，观测 `604` 次，重置 `0` 次，满额估值约 `$5415.50`。

隐私边界不变：本轮只使用聚合字段与 `dev-ledger` 已生成的周期摘要核对，不输出原始会话正文、用户输入或模型回复。

## 11. `v0.2.2-dev.54` 主额度池与昨日代码分母修正

继续核对当前本机原始 `rate_limits` 后，确认 `v0.2.2-dev.53` 仍会被更新时间更新的模型额度池误导：

- 模型池 `limit_id=codex_bengalfox` / `limit_name=GPT-5.3-Codex-Spark` 最近观测中 `primary.used_percent=0`，会让 5H 显示 `100%` 剩余。
- 主额度池 `limit_id=codex` 最近观测中 `primary.used_percent=17`，`primary.resets_at=2026-06-04T13:07:05.000Z`，真实 5H 剩余应约为 `83%`。
- 同一个主额度池中 `secondary.used_percent=11`，`secondary.resets_at=2026-06-11T02:59:29.000Z`，周额度显示也应跟随同一池。

本轮修正要求：

- `LatestRateSnapshot` 保留 `limitId / limitName`。
- 选择最新可见额度时优先 `limitId=codex`，没有主池时才降级到可解析的最新额度池。
- 构建 `quotaEvidence` 时过滤不同额度池的观测样本，避免模型池低水位混入主额度周期。

同时核对 `dev-ledger` 与本机 Git 聚合，确认顶部 `今日代码改动` 的昨日分母已有数据：

- 今日代码改动：`7383` 行。
- 昨日代码改动：`5219` 行。
- 因此 `较昨日` 应显示约 `+41.5%`，不应显示 `新增` 或 `数据待补齐`。

隐私边界不变：本轮只记录聚合后的额度百分比、窗口时间和 Git 行数，不输出原始会话正文、用户输入、模型回复或文件 diff 内容。

## 12. `v0.2.2-dev.61` 计费月 Token 默认起始日确认

继续核对本机 `.codex` 原始 `rate_limits` 后，当前仍只能稳定观测到两类额度窗口：

- `primary.window_minutes=300`：5 小时窗口。
- `secondary.window_minutes=10080`：周额度窗口。

原始记录中没有 `month / monthly / billing / cycle / period` 等月级额度字段；`credits` 也只包含 `has_credits / unlimited / balance`，没有月开始、月结束或续期时间。因此月额度仍不能从 Codex 原始数据推断。

但用户已从套餐信息确认：当前计费月从每月 `1` 日开始。基于这个用户确认的套餐口径，本轮将 **计费月 Token** 默认起始日设置为每月 `1` 日 `00:00`：

- 当前默认计费月 Token 与自然月 Token 一致。
- 该口径只用于 Token / 成本 / 会话等时间窗口聚合。
- 该口径不改变 `可观测月额度`：月额度仍必须等待 Codex 原始 `rate_limits` 暴露月级窗口。
- 后续设置页可暴露 `billingMonthStartDay`，允许用户选择每月第几天作为计费月起始日。

隐私边界不变：本轮只使用聚合字段和用户确认的套餐起始日，不读取云端账单，不输出原始会话正文。

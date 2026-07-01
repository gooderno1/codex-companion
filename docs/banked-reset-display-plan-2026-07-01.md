# Codex banked reset 展示方案草案

本文档只规划 `codex-companion` 如何展示 `codex-usage-core v0.1.0-dev.4` 新增的 banked reset credit 字段。本轮只升级依赖和写方案，不修改 UI 组件。

## 数据来源

- 核心包：`@lifeinhand/codex-usage-core@v0.1.0-dev.4`
- 只读方法：`readCodexAccountRateLimits()`
- Codex 本地接口：`account/rateLimits/read`
- 主字段：`rateLimitResetCredits.availableCount`
- 辅助字段：`rateLimits`、`rateLimitsByLimitId`
- 事件推断：`analyzeBankedResetCreditObservations()`

该读取不会调用 `account/rateLimitResetCredit/consume`，不会消耗用户可用的 banked reset credit。

## 建议快照字段

建议后续在 `DashboardSnapshot` 增加独立字段，不混入现有 `quotaEvidence.resetCount`：

```ts
interface DashboardSnapshot {
  codex?: {
    bankedResetCredits?: {
      observedAt: string;
      availableCount: number;
      inferredGrantCount: number;
      inferredUseCount: number;
      inferredExpirationCount: number;
      inferredUnknownDecreaseCount: number;
      nextEstimatedExpiresAt: string | null;
      events: Array<{
        kind: "grant" | "use" | "expiration" | "decrease-unknown";
        at: string;
        count: number;
        estimatedExpiresAt?: string | null;
        affectedLimitIds: string[];
      }>;
    };
  };
}
```

## 总览页展示建议

- 展示位置：周额度卡或 5H/周额度卡之间的轻量状态行，不替换现有额度圆环。
- 主文案：`可用赠送重置 2 次`
- 次文案：
  - 有估算过期：`预计最早 7月31日 过期`
  - 无估算过期：`过期时间待后续采样确认`
- Tooltip 说明：`来自 Codex 本地 account/rateLimits/read；过期时间按获得观测时间 +30 天估算。`

不建议在顶部四卡新增主卡片，原因是 `availableCount` 是库存状态，不是 token 消耗、成本或代码活动指标。

## 账本页展示建议

- 展示位置：`周额度账本` 表格上方新增一行摘要，或在每个周周期行的状态列旁增加 badge。
- 摘要文案：
  - `赠送重置：可用 2 次 · 已推断使用 1 次 · 过期候选 0 次`
- 周期行 badge：
  - `获得 +1`
  - `使用 -1`
  - `可能过期 -1`
  - `减少待判定 -1`

`use` 事件只有在 `availableCount` 减少且同一采样区间内观察到 5H 或周额度窗口 reset 时展示为“使用”。否则必须展示为“可能过期”或“减少待判定”。

## 不展示或弱化的信息

- 不展示账号 ID、邮箱、原始 app-server 响应、余额字段。
- 不把 `estimatedExpiresAt` 写成“官方过期时间”。
- 不把 banked reset credit 称为现金充值、API credit 或账单余额。
- 不把普通 `quotaEvidence.resetCount` 改名为赠送重置次数。

## 待确认

- 总览页是否接受“可用赠送重置 N 次”作为周额度卡辅助状态。
- 账本页是否需要显示每次推断事件，还是只显示累计摘要。
- `decrease-unknown` 是否对普通用户显示，或仅在调试/详情中显示。

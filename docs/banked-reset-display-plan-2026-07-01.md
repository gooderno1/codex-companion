# Codex banked reset 展示实施方案

本文档记录 `codex-companion v0.3.6` 对 `codex-usage-core v0.1.0-dev.8` banked reset credit 字段的实际接入方式。

## 数据来源

- 核心包：`@lifeinhand/codex-usage-core@v0.1.0-dev.8`
- 只读方法：`readCodexAccountRateLimits()`
- Codex 本地接口：`account/rateLimits/read`
- 主字段：`rateLimitResetCredits.availableCount`
- 事件推断：`analyzeBankedResetCreditObservations()`
- 逐个明细：`BankedResetCreditAnalysisResult.activeCredits[]`

该读取不会调用 `account/rateLimitResetCredit/consume`，不会消耗用户可用的 banked reset credit。

## 快照字段

`DashboardSnapshot.overview.bankedResetCredits` 为独立字段，不混入 `quotaEvidence.resetCount`：

```ts
interface BankedResetCreditsSummary {
  sourceStatus: "observed" | "pending" | "unobserved" | "stale";
  observedAt: string | null;
  availableCount: number | null;
  nextEstimatedExpiresAt: string | null;
  nextSafeEstimatedExpiresAt: string | null;
  activeCredits: Array<{
    id: string;
    acquiredAt: string | null;
    firstObservedAt: string;
    estimatedExpiresAt: string | null;
    safeEstimatedExpiresAt: string | null;
    estimateBasis: "observed-grant" | "public-grant" | "assumed-grant" | "existing-at-first-observation";
  }>;
  events: Array<{ kind: "grant" | "use" | "expiration" | "decrease-unknown"; at: string; count: number }>;
  observations: BankedResetCreditObservation[];
}
```

`observations[]` 只保存继续推断所需的脱敏字段，不保存账号、邮箱、余额或原始 app-server 响应。

## 总览页展示

- 展示位置：顶部四张指标卡下方、`5H 额度窗口 / 周额度窗口` 两张圆环卡上方。
- 普通态：一行状态，例如 `赠送重置可用 2 次 · 最早预计过期 07/31 18:00；建议 07/30 18:00 前使用`。
- 交互：点击整行展开。
- 展开态：逐个显示每次可用 credit：
  - 编号：`赠送重置 #1`
- 获取时间：`acquiredAt`；如果是 `public-grant`，显示为公开发放估算；如果是 `assumed-grant`，显示为按确认口径假定；如果是首次观测前已有且未匹配 seed，则显示 `早于 firstObservedAt`
  - 主标题：明确显示 `预计过期 estimatedExpiresAt`
  - 建议使用时间：明确显示 `safeEstimatedExpiresAt` 前使用

用户可见文案必须区分 `estimatedExpiresAt` 和 `safeEstimatedExpiresAt`：前者写作“预计过期”，后者写作“建议使用时间”或“建议 ... 前使用”。`safeEstimatedExpiresAt` 默认比 `estimatedExpiresAt` 早 `1` 天，用于提前提醒和保守使用建议。核心包默认保留但不自动匹配 `2026-06-11` Codex banking 上线 free reset，因为用户已确认该次很可能已经使用；桌面端不再显式打开该 seed。当前口径为：第一条首次未知 credit 按 `2026-06-14T00:00:00.000Z` 假定为 `assumed-grant`，`2026-06-30` 异常消耗修复补偿 reset 展示为 `public-grant`，本项目此前观测到的 `2026-07-01T19:58:24.705Z` 新增展示为 `observed-grant`。采集器会把上一轮 `activeCredits[]` 作为核心包 `activeCreditBaseline` 传入，避免滚动历史裁剪后丢失已识别出的观测新增。

## 边界

- 不把 banked reset credit 称为现金充值、API credit 或账单余额。
- 不把普通 `quotaEvidence.resetCount` 改名为赠送重置次数。
- 不展示账号 ID、邮箱、原始 app-server 响应、余额字段或 token。
- `estimatedExpiresAt` 和 `safeEstimatedExpiresAt` 都是本地估算，不是 Codex app-server 原始字段。

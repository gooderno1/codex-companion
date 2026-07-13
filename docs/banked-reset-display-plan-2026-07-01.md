# Codex banked reset 展示实施方案

本文档记录 `codex-companion v0.3.8` 对 `codex-usage-core v0.1.0-dev.10` banked reset credit 字段的实际接入方式。

## 数据来源

- 核心包：`@lifeinhand/codex-usage-core@v0.1.0-dev.10`
- 只读方法：`readCodexAccountRateLimits()`
- Codex 本地接口：`account/rateLimits/read`
- 主字段：`rateLimitResetCredits.availableCount / credits[]`
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
  nextExpiresAt: string | null;
  nextExpiryBasis: "official" | "estimated" | null;
  officialDetailCount: number;
  officialDetailsComplete: boolean;
  nextEstimatedExpiresAt: string | null;
  nextSafeEstimatedExpiresAt: string | null;
  activeCredits: Array<{
    id: string;
    acquiredAt: string | null;
    firstObservedAt: string;
    expiresAt: string | null;
    expiryBasis: "official" | "estimated" | "unknown";
    estimatedExpiresAt: string | null;
    safeEstimatedExpiresAt: string | null;
    estimateBasis: "official-detail" | "observed-grant" | "public-grant" | "assumed-grant" | "existing-at-first-observation";
  }>;
  events: Array<{ kind: "grant" | "use" | "expiration" | "decrease-unknown"; at: string; count: number }>;
  observations: BankedResetCreditObservation[];
}
```

`observations[]` 只保存继续推断所需的脱敏字段，不保存账号、邮箱、余额或原始 app-server 响应。

## 总览页展示

- 展示位置：顶部四张指标卡下方、`5H 额度窗口 / 周额度窗口` 两张圆环卡上方。
- 普通态：官方明细可用时显示 `赠送重置可用 2 次 · 最早官方到期 07/31 18:00`；缺少官方明细时继续显示预计过期和建议使用时间。
- 交互：点击整行展开。
- 展开态：逐个显示每次可用 credit：
  - 编号：`赠送重置 #1`
- 获取时间：`acquiredAt`；`official-detail` 标记为 Codex 官方，`public-grant` 显示为公开发放估算，`assumed-grant` 显示为按确认口径假定；首次观测前已有且未匹配 seed 显示 `早于 firstObservedAt`
  - 主标题：官方明细显示 `官方到期 expiresAt`；回退明细显示 `预计过期 estimatedExpiresAt`
  - 建议使用时间：明确显示 `safeEstimatedExpiresAt` 前使用

官方逐笔明细优先于估算。只有 `expiryBasis=estimated` 时才展示 `estimatedExpiresAt` 和默认提前 `1` 天的 `safeEstimatedExpiresAt`；`expiryBasis=official` 直接展示 `expiresAt`。官方明细可能被截断，因此 `availableCount` 始终是权威总数，`officialDetailsComplete=false` 时未覆盖库存继续保留估算或未知状态。核心包默认保留但不自动匹配 `2026-06-11` free reset；旧 baseline 会自动迁移，无需清空本地历史。

## 边界

- 不把 banked reset credit 称为现金充值、API credit 或账单余额。
- 不把普通 `quotaEvidence.resetCount` 改名为赠送重置次数。
- 不展示账号 ID、邮箱、原始 app-server 响应、余额字段或 token。
- `expiresAt` 在 `expiryBasis=official` 时来自 Codex app-server；`estimatedExpiresAt / safeEstimatedExpiresAt` 仅用于官方明细缺失时的本地回退。

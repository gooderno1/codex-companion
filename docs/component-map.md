# 组件映射表

- 创建时间：2026-06-03
- 当前适用版本：`v0.2.2-dev.15`
- 当前覆盖页面：总览页

## 总览页

| 设计区块 | 代码组件 / 位置 | 复用性 | 关键 props / 状态 | 数据来源 |
| --- | --- | --- | --- | --- |
| 左侧导航 | `src/renderer/App.tsx` `sidebar-shell` | 全局复用 | `currentPage` | 本地路由 hash |
| 顶部工具栏 | `src/renderer/App.tsx` `topbar` | 全局复用 | `currentPage`、`overviewMode`、`sourceStatus`、`generatedAt` | `snapshot.sourceHealth`、`snapshot.generatedAt` |
| 时间视角切换 | `TextTabs` | 可复用 | `natural / billing` | 本地页面状态 |
| 顶部四卡 | `MetricCard` | 可复用 | `label`、`value`、`detail`、`icon`、`tone`、`sourceStatus` | `snapshot.overview`、`snapshot.overview.previous`、`snapshot.sourceHealth` |
| 5H 额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models` | 圆环：`snapshot.overview.limitWindows[0]`；右侧：`windowPeriods.fiveHour`、`modelWindows.fiveHour` |
| 周额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models` | 圆环：`snapshot.overview.limitWindows[1]`；右侧：`windowPeriods.weekLimit`、`modelWindows.weekLimit` |
| 项目概览 | `OverviewPage` `project-card` | 页面级 | `mode`、二级周期、排序 | `snapshot.overview.projectOverview` |
| 项目排序标签 | `TextTabs` `variant=chip` | 可复用 | `token / cost / code / recent` | 本地页面状态 |
| 数据状态标签 | `status-pill` | 全局复用 | `observed / pending / unobserved / stale` | `snapshot.sourceHealth.sourceStatus` |
| 页脚数据来源 | `footer-note` | 全局复用 | `sessionFilesScanned`、`archivedFilesScanned`、`repoCount` | `snapshot.sourceHealth`、`snapshot.pricingMeta` |

## 当前约束

- `自然时间 / 计费时间` 只改变总览页统计口径，不改变壳层和顶部四卡字段。
- `5H / 周额度窗口` 统一复用 `QuotaWindowCard`，不额外派生其他布局。
- `QuotaWindowCard` 标题只显示一次，不额外显示 `额度窗口` 辅助行。
- `QuotaWindowCard` 圆环显示最近 `rate_limits` 剩余量，右侧数据使用当前额度周期内真实 token 增量。
- `QuotaWindowCard` 右侧明细行必须带小图标。
- 顶部 `时间视角` 与 `自然时间 / 计费时间` 使用同一行文本切换。
- 顶部工具栏不显示 `桌面总控台` 等额外眉标，页面标题与副标题横向组成同一信息组。
- 顶部四卡必须显示自定义指标图标，图标在左、内容在右、状态在底部，不使用官方 OpenAI / Codex 视觉资产。
- 顶部四卡高度应接近设计稿比例，不得压缩到状态标签和主数字过近。
- 右侧主工作区外层保持轻描边与浅底，不使用强浮层阴影；卡片渐变和阴影必须弱于当前分区卡片内容层。
- 项目概览主标题直接使用 `项目概览`，不再使用“项目消耗”作为主标题。
- 页脚必须展示本地数据来源与 `session / archived / 仓库` 统计 chip。
- 当前 `设置` 仅作为壳层保留入口，正式设置页待后续单独设计。
- 挂件入口不再放在主页面工具栏，保持默认关闭策略。
- 页面提交前必须用真实 Electron 窗口截图验证 `1360 x 900` 和 `1080 x 720`，截图通过后再进入 Git 提交。

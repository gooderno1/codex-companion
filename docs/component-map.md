# 组件映射表

- 创建时间：2026-06-03
- 当前适用版本：`v0.2.2-dev.50`
- 当前覆盖页面：总览页

## 总览页

| 设计区块 | 代码组件 / 位置 | 复用性 | 关键 props / 状态 | 数据来源 |
| --- | --- | --- | --- | --- |
| 左侧导航 | `src/renderer/App.tsx` `sidebar-shell` | 全局复用 | `currentPage` | 本地路由 hash |
| 顶部工具栏 | `src/renderer/App.tsx` `topbar` | 全局复用 | `currentPage`、`overviewMode`、`sourceStatus`、`generatedAt` | `snapshot.sourceHealth`、`snapshot.generatedAt` |
| 时间视角切换 | `TextTabs` | 可复用 | `natural / billing` | 本地页面状态 |
| 顶部四卡 | `MetricCard` | 可复用 | `label`、`value`、`detail`、`icon`、`tone`、逐卡 `sourceStatus` | `snapshot.overview`、`snapshot.overview.previous`、`snapshot.sourceHealth` |
| 5H 额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models`、`period.quotaEvidence` | 圆环：`snapshot.overview.limitWindows[0]`；右侧：`windowPeriods.fiveHour`、`modelWindows.fiveHour` |
| 周额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models`、`period.quotaEvidence` | 圆环：`snapshot.overview.limitWindows[1]`；右侧：`windowPeriods.weekLimit`、`modelWindows.weekLimit` |
| 项目概览 | `OverviewPage` `project-card` | 页面级 | `mode`、二级周期、排序 | `snapshot.overview.projectOverview` |
| 项目排序标签 | `TextTabs` `variant=chip` | 可复用 | `token / cost / code / recent` | 本地页面状态 |
| 数据状态标签 | `status-pill` | 全局复用 | `observed / pending / unobserved / stale` | `snapshot.sourceHealth.sourceStatus` |
| 页脚数据来源 | `FooterNote` / `footer-note` | 全局复用 | `sessionFilesScanned`、`archivedFilesScanned`、`repoCount` | `snapshot.sourceHealth`、`snapshot.pricingMeta` |

## 当前约束

- `自然时间 / 计费时间` 只改变总览页统计口径，不改变壳层和顶部四卡字段。
- 左侧品牌图标使用 `BrandMark` 内联 SVG，必须保持非官方自定义资产，不使用 OpenAI / Codex 官方 logo。
- 左侧导航图标使用 `Glyph` 内联 SVG：总览为首页图标，账本为文档账本图标，代码仓库为代码方块图标，设置为齿轮图标；图标本身不使用额外白色胶囊背景。
- 左侧导航项遵循设计稿的单行结构，只显示图标和主标签；`总览 / Codex 账本 / 代码仓库 / 设置` 不在导航行内显示二级说明文案。
- `5H / 周额度窗口` 统一复用 `QuotaWindowCard`，不额外派生其他布局。
- `QuotaWindowCard` 标题只显示一次，不额外显示 `额度窗口` 辅助行。
- `QuotaWindowCard` 圆环显示最近 `rate_limits` 剩余量，右侧数据使用当前额度周期内真实 token 增量。
- `QuotaWindowCard` 圆环弧线和中心数字都使用剩余百分比，不允许弧线使用已用百分比。
- `QuotaWindowCard` 圆环下方必须展示当前额度周期起止，使用 `period.startAt / period.endAt`，不额外读取原始日志；周期起止必须与重置时间合并为一行，不再单独占用一行；同日短周期显示时间范围，多日周期显示日期范围，避免周额度显示成 `09:02 - 09:02`。
- `QuotaWindowCard` 底部展示当前额度周期 `rate_limits` 观测次数和重置次数，作为真实额度数据的可见证据；可见文案统一为 `观测 N 次 · 重置 N 次`，不额外重复 `额度观测`。
- `QuotaWindowCard` 底部口径说明必须短句化，不在总览页展开原始字段名和计算公式；当前固定为 `圆环=最近余量；右侧=当前周期累计。`，不重复 `5H`、`周额度` 或 `额度窗口` 字样。
- `QuotaWindowCard` 底部口径说明与观测证据应尽量保持同一视觉行，避免额外挤占额度卡高度。
- `QuotaWindowCard` 右侧明细行必须带小图标。
- 顶部 `时间视角` 与 `自然时间 / 计费时间` 使用同一行文本切换。
- 顶部时间视角切换内部不允许换行；较窄窗口优先压缩标题、副标题或右侧操作间距，不能把时间视角整体拆到第二行。
- 顶部时间视角属于中部页面控制区，不能被 `space-between` 推到右侧操作区旁边；右侧状态、刷新和快照由 `topbar-actions` 自动贴右。
- 页面级截图支持通过 hash 查询参数设置初始 `overviewMode`，用于生成自然时间和计费时间两种真实 Electron 截图；普通用户默认仍进入自然时间。
- 顶部工具栏状态胶囊只显示状态文字，不额外显示状态图标；额度卡和指标卡内状态标签也保持文字-only。
- 顶部工具栏不显示 `桌面总控台` 等额外眉标，页面标题与副标题横向组成同一信息组。
- 左侧品牌区必须保持产品图标和 `Codex Companion` 标题顶线对齐，说明文字放在标题下方，图标与标题间距接近设计稿；文字组允许少量基线补偿，避免标题高于图标造成错位。
- 顶部四卡必须显示自定义指标图标，图标在左、内容在右、状态在底部，不使用官方 OpenAI / Codex 视觉资产。
- 顶部四卡状态必须由单张卡片的数据可观测性决定；计费月未观测时，`本月 Token` 卡片必须显示 `未观测` 状态，不能沿用全局 `已观测`。
- 顶部四卡高度应接近设计稿比例，`MetricCard` 使用内容区和底部状态区两行布局，不得压缩到状态标签和主数字过近。
- 顶部四卡内部微调只允许改变图标尺寸、标题权重和主数字视觉权重，不改变四卡字段、单位和统计口径。
- 右侧主工作区外层保持轻描边与浅底，不使用强浮层阴影；卡片渐变和阴影必须弱于当前分区卡片内容层。
- 颜色使用组件级 token：主标题和主数字为 `#101828` 级深墨色，普通正文为 `#344054` 级蓝灰色，副标题 / 表头 / 页脚为 `#667085` 级辅助蓝灰色，证据和定价来源为 `#8a97a8` 级弱辅助色；不能把所有文字统一压成主标题色。
- 设计 token 的唯一运行入口为 `src/renderer/design-tokens.ts`，正式说明见 `docs/design-tokens-v0.1.md`；提交前执行 `npm run verify:design`，防止 CSS 引用未定义 token 或关键色阶漂移。
- 项目表表头不强制全大写，保持与设计稿一致的正常标题大小写。
- 项目概览主标题直接使用 `项目概览`，不再使用“项目消耗”作为主标题。
- 项目概览二级周期切换必须放在 `项目概览` 标题右侧；排序切换独立靠右，不能和周期切换堆叠在同一右侧工具区。
- 项目概览自然时间默认选中 `周`，计费时间默认选中 `周额度`；用户在当前页面会话内切换周期后，保持用户选择。
- 项目概览必须保留所有已发现本地项目，当前周期无活动项目显示 0 / `--`，不能因为无活动而从表格中消失。
- 项目表 `项目` 列必须显示项目小图标和项目名，小图标由项目名稳定映射颜色，只作为扫读锚点，不表示官方身份。
- 项目概览表格需要保留轻量横向和纵向网格线；纵向线只用于增强列扫读，不应变成强边框。
- 总览页的页脚数据来源必须归入项目概览卡底部，视觉上属于同一张底部表格卡；账本页和仓库页可继续在页面底部复用同一 `FooterNote`。
- 页脚必须展示本地数据来源与 `session / archived / 仓库` 统计 chip。
- 当前 `设置` 仅作为壳层保留入口，正式设置页待后续单独设计。
- 挂件入口不再放在主页面工具栏，保持默认关闭策略。
- 页面提交前必须用真实 Electron 窗口截图验证 `1360 x 900` 和 `1080 x 720`，截图通过后再进入 Git 提交。

# 组件映射表

- 创建时间：2026-06-03
- 当前适用版本：`v0.3.4`
- 当前覆盖页面：总览页、Codex 账本页、代码仓库页、设置页

## 总览页

| 设计区块 | 代码组件 / 位置 | 复用性 | 关键 props / 状态 | 数据来源 |
| --- | --- | --- | --- | --- |
| 左侧导航 | `src/renderer/App.tsx` `sidebar-shell` | 全局复用 | `currentPage` | 本地路由 hash |
| 顶部工具栏 | `src/renderer/App.tsx` `topbar` | 全局复用 | `currentPage`、`overviewMode`、`sourceStatus`、`generatedAt` | `snapshot.sourceHealth`、`snapshot.generatedAt` |
| 时间视角切换 | `TextTabs` | 可复用 | `natural / billing` | 本地页面状态 |
| 顶部四卡 | `MetricCard` | 可复用 | `label`、`value`、`detail`、`icon`、`tone`、逐卡 `sourceStatus` | `snapshot.overview`、`snapshot.overview.previous`、`snapshot.sourceHealth` |
| 赠送重置状态行 | `BankedResetCreditStrip` | 总览页模块 | `availableCount`、`activeCredits[]`、`sourceStatus`、展开态原生 `details` | `snapshot.overview.bankedResetCredits`；普通态显示可用次数和最早保守过期提醒，展开后显示每个 credit 的获取时间、预计过期时间和保守提醒时间 |
| 5H 额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models`、`period.quotaEvidence` | 圆环：`windowPeriods.fiveHour.quotaEvidence.remainingPercent` 优先，降级到 `limitWindows[0]`；右侧：`windowPeriods.fiveHour`、`modelWindows.fiveHour` |
| 周额度卡 | `QuotaWindowCard` | 可复用 | `windowData`、`period`、`models`、`period.quotaEvidence` | 圆环：`windowPeriods.weekLimit.quotaEvidence.remainingPercent` 优先，降级到 `limitWindows[1]`；周期边界：`windowPeriods.weekLimit.startAt / endAt`，`limitWindows[1].resetsAt` 必须等于当前周期 `endAt`；reset 检测来自远程 Git 依赖 `@lifeinhand/codex-usage-core@0.1.0-dev.7`，`resetEvents[].evidence.evidenceTypes` 支持 `stabilized-boundary-drop`，`usageSegments[]` 记录窗口起点、过期时间和 reset 前后使用区间；右侧：`windowPeriods.weekLimit`、`modelWindows.weekLimit` |
| 项目概览 | `OverviewPage` `project-card` | 页面级 | `mode`、二级周期、表头排序 | `snapshot.overview.projectOverview` |
| 项目表头排序 | `ProjectSortHeader` | 页面级 | `name / token / cost / code / commits / sessions / recent`、`asc / desc` | 本地页面状态 |
| 数据状态标签 | `status-pill` | 全局复用 | `observed / pending / unobserved / stale` | `snapshot.sourceHealth.sourceStatus` |
| 刷新反馈条 | `refresh-feedback` | 全局复用 | `refreshing / done / error`、约 `5s` 自动隐藏 | `snapshot.sourceHealth.refresh` |
| 提醒中心 | `NotificationCenter` | 全局复用 | `DashboardNotificationEntry[]`、未读数、详情弹层、标记已读、查看页面 | `notifications:get`、`notifications:updated`、`notifications:mark-read`；展示同一条提醒的标题、正文、类别、级别和触发时间 |
| 首次加载检测 | `FirstLoadPanel` / `DataSourceStatusPanel` | 全局复用 | `generatedFrom=pending`、Codex 检测、Git 检测 | `snapshot.sourceHealth`、`snapshot.repositories.summary`、`preferences` |
| 数据源手动提示 | `setup-banner` | 全局复用 | Codex 或 Git 未检测到时引导打开设置 | `snapshot.sourceHealth.sourceStatus`、`snapshot.repositories.summary.totalTracked` |
| 页脚数据来源 | `FooterNote` / `footer-note` | 全局复用 | `sessionFilesScanned`、`archivedFilesScanned`、`repoCount` | `snapshot.sourceHealth`、`snapshot.pricingMeta` |
| 图标资产 | `src/renderer/icons.tsx` `BrandMark` / `Glyph` | 全局复用 | `IconName` | 本项目自定义 SVG |
| Windows 托盘图标 | `createTrayIcon` / `createTrayPngBuffer` | 主进程复用 | 32px PNG `nativeImage` | 主进程运行时生成蓝青渐变 PNG，避免 Windows 托盘使用 SVG DataURL 时出现空白 |
| 数据刷新广播 | `dashboard:updated` / `onDashboardUpdated` | 全局复用 | `DashboardSnapshot` | 主进程周期采集、后台采集和手动刷新 |
| 应用提醒与系统通知 | `DashboardNotificationService` / `notification-state.json` | 主进程复用 | `generatedFrom=live`、通知 key 去重、已读状态、点击打开总览页 | `snapshot.overview.bankedResetCredits`、`windowPeriods.fiveHour / weekLimit`、`limitWindows[0..1]`；赠送重置到期或无法反推、5H / 周额度低于 `20% / 10%` 时触发；系统通知之外同步进入应用内提醒中心 |
| Codex 增量缓存 | `CodexSessionCacheStore` / `collectCodexData` | 主进程复用 | `size`、`mtimeMs`、解析结果 | `%APPDATA%/codex-companion/codex-session-cache.json` |

## 设置页

| 设计区块 | 代码组件 / 位置 | 复用性 | 关键 props / 状态 | 数据来源 |
| --- | --- | --- | --- | --- |
| Codex 数据目录 | `SettingsPage` `repo-root-editor` | 页面级 | 手动输入、选择目录、恢复默认、保存并刷新 | `preferences.codexHome`、`app:select-directory`、`preferences:update` |
| 计费口径 | `SettingsPage` `settings-form-row` | 页面级 | `billingMonthStartDay`、保存并刷新 | `preferences.billingMonthStartDay`、`preferences:update` |
| 仓库根目录 | `SettingsPage` `repo-root-editor` | 页面级 | 手动输入、选择目录、移除、保存并刷新 | `preferences.repoRoots`、`app:select-directory`、`preferences:update` |
| 刷新历史 | `RefreshHistoryTable` | 页面级 | 最近 `30` 条刷新记录 | `snapshot.sourceHealth.refreshHistory` |
| 数据边界 | `SettingsPage` `settings-source-grid` | 页面级 | Codex home、仓库根、本地快照、增量缓存、通知去重 | `snapshot.sourceHealth`、本项目独立采集约定、`notification-state.json` |

## Codex 账本页

| 设计区块 | 代码组件 / 位置 | 复用性 | 关键 props / 状态 | 数据来源 |
| --- | --- | --- | --- | --- |
| Token 走势拆解 | `TokenTrendCard` | 账本页模块 | `trendPeriod`、`visibleTrendSeries`、`selectedTrendBucketKey`、`isTrendExpanded`、`isTrendDetailOpen`；开放 `day / week / month` | `snapshot.ledger.trend`、`TokenBreakdown` |
| 趋势曲线图 | `TrendLineChart` / `TrendDetailPanel` / `TokenTrendExpandedView` | 账本页模块 | `LedgerTimeBucket[]`、平滑曲线、曲线显隐、点位选择、当前粒度表、放大查看、明细显隐 | `snapshot.ledger.trend.day / week / monthByDate` |
| 周期洞察 | `PeriodInsightCard` | 账本页模块 | `insightPeriod` | `snapshot.ledger.analysis.sevenDays / thirtyDays / cumulative` |
| 周额度账本 | `WeeklyLedgerCard` | 账本页模块 | `weeklyPeriods` | `snapshot.ledger.weeklyPeriods`、`period.quotaEvidence` |
| 模型贡献 | `ModelContributionCard` | 账本页模块 | `modelPeriod`、`modelSort` | `snapshot.ledger.analysis.*.models` |
| 模型表头排序 | `ModelSortHeader` | 账本页模块 | `model / share / token / cost / events`、`asc / desc` | 本地页面状态 |
| 会话归因 | `SessionAttributionCard` | 账本页模块 | 最近 8 条会话 | `snapshot.ledger.sessions` |
| 账本页一致性校验 | `scripts/verify-ledger-page.mjs` | 工程校验 | `npm run verify:ledger` | 设计图、UI Contract、数据合同、采集器和渲染层 |

## 当前约束

- `自然时间 / 计费时间` 只改变总览页统计口径，不改变壳层和顶部四卡字段。
- `Codex 账本` 顶栏中部保持空白节奏，不再放整页 `日 / 周 / 月`；该切换只属于 `Token 走势拆解`，当前实现开放 `日 / 周 / 月`。
- `Codex 账本` 不再重复总览页的 `5H / 周 / 月额度` 三卡主叙事；第二页首屏必须围绕走势、周期洞察、周额度细账、模型贡献和会话归因。
- `Token 走势拆解` 使用多曲线表达 `总 Token / 输入总量 / 原始输入 / 缓存输入 / 输出 / 推理 Token`；用户可点击图例显示或隐藏某条曲线，点击曲线点位或横轴日期后显示当前粒度明细表。
- `Token 走势拆解` 当前已把折线升级为平滑曲线，并新增 `放大查看` 全截面视图；放大层复用 `trendPeriod / visibleTrendSeries / selectedTrendBucketKey` 和 `snapshot.ledger.trend`，不新增统计口径。
- `Token 走势拆解` 曲线色板必须保持明显色相差异：总量、输入、原始输入、缓存输入、输出、推理 Token 不使用近似蓝绿同色系堆叠。
- `Token 走势拆解` 当前粒度明细默认隐藏；点击点位、横轴日期或 `明细` 按钮后展开，展开后可用 `隐藏` 收起；非放大态顶部摘要只显示 `会话 / API 等价成本`，放大态使用上方明细、下方曲线的上下结构，并保留 `曲线 / 数值 / 占比` 三列表格；放大态明细带需要让日期、摘要卡和表格在同一视觉高度内对齐，避免表格字体过小或上方信息带压扁。
- `周期洞察` 与 `模型贡献` 使用各自的 `近7天 / 近30天 / 累计`，不使用 `全部`，也不跟随左侧趋势图的 `日 / 周 / 月`。
- `模型贡献` 不设置额外排序按钮；默认 `Token` 倒序，点击表头字段后第一次正序、第二次倒序。
- 应用启动优先读取缓存快照；实时采集延迟到启动后后台执行，自动刷新间隔为 `5` 分钟，避免打开应用时立刻触发完整 Codex + Git 扫描造成卡顿。
- Codex 会话采集必须增量复用 `codex-session-cache.json`：文件签名未变化时复用解析结果，新增或变更文件才重新解析，反馈条展示本次新解析和复用数量。
- 手动刷新必须有顶部临时反馈条，采集中禁用重复点击；完成后展示 `sourceHealth.refresh.durationMs / codexFilesParsed / codexFilesReused`，约 `5s` 后消失，长期记录进入设置页刷新历史。
- 顶部 `sourceStatus` 表达本次 Codex 数据源是否成功观测；最近没有新 token 事件只通过 `lastObservedAt` 和刷新反馈说明，不能把一次成功刷新显示成 `数据过期`。
- 顶部 `今日代码改动` 的 `detail` 使用 `snapshot.overview.previous.yesterday.code.changedLines` 与 `snapshot.overview.today.code.changedLines` 计算，昨日 Git 有数据时必须显示百分比。
- 顶部计费时间 `本月 Token` 使用 `snapshot.overview.windowPeriods.billingMonth`；默认 `billingMonthStartDay=1`，因此当前默认与自然月一致，设置页可调整起始日并触发刷新。
- `BankedResetCreditStrip` 固定放在顶部四卡和 `5H / 周额度窗口` 两张额度卡之间；普通态必须是一行状态，不占用顶部四卡；展开态只显示脱敏逐个明细，不展示 app-server 原始响应或余额字段。
- 设置页 `Codex 数据目录` 支持手动输入、系统目录选择和恢复默认；保存后通过 `preferences:update` 写入本机配置并立即刷新，路径只用于读取本机 Codex sessions、archived_sessions 和 rate_limits。
- 设置页 `仓库根目录` 支持手动输入、系统目录选择、移除和恢复默认；保存后通过 `preferences:update` 写入本机配置并立即刷新，路径只用于本地 Git 仓库扫描和 Codex 会话归因。
- 左侧品牌图标使用 `src/renderer/icons.tsx` 中的 `BrandMark` SVG，必须保持非官方自定义资产，不使用 OpenAI / Codex 官方 logo。
- Windows 托盘图标使用主进程运行时生成的 PNG `nativeImage`，不要回退为 SVG DataURL；托盘图标仍保持非官方自定义蓝青图形。
- 左侧导航图标使用 `src/renderer/icons.tsx` 中的 `Glyph` SVG：总览为首页图标，账本为文档账本图标，代码仓库为代码方块图标，设置为齿轮图标；图标本身不使用额外白色胶囊背景。
- 左侧导航项遵循设计稿的单行结构，只显示图标和主标签；`总览 / Codex 账本 / 代码仓库 / 设置` 不在导航行内显示二级说明文案。
- `5H / 周额度窗口` 统一复用 `QuotaWindowCard`，不额外派生其他布局。
- `QuotaWindowCard` 标题只显示一次，不额外显示 `额度窗口` 辅助行。
- `QuotaWindowCard` 圆环显示当前额度周期累计后的剩余量，右侧数据使用同一额度周期内真实 token 增量。
- `QuotaWindowCard` 的 `5H / 周额度` 必须来自同一个主额度池 `limit_id=codex`；采集到其他模型池时只能作为降级候选，不能覆盖主额度。
- `QuotaWindowCard` 不展示月额度；当前 `可观测月额度` 仍取决于 Codex 原始 `rate_limits` 是否暴露月级窗口，不能因为计费月 Token 可计算就标记为已观测。
- `QuotaWindowCard` 圆环弧线和中心数字都使用剩余百分比，不允许弧线使用已用百分比。
- `QuotaWindowCard` 圆环内部小字 `剩余量` 位于百分比上方，百分比处于圆心视觉位置。
- `QuotaWindowCard` 圆环下方必须展示当前额度周期起止，使用 `period.startAt / period.endAt`，不额外读取原始日志；周期起止必须与重置时间合并为一行，不再单独占用一行；同日短周期显示时间范围，多日周期显示日期范围，避免周额度显示成 `09:02 - 09:02`。
- `QuotaWindowCard` 展示当前额度周期 `rate_limits` 观测次数和重置次数，作为真实额度数据的可见证据；可见文案统一为 `观测 N 次 · 重置 N 次`，不额外重复 `额度观测`。
- `QuotaWindowCard` 的口径说明保留在数据层和文档，不再作为额度卡内独立底部行渲染；页面内证据应并入 `Top 3 模型占比` 标题行右侧，避免多占一行高度。
- `QuotaWindowCard` 右侧明细行必须带小图标。
- 顶部 `时间视角` 与 `自然时间 / 计费时间` 使用同一个 `topbar-mode-switch` 文本切换。
- 顶部时间视角切换内部不允许换行；较窄窗口优先压缩标题、副标题或右侧操作间距，不能把时间视角整体拆到第二行。
- 顶部时间视角属于中部页面控制区，不能被 `space-between` 推到右侧操作区旁边，也不能因 `flex-start` 偏到标题组旁边；顶栏桌面态使用左 / 中 / 右三列布局，中部视角控件几何居中，右侧状态、刷新和快照贴右。
- 页面级截图支持通过 hash 查询参数设置初始 `overviewMode`，用于生成自然时间和计费时间两种真实 Electron 截图；普通用户默认进入计费时间。
- 主进程默认每 `5` 分钟后台采集一次 `DashboardSnapshot` 并通过 `dashboard:updated` 广播；启动时优先显示缓存快照，延迟后台刷新，手动刷新完成后也必须广播，渲染端通过 `window.codexCompanion.onDashboardUpdated` 静默更新页面。
- 提醒中心位于顶栏操作区，铃铛按钮显示未读数；点击后展开最近提醒详情，支持查看对应页面和标记已读；详情只展示聚合后的提醒正文，不展示原始会话或 app-server 响应。
- 系统通知只在 live 快照生成后检查：赠送重置临近 `safeEstimatedExpiresAt`、预计过期、首次观测前已有 credit 无法反推时提醒；5H / 周额度剩余量低于 `20%` 或 `10%` 时提醒；同一 credit 状态或同一额度周期阈值通过 `notification-state.json` 去重并进入应用内提醒中心。
- 顶部工具栏状态胶囊只显示状态文字，不额外显示状态图标；额度卡和指标卡内状态标签也保持文字-only。
- 顶部工具栏不显示 `桌面总控台` 等额外眉标，页面标题与副标题横向组成同一信息组。
- 左侧品牌区必须保持产品图标和 `Codex Companion` 标题顶线对齐，说明文字放在标题下方，图标与标题间距接近设计稿；文字组允许少量基线补偿，避免标题高于图标造成错位。
- 顶部四卡必须显示自定义指标图标，图标在左、内容在右、整体居中；正常 `已观测` 不渲染单卡状态标签，异常态状态标签固定在右上角；不使用官方 OpenAI / Codex 视觉资产。
- 顶部四卡状态必须由单张卡片的数据可观测性决定；计费月未观测时，`本月 Token` 卡片必须显示 `未观测` 状态，不能沿用全局 `已观测`。
- 顶部四卡高度应接近设计稿比例，`MetricCard` 使用居中内容区；异常态才使用右上角状态覆盖层，不得让状态标签单独占一整行。
- 顶部四卡内部微调只允许改变图标自适应尺寸、内容居中、标题权重和主数字视觉权重，不改变四卡字段、单位和统计口径；当前图标尺寸应约为 `64px - 72px`，与右侧三行文字总高度接近。
- 右侧主工作区外层保持轻描边与浅底，不使用强浮层阴影；卡片渐变和阴影必须弱于当前分区卡片内容层。
- 颜色使用组件级 token：主标题和主数字为 `#111827` 级深墨色，普通正文为 `#334155` 级蓝灰色，副标题 / 表头 / 页脚为 `#64748b` 级辅助蓝灰色，证据和定价来源为 `#94a3b8` 级弱辅助色；不能把所有文字统一压成主标题色。
- 设计 token 的唯一运行入口为 `src/renderer/design-tokens.ts`，正式说明见 `docs/design-tokens-v0.1.md`；提交前执行 `npm run verify:design`，防止 CSS 引用未定义 token 或关键色阶漂移。
- 项目表表头不强制全大写，保持与设计稿一致的正常标题大小写。
- 项目概览主标题直接使用 `项目概览`，不再使用“项目消耗”作为主标题。
- 项目概览二级周期切换必须放在 `项目概览` 标题右侧；排序不再使用右侧 chip 按钮，改为点击表头字段排序。
- 项目概览自然时间默认选中 `周`，计费时间默认选中 `周额度`，并额外提供 `计费月`；用户在当前页面会话内切换周期后，保持用户选择。
- 项目概览默认按 `最近活动` 倒序，即最新项目活动优先；点击任一表头字段后第一次按该字段正序，第二次按该字段倒序。
- 项目概览必须保留所有已发现本地项目，当前周期无活动项目显示 0 / `--`，不能因为无活动而从表格中消失。
- 项目表 `项目` 列必须显示项目小图标和项目名，小图标由项目名稳定映射颜色，只作为扫读锚点，不表示官方身份。
- 项目概览表格需要保留轻量横向和纵向网格线；纵向线只用于增强列扫读，不应变成强边框。
- 总览页的页脚数据来源必须归入项目概览卡底部，视觉上属于同一张底部表格卡；账本页和仓库页可继续在页面底部复用同一 `FooterNote`。
- 页脚必须展示本地数据来源与 `session / archived / 仓库` 统计 chip。
- 当前 `设置` 仅作为壳层保留入口，正式设置页待后续单独设计。
- 挂件入口不再放在主页面工具栏，保持默认关闭策略。
- 页面提交前必须用真实 Electron 窗口截图验证 `1360 x 900` 和 `1080 x 720`，截图通过后再进入 Git 提交。

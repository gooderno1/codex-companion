# DEVELOPMENT LOG

## [2026-06-05] v0.2.2-dev.75 fix: 修正账本页密度并降低启动采集卡顿

- 开发原因：提交第二、第三页前复核发现第二页实现与设计图仍有密度偏差，尤其是图表区域过空、表格可见行数不足；同时用户反馈程序打开后非常卡，需按既定“先查数据链路再改实现”的方式定位并修复。
- 实现方式：压缩账本页三段布局比例、卡片内边距、图表柱区和表格行高，让 `周额度账本 / 模型贡献 / 会话归因` 更接近设计图的一屏阅读密度；启动性能方面，主进程改为打开时优先显示缓存快照，实时采集延迟到启动后后台执行，自动刷新从 `60s` 放宽到 `5min`，渲染层不再因缓存快照自动触发强制刷新；同时停用当前 UI 不使用的仓库文件体量扫描，避免每次刷新对全部 tracked files 做 `stat`。
- 当前结果：第二页实现更接近 `v0.3.15` 设计图的层级和密度；程序启动不再立即阻塞在完整 Codex + Git 重采集上，手动刷新和后台更新仍保留；第三页合同状态同步更新为已实现，第二第三页未提交改动准备进入统一提交。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；重新生成并人工检查 `local_dev_work/ledger-1360x900-dev75.png` 与 `local_dev_work/repositories-1360x900-dev75.png`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.74 feat: 落地 Codex 账本页新版设计

- 开发原因：用户要求把第二页已确认的 `v0.3.15` 设计图真正落到项目中，并确保实现继续遵守前面约定的数据边界、模块命名、周期语义和排序规则。
- 实现方式：扩展 `DashboardSnapshot.ledger.weeklyPeriods / trend / analysis`，由 `dashboardCollector` 基于真实 `CodexTokenEvent` 生成小时、日期、周段桶以及 `近7天 / 近30天 / 累计` 分析周期；在渲染层把第二页重构为 `Token 走势拆解 / 周期洞察 / 周额度账本 / 模型贡献 / 会话归因`，移除旧的重复额度三卡，并为模型贡献改成表头排序；同步新增 `npm run verify:ledger` 固化设计图、合同、采集器和页面实现的一致性检查。
- 当前结果：第二页已经按设计图落地为真实数据驱动页面；`Token 走势拆解` 支持局部 `日 / 周 / 月`、横轴和纵轴切换，`周期洞察` 与 `模型贡献` 各自支持 `近7天 / 近30天 / 累计`，周额度账本展示日期区间、累计已用、API 等价成本和满额周折算，会话归因仍只展示聚合字段。
- 验证方式：执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev74.png`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.73 feat: 落地代码仓库页正式实现

- 开发原因：第三页 `代码仓库` 已完成设计收敛，但应用内仍停留在旧的仓库卡片流实现，和合同中的“同步 Git 仓库快照 + 顶部四卡 + 左侧可排序表 + 右侧联动详情”差距较大；需要按前面确认的方法把设计正式落实到项目中，并补齐可验证路径。
- 实现方式：先对齐共享数据合同与采集链路，给 `RepoMetric` 补入 `fullName / lastSyncedAt`，并把仓库汇总中的“近 7 日改动”改成真实滚动 7 天；随后重写渲染层第三页，收回顶栏中部占位文案，改成搜索栏、四张摘要卡、可点击表头排序的仓库详情表、右侧已选仓库详情与专用页脚；同时扩展主进程初始路由能力并新增 `capture:repositories` 截图脚本，用于生成第三页真实 Electron 截图做设计核验。
- 当前结果：第三页现在已经和合同对齐到同一套产品壳层与信息结构，不再展示目录视角、扫描目录、文件体量和本地工作区状态；仓库列表默认按最近提交倒序，可点击表头切换排序，右侧详情改为同步 Git 活动、Codex 投入概览和极简最近提交；数据口径也同步切到“定时同步 Git 快照”视角。
- 验证方式：执行 `npm run build`；执行 `git diff --check`；执行 `npm run capture:repositories` 生成真实 Electron 截图；人工比对实现图与 [docs/assets/design/v0.3.11/repositories-page.png](./docs/assets/design/v0.3.11/repositories-page.png) 的壳层、模块层级和关键信息结构。

## [2026-06-04] v0.2.2-dev.72 docs: 将账本页新命名与周期正式落图

- 开发原因：用户确认第二页的新命名和新周期规则后，要求把这些内容真正落到第二页设计图，而不是继续只停留在合同文字里。
- 实现方式：在保持第一页真实壳层、第二页三段堆叠图和表头排序规则不变的前提下，重出新版账本页状态图；同步让状态图引用切到 `docs/assets/design/v0.3.15/ledger-page.png`，并把 `Token 走势拆解 / 周期洞察 / 模型贡献` 以及 `近7天 / 近30天 / 累计` 写进总页面设计规格与账本页规划文档。
- 当前结果：第二页新的正式图片稿已经不再沿用旧标题，也不再让右侧两个模块继续跟左侧图表共用 `日 / 周 / 月`；当前图上已经能直接看到三处新命名和两个独立周期切换。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.71 docs: 收回第三页为同步 Git 仓库视角

- 开发原因：用户继续审第三页设计后指出三个核心偏差：页面对象不应再写成本地仓库，而应基于定时同步的 Git 信息；`目录视角 / 扫描目录` 没有实际价值；侧栏中还出现了重复的 `设置` 入口。
- 实现方式：回查第一页真实壳层和第三页 `v0.3.10` 状态图，确认偏差集中在数据对象定义、顶栏中部控件和侧栏导航；随后把总页面设计规格升级到 `v0.3.15`，明确第三页改为“定时同步 Git 仓库快照”视角，移除目录相关控件、去掉主导航内重复 `设置`，并同步修订第三页 UI Contract 的字段、页脚数据来源和右侧详情结构；最后按新合同重出 `docs/assets/design/v0.3.11/repositories-page.png`。
- 当前结果：第三页设计现在不再依赖本地目录语义；顶栏中部被收回为空白节奏，内容首行只保留仓库搜索和排序提示；左侧主导航只剩三页主入口，`设置` 只保留左下角一处；右侧详情也不再展示本地工作区状态，而是回到同步 Git 活动、Codex 投入和最近提交这几类更可信的信息。
- 验证方式：执行 `npm run build`；执行 `git diff --check`；人工比对第一页真实截图与第三页新图的侧栏、顶栏和内容首行结构。

## [2026-06-04] v0.2.2-dev.70 docs: 将账本页新命名与周期落到设计图

- 开发原因：用户确认第二页的新命名和周期语义后，要求不再只停留在合同文字里，而要真正落到第二页设计图上。
- 实现方式：延续上一轮已经确认的壳层、图表结构和表头排序规则，继续更新第二页规划文档、总页面设计规格和状态图版本号；随后重出新版账本页状态图，把 `Token 走势拆解 / 周期洞察 / 模型贡献` 三个名称，以及 `近7天 / 近30天 / 累计` 的右侧双模块周期切换直接落到图面。
- 当前结果：第二页最新状态图不再只是布局骨架图；新命名和新周期已经进入正式图片稿，右侧两个模块也不再和左侧走势图共用 `日 / 周 / 月`。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图是否使用新名称与 `近7天 / 近30天 / 累计`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.69 docs: 调整账本页模块命名与周期口径

- 开发原因：用户继续审第二页设计，认为 `Token 构成与强度 / 强度摘要 / 模型构成` 这三组名称都偏硬，且右侧两个模块虽然明显受周期影响，但继续跟左侧图表共用 `日 / 周 / 月` 并不合适；同时用户明确质疑 `全部` 这种周期文案是否边界太模糊。
- 实现方式：更新第二页规划文档、第二页 UI Contract、第二页模块合同与总页面设计规格，把三个模块统一重命名为 `Token 走势拆解 / 周期洞察 / 模型贡献`；同时把周期规则拆成两套：趋势图保留 `日 / 周 / 月`，右侧两个模块统一改为 `近7天 / 近30天 / 累计`，并在文档里明确不使用 `全部`。
- 当前结果：第二页当前合同已经不再把所有模块硬绑在同一套周期语义上；现在图表负责看走势，右侧两个模块负责看滚动周期聚合，页面解释更顺；当前 `v0.3.13` 图片保留为布局骨架图，下一轮重画时再把新名称和新周期文案落进去。
- 验证方式：执行 `npm run build`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.68 fix: 项目概览改为表头排序

- 开发原因：用户指出总览页项目概览右上角排序按钮不够美观和实用，期望默认按最新项目活动展示，并通过点击表头字段完成排序，第一次正序、第二次倒序。
- 实现方式：先更新总览页 UI Contract、组件映射、分区审计、比例测量和目标审计，明确排序入口归入表头；随后在 `OverviewPage` 中把排序状态改为 `key + direction`，默认 `recent / desc`，新增 `ProjectSortHeader`，让所有表头字段可点击排序，并移除右上角 chip 排序栏；同步增强 `verify:overview` 静态断言。
- 当前结果：项目概览默认按最近活动倒序展示；用户可点击 `项目 / Token / API 等价成本 / 代码行数 / 提交 / 会话 / 最近活动` 表头进行正序 / 倒序切换，项目概览标题区更简洁。
- 验证方式：执行 `npm run build`；逐张生成 `dev68` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview` 时被既有 5H 额度快照校验假设阻断，当前快照中 `resetsAt` 表现为最近重置点而非周期终点；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.67 docs: 按模块合同重画账本页设计图

- 开发原因：用户确认第二页应先按细化后的模块合同重画设计图，并进一步明确 `Token 构成与强度`、`强度摘要` 与 `模型构成` 需要严格体现模块级 `日 / 周 / 月`、固定六项摘要和表头排序，而不是继续沿用上一版状态图里的顶栏时间切换和按钮式排序。
- 实现方式：先核对第一页 `dev61` 真实截图与第二页 `v0.3.7` 旧图的冲突点，随后修订第二页规划文档、第二页 UI Contract 与总页面设计规格，把 `模型构成` 排序统一收敛到表头，升级总规格到 `v0.3.13`；最后按这些规则重出新版账本页状态图并保存到 `docs/assets/design/v0.3.13/ledger-page.png`。
- 当前结果：第二页最新状态图已经从“方向图”收紧为“按模块合同出图”的版本；页面顶栏不再承载 `日 / 周 / 月`，强度摘要统一为 `窗口累计 / 窗口均值 / 峰值位置 / 峰值用量 / 单次峰值 / 缓存输入占比` 六项，模型构成也不再保留额外排序按钮。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图是否移除了顶栏 `日 / 周 / 月` 与模型构成按钮式排序；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.66 fix: 项目概览改为表头排序

- 开发原因：用户指出总览页项目概览右上角排序按钮不够美观和实用，期望默认按最新项目活动展示，并通过点击表头字段完成排序，第一次正序、第二次倒序。
- 实现方式：先更新总览页 UI Contract、组件映射、分区审计、比例测量和目标审计，明确排序入口归入表头；随后在 `OverviewPage` 中把排序状态改为 `key + direction`，默认 `recent / desc`，新增 `ProjectSortHeader`，让所有表头字段可点击排序，并移除右上角 chip 排序栏；同步增强 `verify:overview` 静态断言。
- 当前结果：项目概览默认按最近活动倒序展示；用户可点击 `项目 / Token / API 等价成本 / 代码行数 / 提交 / 会话 / 最近活动` 表头进行正序 / 倒序切换，项目概览标题区更简洁。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev66` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.65 docs: 协调代码仓库页壳层与第一页一致性

- 开发原因：用户指出第三页当前设计图的左侧边栏和顶部工具栏风格与第一页实际落地界面不一致；继续沿用这版壳层会让第三页看起来像另一套产品，而不是同一个桌面应用内的页面。
- 实现方式：先对照 `local_dev_work/overview-1360x900-dev57.png` 与 `docs/assets/design/v0.3.9/repositories-page.png`，确认冲突点主要集中在左侧品牌区、导航激活态、底部设置区，以及顶部工具栏的结构和控件风格；随后把 `docs/page-design-spec-v0.3.md` 升级到 `v0.3.12`，明确第三页必须直接复用第一页真实左栏与三列顶栏，中部只保留目录视角切换，搜索框下移到内容区；同步更新 `docs/ui-contract/repositories-v0.1.md` 的壳层基准与页面结构，并重出新设计图到 `docs/assets/design/v0.3.10/repositories-page.png`。
- 当前结果：第三页新的壳层约束已经收紧为“左栏逐项对齐第一页、顶栏逐项对齐第一页”；第三页顶部不再使用独立的按钮风格筛选条，搜索和目录过滤回到内容区，右上只保留第一页同风格的 `状态 / 刷新 / 快照`；这样第三页在视觉上会回到与第一页同一套产品语言。
- 验证方式：人工比对第一页真实截图与第三页新图的左栏品牌块、导航激活态、底部设置区、顶栏三列结构和右上操作区；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.64 docs: 抽离账本页强度模块独立合同

- 开发原因：第二页 `Token 构成与强度` 与 `强度摘要` 已经从方向讨论进入细节确认阶段，继续只写在页级规格里不利于逐项确认；同时用户补充了“列表不要额外放排序按钮，优先用点表头正序 / 倒序”的交互偏好，需要沉淀成统一规则。
- 实现方式：新增 `docs/ui-contract/ledger-intensity-modules-v0.1.md`，单独收纳第二页强度模块的时间范围、横轴、纵轴、token 关系、图表堆叠方式、tooltip、强度摘要公式和模型构成排序交互；并把这份模块合同回链到第二页规划文档、第二页 UI Contract 与总页面设计规格中，升级总规格到 `v0.3.11`。
- 当前结果：第二页现在不仅有页级合同，还有针对 `Token 构成与强度 / 强度摘要 / 模型构成` 的独立模块合同；后续继续重画第二页设计图时，可以直接按模块合同核对，不需要再从整页规格里翻找散落规则。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.63 docs: 细化账本页强度模块与摘要模块口径

- 开发原因：用户认为第二页新图的 `Token 构成与强度` 与 `强度摘要` 方向正确，但交互和数据口径尚未设计完，例如 `日 / 周 / 月` 影响范围、横轴 / 纵轴可选项、token 关系、tooltip、堆叠方式、左右纵轴和摘要指标计算规则都还不够明确，现阶段直接固化设计图风险较高。
- 实现方式：重新核对 `codexCollector` 的 `TokenBreakdown`、`dashboardCollector` 的事件聚合与 `dev-ledger` 对 `cachedInputTokens / inputTokens / outputTokens / reasoningTokens` 的使用方式，明确 `输入总量` 与 `缓存输入`、`输出` 与 `推理 Token` 的包含关系；随后把这些结论回写到 `docs/ledger-page-design-plan-2026-06-04.md`、`docs/ui-contract/ledger-v0.1.md` 与 `docs/page-design-spec-v0.3.md` 第 3 节，补齐模块级时间范围、横纵轴、堆叠逻辑、tooltip 和强度摘要公式。
- 当前结果：第二页的两个核心模块现在已经从“示意图概念”升级为可执行设计合同；明确了 `日 / 周 / 月` 只作为局部分析状态、`强度摘要` 只跟随时间范围不跟随纵轴漂移、`总 Token` 不再错误地把 `缓存输入` 和 `推理 Token` 当成独立并列段堆叠；当前 `v0.3.7` 账本页图因此应视为阶段图，待这些规则确认后再决定是否重出页面设计图。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.62 docs: 精修代码仓库页排序与右侧详情

- 开发原因：用户继续细化第三页设计，要求左侧仓库详情不要再用一排排序按钮，而要改成点击列表头部排序；同时指出右侧新增的一行投入信息比较生硬，希望重做得更自然；另外质疑“最近提交”是否展示过多，需要重新判断其页面价值。
- 实现方式：更新 `docs/page-design-spec-v0.3.md` 到 `v0.3.9`，把第三页排序交互改成“默认按最近提交倒序，点击表头字段切换排序并支持正序 / 倒序”；将右侧投入摘要明确收敛为独立的 `Codex 投入概览` 小分区或 `2 x 2` 紧凑矩阵；同时弱化 `最近提交`，移出顶部四卡，并把详情中的提交展示压缩为最新 `2-3` 条或“最近一次提交 + 查看全部”；同步更新 `docs/ui-contract/repositories-v0.1.md`，并重出新设计图到 `docs/assets/design/v0.3.9/repositories-page.png`。
- 当前结果：第三页新版设计已经把左表排序交互融入表头本身，默认排序语义更自然；顶部第四卡由 `最近提交` 改为 `关联仓库`；右侧 `Codex 投入概览` 从生硬横排改成独立的视觉分区；`最近提交` 保留为“新鲜度证明”和上下文补充，但不再抢主视觉。
- 验证方式：人工核对新版设计图是否体现表头排序、`关联仓库` 替代顶部最近提交、右侧 `Codex 投入概览` 分区，以及最近提交的降级处理；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.61 fix: 默认计费月与自然月对齐

- 开发原因：用户从套餐信息确认当前月度计费从每月 `1` 日开始；此前计费时间下顶部 `本月 Token` 因未直接观测月额度窗口而显示 `未观测`，但 Token 计费月时间窗口已经可以按套餐起始日明确计算。
- 实现方式：在文档和实现中统一口径：计费月 Token 默认从每月 `1` 日 00:00 起算，月层面默认与自然月一致；为 `AppPreferences` 增加 `billingMonthStartDay`，新增 `startOfBillingMonth`，并让 `dashboardCollector` 产出 `billingMonth / previousBillingMonth` 周期，同时保留 `可观测月额度` 只来自 Codex `rate_limits` 的边界。
- 当前结果：计费时间下顶部 `本月 Token` 默认展示与自然月一致的本月 Token，不再显示 `未观测`；后续设置页可以直接接入 `billingMonthStartDay` 让用户选择每月第几天作为计费月起始日。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev61` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.60 docs: 为代码仓库页补回仓库级投入信息

- 开发原因：用户认可第三页整体结构，但希望再补一些“项目对应的 Token 消耗和对应成本”等信息，并明确要求参考 `dev-ledger` 的 Git 页展示方式。
- 实现方式：先核对 `src/shared/contracts.ts`、`src/renderer/App.tsx` 和 `dev-ledger/src/main.js`，确认当前第三页数据层已有 `repo.tokens.total` 与 `repo.apiCostUsd`，但尚无稳定的仓库级 `30 天成本 / 30 天 Token` 合同；随后把 `docs/page-design-spec-v0.3.md` 升级到 `v0.3.8`，将第三页调整为“顶部四卡仍讲工程活跃，中部左表增加 `Codex 投入` 列，右侧详情补 `累计 Token / 累计 API 成本 / 关联会话 / 最近 Codex 活动`”，并同步更新 `docs/ui-contract/repositories-v0.1.md`；最后按新口径重出设计图并保存到 `docs/assets/design/v0.3.8/repositories-page.png`。
- 当前结果：第三页现在既保留了 `扫描目录 + 活跃度 + 左表右详情` 的主结构，又补回了仓库级 Codex 投入信息；其中 Token / 成本只出现在中部工作台，不抬成首屏主卡，且文档明确当前仍只允许使用累计口径，不伪造 `30 天成本` 等合同外字段。
- 验证方式：人工对照 `dev-ledger` Git 页与新设计图，确认 Token / 成本回到左表和右侧详情而非顶部主卡；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.59 fix: 默认计费月与自然月对齐

- 开发原因：用户从套餐信息确认当前月度计费从每月 `1` 日开始；此前应用因 Codex 原始 `rate_limits` 未暴露月额度窗口，计费时间下顶部 `本月 Token` 显示 `未观测`，但月 Token 时间窗口可以按用户确认的套餐起始日计算。
- 实现方式：先更新数据契约、UI Contract、组件映射、额度审计、分区审计、比例测量和目标审计，明确计费月 Token 默认每月 `1` 日起算且不等同于月额度；随后为 `AppPreferences` 增加 `billingMonthStartDay`，默认值为 `1`，新增 `startOfBillingMonth` 工具，并让 `dashboardCollector` 生成 `billingMonth / previousBillingMonth` 周期；同步增强 `verify:overview` 对计费月起始日和聚合字段的静态检查。
- 当前结果：计费时间下顶部 `本月 Token` 默认与自然月一致，不再显示 `未观测`；`可观测月额度` 仍保持未观测，避免把 Token 时间窗口伪装成真实月额度。后续设置页可直接接入 `billingMonthStartDay`。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev59` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.58 docs: 重构账本页首屏为强度与周期细账

- 开发原因：用户明确指出 `5H / 周额度` 的限额表达已经在第一页稳定落地，第二页不应再用同样的三张大卡重复首屏；同时第二页应补入类似 `dev-ledger` Codex 页 `Token 构成与强度` 的核心模块，并把 `7 日均值`、`峰值时段`、`峰值日`、`单次峰值` 这类真实高价值信号纳入主结构。
- 实现方式：重新核对 `src/main/collectors/codexCollector.ts`、`src/main/collectors/dashboardCollector.ts`、`src/shared/contracts.ts` 与 `dev-ledger` 数据契约，确认当前底层事件已具备 `timestamp + input / cachedInput / output / reasoningOutput / total`，可以合法支持 `日 / 周 / 月`、`横轴` 和 `纵轴` 切换；随后重写第二页规划文档、`docs/ui-contract/ledger-v0.1.md` 与 `docs/page-design-spec-v0.3.md` 第 3 节，把第二页首屏改成 `Token 构成与强度 + 强度摘要`，并把第一页壳层基线同步切到最新 `dev57` 实际截图。
- 当前结果：第二页设计原则已从“额度三卡 + 账本 + 模型 + 会话”更新为“强度主图 + 峰值摘要 + 周额度账本 + 模型构成 + 会话归因”；页面明确支持 `总 Token / 输入 / 缓存输入 / 缓存输入占比 / 输出 / 推理 Token` 的纵轴口径，且不再重复展示固定月额度或 `剩余 Token` 这类无稳定来源字段。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.57 fix: 精修顶部四卡图标和状态标签

- 开发原因：继续按用户对总览页顶部四张指标卡的视觉反馈修正；当前图标、文字和字体方向已正确，但图标与右侧三行文字关系还可更统一，且四卡重复显示正常态 `已观测` 与顶栏全局状态冗余。
- 实现方式：先更新 UI Contract、组件映射、分区审计、比例测量和目标审计，明确正常 `已观测` 不在单卡重复展示、异常态仍显示；随后让 `MetricCard` 仅在 `sourceStatus !== "observed"` 时渲染状态标签，并将图标盒调整为 `64px - 72px`、收紧图标与文字组间距；同步更新 `verify:overview` 静态断言和版本号。
- 当前结果：自然时间四张指标卡不再显示重复 `已观测`，顶部工具栏仍展示全局状态；计费月等异常态仍可在单卡右上角显示；图标高度更接近右侧标题、主数字和说明三行文字总高度，视觉组关系更紧凑。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev57` 自然/计费四张真实 Electron 截图；人工查看 `local_dev_work/overview-1360x900-dev57.png`；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.56 docs: 重修账本页设计基线与第二页设计图

- 开发原因：第一页已经基本落地，第二页 `Codex 账本` 不应继续沿用第一页旧设计稿做壳层参考；同时旧账本页初稿含有 `剩余 Token`、伪模型名、`上上周` 相对命名、用户/状态/平均响应时长等不符合当前真实数据边界的内容，需要先在设计阶段纠偏。
- 实现方式：先以 `local_dev_work/overview-1360x900-dev53.png` 与计费态实际截图固定统一应用壳层，再对照 `src/shared/contracts.ts`、当前 `%APPDATA%/codex-companion/snapshot.json` 和 `dev-ledger/public/dashboard-data.local.json` 梳理账本页可展示字段；新增 `docs/ledger-page-design-plan-2026-06-04.md` 与 `docs/ui-contract/ledger-v0.1.md`，重写 `docs/page-design-spec-v0.3.md` 第 3 节及 `v0.3.5` 状态图说明，生成新版账本页设计图 `docs/assets/design/v0.3.5/ledger-page.png`，并同步更新路线图与版本号。
- 当前结果：第二页正式设计基线已切换为第一页真实截图；账本页顶部保留 `5 小时额度 / 周额度 / 可观测月额度` 三张卡，但不再展示 `剩余 Token`；中部主表改为按日期区间阅读的 `周额度账本`，允许体现 `117%` 这类累计已用和 `重置 1 次` 等真实周期特征；模型构成改为真实模型标签；会话归因删去无稳定来源的伪字段。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.55 docs: 重构代码仓库页设计稿

- 开发原因：第一页已经完成大体落地，第二页也已按真实数据边界重做设计；第三页 `代码仓库页` 仍停留在旧 `v0.3` 初稿。用户要求先沿用前两页的修正方法，重新讨论第三页的主对象、顶部摘要、左中右结构，以及扫描目录和远端信息的作用。
- 实现方式：先对照第一页实际截图 `local_dev_work/overview-1360x900-dev53.png`、现有仓库采集链路和旧版第三页设计图，更新 `docs/page-design-spec-v0.3.md` 到 `v0.3.6`；新增 `docs/ui-contract/repositories-v0.1.md` 固化第三页的壳层基准、数据边界、页面结构、修正原则和后续实施顺序；随后使用 `imagegen` 重出第三页设计图并落盘到 `docs/assets/design/v0.3.6/repositories-page.png`。
- 当前结果：第三页正式收敛为 `扫描目录筛选 + 四张摘要卡 + 可排序 Git 仓库详情表 + 单仓库详情 + 紧凑页脚说明`；首屏移除了 `归因 Token`、`文件体量` 和独立 `GitHub 远端` 大卡；页面主对象统一为本地 Git 仓库，和当前采集模型一致。
- 验证方式：人工核对新设计图与第一页已落地壳层的一致性；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.54 fix: 修正主额度池与昨日代码对比口径

- 开发原因：继续按用户对总览页数据的反馈修正两个问题；当前 5H 额度会被更新时间更新的模型额度池 `codex_bengalfox` 覆盖，导致主额度余量显示错误；顶部 `今日代码改动` 的 `较昨日` 没有读取昨日自然日 Git 行数，导致昨日有数据时仍可能显示 `新增`。
- 实现方式：先更新数据契约、UI Contract、组件映射、额度审计、分区审计、比例测量和目标审计，明确可见 `5H / 周额度` 优先主额度池 `limit_id=codex`，且 `quotaEvidence` 只混合同一额度池样本；随后让 `codexCollector` 保留 `limitId / limitName` 并按主池优先选择快照，让 `dashboardCollector` 过滤异池观测点并把昨日 Git 聚合传入 `previous.yesterday`，让 `gitCollector` 与共享契约补充 `activity.yesterday`；同步增强 `verify:overview` 回归检查。
- 当前结果：当前 live 快照显示 5H 额度周期余量 `78%`、周额度周期余量 `88%`，均来自主额度池；顶部 `今日代码改动` 使用今日 `7383` 行与昨日 `5219` 行计算，截图中显示 `较昨日 +41.5%`。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev54` 自然/计费四张真实 Electron 截图；人工查看 `local_dev_work/overview-1360x900-dev54.png`；执行 `npm run verify:quota`；执行 `npm run verify:overview`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-06-04] v0.2.2-dev.53 fix: 修正额度剩余量和截图验收口径

- 开发原因：继续按用户对 `dev52` 的反馈修正总览页；周额度圆环仍使用最近原始 `rate_limits` 余量，可能显示 `100%`，但同一周额度周期的累计 `quotaEvidence.usedPercent` 已经消耗到 `6%+`；顶部四卡图标仍偏小，额度圆环内部文案层级也需要按设计调整。
- 实现方式：先对照 `dev-ledger` 已生成的前几周计费周摘要，更新数据契约、UI Contract、组件映射、分区审计、比例测量、设计 token、目标审计和数据审计；随后将 Codex session 扫描窗口扩展到近 `60` 天，`LimitWindow.usedPercent / remainingPercent` 优先使用当前周期 `quotaEvidence` 显示口径，最近原始 `rate_limits` 仅作降级；同步更新 `verify:quota` 断言、顶部四卡图标尺寸、额度圆环内 `剩余量` 与百分比位置，并要求截图前必须强制生成 `live` 快照。
- 当前结果：周额度圆环和 `verify:quota` 已统一到周期累计余量；当前本机快照显示周额度 `周期余量 91% / 周期累计 9%`；顶部四卡图标最小尺寸提升到 `52px`；截图流程不再允许旧缓存生成当前版本验收图。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev53` 自然/计费四张当前版本截图；执行 `npm run verify:quota`；执行 `npm run verify:overview`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.52 fix: 修正总览页实时刷新与顶部细节

- 开发原因：继续按用户对 `dev51` 的反馈修正总览页；当前页面运行后不会实时更新数据，顶部四卡的 `数据过期` 等状态标签单独占一行，四卡内容左对齐且图标比例不够自适应，顶栏时间视角仍有偏左感。
- 实现方式：先更新 UI Contract、组件映射、分区审计、比例测量、设计 token 文档和目标审计，明确实时刷新广播、四卡右上角状态、内容居中、图标自适应和顶栏三列居中的规则；随后在主进程新增 `dashboard:updated` 广播和 `60s` 自动刷新，预加载层与共享契约暴露 `onDashboardUpdated`，渲染端订阅后静默替换快照；样式层将顶栏改为三列布局，四卡状态固定右上角、内容组居中、指标图标使用 `clamp()` 自适应；同步增强 `verify:overview` 对刷新链路和样式关键不变量的检查。
- 当前结果：启动后台采集、手动刷新、托盘刷新和周期刷新都会统一广播最新快照；页面不再只依赖启动读取一次；顶部四卡状态标签不再占底行，文字和图标关系更接近设计稿，时间视角在顶栏中段居中。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev52` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题，仅有 Windows 换行提示。

## [2026-06-04] v0.2.2-dev.51 fix: 精修总览页品牌、额度说明和色阶

- 开发原因：继续按用户对 `dev50` 截图的反馈精修总览页；左侧品牌图标和标题仍有轻微错位，额度卡底部说明占用额外行高，时间视角需要更明确的一行容器，整体字体颜色和状态色阶还需更贴近设计稿。
- 实现方式：先更新 UI Contract、组件映射、设计 token 文档、设计到产品流程、分区审计和视觉测量，明确本轮细节约束；随后将图标资产抽到 `src/renderer/icons.tsx`，调整品牌图标基线、顶栏 `topbar-mode-switch`、额度证据行和颜色 token；同步增强 `verify:overview` 对图标模块与当前结构的检查。
- 当前结果：品牌区图标与标题顶线更接近；额度卡不再渲染独立底部说明行，观测证据并入 `Top 3 模型占比` 标题行；时间视角由单一 inline 容器承载；文字色阶、主蓝、状态色和左侧激活底色进一步收敛。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev51` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.50 test: 补齐总览页自然/计费双状态截图

- 开发原因：继续补强“按设计稿对照”和“额度数据正确”的证据链；此前 `capture:overview` 只生成默认自然时间截图，无法证明计费时间状态在真实 Electron 中可达，也无法覆盖计费月未观测状态、计费项目周期切换等 UI 回归。
- 实现方式：主进程截图入口新增 `CODEX_COMPANION_OVERVIEW_MODE=billing` 支持，渲染层从 hash 查询参数读取初始 `overviewMode`；`capture:overview` 改为生成自然时间与计费时间各 `1360 x 900`、`1080 x 720` 的四张截图；`verify:overview` 要求四张当前版本截图均存在，并检查截图入口相关实现标记；同步更新 UI Contract、设计流程、分区审计、视觉测量和目标审计。
- 当前结果：页面级验收不再只证明自然时间默认态，计费时间真实页面也纳入截图证据；普通用户默认进入自然时间不变。本轮不改变统计口径、额度计算、默认页面状态或用户手动切换行为。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev50` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.49 fix: 修正顶部四卡逐卡状态

- 开发原因：继续复核自然时间 / 计费时间切换的数据状态；计费时间下 `billingMonth` 尚未稳定观测时，`本月 Token` 主值会显示 `未观测`，但顶部四卡状态仍统一沿用全局 `sourceHealth.sourceStatus`，可能错误显示 `已观测`。
- 实现方式：先更新 UI Contract、组件映射、分区审计和视觉测量，明确顶部四卡状态必须跟随单卡数据可观测性；随后为 `OverviewMetricCardData` 增加 `sourceStatus`，让 `MetricCard` 使用 `card.sourceStatus` 渲染；当 `billingMonth` 缺失时将计费时间下 `本月 Token` 状态设为 `unobserved`；同步增强 `verify:overview` 静态检查。
- 当前结果：计费时间下未观测的计费月指标不会再显示全局 `已观测`，避免状态和主值互相矛盾；默认自然时间截图布局不变。本轮不改变 Token、额度、成本、Git 聚合、卡片字段或项目概览。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev49` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.48 fix: 修正总览页顶栏时间视角位置

- 开发原因：继续按设计稿分区对照总览页；`dev47` 中 `时间视角 / 自然时间 / 计费时间` 虽然保持单行，但因顶栏使用 `space-between`，控件被推到右侧操作区附近，不符合设计稿“左侧页面识别 / 中部页面控制 / 右侧数据操作”的壳层结构。
- 实现方式：先更新 UI Contract、组件映射、分区审计和视觉测量，明确时间视角应处于顶栏中部；随后将 `.topbar` 改为左侧标题组固定/可收缩宽度、时间视角紧随标题组、右侧操作区 `margin-left: auto` 贴右；同步提升版本号和目标审计截图引用。
- 当前结果：顶部时间视角从右侧操作区旁边回到顶栏中部，仍保持无边框单行文本切换；右侧状态、刷新和快照继续贴右且快照只出现一次。本轮不改变顶部四卡、额度卡、项目概览、设计 token 或任何数据口径。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev48` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.47 fix: 收敛总览页视觉细节

- 开发原因：继续按设计稿对照总览页；当前页面整体方向已接近，但左侧品牌图标与标题存在轻微基线错位，额度卡底部说明重复具体额度窗口名称，顶栏时间视角需要更强单行保护，颜色和文字色阶仍比设计稿偏重。
- 实现方式：先更新 `docs/ui-contract/overview-v0.1.md`、设计 token 文档、设计流程和分区审计，明确品牌基线、额度短句、时间视角 inline-flex 和新色阶；随后调整 `design-tokens.ts`、`styles.css`、品牌 SVG 色值和 `dashboardCollector` 额度注记；同步更新 token 校验和版本号。
- 当前结果：左侧品牌块更接近设计稿顶线对齐；额度注记统一为 `圆环=最近余量；右侧=当前周期累计。`；时间视角保持单行文本切换；整体配色从偏蓝白浮层收敛为更克制的浅蓝白、石墨文字和轻描边。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev47` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.46 test: 增强总览页目标不变量验收

- 开发原因：继续推进“认真对照并争取全部改完”的目标；现有 `verify:overview` 已检查截图和基础文档，但对挂件隐藏、真实 `rate_limits` 采集、连续 token 增量、额度周期证据和近期 UI 细节仍是间接证据，后续容易回退。
- 实现方式：扩展 `scripts/verify-overview-readiness.mjs`，将 `src/main/index.ts`、`codexCollector.ts`、`dashboardCollector.ts`、`docs/data-contract-v0.2.md` 纳入检查，断言 `WIDGET_DISABLED`、`rate_limits`、`total_token_usage`、`quotaEvidence`、`estimatedValueBasisUsedPercent`、`formatQuotaPeriodRange` 和 `tok` 等关键标记；同时增强主进程截图钩子，在 `capturePage()` 触发 `UnknownVizError` 时通过短延迟进行内部重试；同步更新设计流程、分区审计、比例测量、目标审计和版本号。
- 当前结果：页面级验收从“交付物齐套”增强为“交付物齐套 + 原目标关键不变量未回退”；本轮不修改 UI、采集逻辑、额度算法或图标实现。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev46` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.45 docs: 刷新总览页目标审计运行态证据

- 开发原因：继续推进“额度数据接入真实数据”和“认真对照并争取全部改完”的目标；目标完成度审计中的 5H / 周额度运行态摘要仍停留在旧快照，与当前 `snapshot.json` 和 `npm run verify:quota` 输出不一致。
- 实现方式：只读取当前运行态聚合字段，刷新目标审计中的额度周期、Token、API 等价成本、代码行数、会话数、观测证据、圆环余量、价值折算和 sourceHealth 摘要；同步更新分区审计、比例测量和版本号。
- 当前结果：目标审计证据与当前运行态快照保持一致；本轮不改变 UI、额度计算、Token 增量、Git 聚合或图标资产。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev45` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.44 fix: 优化额度周期范围文案

- 开发原因：继续按区块对照总览页设计稿；当前周额度窗口的周期文案会显示成 `周期 09:02 - 09:02`，真实周期边界正确，但前端文案容易被误解为零长度周期。
- 实现方式：更新 UI Contract、组件映射、分区审计、比例测量和目标审计，明确额度周期范围按跨度自适应显示；新增 `formatQuotaPeriodRange`，同日短周期显示 `HH:mm - HH:mm`，跨日短周期显示 `MM/DD HH:mm - MM/DD HH:mm`，周额度等多日周期显示 `MM/DD - MM/DD`；同步提升版本号。
- 当前结果：额度卡保留重置时间和周期范围同一行展示，周额度不再显示两个相同时间点；不改变额度周期计算、Token、成本、代码行数、会话数、圆环余量、观测证据或模型占比。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev44` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.43 fix: 补齐额度 Token 明细单位

- 开发原因：继续按区块对照总览页设计稿；中部额度卡右侧 `Token 用量` 在设计稿中带 `tok` 后缀，当前实现只显示紧凑数字，扫读时不如设计稿明确。
- 实现方式：先更新 UI Contract 和分区审计，明确 `tok` 后缀只用于额度卡右侧 `Token 用量` 明细；随后调整 `QuotaWindowCard` 的 Token 明细值，保留既有 `万 / 亿` 自动单位；同步修正截图自动化，截图模式下禁用硬件加速，主进程捕获失败时非零退出，`capture:overview` 删除旧截图后重试并验证输出非空；同步更新比例测量、目标审计和版本号。
- 当前结果：额度卡右侧 Token 明细更接近设计稿表达；顶部四卡、项目概览表、模型占比、Token 计算、成本折算、额度周期和 Git 统计均不改变。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev43` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.42 fix: 修正顶部四卡新增说明

- 开发原因：继续按区块对照总览页设计稿；当前截图中 `今日代码改动` 在上一周期为 `0`、当前有代码改动时显示 `数据待补齐`，这不是数据缺失，而是百分比分母为 `0`，会误导用户以为 Git 数据未接入。
- 实现方式：更新 UI Contract、分区审计、比例测量和目标审计，明确上一周期为 `0` 且当前大于 `0` 时显示 `较上一周期 新增`；调整 `describeDelta` 和正向色彩判定，让 `新增` 使用正向变化样式；修正真实 Electron 截图钩子，确保 `capturePage()` 偶发失败时也会退出，并给 `capture:overview` 增加单视口超时；同步提升版本号。
- 当前结果：顶部四卡可以区分真实缺数据与新增场景；不伪造 `+100%` 或无限百分比，不改变 Token、代码改动、额度数据或项目聚合口径。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev42` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.41 test: 绑定总览页当前版本截图

- 开发原因：继续推进“认真对照设计稿并争取全部改完”的目标；上一轮 `verify:overview` 已提供页面级验收入口，但仍静态依赖 `dev36` 真实截图，不能证明当前开发版本的视觉证据仍然新鲜。
- 实现方式：新增 `scripts/capture-overview-screenshots.mjs` 和 `npm run capture:overview`，按当前 `package.json` 版本生成 `1360 x 900` 与 `1080 x 720` 总览页真实 Electron 截图；更新 `verify:overview`，从当前版本推导截图后缀并要求对应截图、审计文档和目标审计同步引用；同步更新设计流程、分区审计、比例测量、目标审计和版本号。
- 当前结果：总览页页面级验收不再沿用历史截图；后续版本号提升后，如果没有重新生成当前版本截图，`npm run verify:overview` 会失败。本轮不修改 UI、额度数据、项目聚合或设计 token。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview`；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.40 test: 增加总览页级验收命令

- 开发原因：继续推进“认真对照并争取全部改完”的目标；现有 `verify:design`、`verify:quota`、真实截图和分区审计证据分散，缺少一条总览页级命令确认设计图、文档、截图、图标组件、token 和额度真实数据证据齐套。
- 实现方式：新增 `scripts/verify-overview-readiness.mjs` 和 `npm run verify:overview`；脚本检查总览页交付文件、关键文档内容、实现标记、最新截图，并串联执行 `verify-design-tokens` 与 `verify-quota-snapshot`；同步更新设计到产品流程、目标完成度审计和版本号。
- 当前结果：总览页具备页面级可执行验收入口；本轮不修改 UI、数据采集、额度计算或项目聚合逻辑。
- 验证方式：执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.39 test: 增加设计 token 校验

- 开发原因：继续推进“按流程从设计图过渡到实际产品”的目标；虽然运行时已有 `src/renderer/design-tokens.ts`，但缺少正式 token 文档和可执行校验，后续配色、圆角和核心间距容易在页面迭代中漂移。
- 实现方式：新增 `scripts/verify-design-tokens.mjs` 和 `npm run verify:design`，校验 `styles.css` 中全局 token 引用都已在 `design-tokens.ts` 定义，并锁定关键色阶、圆角和间距；新增 `docs/design-tokens-v0.1.md`，同步更新设计流程、组件映射和目标完成度审计。
- 当前结果：总览页设计 token 从“运行时已有”补齐为“文档化 + 可执行校验”的正式交付物；组件局部变量如 `--quota-progress` 明确不纳入全局 token。
- 验证方式：执行 `npm run verify:design`，确认全局 token 引用和关键视觉变量通过；执行 `npm run verify:quota`；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.38 docs: 刷新总览页目标审计证据

- 开发原因：继续推进“认真对照并争取全部改完”的目标；目标完成度审计虽然已引用 `verify:quota`，但截图和部分运行态摘要仍停留在 `dev25/dev28`，与当前实现证据不一致。
- 实现方式：更新 `docs/goal-audit/overview-goal-completion-audit-v0.1.md`，将实现截图改为 `dev36` 最新 UI 截图，并用当前运行态快照刷新 5H / 周额度周期、Token、观测证据和周额度价值折算摘要；同步提升开发版本号。
- 当前结果：目标审计中的设计证据、额度证据和验证记录与当前实现保持一致；本轮不修改 UI、数据采集、额度计算或项目聚合逻辑。
- 验证方式：执行 `npm run verify:quota`，确认额度快照校验通过；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.37 test: 增加额度快照校验命令

- 开发原因：继续推进“额度数据接入真实数据”的目标；现有额度审计已证明当前实现参考 `dev-ledger` 接入了真实 `rate_limits` 和周期 token 增量，但缺少可重复执行的本地校验命令，后续容易只靠人工读快照判断是否回退。
- 实现方式：新增 `scripts/verify-quota-snapshot.mjs`，提供 `npm run verify:quota`；脚本默认读取运行态 `snapshot.json`，只校验聚合字段，不读取或输出原始会话正文；同步更新数据契约、额度审计和目标完成度审计。
- 当前结果：可以自动断言 5H / 周额度窗口来源、窗口长度、圆环余量、周期边界、`quotaEvidence` 观测证据和价值折算分母，防止额度数据回退到静态或错误口径。
- 验证方式：执行 `npm run verify:quota`，确认 5H / 周额度窗口、周期边界、观测证据和价值折算分母通过；执行 `npm run build`；本轮未修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.36 fix: 对齐项目概览默认周期

- 开发原因：继续对照 `v0.3.3` 自然时间总览页设计稿与 `dev35` 截图，设计稿中项目概览二级周期默认高亮 `周`，当前实现首次进入总览页默认高亮 `日`，导致首屏项目概览更偏当天明细而不是周期概览。
- 实现方式：更新 UI Contract、组件映射和区块审计，明确自然时间默认 `周`、计费时间默认 `周额度`；将 `OverviewPage` 的项目概览默认周期状态从 `day / fiveHour` 改为 `week / weekLimit`。
- 当前结果：项目概览首次进入时更接近设计稿默认高亮和概览口径；未改变项目数据聚合、排序、字段、表格结构或项目保留规则。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev36.png` 与 `local_dev_work/overview-1080x720-dev36.png`，确认自然时间下项目概览默认高亮 `周` 且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.35 fix: 顶栏状态胶囊改为文字-only

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev34` 截图，设计稿右上角状态胶囊只显示 `已观测` 文本，当前实现额外显示状态图标，视觉上更像操作按钮且宽度偏大。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确顶栏状态胶囊文字-only；移除顶栏状态胶囊中的图标渲染，但保留 `status` 图标资产供后续其他场景使用。
- 当前结果：顶部工具栏状态胶囊更接近设计稿；未改变状态枚举、状态文案、刷新按钮、快照时间或数据源判断。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev35.png` 与 `local_dev_work/overview-1080x720-dev35.png`，确认顶栏状态胶囊文字化且时间视角仍单行；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.34 fix: 将总览页数据来源归入项目概览卡

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev33` 截图，设计稿中的数据来源说明和 `session / archived / 仓库` chips 归属于项目概览卡底部，当前实现放在项目卡外，视觉归属弱于设计稿。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确总览页页脚数据来源归入项目概览卡底部；抽出 `FooterNote` 组件复用同一份 `snapshot.sourceHealth` 与 `snapshot.pricingMeta`，总览页在项目卡内部渲染，账本页和代码仓库页继续在页面底部复用。
- 当前结果：总览页底部可信度信息更接近设计稿的卡片归属；未改变 session / archived / 仓库数量、定价来源文案、项目表数据或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev34.png` 与 `local_dev_work/overview-1080x720-dev34.png`，确认总览页页脚已归入项目概览卡且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.33 fix: 补齐项目概览表格列线

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev32` 截图，项目概览表格缺少设计稿中的轻量纵向列线，列边界主要依赖空白，账本感和扫读性弱于设计稿。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确项目概览表格保留浅色横向和纵向网格线；仅在 `.project-card` 内为项目概览表格追加弱纵向列线，避免影响会话表或其他页面表格。
- 当前结果：项目概览区更接近设计稿的账本表格结构；未改变项目数据、排序、滚动、项目图标或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev33.png` 与 `local_dev_work/overview-1080x720-dev33.png`，确认项目表格列线生效且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.32 fix: 左侧导航收敛为单行结构

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev31` 截图，发现左侧导航仍显示二级说明文案，视觉密度高于设计稿，也让导航区承担了不必要的信息摘要职责。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确左侧导航只显示图标和主标签；移除 `NAV_ITEMS.detail` 与设置入口二级说明，并将导航主标签调整为单行居中显示。
- 当前结果：`总览 / Codex 账本 / 代码仓库 / 设置` 更接近设计稿的单行导航结构；未改变路由、页面标题、副标题、图标资产或任何数据口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev32.png` 与 `local_dev_work/overview-1080x720-dev32.png`，确认左侧导航单行化生效且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.31 fix: 修正额度价值折算分母

- 开发原因：继续对照 `dev-ledger` 的额度口径时发现，`v0.2.2-dev.30` 快照中周额度最近一次原始 `used_percent` 为 `1%`，但当前周额度周期累计 `quotaEvidence.usedPercent` 为 `28%`；旧的套餐价值折算使用最近一次百分比作为分母，会把 `$897.86` API 等价成本放大为约 `$89786.35`，不符合周期累计口径。
- 实现方式：更新数据契约、UI Contract 和额度审计文档，明确圆环余量继续使用最近一次 `rate_limits`，但价值折算必须使用当前周期累计已用百分比；`PeriodMetric.quotaEvidence` 补充 `resetEvents / usageSegments`，`LimitWindow` 增加 `estimatedValueBasisUsedPercent`，并让 `estimatedFullValueUsd / estimatedRemainingValueUsd` 优先使用周期证据分母。
- 当前结果：额度卡可见 UI 不增加复杂字段，仍保持圆环=最近余量、右侧=当前周期累计；数据层和挂件摘要中的套餐价值折算不再混用最近一次百分比。
- 验证方式：执行 `npm run typecheck` 与 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev31.png` 与 `local_dev_work/overview-1080x720-dev31.png`；读取运行态 `snapshot.json` 聚合摘要，确认周额度 `usedPercent=1%` 继续用于圆环、`estimatedValueBasisUsedPercent=28%` 用于价值折算，`estimatedFullValueUsd` 从错误量级收敛到约 `$3310.09`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.30 fix: 微调顶部四卡内部视觉权重

- 开发原因：`v0.2.2-dev.29` 已确认顶部四卡高度不应继续整体拉高，下一步应进入卡片内部标注；当前图标、标题和主数字视觉权重仍可更接近设计稿。
- 实现方式：更新视觉比例测量、UI Contract、组件映射和分区审计，明确本轮只做四卡内部视觉权重微调；将指标图标块从 `42px` 调到 `44px`，SVG 从 `24px` 调到 `25px`，标题权重提升到 `700`，主数字字号从 `30px` 提升到 `31px`。
- 当前结果：顶部四卡内部视觉锚点更强，仍不改变四卡字段、单位、状态标签、时间视角或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev30.png` 与 `local_dev_work/overview-1080x720-dev30.png`，确认顶部四卡内部微调未引入换行或页面级溢出；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.29 docs: 复测顶部四卡精修效果

- 开发原因：`v0.2.2-dev.28` 已实现顶部四卡舒展度修正，但视觉比例测量文档仍以 `dev25` 为主要当前实现基线，需要补齐 `dev28` 截图后的实际比例复测，避免后续继续盲目拉高四卡。
- 实现方式：更新 `docs/design-review/overview-visual-measurement-v0.1.md`，补充 `dev28` 的区块比例复测；同步更新分区审计和目标完成度审计，明确顶部四卡已从约 `14.6%` 提升到约 `15.3%`，下一步若继续精修应进入卡片内部标注而不是继续增高区块；提升开发版本号。
- 当前结果：总览页视觉测量闭环更完整，后续精修边界更清晰；本轮不修改运行代码。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.28 fix: 增加顶部四卡舒展度

- 开发原因：根据 `v0.2.2-dev.27` 的视觉比例测量，当前顶部四卡高度约 `14.6%`，低于设计稿约 `16.0%`，状态标签与主数字区域的间隔仍偏紧，需要做局部精修。
- 实现方式：先更新 UI Contract、分区审计、比例测量和组件映射，明确本轮只调整 `MetricCard` 自身，不全局拉大间距；随后将指标卡改为内容区与底部状态区两行布局，增加最小高度、内部行距和状态标签底部对齐。
- 当前结果：顶部四卡更接近设计稿的舒展比例，状态标签与主数字 / 变化说明之间留白更明确；四卡字段、数据口径、图标体系和额度真实数据逻辑均未改变。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev28.png` 与 `local_dev_work/overview-1080x720-dev28.png`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.27 docs: 增加总览页视觉比例测量

- 开发原因：继续推进“按区块对照设计稿”的目标，上一轮完成度审计仍偏结论化，缺少设计稿和当前截图之间的可量化比例依据，后续容易再次回到主观判断。
- 实现方式：新增 `docs/design-review/overview-visual-measurement-v0.1.md`，记录设计稿、`1360 x 900` 和 `1080 x 720` 实现截图的尺寸、主要区块比例、当前达标项和后续可精修项；同步在分区审计和目标完成度审计中引用该测量入口；提升开发版本号。
- 当前结果：总览页从“分区审计”进一步补齐为“分区审计 + 比例测量”，明确当前左侧边栏、顶部工具栏、额度卡和小窗口完整性接近设计稿，后续若继续精修应优先处理顶部四卡高度和内部留白。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.26 docs: 增加总览页目标完成度审计

- 开发原因：继续推进总览页设计稿落地目标，需要按原始目标逐项核对当前证据，避免只凭“已做很多轮修改”判断完成；同时分区审计和数据契约的版本标头仍停留在旧实现，容易误导后续接手。
- 实现方式：新增 `docs/goal-audit/overview-goal-completion-audit-v0.1.md`，按分区设计对照、文档先行流程、图标资产、真实额度数据、`dev-ledger` 参考和可交付状态逐项列出证据；同步更新分区审计实现基准、数据契约版本和审计入口；提升开发版本号。
- 当前结果：总览页当前状态被明确记录为“达到文档化产品设计目标，可进入用户图审确认；不声明像素级完全一致”。本轮不修改运行逻辑。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.25 fix: 收敛总览页品牌对齐、额度卡行高和色阶

- 开发原因：继续根据总览页设计稿和用户反馈修正细节，当前左侧品牌图标与标题仍有轻微错位，额度卡周期范围单独占行导致高度偏大，时间视角需要更强单行约束，整体文字色阶与设计稿仍有差距。
- 实现方式：先更新 UI Contract、组件映射和分区审计，明确品牌文字基线补偿、额度周期与重置时间合并展示、顶部时间视角桌面单行和颜色 token 层级；随后调整 `BrandMark` 所在品牌组样式、`QuotaWindowCard` 周期文案结构、顶部工具栏 nowrap 约束、设计 token、卡片阴影、文字色阶和顶部四卡数字字体。
- 当前结果：总览页在不改变真实额度、Token、项目概览和定价口径的前提下，左侧品牌组更接近设计稿，额度卡不再因周期范围额外多占一行，时间视角在桌面宽度保持单行，正文 / 辅助 / 弱辅助文字层级更清晰。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev25.png` 与 `local_dev_work/overview-1080x720-dev25.png`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.24 docs: 增加总览页 Token 与额度数据审计

- 开发原因：继续复核总览页真实额度数据时，发现顶部自然日 Token 与当前 5H 额度窗口 Token 差距较大，需要确认是否存在“今日首个 `total_token_usage` 累计快照被误计为今日增量”的风险。
- 实现方式：新增 `docs/data-audit/overview-token-quota-audit-v0.1.md`，只读取 `token_count` 数值字段和时间戳进行聚合审计，不输出原始会话正文、用户输入、模型回复或路径明细；对比错误的窗口内差值方法和当前完整 session 连续差值方法；同步更新数据契约和分区审计入口。
- 当前结果：审计确认当前实现没有把今日首个 `total_token_usage` 累计快照直接计为自然日增量；自然日 Token 与 5H Token 的差异主要来自自然时间周期和当前额度周期不同，本轮不修改运行代码。
- 验证方式：执行只读 Node 聚合审计脚本；执行 `npm run build` 验证文档与版本号更新后工程仍可构建；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.23 fix: 展示额度周期起止时间

- 开发原因：继续复核真实额度数据时，发现顶部自然日 Token 与当前 5H 额度窗口 Token 差距较大；代码已按 `total_token_usage` 差值计算增量，差异主要来自自然日统计与当前额度窗口起止不同。如果总览页不展示额度周期范围，用户容易误判为额度数据错误。
- 实现方式：更新 UI Contract、数据契约、组件映射和分区审计，明确额度卡圆环下方展示当前额度周期起止；`QuotaWindowCard` 使用 `period.startAt / period.endAt` 渲染 `周期 HH:mm - HH:mm`，不改变 token 增量、额度余量、重置识别和周期聚合逻辑。
- 当前结果：5H / 周额度卡在重置时间下方展示当前周期范围，能够解释右侧周期累计 Token 与顶部自然时间累计 Token 的口径差异；底部注记仍保持短句化。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev23.png` 与 `local_dev_work/overview-1080x720-dev23.png`；读取运行态 `snapshot.json` 确认 `fiveHour.startAt/endAt` 与 `weekLimit.startAt/endAt` 已用于界面展示。

## [2026-06-04] v0.2.2-dev.22 fix: 调整项目概览标题区层级

- 开发原因：继续按设计稿分区对照总览页，发现底部项目概览区的 `日 / 周 / 月` 二级周期切换被放在右上角并与排序按钮堆叠；设计稿中周期切换应紧跟 `项目概览` 标题，排序按钮才位于右侧操作区。
- 实现方式：更新 UI Contract、组件映射和分区审计，明确项目概览标题组为 `项目概览 + 二级周期切换`，排序切换独立靠右；调整 `OverviewPage` 结构，将周期 `TextTabs` 移入标题组，将排序 `TextTabs` 保留在右侧；补充标题组和右侧工具区样式。
- 当前结果：项目概览区层级更接近设计稿，左侧显示 `项目概览 日/周/月`，右侧只显示排序按钮；不改变项目表数据口径、排序逻辑和滚动容器。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev22.png` 与 `local_dev_work/overview-1080x720-dev22.png`，确认项目概览标题区在两种窗口下均稳定显示且页面无溢出。

## [2026-06-04] v0.2.2-dev.21 fix: 收敛左侧导航图标体系

- 开发原因：继续按设计稿分区对照总览页，`v0.2.2-dev.20` 的左侧导航仍存在图标语义和视觉容器差异：总览使用网格图标，代码仓库使用立方体图标，且导航图标额外套了白色胶囊，和设计稿的简洁左栏不一致。
- 实现方式：更新 UI Contract、组件映射和分区审计，明确左侧导航固定使用 `首页 / 文档账本 / 代码方块 / 齿轮` 四类本项目自定义内联 SVG；将 `overview` 改为首页图标，`ledger` 改为账本文档图标，`repo` 改为代码方块图标；移除导航图标自身的白色胶囊背景，保留整行浅蓝底作为当前页激活态。
- 当前结果：左侧导航图标语义更贴近设计稿，当前页激活态更轻，仍不使用官方或第三方品牌图标；总览页其他数据口径和额度逻辑未改变。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev21.png` 与 `local_dev_work/overview-1080x720-dev21.png`，确认左侧导航图标、设置入口和整体页面在两种窗口下均稳定显示。

## [2026-06-04] v0.2.2-dev.20 fix: 修正额度圆环口径并补充项目图标

- 开发原因：继续按设计稿分区审计总览页，发现额度卡中心显示 `剩余量`，但圆环弧线仍使用已用百分比，导致 `99% / 100% 剩余` 时视觉上只显示极小一段进度；同时项目概览缺少设计稿中的项目小图标，扫读性不足。
- 实现方式：更新 UI Contract、组件映射、数据契约和分区审计，明确额度圆环中心和弧线都表达最近余量；将 `QuotaWindowCard` 的圆环进度改为 `remainingPercent`，并为 5H / 周额度分别使用蓝色 / 绿色强调；将 Token 图标改为数据栈形态，代码指标图标改为绿色强调；项目列新增按项目名稳定映射颜色的自定义小图标。
- 当前结果：额度圆环不再与中心剩余百分比反向表达；周额度窗口与设计稿一样使用绿色区分；项目概览表具备项目图标和项目名组合，且仍保留全部本地项目。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev20.png` 与 `local_dev_work/overview-1080x720-dev20.png`；读取运行态 `snapshot.json` 摘要确认 `fiveHourRemaining=100 / fiveHourUsed=0`、`weekRemaining=99 / weekUsed=1`、`repoCount=5`、`dayRows=5`、`fiveHourRows=5`。

## [2026-06-04] v0.2.2-dev.19 fix: 收敛总览页视觉细节并保留全部项目

- 开发原因：继续按设计稿和用户反馈复核总览页，发现左侧品牌区图标与标题视觉间距仍不够贴近设计稿，额度卡底部证据文案比契约多写 `额度观测`，时间视角需要强制保持单行，项目表表头和文字层级也仍有细节偏差；同时 `v0.2.2-dev.18` 项目概览只显示当前有活动项目，不符合可滚动查看所有项目的口径。
- 实现方式：更新 UI Contract、组件映射、数据契约和分区审计，补充组件级配色、品牌对齐、单行时间切换、额度卡底部单行证据和项目概览保留全部项目规则；移除 `buildProjectOverviewPeriod` 对无活动项目的过滤；调整品牌区间距和字号、浅色 token、卡片阴影、顶部时间切换 nowrap、额度证据文案、项目表表头大小写和表格文字层级。
- 当前结果：总览页品牌组更接近设计稿，`时间视角 / 自然时间 / 计费时间` 保持单行，额度卡底部显示 `观测 N 次 · 重置 N 次` 且未额外占高，项目表头恢复 `Token` 等正常大小写；自然日和 5H 项目概览均保留全部 5 个本地项目，无活动项目显示 0 / `--`。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev19-ui.png` 与 `local_dev_work/overview-1080x720-dev19-ui.png`；读取运行态 `snapshot.json` 聚合摘要确认 `repoCount=5`、`dayRows=5`、`fiveHourRows=5`。

## [2026-06-04] v0.2.2-dev.18 fix: 收敛额度卡底部说明文案

- 开发原因：`v0.2.2-dev.17` 已将额度观测次数和重置次数展示到总览页，但额度卡底部口径说明仍直接暴露 `rate_limits` 字段名，偏技术化且与设计稿中短句注记风格不一致。
- 实现方式：更新 UI Contract、数据契约、组件映射和分区审计文档，明确总览页额度注记只使用短句，不展开原始字段名和计算公式；将 5H / 周额度卡底部说明分别收敛为 `圆环=最近余量；右侧=当前 5H 周期累计。` 与 `圆环=最近余量；右侧=当前周额度周期累计。`，保留 `额度观测 N 次 · 重置 N 次` 证据展示。
- 当前结果：额度卡底部说明更适合总览页快速阅读，同时仍保留真实额度数据的观测依据；额度计算、圆环余量和右侧周期累计口径均未改变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev18.png` 与 `local_dev_work/overview-1080x720-dev18.png`，确认短句注记和观测证据均可见且页面无溢出。

## [2026-06-04] v0.2.2-dev.17 fix: 展示额度周期观测证据

- 开发原因：继续复核额度卡真实数据口径时，确认本项目已经参考 `dev-ledger` 实现了 `rate_limits` 周期边界、重置识别和累计高水位逻辑，但前端额度卡没有展示观测点和重置次数，用户难以判断额度数据为什么可信。
- 实现方式：扩展 `PeriodMetric`，新增 `quotaEvidence` 字段，透出当前额度周期的 `usedPercent / remainingPercent / maxObservedUsedPercent / lastObservedAt / resetCount / observations`；`buildQuotaCyclePeriodMetric` 将已有 `QuotaCycleMetric` 证据写入共享快照；`QuotaWindowCard` 底部注记新增 `额度观测 N 次 · 重置 N 次`；同步更新数据契约、UI Contract、组件映射和分区审计文档。
- 当前结果：5H 与周额度卡继续使用最近 `rate_limits` 余量作为圆环中心，右侧继续使用当前额度周期累计 Token、成本、代码和会话；底部新增观测次数与重置次数，增强额度数据可信度解释。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev17.png` 与 `local_dev_work/overview-1080x720-dev17.png`，确认新增证据不造成溢出；读取运行态 `snapshot.json` 确认 `fiveHour/weekLimit.quotaEvidence` 已写入观测次数和重置次数。

## [2026-06-04] v0.2.2-dev.16 fix: 收敛左侧品牌标识尺寸与形态

- 开发原因：继续按设计稿分区对照总览页，`v0.2.2-dev.15` 的左侧品牌图标仍带圆角容器和较多内部留白，视觉尺寸明显小于设计稿中的蓝色几何标识，导致品牌区和设计稿仍有差距。
- 实现方式：更新分区审计、UI Contract 和组件映射，明确品牌图标必须是本项目非官方自定义资产，不使用 OpenAI / Codex 官方 logo；将 `BrandMark` 改为更大的蓝色几何 C 形内联 SVG；调整品牌区图标占位从 `52px` 到 `64px`，移除图标外层圆角容器视觉。
- 当前结果：左侧品牌区的图标尺寸、标题起点和整体视觉重心更接近设计稿；导航项、设置入口、挂件隐藏策略和额度真实数据逻辑均未改变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev16.png` 与 `local_dev_work/overview-1080x720-dev16.png`，确认品牌区未错位且两种视口均完整显示。

## [2026-06-04] v0.2.2-dev.15 fix: 增加总览页尺寸标注并修正项目区标题

- 开发原因：继续推进总览页与 `v0.3.3` 设计稿的分区对照，`v0.2.2-dev.14` 已解决壳层和顶部工具栏问题，但仍缺少区块尺寸标注基线；同时项目区主标题仍使用“当前周期内的项目消耗与工程活动”，不符合用户确认的“直接项目概览”和设计稿标题。
- 实现方式：在分区审计文档中新增 `dev.15` 尺寸标注基线，按左侧导航、顶部工具栏、顶部四卡、额度卡、项目概览和页脚记录设计稿与实现截图的比例差异；更新 UI Contract 与组件映射，明确项目区主标题只使用 `项目概览`，顶部四卡不得过度压缩；渲染层移除项目区“项目消耗”主标题，样式层轻微增加顶部四卡最小高度和区块间距；同步更新版本号。
- 当前结果：总览页项目区标题与设计稿和用户口径一致；顶部四卡留白更接近设计稿；尺寸对照从主观截图观察升级为可继续迭代的区块比例记录。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev15.png` 与 `local_dev_work/overview-1080x720-dev15.png`，确认两种视口均完整显示且没有页面级溢出。
- 遗留问题：额度卡高度受真实模型名、Token 数量和本地数据状态影响，当前不通过假数据或硬压内容凑齐设计稿；若继续精修，应基于真实数据样本继续标注额度卡内部行高和模型条布局。

## [2026-06-04] v0.2.2-dev.14 fix: 收敛总览页壳层结构与卡片视觉

- 开发原因：继续对照 `v0.3.3` 总览页设计稿，发现 `v0.2.2-dev.13` 仍存在顶部工具栏层级过高、额外 `桌面总控台` 眉标、右侧工作区外层浮层感过强、卡片渐变和阴影偏重等结构性差异。
- 实现方式：更新总览页分区审计、UI Contract 和组件映射，明确顶部标题与副标题横向组合、禁止额外眉标、右侧主工作区外层不做强浮层；渲染层移除顶部眉标；样式层去掉应用外边距和左右间隔，弱化主工作区、顶部四卡、额度卡和项目概览的渐变、圆角与阴影；同步调整设计 token 与版本号。
- 当前结果：总览页顶部工具栏高度更接近设计稿，右侧内容区更像白底工作区而不是独立大卡片，顶部四卡和中部额度卡的底色、描边和阴影更贴近确认设计图；真实额度周期数据逻辑保持不变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev14.png` 与 `local_dev_work/overview-1080x720-dev14.png`，确认两种视口均完整显示且没有页面级溢出。
- 遗留问题：当前真实数据只命中一个项目时，项目概览表比设计稿更空，这是数据状态差异；若继续追求像素级一致，需要进入区块尺寸标注阶段。

## [2026-06-04] v0.2.2-dev.13 fix: 精修总览页区块布局与数据来源展示

- 开发原因：继续按设计稿分区对照总览页，发现顶部四张指标卡仍偏离设计图的左图标、右内容、底部状态结构；额度卡数据行缺少对应小图标；页脚缺少清晰的数据来源与扫描范围提示，影响后续从设计图稳定过渡到产品实现。
- 实现方式：更新总览页 UI Contract、组件映射和分区审计文档，明确顶部指标卡不得重复周期标签，统一为大图标左置、标题数值右置、状态标签底置；为额度卡右侧 `Token / 成本 / 代码 / 会话` 四项补充小图标；补充页脚数据来源文案和 `session / archived / 仓库` 扫描计数胶囊；同步调整渲染组件、样式 token 使用和版本号。
- 当前结果：总览页顶部四卡、额度卡和页脚更接近确认设计图的区块结构；页面继续保持挂件隐藏、额度周期真实数据和小视口不溢出的既有结果。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev13.png` 与 `local_dev_work/overview-1080x720-dev13.png`，确认标准视口与较小视口均未出现页面级溢出。

## [2026-06-04] v0.2.2-dev.12 fix: 分区对照总览页并接入额度周期真实数据

- 开发原因：用户指出总览页与设计稿仍有较多细节差距，要求按页面区块逐块对照设计图，必要时补充图标资产，并修正额度卡中明显不正确的数据口径；额度真实数据参考 `dev-ledger` 项目的 Codex 采集逻辑。
- 实现方式：新增 `docs/design-review/overview-block-audit-v0.1.md`，按左侧导航、顶部工具栏、顶部四卡、额度卡和项目概览拆分设计对照；更新 UI Contract、组件映射、数据契约和设计到实现流程，明确分区审计、指标图标和额度周期口径；渲染层为顶部四卡补充自定义 SVG 指标图标，为额度卡标题补充小图标；数据层将 Codex token 增量改为优先使用同一 session 内 `total_token_usage` 累计快照差值，并保留无 token 增量的 `rate_limits` 观测点；仪表盘聚合层按 `rate_limits.resets_at + window_minutes` 构建当前 5H / 周额度周期，额度卡圆环使用最近剩余百分比，右侧 Token、成本、会话和模型占比使用当前额度周期真实增量。
- 当前结果：总览页对照方式从整页主观观察升级为分区审计；顶部四卡更接近设计稿的信息层级；额度卡不再把普通时间窗口估算误当成额度周期数据；本地快照中 `windowPeriods.fiveHour/weekLimit` 已输出真实周期边界、Token、成本、模型占比和最新剩余百分比。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用真实 Electron 截图钩子生成 `1360 x 900` 与 `1080 x 720` 截图并人工对照；读取本地 `snapshot.json` 摘要核对 5H / 周额度周期 start/end、Token、成本、剩余百分比和 Top 模型输出。

## [2026-06-04] v0.2.2-dev.11 fix: 精修总览页品牌区标题与配色细节

- 开发原因：用户反馈总览页已经接近设计，但左侧品牌区图标和标题错位，额度卡重复显示 `额度窗口` 占用一行，顶部 `时间视角` 不应拆成两行，且配色细节仍需按设计图沉淀为文档后再实现。
- 实现方式：更新 `docs/ui-contract/overview-v0.1.md`，新增总览页视觉细节约束，明确颜色、文字、阴影、品牌区、顶部时间切换和额度卡标题规则；调整 `src/renderer/design-tokens.ts` 的浅蓝白背景、主文字、辅助文字、主蓝、青色、边线和阴影 token；将左侧品牌区改为图标与 `Codex Companion` 顶线对齐，说明文字放在标题下方；移除 `QuotaWindowCard` 中重复的 `额度窗口` 辅助行；将顶部 `时间视角 / 自然时间 / 计费时间` 改为单行 flex 展示；同步更新组件映射与版本号。
- 当前结果：品牌区更接近设计图结构，额度卡标题不再多占一行，时间视角切换在同一行内，整体配色更接近设计图的深墨文字、白色卡片、浅蓝描边和轻阴影风格。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用真实 Electron 截图钩子生成 `1360 x 900` 与 `1080 x 720` 截图并人工对照，两个视口均完整显示且本轮细节点已生效。

## [2026-06-03] v0.2.2-dev.10 fix: 建立真实截图验收并修正总览页溢出

- 开发原因：用户指出挂件应继续隐藏、当前配色和设计稿仍有偏差，且总览页即使全屏也存在内容超出屏幕的问题；同时要求完善页面完善流程，让后续页面能一次性按设计落地。
- 实现方式：保留挂件禁用策略，并在主进程增加仅由环境变量触发的真实 Electron 窗口截图钩子；修正 Vite 生产构建资源路径为相对路径，避免截图和生产启动时出现空白页；将总览页样式按确认设计稿收敛为蓝白浅色、紧凑侧栏和顶部工具栏、三段式视口布局；压缩顶部四卡、中部额度卡和项目表密度；额度卡右侧保留 `Token 用量 / API 等价成本 / 代码行数 / 会话数` 四项核心数据，状态统一放到右上角徽标；项目概览改为占用剩余视口并只在表格内部滚动；同步更新 UI Contract、组件映射和设计到实现工作流，明确 `1360 x 900` 与 `1080 x 720` 真实截图不通过不得提交。
- 当前结果：挂件仍不会创建或显示；总览页在标准窗口和最小窗口下完整显示左侧导航、顶部工具栏、顶部四卡、两张额度卡、项目概览和页脚；配色和卡片密度更接近已确认设计图；后续页面已有可执行的截图验收门禁。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用 `CODEX_COMPANION_CAPTURE_PATH`、`CODEX_COMPANION_WINDOW_WIDTH`、`CODEX_COMPANION_WINDOW_HEIGHT` 生成 `1360 x 900` 与 `1080 x 720` 真实 Electron 截图并人工查看，两种视口均未出现页面级溢出。

## [2026-06-03] v0.2.2-dev.9 fix: 优化首屏加载与总览页缩放口径

- 开发原因：用户反馈每次启动都需要等待较久才加载数据，且总览页显示不全不应依赖滚轮解决；同时指出额度剩余百分比可能不对，需要认真核对数据来源。
- 实现方式：新增 `pending` 快照状态，`DashboardService.getSnapshot(false)` 优先返回内存缓存、磁盘缓存或轻量采集中快照，真实 Codex / Git 采集转为后台刷新；主进程启动阶段不再 `await loadSnapshot(true)` 阻塞启动；渲染层首屏完成后静默调用 `refreshDashboard()` 替换为 live 快照；为采集过程增加并发保护，避免重复扫描本机 Codex session 与 Git 仓库；额度解析兼容 `used_percent / usedPercent`、`window_minutes / windowDurationMins`、`resets_at / resetsAt`，并按 `剩余百分比 = 100 - used_percent` 展示；总览页应用壳层改为基于桌面基准尺寸的内部缩放，收紧项目表、额度环和模型条比例；同步更新 `overview` UI Contract 与设计交付流程中的加载、缩放和视口约束。
- 当前结果：首屏不再必须等待完整采集才能显示；后台刷新会在 live 数据准备好后替换快照；额度剩余百分比口径回到原始字段语义；总览页在标准桌面窗口下按比例缩放，而不是依赖整体页面滚动。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；用只输出字段摘要的本地脚本检查最新 rate_limits 字段位置与数值，不输出会话正文。
- 遗留问题：本轮尝试截图时系统前台被其他全屏窗口占用，截图未能捕获 Codex Companion 窗口，因此视觉对齐仍缺少可信截图基线；下一步应优先接入自动窗口截图或 Playwright/Electron 截图验证。

## [2026-06-03] v0.2.2-dev.8 fix: 收敛总览页尺寸与配色并暂时隐藏挂件

- 开发原因：用户指出挂件当前应先隐藏，且总览页配色、整体尺寸和区块间距与确认设计图不符，页面在全屏下仍出现超出屏幕范围的问题；同时要求把页面完善流程补强，减少后续返工。
- 实现方式：在 `src/main/index.ts` 中新增挂件禁用开关，停止创建挂件窗口、隐藏托盘中的挂件入口，并将显示/隐藏挂件 IPC 降级为无操作；同步下调主窗口默认尺寸与最小尺寸；在 `src/renderer/design-tokens.ts`、`src/renderer/styles.css` 和 `src/renderer/App.tsx` 中将配色切回设计图确认过的蓝白系，统一应用图标样式，压缩应用壳层、卡片和额度模块的留白，并引入 `page-viewport` 让滚动只发生在内容区内部；更新 `docs/design-to-product-workflow-v0.1.md` 与 `docs/ui-contract/overview-v0.1.md`，新增设计对照、标准视口和全屏校验规则。
- 当前结果：挂件已从当前产品流中临时隐藏；总览页的配色、图标和密度更接近确认图，主页面改为内容区内部滚动，避免整体壳层被撑出屏幕；后续页面落地必须经过设计对照与视口校验。
- 验证方式：已检查当前仓库状态并同步远端；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；执行 `git diff --check` 检查空白问题。
- 遗留问题：当前环境仍缺少页面级自动截图基线，本轮已把这项检查写进流程，但具体截图用例仍待补充。

## [2026-06-03] v0.2.2-dev.7 feat: 完成总览页首版落地与统一壳层重构

- 开发原因：在总览页设计图、规格文档和 `ui-contract` 确认后，用户要求开始第一个页面的实际落地，并达到可直接测试的水准。
- 实现方式：扩展 `DashboardSnapshot.overview` 数据契约，补充自然时间与额度窗口的对比口径、模型窗口和项目概览聚合；为 Git 采集新增 `fiveHour / weekLimit` 自定义活动窗口；新增 `src/renderer/design-tokens.ts` 统一页面 token；重写 `src/renderer/App.tsx` 与 `src/renderer/styles.css`，落地统一左侧导航、顶部工具栏、顶部四卡、中部 `5H / 周额度窗口`、底部项目概览表，并保留账本页、代码仓库页和挂件的可用状态；新增 `docs/component-map.md` 固化总览页组件映射。
- 当前结果：总览页已按当前确认口径完成首版实现，`自然时间 / 计费时间` 切换、顶部四卡、额度卡和项目概览均可运行；主页面不再暴露挂件按钮，左侧保留固定 `设置` 入口且默认关闭挂件策略继续生效。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；执行 `git diff --check` 检查空白问题。
- 遗留问题：当前环境未直接提供 Electron 视觉截图链路，因此本轮完成了构建与启动验证，但总览页页面级截图基线仍待补充。

## [2026-06-03] v0.2.2-dev.6 docs: 完善交付流程并新增总览页 UI Contract

- 开发原因：用户要求把设计交付流程完善到文档里，并开始最终确认第一个页面，避免继续停留在图片与口头解释阶段。
- 实现方式：扩充 `docs/design-to-product-workflow-v0.1.md`，补充目录约定、每页交付清单、三道确认门和当前项目建议；新增 `docs/ui-contract/overview-v0.1.md`，将总览页沉淀为可直接指导开发的最终确认稿；同步更新 `docs/page-design-spec-v0.3.md` 与 `ROADMAP.md` 的当前生效入口和推进状态。
- 当前结果：项目已有更完整的设计交付流程；总览页已进入 Gate B，也就是规格确认阶段，后续可以基于 `ui-contract` 直接进入 token、组件映射和实际开发。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.5 docs: 修正总览页规格并补充设计交付流程

- 开发原因：用户指出当前文档仍错误描述了 `自然时间 / 计费时间` 与顶部四卡的关系，并要求先把文档改正确，同时补一套能够让设计图稳定过渡到真实产品的流程方案。
- 实现方式：直接修正 `docs/page-design-spec-v0.3.md` 的当前生效范围与总览页第 2 节，明确 `自然时间 / 计费时间` 只改变统计口径，不改变顶部四卡字段；将旧设计图章节明确降为历史归档；新增 `docs/design-to-product-workflow-v0.1.md`，基于 Figma Dev Mode、Variables、Code Connect、W3C Design Tokens、Storybook 与 Playwright 的官方资料整理本项目的设计交付流程。
- 当前结果：总览页当前生效规格已与最新口径对齐；项目已有一份可直接复用的“设计图到产品实现”工作流文档，后续页面可以按同一方法进入实际开发。
- 验证方式：已检查当前仓库状态；执行 `git pull --rebase origin main` 同步远端；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.4 docs: 重出总览页自然时间与计费时间设计图

- 开发原因：用户要求恢复页级 `自然时间 / 计费时间` 视角，并进一步收敛顶部四卡、中部额度卡与底部项目表的展示方式。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，追加 `v0.3.3` 总览页覆盖规格；使用内置 `image_gen` 重出两张总览页设计图，分别对应 `自然时间` 和 `计费时间`；将图片保存到 `docs/assets/design/v0.3.3/`；文档中记录图片索引与人工观察。
- 当前结果：总览页已形成 `v0.3.3` 双状态设计稿，顶部四卡不再重复数字，中部固定为 `5H / 周额度窗口`，底部改为带滚动的 `项目概览`。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.3 docs: 根据反馈生成总览页 v0.3.2 设计图

- 开发原因：用户基于 `S1-S5` 对总览页双状态图提出反馈，要求设置放到最底部、去除快照重复、补充图标体系、时间视角去掉外框、顶部指标卡保持稳定、中部按 5H 和周期用量拆分、底部改为项目周期消耗排行。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，追加 `v0.3.2` 总览页覆盖规格；使用内置 `image_gen` 生成图标体系稿和总览页月视角稿，保存到 `docs/assets/design/v0.3.2/`；文档中记录图像索引、人工观察和图标一致性风险。
- 当前结果：总览页进入 `v0.3.2` 图像确认阶段，已具备图标体系方向稿和新版月视角总览图；日视角与周视角待月视角方向确认后再补图。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.2 docs: 生成总览页双状态设计图

- 开发原因：用户反馈文字确认效率低，建议直接出图确认；本轮按图优先方式为总览页生成可确认设计图。
- 实现方式：使用内置 `image_gen` 基于 `v0.3.1` 总览页规格生成两张状态图，分别对应 `自然时间` 和 `计费窗口`；将图片保存到 `docs/assets/design/v0.3.1/`；更新 `docs/page-design-spec-v0.3.md`，加入图片索引、当前观察和 `S1-S5` 图像确认方式。
- 当前结果：总览页已有两张可供确认的新版设计图；后续根据用户对 `S1-S5` 的反馈决定保留、重出或局部调整。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.1 docs: 修订应用壳层与总览页设计草案

- 开发原因：用户指出三张设计图的左侧边栏和顶部工具栏不一致，且总览页存在设置入口缺失、时间口径切换、额度余量、数据可信度和仓库活跃口径未明确的问题；本轮先完善第一个页面，不进入实际页面开发。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，补充全局应用壳层规范，固定左侧导航、顶部工具栏和设置入口；修订总览页结构，加入自然时间 / 计费窗口切换，明确额度只能展示剩余百分比、恢复时间和观测状态；将数据可信度从大面板降级为状态标签与底部说明，并建议右侧大面板改为模型用量分析；将仓库活跃拆分为 Codex 投入与 Git 产出两条口径。
- 当前结果：总览页进入 `v0.3.1` 设计讨论稿状态，旧总览页设计图需要按新规格重出；Codex 账本页和代码仓库页暂未二次修订。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.1-dev.1 docs: 补充页面设计规格并默认关闭挂件

- 开发原因：用户反馈当前应用视觉还不够成熟，要求先暂停实际页面开发，改为先明确各页面展示内容、布局、尺寸和位置，并生成设计图供确认；同时要求桌面挂件先默认关闭。
- 实现方式：将挂件默认配置 `visible` 改为 `false`；新增 `docs/page-design-spec-v0.3.md`，规划总览页、Codex 账本页、代码仓库页的内容结构、布局尺寸、展示方式和设计图提示词；使用 imagegen 生成三张页面设计图并保存到 `docs/assets/design/v0.3/`；更新 `ROADMAP.md`，将下一阶段调整为先确认设计图再开发页面。
- 当前结果：新用户首次启动时不再默认显示挂件；页面改造进入设计确认阶段，实际页面实现暂不推进。
- 验证方式：已检查当前仓库状态；后续执行 `npm run build` 和 `git diff --check` 验证代码与文档变更。

## [2026-06-02] v0.2.0-dev.1 feat: 完成首版可运行 Codex Companion 桌面实现

- 开发原因：用户要求按照既有规划正式进入实施阶段，从空仓库落地首版桌面应用、数据采集、三页界面和桌面挂件。
- 实现方式：建立 `Electron + React + TypeScript + Vite` 项目骨架；实现主进程窗口管理、挂件预设与本地设置持久化；实现 Codex session / `rate_limits` 解析、Git 仓库扫描与代码活动聚合；实现总览页、账本页、代码仓库页、顶部挂件与极简胶囊；补充 `README`、隐私说明、路线图、贡献指南、Issue 模板和 `docs/data-contract-v0.2.md`；同步回写规划状态。
- 当前结果：仓库已具备可构建、可启动的首版桌面应用，能够基于本机 Codex 与 Git 数据展示额度、Token、成本价值和仓库归因；项目对外文档已明确非官方定位与 local-first 隐私边界。
- 验证方式：执行 `git pull --rebase origin main`、`npm run typecheck`、`npm run lint`、`npm run build` 与 `npm start` 启动验证；运行期曾发现 Electron 入口路径错误，已修正为 `dist-electron/main/index.js` 后重新确认主窗口正常拉起。

## [2026-06-02] v0.1.0-dev.1 docs: 初始化 Codex Companion 项目规划

- 开发原因：用户已创建 `gooderno1/codex-companion` 仓库，并要求在本地 `MyCode` 目录下建立项目文件夹，参考 DevLedger 的协作规范先写项目 `AGENTS.md`，第一步先撰写项目开发规划文件。
- 实现方式：克隆远端仓库到本地 `codex-companion` 目录；新增 `AGENTS.md`，将 DevLedger 的协作规范调整为 Codex 专用桌面应用语境；新增 `docs/project-development-plan-2026-06-02.md`，明确产品定位、页面规划、挂件规划、数据架构、技术路线、隐私边界和阶段实施顺序。
- 当前结果：项目已有初始协作规范、开发记录和第一版正式规划文档，尚未进入桌面应用代码实现。
- 验证方式：已执行 `git status`、`git ls-remote`、仓库克隆、初始文件检查和 `git diff --check`；本轮尚未建立构建脚本，因此未执行构建。

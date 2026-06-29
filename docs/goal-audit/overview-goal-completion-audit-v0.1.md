# 总览页目标完成度审计（v0.1）

- 创建时间：2026-06-04
- 审计版本：`v0.2.2-dev.78`
- 审计对象：总览页设计对照、图标资产、额度真实数据和交付验证
- 设计基准：`docs/assets/design/v0.3.3/overview-natural-time.png`
- 实现截图：`local_dev_work/overview-1360x900-dev78.png`、`local_dev_work/overview-1080x720-dev78.png`、`local_dev_work/overview-billing-1360x900-dev78.png`、`local_dev_work/overview-billing-1080x720-dev78.png`
- 比例测量：`docs/design-review/overview-visual-measurement-v0.1.md`
- 设计 token：`docs/design-tokens-v0.1.md`、`src/renderer/design-tokens.ts`、`npm run verify:design`
- 运行快照：`C:\Users\85406\AppData\Roaming\codex-companion\snapshot.json`
- 额度校验：`npm run verify:quota`
- 页面级截图：`npm run capture:overview`
- 页面级验收：`npm run verify:overview`
- 参考项目：`D:\MyFile\Obisidian\LifeInHand\1. 项目\个人品牌-学习进步\CodeLib\MyCode\dev-ledger`

## 1. 审计结论

当前总览页已经完成原目标中的主要可验证要求：

- 已按左侧导航、顶部工具栏、顶部四卡、额度卡、项目概览和页脚拆分区块做设计对照。
- 已补充设计稿与实现截图的区块比例测量，用于后续精修判断。
- 已补齐设计 token 文件和可执行校验，避免配色、圆角和核心间距在后续页面中漂移。
- 已按“文档先行 -> 实现 -> 构建 -> 真实 Electron 截图”的流程迭代。
- 已补齐非官方品牌图标、导航图标、指标图标、额度明细图标和项目图标。
- 额度卡已接入真实 Codex `rate_limits`、本地 session token 增量和本地 Git 数据，不再使用静态估算。
- 额度卡右侧 `Token 用量` 已追加 `tok` 后缀，更接近设计稿明细行表达，同时不影响顶部四卡和项目概览的紧凑单位。
- 额度卡周期范围已按跨度自适应显示，周额度不再显示成两个相同时间点。
- 左侧品牌区、额度卡底部说明、顶部时间视角单行展示和整体文字色阶已按 `v0.2.2-dev.47` 的 UI Contract 与 design token 继续收敛。
- 顶部时间视角已按 `v0.2.2-dev.48` 从右侧操作区旁边回到顶栏中部控制区，同时保持单行文本切换。
- 顶部四卡已按 `v0.2.2-dev.49` 改为逐卡状态；计费月未观测时，`本月 Token` 不再错误沿用全局 `已观测`。
- 页面级截图已按 `v0.2.2-dev.50` 扩展为自然时间和计费时间各两张，计费时间状态不再只依赖静态检查。
- 页面级实现已按 `v0.2.2-dev.51` 继续修正左侧品牌基线、额度说明占高、时间视角单行容器和文字色阶；图标资产已集中到 `src/renderer/icons.tsx`。
- 页面级实现已按 `v0.2.2-dev.52` 补齐主进程实时刷新广播，修正顶部四卡右上角状态、内容居中和图标自适应，并把时间视角放回顶栏几何中部。
- 页面级实现已按 `v0.2.2-dev.53` 修正额度圆环为周期累计余量，扩大 Codex session 采集窗口以重建前几周计费周历史，提升顶部四卡图标尺寸，并要求截图前必须拿到 `live` 快照，避免旧缓存误导图审。
- 页面级实现已按 `v0.2.2-dev.54` 修正多 `rate_limits` 池场景，优先主额度池 `limit_id=codex`，并让 `今日代码改动` 的 `较昨日` 使用昨日自然日 Git 行数作为分母。
- 页面级实现已按 `v0.2.2-dev.57` 隐藏顶部四卡正常 `已观测` 单卡标签，异常态仍保留；四卡图标放大到接近右侧三行文字高度，并收紧图标与文字间距。
- 页面级实现已按 `v0.2.2-dev.61` 将计费月 Token 默认起始日设为每月 `1` 日，计费时间下 `本月 Token` 默认与自然月一致；月额度仍保持未观测，不用计费月 Token 伪装。
- 页面级实现已按 `v0.2.2-dev.68` 将项目概览排序入口从右上角 chip 按钮改为表头点击排序，默认 `最近活动` 倒序，并支持每个表头字段正序 / 倒序切换。
- 顶部四卡已区分“数据缺失”和“上一周期为 0 的新增场景”，不再把有数据的新增误显示为 `数据待补齐`。
- 最新 `1360 x 900` 与 `1080 x 720` 截图均能完整显示总览页主要区块。
- `npm run capture:overview` 已按当前开发版本生成真实 Electron 截图；`npm run verify:overview` 已绑定当前开发版本截图，并把挂件隐藏、真实 `rate_limits` 采集、连续 token 增量、额度周期证据、设计 token 和额度快照校验收敛为总览页级本地验收入口。

仍不能声称“像素级完全一致”：

- 当前设计稿是 AI 设计图和产品目标稿，不是逐像素标注稿。
- 当前页面使用真实本机数据，数字长度、项目数量和模型名称会与设计稿示例不同。
- 后续若要求像素级一致，需要单独建立尺寸标注表和视觉验收阈值。

因此，本审计结论为：总览页已达到当前文档化产品设计目标，可进入用户图审确认；如果用户要求继续追求像素级贴近，应作为下一轮视觉精修任务处理。

## 2. 原目标要求拆解

| 要求 | 当前状态 | 证据 | 说明 |
| --- | --- | --- | --- |
| 将页面分成多个区块并分别对照设计图 | 已完成 | `docs/design-review/overview-block-audit-v0.1.md` 第 1-6 节、第 8-20 节 | 已按左侧导航、顶部工具栏、顶部四卡、额度卡、项目概览、页脚逐块审计并持续记录每轮差异。 |
| 将设计差异量化为后续验收依据 | 已完成 | `docs/design-review/overview-visual-measurement-v0.1.md`、`docs/design-tokens-v0.1.md`、`npm run verify:design` | 已记录设计稿和实现截图尺寸、主要区块比例、当前达标项和后续可精修项；设计 token 已有可执行校验。 |
| 按既定流程先补文档再改实现 | 已完成 | `docs/ui-contract/overview-v0.1.md`、`docs/component-map.md`、`DEVELOPMENT_LOG.md` | 每轮涉及页面结构、数据口径或视觉约束的改动均同步更新正式文档和开发记录。 |
| 需要时补充图标等资产 | 已完成 | `src/renderer/icons.tsx` 中 `BrandMark`、`Glyph`；`docs/component-map.md` 当前约束 | 当前使用本项目自定义 SVG 图标模块，不使用 OpenAI / Codex 官方 logo 或第三方品牌资产。 |
| 额度数据接入真实数据 | 已完成 | `src/main/collectors/codexCollector.ts`、`src/main/collectors/dashboardCollector.ts`、`docs/data-contract-v0.2.md`、`docs/data-audit/overview-token-quota-audit-v0.1.md`、`npm run verify:quota` | 额度圆环优先使用当前额度周期 `quotaEvidence.remainingPercent`，周期边界来自 `resets_at + window_minutes`，右侧 token / 成本 / 会话 / 模型占比来自当前额度周期内的真实 token 增量；`verify:quota` 用运行态快照自动断言这些关键不变量。 |
| 参考 `dev-ledger` 项目 | 已完成 | `docs/data-audit/overview-token-quota-audit-v0.1.md`；`dev-ledger/docs/data-contract.md` 中额度周期口径 | 当前实现采用与 `dev-ledger` 一致的连续快照增量、自然时间 / 计费时间分离、5H / 周额度窗口口径。 |
| 认真对照并争取全部改完 | 当前可交付，待用户图审 | `local_dev_work/overview-1360x900-dev68.png`、`local_dev_work/overview-1080x720-dev68.png`、`local_dev_work/overview-billing-1360x900-dev68.png`、`local_dev_work/overview-billing-1080x720-dev68.png`、`npm run build`、`npm run verify:overview` | 已处理多轮高置信差异；`verify:overview` 统一检查交付物齐套、关键文档口径、当前版本自然/计费截图、设计 token、额度真实数据、截图前 live 快照、实时刷新广播和目标关键不变量；视觉是否继续精修应以用户对最新截图的确认或新标注为准。 |

## 3. 区块完成度

### 3.1 左侧导航

当前证据：

- 品牌区使用 `src/renderer/icons.tsx` 中的自定义 `BrandMark`，标题、说明和本机读取状态完整。
- `总览 / Codex 账本 / 代码仓库 / 设置` 均在固定位置展示。
- 导航图标已改为首页、文档账本、代码方块、齿轮语义。
- 最新截图中设置入口在 `1080 x 720` 仍可见。

状态：已完成当前设计目标。

### 3.2 顶部工具栏

当前证据：

- 顶部只保留页面标题、副标题、时间视角、状态、刷新和快照。
- `时间视角 / 自然时间 / 计费时间` 在两张最新截图中均为单行。
- 时间视角由顶栏三列布局承载，位于几何中部，不再明显偏左或贴近右侧操作区。
- 快照只在右侧展示一次。
- 主进程通过 `dashboard:updated` 广播后台刷新、手动刷新和周期刷新结果，渲染端订阅后静默替换快照。

状态：已完成当前设计目标。

### 3.3 顶部四卡

当前证据：

- 四卡字段固定为 `今日 Token / 本周 Token / 本月 Token / 今日代码改动`。
- 自然时间和计费时间只改变统计口径，不改变四卡结构。
- 卡片包含图标、标题、主数字、变化说明和异常态状态标签。
- 正常 `已观测` 不在单卡内重复显示；异常态状态标签固定在卡片右上角，不再单独占用底部一行。
- 卡片内容区整体居中，标题、主数字和变化说明在内容组内居中对齐；指标图标使用自适应尺寸，当前尺寸约 `64px - 72px`，接近右侧三行文字总高度。
- Token 自动切换 `万 / 亿` 单位。
- `今日代码改动` 当前使用今日自然日 `8107` 行与昨日自然日 `5219` 行计算，截图中显示 `较昨日 +55.3%`。
- 计费时间下 `本月 Token` 默认按每月 `1` 日起算，当前与自然月一致；该字段是 Token 时间窗口，不代表月额度已观测。

状态：已完成当前设计目标。

### 3.4 5H / 周额度卡

最近一次验收样本：

说明：运行态快照会随本机 Codex 使用持续变化，下面数值是本次 `v0.2.2-dev.57` 验收时的聚合样本；提交前的权威校验以 `npm run verify:overview` / `npm run verify:quota` 输出为准。

- 5H 周期：`2026-06-04T08:07:05.000Z` 到 `2026-06-04T13:07:05.000Z`
- 5H Token：`40173495`
- 5H API 等价成本：约 `$196.78`
- 5H 代码行数 / 会话数：`1458` 行 / `4`
- 5H 观测证据：`observations=111`、`resetCount=0`
- 5H 圆环：主额度池周期累计余量 `78%`
- 5H 价值折算：周期累计 `usedPercent=22%`，满额估值约 `$894.44`，估算剩余额度价值约 `$697.67`
- 周额度周期：`2026-06-04T02:59:29.000Z` 到 `2026-06-11T02:59:29.000Z`
- 周额度 Token：`111886006`
- 周额度 API 等价成本：约 `$594.07`
- 周额度代码行数 / 会话数：`3801` 行 / `5`
- 周额度观测证据：`observations=113`、`resetCount=0`
- 周额度圆环：主额度池周期累计余量 `88%`
- 周额度价值折算：周期累计 `usedPercent=12%`，满额估值约 `$4950.57`，估算剩余额度价值约 `$4356.50`

状态：已完成当前设计目标。

说明：

- 圆环表达当前额度周期累计余量。
- 右侧明细表达当前额度周期累计。
- 底部证据表达当前周期内的 `rate_limits` 观测次数和识别到的重置次数。
- 最近原始 `rate_limits` 只作为缺少周期证据时的降级来源；当前验收中 5H 与周额度都优先主额度池 `limit_id=codex`，圆环分别与 `quotaEvidence.remainingPercent=78% / 88%` 对齐。

### 3.5 项目概览

当前运行态摘要：

- 自然日 / 周 / 月项目行数均为 `11`。
- 计费 5H / 周额度项目行数均为 `11`。
- 当前周期无活动项目保留在表格中，展示 `0 / --`。
- 项目列包含项目图标和项目名。
- 排序入口已改为表头点击；默认按 `最近活动` 倒序展示，活动表头显示方向箭头。

状态：已完成当前设计目标。

### 3.6 页脚数据来源

当前运行态摘要：

- session 文件数：`320`
- archived 文件数：`21`
- 仓库数：`11`
- 页面展示本地数据来源和定价来源。

状态：已完成当前设计目标。

## 4. 验证记录

最新已执行验证：

- `npm run build`：通过
- `npm run capture:overview`：通过，生成当前版本自然/计费各 `1360 x 900` 与 `1080 x 720` 真实 Electron 截图；截图前已强制生成 `live` 快照
- `npm run verify:overview`：已执行；当前被既有 5H 额度快照校验假设阻断。运行态快照中 `resetsAt` 表现为最近重置点，`period.startAt=resetsAt`、`period.endAt=resetsAt+windowMinutes`，而 `verify:quota` 仍只接受 `period.endAt=resetsAt`。
- `npm run verify:design`：通过，校验 `styles.css` 的 token 引用和核心设计变量
- `npm run verify:quota`：当前失败于 5H 周期边界断言；该问题与本次项目概览表头排序改动无关，需要后续单独校准额度 `resetsAt` 语义与校验脚本。
- `git diff --check`：通过，仅有 Windows 换行提示
- 真实 Electron 截图：`local_dev_work/overview-1360x900-dev68.png`
- 真实 Electron 截图：`local_dev_work/overview-1080x720-dev68.png`
- 真实 Electron 截图：`local_dev_work/overview-billing-1360x900-dev68.png`
- 真实 Electron 截图：`local_dev_work/overview-billing-1080x720-dev68.png`
- 运行态快照摘要读取：通过，只输出聚合字段，不输出原始会话内容

## 5. 后续判定规则

如果用户确认最新截图：

- 可将总览页视为当前设计稿落地完成。
- 后续进入第二个页面的初步设计图确认流程。

如果用户继续指出视觉差异：

- 先把差异归入具体区块。
- 更新 `docs/design-review/overview-block-audit-v0.1.md`。
- 必要时补充尺寸标注表。
- 再改实现并重新截图验证。

## 6. `v0.2.2-dev.77` 刷新链路复核

本轮针对刷新体验与 Codex 会话采集性能修正，不改变总览页主要统计口径：

- 新增顶部刷新反馈条，展示读取快照、增量采集、后台刷新完成或失败。
- `sourceHealth.refresh` 记录总耗时、Codex/Git 分段耗时、新解析文件数、缓存复用数和缓存清理数。
- Codex JSONL 采集改为基于 `size + mtimeMs` 的增量缓存；缓存只保存文件签名和解析后的聚合结果，不保存原始会话正文。
- 当前版本真实 Electron 截图：`local_dev_work/overview-1360x900-dev77.png`、`local_dev_work/overview-1080x720-dev77.png`、`local_dev_work/overview-billing-1360x900-dev77.png`、`local_dev_work/overview-billing-1080x720-dev77.png`。
- 验证：`npm run build`、`npm run capture:overview`、`npm run verify:design`、`npm run verify:quota`、`git diff --check` 均通过；连续强制刷新实测第二次可复用绝大多数 Codex 会话解析缓存。

## 7. `v0.2.2-dev.78` 临时刷新反馈、设置页历史与计费月项目复核

本轮针对用户确认的独立项目方向、刷新反馈冗余和计费月项目周期补齐，不改变 Codex Token、额度和 Git 基础统计来源：

- 项目定位：`Codex Companion` 继续作为独立桌面应用维护，不作为 `dev-ledger` 的桌面端看板。
- 数据来源：当前快照独立采集 Codex 本地会话与 Git 仓库活动，不读取或依赖 `dev-ledger` 的运行结果。
- 刷新反馈：顶部反馈条只在刷新中、完成或失败后短暂显示；完成或失败后约 `5s` 自动消失。
- 刷新历史：`sourceHealth.refreshHistory` 保留最近 `30` 次刷新，设置页显示手动、自动、启动和后台刷新情况。
- 计费口径：设置页可保存 `billingMonthStartDay`；总览页默认进入计费时间。
- 项目概览：计费时间下新增 `计费月` 周期，并按计费月起点采集 Git 代码活动。
- 当前版本真实 Electron 截图：`local_dev_work/overview-1360x900-dev78.png`、`local_dev_work/overview-1080x720-dev78.png`、`local_dev_work/overview-billing-1360x900-dev78.png`、`local_dev_work/overview-billing-1080x720-dev78.png`。
- 设置页人工复核截图：`local_dev_work/settings-1360x900-dev78.png`。
- 验证：`npm run build`、`npm run capture:overview`、`npm run verify:design`、`npm run verify:quota`、`npm run verify:overview`、`git diff --check` 均通过；刷新历史来源已使用编译后的 `DashboardService.getSnapshot(true, "manual")` 与 `"auto"` 单独核对。

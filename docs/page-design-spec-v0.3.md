# Codex Companion 页面设计规格（v0.3.1 草案）

- 创建时间：2026-06-03
- 对应阶段：页面视觉重设前的设计确认
- 当前目标：先确认页面内容、展示方式、尺寸和位置，再进入实际页面开发
- 涉及页面：总览页、Codex 账本页、代码仓库页
- 暂缓范围：桌面挂件细化开发。挂件本轮仅改为默认关闭，后续单独设计。

## 0. 修订记录

- `v0.3`：初步规划总览页、Codex 账本页、代码仓库页，并生成三张设计图初稿。
- `v0.3.1`：先修订全局应用壳层与总览页。重点补齐左侧导航、顶部工具栏、设置入口、总览页时间视角、额度展示边界、数据状态与仓库活跃口径。
- `v0.3.1-image.1`：根据总览页修订稿生成两张总览页状态图，分别用于确认 `自然时间` 和 `计费窗口`。

## 1. 总体设计方向

### 1.1 产品气质

Codex Companion 是工作型桌面应用，不做营销式首页。界面应像一个长期打开的工程仪表盘：信息密度高、层级清楚、状态明确、视觉克制。

设计关键词：

- 本机数据仪表盘
- Codex 额度与 Token 账本
- 工程活动追踪
- 非官方、local-first、可验证

### 1.2 视觉原则

- 使用浅色工作台底色，避免整页单一蓝色。
- 保留浅蓝科技感，但加入白、石墨灰、青绿、琥珀色做状态区分。
- 卡片圆角控制在 `8px` 以内。
- 页面区块不堆叠大卡片，核心内容使用表格、条形进度、紧凑摘要和分栏面板。
- 数字使用等宽字体，标签使用清晰中文。
- 所有额度状态必须带来源状态：`已观测`、`未观测`、`待刷新`、`数据过期`。

### 1.3 应用壳层

所有页面必须共用同一套左侧导航与顶部工具栏，避免设计图各自生成出不同的外壳。

建议桌面基准画布：`1440 x 960`

固定结构：

- 左侧导航栏：`248px`，固定全高。
- 顶部工具栏：`72px`，固定在主内容区顶部。
- 主内容区：自适应，左右留白 `28px`，顶部工具栏下方留白 `28px`。
- 页面内容最大宽度：`1180px`。

左侧导航栏分区：

- 顶部品牌区，高度 `92px`：显示 `Codex Companion`、副标题 `非官方 Codex 本机仪表盘`，并以小状态点标注 `本机读取 · 无上传`。
- 主导航区：只展示当前已规划页面，依次为 `总览`、`Codex 账本`、`代码仓库`。
- 系统导航区：底部固定 `设置` 入口，不与主导航混排。
- 底部状态区：显示当前版本、最近快照时间、数据状态。文案必须避免官方背书，例如 `非官方工具`。

设置入口首轮只作为页面入口设计，不展开设置页细节。后续设置页至少覆盖：

- Codex 数据目录。
- 本地仓库根目录。
- 桌面挂件开关与样式。
- 隐私与本地读取说明。
- 价格表、模型映射和数据来源说明。

顶部工具栏分区：

- 左侧页面识别区，宽度约 `360px`：页面标题、页面副标题。
- 中部页面控制区，宽度约 `360px` 到 `420px`：放置当前页面最重要的视角切换或筛选。总览页使用 `时间视角：自然时间 / 计费窗口`。
- 右侧数据操作区，宽度约 `360px`：显示数据状态标签、刷新按钮、最近快照时间。
- 顶部工具栏不再重复放置设置入口，设置统一固定在左侧底部。

## 2. 总览页设计

### 2.1 页面目标

回答三个问题：

- 今天 Codex 使用是否正常？
- 当前 5 小时和周额度是否紧张？
- Codex 投入有没有对应到代码产出？

### 2.2 内容结构

总览页首版需要同时服务两种视角：

- `自然时间`：用于回答今天、本周、本月实际用了多少 Codex，以及对应本地代码活动。
- `计费窗口`：用于回答当前 5 小时窗口和当前周额度窗口是否紧张。

时间视角切换放在顶部工具栏中部页面控制区。切换只改变总览页指标口径，不改变左侧导航、顶部数据操作区和页面整体布局。

第一行：核心指标带

- 位置：主内容区顶部，占满宽度。
- 高度：`136px`
- 展示 4 个等宽指标。
- 每个指标块包含：标签、主数字、趋势小条、辅助说明。
- 每个指标块必须标注口径状态：`自然时间`、`计费窗口`、`未观测` 或 `数据过期`。

`自然时间` 模式下的 4 个指标：

- `今日 Token`：自然日 Codex Token，总量、会话数、API 等价成本。
- `自然本周 Token`：自然周 Codex Token，总量、会话数、API 等价成本。
- `自然本月 Token`：自然月 Codex Token，总量、会话数、API 等价成本。
- `今日代码改动`：本地 Git 今日改动行数和提交数。

`计费窗口` 模式下的 4 个指标：

- `当前 5 小时 Token`：按最近观测到的 `rate_limits.primary.resets_at - window_minutes` 到 `resets_at` 聚合 Token。
- `5 小时剩余`：只展示剩余百分比，来自 `100 - used_percent`。
- `当前周额度 Token`：按最近观测到的 `rate_limits.secondary.resets_at - window_minutes` 到 `resets_at` 聚合 Token。
- `周额度剩余`：只展示剩余百分比，来自 `100 - used_percent`。

第二行：额度与活动双栏

- 左侧：额度健康面板，占 `63%` 宽度，高度 `300px`。
- 右侧：模型用量分析面板，占 `37%` 宽度，高度 `300px`。

额度健康面板内容：

- 5 小时额度横向进度条
- 周额度横向进度条
- 可观测月额度状态行
- 已用百分比、剩余百分比、恢复时间、观测时间、来源状态
- API 等价成本和套餐价值折算，但必须标注为估算

额度展示边界：

- 当前 Codex 本地快照只稳定暴露 `used_percent`、`window_minutes`、`resets_at` 和观测时间。
- 首版不展示 `剩余 Token`，因为没有原始字段支撑。
- 首版不展示 `预计可用时长`，因为需要连续额度快照计算消耗速度；当前只有最近快照时，展示该字段会造成伪精确。
- 后续若沉淀历史额度快照，可按 `剩余百分比 / 最近消耗百分比速度` 估算可用时长，并用 `resets_at` 做上限约束。

模型用量分析面板内容：

- 默认统计范围跟随总览页时间视角：`自然时间` 使用自然本周，`计费窗口` 使用当前周额度窗口。
- 顶部切换：`Token`、`API 等价成本`、`事件数`。
- 使用横向条形列表展示 Top 5 模型，不使用饼图。
- 每行显示模型名、占比、Token、API 等价成本和事件数。

数据状态展示方式：

- 不再把 `数据可信度` 作为总览页大面板。
- 顶部工具栏右侧用一个状态标签展示 `已观测`、`待刷新`、`未观测`、`数据过期`。
- 页面底部用紧凑说明展示 Codex session 扫描数、archived session 扫描数、仓库数量、最新 token 观测时间和采集备注。
- 如果后续发现用户确实需要排查数据问题，再把数据状态升级为设置页或诊断抽屉。

第三行：Codex 投入与代码产出

- 位置：底部，占满宽度。
- 高度：`340px` 到 `360px`。
- 标题建议使用 `投入与产出对照`，避免只写 `仓库活跃` 造成口径混淆。

展示方式：

- 默认展示 Top 5 仓库对照表。
- 表格字段：仓库名、Codex Token、归因会话、近 7 日改动行数、今日未提交改动、提交数、匹配状态。
- 支持排序切换：`按 Codex 投入`、`按 Git 产出`。
- 首版不做综合活跃分，因为 Codex Token 和 Git 改动行数不是同一量纲，硬合并会削弱可解释性。

仓库活跃口径：

- `Codex 投入`：通过 Codex 会话 `cwd` 向上查找 Git 根目录后归因 Token。
- `Git 产出`：通过本地 Git 命令统计提交数、增删行、工作区 diff。
- `投入产出同步`：同一仓库同时存在 Codex Token 和 Git 改动。
- `有投入待产出`：存在 Codex Token，但当前观察窗口没有 Git 改动。
- `有产出未归因`：存在 Git 改动，但没有 Codex 会话归因。

### 2.3 总览页待确认决策

- 是否确认把 `数据可信度` 从大面板降级为顶部状态标签和底部数据来源说明。
- 是否确认总览页右侧大面板改为 `模型用量分析`。
- 是否确认首版不展示 `剩余 Token` 和 `预计可用时长`，只展示剩余百分比、恢复时间和观测状态。
- 是否确认仓库区使用 `Codex 投入` 与 `Git 产出` 两条口径，不做综合活跃分。

### 2.4 设计图生成提示词

```text
Use case: ui-mockup
Asset type: desktop app page design mockup
Primary request: Create a polished desktop dashboard mockup for the Codex Companion overview page with a consistent app shell.
Scene/backdrop: a light local-first engineering analytics app, not a landing page.
Style/medium: high-fidelity UI mockup, restrained operational dashboard, crisp typography.
Composition/framing: 1440x960 desktop app screenshot, fixed left navigation rail 248px, fixed top toolbar 72px, main dashboard content with four KPI cards, quota health panel, model usage panel, and repository input-output table.
Color palette: off-white workspace background, graphite text, blue and cyan as accents, green/amber/red for status, avoid one-note blue dominance.
Text (verbatim): "Codex Companion", "非官方 Codex 本机仪表盘", "总览", "Codex 账本", "代码仓库", "设置", "时间视角", "自然时间", "计费窗口", "今日 Token", "自然本周 Token", "自然本月 Token", "今日代码改动", "5 小时额度", "周额度", "模型用量分析", "投入与产出对照", "Codex 投入", "Git 产出"
Constraints: all pages must share the same left nav and top toolbar design, include a bottom-left settings entry, no OpenAI logo, no official branding, no marketing hero, no decorative blobs, no oversized data confidence card, no remaining-token value, no estimated available duration, Chinese UI text, 8px card radius.
```

## 3. Codex 账本页设计

### 3.1 页面目标

回答四个问题：

- 当前额度窗口具体用了多少？
- 自然时间和计费窗口的 Token 口径如何区分？
- 不同模型贡献了多少 Token 和成本？
- 哪些会话能归因到哪些项目或仓库？

### 3.2 内容结构

第一行：额度窗口状态

- 位置：页面顶部，占满宽度。
- 高度：`156px`
- 三个横向窗口卡：
  - 5 小时额度
  - 周额度
  - 可观测月额度
- 每个窗口卡包含：已用百分比、剩余百分比、恢复时间、来源状态。

第二行：周期账本与模型构成

- 左侧：周期账本表，占 `68%` 宽度，高度 `360px`
- 右侧：模型构成面板，占 `32%` 宽度，高度 `360px`

周期账本表字段：

- 周期
- 起止时间
- 会话数
- 普通输入 Token
- 缓存输入 Token
- 输出 Token
- 总 Token
- API 等价成本

模型构成面板：

- 顶部切换：Token / 成本 / 调用次数
- 使用水平堆叠条，不使用大面积饼图
- 显示模型名、占比、Token、API 等价成本

第三行：会话归因表

- 位置：底部，占满宽度。
- 高度：自适应
- 字段：
  - 最近时间
  - 会话 ID 短码
  - 工作目录
  - 仓库
  - 主模型
  - Token
  - API 等价成本

### 3.3 设计图生成提示词

```text
Use case: ui-mockup
Asset type: desktop app page design mockup
Primary request: Create a polished desktop ledger page mockup for Codex Companion.
Scene/backdrop: an engineering quota and token ledger for Codex local sessions.
Style/medium: high-fidelity UI mockup, professional data-heavy desktop software.
Composition/framing: 1440x960 desktop app screenshot, left navigation rail, top toolbar, upper quota window row, middle ledger table with model side panel, bottom session attribution table.
Color palette: clean white and cool gray base, blue/cyan accents, green/amber/red status tokens, avoid dark theme and purple gradients.
Text (verbatim): "Codex 账本", "5 小时额度", "周额度", "可观测月额度", "周期账本", "模型构成", "Token", "成本", "调用次数", "会话归因"
Constraints: no OpenAI logo, no official branding, no decorative hero, compact readable tables, Chinese UI text, 8px card radius.
```

## 4. 代码仓库页设计

### 4.1 页面目标

回答三个问题：

- 哪些本地仓库最活跃？
- Codex Token 投入对应到哪些仓库？
- 单个仓库近期代码产出和文件构成如何？

### 4.2 内容结构

第一行：仓库筛选与摘要

- 左侧：搜索框和仓库根目录筛选。
- 右侧：总仓库数、归因 Token、今日改动行数、本月改动行数。
- 高度：`112px`

第二行：仓库排行与单仓库详情

- 左侧：仓库列表表格，占 `58%` 宽度，高度 `520px`
- 右侧：选中仓库详情，占 `42%` 宽度，高度 `520px`

仓库列表字段：

- 仓库名
- 远端状态
- 默认分支
- 今日提交
- 近 7 日改动行数
- 本月改动行数
- Codex Token
- API 等价成本

单仓库详情：

- 仓库路径
- 远端 URL
- 今日 / 近 7 日 / 本月三个指标块
- 文件体量概览
- 最近 5 条提交
- Codex 会话归因摘要

第三行：数据来源说明

- 显示当前扫描的仓库根目录。
- 明确 GitHub 远端元数据未接入。

### 4.3 设计图生成提示词

```text
Use case: ui-mockup
Asset type: desktop app page design mockup
Primary request: Create a polished desktop repository analytics page mockup for Codex Companion.
Scene/backdrop: local Git repository activity tied to Codex token attribution.
Style/medium: high-fidelity UI mockup, practical engineering operations dashboard.
Composition/framing: 1440x960 desktop app screenshot, left navigation rail, top toolbar, search and summary row, repository ranking table on the left, selected repository detail panel on the right.
Color palette: off-white and light gray base, graphite text, restrained blue/cyan accents, green/amber/red for state and risk, avoid one-color blue monotony.
Text (verbatim): "代码仓库", "筛选仓库", "本地仓库", "归因 Token", "今日改动", "近 7 日改动", "本月改动", "最近提交", "文件体量"
Constraints: no OpenAI logo, no official branding, no marketing page, no oversized hero, compact readable table, Chinese UI text, 8px card radius.
```

## 5. 本轮确认标准

设计图确认时重点看：

- 左侧导航、顶部工具栏和设置入口是否在所有页面中保持一致。
- 页面信息是否完整。
- 各区块主次是否符合实际使用优先级。
- 表格、指标、状态标签是否足够清晰。
- 页面是否符合工作型桌面应用，而不是营销页。
- 是否需要调整整体密度、色彩、导航位置或单页内容范围。

确认后再进入实现阶段，并按本文档逐项改造实际页面。

后续确认方式调整为“先看图、再用少量编号反馈”：

- `S1`：左侧导航、顶部工具栏、设置入口是否确认。
- `S2`：页面主次结构和信息密度是否确认。
- `S3`：关键指标卡的字段、口径和切换状态是否确认。
- `S4`：中部分析面板是否确认。
- `S5`：底部表格或列表是否确认。

用户反馈时可直接写类似：`S1 OK，S3 重出，S5 表格太挤`。

## 6. 设计图初稿

本轮生成三张页面设计图，先用于确认页面信息结构与视觉方向：

- 总览页设计图：[overview-page.png](./assets/design/v0.3/overview-page.png)
- Codex 账本页设计图：[ledger-page.png](./assets/design/v0.3/ledger-page.png)
- 代码仓库页设计图：[repositories-page.png](./assets/design/v0.3/repositories-page.png)

初步观察：

- 总览页的整体层级清晰，但左侧导航出现了部分未规划页面项，且顶部工具栏与其他页面不一致；该图应按 `v0.3.1` 总览页规格重出。
- Codex 账本页的信息结构较贴近本文档，可作为后续实现参考。
- 代码仓库页的表格与详情分栏清晰，可作为后续实现参考，但 GitHub 远端区域需在实际开发时继续保持“后续可选能力”口径。

## 7. 总览页 v0.3.1 状态图

根据 `v0.3.1` 总览页规格，生成两张总览页状态图：

- 自然时间状态图：[overview-natural-time.png](./assets/design/v0.3.1/overview-natural-time.png)
- 计费窗口状态图：[overview-billing-window.png](./assets/design/v0.3.1/overview-billing-window.png)

当前观察：

- 自然时间图的应用壳层、设置入口、时间视角切换、模型用量分析和投入产出对照整体可作为确认基础。
- 自然时间图中额度健康表格的已用 / 剩余百分比位置略容易误读，后续实现或重出图时需要把已用、剩余和进度条关系做得更明确。
- 计费窗口图能表达四个指标卡的计费窗口口径，也明确避免了剩余 Token 和预计可用时长。
- 计费窗口图中投入产出对照表的 Git 产出字段出现了“提交 / 文件”混合写法，后续应统一为改动行数、提交数或拆成两个字段。

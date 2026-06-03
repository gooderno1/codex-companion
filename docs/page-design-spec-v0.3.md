# Codex Companion 页面设计规格（v0.3 草案）

- 创建时间：2026-06-03
- 对应阶段：页面视觉重设前的设计确认
- 当前目标：先确认页面内容、展示方式、尺寸和位置，再进入实际页面开发
- 涉及页面：总览页、Codex 账本页、代码仓库页
- 暂缓范围：桌面挂件细化开发。挂件本轮仅改为默认关闭，后续单独设计。

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

### 1.3 应用框架

建议桌面基准画布：`1440 x 960`

固定结构：

- 左侧导航栏：`248px`
- 顶部工具栏：`72px`
- 主内容区：自适应，左右留白 `28px`
- 页面内容最大宽度：`1180px`

左侧导航：

- 顶部显示产品名 `Codex Companion` 和非官方状态点。
- 导航项：总览、Codex 账本、代码仓库。
- 底部显示数据边界：本机读取、无上传、最近快照时间。

顶部工具栏：

- 左侧：当前页面标题、副标题。
- 中部：当前数据源健康状态。
- 右侧：刷新按钮、快照时间、设置入口。

## 2. 总览页设计

### 2.1 页面目标

回答三个问题：

- 今天 Codex 使用是否正常？
- 当前 5 小时和周额度是否紧张？
- Codex 投入有没有对应到代码产出？

### 2.2 内容结构

第一行：核心指标带

- 位置：主内容区顶部，占满宽度。
- 高度：`132px`
- 展示 4 个等宽指标：
  - 今日 Token
  - 周额度剩余
  - 本周 Token
  - 本月 Token
- 每个指标块包含：标签、主数字、趋势小条、辅助说明。

第二行：额度与活动双栏

- 左侧：额度健康面板，占 `65%` 宽度，高度 `300px`
- 右侧：数据可信度面板，占 `35%` 宽度，高度 `300px`

额度健康面板内容：

- 5 小时额度横向进度条
- 周额度横向进度条
- 可观测月额度状态行
- 恢复时间、已用百分比、剩余百分比
- API 等价成本和套餐价值折算

数据可信度面板内容：

- Codex session 扫描数
- archived session 扫描数
- 仓库数量
- 最新 token 观测时间
- 当前状态标签
- 采集备注列表

第三行：Codex 投入与代码产出

- 左侧：今日 / 近 7 日 / 本月代码改动摘要，占 `50%`
- 右侧：活跃仓库 Top 5，占 `50%`

展示方式：

- 代码改动摘要使用横向小表格。
- 活跃仓库使用排名列表，显示仓库名、Token、改动行数、提交数。

### 2.3 设计图生成提示词

```text
Use case: ui-mockup
Asset type: desktop app page design mockup
Primary request: Create a polished desktop dashboard mockup for the Codex Companion overview page.
Scene/backdrop: a light local-first engineering analytics app, not a landing page.
Style/medium: high-fidelity UI mockup, restrained operational dashboard, crisp typography.
Composition/framing: 1440x960 desktop app screenshot, left navigation rail 248px, top toolbar 72px, dense dashboard content.
Color palette: off-white workspace background, graphite text, blue and cyan as accents, green/amber/red for status, avoid one-note blue dominance.
Text (verbatim): "Codex Companion", "总览", "今日 Token", "周额度剩余", "本周 Token", "本月 Token", "5 小时额度", "周额度", "数据可信度", "活跃仓库"
Constraints: no OpenAI logo, no official branding, no marketing hero, no decorative blobs, no nested card-heavy layout, Chinese UI text, 8px card radius.
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

- 页面信息是否完整。
- 各区块主次是否符合实际使用优先级。
- 表格、指标、状态标签是否足够清晰。
- 页面是否符合工作型桌面应用，而不是营销页。
- 是否需要调整整体密度、色彩、导航位置或单页内容范围。

确认后再进入实现阶段，并按本文档逐项改造实际页面。

## 6. 设计图初稿

本轮生成三张页面设计图，先用于确认页面信息结构与视觉方向：

- 总览页设计图：[overview-page.png](./assets/design/v0.3/overview-page.png)
- Codex 账本页设计图：[ledger-page.png](./assets/design/v0.3/ledger-page.png)
- 代码仓库页设计图：[repositories-page.png](./assets/design/v0.3/repositories-page.png)

初步观察：

- 总览页的整体层级清晰，但左侧导航出现了部分未规划页面项，确认后如采用该方向，实际开发需收敛为当前三页导航。
- Codex 账本页的信息结构较贴近本文档，可作为后续实现参考。
- 代码仓库页的表格与详情分栏清晰，可作为后续实现参考，但 GitHub 远端区域需在实际开发时继续保持“后续可选能力”口径。

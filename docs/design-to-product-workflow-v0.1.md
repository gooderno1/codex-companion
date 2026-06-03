# Codex Companion 设计图到产品实现工作流（v0.1）

- 创建时间：2026-06-03
- 适用范围：总览页、Codex 账本页、代码仓库页，以及后续设置页和挂件页
- 目标：让设计图片能够更快、更准确地过渡到真实产品，而不是靠人工“看图临摹”
- 检索时间：2026-06-03

## 1. 检索结论

单张设计图只能确认视觉方向，不能直接作为开发输入。要想快速且正确落地，必须在“图片确认”之后补齐一套文本化、组件化、可验证的交付物。

本轮检索到的可直接借鉴的官方方向：

- Figma Dev Mode：设计应进入可交付状态，开发侧需要可检查尺寸、间距、标注和状态说明。
- Figma Variables / modes：颜色、间距、圆角、字号等应转成可复用变量，而不是停留在图片像素里。
- W3C Design Tokens：设计变量最好沉淀成文本化 token，而不是只存在设计工具里。
- Storybook：推荐以组件为单位实现和确认状态，而不是直接先写整页。
- Playwright visual comparisons：最终需要截图基线和视觉回归，避免“看起来差不多”的主观误差。

## 2. 推荐方法

推荐使用“四件套”交付，而不是“设计图 + 口头解释”：

1. 页面规格文档
2. 设计 token 文件
3. 组件映射表
4. 视觉基线测试
5. 分区设计对照审计

这四件套分别解决四个问题：

- 页面规格文档：解决“这张图到底哪些是必须实现的”
- 设计 token 文件：解决“颜色、间距、圆角、字号如何统一”
- 组件映射表：解决“这张图里的块，代码里到底拆成哪些组件”
- 视觉基线测试：解决“实现后如何客观判断偏没偏”
- 分区设计对照审计：解决“整页看起来还行，但局部区块仍偏离设计”的问题

## 3. 标准流程

### 3.1 第一步：冻结页面规格

每个页面在开始开发前，必须先有一份当前生效的页面规格文档。

最少包含：

- 页面目标
- 页面区块结构
- 固定字段与可切换字段
- 组件清单
- 数据口径
- 状态定义
- 不实现项

对当前项目，页面规格文档至少应回答：

- 哪些字段在 `自然时间 / 计费时间` 下结构不变
- 哪些字段只改变统计边界
- 哪些字段当前数据源还不支持，只能显示 `未观测` 或 `待补齐`

### 3.2 第二步：把图片拆成 token

不能让颜色、间距、字号、圆角只存在图片里。它们必须进入仓库，成为可维护的文本化配置。

本项目建议首轮最少抽出：

- 颜色：背景、正文、弱文本、主蓝、成功、警告、危险、边框
- 间距：4 / 8 / 12 / 16 / 20 / 24 / 28 / 32
- 圆角：卡片、按钮、输入框
- 字号：页面标题、卡片标题、主数字、正文、辅助文案
- 图标尺寸：应用图标、导航图标、区块图标

首轮不必追求复杂 token 系统，但必须做到：

- token 在代码里有唯一来源
- 命名稳定
- 页面不直接硬编码散乱颜色和值

### 3.3 第三步：建立组件映射

图片不能直接对应整页代码，必须先拆成组件。

本项目建议每个页面先做“页面组件映射表”，至少包含：

- 设计区块名
- 代码组件名
- 是否复用
- 需要哪些 props
- 有哪些状态
- 数据来源

以总览页为例，至少拆成：

- `AppSidebar`
- `TopToolbar`
- `MetricCard`
- `QuotaWindowCard`
- `ProjectOverviewTable`
- `StatusPill`
- `SortTabs`
- `PeriodTabs`

这样做的作用是：

- 后续页面可以复用同一套壳层
- 设计变化时只改对应组件，不会整页返工
- 测试可以针对组件状态逐个验证

### 3.4 第四步：组件优先实现

不要先一次性写完整页，再到处返工。应先按组件实现，再组合成页面。

推荐顺序：

1. 先做壳层：左侧导航、顶部工具栏
2. 再做四卡
3. 再做 5H / 周额度卡
4. 再做项目概览表
5. 最后拼整页

这一步如果要追求长期稳定，推荐接入 Storybook。

如果本轮不想先引入 Storybook，也可以采用轻量替代：

- 用本地预览路由或隐藏页面承载单组件预览
- 为每个核心组件准备 2 到 4 个固定状态样例
- 页面组装前先把组件状态确认完

### 3.5 第五步：建立视觉基线

设计图确认通过后，应立刻生成实现阶段的截图基线。

推荐两层校验：

- 组件级：核心组件截图
- 页面级：总览页、账本页、代码仓库页整页截图

如果本项目暂时不引入 Storybook 视觉测试，则建议直接使用 Playwright 页面截图基线。

验收标准不应再是“看起来差不多”，而应是：

- 布局是否对齐
- 字段是否完整
- 状态切换是否正确
- 字体层级是否符合规格
- 颜色与留白是否落在 token 体系内

### 3.6 第六步：做设计对照与视口校验

只跑构建还不够。页面在提交前必须做一轮“实现页对设计图”的人工或自动对照，不允许跳过。

对照不能只看整页截图，必须按区块拆开检查。总览页当前区块模板为：

- 左侧导航区
- 顶部工具栏
- 顶部四个指标卡
- `5H / 周额度窗口` 两张额度卡
- 底部项目概览表
- 页脚数据来源说明

至少检查 4 个维度：

- 颜色是否落在当前页面 token 和设计图主色范围内
- 外层尺寸是否在标准窗口下完整显示，不依赖全屏才能正常浏览
- 模块之间的留白、卡片高度、导航宽度是否接近设计图密度
- 滚动是否只发生在预期容器内，而不是整页被撑出屏幕
- 启动时是否先显示可用首屏，再后台刷新真实数据

当前项目默认至少校验两个窗口状态：

- 标准桌面窗口：`1360 x 900`
- 最小桌面窗口：`1080 x 720`
- 全屏或接近全屏窗口

如果其中任意一个状态出现下面任意问题，本轮不进入提交：

- 页面超出屏幕可视范围
- 顶部工具栏或左侧导航被挤压
- 主要卡片需要非预期滚动才能看到
- 配色明显偏离当前确认设计图
- 首屏必须等待完整本地采集完成后才可见

### 3.7 第七步：用真实运行截图闭环

只看设计图或浏览器静态页面不够，Electron 桌面应用还会受到窗口边框、系统缩放、标题栏高度、生产构建资源路径的影响。每个页面进入提交前，必须跑真实应用截图。

当前项目采用轻量截图钩子，不先引入完整 Playwright/Electron 测试框架：

- `CODEX_COMPANION_CAPTURE_PATH`：截图输出路径
- `CODEX_COMPANION_CAPTURE_DELAY_MS`：等待首屏与后台快照替换的时间
- `CODEX_COMPANION_WINDOW_WIDTH`：测试窗口宽度
- `CODEX_COMPANION_WINDOW_HEIGHT`：测试窗口高度

推荐执行顺序：

1. `npm run build`
2. 用 `1360 x 900` 启动生产 Electron 并输出截图
3. 用 `1080 x 720` 启动生产 Electron 并输出截图
4. 人工对照确认是否完整显示页面结构、配色、留白和预期滚动容器
5. 如果任意截图不通过，先修正布局或 token，再重新截图，不允许先提交

截图通过标准：

- 左侧导航完整，设置入口固定在底部
- 顶部工具栏完整，时间视角不带额外边框
- 顶部四卡字段一致，只改变统计口径
- `5H / 周额度窗口` 两张卡比例接近设计稿，不挤占底部项目概览
- 底部项目概览完整露出，滚动只发生在表格内部
- 页脚或数据来源说明不把主内容挤出窗口

## 4. 本项目的最小落地版本

为了兼顾速度和正确性，本项目建议分两阶段落地。

### 4.1 阶段 A：不新增 Storybook 的轻量版

直接可做：

- 继续维护页面规格文档
- 新增 token 文件
- 新增组件映射表
- 用现有应用页面 + 真实 Electron 截图钩子做页面基线
- 后续再按需要升级到 Playwright / Storybook 视觉回归

建议新增产物：

- `docs/ui-contract/overview-v0.1.md`
- `docs/component-map.md`
- `docs/design-review/overview-block-audit-v0.1.md`
- `src/renderer/design-tokens.ts`
- `local_dev_work/<page>-<viewport>.png` 临时截图记录
- `tests/visual/overview.spec.ts` 后续自动化用例

优点：

- 改动最小
- 能马上进入实际开发
- 不强行引入新基础设施
- 能覆盖 Electron 生产构建的资源路径和窗口尺寸问题

缺点：

- 组件状态复用和独立预览不如 Storybook 完整
- 截图对比仍需人工判断，后续页面稳定后应升级为自动视觉回归

### 4.2 阶段 B：组件化增强版

当三页开始连续开发时，再补：

- Storybook
- 组件 stories
- 组件级视觉测试

这样做更适合：

- 页面继续迭代
- 后续增加设置页、挂件页
- 组件复用需求越来越多

## 5. 建议的执行顺序

对当前项目，建议按下面顺序推进：

1. 先把总览页规格文档修正到唯一正确
2. 基于总览页规格补 `ui-contract`
3. 提取首版 token
4. 写总览页组件映射表
5. 开始总览页实际开发
6. 用截图基线校验总览页
7. 再进入 Codex 账本页和代码仓库页

## 5.1 目录约定

为了让后续页面都按同一方式交付，建议固定目录和命名，不再临时起文件名。

推荐目录：

- `docs/page-design-spec-v*.md`
- `docs/ui-contract/`
- `docs/assets/design/`
- `src/renderer/design-tokens.ts`
- `tests/visual/`

推荐命名：

- 页面确认稿：`docs/ui-contract/<page>-vX.Y.md`
- 组件映射：`docs/component-map.md`
- 视觉基线：`tests/visual/<page>.spec.ts`
- 设计图：`docs/assets/design/<version>/`

## 5.2 每页交付清单

每个页面在“进入实际开发”前，至少要有下面 5 项：

1. 页面规格已冻结
2. 页面 `ui-contract` 已落盘
3. 组件映射已补齐
4. 设计 token 已能覆盖当前页面
5. 页面级设计图已确认

如果缺任意一项，不进入正式实现。

## 5.3 页面确认门

每个页面在设计阶段要经过三个门：

### Gate A：方向确认

产物：

- 1 到 2 张页面设计图
- 简短反馈结论

通过标准：

- 信息结构对
- 视觉方向对
- 壳层一致

### Gate B：规格确认

产物：

- 页面 `ui-contract`
- 当前生效字段表
- 状态与边界说明

通过标准：

- 不再依赖图片口头解释
- 可直接指导组件拆分
- 数据口径无冲突

### Gate C：实现确认

产物：

- 真实页面实现
- `1360 x 900` 与 `1080 x 720` 真实 Electron 截图
- 验证记录
- 设计对照结论

通过标准：

- 与 `ui-contract` 一致
- 与设计 token 一致
- 页面截图通过人工视觉验收；后续接入自动视觉回归后，必须通过截图 diff
- 标准窗口、最小窗口和全屏窗口都不出现布局溢出
- 页面密度、配色和留白已与确认设计图对齐

## 5.4 当前项目建议

对 `codex-companion`，当前最合理的推进方式是：

1. 总览页先完成 Gate B
2. 直接开始总览页实现
3. 总览页跑通后，把壳层、卡片、表格沉淀成复用组件
4. 再进入 Codex 账本页和代码仓库页

原因：

- 总览页已经反复出过多轮图，继续只改图收益很低
- 当前真正缺的是结构化交付，而不是更多视觉草稿
- 总览页一旦完成 `ui-contract + token + component map`，后两页的确认效率会明显提高

## 6. 参考依据

- Figma Dev Mode Guide  
  [https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)
- Figma Variables  
  [https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
- Figma Code Connect  
  [https://help.figma.com/hc/en-us/articles/35498295267991-Figma-MCP-collection-Improve-code-generation-with-Figma-s-Code-Connect-UI](https://help.figma.com/hc/en-us/articles/35498295267991-Figma-MCP-collection-Improve-code-generation-with-Figma-s-Code-Connect-UI)
- W3C Design Tokens Community Group Format Module  
  [https://www.w3.org/community/design-tokens/](https://www.w3.org/community/design-tokens/)
- Storybook: Intro to Storybook / component-first workflow  
  [https://storybook.js.org/tutorials/intro-to-storybook/react/en/simple-component/](https://storybook.js.org/tutorials/intro-to-storybook/react/en/simple-component/)
- Storybook Visual Tests  
  [https://storybook.js.org/docs/writing-tests/visual-testing](https://storybook.js.org/docs/writing-tests/visual-testing)
- Playwright Visual Comparisons  
  [https://playwright.dev/docs/test-snapshots](https://playwright.dev/docs/test-snapshots)

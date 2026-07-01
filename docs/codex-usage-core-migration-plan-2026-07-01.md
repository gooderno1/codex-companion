# Codex 用量核心包迁移规划

- 创建时间：2026-07-01
- 创建时版本基线：`codex-companion v0.3.1-dev.3`
- 需求主题：抽取 `codex-usage-core`，让 `codex-companion` 与 `dev-ledger` 共享 Codex 用量、额度周期和重置检测规则
- 影响项目：`codex-usage-core`、`codex-companion`、`dev-ledger`
- 影响页面：`codex-companion` 总览页、Codex 账本页、设置页数据源状态；`dev-ledger` Codex 用量账本与重置检测输出
- 关键设计约束：继续保持 Codex 专用、本机读取、非官方声明、隐私边界清晰；不引入云端后端；不把原始 session 正文、仓库源码或敏感路径写入共享测试数据；两个上层项目只消费核心包的稳定输出，不各自维护分叉版重置规则
- 相关数据源：Codex `sessions`、`archived_sessions`、`rate_limits`、`total_token_usage`、`last_token_usage`、脱敏 fixture、两个项目的快照与校验脚本
- 目标核心包路径：`D:\MyFile\Obisidian\LifeInHand\1. 项目\个人品牌-学习进步\CodeLib\MyCode\codex-usage-core`
- 目标远端仓库：[gooderno1/codex-usage-core](https://github.com/gooderno1/codex-usage-core)

## 1. 问题判断

当前 `codex-companion` 与 `dev-ledger` 都在维护 Codex 用量、额度周期和 reset 检测逻辑。近期周额度 reset 规则连续更新，已经出现需要从 `dev-ledger` 复制规则到 `codex-companion` 的协作成本。

主要风险：

- 同一条 reset 规则在两个项目中实现时间不一致。
- 证据字段、验证脚本和文档口径容易漂移。
- 修复一个项目后，另一个项目可能继续使用旧逻辑。
- 真实 Codex 数据敏感，不能靠复制原始样本在两个项目里反复调试。

结论：优先抽取共享本地核心包，而不是建立远程后端服务。核心包统一处理可复用的数据解析、归一化、周期切分、reset 检测、证据输出和校验逻辑；两个项目保留各自 UI、账本展示、缓存策略和发布节奏。

## 2. 迁移目标

1. 建立独立项目 `codex-usage-core`，作为两个项目共同依赖。
2. `codex-usage-core` 首版基于当前 `codex-companion` 的隐私、文档、版本和 Git 协作规则建立 `AGENTS.md`。
3. 核心包先覆盖 Codex 用量与 reset 规则，不处理 Electron UI、桌面挂件、账本页面布局或 Git 仓库活动展示。
4. `codex-companion` 集成核心包后，继续负责 Electron 设置、快照存储、总览页和账本页渲染。
5. `dev-ledger` 集成核心包后，继续负责自身账本、分析报告和数据归档输出。
6. 两个上层项目的 `AGENTS.md` 都要补充依赖检查要求：每次修改 Codex 用量、额度周期、reset、数据契约或校验逻辑前，必须确认 `codex-usage-core` 是否已有更新，优先更新核心包而不是复制实现。
7. 核心包的 `AGENTS.md` 要补充反向升级要求：每次核心包升级后，必须同步升级依赖它的 `codex-companion` 与 `dev-ledger`，并分别提交版本、开发记录和验证结果。

## 3. 核心包职责边界

### 3.1 首版必须共享

- Codex session JSONL 扫描入口和文件签名元数据类型。
- `total_token_usage` 增量计算。
- `last_token_usage` 降级口径。
- `rate_limits` 提取与额度池选择。
- 5H 与周额度观测归一化。
- 周额度全局时间线比较。
- reset 候选生成规则：
  - 相邻候选：`resets_at` 后移超过 `60s`，`used_percent` 下降至少 `5` 个百分点。
  - 高水位证据：重置前 `used_percent >= 50`。
  - 边界贴近证据：新窗口起点贴近观测时间 `5min` 内。
  - 稳定边界回看证据：周额度 `24h` 回看旧窗口高点，旧高点比当前观测高至少 `5` 个百分点，新窗口起点比旧窗口起点后移超过 `15min`。
- reset 稳定确认规则：
  - 候选后至少等待 `30min`。
  - 后续 `6h` 内必须出现同一新窗口边界的稳定观测。
  - 确认窗口内边界漂移超过 `15min` 时排除。
  - 同一新窗口起点在 `15min` 容差内只保留最早确认事件。
- 共享类型：
  - `QuotaResetEvent`
  - `QuotaResetEvidence`
  - `QuotaCycleObservation`
  - `QuotaEvidence`
  - `UsageSegment`
  - 核心包内部的错误、警告和验证结果类型
- 校验 CLI：
  - `codex-usage verify snapshot`
  - `codex-usage inspect-reset`
  - `codex-usage summarize`

### 3.2 首版不共享

- Electron IPC、窗口、截图、托盘、挂件和设置页。
- `codex-companion` 的 `DashboardSnapshot` UI 适配字段。
- `dev-ledger` 的账本页面、报告格式和归档策略。
- Git 仓库提交、代码行数、项目归因等非 Codex usage 核心逻辑。
- 远程后端、账号登录、多设备同步或团队看板。
- 多 provider 抽象；首版仍只服务 Codex。

## 4. 项目结构建议

`codex-usage-core` 建议结构：

```text
codex-usage-core/
  AGENTS.md
  DEVELOPMENT_LOG.md
  README.md
  package.json
  tsconfig.json
  src/
    index.ts
    contracts.ts
    session-parser.ts
    token-usage.ts
    rate-limits.ts
    quota-reset.ts
    quota-cycle.ts
    validators.ts
    cli.ts
  fixtures/
    README.md
    sanitized/
  scripts/
    verify-snapshot.mjs
  tests/
    quota-reset.test.ts
    token-usage.test.ts
```

依赖方式统一使用远程可同步来源：

1. 当前阶段：两个项目使用 `git+https://github.com/gooderno1/codex-usage-core.git#v0.1.0-dev.2` 依赖，锁定明确 Git tag，避免换设备后依赖相邻本地目录。
2. 后续稳定期：核心包可切换为正式 npm 包版本；两个项目仍需锁定明确版本，避免隐式漂移。

## 5. AGENTS 协作规则改造

### 5.1 `codex-usage-core/AGENTS.md`

核心包 `AGENTS.md` 必须基于当前 `codex-companion` 的协作规则建立，并保留以下原则：

- 全程中文交流、说明和用户可见文案。
- 文档先行，先统一数据来源、字段含义、统计口径和验证样例，再改实现。
- 本项目专注 Codex，不规划 Claude Code、Cursor、GitHub Copilot 等 provider。
- 明确非官方工具边界，不使用 OpenAI 或 Codex 官方背书资产。
- 不提交原始 Codex session、用户输入正文、模型输出正文、私有仓库源码或敏感绝对路径。
- 每次有效修改必须更新 `DEVELOPMENT_LOG.md`。
- 版本号使用 `vX.Y.Z-dev.N` 与正式版 `vX.Y.Z`。
- 提交前至少执行核心包定义的构建、测试和快照校验命令。
- 每次核心包升级后，必须同步升级依赖项目：
  - `codex-companion`
  - `dev-ledger`
- 如果当轮无法同步升级任一依赖项目，必须在核心包开发记录中明确阻塞原因、受影响版本和补救计划。

### 5.2 `codex-companion/AGENTS.md`

需要新增规则：

- 修改 Codex session 解析、token 增量、`rate_limits`、额度周期、reset 检测、`quotaEvidence` 或相关校验脚本前，先检查 `codex-usage-core` 是否存在更新。
- 如果规则属于共享核心职责，必须优先修改 `codex-usage-core`，再升级本项目依赖。
- 本项目只保留 UI 适配、设置、缓存、Electron 集成和快照映射逻辑。
- 开发记录必须写明当前使用的 `codex-usage-core` 版本。

### 5.3 `dev-ledger/AGENTS.md`

需要新增规则：

- 修改 Codex 用量账本、额度 reset、检测标准或验证脚本前，先检查 `codex-usage-core` 是否存在更新。
- 如果 `dev-ledger` 发现新 reset 样例或规则变化，先在核心包补 fixture、测试和实现，再升级 `dev-ledger`。
- 不在 `dev-ledger` 内长期保留与核心包重复的 reset engine。
- 开发记录必须写明当前使用的 `codex-usage-core` 版本。

## 6. 实施顺序

### 阶段 0：建立迁移基线

- 在 `codex-companion` 新增本规划文档。
- 将 `codex-companion` 版本提升到规划版本。
- 记录核心包目标路径与远端仓库。
- 暂不改运行时代码。

### 阶段 1：创建核心包仓库

- 在 `D:\MyFile\Obisidian\LifeInHand\1. 项目\个人品牌-学习进步\CodeLib\MyCode\codex-usage-core` 初始化项目。
- 配置远端：[gooderno1/codex-usage-core](https://github.com/gooderno1/codex-usage-core)。
- 基于当前 `codex-companion` 的 AGENTS 规则创建核心包 `AGENTS.md`。
- 建立 `README.md`、`DEVELOPMENT_LOG.md`、`package.json`、TypeScript 构建与测试脚本。

### 阶段 2：抽取核心类型与 reset engine

- 从两个项目对齐 `QuotaResetEvent`、`QuotaResetEvidence`、`QuotaCycleObservation` 等类型。
- 抽取 reset 候选、稳定确认、漂移排除、边界去重逻辑。
- 用脱敏 fixture 覆盖至少三个样例：
  - 高水位下降 reset。
  - 边界贴近低水位 reset。
  - `2026-06-30T03:56:42.332Z` 稳定边界回看 reset。
- 固化 `2026-06-24` 低用量滑动窗口漂移排除样例。

### 阶段 3：抽取 Codex session 与 token 用量解析

- 抽取 JSONL 解析、`total_token_usage` 差值、`last_token_usage` 降级和 `rate_limits` 提取。
- 输出不包含原始正文的标准化事件。
- 建立文件签名与增量缓存接口，但不强制核心包管理 Electron `userData`。

### 阶段 4：集成 `codex-companion`

- 将核心包加入依赖。
- 删除或收敛本项目中重复的 reset engine。
- 在主进程 collector 中调用核心包输出，再映射为 `DashboardSnapshot`。
- 更新数据契约、UI Contract、组件映射和开发记录。
- 执行本项目验证：
  - `npm run typecheck`
  - `npm run build`
  - `npm run verify:quota`
  - `npm run verify:ledger`
  - live 快照抽查当前周边界和历史 reset event

### 阶段 5：集成 `dev-ledger`

- 将核心包加入依赖。
- 删除或收敛 `dev-ledger` 内重复的 Codex reset 规则。
- 保留 `dev-ledger` 自身账本输出与报告层。
- 更新 `dev-ledger` 开发记录、数据合同和验证脚本。
- 用同一批核心包 fixture 与本地真实聚合结果验证输出一致。

### 阶段 6：建立依赖升级闭环

- 两个上层项目的 `AGENTS.md` 增加核心包最新性检查。
- 核心包 `AGENTS.md` 增加下游升级要求。
- 核心包每次行为变更都发布明确版本。
- 两个上层项目每次升级核心包都独立提交：
  - 版本号升级。
  - 依赖锁文件更新。
  - 开发记录说明核心包版本。
  - 运行项目本地验证。

## 7. 验证标准

核心包首版完成时必须满足：

- `codex-usage-core` 自身构建和测试通过。
- 核心包脱敏 fixture 能覆盖相邻下降、边界贴近、稳定边界回看和漂移排除。
- `codex-companion` 集成后，当前周额度边界、历史 reset event 和 `verify:quota / verify:ledger` 输出与迁移前一致或更准确。
- `dev-ledger` 集成后，最新 reset 检测样例继续通过。
- 三个仓库的 `AGENTS.md` 均包含核心包依赖检查与反向升级规则。
- 三个仓库的 `DEVELOPMENT_LOG.md` 均记录本次迁移或依赖升级结果。

## 8. 风险与处理

- 风险：核心包抽取范围过大，导致两个项目同时阻塞。
  - 处理：先抽 reset engine 和共享类型，再抽 session parser。
- 风险：两个项目快照结构不同。
  - 处理：核心包输出稳定领域对象，上层项目各自做 UI 或账本适配。
- 风险：脱敏样例不足以覆盖真实异常。
  - 处理：新增规则必须先补脱敏 fixture；不能提交原始 session。
- 风险：核心包升级后下游未及时跟进。
  - 处理：用 AGENTS、开发记录和依赖矩阵强制记录；核心包升级任务不算完成，直到两个下游项目完成依赖升级或明确阻塞。

## 9. 本轮不执行

- 不创建 `codex-usage-core` 仓库。
- 不修改 `dev-ledger`。
- 不修改 `codex-companion` 运行时代码。
- 不引入云端服务或远程同步。
- 不发布核心包版本。

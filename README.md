# Codex Companion

`Codex Companion`（中文名：`Codex 伴侣`）是一个面向 Codex 重度用户的非官方开源桌面伴侣，用于在本机查看 Codex 额度、Token、API 等价成本和本地 Git 代码活动。

> 本项目是非官方工具，不隶属于 OpenAI，也不代表 OpenAI 或 Codex 官方产品。
> 本项目采用 local-first 设计，首版不上传原始 Codex session 文件，也不读取 GitHub 云端元数据。

## 当前状态

- 当前版本：`v0.3.7`
- 当前定位：内部正式版，重点验证新用户使用路径、Git 缺失降级说明、Git for Windows 安装指引、刷新历史返回和设置页授权边界。
- 当前平台：优先支持 Windows 桌面应用；源码开发可在具备 Electron 环境的系统上尝试运行。
- 桌面挂件：相关代码已保留，但公开预览版暂时禁用，后续单独验证后再开放。

## 当前能力

- 读取本机 `~/.codex/sessions` 与 `~/.codex/archived_sessions`。
- 解析 `token_count`、`turn_context.model`、`rate_limits` 等字段。
- 展示今日、近 7 日、自然周、自然月的 Token、会话数、API 等价成本和代码改动。
- 展示 5 小时额度窗口、周额度窗口和可观测月额度状态。
- 展示 Codex 赠送重置次数，支持查看每次重置的观测获取时间、预计过期时间和建议使用时间；当前口径默认排除已使用的 `2026-06-11` seed，首次未知 credit 按 `2026-06-14` 假定，`2026-06-30` 公开补偿和后续本地观测新增按 30 天有效期估算。
- 后台刷新、启动刷新和手动刷新后按本机快照触发提醒：顶部铃铛保留快速摘要，通知页支持筛选、分页、详情和标记已读；赠送重置过期提醒只在提前 `7 天 / 3 天 / 1 天 / 12 小时 / 1 小时` 各提醒一次，额度提醒在对应周期阈值到达时提醒一次。
- 按模型聚合自然月 Token 与 API 等价成本。
- 按 Git 仓库归因 Codex 会话，并展示仓库提交、增删行与近期提交。
- 设置页按单列展示新用户使用路径、Codex 数据目录、仓库根目录、计费月起始日、Git 本机身份状态、刷新历史摘要和本机数据边界；完整刷新历史在独立页面分页查看，并可返回设置页。
- 刷新时展示采集阶段、耗时、新解析文件数与缓存复用数。
- 使用本地增量缓存复用未变化的 Codex JSONL 解析结果，减少重复刷新耗时。

## 普通用户快速开始

内测成员可从 GitHub Releases 下载最新 Windows 安装包。

1. 打开 [Releases](https://github.com/gooderno1/codex-companion/releases)。
2. 下载最新版本中的 Windows 安装包。
3. 启动应用，确认左侧显示 `非官方 Codex 本机仪表盘` 和 `本机读取 · 无上传`。
4. 进入 `设置`，确认 Codex 数据目录和仓库根目录。
5. 点击 `刷新`，等待应用完成 Codex session 与 Git 仓库采集。

如需从源码调试，可按“开发者本地运行”从本地开发环境启动。

## 首次配置

首次启动会先自动检测默认数据源：

- Codex 数据目录：`CODEX_HOME` 或当前用户目录下的 `.codex`
- Git 仓库根目录：常见代码目录，例如 `Documents\Projects`、`source`、`Code`

检测成功时应用会直接使用默认路径并开始首次扫描。首次扫描需要解析 Codex 会话文件并遍历 Git 仓库，耗时会明显长于后续刷新。检测失败时，主界面会提示打开设置手动选择目录。

如果本机没有安装 Git，Codex 用量、额度、赠送重置和通知仍可使用；代码仓库页、提交数、增删行和仓库归因会暂不可用。设置页和代码仓库页会提供 Git for Windows 下载入口，安装后重启应用或点击刷新即可重新检测。

### Codex 数据目录

安装包不会携带任何开发者本机 Codex 数据。应用默认读取：

- Windows：`%USERPROFILE%\.codex\sessions`
- Windows：`%USERPROFILE%\.codex\archived_sessions`

如果你的 Codex 数据位于自定义目录，进入 `设置 -> Codex 数据目录`：

- 可手动输入 `.codex` 目录路径。
- 可点击 `选择目录` 使用系统目录选择器。
- 可点击 `恢复默认路径` 回到 `CODEX_HOME` 或当前用户目录下的 `.codex`。
- 保存后会立即重新读取 Codex sessions、archived_sessions 和 rate_limits。

也可以在启动应用前设置 `CODEX_HOME` 环境变量，作为首次默认路径。

### Git 仓库根目录

应用会自动尝试发现常见目录，例如：

- `%USERPROFILE%\Documents\Codex`
- `%USERPROFILE%\Documents\Projects`
- `%USERPROFILE%\source`
- `%USERPROFILE%\projects`
- `%USERPROFILE%\code`
- `%USERPROFILE%\Code`

如果代码仓库不在这些目录，进入 `设置 -> 仓库根目录`：

- 可手动输入目录路径，多个路径用分号或换行分隔。
- 可点击 `选择目录` 使用系统目录选择器。
- 保存后会立即重新扫描 Git 仓库并刷新代码仓库页。

### 本机 Git 安装

Codex Companion 不要求登录 GitHub，但代码仓库统计需要本机 `git` 命令。Windows 用户可安装 Git for Windows：`https://git-scm.com/download/win`。安装完成后重启应用或点击刷新，再在设置页确认仓库根目录。

## 数据来源

- Codex 本地会话：`sessions` 与 `archived_sessions` 中的 JSONL 文件。
- Codex 额度快照：JSONL 中的 `rate_limits`。
- Git 仓库：会话 `cwd` 反推仓库根目录，以及用户配置的本地仓库根目录。
- 本地配置与快照：Electron `userData` 目录，例如 Windows 下通常位于 `%APPDATA%\codex-companion`。
- 本机通知状态：`notification-state.json`，保存提醒 key、标题、正文、类别、级别、触发时间、系统通知时间和已读时间；固定里程碑 key 用于避免 5 分钟自动刷新反复提醒，也用于通知页展示详情。
- Windows 应用图标：`build/app-icon.ico`，由本项目自定义 `BrandMark` 几何生成，用于安装包、主窗口和托盘图标。

## 隐私边界

- 不上传原始 Codex session 文件。
- 不上传仓库源码。
- 不上传仓库名、路径、模型明细或成本数据到云端。
- 当前版本不检测 GitHub 登录、不请求 GitHub token；设置页的 Git 与授权区只展示本机 `git` 命令、`user.name` 和 `user.email` 状态，并说明后续接入 GitHub 云端能力时再提供授权引导。
- 增量缓存只保存 JSONL 文件路径、`size`、`mtimeMs` 和解析后的聚合统计结果，不保存用户输入正文或模型输出正文。
- 应用内提醒和系统通知只使用聚合后的额度余量、赠送重置估算时间和本机快照状态，不包含账号、邮箱、原始 app-server 响应、用户输入正文或模型输出正文。

完整说明见 [PRIVACY.md](./PRIVACY.md)。

## 估算边界

- API 等价成本基于公开 API 定价估算，不代表真实扣费。
- Codex credits 估算基于公开 rate card，仅用于价值折算与趋势感知。
- 可观测月额度依赖 Codex 本地快照是否暴露月级别字段；当前若无字段则明确标记为未观测。
- Git 代码活动基于本地 Git 历史和当前工作区 diff，不读取 GitHub 远端元数据。

## 常见排障

### 页面显示未观测

- 确认本机存在 Codex 会话文件。
- 确认最近 60 天内的 JSONL 文件包含 `token_count` 记录。
- 点击右上角 `刷新`，查看刷新反馈中的新解析文件数和复用文件数。

### 代码仓库页为空

- 如果设置页提示未检测到本机 Git，先安装 Git for Windows。
- 进入 `设置 -> 仓库根目录` 添加包含 Git 仓库的上级目录。
- 确认目标目录下存在 `.git`。
- 确认本机可以执行 `git` 命令。

### 周额度或月额度显示异常

- 周额度来自 Codex 本地 `rate_limits` 的可观测快照和重置证据。
- 月额度只有在 Codex 原始数据暴露稳定月级窗口时才会显示为已观测。
- 自然月 Token 或计费月 Token 不等同于官方月额度。

## 开发者本地运行

```bash
npm ci
npm run dev
```

生产构建与本地启动：

```bash
npm run build
npm start
```

Windows 打包安装版：

```bash
npm run package:win
```

提交前至少执行：

```bash
npm run build
git diff --check
```

## 技术栈

- Electron
- React + TypeScript + Vite
- 本地 JSON 快照存储
- 本机 Git 命令与 Codex session JSONL 解析

## 项目资料

- 协作规范：[AGENTS.md](./AGENTS.md)
- 公开开源完善规划：[docs/open-source-readiness-plan-2026-06-30.md](./docs/open-source-readiness-plan-2026-06-30.md)
- 当前规划：[docs/project-development-plan-2026-06-02.md](./docs/project-development-plan-2026-06-02.md)
- 数据契约：[docs/data-contract-v0.2.md](./docs/data-contract-v0.2.md)
- 隐私说明：[PRIVACY.md](./PRIVACY.md)
- 版本进展：[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT

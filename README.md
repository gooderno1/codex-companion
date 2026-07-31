# Codex Companion

`Codex Companion`（中文名：`Codex 伴侣`）是一个面向 Codex 重度用户的非官方开源桌面伴侣，用于在本机查看 Codex 额度、Token、API 等价成本和本地 Git 代码活动。

> 本项目是非官方工具，不隶属于 OpenAI，也不代表 OpenAI 或 Codex 官方产品。
> 本项目采用 local-first 设计，不上传原始 Codex session 文件，也不读取用户仓库的 GitHub 云端元数据；当前额度只通过 Codex 官方 Usage 接口读取。

## 当前状态

- 当前正式版本：`v0.4.6`；当前额度优先读取 Codex 官方 Usage，失败时回退本地 session 快照。
- 当前定位：公开预览正式版；已接入 Windows 稳定版更新检查、设置页更新状态和 GitHub Release 元数据链路。
- 当前平台：优先支持 Windows 桌面应用；源码开发可在具备 Electron 环境的系统上尝试运行。
- 桌面挂件：相关代码已保留，但公开预览版暂时禁用，后续单独验证后再开放。
- 自动升级：Windows NSIS 安装版从固定 GitHub stable Release 自动检查和下载；`v0.4.2` 起，用户点击“重启并安装”后由独立本机 helper 等待旧进程退出，再运行 NSIS 并重新打开应用。
- 代码签名：SignPath Foundation 申请截至 2026-07-28 未取得签名项目配置；Release 继续保持未签名状态，Windows 仍可能显示未知发布者或 SmartScreen 提示。

## 当前能力

- 读取本机 `~/.codex/sessions` 与 `~/.codex/archived_sessions`。
- 解析 `token_count`、`turn_context.model`、`rate_limits` 等字段，并读取 Codex 官方 Usage 当前额度。
- 展示今日、近 7 日、自然周、自然月的 Token、会话数、API 等价成本和代码改动。
- 当前额度优先取 Codex 官方 Usage 响应，失败时回退本地 session 中的 `rate_limits`；按窗口时长识别 5 小时额度与周额度，不固定绑定 `primary / secondary`。官方当前未返回 5H 时明确显示“未观测”，不会用历史值或 7 天窗口冒充。
- 展示 Codex 赠送重置次数；新版 Codex 返回逐笔明细时直接展示官方获取时间和到期时间，明细缺失或被截断的库存继续按本地观测与 30 天规则估算，并明确标注来源。
- 后台刷新、启动刷新和手动刷新后按本机快照触发提醒：点击 Windows 系统通知或顶部单条“查看详情”会唤起主窗口、进入通知页并选中对应消息；顶部铃铛保留快速摘要，通知页支持筛选、分页、详情和标记已读；赠送重置过期提醒只在提前 `7 天 / 3 天 / 1 天 / 12 小时 / 1 小时` 各提醒一次，额度提醒在对应周期阈值到达时提醒一次。
- 按模型聚合自然月 Token 与 API 等价成本。
- 按 Git 仓库归因 Codex 会话，并展示仓库提交、增删行与近期提交。
- 设置页按单列展示新用户使用路径、Codex 数据目录、仓库根目录、计费月起始日、Git 本机身份状态、刷新历史摘要和本机数据边界；完整刷新历史在独立页面分页查看，并可返回设置页。
- 刷新时展示采集阶段、耗时、新解析文件数与缓存复用数。
- 使用本地增量缓存复用未变化的 Codex JSONL 解析结果，减少重复刷新耗时。
- 启动约 15 秒后检查 Windows 稳定版更新，运行期间每 6 小时低频检查；设置页展示当前/可用版本、检查时间、Release 说明和错误降级入口。

## 普通用户快速开始

用户可从 GitHub Releases 下载最新 Windows 安装包。当前安装包尚未配置可信 Windows 代码签名，安装时可能出现系统安全提示，请只从本仓库 Releases 下载并核对 SHA256。

1. 打开 [Releases](https://github.com/gooderno1/codex-companion/releases)。
2. 下载最新版本中的 Windows 安装包。
3. 启动应用，确认左侧显示 `非官方 Codex 本机仪表盘` 和 `本机数据 · 官方额度只读`。
4. 进入 `设置`，确认 Codex 数据目录和仓库根目录。
5. 点击 `刷新`，等待应用完成 Codex session 与 Git 仓库采集。

如需从源码调试，可按“开发者本地运行”从本地开发环境启动。

### 卸载

- 打开 Windows `设置 -> 应用 -> 已安装的应用`，找到 `Codex Companion` 后选择“卸载”。
- 也可以从应用安装目录运行 NSIS 生成的卸载程序。
- 卸载应用不会主动删除 Electron `userData` 中的本机设置、聚合快照和通知历史；如需彻底清理，可在确认不再需要后手动删除 `%APPDATA%\codex-companion`。

## 应用更新

- 已发布的 `v0.4.0` 把自动安装门禁编译为关闭状态，无法通过远端配置打开；升级到 `v0.4.1` 仍需手动安装一次。
- 从首个 updater-enabled 正式版开始，应用会按稳定通道检查公开 GitHub Release。
- 设置页“应用更新”卡片可控制自动检查和自动下载、手动重试、查看更新说明或打开 Releases；版本、状态、进度和错误保持可见，不再堆叠解释性小字。
- 当前安装包尚未配置可信 Windows 代码签名；自动下载使用固定公开 Release 更新源和 `latest.yml` 文件哈希，Windows 仍可能显示未知发布者或 SmartScreen 提示。
- 未签名阶段不会在普通退出时安装。用户明确点击“重启并安装”后，主进程通过当前用户的临时 Windows 计划任务启动受控外部 helper；helper 校验安装包必须位于 `electron-updater` 缓存且文件名与目标版本一致，等待旧进程退出后以 `--updated /S --force-run` 执行 NSIS，并在结束时删除临时任务。
- `v0.4.1` 内置的仍是旧安装交接逻辑，无法被远端改写；首次切换到包含外部 helper 的正式版时，如旧链路未能完成安装，需要从 Releases 手动安装一次。之后的更高版本才使用新 helper。
- 更新请求只访问本仓库公开 Release，不携带 GitHub token，也不上传 Codex session、仓库路径、模型或额度数据。

## Code signing policy

完整政策见 [CODE_SIGNING_POLICY.md](./CODE_SIGNING_POLICY.md)。

> Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

- Authors / Committers、Reviewers、Approvers 当前均由 Jackie Lee（[@gooderno1](https://github.com/gooderno1)）承担；外部贡献必须经过 Pull Request 审查，每次签名请求必须人工批准。
- 只允许签署从本仓库正式 `vX.Y.Z` tag 经受信 GitHub Actions 自动构建的 `Codex Companion.exe` 和 Windows NSIS 安装包，不使用本项目订阅重新签署上游二进制。
- 所有本项目签名产物必须把产品名固定为 `Codex Companion`，文件版本与产品版本必须和 `package.json`、Git tag 保持一致。
- 当前申请仍在审核中；已有 `v0.4.0` 安装包不会因建立本政策而自动获得签名。

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
- Codex 当前额度：Codex 官方桌面端同源的 `https://chatgpt.com/backend-api/wham/usage` 只读响应；仅在主进程内使用本机 Codex 登录凭据完成鉴权。
- Codex 额度历史与回退：JSONL 中的 `rate_limits`，继续用于本地周期证据、reset 检测，以及官方 Usage 请求失败时的降级显示。
- Codex 赠送重置：本机 app-server `account/rateLimits/read` 的 `rateLimitResetCredits.availableCount / credits[]`；只读，不调用 consume。
- Git 仓库：会话 `cwd` 反推仓库根目录，以及用户配置的本地仓库根目录。
- 本地配置与快照：Electron `userData` 目录，例如 Windows 下通常位于 `%APPDATA%\codex-companion`。
- 本机通知状态：`notification-state.json`，保存提醒 key、标题、正文、类别、级别、触发时间、系统通知时间和已读时间；固定里程碑 key 用于避免 5 分钟自动刷新反复提醒，也用于通知页展示详情。
- Windows 应用图标：`build/app-icon.ico`，由本项目自定义 `BrandMark` 几何生成，用于安装包、主窗口和托盘图标。

## 隐私边界

- 不上传原始 Codex session 文件。
- 不上传仓库源码。
- 不向本项目或第三方服务器上传仓库名、路径、模型明细或成本数据。
- 当前额度请求只发往 Codex 官方 `chatgpt.com`：访问令牌与账号 ID 仅在主进程内存中用于鉴权，不写入快照、不传给 renderer、不记录日志。
- 当前版本不检测 GitHub 登录、不请求 GitHub token；设置页的 Git 与授权区只展示本机 `git` 命令、`user.name` 和 `user.email` 状态，并说明后续接入 GitHub 云端能力时再提供授权引导。
- 增量缓存只保存 JSONL 文件路径、`size`、`mtimeMs` 和解析后的聚合统计结果，不保存用户输入正文或模型输出正文。
- 应用内提醒和系统通知只使用聚合后的额度余量、赠送重置官方/估算到期时间和本机快照状态，不包含账号、邮箱、原始 app-server 响应、用户输入正文或模型输出正文。

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

### 5H、周额度或月额度显示异常

- 5H 与周额度优先来自 Codex 官方 Usage；官方请求失败时回退本地 `rate_limits`。
- 窗口按 `300 / 10080` 分钟自适应识别。官方当前没有返回某个窗口时，该卡显示“未观测”，不会沿用已经失效的历史值。
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
- 自动升级开发规划：[docs/auto-update-development-plan-2026-07-15.md](./docs/auto-update-development-plan-2026-07-15.md)
- 当前规划：[docs/project-development-plan-2026-06-02.md](./docs/project-development-plan-2026-06-02.md)
- 数据契约：[docs/data-contract-v0.2.md](./docs/data-contract-v0.2.md)
- 隐私说明：[PRIVACY.md](./PRIVACY.md)
- Code signing policy：[CODE_SIGNING_POLICY.md](./CODE_SIGNING_POLICY.md)
- 安全策略：[SECURITY.md](./SECURITY.md)
- 版本进展：[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT

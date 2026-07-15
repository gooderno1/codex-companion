# Codex Companion 公开开源完善规划

## 状态更新（2026-07-15）

- 已对当前跟踪文件和完整 Git 提交历史执行常见密钥、token、私钥与敏感文件名检查，未发现命中项。
- 已将历史文档中的开发机绝对路径和 Windows 用户目录改为脱敏占位写法。
- 已复核跟踪的设计截图，内容为产品设计/演示数据，没有 Codex 原始会话正文、访问令牌或本机绝对路径。
- GitHub 仓库已切换为 public；既有 tag、Release、Actions 历史和源码随之公开。
- 自动升级不再作为笼统后续项，详细范围与签名门禁见 `docs/auto-update-development-plan-2026-07-15.md`。

- 创建时间：2026-06-30
- 创建时版本基线：`v0.3.0-dev.9`
- 需求主题：将当前已较完整的 Codex Companion 整理为外部用户可下载、可理解、可反馈、可贡献的公开开源项目
- 影响页面：设置页、README、Release 说明、贡献说明、隐私说明、GitHub issue / PR 流程、CI / 打包流程
- 关键设计约束：继续保持 Codex 专用、非官方声明、本机读取、无上传、中文优先；不引入多 provider 路线；不使用 OpenAI / Codex 官方视觉资产；不把估算成本伪装成真实扣费
- 相关数据源：Codex 本地 `sessions` / `archived_sessions`、Codex `rate_limits`、本地 Git 仓库、Electron `userData` 配置与快照

## 1. 当前状态判断

- 源码可构建：`npm run build` 已覆盖 lint、TypeScript 类型检查、renderer build、main build。
- 基础文档已存在：`README.md`、`PRIVACY.md`、`CONTRIBUTING.md`、`ROADMAP.md`、`RELEASE_NOTES.md`、`LICENSE`。
- 隐私边界较清晰：首版不上传原始 Codex session，不上传仓库源码，不请求 GitHub token。
- 外部使用闭环不足：README 仍偏开发者视角，缺少普通用户安装、首次配置和排障路径。
- 发布可信度不足：当前无正式 Release，Release 记录未覆盖当前 `v0.3.0-dev.9`，GitHub 远端还未具备公开项目元信息与 release 资产。
- 设置入口不足：仓库根目录主要依赖默认路径和 `CODEX_COMPANION_REPO_ROOTS`，普通用户不易让仓库页命中真实项目。
- 协作基础设施不足：`.github` 只有 issue 模板，缺少 CI、PR 模板、安全策略和发布打包工作流。
- 功能说明需校准：主进程当前禁用桌面挂件，README 不应继续把挂件描述为公开可用能力。

## 2. 完善目标

### 2.1 普通用户

- 能从 README 明确知道项目是非官方工具、目前支持的平台和数据来源。
- 能通过 GitHub Release 下载安装包或便携包。
- 首次启动后能在设置页配置 Git 仓库根目录。
- 没有数据时能按文档排查 Codex 会话目录、Git 仓库目录和刷新状态。
- 能理解 API 等价成本、Codex credits 和月额度都是估算或可观测字段，不代表官方账单。

### 2.2 贡献者

- 能通过 `npm ci`、`npm run dev`、`npm run build` 复现本地开发。
- 提交前知道需要同步数据契约、UI Contract、开发记录和验证命令。
- PR 能自动跑基础 CI，减少只靠人工检查。
- issue / PR 模板提醒不要上传原始 session、仓库源码或敏感路径。

### 2.3 维护者

- 能用明确的 Release checklist 产出版本说明、构建产物和升级注意事项。
- 能用 GitHub Actions 复用 Windows 打包流程。
- 能持续追踪剩余公开化事项，例如代码签名、自动更新、跨平台打包、测试覆盖。

## 3. 本轮实施范围

本轮先处理不依赖外部账号授权、证书采购或 GitHub 可见性切换的事项。

1. 新增本规划文档，作为公开开源完善主线。
2. 将版本提升到 `v0.3.0-dev.10`，补齐项目元信息。
3. README 改为同时面向普通用户和开发者，补安装、首次配置、排障和当前功能边界。
4. 设置页新增仓库根目录配置，支持手动输入、系统目录选择、移除、保存并刷新。
5. 主进程新增目录选择 IPC，保持 renderer 仍通过 preload 的受控 API 访问系统能力。
6. 更新设置存储归一化逻辑，保存仓库根目录时去重、去空，并保留自动发现默认路径回退。
7. 新增 GitHub CI workflow，覆盖 `npm ci`、`npm run build`、`git diff --check`。
8. 新增 Windows 打包 workflow，支持手动或 tag 触发并上传 `release/` 产物。
9. 新增 `SECURITY.md`、`CODE_OF_CONDUCT.md` 和 PR 模板。
10. 更新 `CONTRIBUTING.md`、`ROADMAP.md`、`RELEASE_NOTES.md` 和 `DEVELOPMENT_LOG.md`。

## 4. 本轮不直接执行的事项

- 本规划实施当时不直接切换 GitHub 可见性；该所有者级别决策已于 2026-07-15 在公开风险复核后单独完成。
- 不配置代码签名证书；证书主体、采购和密钥保管需要维护者决策。
- 本规划实施当时不启用自动更新；2026-07-15 已另建正式开发规划，生产自动安装仍以可信 Windows 代码签名为门槛。
- 不重新开放桌面挂件；主进程当前显式禁用，应先做公开版说明校准，再单独排期验证挂件交互。
- 不引入多 provider 支持；继续保持 Codex 专用。

## 5. 实施顺序

1. 文档基线：新增本规划，明确范围和非范围。
2. 元信息：更新版本号、package metadata、README、Release、Roadmap。
3. 用户配置：补设置页仓库根目录配置、主进程目录选择和设置归一化。
4. 协作流程：补 CI、打包 workflow、PR 模板、安全与行为准则。
5. 验证：执行 `npm run build` 和 `git diff --check`。
6. Git 同步：检查变更、更新开发记录、提交并在远端可用时推送。

## 6. 发布前检查清单

- `npm run build` 通过。
- `npm run package:win` 能产出 Windows 安装包和便携包。
- README 顶部有下载入口、非官方声明、隐私边界和首次配置步骤。
- Release notes 覆盖进入本次 release 的开发版本。
- GitHub repo 描述、topics、homepage、license、issue、PR、security 页面完整。
- GitHub Release 上传安装包、便携包和校验信息。
- 公开前确认截图不包含真实用户名、绝对敏感路径、私有仓库名或 session 内容。

## 7. 后续路线

1. 增加 collector 层自动化测试，优先覆盖 JSONL 解析、`rate_limits` 缺失、仓库归因和计费窗口。
2. 增加脱敏 sample data，方便外部贡献者在没有真实 Codex 历史的情况下复现页面状态。
3. 增加应用内“打开数据目录”“打开隐私说明”“导出诊断摘要”能力，避免用户反馈时上传敏感原始文件。
4. 完成 Windows 代码签名和 SmartScreen 说明。
5. 评估 macOS / Linux 打包支持，但不改变 Windows 优先的公开预览节奏。
6. 单独排期桌面挂件公开化，验证点击穿透、锁定、隐私模式、多屏和全屏行为。

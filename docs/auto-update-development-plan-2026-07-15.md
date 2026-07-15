# Codex Companion 自动升级功能开发规划

## 实施状态（2026-07-15）

- `v0.4.0-dev.1` 已完成主进程 `UpdateService`、更新状态合同、设置迁移、IPC/preload、设置页更新卡片、全局提示、详情/进度弹层和错误脱敏。
- Windows 构建已生成安装包、`latest.yml`、blockmap 和包内 `app-update.yml`；Release workflow 已增加 tag/版本校验、draft 发布、资产完整性和 SHA256 生成。
- `npm ci` 已修复此前公开 CI 暴露的 lockfile 缺项，CI 增加 `npm run verify:updater`。
- 1360×900 开发态与 packaged 设置页已人工检查；packaged 构建可真实访问 GitHub update feed。
- 当前安装包 Authenticode 为 `NotSigned`，因此 `canAutoInstall=false`；生产自动下载/安装仍等待可信 Windows 代码签名和两个连续 updater-enabled 版本的端到端验收。

- 创建时间：2026-07-15
- 创建时版本基线：`v0.3.9`
- 目标开发版本：`v0.4.0-dev.1` 起
- 需求主题：基于公开 GitHub Releases，为 Windows NSIS 安装版提供可感知、可控制、可追踪的自动升级能力
- 影响页面：设置页、全局更新提示、退出安装确认；不新增一级侧栏页面
- 关键设计约束：Codex 专用、非官方声明、本机数据不上传、Windows 优先、稳定通道优先、用户确认安装、失败可恢复、生产自动安装以可信代码签名为上线门槛
- 相关数据源：应用 `package.json` 版本、Electron `app.getVersion()`、GitHub Release、`latest.yml`、NSIS 安装包与 blockmap、Electron `userData` 中的更新设置与状态

## 1. 当前基线与问题

- 当前使用 Electron、React、TypeScript、Vite 与 `electron-builder`，Windows 打包目标已经是 NSIS。
- 当前 GitHub workflow 只构建并上传 Actions artifact，没有生成可供已安装应用消费的稳定发布闭环。
- 当前 Release 只包含安装包，没有 `latest.yml` 和 blockmap，应用主进程也没有更新服务或更新 IPC。
- 当前设置页已有本机数据源、计费口径、Git 状态和刷新历史，适合追加“应用更新”卡片。
- 当前安装包没有可信 Windows 代码签名。可先开发和验证更新链路，但生产自动下载与安装必须在签名方案落地后启用。
- `package.json` 当前为 `private: true`，该字段只阻止误发布到 npm，不影响 GitHub 仓库公开，也不需要为自动升级移除。

## 2. 产品目标

### 2.1 用户目标

- 启动应用后自动检查稳定版更新，不干扰首屏和本机数据采集。
- 在设置页随时看到当前版本、更新通道、最近检查时间和更新状态。
- 有新版本时看到版本号、发布时间、摘要、安装包大小和明确的操作按钮。
- 下载过程可见进度、速度和已下载大小；下载失败可重试，不影响现有功能。
- 下载完成后由用户选择“立即重启并安装”或“稍后”，不强制打断工作。
- 退出应用时仅在更新已完整下载并校验通过后执行安装。

### 2.2 维护者目标

- 推送正式 tag 后，由 GitHub Actions 构建唯一的一组 Windows 发布资产。
- tag、`package.json` 版本、应用版本、Release 版本和更新元数据保持一致。
- Release 发布前可验证安装包、`latest.yml`、blockmap、SHA256 和更新说明齐全。
- 可以从一个已安装旧版本完成“检查 -> 下载 -> 重启安装 -> 新版本启动”的端到端验收。
- 更新失败、取消或坏版本时有清晰的处置与修复版本发布路径。

## 3. 范围与非范围

### 3.1 首版范围

- 平台：Windows x64 NSIS 安装版。
- 通道：仅 `stable`，对应 GitHub 正式 Release；draft 和 prerelease 不进入稳定通道。
- 检查方式：启动后延迟检查、运行期间低频检查、设置页手动检查。
- 下载方式：签名和生产门禁通过后支持自动下载；安装必须由用户确认。
- 发布源：公开仓库 `gooderno1/codex-companion` 的 GitHub Releases。
- 状态展示：设置页更新卡片、全局可关闭提示、下载/安装确认弹层。
- 记录：本机保存最近检查时间、已忽略版本和最近错误摘要，不保存 GitHub token。

### 3.2 首版不做

- 不支持 macOS、Linux、便携版 exe 或 Microsoft Store 包自动升级。
- 不支持 beta、nightly、多通道切换和跨通道降级。
- 不做强制更新、后台静默安装或未经确认的自动重启。
- 不自建更新服务器，不上传 Codex session、仓库路径、模型明细或用量数据。
- 不把应用更新事件混入额度/赠送重置通知历史；两类通知口径分离。
- 不承诺从 `v0.3.9` 直接自动升级；自动升级只能从首个内置 updater 的版本升级到更高版本。

## 4. 核心交互与页面规划

### 4.1 设置页“应用更新”卡片

位置：放在“新用户使用路径”之后、“Codex 数据目录”之前。版本和安装安全性属于应用级信息，应先于数据源配置出现。

固定字段：

- 当前版本：使用主进程 `app.getVersion()`，不由 renderer 自行读取 package 文件。
- 更新通道：首版固定显示“稳定版”。
- 自动检查：默认开启，可关闭；关闭后仍保留“检查更新”。
- 自动下载：签名门禁通过后默认开启，可关闭；未签名开发构建显示不可用原因。
- 最近检查：显示本机时间；从未检查时显示“尚未检查”。
- 当前状态：使用统一状态文案，不直接暴露底层异常堆栈。

主要按钮按状态切换：

| 状态 | 主按钮 | 次按钮/说明 |
| --- | --- | --- |
| `idle` / `up-to-date` | 检查更新 | 显示最近检查时间 |
| `checking` | 检查中 | 按钮禁用，可取消等待但不终止应用 |
| `available` | 下载更新 | 查看更新说明、稍后提醒、忽略此版本 |
| `downloading` | 下载中 | 展示进度、速度、已下载/总大小 |
| `downloaded` | 重启并安装 | 稍后；退出时安装需再次遵循用户选择 |
| `error` | 重试 | 显示脱敏错误摘要和“打开 Releases”兜底 |
| `unsupported` | 打开下载页 | 说明当前安装类型不支持自动升级 |

### 4.2 全局更新提示

- 检测到新版本时，在主内容区顶部显示可关闭提示，不遮挡额度和仓库数据。
- 提示只展示“发现 vX.Y.Z”“查看详情”“下载更新”“稍后”。
- 用户忽略某个版本后，该版本不再主动弹出；手动检查仍可看到。
- 新版本号高于被忽略版本时重新提示。

### 4.3 下载与安装确认弹层

- 下载弹层展示版本、发布摘要、安装包大小、进度、速度和失败重试。
- 下载完成后展示“重启并安装”和“稍后”。
- 点击“重启并安装”前说明应用会关闭，当前本机配置与快照不受影响。
- 安装触发后不再运行新的刷新、通知或更新检查任务，避免退出竞态。

### 4.4 异常与降级文案

- 网络不可用：`暂时无法连接更新服务，现有功能不受影响。`
- GitHub 限流或服务异常：`更新服务暂时不可用，请稍后重试或打开 Releases。`
- 元数据缺失：`该版本的更新文件不完整，请从 Releases 手动下载安装。`
- 校验失败：`更新文件校验失败，已停止安装并删除本次下载。`
- 未签名/不受支持构建：`当前构建仅支持检查更新，请从 Releases 手动安装。`

## 5. 更新状态与数据契约

主进程维护唯一更新状态，renderer 只通过受控 IPC 读取和触发动作。

建议状态：

```ts
type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error"
  | "unsupported";
```

建议公开字段：

- `phase`：当前阶段。
- `currentVersion`：已安装版本。
- `availableVersion`：可用版本，没有则为 `null`。
- `releaseDate`：Release 发布时间，没有则为 `null`。
- `releaseNotes`：清洗后的纯文本或受控结构，不直接渲染远端 HTML。
- `progress`：百分比、每秒字节、已下载和总字节；非下载态为 `null`。
- `lastCheckedAt`：最近一次检查完成时间。
- `errorCode / errorMessage`：稳定错误码和脱敏中文摘要，不向 renderer 发送 token、请求头或本机下载路径。
- `canAutoInstall`：签名、平台、安装形态和打包态共同判断的能力标记。

建议设置字段：

- `updates.autoCheck: boolean`，默认 `true`。
- `updates.autoDownload: boolean`，签名生产构建默认 `true`，其他构建强制归一化为 `false`。
- `updates.ignoredVersion: string | null`。
- `updates.installOnQuit: boolean`，只在用户明确选择后写入，默认 `false`。

本机更新日志单独保存到 Electron 日志目录，最多保留有限大小和天数；不写入 Codex 原始数据、仓库名、绝对扫描路径、Git 身份或 GitHub 凭证。

## 6. 技术架构

### 6.1 主进程

新增独立 `UpdateService`，负责：

- 初始化 `electron-updater`，只在 `app.isPackaged` 且 Windows NSIS 安装态运行。
- 设置 `autoDownload` 和 `autoInstallOnAppQuit`，后者由明确用户选择控制。
- 监听 checking、available、not-available、download-progress、downloaded、error 事件。
- 将底层事件归一化为 `UpdateState` 并广播给所有窗口。
- 对并发检查和下载去重；一次只允许一个更新任务。
- 在应用退出流程中先停止定时检查，再执行已确认的安装。

建议文件影响：

- `src/main/updateService.ts`：更新服务与错误归一化。
- `src/main/index.ts`：生命周期、IPC、窗口广播和退出安装接线。
- `src/main/preload.ts`：暴露最小更新 API。
- `src/shared/contracts.ts`：状态、设置和 IPC 类型。
- `src/main/state/settingsStore.ts`：更新偏好归一化和迁移。

### 6.2 Renderer

- 在 `App.tsx` 增加更新状态订阅、更新动作和设置页卡片。
- 把卡片、提示条、进度弹层拆成独立组件，避免继续扩大单文件职责；实施时优先放到 `src/renderer/components/update/`。
- 在 `styles.css` 增加更新状态、进度条和弹层样式，沿用现有设计 token。
- 所有按钮都有 disabled/loading 状态；错误文案可复制但不包含底层堆栈。

### 6.3 IPC 边界

建议 API：

- `updates:get-state`
- `updates:check`
- `updates:download`
- `updates:install`
- `updates:set-preferences`
- `updates:open-release`
- `updates:state-changed`

renderer 不接触 `electron-updater`、GitHub token、任意下载 URL或文件路径。`open-release` 只允许打开已经校验为 `github.com/gooderno1/codex-companion/releases/...` 的 URL。

## 7. 检查与安装策略

- 启动检查：主窗口创建并完成首屏加载后延迟约 `15` 秒执行，避免与首次 Codex/Git 扫描争抢启动资源。
- 周期检查：自动检查开启时每 `6` 小时一次；不复用当前 5 分钟仪表板刷新定时器。
- 手动检查：始终可用；连续点击合并为同一个任务。
- 自动下载：只在正式打包、Windows NSIS、可信签名已启用且用户允许时执行。
- 自动安装：默认不自动重启；只有用户点击“重启并安装”或明确选择“退出时安装”后执行。
- 版本比较：遵循 SemVer，只接受高于当前版本的稳定版本；首版不允许降级。
- 忽略版本：只忽略精确版本，不屏蔽更高版本和安全修复。

## 8. GitHub Release 与构建规划

### 8.1 electron-builder 配置

- 增加 `electron-updater` 运行依赖。
- 在 build 配置中明确 GitHub provider、owner、repo 和稳定通道。
- 固定 `electronUpdaterCompatibility`，避免元数据格式随工具升级无意变化。
- 保持 Windows NSIS target，生成安装包、`latest.yml` 和 blockmap。
- `package.json` 的 `private: true` 继续保留，防止误发布 npm 包。

### 8.2 Release workflow

将现有 `package-windows.yml` 拆分为“普通打包验证”和“正式发布”职责，或新增独立 `release-windows.yml`：

1. 只接受受保护的 `vX.Y.Z` tag；开发后缀不进入 stable。
2. checkout 后校验 tag 与 `package.json` 版本完全一致。
3. `npm ci`、`npm run build`、专项校验和 `npm audit --audit-level=low` 全部通过。
4. 使用 GitHub Actions 最小 `contents: write` 权限构建并发布。
5. 生成并上传 NSIS 安装包、`latest.yml`、blockmap 和 SHA256 文件。
6. 先创建 draft Release，自动检查资产齐全与 digest 一致。
7. 维护者确认 Release notes、安装测试和签名后，再发布为正式 Release。
8. draft 与 prerelease 不被稳定版客户端消费。

发布 workflow 不把 PAT 写入仓库或应用；优先使用仓库自动提供、最小权限的 `GITHUB_TOKEN`。Windows 签名凭证只保存在 GitHub Actions secrets 或可信签名服务中。

## 9. 安全、隐私与签名门禁

- GitHub provider 使用 HTTPS；客户端依据更新元数据中的 SHA512 校验下载文件。
- 生产自动安装必须启用 Windows 可信代码签名，并固定预期 publisher；签名缺失或不匹配时停止自动安装。
- 代码签名证书、密码、Azure Trusted Signing 配置或其他凭证不得进入源码、日志、Release notes 和安装包资源。
- 更新请求只访问公开 GitHub Release，不需要用户 GitHub token。
- 应用不上传 Codex session、仓库源码、路径、模型、额度、通知历史或本机 Git 身份。
- `releaseNotes` 必须转为纯文本或白名单结构，防止远端 HTML 注入 renderer。
- IPC 对动作和状态做运行时校验；renderer 不能指定任意 feed URL、下载 URL或本机路径。

签名门禁未满足时，正式公开版本只启用“检查更新 + 打开 Releases 手动安装”，不在后台下载或执行未签名安装包。

## 10. 测试与验证计划

### 10.1 单元与契约测试

- Update 事件到 `UpdateState` 的状态迁移。
- SemVer 稳定版、开发版、相同版本和更低版本比较。
- 自动检查、自动下载、忽略版本和退出安装设置归一化。
- 并发检查去重、重复 downloaded 事件和退出竞态。
- 错误脱敏：请求头、token、本机路径和堆栈不进入 renderer 状态。
- Release notes 清洗和允许域名校验。

### 10.2 UI 验证

- 逐态验证 `idle / checking / available / downloading / downloaded / error / unsupported`。
- 检查 1360×900 下设置页卡片、提示条和弹层无溢出。
- 键盘可达、焦点顺序、Escape 关闭、按钮 loading 与错误重试行为正常。
- 应用更新提示不遮挡当前刷新反馈和通知中心。

### 10.3 打包与端到端验证

- `npm run build`、专项校验、`npm audit --audit-level=low`、`git diff --check`。
- `npm run package:win` 后确认 `app-update.yml` 被写入安装包资源。
- Release 资产包含安装包、`latest.yml`、blockmap、SHA256，且版本完全一致。
- 使用隔离 Windows 用户目录安装 updater-enabled 旧版，再发布更高测试版本，完成检查、下载、重启安装和新版本启动。
- 验证下载中断后可重试；校验失败不会安装；关闭应用后旧版仍可正常启动。
- 验证保留 `settings.json`、快照、缓存和通知状态，不重置用户数据。

## 11. 回滚与坏版本处理

- 已发布坏版本不能用相同版本号覆盖；必须发布更高的修复版本。
- 仅删除 Release 或 `latest.yml` 不能让已经下载/安装的客户端自动降级。
- 严重问题处理顺序：将问题 Release 标记为不可继续分发、在 README/Release 顶部告警、发布更高修复版本、记录受影响版本范围。
- 数据迁移必须向后兼容；首版更新功能不修改 Codex session、仓库或核心额度 baseline。
- 更新服务异常必须降级为手动下载，不阻断应用启动和本机仪表板功能。

## 12. 实施顺序

1. `v0.4.0-dev.1`：引入依赖、状态契约、设置迁移和主进程 `UpdateService`；默认关闭生产自动安装。
2. `v0.4.0-dev.2`：实现设置页卡片、全局提示、进度弹层和中文错误文案。
3. `v0.4.0-dev.3`：改造 GitHub Actions Release workflow，生成并校验完整更新资产。
4. `v0.4.0-dev.4`：补单元测试、UI 状态测试和隔离环境端到端升级验证。
5. 签名迭代：接入可信 Windows 代码签名，验证 publisher 与安装链路后打开生产自动下载/安装能力。
6. `v0.4.0`：完成文档、Release notes、升级注意事项和从上一 updater-enabled 版本升级验收后发布。

每个开发版本都同步更新 `DEVELOPMENT_LOG.md`；涉及页面、契约、隐私和发布流程时同步更新 README、组件映射、PRIVACY、SECURITY、Roadmap 和 Release notes。

## 13. 开始开发门槛

收到用户明确“开始修改”或同等指令后才进入实现。本规划通过后，实施前还需确认：

- 生产签名采用证书文件还是 Azure Trusted Signing；若尚未确定，先实现签名前的检查/手动下载降级和完整测试，不提前启用自动安装。
- `v0.4.0` 是否作为首个 updater-enabled 正式版；若是，真正的自动升级验收发生在 `v0.4.0 -> v0.4.1`。
- 发布 workflow 是否继续使用现有个人仓库和 GitHub Releases；首版默认保持不变。

## 14. 参考资料

- [electron-builder Auto Update](https://www.electron.build/docs/features/auto-update/)
- [electron-builder Publish](https://www.electron.build/docs/publish/)
- [electron-builder GitHub Actions](https://www.electron.build/docs/features/github-actions/)
- [electron-builder Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
- [GitHub 设置仓库可见性](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

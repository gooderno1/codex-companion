# RELEASE NOTES

## Code signing policy

Windows 正式发布的签名范围、角色、人工审批、元数据和验证规则见 [CODE_SIGNING_POLICY.md](./CODE_SIGNING_POLICY.md)。当前 `v0.4.5` 仍为未签名版本；固定 stable Release 自动下载和用户确认安装继续开放，普通退出不安装。如后续取得可用签名，再切换为可信 publisher 校验。

## [2026-07-28] v0.4.5 release: 补强自动下载并精简更新界面

### Release 范围

包含开发版本：

- `v0.4.5-dev.1`

本次不改变更新源、安装 helper、签名门禁或退出安装策略，只补齐自动下载开关的即时行为并精简已清晰交互中的说明文字。

### 主要变更

- 确认自动检查已在正式 Windows NSIS 安装版实装：启动约 `15s` 后检查，开关开启时每 `6h` 检查一次。
- 发现未忽略的新版本且自动下载开启时，继续自动开始下载。
- 已经发现新版本后才打开“自动下载”，现在也会立即开始下载，无需等待下一次检查。
- 设置页更新卡片、全局更新提示和详情弹层移除重复解释性小字，保留版本、状态、进度、错误、Release notes 和操作按钮。

### 验证结果

- `npm run build`、`npm run verify:updater`、`npm run verify:design`、`npm run verify:signing-policy` 和 `git diff --check`：通过。
- 更新器专项覆盖允许自动下载、关闭自动下载、忽略当前版本和不支持自动安装四种判定分支。
- 开发态设置页 `1360×900` 截图检查：说明文字已移除，无截断或布局溢出。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- 本地正式安装包大小 `102759963` bytes，SHA256 `5C8FEDAB41481C55F52CA9971D8B49922F7D1FD6CEE466B0C0092A03E132CA16`，Authenticode 为 `NotSigned`；同时生成 `108383` bytes blockmap 和版本、路径、大小、SHA512 完整的 `359` bytes `latest.yml`。

### Release 资产校验

- 正式 CI run `30365661489` 与 Windows Package run `30365654231` 均成功。
- 正式安装包 `Codex.Companion.Setup.0.4.5.exe` 大小 `102651361` bytes，SHA256 为 `D6517CE5BFA79A328F65299D0E2407292335B04227E5661AEB7DE807B0CDD14C`；实算结果与 GitHub asset digest、`SHA256SUMS.txt` 一致。
- blockmap 大小 `108043` bytes；草稿 Release 初始缺少安装包与 `latest.yml`，发布流程从同一成功 Windows Package run 的 Actions artifact 取回，先核对 artifact blockmap 与 Release blockmap digest 一致，再补齐缺失资产，没有混用本机构建产物。
- `latest.yml` 大小 `359` bytes，`version=0.4.5`，安装包路径、大小与 SHA512 完整；`SHA256SUMS.txt` 大小 `99` bytes。
- Release 页面、安装包、blockmap、tag `latest.yml`、`SHA256SUMS.txt` 和 `/releases/latest/download/latest.yml` 匿名 HTTP 访问均返回 `200`。

### 升级注意事项

- 自动检查和自动下载只在 Windows packaged NSIS、非便携形态下执行；开发模式、便携版和其他平台仍使用 Releases 手动安装。
- 安装包仍未签名，Windows SmartScreen 或企业策略可能拦截。
- 普通退出不会安装；下载完成后仍需点击“重启并安装”。

## [2026-07-28] v0.4.4 release: 隐藏升级窗口并直达通知详情

### Release 范围

包含开发版本：

- `v0.4.4-dev.1`

本次修复 `v0.4.3` 真实升级和通知交互中暴露的两个问题，不改变通知生成规则、额度阈值、数据源或自动升级下载校验。

### 主要变更

- Windows 计划任务不再直接执行 `powershell.exe`，改为无控制台的 `wscript.exe //B //NoLogo` 执行 UTF-16 VBScript 启动器。
- VBScript 通过 `WScript.Shell.Run(command, 0, True)` 隐藏运行并等待 PowerShell worker，安装期间不再持续显示前台命令行窗口，同时保持 handoff、计划任务存活与安装完成自删除。
- 系统通知和顶部单条“查看详情”通过 `notifications:open` 携带通知 key，进入 `#/notifications?notification=<key>`。
- 已加载的主窗口通过 `app:navigate` 更新 hash，不再用 `loadURL` 重载 renderer；通知页会定位目标分页并选中对应右侧详情。
- 通知页里的“查看关联页面”仍按通知记录的业务 `page` 打开总览或账本等关联页面。

### 验证结果

- `npm run build`、`npm run verify:notifications`、`npm run verify:updater`、`npm run verify:signing-policy` 和 `git diff --check`：通过。
- 更新器专项实际调用 `wscript.exe` 运行生成的 VBScript 与 PowerShell smoke，子进程 `MainWindowHandle=0`。
- 通知深链接使用本机第 `13` 条历史通知截图验证，页面进入第 `2 / 2` 页并选中对应详情。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- `npm run package:win`：正式版安装包大小 `102745114` bytes，SHA256 `05E4F31CDC6901606DCBD6873C42C02073C7B15A19D7D405F245EC9365FFFBE2`，Authenticode 为 `NotSigned`；同时生成 `108401` bytes blockmap 和 `359` bytes `latest.yml`。
- 开发提交 CI run `30353622218`：构建、通知跳转、隐藏 helper、签名政策和空白检查全部通过。

### Release 资产校验

- 正式 CI run `30353771174` 与 Windows Package run `30353774344` 均成功。
- 正式安装包 `Codex.Companion.Setup.0.4.4.exe` 大小 `102651500` bytes，SHA256 为 `576A697EBCEF3DE86842BE649D383FCB2781AAE0449B4662EDF186A515921D9A`；实算结果与 GitHub asset digest、`SHA256SUMS.txt` 一致。
- blockmap 大小 `107918` bytes；draft Release 初始缺少安装包与 `latest.yml`，发布流程从同一成功 Windows Package run 的 Actions artifact 取回，先核对 artifact blockmap 与 Release blockmap digest 一致，再补齐缺失资产，没有混用本机构建产物。
- `latest.yml` 大小 `359` bytes，`version=0.4.4`，安装包路径、大小与 SHA512 完整；`SHA256SUMS.txt` 大小 `99` bytes。
- Release 页面、安装包、blockmap、tag `latest.yml`、`SHA256SUMS.txt` 和 `/releases/latest/download/latest.yml` 匿名 HTTP 访问均返回 `200`。

### 升级注意事项

- 从 `v0.4.3` 升级本版时，旧版 helper 仍可能显示一次命令行窗口；安装完成并运行 `v0.4.4` 后，后续升级才使用本次隐藏启动修复。
- 安装包仍未签名，Windows SmartScreen 或企业策略可能拦截。

## [2026-07-28] v0.4.3 release: 修复系统通知跳转

### Release 范围

包含开发版本：

- `v0.4.3-dev.1`

本次只修复 Windows 系统通知的点击路由与回调生命周期，并增加对应自动校验；不改变通知生成规则、额度阈值、已读状态或数据采集口径。

### 主要变更

- Windows 系统通知点击后统一唤起主窗口并进入独立通知页，不再直接跳到额度或总览等关联业务页面。
- 主进程按通知 key 保活活动 `Notification` 实例，直到用户点击、关闭或系统报告失败，避免后台等待期间点击回调失效。
- 通知记录自身的 `page` 字段继续保留，只供通知页详情里的“查看关联页面”使用。
- 新增 `npm run verify:notifications` 并接入 CI，固定验证通知页目标、对象保活和旧错误回调不存在。

### 验证结果

- `npm run build`、`npm run verify:notifications`、`npm run verify:updater`、`npm run verify:signing-policy` 和 `git diff --check`：通过。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- `npm run package:win`：正式版验证通过；本地安装包大小 `102726983` bytes，SHA256 `ADD43B3018D10F7D6D9C6660D74EB9E76DF4E0B562006B6173919335456EF43A`，Authenticode 为 `NotSigned`，同时生成 `108111` bytes blockmap 和 `359` bytes `latest.yml`。
- 开发提交 CI run `30351563693`：构建、通知跳转、更新器、签名政策和空白检查全部通过。

### Release 资产校验

- 正式 CI run `30351709925` 与 Windows Package run `30351712649` 均成功。
- 正式安装包 `Codex.Companion.Setup.0.4.3.exe` 大小 `102650354` bytes，SHA256 为 `3D1DB124F2CAD3FB601286385FAE123026831F5E56401F754F19A0CEAB840F2F`；实算结果与 GitHub asset digest、`SHA256SUMS.txt` 一致。
- blockmap 大小 `108119` bytes；electron-builder 未将其上传至 draft Release，发布流程只从同一成功 Windows Package run 的 Actions artifact 取回并补入，没有混用本机构建产物。
- `latest.yml` 大小 `359` bytes，`version=0.4.3`，安装包路径、大小与 SHA512 完整；`SHA256SUMS.txt` 大小 `99` bytes。
- Release 页面、安装包、blockmap、tag `latest.yml`、`SHA256SUMS.txt` 和 `/releases/latest/download/latest.yml` 匿名 HTTP 访问均返回 `200`。

### 升级注意事项

- 已安装 `v0.4.2` 会检测到本版，并使用外部 helper 执行用户确认后的升级；这也是新 helper 的首个连续稳定版验收机会。
- 已安装 `v0.4.1` 仍携带旧升级逻辑；如果升级失败，请从 Releases 手动安装本版。
- 安装包仍未签名，Windows SmartScreen 或企业策略可能拦截。

## [2026-07-28] v0.4.2 release: LarkSync 式外部安装 helper

### Release 范围

包含开发版本：

- `v0.4.2-dev.1`

本次包含外部 Windows helper、安装包路径门禁、交接状态、用户可见文案、依赖安全更新和相关文档；没有排除已完成的开发版本。

### 主要变更

- 保留 `electron-updater` 的固定 GitHub stable feed、版本比较、`latest.yml` SHA512 校验、缓存复用和下载进度。
- 不再调用 `electron-updater.quitAndInstall()`；下载完成后只在主进程保存 `downloadedFile`，renderer 无法读取或修改安装路径。
- 用户点击“重启并安装”后，验证安装包真实路径必须位于 `LOCALAPPDATA/codex-companion-updater`，文件名必须为 `Codex.Companion.Setup.<version>.exe`。
- 通过当前用户的临时 Windows 计划任务启动 PowerShell helper，确认相同 `requestId` 已接手后才退出主程序；helper 等待旧 PID 退出，再以 `--updated /S --force-run` 运行 NSIS。
- helper 记录 `helper_started / parent_timeout / installer_started / launch_failed / install_succeeded / install_failed`，安装结束时删除临时任务；失败状态在下次启动转成脱敏中文错误。

### 安全与降级

- 安装动作仍要求用户明确确认，普通退出不会安装或重启。
- 安装包仍未签名，Windows SmartScreen 或企业策略可能拦截；SHA512 不能替代 Authenticode 发布者身份。
- renderer 不能指定 feed、下载 URL、安装路径、任务名、PowerShell 脚本或 NSIS 参数。
- 用户级 Task Scheduler 被策略禁用、helper 启动超时或安装失败时，应用保留 Releases 手动安装兜底。

### 验证结果

- `npm run package:win`：通过，生成 Windows NSIS 安装包、`latest.yml`、blockmap 和包内 `app-update.yml`。
- `npm run build`、`npm run verify:updater`、`npm run verify:signing-policy`、`git diff --check`：通过。
- 匿名 `npm ci` 与 `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- 计划任务 smoke test：受控假安装器得到 `helper_started → install_failed(exitCode=2)`，任务结束后查询确认已删除。
- 本地稳定版安装包大小 `102726036` bytes，SHA256 `FBA1F6FF3DBC4B7382E23A0211C3A17EE3EFC2B4B372A29B7B5C59BD3F7A44FC`，Authenticode 为 `NotSigned`；远端正式资产以 tag workflow 构建结果为准。

### Release 资产校验

- GitHub CI run `30344390143` 与 Windows Package run `30344392312` 均成功。
- 正式安装包 `Codex.Companion.Setup.0.4.2.exe` 大小 `102650328` bytes，SHA256 为 `739BAC6C7829566F8196252A1B4A7DDCDAFA4441B502B3175669042EA76853FF`；实算结果与 GitHub asset digest、`SHA256SUMS.txt` 一致。
- blockmap 大小 `108025` bytes；electron-builder 未将其上传至 draft Release，发布流程只从同一成功 Windows Package run 的 Actions artifact 取回并补入，没有混用本机构建产物。
- `latest.yml` 大小 `359` bytes，`version=0.4.2`，安装包路径、大小与 SHA512 完整；`SHA256SUMS.txt` 大小 `99` bytes。
- Release 页面、安装包、blockmap、`latest.yml`、`SHA256SUMS.txt` 和 `/releases/latest/download/latest.yml` 匿名 HTTP 访问均返回 `200`。

### 升级注意事项

- `v0.4.1` 内置的仍是旧安装逻辑，不能从远端获得新 helper；如果 `v0.4.1 → v0.4.2` 的旧链路未能完成，请从 Releases 手动安装 `v0.4.2` 一次。
- 从 `v0.4.2` 升级到后续更高稳定版时，才会使用本次新增的外部 helper。
- 本机 `settings.json`、额度快照、增量缓存、通知历史和赠送重置 baseline 不会被安装流程清空。
- 本版本只提供 Windows x64 NSIS 安装版。

### 已知边界

- 首次真实新 helper 端到端验收需要下一稳定版，以已安装 `v0.4.2` 为旧版执行。
- Task Scheduler 被企业策略禁用时不能自动安装，需要使用 Releases 手动升级。

## [2026-07-21] v0.4.1 release: 临时未签名自动升级引导版

### Release 范围

包含开发版本：

- `v0.4.1-dev.1`
- `v0.4.1-dev.2`

本次包含 SignPath Foundation 签名准入材料、Windows 资源元数据恢复、临时未签名更新政策、依赖安全补丁和相关文档；没有排除已完成的开发版本。

### 主要变更

- Windows packaged NSIS 安装版允许自动下载稳定版更新，并在下载完成后提供“重启并安装”。
- `UpdateState` 新增 `trustMode / canInstallOnQuit`，明确区分 `unsigned-temporary / trusted-publisher / unsupported`。
- 未签名模式强制 `canInstallOnQuit=false`；即使本机设置残留为真，也不会在退出应用时自动执行安装。
- 设置页、全局更新提示和安装弹层明确展示当前未签名、Windows SmartScreen 可能拦截及退出时不安装。
- 保留固定 GitHub owner/repo/provider/stable channel、纯文本 Release notes、受控 Releases URL 和更新错误脱敏。
- 修复发布门禁新发现的 `axios / brace-expansion / js-yaml / tar / shell-quote` 依赖公告；使用 `shell-quote@1.10.0` override，依赖审计恢复为 `0`。

### 安全与降级

- `latest.yml` SHA512 用于确认下载文件与同一 Release 元数据一致，不能替代 Authenticode 发布者身份签名。
- 安装只在用户点击“重启并安装”后触发；不做静默重启、退出时安装或强制更新。
- Windows 仍可能显示未知发布者或 SmartScreen 提示，企业策略也可能直接阻止未签名应用。
- 用户可随时关闭自动下载或改用 Releases 手动下载并核对 `SHA256SUMS.txt`。

### 验证结果

- `npm run package:win`：通过，生成 Windows NSIS 安装包、`latest.yml`、blockmap 和包内 `app-update.yml`。
- `npm run build`、`npm run verify:updater`、`npm run verify:signing-policy`、`npm run verify:quota`、`npm run verify:ledger`、`npm run verify:design`：通过。
- 使用无 Git credential helper 的隔离目录执行 npm `10.9.8` `ci --ignore-scripts`：通过，公开 HTTPS tag 依赖可匿名安装。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- packaged 设置页 `1360×900` 人工检查：自动下载、未签名风险和退出时不安装文案可见，无截断或布局溢出。

### Release 资产校验

- GitHub Actions 正式构建：`Codex.Companion.Setup.0.4.1.exe`，大小 `105461840` bytes，SHA256 为 `8E0CEB8D03B7767748D5A3B9412D167AEAFCE5024572D391E35C6A07FDE5E289`。
- 重新下载后的安装包 SHA256 与 `SHA256SUMS.txt`、GitHub asset digest 一致。
- Release 页面、安装包、blockmap、`latest.yml`、`SHA256SUMS.txt` 和 `/releases/latest/download/latest.yml` 匿名 HTTP 访问均返回 `200`。

### 升级注意事项

- `v0.4.0` 的自动安装门禁已编译关闭，不能被远程打开；因此 `v0.4.0 -> v0.4.1` 仍需从 Releases 手动安装一次。
- 从 `v0.4.1` 开始，后续更高稳定版才可以执行首次真实的“检查 -> 自动下载 -> 用户确认 -> 重启安装”验收。
- 现有 `settings.json`、额度快照、增量缓存、通知历史和赠送重置 baseline 无需清空。
- 本版本只提供 Windows x64 NSIS 安装版，不提供便携版、macOS 或 Linux 自动升级。

### 已知边界

- 安装包和应用主程序 Authenticode 仍为 `NotSigned`；SignPath Foundation 申请尚在审核。
- `latest.yml` 与 Release 位于同一 GitHub 发布信任域，仓库账号或发布工作流失陷时哈希本身不能提供独立发布者身份保证。
- 完整自动升级端到端结果要在下一正式版发布后，以已安装 `v0.4.1` 为旧版验证。

## [2026-07-15] v0.4.0 release: 首个 updater-enabled 公开正式版

### Release 范围

包含开发版本：

- `v0.4.0-dev.1`

本次同时包含仓库公开审计、共享核心仓库公开、公开 HTTPS tag 依赖和 GitHub Actions 运行时升级等发布收敛改动；没有排除已完成的开发版本。

### 主要变更

- 新增主进程 `UpdateService`，统一维护检查中、已是最新、发现版本、下载中、已下载、安装中、错误和不支持等状态。
- 启动约 `15s` 后检查稳定版，自动检查开启时每 `6h` 检查；手动检查始终可用。
- 设置页新增“应用更新”卡片，展示当前/可用版本、最近检查时间、更新说明、自动检查设置和 Releases 入口。
- 新版本出现时提供全局提示、更新详情、下载进度和安装确认交互；Release notes 先在主进程清洗为受限长度纯文本。
- GitHub Release workflow 校验正式 tag 与应用版本，构建 Windows NSIS 安装包，并生成 `latest.yml`、blockmap 和 SHA256。
- `codex-companion` 与 `codex-usage-core` 均已公开；核心依赖固定到匿名可读取的 HTTPS Git tag `v0.1.0-dev.11`。

### 安全与降级

- 更新源固定为 `gooderno1/codex-companion` 的公开 stable Release，renderer 不能指定任意 feed、下载地址或本机路径。
- 更新错误转换为稳定错误码和脱敏中文摘要，不暴露请求头、token、本机下载路径或堆栈。
- 当前没有可信 Windows 代码签名，`canAutoInstall=false`；应用只检查更新并引导手动安装，不后台下载或执行未签名安装包。
- `v0.3.9` 没有内置 updater，首次升级到 `v0.4.0` 需要手动下载安装。

### 验证结果

- `npm run package:win`：通过，生成安装包、`latest.yml`、blockmap 和包内 `app-update.yml`。
- `npm run verify:updater`、`npm run verify:quota`、`npm run verify:ledger`、`npm run verify:design`：通过。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- GitHub CI：匿名安装公开核心依赖、构建、更新器合同和空白检查通过。
- 1360×900 开发态与 packaged 设置页已完成视觉检查。

### Release 资产校验

- GitHub Actions 正式构建：`Codex.Companion.Setup.0.4.0.exe`，大小 `105455204` bytes，SHA256 为 `E6881551C43BBC9EBAC86BED22474C5E93BE5A24D6962DC1BD1D85825CCF4C86`。
- `SHA256SUMS.txt` 与重新下载后的安装包哈希一致；公开下载应继续以该文件为准。

### 升级注意事项

- 现有 `settings.json`、额度快照、增量缓存、通知历史和赠送重置 baseline 无需清空。
- 本版本只提供 Windows x64 NSIS 安装版，不提供便携版、macOS 或 Linux 自动升级。
- 后续接入可信 publisher 后，将以 `v0.4.0` 为旧版完成检查、下载、签名校验、重启安装和用户数据保留验收。

### 已知边界

- 安装包和应用主程序 Authenticode 状态为 `NotSigned`，Windows 可能显示安全提示。
- 自动下载、退出时安装和“重启并安装”保持关闭，直到可信签名门禁和连续版本端到端验收通过。

## [2026-07-15] v0.3.9 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.9-dev.1`

未排除开发版本：无。发布收敛阶段额外应用兼容范围内的依赖安全补丁。

### 主要变更

- 升级 `@lifeinhand/codex-usage-core` 到 `v0.1.0-dev.11`。
- 不再把 `primary / secondary` 槽位名固定解释为 5H / 周额度，而是按 `windowDurationMins` 识别业务窗口。
- 当前 Codex 只返回 `primary=10080 / secondary=null` 时，周额度继续正常展示并记录真实来源槽位 `primary`。
- 当前契约没有 300 分钟窗口时，5H 卡明确显示未观测，不用 10080 分钟周额度兜底，也不生成错误的 5H 通知。
- 历史周额度可从旧版 secondary 连续迁移到新版 primary 的同一业务时间线。
- 发布打包解析到 Electron `42.7.0`、`form-data 4.0.6`、`undici 7.28.0 / 6.27.0`，消除发布前审计发现的可修复依赖漏洞。

### 修复内容

- 修复 10080 分钟 primary 被误显示成 5H 额度的问题。
- 修复 secondary 缺失后周额度卡、额度通知和快照校验失去真实数据的问题。
- 修复槽位契约迁移可能造成跨窗口 reset / banked reset 使用误判的问题；核心包要求前后窗口时长一致。

### 验证结果

- `npm run package:win`：通过，完成图标生成、lint、TypeScript、renderer build、main build 和 Windows NSIS 打包。
- `npm run verify:quota`：通过；live 快照为 5H 未观测、周额度来源 `primary`、窗口 `10080` 分钟、余量 `93%`、`450` 条观测、`resetCount=0`。
- `npm run verify:ledger`：通过。
- `npm run verify:design`：通过。
- `npm audit --audit-level=low`：通过，`0` 个已知漏洞。
- `git diff --check`：通过，仅有 Windows 换行转换提示。
- `npm run verify:overview`：该脚本依赖 `-dev.N` 推导截图后缀，不适用于正式版本号；本次不作为 Release 门禁，额度、账本和设计专项校验已覆盖本轮改动。

### Release 资产校验

- `Codex Companion Setup 0.3.9.exe`：`SHA256 82EFC0E59E841DD5AC23735EA525DBBBDCEFDD53BB7A2AB0F84DD704DD8A3D98`；大小 `106362044` bytes（约 `101.43 MiB`）；GitHub 资产名为 `Codex.Companion.Setup.0.3.9.exe`。

### 升级注意事项

- 应用版本号从开发版 `0.3.9-dev.1` 切换为正式版 `0.3.9`。
- 继续固定远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.11`。
- 现有本机设置、历史快照和赠送重置 baseline 无需清空；刷新后会按窗口时长生成新的语义字段。
- 当前看不到 5H 卡数据代表 Codex 当前契约未提供 300 分钟窗口，不代表采集失败。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。

### 已知边界

- 本 Release 创建时 GitHub 仓库为 private；仓库已于 2026-07-15 切换为 public，该安装包现可公开下载。
- Windows 包尚未配置可信代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- 总览截图验收脚本目前只支持开发版本后缀，正式版本需沿用开发版截图证据或后续扩展脚本。

## [2026-07-13] v0.3.8 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.8-dev.1`

未排除开发版本：无。

### 主要变更

- 升级 `@lifeinhand/codex-usage-core` 到 `v0.1.0-dev.10`。
- 接入 Codex app-server `rateLimitResetCredits.credits[]` 官方逐笔获取时间、到期时间、状态和展示信息。
- 总览优先显示“官方到期”；官方明细缺失或被截断时继续使用原有估算，并明确区分来源。
- `availableCount` 保持为权威可用总数，不用可能被截断的明细数组长度覆盖。
- 赠送重置通知优先使用官方到期时间；估算库存继续使用原有一次性里程碑提醒。
- 旧版 `activeCredits[]` baseline 可自动迁移，无需清空本地快照或历史。

### 修复内容

- 修复 Codex 已提供官方到期信息后，应用仍把所有赠送重置统一标记为“预计过期”的问题。
- 修复部分官方明细可能被误解为完整库存的问题。
- 修复升级后旧 baseline 缺少 `expiryBasis` 时无法稳定区分估算和未知状态的问题。

### 验证结果

- `npm run package:win`：通过，完成图标生成、lint、TypeScript、renderer build、main build 和 Windows NSIS 打包。
- `npm run verify:ledger`：通过。
- `npm run verify:design`：通过。
- `git diff --check`：通过，仅有 Windows 换行转换提示。
- `npm run verify:quota`：本机旧运行态快照未通过；当前快照只包含 `10080` 分钟 primary 窗口并缺少 secondary/quotaEvidence，属于既有额度窗口契约兼容问题，不影响本次 banked reset 官方到期明细解析。

### Release 资产校验

- `Codex Companion Setup 0.3.8.exe`：`SHA256 AECA0B0B4C216C983EFE93005C18671D94E3DAB465CDFCDC2A4B1A2E8D91F14B`；GitHub 资产名为 `Codex.Companion.Setup.0.3.8.exe`。

### 升级注意事项

- 应用版本号从开发版 `0.3.8-dev.1` 切换为正式版 `0.3.8`。
- 继续使用远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.10`。
- 本机 Codex 版本只返回 `availableCount` 时，应用会继续使用估算；Codex 返回 `credits[]` 后自动切换到官方时间。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置可信代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- 当前 live 额度窗口可能只有周级 primary、没有 secondary；旧额度快照校验仍需后续单独兼容。
- `npm audit` 当前报告 `3` 个上游依赖漏洞（`2 high / 1 critical`），本次未扩大范围升级依赖树。

## [2026-07-03] v0.3.7 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.7-dev.1`
- `v0.3.7-dev.2`

未排除开发版本：无。

### 主要变更

- 刷新历史页新增 `返回设置` 按钮，左侧设置入口在刷新历史页保持高亮。
- 设置页移除通知策略卡片；当前提醒按固定一次性规则生成，旧 `notifications.deliveryMode` 仅保留兼容。
- Git 与授权区明确当前不检测 GitHub 登录、不请求 GitHub token；后续接入 GitHub PR、Issue 或云端同步能力时再提供授权引导。
- 设置页新增 `新用户使用路径`，说明先接通 Codex 数据、按需启用 Git、保存并刷新。
- 本机未安装 Git 时，明确 Codex 用量、额度、赠送重置和通知仍可用，代码仓库页、提交数、增删行和仓库归因降级为不可用。
- 设置页和代码仓库页新增 Git for Windows 安装指引，并提供下载入口。
- 新增受控外部链接 IPC，仅允许打开 `https://git-scm.com/download/win`。
- README、Roadmap、数据契约、组件映射和 banked reset 展示方案已同步正式版口径。

### 修复内容

- 修复刷新历史页进入后缺少返回入口的问题。
- 修复固定一次性通知规则下设置页仍展示通知策略选项的问题。
- 修复 GitHub 授权边界说明不够清晰的问题。
- 修复新用户缺少本机 Git 时无法判断哪些功能仍可用的问题。
- 修复代码仓库页在未安装 Git 或未发现仓库时只呈现弱空态的问题。

### 验证结果

- `npm run package:win`：通过，内部包含图标生成、lint、TypeScript 类型检查、renderer build、main build 和 Windows NSIS 打包。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `77%`、周额度余量 `39%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- `npm run verify:design`：通过，设计 token 校验通过。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.7.exe`：`SHA256 1D900ABBCA8CEFE26D490AD2864E3412BA97BA987FB44D41C47D1C86F0BFA4E0`；GitHub 资产名为 `Codex.Companion.Setup.0.3.7.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.7-dev.2` 切换为正式版 `0.3.7`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.8`。
- 当前版本无需 GitHub 登录；GitHub 云端数据仍不读取。
- 本机 Git 不是查看 Codex 用量的前置条件，但代码仓库统计需要本机 `git` 命令。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.6 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.6-dev.1`
- `v0.3.6-dev.2`
- `v0.3.6-dev.3`

未排除开发版本：无。

### 主要变更

- Windows 应用安装包、主窗口和托盘统一使用项目自定义 BrandMark 图标资产。
- 设置页恢复单列卡片流，减少分栏重排带来的割裂感。
- 完整刷新历史转入独立页面分页查看；设置页只保留最近摘要入口。
- 升级 `@lifeinhand/codex-usage-core@0.1.0-dev.8`，桌面端继续使用远程 Git tag 依赖，不使用本地 `file:` 依赖。
- 赠送重置当前 3 次库存按确认口径展示：`2026-06-14` 假定初始 credit、`2026-06-30` 公开补偿 credit、`2026-07-01T19:58:24.705Z` 本地观测新增 credit。
- 采集时把上一轮 `activeCredits[]` 作为核心包 `activeCreditBaseline` 传入，避免滚动历史裁剪后丢失已经识别出的观测新增。
- 总览页赠送重置普通态明确显示“最早预计过期”和“建议 ... 前使用”；展开详情卡主标题直接标注“预计过期”。
- README、Roadmap、数据契约、组件映射和 banked reset 展示方案已同步正式版口径。

### 修复内容

- 修复 Windows 托盘和安装包图标与应用品牌图标不一致的问题。
- 修复设置页分栏结构不符合当前轻量配置流的问题。
- 修复刷新历史在设置页展示过多的问题。
- 修复 `2026-06-11` launch free reset 被误归因到当前库存的问题；该次已按用户确认视为已使用，不再默认匹配。
- 修复赠送重置第三次观测新增在滚动历史裁剪后可能丢失的问题。
- 修复总览核心位置只显示日期或“最早建议”导致用户无法判断该时间是否为预计过期时间的问题。

### 验证结果

- `npm run package:win`：通过，内部包含图标生成、lint、TypeScript 类型检查、renderer build、main build 和 Windows NSIS 打包。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `55%`、周额度余量 `43%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- `npm run verify:design`：通过，设计 token 校验通过。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.6.exe`：`SHA256 836B5B37E7B91FFDF96388DC50D758613EADFA236869448C57BD0555317ACB88`；GitHub 资产名为 `Codex.Companion.Setup.0.3.6.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.6-dev.3` 切换为正式版 `0.3.6`。
- 当前依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.8`。
- 当前赠送重置口径默认排除已使用的 `2026-06-11` seed；首次未知 credit 按 `2026-06-14` 假定。
- 当前版本只读取本机 Git 命令和全局身份配置，不请求 GitHub token，不读取 GitHub 云端元数据。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.5 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.5-dev.1`
- `v0.3.5-dev.2`

未排除开发版本：无。

### 主要变更

- 新增独立通知页，支持全部 / 未读 / 已读筛选、赠送重置 / 额度筛选、分页、详情侧栏、查看关联页面和标记已读。
- 顶部铃铛继续保留快速通知摘要，通知详情和完整历史转入通知页查看。
- 通知频率从冷却重复提醒改为固定里程碑一次性提醒：赠送重置按预计过期前 `7d / 3d / 1d / 12h / 1h` 各提醒一次；额度按当前额度周期 `20% / 10%` 阈值各提醒一次。
- 设置页重新组织为数据源、通知策略、计费口径、Git 与授权、刷新历史摘要和本机数据边界。
- 设置页新增本机 Git 状态展示，读取 `git --version / user.name / user.email`，明确当前版本不需要 GitHub token。
- Windows 托盘图标改为按应用 `BrandMark` 几何生成的运行时 PNG，保持与应用品牌图形一致。
- README、Roadmap、数据契约和组件映射已同步通知页、一次性通知里程碑、Git 本机状态和设置页结构。

### 修复内容

- 修复通知按冷却期重复出现的问题；同一通知 key 已存在时不再更新最近触发时间、不重置未读状态、不重复触发系统通知。
- 修复旧 `notification-state.json` 中相同标题、正文、类别、级别和页面的重复提醒会铺满通知页的问题；读取时会按内容合并。
- 修复 Windows 托盘图标虽然可见但与应用品牌图标不一致的问题。
- 修复设置页刷新历史占用过多主要配置空间的问题；设置页只显示最近 5 条摘要。

### 验证结果

- `npm run package:win`：通过，内部包含 `npm run build`，覆盖 lint、TypeScript 类型检查、renderer build、main build 和 Windows NSIS 打包。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `26%`、周额度余量 `52%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- `npm run verify:design`：通过，设计 token 校验通过。
- 一次性通知规则合成快照检查：通过，赠送重置生成 `5` 个过期里程碑候选，首次发送 `6` 条、第二次发送 `0` 条；同一 5H 周期 `10%` danger 首次发送 `1` 条、重复发送 `0` 条。
- Electron 设置页截图检查：通过，`local_dev_work/settings-1360x900-dev2.png` 显示通知策略文案、Git 状态和版本号正常。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.5.exe`：`SHA256 E2E37C9B6A714FD92C8147C2B58D13BF904952A91EF8790D48BD69FDC8351202`；GitHub 资产名为 `Codex.Companion.Setup.0.3.5.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.5-dev.2` 切换为正式版 `0.3.5`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.7`。
- `settings.json` 会自动补齐 `notifications.deliveryMode=balanced`。
- `notification-state.json` 会继续保留历史通知，并按内容合并重复项；已读状态和系统通知时间保留在本机。
- 当前版本只读取本机 Git 命令和全局身份配置，不请求 GitHub token，不读取 GitHub 云端元数据。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- Windows 安装包可执行文件资源图标仍未单独配置；运行时托盘图标已使用应用品牌 PNG。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.4 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.4-dev.1`

未排除开发版本：无。

### 主要变更

- 顶栏新增应用内提醒中心，铃铛显示未读数，点击后可查看提醒标题、正文、类别、级别和触发时间。
- 应用内提醒支持查看对应页面和标记已读；系统通知不可用时仍保留应用内通知详情。
- `notification-state.json` 从单纯系统弹窗去重扩展为通知历史，保存创建时间、最近触发时间、系统通知时间和已读时间，并兼容旧版 `sent` 状态结构。
- Windows 托盘图标从 SVG DataURL 改为主进程运行时生成 PNG `nativeImage`，避免托盘区域显示空白。
- README、隐私说明、数据契约、组件映射和 Roadmap 已同步应用内提醒中心、通知状态和托盘图标边界。

### 修复内容

- 修复 `v0.3.3` 只有系统通知、应用内部无法查看提醒详情的问题。
- 修复 Windows 托盘图标在部分环境下显示为空白的问题。

### 验证结果

- `npm run build`：通过，覆盖 lint、TypeScript 类型检查、renderer build 和 main build。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `55%`、周额度余量 `56%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- 通知状态临时目录检查：通过，候选数 `1`、入库数 `1`、未读数 `1 -> 0`，首条通知包含标题、正文、类别和级别。
- `npm run package:win`：通过，生成 `Codex Companion Setup 0.3.4.exe` 安装包。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.4.exe`：`SHA256 41A3FA074814B108B0720F38131A495404E69CB60CD309489031732690F46FE9`；GitHub 资产名为 `Codex.Companion.Setup.0.3.4.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.4-dev.1` 切换为正式版 `0.3.4`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.7`。
- `notification-state.json` 会自动兼容旧版 `sent` 结构；旧系统通知记录会作为未读应用内提醒导入。
- 应用内提醒和系统通知只使用聚合后的额度余量、赠送重置估算时间和本机快照状态；不展示账号、邮箱、原始 app-server 响应、原始 JSONL、用户输入正文或模型输出正文。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.3 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.3-dev.1`

未排除开发版本：无。

### 主要变更

- 新增本机系统通知能力，覆盖启动刷新、后台自动刷新和手动刷新后的 live 快照。
- 赠送重置次数支持系统提醒：预计已过期、到达保守提醒时间、距离保守提醒时间不超过 `24h`，或首次观测前已有而无法反推真实过期时间时提醒。
- 5H / 周额度支持低余量提醒：当前周期剩余量 `<=20%` 时提醒，`<=10%` 时使用更高优先级提醒。
- 新增本机 `notification-state.json` 去重状态，避免 5 分钟自动刷新重复弹出同一提醒。
- 设置页数据边界新增通知去重文件说明；README、隐私说明、数据契约、组件映射和 Roadmap 已同步系统通知边界。

### 修复内容

- 将首次观测前已有赠送重置从精确到期提醒分支中排除，避免在无法反推过期时间时显示“预计过期时间待确认”的错误语义。
- 系统通知在截图模式、缓存快照和 pending 快照下不触发，避免自动截图和缓存回退制造误提醒。

### 验证结果

- `npm run build`：通过，覆盖 lint、TypeScript 类型检查、renderer build 和 main build。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `72%`、周额度余量 `59%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- 通知候选只读检查：通过，当前本机快照只生成 `banked-reset:unknown` 候选；低额度候选未触发。
- `npm run package:win`：通过，生成 `Codex Companion Setup 0.3.3.exe` 安装包。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.3.exe`：`SHA256 0F36A84D68F96BE1A62BA6139128C17873191F3623DD8CC0B56CEB9A1D89798D`；GitHub 资产名为 `Codex.Companion.Setup.0.3.3.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.3-dev.1` 切换为正式版 `0.3.3`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.7`。
- 系统通知只使用聚合后的额度余量、赠送重置估算时间和本机快照状态；不展示账号、邮箱、原始 app-server 响应、原始 JSONL、用户输入正文或模型输出正文。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.2 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.2-dev.1`
- `v0.3.2-dev.2`

未排除开发版本：无。

### 主要变更

- 升级共享核心包到 `@lifeinhand/codex-usage-core@0.1.0-dev.7`。
- 赠送重置次数支持按公开发放事件 seed 推断获取时间、预计过期时间和提前 `1` 天的保守提醒时间。
- 默认保留 `2026-06-30` 异常消耗修复补偿 reset 作为公开发放估算。
- `2026-06-11` Codex banking 上线 free reset 仍记录为已知公开 seed，但默认不再自动归因到当前库存，避免把已用早期 reset 误显示为仍可用。
- 总览页继续在顶部指标卡和 5H / 周额度圆环之间展示赠送重置次数，普通态显示当前可用次数和最早保守提醒时间，展开态显示逐条获取、预计过期和保守提醒时间。

### 修复内容

- 修正首次观测前已有库存会默认匹配 `2026-06-11` launch free reset 的问题。
- 修正当前 `availableCount=3` 时的展示归因：1 条首次观测前已有库存、1 条 `2026-06-30` 公开补偿估算、1 条 `2026-07-01` 本地观测新增。
- 修正文档中对公开 seed 默认匹配范围的说明，明确 6 月 11 日 seed 需要调用方显式启用才会参与自动匹配。

### 验证结果

- `npm run build`：通过，覆盖 lint、TypeScript 类型检查、renderer build 和 main build。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `87%`、周额度余量 `61%`，两个窗口当前均未识别新的 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- live 快照读取：通过，`bankedResetCredits.sourceStatus=observed`、`availableCount=3`、`activeCreditCount=3`；active 明细不再包含 `2026-06-11` public grant。
- `npm run package:win`：通过，生成 `Codex Companion Setup 0.3.2.exe` 安装包。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.2.exe`：`SHA256 E0A202A0EFAC21B969357F270016A2F813D4D1954A7B8975F99137E96C8C04F3`；GitHub 资产名为 `Codex.Companion.Setup.0.3.2.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.2-dev.2` 切换为正式版 `0.3.2`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.7`。
- 赠送重置次数来自 Codex app-server 只读 `rateLimitResetCredits.availableCount` 观测；本项目不调用消耗接口，不会使用或扣减 credit。
- 首次观测前已存在但未匹配公开 seed 的 credit 无法反推真实获取时间和过期时间，页面只展示保守估算并建议尽快使用。
- 本版本只提供 Windows NSIS 安装包，不提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-07-02] v0.3.1 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.3.1-dev.1` 至 `v0.3.1-dev.10`

未排除开发版本：无。

### 主要变更

- 补齐换电脑后的数据源接线，设置页支持维护 Codex 数据目录和本地 Git 仓库根目录。
- 新增首次加载自动检测流程，默认路径命中时直接开始扫描，未命中时引导用户进入设置页补齐路径。
- 接入远程共享核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.5`，避免在桌面端长期维护分叉版 reset engine。
- 同步周额度稳定边界回看、低用量滑动窗口排除和 reset 事件归桶规则。
- 纠正“充值次数”误导性命名，总览页和账本页继续使用“重置次数”描述 5H / 周额度窗口 reset。
- 新增 Codex 赠送重置次数展示，总览页在顶部指标卡和 5H / 周额度圆环之间展示当前可用次数、最早保守提醒时间，并支持展开查看每个 credit 的观测获取时间、预计过期时间和保守提醒时间。
- 更新 README、Roadmap、数据契约和组件映射，明确 `v0.3.1` 的当前能力、依赖版本和展示边界。

### 修复内容

- 修正稳定周额度边界已经切换但低用量样本无法识别 reset 的问题。
- 修正换机后只能依赖开发者本机默认路径的问题。
- 修正本项目曾短暂展示 `rechargeCount / rechargeEvents` 容易被误解为官方充值记录的问题。
- 修正下游依赖曾使用本地 `file:` 核心包路径的问题，当前锁定远程 Git tag。
- 对首次采样前已存在的赠送重置次数明确标记为“早于首次观测获得”，避免伪造精确获取时间。

### 验证结果

- `npm run build`：通过，覆盖 lint、TypeScript 类型检查、renderer build 和 main build。
- `npm run verify:quota`：通过，当前快照中 5H 额度余量 `31%`、周额度余量 `76%`，5H 额度已识别 `1` 次 reset。
- `npm run verify:ledger`：通过，账本页设计图、数据合同、采集器和页面实现关键内容一致。
- live 快照读取：通过，`bankedResetCredits.sourceStatus=observed`、`availableCount=2`、`activeCreditCount=2`。
- `npm run package:win`：通过，生成 `Codex Companion Setup 0.3.1.exe` 安装包；当前版本按 `v0.3.1-dev.2` 后续约定只发布 NSIS 安装版，不再生成便携版。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。

### Release 资产校验

- `Codex Companion Setup 0.3.1.exe`：`SHA256 3225464BF7BF1EA650AD71F6EFFBAF663DEA99F6728C4E33E546B2400EE2853C`；GitHub 资产名为 `Codex.Companion.Setup.0.3.1.exe`

### 升级注意事项

- 应用版本号从开发版 `0.3.1-dev.10` 切换为正式版 `0.3.1`。
- 当前继续依赖远程 Git tag `gooderno1/codex-usage-core#v0.1.0-dev.5`。
- 赠送重置次数来自 Codex app-server 只读 `rateLimitResetCredits.availableCount` 观测；本项目不调用消耗接口，不会使用或扣减 credit。
- 首次观测前已存在的 credit 无法反推真实获取时间和过期时间，页面只展示保守估算并建议尽快使用。
- 本版本只提供 Windows NSIS 安装包，不再提供便携版 exe。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 暂未提供自动更新。
- `npm audit` 仍存在上游依赖漏洞提示，未在本次 release 中升级依赖树。

## [2026-06-30] v0.3.0 release: 内部正式版

### Release 范围

本次 Release 作为 private 仓库内部正式版，用于内测验证，不等同于公开发布。

包含开发版本：

- `v0.1.0-dev.1`
- `v0.2.0-dev.1`
- `v0.2.1-dev.1`
- `v0.2.2-dev.1` 至 `v0.2.2-dev.79`
- `v0.3.0-dev.1` 至 `v0.3.0-dev.10`

未排除开发版本：无。

### 主要变更

- 完成 Electron 桌面壳、总览页、Codex 账本页、代码仓库页和设置页。
- 接入本机 Codex `sessions` / `archived_sessions` JSONL 解析。
- 支持 `token_count`、模型、API 等价成本、Codex credits 估算和 `rate_limits` 额度快照。
- 支持 5 小时额度窗口、周额度窗口、计费月 Token 和可观测月额度状态。
- 支持账本页多曲线 Token 走势、点位明细、放大查看、周额度账本、模型贡献和会话归因。
- 支持 Codex session 增量缓存，复用未变化 JSONL 解析结果。
- 支持本机 Git 仓库扫描、代码改动统计、仓库归因和仓库详情页。
- 设置页支持计费月起始日、仓库根目录、刷新历史和数据边界查看。
- 补齐 README、隐私说明、贡献指南、公开开源完善规划、CI、Windows 打包 workflow、PR 模板、安全策略和行为准则。

### 修复内容

- 修正刷新完成但最近无新 token 事件时误显示 `数据过期` 的问题。
- 修正周额度重置识别规则，避免低用量滑动窗口被误判为周重置。
- 修正周额度周期边界和重置时间展示不一致的问题。
- 修正总览页、账本页和仓库页多轮设计对齐中的文字溢出、布局密度和状态表达问题。
- 修正 README 中桌面挂件状态说明，当前内部正式版仍禁用挂件公开入口。

### 验证结果

- `npm run build`：通过，覆盖 lint、TypeScript 类型检查、renderer build 和 main build。
- `git diff --check`：通过，仅出现 Windows 换行转换提示。
- 设置页 Electron 截图检查：已验证仓库根目录配置区正常显示，路径文本不溢出，按钮不重叠。
- Release 打包命令：本次发布前执行 `npm run package:win`，确认 Windows 安装包与便携包可生成。

### Release 资产校验

- `Codex Companion 0.3.0.exe`：`SHA256 952367D606DB43E7D39F317087843CB5341DB7142961988A7EAD7CDAF6FA8382`
- `Codex Companion Setup 0.3.0.exe`：`SHA256 5378481B308C3126C31BFB35C2D9FB66D5CF662D1F465FB8552C95A9F2A01FF9`

### 升级注意事项

- 应用版本号从开发版 `0.3.0-dev.10` 切换为正式版 `0.3.0`。
- 仓库根目录现在可以在设置页维护；保存后会写入 Electron `userData/settings.json`。
- 如果用户清空仓库根目录列表并保存，应用会回退到默认自动发现路径。
- API 等价成本和 Codex credits 仍为估算，不代表官方账单。
- 月额度仍依赖 Codex 原始 `rate_limits` 是否暴露月级字段；没有字段时会显示未观测。

### 已知边界

- 当前 GitHub 仓库仍为 private，Release 资产只对有仓库读权限的成员可见。
- Windows 包尚未配置代码签名，内测安装时可能出现系统安全提示。
- 为规避本地 Windows 权限无法解压 `winCodeSign` 符号链接的问题，内部版暂时关闭 Windows exe 资源编辑与签名，因此仍使用默认 Electron 图标。
- 桌面挂件代码仍保留，但公开入口暂时禁用，后续单独验证后再开放。
- 暂未提供自动更新。
- collector 层自动化测试和脱敏 sample data 仍待补齐。

# DEVELOPMENT LOG

## [2026-07-15] v0.3.9 release: 内部正式版

- 开发原因：用户要求把已完成的 Codex 额度窗口契约兼容修复发布为正式版；当前最新 Release 为 `v0.3.8`，需要将 `v0.3.9-dev.1` 收敛发布。
- 实现方式：应用版本与 app-server clientVersion 调整为 `0.3.9`；README、数据契约、组件映射和 Release notes 同步正式版口径；继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.11`；发布前在兼容范围内把打包运行时 Electron 解析到 `42.7.0`，并将 `form-data / undici` 更新到无已知审计漏洞版本。
- 当前结果：已生成 `release/Codex Companion Setup 0.3.9.exe`，SHA256 为 `82EFC0E59E841DD5AC23735EA525DBBBDCEFDD53BB7A2AB0F84DD704DD8A3D98`；GitHub Release 使用 tag `v0.3.9`，资产名为 `Codex.Companion.Setup.0.3.9.exe`。
- 验证方式：`npm run package:win`、live 快照刷新、`npm run verify:quota`、`npm run verify:ledger`、`npm run verify:design`、`npm audit --audit-level=low` 和 `git diff --check` 通过；live 快照为 5H 未观测、周额度来源 primary、余量 `93%`、`450` 条观测、`resetCount=0`。`verify:overview` 依赖开发版本后缀推导截图名，不作为正式版门禁。

## [2026-07-15] v0.3.9-dev.1 fix: 按时长识别 Codex 额度窗口

- 开发原因：当前本机 Codex 已从 `primary=300 / secondary=10080` 切换为 `primary=10080 / secondary=null`；旧映射把 7 天 primary 显示成 5H，并让周额度卡、额度通知和快照校验失去真实数据。
- 实现方式：升级远程核心依赖到 `@lifeinhand/codex-usage-core@0.1.0-dev.11`；采集器使用共享 `classifyCodexQuotaWindowDuration` 在每条历史/当前观测的 primary 与 secondary 中按时长选择业务窗口；`LimitWindow` 新增 `sourceSlot`，语义 key 改为 `fiveHour / weekLimit`；app-server clientVersion 更新为 `0.3.9-dev.1`。
- 适用范围：主额度池 `limit_id=codex` 的 `300` 分钟和 `10080` 分钟窗口；历史周额度可来自 secondary，新版周额度可来自 primary。
- 触发条件：`300±60` 分钟识别为 5H，`10080±60` 分钟识别为周额度；当前存在对应时长窗口时生成周期、余量、模型占比、项目活动和低额度提醒。
- 排除条件：没有 `300` 分钟窗口时不使用 primary 兜底，5H 卡输出 `sourceStatus=unobserved / sourceSlot=null / windowMinutes=null`，且不生成 5H 额度通知；不同 `limitId / limitName` 仍不能混入主额度池。
- 关键字段：`overview.limitWindows[0].key=fiveHour`；`overview.limitWindows[1].key=weekLimit`；`sourceSlot` 记录真实接口槽位；周额度周期继续输出到 `windowPeriods.weekLimit`。
- 验证样例：本机 live app-server 返回 `codex.primary.windowDurationMins=10080 / secondary=null`；刷新后应得到 5H 未观测、周额度 `sourceSlot=primary / windowMinutes=10080`，且 `npm run verify:quota` 通过。
- 当前结果：7 天 primary 不再误显示为 5H，周额度卡与通知恢复真实数据；额度卡会直接展示所用槽位或当前契约未提供 5H 的说明。
- 验证方式：执行 `npm run build`、live 快照刷新、`npm run verify:quota`、`npm run verify:ledger`、`npm run verify:design` 和 `git diff --check`。

## [2026-07-13] v0.3.8 release: 内部正式版

- 开发原因：用户要求把已完成的官方赠送重置到期信息能力发布为最新正式版；当前最新 Release 为 `v0.3.7`，需要将 `v0.3.8-dev.1` 收敛发布。
- 实现方式：应用版本与 app-server clientVersion 调整为 `0.3.8`；README、数据契约、组件映射、banked reset 展示方案和 Release notes 同步正式版口径；继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.10`。
- 当前结果：已生成 `release/Codex Companion Setup 0.3.8.exe`，SHA256 为 `AECA0B0B4C216C983EFE93005C18671D94E3DAB465CDFCDC2A4B1A2E8D91F14B`；GitHub Release 使用 tag `v0.3.8`，资产名为 `Codex.Companion.Setup.0.3.8.exe`。
- 验证方式：`npm run package:win`、`npm run verify:ledger`、`npm run verify:design` 和 `git diff --check` 通过；`npm run verify:quota` 因本机旧运行态快照只有 10080 分钟 primary 且缺少 secondary/quotaEvidence 而失败，已作为独立已知边界记录。

## [2026-07-13] v0.3.8-dev.1 feat: 展示官方赠送重置到期时间

- 开发原因：Codex 官方 app-server 已支持返回 `rateLimitResetCredits.credits[]` 逐笔获取和到期信息，应用不应继续把所有到期时间都展示为本地估算。
- 实现方式：依赖升级到 `@lifeinhand/codex-usage-core@0.1.0-dev.10`；共享快照保存官方明细和覆盖完整性；总览优先显示“官方到期”，详情区区分官方、估算和未知；通知里程碑按 `expiresAt / expiryBasis` 使用官方或估算时间，并在正文中明确来源；app-server clientVersion 更新为 `0.3.8-dev.1`；旧版 baseline 由核心包自动迁移。
- 适用范围：`credits=null` 时完整沿用旧估算；官方明细数小于 `availableCount` 时只覆盖已返回条目，剩余库存仍保留估算/未知状态；总数始终以 `availableCount` 为准。
- 验证样例：核心包脱敏响应 `availableCount=2`、官方明细 1 条时，应用摘要显示 1 条官方到期明细并保留另 1 条回退库存，不把明细数组长度误当可用总数。
- 当前结果：支持新旧 Codex 版本平滑升级；官方到期通知不再使用“预计”口径，估算库存仍保持原提示。
- 验证方式：执行 `npm run build`，lint、TypeScript、renderer 和 main build 均通过；`npm run verify:ledger`、`npm run verify:design`、`git diff --check` 通过。`npm run verify:quota` 读取本机旧 `snapshot.json` 时失败，该运行态快照当前把 10080 分钟窗口放在 primary 且缺少 secondary/quotaEvidence，不是本次 banked reset 字段改动造成；需应用下次 live 刷新后再复验。

## [2026-07-03] v0.3.7 release: 内部正式版

- 开发原因：用户要求将刷新历史返回、设置页通知策略移除、GitHub 授权边界、新用户使用路径和 Git 安装指引收敛为内部正式版。
- 实现方式：将应用版本从 `0.3.7-dev.2` 调整为 `0.3.7`；主进程 app-server clientVersion 改为 `0.3.7`；更新 README、Roadmap、数据契约、组件映射、banked reset 展示方案和 Release notes；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.8`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.7.exe` 已生成，SHA256 为 `1D900ABBCA8CEFE26D490AD2864E3412BA97BA987FB44D41C47D1C86F0BFA4E0`；已创建 Git tag `v0.3.7` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.7`，上传资产名为 `Codex.Companion.Setup.0.3.7.exe`。
- 验证方式：执行 `npm run package:win`，通过图标生成、lint、TypeScript、renderer build、main build 和 Windows NSIS 打包；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `77%`、周额度余量 `39%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-03] v0.3.7-dev.2 feat: 补齐新用户 Git 使用引导

- 开发原因：用户确认当前功能不需要登录 GitHub，但新用户可能没有安装本机 Git，需要明确哪些功能仍可用、哪些能力会降级，以及如何安装 Git。
- 实现方式：将应用版本从 `0.3.7-dev.1` 提升到 `0.3.7-dev.2`；设置页新增 `新用户使用路径`，说明先接通 Codex 数据、按需启用 Git、保存并刷新；新增 `GitInstallGuide`，在设置页和代码仓库页复用；主进程新增受控 `app:open-external` IPC，仅允许打开 `https://git-scm.com/download/win`；首次检测面板和全局数据源提示区区分“未安装 Git”和“未发现仓库”；代码仓库页在未安装 Git 或未发现仓库时显示明确空态和下一步；同步 README、Roadmap、数据契约、组件映射和 banked reset 展示方案版本。
- 适用范围：影响新用户引导、设置页、代码仓库页空态、Git 安装外链和用户可见文档；不改变 Codex 用量、额度、赠送重置、通知规则、Git 扫描口径或 `@lifeinhand/codex-usage-core` 依赖版本。
- 当前结果：本机无 Git 时，应用明确说明 Codex 用量、额度、赠送重置和通知仍可用，代码仓库页、提交数、增删行和仓库归因暂不可用；用户可从设置页或代码仓库页打开 Git for Windows 下载页。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `86%`、周额度余量 `40%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行 `git diff --check`，仅有 Windows 换行提示；使用 Electron 截图生成 `local_dev_work/settings-1360x900-dev2.png` 和 `local_dev_work/repositories-1360x900-dev2.png`，确认设置页新用户使用路径和仓库页正常布局；使用受控 `PATH` 调用编译后的 `readGitIntegrationStatus()`，确认缺少 `git` 命令时返回 `available=false`；截图时仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。

## [2026-07-02] v0.3.7-dev.1 fix: 修正刷新历史返回和设置页授权口径

- 开发原因：用户反馈刷新历史页面无法返回；通知策略在固定一次性提醒规则下已经没有明确用户价值；GitHub 未登录时设置页缺少后续授权引导说明。
- 实现方式：将应用版本从 `0.3.6` 提升到 `0.3.7-dev.1`；刷新历史页工具栏新增 `返回设置` 按钮，左侧设置入口在刷新历史页保持高亮；移除设置页 `通知策略` 卡片、保存入口和渲染层相关样式；底层 `notifications.deliveryMode` 仅保留旧配置兼容；Git 与授权区改为明确说明当前不检测 GitHub 登录、不请求 GitHub token，后续接入 GitHub PR、Issue 或云端同步能力时再提供登录检测和授权引导；同步 README、Roadmap、数据契约、组件映射和 banked reset 展示方案版本。
- 适用范围：影响设置页、刷新历史页、Git 与授权说明和用户可见文档；不改变通知候选生成规则、应用内通知历史、系统通知发送、Codex session 采集、Git 本地扫描或 `@lifeinhand/codex-usage-core` 依赖版本。
- 当前结果：刷新历史页可直接返回设置；设置页不再出现通知策略选项；Git 与授权区清楚表达当前阶段无需 GitHub 授权且后续云端能力会补授权引导。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `97%`、周额度余量 `42%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行 `git diff --check`，仅有 Windows 换行提示；使用 Electron 截图生成 `local_dev_work/settings-1360x900-dev1.png` 和 `local_dev_work/refresh-history-1360x900-dev1.png`，确认设置页已移除通知策略卡、GitHub 授权边界文案可见，刷新历史页有 `返回设置` 按钮且左侧设置入口高亮；截图时仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。

## [2026-07-02] v0.3.6 release: 内部正式版

- 开发原因：用户要求将 `v0.3.6-dev.1` 至 `v0.3.6-dev.3` 的图标、设置页、刷新历史、赠送重置归因和过期时间文案改动收敛为内部正式版。
- 实现方式：将应用版本从 `0.3.6-dev.3` 调整为 `0.3.6`；主进程 app-server clientVersion 改为 `0.3.6`；更新 README、Roadmap、数据契约、组件映射、banked reset 展示方案和 Release notes；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.8`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.6.exe` 已生成，SHA256 为 `836B5B37E7B91FFDF96388DC50D758613EADFA236869448C57BD0555317ACB88`；已创建 Git tag `v0.3.6` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.6`，上传资产名为 `Codex.Companion.Setup.0.3.6.exe`。
- 验证方式：执行 `npm run package:win`，通过图标生成、lint、TypeScript、renderer build、main build 和 Windows NSIS 打包；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `55%`、周额度余量 `43%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-02] v0.3.6-dev.3 fix: 明确赠送重置预计过期文案

- 开发原因：用户反馈总览核心位置显示的是预期过期时间，但用户可见文案没有明确写明这是“过期时间”，容易把过期时间、保守提醒时间和建议使用时间混在一起。
- 实现方式：将应用版本从 `0.3.6-dev.2` 提升到 `0.3.6-dev.3`；总览页 `BankedResetCreditStrip` 普通态改为同时显示“最早预计过期”和“建议 ... 前使用”；展开详情卡主标题改为 `预计过期 ...`，次级行改为 `建议 ... 前使用`；同步更新 README、Roadmap、数据契约、组件映射和 banked reset 展示方案。
- 适用范围：仅影响 `overview.bankedResetCredits` 的用户可见文案和 clientVersion；不修改 `@lifeinhand/codex-usage-core` 依赖版本、赠送重置归因、通知候选、额度 reset 检测、Token 聚合或刷新历史。
- 当前结果：已知过期时间的赠送重置会在总览普通态显示类似 `最早预计过期 07/14 08:00；建议 07/13 08:00 前使用`；首次观测前已有且无法反推的 credit 继续显示“过期时间无法反推，建议尽快使用”。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `59%`、周额度余量 `44%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行 `git diff --check`，仅有 Windows 换行提示；尝试执行 `npm run capture:overview` 时 Electron 启动阶段仍输出本机 GPU cache 权限告警，脚本内部 `spawnSync node.exe` 超时，未生成本轮总览截图。

## [2026-07-02] v0.3.6-dev.2 fix: 对齐赠送重置假定和观测延续口径

- 开发原因：用户确认本项目此前在 `2026-07-02 04:58:24` 前已经准确观测到第三次 banked reset credit；第一次首次观测前已有 credit 无法反推真实时间，本轮按用户确认假定为 `2026-06-14`；`2026-06-11` launch free reset 已使用，不应继续强制匹配。
- 实现方式：将应用版本从 `0.3.6-dev.1` 提升到 `0.3.6-dev.2`；把远程核心包升级到 `@lifeinhand/codex-usage-core@0.1.0-dev.8`；移除桌面端对 `2026-06-11` public seed 的 `matchByDefault=true` 覆盖；向核心包传入 `initialGrantSeeds`：`2026-06-14T00:00:00.000Z` 的 `assumed-grant` 和 `2026-07-01T19:58:24.705Z` 的 `observed-grant`；采集时把上一轮 `activeCredits[]` 作为 `activeCreditBaseline` 传给核心包，避免滚动历史裁剪后丢失已经识别出的观测新增。
- 适用范围：仅影响 `overview.bankedResetCredits` 的逐条获取时间、预计过期时间、保守提醒时间和通知候选；普通 5H / 周额度 reset 检测、Token 聚合、Git 归因和刷新历史页面不变。
- 触发条件：首次库存匹配时，`2026-06-14` 假定 seed 与 `2026-06-30` public seed 在有效期内参与归因；如果保留有 `2 -> 3` 差分，则第三次按差分观测输出；如果滚动历史已裁剪该差分，则通过 `activeCreditBaseline` 或 `2026-07-01T19:58:24.705Z` 初始 observed seed 恢复该明细。
- 排除条件：`2026-06-11` launch free reset 不再参与默认匹配；没有 seed、baseline 或相邻差分支撑的库存仍显示为首次观测前已有且无法反推。
- 当前结果：当前 3 次赠送重置的目标归因为 1 条 `2026-06-14 -> 2026-07-14` 的 `assumed-grant`、1 条 `2026-06-30 -> 2026-07-30` 的 `public-grant`、1 条 `2026-07-01T19:58:24.705Z -> 2026-07-31T19:58:24.705Z` 的 `observed-grant`；总览页会把 `assumed-grant` 标注为按确认口径假定。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `70%`、周额度余量 `46%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；使用临时 userData 调用编译后的 `DashboardService.getSnapshot(true, "manual")`，确认 live 读取 `availableCount=3`，三条 active 明细分别为 `2026-06-14 assumed-grant`、`2026-06-30 public-grant`、`2026-07-01T19:58:24.705Z observed-grant`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-02] v0.3.6-dev.1 fix: 修正图标、重置口径和设置页结构

- 开发原因：用户反馈应用图标仍不像软件设定图标；3 次赠送重置里不应多次显示无法确认时间；设置页分栏重排观感不自然，应该回到以前单列配置流，完整刷新历史放到独立页面分页查看。
- 实现方式：将应用版本提升到 `0.3.6-dev.1`；新增 `scripts/generate-app-icon.mjs` 生成 `build/app-icon.ico` 和预览 PNG；`electron-builder` Windows 配置、主窗口和托盘统一优先使用该 `.ico`，缺失时才回退运行时品牌 PNG；调用 `@lifeinhand/codex-usage-core@0.1.0-dev.7` 时显式把 `2026-06-11` Codex banking 上线 free reset 的公开 seed `matchByDefault` 打开，保留 `2026-06-30` 补偿 seed，并把未匹配 seed 的首次已有 credit 展示为“无法反推”；通知服务允许“未知待确认”和“已知过期里程碑”同时生成且各自一次性去重；渲染层新增 `refresh-history` 页面，支持刷新来源筛选和每页 `12` 条分页；设置页回到单列卡片流，只保留最近 `5` 条刷新摘要和“查看全部”入口；同步更新 README、Roadmap、数据契约、组件映射和 banked reset 展示方案。
- 当前结果：Windows 安装包、主窗口和托盘图标均使用本项目自定义 BrandMark 图标资产；隔离采集下当前 3 次赠送重置识别为 `existing-at-first-observation=1`、`public-grant=2`，其中公开 seed 分别估算为 `2026-07-11` 和 `2026-07-30` 过期；设置页恢复单列，刷新历史可在独立页面分页查看。
- 验证方式：执行 `git pull --rebase`，确认远端已最新；执行 `git ls-remote --tags https://github.com/gooderno1/codex-usage-core.git`，确认核心包最新 tag 仍为 `v0.1.0-dev.7`；执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `91%`、周额度余量 `49%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行隔离 `DashboardService.getSnapshot(true, "manual")`，确认 `available=3` 且 basis 计数为 `1` 个首次观测前未知、`2` 个公开发放估算；执行通知服务合成验证，确认同一快照下候选 key 为 `banked-reset:expiration:7d:2026-07-11T00:00:00.000Z` 和 `banked-reset:unknown:1:2026-07-01T20:43:24.280Z`，首次发送 `2` 条、第二次发送 `0` 条；使用 Electron 生成 `local_dev_work/settings-1360x900-v0.3.6-dev1.png` 和 `local_dev_work/refresh-history-1360x900-v0.3.6-dev1.png`，确认设置页单列和刷新历史分页页正常；执行 `npm run package:win` 成功生成 `release/Codex Companion Setup 0.3.6-dev.1.exe`，打包日志未再出现默认 Electron 图标提示；Electron 截图时仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。
- 遗留问题：当前机器仍有已安装的旧版 `Codex Companion.exe` 后台运行，会继续写入全局 `%APPDATA%/codex-companion/snapshot.json`；本轮验证使用临时 userData 隔离新版采集结果，后续安装 `v0.3.6-dev.1` 后全局快照会按新口径刷新。

## [2026-07-02] v0.3.5 release: 内部正式版

- 开发原因：用户要求将通知页、设置页重排、Git 本机状态、托盘品牌图标和一次性通知里程碑收敛为正式内部版本；最新 GitHub Release 仍为 `v0.3.4`，需要把 `v0.3.5-dev.1` 至 `v0.3.5-dev.2` 发布为 `v0.3.5`。
- 实现方式：将应用版本从 `0.3.5-dev.2` 调整为 `0.3.5`；主进程 app-server clientVersion 改为 `0.3.5`；更新 README、Roadmap、数据契约、组件映射和 Release notes；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.7`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.5.exe` 已生成，SHA256 为 `E2E37C9B6A714FD92C8147C2B58D13BF904952A91EF8790D48BD69FDC8351202`；已创建 Git tag `v0.3.5` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.5`，上传资产名为 `Codex.Companion.Setup.0.3.5.exe`。
- 验证方式：执行 `npm run package:win`，通过 lint、TypeScript、renderer build、main build 和 Windows NSIS 打包；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `26%`、周额度余量 `52%`，两个窗口当前均未识别新的 reset；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；执行合成快照验证，确认赠送重置生成 `5` 个过期里程碑候选，首次发送 `6` 条、第二次发送 `0` 条，同一 5H 周期 `10%` danger 首次发送 `1` 条、重复发送 `0` 条；使用 Electron 生成 `local_dev_work/settings-1360x900-dev2.png`，确认设置页通知策略文案、Git 状态和版本号正常；执行 `git diff --check`，仅有 Windows 换行提示；执行 `gh release view v0.3.5`，确认 release 资产已上传且 digest 与本地 SHA256 一致。

## [2026-07-02] v0.3.5-dev.2 fix: 通知改为一次性里程碑提醒

- 开发原因：用户反馈赠送重置过期提醒不应按冷却期重复提醒，而应在过期前固定时间点各提醒一次；额度提醒也应在对应额度阈值到达时提醒一次。
- 实现方式：将应用版本提升到 `v0.3.5-dev.2`；移除 `DashboardNotificationService` 中的 `12h / 24h` 冷却重复提醒逻辑；同一通知 key 已存在时只更新标题和正文，不更新最近触发时间、不重置未读状态、不重复触发系统通知；赠送重置可估算过期时间时按 `banked-reset:expiration:<milestone>:<estimatedExpiresAt>` 生成稳定 key，其中 `milestone` 为 `7d / 3d / 1d / 12h / 1h / expired`；无法反推过期时间的赠送重置仍只生成一次待确认提醒；5H / 周额度继续按额度窗口、周期起止和阈值生成 key，`20%` warning 与 `10%` danger 在同一周期内各只提醒一次；同步更新 README、Roadmap、数据契约、组件映射和设置页通知策略文案。
- 触发条件：赠送重置预计过期前 `7 天 / 3 天 / 1 天 / 12 小时 / 1 小时` 各生成一次提醒；如果应用首次观测时已经过估算过期时间，只生成一次 `expired` 补偿提醒；额度窗口 `remainingPercent <= 20%` 生成一次 warning，`remainingPercent <= 10%` 生成一次 danger，均限定在当前额度周期 key 内。
- 当前结果：通知策略从“冷却后可重复提醒”改为“固定里程碑一次性提醒”；设置页显示默认均衡策略为“记录全部里程碑提醒，每个过期里程碑和额度阈值只提醒一次”。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行合成快照验证，确认赠送重置候选 key 包含 `7d / 3d / 1d / 12h / 1h` 五个里程碑，首次 `takeUnsentNotifications` 返回 `6` 条，第二次返回 `0` 条；同一 5H 周期 `20%` warning 首次生成一次，切到 `10%` danger 后生成一次，重复 danger 返回 `0` 条；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `30%`、周额度余量 `52%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；使用 Electron 生成 `local_dev_work/settings-1360x900-dev2.png`，确认设置页通知策略文案和版本号正常；截图时 Electron 仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。

## [2026-07-02] v0.3.5-dev.1 feat: 重设计通知与设置页

- 开发原因：用户反馈通知过于频繁、只有顶部下拉没有独立通知页、设置页刷新历史过重、Git 登录授权入口不清晰，以及 Windows 托盘图标虽然可见但不是应用品牌图标。
- 实现方式：将应用版本提升到 `v0.3.5-dev.1`；共享合同新增 `notifications` 路由、`NotificationPreferences.deliveryMode` 和 `GitIntegrationStatus`；设置存储为旧 `settings.json` 自动补齐默认 `balanced` 通知模式；主进程通知服务新增 `balanced / important / quiet / off` 四种模式，默认同一提醒 `12h` 冷却，`important` 模式 `24h` 冷却，`quiet` 只进应用内历史，`off` 不生成新提醒；赠送重置通知 key 改为按状态、数量和估算时间生成，并在读取旧 `notification-state.json` 时按标题、正文、类别、级别和页面合并重复历史；新增 `git:status` IPC 读取本机 `git --version / user.name / user.email`，明确当前不需要 GitHub token；渲染层新增通知页，支持筛选、分页、详情侧栏、查看关联页面和标记已读；设置页重排为数据源、通知策略、计费口径、Git 与授权、刷新历史摘要和本机数据边界；托盘 PNG 生成逻辑改为复用 `BrandMark` 的蓝青品牌几何。
- 触发条件：提醒仍只在 `generatedFrom=live` 快照后检查；额度提醒仍限 5H / 周额度剩余 `<=20%` 或 `<=10%`；赠送重置提醒仍限预计过期、到达保守使用时间、24 小时内到达保守使用时间或首次观测前已有 credit 无法反推；重复提醒未过冷却期时只更新标题正文，不更新最近触发时间、不重置未读、不弹系统通知。
- 当前结果：通知页真实运行态中旧重复的 `赠送重置过期时间待确认` 已合并为 1 条；顶部铃铛仍显示未读数，通知页展示完整详情；设置页可查看通知模式和本机 Git 身份，刷新历史只显示最近 5 条摘要；Windows 托盘图标使用与左侧品牌一致的自定义几何。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `42%`、周额度余量 `54%`；执行 `npm run verify:ledger` 和 `npm run verify:design` 均通过；使用编译后的 `DashboardNotificationService` 临时目录验证 `balanced` 模式首次系统通知 `1` 条、第二次 `0` 条，`quiet` 模式系统通知 `0` 条但入库 `1` 条；使用旧重复通知状态验证读取后合并为 `1` 条，后续同候选不再重复弹系统通知，并迁移到稳定 key；执行编译后的 `readGitIntegrationStatus()`，确认本机 Git 可用且当前不需要 GitHub token；使用 Electron 生成 `local_dev_work/notifications-1360x900-dev1.png`、`local_dev_work/notifications-1080x720-dev1.png`、`local_dev_work/settings-1360x900-dev1.png`、`local_dev_work/settings-1080x720-dev1.png`，确认通知页、设置页布局正常；截图时 Electron 仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。

## [2026-07-02] v0.3.4 release: 内部正式版

- 开发原因：用户要求将应用内提醒中心、通知详情和 Windows 托盘图标修复发布为正式内部版本；最新 GitHub Release 仍为 `v0.3.3`，需要把 `v0.3.4-dev.1` 收敛为 `v0.3.4`。
- 实现方式：将应用版本从 `0.3.4-dev.1` 调整为 `0.3.4`；主进程 app-server clientVersion 改为 `0.3.4`；更新 README、Roadmap、数据契约、组件映射和 Release notes；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.7`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.4.exe` 已生成，SHA256 为 `41A3FA074814B108B0720F38131A495404E69CB60CD309489031732690F46FE9`；已创建 Git tag `v0.3.4` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.4`，上传资产名为 `Codex.Companion.Setup.0.3.4.exe`。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `55%`、周额度余量 `56%`，两个窗口当前均未识别新的 reset；执行 `npm run verify:ledger`，确认账本页一致性通过；使用临时目录实例化 `DashboardNotificationService`，确认候选数 `1`、入库数 `1`、未读数 `1 -> 0`，且首条通知包含标题、正文、类别和级别；执行 `npm run package:win`，确认生成 `Codex Companion Setup 0.3.4.exe`；执行 `git diff --check`，仅有 Windows 换行提示；执行 `gh release view v0.3.4`，确认 release 资产已上传且 digest 与本地 SHA256 一致。

## [2026-07-02] v0.3.4-dev.1 fix: 补齐提醒中心并修复托盘图标

- 开发原因：用户反馈 `v0.3.3` 只有系统通知，应用内部没有提醒列表和通知详情；同时 Windows 托盘区域看不到应用图标，显示为空白。
- 实现方式：将应用版本提升到 `v0.3.4-dev.1`；扩展共享合同，新增 `DashboardNotificationEntry`、通知类别和级别；`DashboardNotificationService` 将 `notification-state.json` 从单纯系统弹窗去重扩展为应用内通知历史，保存标题、正文、页面、类别、级别、创建时间、最近触发时间、系统通知时间和已读时间，并兼容读取旧版 `sent` 结构；主进程新增 `notifications:get / notifications:mark-read / notifications:updated` IPC；渲染层顶栏新增 `NotificationCenter`，显示未读数、通知详情、触发时间、查看页面和标记已读；托盘图标从 SVG DataURL 改为主进程运行时生成 PNG buffer，避免 Windows 托盘对 SVG 原生图像支持不稳定导致空白。
- 触发条件：应用内提醒继续沿用 `v0.3.3` 的 live 快照候选规则；同一 credit 同一状态或同一额度周期阈值只生成一条通知，重复刷新只更新最近触发时间；系统通知不可用时仍保留应用内通知详情。
- 当前结果：顶栏铃铛显示未读数，点击后可查看提醒正文和来源类别；当前本机快照生成 1 条 `banked-reset`、`warning` 提醒，标记已读后未读数从 `1` 变为 `0`；托盘图标改为 32px PNG 蓝青渐变图标，不再依赖 SVG DataURL。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `61%`、周额度余量 `57%`；执行 `npm run verify:ledger`，确认账本页一致性通过；使用临时目录实例化 `DashboardNotificationService`，确认候选数 `1`、入库数 `1`、未读数 `1 -> 0`，且首条通知包含标题、正文、类别和级别；使用 Electron 截图命令生成 `local_dev_work/overview-notification-center-v0.3.4-dev1.png`，确认顶栏铃铛、未读数和详情弹层布局正常；截图时 Electron 仍输出本机 GPU cache 权限告警，但应用启动、截图和退出正常。

## [2026-07-02] v0.3.3 release: 内部正式版

- 开发原因：用户要求将已完成的系统通知开发版发布为正式内部版本；最新 GitHub Release 仍为 `v0.3.2`，需要把 `v0.3.3-dev.1` 收敛为 `v0.3.3`。
- 实现方式：将应用版本从 `0.3.3-dev.1` 调整为 `0.3.3`；主进程 app-server clientVersion 改为 `0.3.3`；更新 README、Roadmap、数据契约、组件映射和 Release notes；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.7`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.3.exe` 已生成，SHA256 为 `0F36A84D68F96BE1A62BA6139128C17873191F3623DD8CC0B56CEB9A1D89798D`；已创建 Git tag `v0.3.3` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.3`，上传资产名为 `Codex.Companion.Setup.0.3.3.exe`。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `72%`、周额度余量 `59%`，两个窗口当前均未识别新的 reset；执行 `npm run verify:ledger`，确认账本页一致性通过；执行编译后的 `buildDashboardNotificationCandidates(snapshot)` 只读检查，确认当前候选为 `banked-reset:unknown`，不会触发低额度候选；执行 `npm run package:win`，确认生成 `Codex Companion Setup 0.3.3.exe`；执行 `git diff --check`，仅有 Windows 换行提示；执行 `gh release view v0.3.3`，确认 release 资产已上传且 digest 与本地 SHA256 一致。

## [2026-07-02] v0.3.3-dev.1 feat: 增加本机系统通知

- 开发原因：用户要求先确认项目最新进展，并增加类似赠送重置次数到期、额度不足的通知能力；当前最新正式进展已同步到 `v0.3.2`，重点是赠送重置次数的公开发放估算和保守过期提醒。
- 实现方式：将应用版本提升到 `v0.3.3-dev.1`；新增 `DashboardNotificationService`，在主进程处理 live `DashboardSnapshot` 后生成系统通知候选；通知只消费 `overview.bankedResetCredits`、`windowPeriods.fiveHour / weekLimit` 和 `limitWindows[0..1]`，不修改 `codex-usage-core` reset engine；通过 Electron `Notification` 发出系统通知，点击通知打开总览页；新增 `%APPDATA%/codex-companion/notification-state.json` 保存已发送提醒 key、标题、正文和发送时间，避免 5 分钟自动刷新重复弹出同一提醒；设置页数据边界新增通知去重文件。
- 触发条件：赠送重置预计已过期、已到 `safeEstimatedExpiresAt`、距离 `safeEstimatedExpiresAt` 不超过 `24h`，或 `estimateBasis=existing-at-first-observation` 无法反推真实过期时间时提醒；`5H 额度` 或 `周额度` 当前周期余量 `remainingPercent <= 20%` 时提醒，`<= 10%` 时使用更高优先级提醒。
- 排除条件：仅 live 快照触发；截图模式、缓存快照和 pending 快照不触发；`sourceStatus=pending / unobserved` 的赠送重置不提醒；非 `observed` 的额度窗口不提醒；可观测月额度暂不提醒，因为当前月额度字段仍未稳定观测。
- 当前结果：后台刷新、启动刷新和手动刷新后都会进入通知判断；当前本机快照只生成 1 条赠送重置候选，内容为 `2` 次赠送重置早于首次观测、过期时间无法反推，低额度提醒不会触发，因为当前 5H 余量 `78%`、周额度余量 `60%`。
- 验证方式：执行 `git pull --rebase`，确认本项目远端已是最新；执行 `git ls-remote --tags https://github.com/gooderno1/codex-usage-core.git`，确认远程核心包最新 tag 仍为 `v0.1.0-dev.7`，本项目继续固定该版本；执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认 5H / 周额度快照校验通过；执行编译后的 `buildDashboardNotificationCandidates(snapshot)` 只读检查，确认当前候选为 `banked-reset:unknown`，不会触发低额度候选；执行 `git diff --check`，仅有 Windows 换行提示；使用 Electron 截图命令生成 `local_dev_work/settings-notifications-v0.3.3-dev1.png` 和 `local_dev_work/settings-notifications-full-v0.3.3-dev1.png`，确认设置页主体加载正常。

## [2026-07-02] v0.3.2 release: 内部正式版

- 开发原因：用户要求确认 `codex-companion` 是否已经 release；核查 Git tag 和 GitHub Release 后确认最新正式版仍停在 `v0.3.1`，需要把 `v0.3.2-dev.1` 至 `v0.3.2-dev.2` 收敛为内部正式版。
- 实现方式：将应用版本从 `0.3.2-dev.2` 调整为 `0.3.2`；更新 README、Roadmap、数据契约、组件映射、banked reset 展示方案和 Release notes；主进程 app-server clientVersion 改为 `0.3.2`；本次 release 继续固定远程核心包 `@lifeinhand/codex-usage-core@0.1.0-dev.7`。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.2.exe` 已生成，SHA256 为 `E0A202A0EFAC21B969357F270016A2F813D4D1954A7B8975F99137E96C8C04F3`；已创建 Git tag `v0.3.2` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.2`，上传资产名为 `Codex.Companion.Setup.0.3.2.exe`。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `87%`、周额度余量 `61%`，两个窗口当前均未识别新的 reset；执行 `npm run verify:ledger`，确认账本页一致性通过；调用编译后的 `DashboardService.getSnapshot(true, "manual")`，确认 `bankedResetCredits.sourceStatus=observed`、`availableCount=3`、`activeCreditCount=3`，且 active 明细不再包含 `2026-06-11` public grant；执行 `npm run package:win`，确认生成 `Codex Companion Setup 0.3.2.exe`；执行 `git diff --check`，仅有 Windows 换行提示；执行 `gh release view v0.3.2`，确认 release 资产已上传且 digest 与本地 SHA256 一致。

## [2026-07-02] v0.3.2-dev.2 fix: 避免默认匹配已用 launch reset

- 开发原因：用户确认当前 `rateLimitResetCredits.availableCount=3` 是正确的，但 `2026-06-11` banking 上线赠送的 launch free reset 很可能已经使用；当前 3 次应优先按后续公开补偿和本地观测新增来解释。
- 实现方式：将应用版本从 `v0.3.2-dev.1` 提升到 `v0.3.2-dev.2`；把 `@lifeinhand/codex-usage-core` 升级到远程 Git tag `v0.1.0-dev.7`；同步 README、Roadmap、数据合同、组件映射和 banked reset 展示方案，明确 `2026-06-11` seed 默认不再自动匹配当前库存。
- 适用范围：仅影响首次观测前已有的赠送重置归因；后续 `availableCount` 增加仍按本地观测时间推断获取和过期。
- 当前结果：live 快照确认当前 `availableCount=3`，且 active 明细不再包含 `2026-06-11`；三条分别为 1 条 `existing-at-first-observation`、1 条 `2026-06-30 -> 2026-07-30` 的 `public-grant`、1 条 `2026-07-01T19:58:24.705Z -> 2026-07-31T19:58:24.705Z` 的 `observed-grant`。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认额度快照校验通过；执行 `npm run verify:ledger`，确认账本页一致性通过；调用编译后的 `DashboardService.getSnapshot(true, "manual")`，确认 `bankedResetCredits.availableCount=3` 且无 `2026-06-11` active 明细；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-02] v0.3.2-dev.1 feat: 用公开发放时间展示赠送重置

- 开发原因：用户指出 banked reset credit 的过期时间可以按公开 `30` 天有效期推断，当前本机可用的 `2` 次也可先对应公开发放事件；总览页不应把这两次都展示为无法反推。
- 实现方式：将应用版本从 `v0.3.1` 提升到 `v0.3.2-dev.1`；把 `@lifeinhand/codex-usage-core` 升级到远程 Git tag `v0.1.0-dev.6`；共享快照合同新增 `estimateBasis=public-grant`；总览页获取时间对 `public-grant` 标注“公开发放估算”，预计过期时间标注“按公开发放时间 + 30 天估算”；文档同步记录两个默认 seed：`2026-06-11` Codex banking 上线 free reset 和 `2026-06-30` 异常消耗修复补偿 reset。
- 适用范围：仅适用于核心包从 Codex app-server 只读 `rateLimitResetCredits.availableCount` 推断出的 banked reset credit；本项目仍不调用 `account/rateLimitResetCredit/consume`，不会消耗赠送重置。
- 触发条件：首次观测已有库存且核心包匹配到仍在有效期内的公开 seed 时，页面展示公开发放获取时间、预计过期时间和提前 `1d` 的保守提醒；后续可用次数增加仍按本地观测时间推断。
- 排除条件：未匹配公开 seed 的首次已有库存继续展示为“早于首次观测获得 / 建议尽快使用”；页面不展示账号、邮箱、余额、原始 app-server 响应、token 或私有路径。
- 当前结果：总览页会把当前 `availableCount=2` 的两条赠送重置显示为公开发放估算：`2026-06-11 -> 2026-07-11`、`2026-06-30 -> 2026-07-30`，并分别提前到 `2026-07-10`、`2026-07-29` 作为保守使用提醒。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认额度快照校验通过；执行 `npm run verify:ledger`，确认账本页一致性通过；调用编译后的 `DashboardService.getSnapshot(true, "manual")`，确认 `bankedResetCredits.availableCount=2` 且两条 `activeCredits[].estimateBasis` 均为 `public-grant`，获取时间分别为 `2026-06-11T00:00:00.000Z` 和 `2026-06-30T00:00:00.000Z`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-02] v0.3.1 release: 内部正式版

- 开发原因：用户询问 `codex-companion` 是否已经发布，核查 GitHub Release 后确认 `v0.3.1` 尚未发布，需要把 `v0.3.1-dev.1` 至 `v0.3.1-dev.10` 收敛为内部正式版。
- 实现方式：将应用版本从 `0.3.1-dev.10` 调整为 `0.3.1`；更新 README、Roadmap、数据契约、组件映射和 Release notes；本次 release 明确包含换机数据源接线、首次自动检测、共享 `codex-usage-core@0.1.0-dev.5`、稳定 reset 规则、重置命名纠正和赠送重置次数展示。
- 当前结果：发布资料已更新；`release/Codex Companion Setup 0.3.1.exe` 已生成，SHA256 为 `3225464BF7BF1EA650AD71F6EFFBAF663DEA99F6728C4E33E546B2400EE2853C`；已创建 Git tag `v0.3.1` 和 GitHub Release `https://github.com/gooderno1/codex-companion/releases/tag/v0.3.1`，上传资产名为 `Codex.Companion.Setup.0.3.1.exe`。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认当前快照 5H 额度余量 `31%`、周额度余量 `76%` 且 5H 额度识别 `1` 次 reset；执行 `npm run verify:ledger`，确认账本页一致性通过；调用编译后的 `DashboardService.getSnapshot(true, "manual")`，确认 `bankedResetCredits.sourceStatus=observed`、`availableCount=2`、`activeCreditCount=2`；执行 `npm run package:win`，确认生成 `Codex Companion Setup 0.3.1.exe`；执行 `git diff --check`，仅有 Windows 换行提示；执行 `gh release view v0.3.1`，确认 release 资产已上传且 digest 与本地 SHA256 一致。

## [2026-07-01] v0.3.1-dev.10 feat: 展示赠送重置逐个明细

- 开发原因：用户确认需要在 `codex-companion` 中展示每个赠送重置次数的获取时间和预期过期时间，并要求总览页放在顶部四卡与 `5H / 周额度` 圆环之间；普通态只显示一行状态，点击后展开逐个明细。
- 实现方式：将应用版本从 `v0.3.1-dev.9` 提升到 `v0.3.1-dev.10`；把 `@lifeinhand/codex-usage-core` 升级到远程 Git tag `v0.1.0-dev.5`；扩展 `DashboardSnapshot.overview.bankedResetCredits` 合同，保存脱敏观测历史、推断事件和 `activeCredits[]`；主进程通过 `readCodexAccountRateLimits()` 只读读取 `account/rateLimits/read`，合并上一轮快照观测后调用 `analyzeBankedResetCreditObservations()`；总览页新增 `BankedResetCreditStrip`，普通态显示可用次数和最早保守使用时间，展开后显示每个 credit 的获取时间、预计过期时间和保守提醒时间。
- 适用范围：仅适用于 Codex app-server 暴露的 `rateLimitResetCredits.availableCount`；本项目不调用 `account/rateLimitResetCredit/consume`，不会消耗可用赠送重置。
- 显示边界：`estimatedExpiresAt` 按推断获取时间加 `30d` 估算；`safeEstimatedExpiresAt` 默认提前 `1d`，页面优先展示；首次采样前已有的 credit 无法反推真实获取和过期时间，显示为“早于首次观测获得 / 建议尽快使用”。
- 当前结果：总览页顶部四卡与额度圆环之间会展示赠送重置状态行，并支持展开查看逐个明细；输出仍不包含账号、邮箱、余额、原始 app-server 响应、原始 Codex session 正文、用户输入或模型输出。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认 5H 与周额度快照仍通过；执行 `npm run verify:ledger`，确认账本页一致性通过；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 生成 live 快照，确认 `overview.bankedResetCredits.availableCount=2` 且输出 2 条 `existing-at-first-observation` active 明细；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-01] v0.3.1-dev.9 docs: 规划 banked reset 展示

- 开发原因：`codex-usage-core v0.1.0-dev.4` 已能通过 Codex app-server 只读读取 `rateLimitResetCredits.availableCount`，桌面端需要跟进依赖版本；但用户要求两个下游项目的参数显示方式先写文档确认，再分别修改 UI。
- 实现方式：将应用版本从 `v0.3.1-dev.8` 提升到 `v0.3.1-dev.9`；把 `@lifeinhand/codex-usage-core` 升级为远程 Git tag：`git+https://github.com/gooderno1/codex-usage-core.git#v0.1.0-dev.4`；新增 `docs/banked-reset-display-plan-2026-07-01.md`，规划总览页和账本页展示 `availableCount`、推断获得/使用/过期候选和估算过期时间；同步更新数据合同、组件映射和迁移规划中的核心包版本。
- 适用范围：本轮只做依赖升级和展示方案文档，不修改 `DashboardSnapshot` 合同、采集器、IPC、React 页面或校验脚本。
- 显示边界：后续 UI 不应把 banked reset credit 与普通 `quotaEvidence.resetCount` 混用；`estimatedExpiresAt` 只能显示为估算过期时间；不得展示账号 ID、邮箱、原始 app-server 响应、余额字段或 token。
- 当前结果：项目依赖已锁定到 `codex-usage-core v0.1.0-dev.4`；展示方案等待用户确认后再实施。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；执行 `npm run verify:quota`，确认 5H 额度和周额度仍按现有 reset 字段校验；执行 `npm run verify:ledger`，确认账本页一致性通过；待最终提交前执行 `git diff --check`。

## [2026-07-01] v0.3.1-dev.8 fix: 纠正额度重置命名

- 开发原因：上一轮“充值次数”来自用户笔误，Codex 本地数据中没有独立官方充值次数字段；桌面端继续展示 `rechargeCount / rechargeEvents` 会误导为真实充值数据。
- 实现方式：将应用版本从 `v0.3.1-dev.7` 提升到 `v0.3.1-dev.8`；把 `@lifeinhand/codex-usage-core` 升级为远程 Git tag：`git+https://github.com/gooderno1/codex-usage-core.git#v0.1.0-dev.3`；删除共享快照契约中的 `QuotaRechargeEvent`、`quotaEvidence.rechargeCount / rechargeEvents`；保留 `resetCount / resetEvents / usageSegments`，其中 `usageSegments` 继续承载窗口起点、过期时间和 reset 前后使用区间；总览和账本可见文案改回“重置次数”。
- 适用范围：仅适用于本地 Codex `rate_limits` 已观测到的 5H / 周额度窗口 reset；不推断未暴露的月额度、账户余额或真实充值记录。
- 触发条件：重置事件沿用核心包稳定确认口径，即 `resets_at` 后移、`used_percent` 下降不少于默认 `5%`，并通过高水位、边界贴近或稳定边界回看证据及后续稳定窗口确认。
- 排除条件：低用量滑动窗口漂移、缺少稳定确认、时间或窗口字段不可解析时，核心包不会输出 `resetEvents`。
- 关键字段：`quotaEvidence.resetCount` 表示稳定确认的重置次数；`resetEvents[].afterWindowResetsAt` 表示重置后窗口过期时间；`usageSegments[].startedByResetAt / closedByResetAt` 表示用量段由哪次 reset 开启或截止。
- 当前结果：`DashboardSnapshot.overview.windowPeriods.*.quotaEvidence` 与账本周期只暴露 reset 字段；输出仍不包含原始 Codex session 正文、用户输入、模型输出或私有仓库源码。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 刷新 live 快照，确认 `weekLimit.quotaEvidence.resetCount=0`，且不再包含 `rechargeCount / rechargeEvents`；执行 `npm run verify:quota`，确认 5H / 周额度均按 `resetCount / resetEvents` 校验；执行 `npm run verify:ledger`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-01] v0.3.1-dev.7 feat: 同步额度充值跟踪核心包

- 开发原因：`codex-usage-core v0.1.0-dev.2` 新增 Codex 额度充值次数、充值过期时间和使用区间输出，桌面端需要同步依赖并透出到 `quotaEvidence`。
- 实现方式：将应用版本从 `v0.3.1-dev.6` 提升到 `v0.3.1-dev.7`；把 `@lifeinhand/codex-usage-core` 升级为远程 Git tag：`git+https://github.com/gooderno1/codex-usage-core.git#v0.1.0-dev.2`；扩展共享快照契约，新增 `QuotaRechargeEvent`、`quotaEvidence.rechargeCount / rechargeEvents`，并保留旧 `resetCount / resetEvents`；周额度重置感知归桶继续使用核心包 reset 事件，只把核心包返回的 recharge 事件按 reset 事件映射进对应周期；总览和账本可见文案从“重置次数”调整为“充值次数”。
- 适用范围：仅适用于本地 Codex `rate_limits` 已观测到的 5H / 周额度窗口；不推断未暴露的月额度或账户余额。
- 触发条件：充值事件沿用核心包稳定确认口径，即 `resets_at` 后移、`used_percent` 下降不少于默认 `5%`，并通过高水位、边界贴近或稳定边界回看证据及后续稳定窗口确认。
- 排除条件：低用量滑动窗口漂移、缺少稳定确认、时间或窗口字段不可解析时，核心包不会输出 `rechargeEvents`，本项目也不会在下游补造事件。
- 关键字段：`quotaEvidence.rechargeEvents[].expiresAt` 表示充值后额度窗口过期时间，`windowStartedAt` 表示充值后窗口起点，`previousUsageStartedAt / previousUsageEndedAt / previousUsedPercent` 表示充值前一轮使用区间。
- 验证样例：核心包脱敏样例 `2026-06-01 65% -> 2026-06-02 2%` 输出 `rechargeCount=1`、`expiresAt=2026-06-09T00:00:00.000Z`；本项目校验脚本新增 `rechargeCount / rechargeEvents` 数组和时间字段断言。
- 当前结果：`DashboardSnapshot.overview.windowPeriods.*.quotaEvidence` 与账本周期都可携带充值事件；总览额度卡和周额度账本显示充值次数；输出仍不包含原始 Codex session 正文、用户输入、模型输出或私有仓库源码。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript、renderer build 和 main build；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 刷新 live 快照，确认 `weekLimit.quotaEvidence.rechargeCount=0` 且 `rechargeEvents` 为数组；执行 `npm run verify:quota`，确认 5H / 周额度均包含 `rechargeCount / rechargeEvents` 校验，当前 5H 与周额度充值次数均为 `0`；执行 `npm run verify:ledger`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-07-01] v0.3.1-dev.6 chore: 改用远程 Codex 用量核心包

- 开发原因：用户要求下游项目不要使用本地 `file:../codex-usage-core` 依赖，避免换设备后无法同步开发。
- 实现方式：将应用版本从 `v0.3.1-dev.5` 提升到 `v0.3.1-dev.6`；把 `@lifeinhand/codex-usage-core` 依赖切换为远程 Git tag：`git+https://github.com/gooderno1/codex-usage-core.git#v0.1.0-dev.1`；更新 `AGENTS.md`、数据契约和组件映射，明确后续使用远程 tag 或正式包版本，不使用本地 `file:` 依赖。
- 当前结果：其他设备执行 `npm install` 时会从 GitHub 拉取 `codex-usage-core` 对应 tag，不依赖相邻本地目录。
- 验证方式：执行 `npm run build`，包含 lint、typecheck、renderer build 和 main build；执行 `npm run verify:quota`，确认 5H 与周额度快照校验通过；执行 `npm run verify:ledger`，确认账本页一致性校验通过；执行 `git diff --check`，仅有 Windows 换行提示，无空白错误。

## [2026-07-01] v0.3.1-dev.5 refactor: 接入 Codex 用量核心包

- 开发原因：按 `codex-usage-core` 迁移规划推进实施，避免 `codex-companion` 与 `dev-ledger` 各自维护分叉版 Codex 额度 reset 检测规则。
- 实现方式：将应用版本从 `v0.3.1-dev.4` 提升到 `v0.3.1-dev.5`；新增本地依赖 `@lifeinhand/codex-usage-core@0.1.0-dev.1`；`dashboardCollector` 删除本地 reset 候选、稳定确认、漂移排除和去重实现，改为调用核心包 `analyzeQuotaObservations`，本项目继续保留周期边界归一化、快照存储和 UI 映射；`AGENTS.md` 增加核心包最新性检查和共享规则优先落核心包的要求；数据契约和组件映射记录当前核心包版本。
- 当前结果：Codex 周额度 reset 规则由共享核心包提供；本项目仍输出原有 `quotaEvidence.resetEvents / usageSegments` 快照结构，页面展示口径不变。
- 验证方式：执行 `npm run typecheck`；执行 `npm run build`；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 在 `local_dev_work/live-check-core-dev5` 生成临时 live 快照，确认当前周仍为 `2026-06-30T03:22:09.000Z - 2026-07-07T03:22:09.000Z`，上一周期保留 `stabilized-boundary-drop` reset event；执行 `npm run verify:quota -- --snapshot local_dev_work\live-check-core-dev5\snapshot.json`；执行 `npm run verify:quota`；执行 `npm run verify:ledger`。

## [2026-07-01] v0.3.1-dev.4 docs: 规划 Codex 用量核心包迁移

- 开发原因：用户希望 `codex-companion` 与 `dev-ledger` 不再分别维护 Codex 用量、额度周期和 reset 检测逻辑，而是通过共享核心包同步规则更新。
- 实现方式：将应用版本从 `v0.3.1-dev.3` 提升到 `v0.3.1-dev.4`；新增 `docs/codex-usage-core-migration-plan-2026-07-01.md`，明确 `codex-usage-core` 的目标路径、远端仓库、职责边界、实施顺序、两个下游项目集成方式和三份 `AGENTS.md` 的协作规则改造。
- 当前结果：迁移方案已形成正式规划；本轮只做文档和版本记录，不创建核心包仓库，不修改 `dev-ledger`，也不改 `codex-companion` 运行时代码。
- 验证方式：执行 `git diff --check`。

## [2026-06-30] v0.3.1-dev.3 feat: 增加首次加载自动检测流程

- 开发原因：用户指出仅提供手动配置还不够，合理流程应先自动检测默认 Codex 数据目录和常见 Git 仓库目录；检测成功就直接使用默认配置，检测失败再提示手动选取。同时首次载入可能需要较长时间，应有明确的首次扫描流程说明。
- 实现方式：将应用版本从 `v0.3.1-dev.2` 提升到 `v0.3.1-dev.3`；新增 `DataSourceStatusPanel` 和 `FirstLoadPanel`，在 pending 快照阶段展示 `正在首次自动检测本机数据源`，说明首次扫描会解析 Codex 会话并遍历 Git 仓库；设置页 Codex 数据目录和仓库根目录区新增 `检测中 / 已检测到 / 未检测到` 状态标签；主界面数据源提示改为区分 Codex 未检测到和 Git 仓库未检测到；更新 README、组件映射和接线方案文档，明确自动检测成功使用默认路径、失败后引导手动选择。
- 当前结果：首次启动或无缓存启动时，用户能看到默认路径自动检测和首次扫描说明；后台采集完成后，默认路径命中则显示已检测到，未命中则提示打开设置手动选择对应目录；不会在 pending 阶段过早显示手动配置失败提示。
- 验证方式：执行 `npm run build`；使用 `CODEX_COMPANION_CAPTURE_PAGE=settings` 和 `CODEX_COMPANION_CAPTURE_PATH=local_dev_work\settings-auto-detect-dev2.png` 启动 Electron 捕获设置页截图，确认检测状态标签显示正常；执行 `git diff --check`，仅出现 Windows 换行转换提示。
- 遗留问题：还没有独立的全屏首次启动向导；当前先用自动检测面板、设置页状态标签和主界面提示完成轻量闭环。

## [2026-06-30] v0.3.1-dev.2 feat: 补齐换机数据源接线

- 开发原因：内测安装后暴露出产品过度依赖当前开发者本机默认路径的问题；安装包没有携带个人 Codex 数据，但新电脑缺少明确的 Codex 数据目录和 Git 仓库目录接线方法，容易让用户误以为软件是为单台机器量身定做。
- 实现方式：新增 `docs/setup-portability-solution-2026-06-30.md`，说明问题判断、目标、实施方案和后续首次启动向导建议；将应用版本从 `v0.3.1-dev.1` 提升到 `v0.3.1-dev.2`；`AppPreferences` 新增 `codexHome`，`SettingsStore` 默认使用 `CODEX_HOME || ~/.codex` 并自动迁移旧配置；`collectCodexData` 支持从偏好传入 Codex home；设置页新增 `Codex 数据目录` 配置区，支持手动输入、选择目录、恢复默认、保存并刷新；仓库根目录区补充恢复默认目录；主界面在 Codex 或 Git 数据未接通时显示数据源设置提示；后续 Windows 打包目标只保留 `nsis` 安装版，不再生成便携版。
- 当前结果：换电脑或首次安装后，用户可以在应用内完成 Codex 数据目录和 Git 仓库根目录接线；路径配置只写入本机 Electron `userData/settings.json`，不随安装包分发，也不会上传；保存数据源后会立即刷新快照，便于确认是否接通。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript 类型检查、renderer build 和 main build；使用 `CODEX_COMPANION_CAPTURE_PAGE=settings` 和 `CODEX_COMPANION_CAPTURE_PATH=local_dev_work\settings-auto-detect-dev2.png` 启动 Electron 捕获设置页截图，确认 Codex 数据目录和仓库根目录配置区显示正常，检测标签显示 `已检测到`，按钮不重叠，路径不溢出；执行 `npm run package:win`，确认只生成 `Codex Companion Setup 0.3.1-dev.2.exe` 安装版；执行 `git diff --check`。
- 遗留问题：真正的首次启动向导、脱敏诊断摘要、打开数据目录、应用图标和代码签名仍需后续单独实现。

## [2026-06-30] v0.3.1-dev.1 fix: 识别稳定边界回看周重置

- 开发原因：用户要求跟进 `dev-ledger` 最新额度重置规则；旧规则依赖相邻观测直接下降或新窗口起点贴近当前观测，可能漏掉相邻观测同为 `0%`、但 `24h` 内旧窗口存在更高水位的新稳定周窗口。
- 实现方式：将应用版本从 `v0.3.0` 提升到 `v0.3.1-dev.1`；周额度 `comparisonScope=timeline` 新增 `24h` 稳定边界回看候选，旧窗口高点比当前观测高至少 `5` 个百分点且新窗口起点比旧窗口起点后移超过 `15min` 时，生成 `stabilized-boundary-drop` 证据；候选仍必须等待 `30min` 并在后续 `6h` 内看到同一边界稳定观测，确认窗口内边界漂移超过 `15min` 时排除；同一新窗口起点在 `15min` 容差内只保留最早确认事件；`QuotaResetEvent.evidence` 新增 `stabilizedBoundaryEvidence / lookbackWindowMs / lookbackObservedAt`，校验脚本接受高水位、边界贴近或稳定边界回看三类证据。
- 当前结果：本项目可识别 `2026-06-30T03:56:42.332Z` 这类稳定边界回看周重置；本机 live 快照中当前周已切到 `2026-06-30T03:22:09.000Z - 2026-07-07T03:22:09.000Z`，账本上一周期保留 `stabilized-boundary-drop` 事件，旧高点 `15%`、新点 `0%`、回看高点观测时间 `2026-06-29T18:16:43.673Z`、稳定确认观测 `173` 次；数据契约、总览 UI Contract、账本 UI Contract、组件映射和额度快照校验规则已同步。
- 验证方式：执行 `npm run typecheck`；执行 `npm run build`；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 在 `local_dev_work/live-check-dev13` 生成临时 live 快照，确认 `overview.windowPeriods.weekLimit.startAt=2026-06-30T03:22:09.000Z`、`endAt=2026-07-07T03:22:09.000Z`；读取 `ledger.weeklyPeriods`，确认上一周期包含 `stabilized-boundary-drop` reset event；执行 `npm run verify:quota -- --snapshot local_dev_work\live-check-dev13\snapshot.json`；执行 `npm run verify:quota`；执行 `npm run verify:ledger`。

## [2026-06-30] v0.3.0 release: 内部正式版

- 开发原因：用户确认先在 private 仓库内部发布正式版并创建 GitHub Release，用于内测 Windows 安装包、便携包和主要产品链路，再决定公开发布节奏。
- 实现方式：将应用版本从 `v0.3.0-dev.10` 收敛为正式版 `v0.3.0`；更新 `package.json`、`package-lock.json`、README、Roadmap 和 Release notes；Release notes 明确本次包含 `v0.1.0-dev.1`、`v0.2.0-dev.1`、`v0.2.1-dev.1`、`v0.2.2-dev.1` 至 `v0.2.2-dev.79`、`v0.3.0-dev.1` 至 `v0.3.0-dev.10`，且没有排除开发版本；保留 private 内测、未签名、无自动更新和挂件暂未开放等边界说明；由于本地 Windows 权限无法解压 `winCodeSign` 中的符号链接，内部版临时设置 `win.signAndEditExecutable=false`，避免打包阶段依赖 exe 资源编辑和签名工具。
- 当前结果：项目已具备 `v0.3.0` 内部正式版发布资料；后续通过 `npm run package:win` 生成 Windows 安装包和便携包，并用 Git tag `v0.3.0` 创建 private GitHub Release。
- 验证方式：执行 `npm run build`；执行 `npm run package:win`；执行 `git diff --check`；检查 `release/` 产物，确认生成 `Codex Companion 0.3.0.exe` 和 `Codex Companion Setup 0.3.0.exe`；计算 SHA256：便携版 `952367D606DB43E7D39F317087843CB5341DB7142961988A7EAD7CDAF6FA8382`，安装版 `5378481B308C3126C31BFB35C2D9FB66D5CF662D1F465FB8552C95A9F2A01FF9`；最后用 GitHub Release 上传。
- 遗留问题：GitHub 仓库仍为 private，Release 资产只对有读权限的成员可见；Windows 包尚未代码签名且暂未编辑 exe 图标资源；公开发布前仍需补公开仓库元信息、截图、校验信息和更多自动化测试。

## [2026-06-30] v0.3.0-dev.10 feat: 完善公开开源使用闭环

- 开发原因：用户要求先整理详细的项目完善规划文档，再按文档推进公开开源前的可用性完善；当前项目功能和界面较完整，但 README、Release、CI、协作文件和仓库根目录配置仍不足以支撑外部用户直接使用。
- 实现方式：将项目版本从 `v0.3.0-dev.9` 提升到 `v0.3.0-dev.10`；新增 `docs/open-source-readiness-plan-2026-06-30.md`，明确普通用户、贡献者、维护者的完善目标、实施顺序、发布前检查清单和后续路线；重写 README，补充下载入口、首次配置、排障路径、隐私边界和挂件暂未开放状态；新增 GitHub CI、Windows 打包 workflow、PR 模板、`SECURITY.md` 和 `CODE_OF_CONDUCT.md`；更新贡献指南、Roadmap、Release notes、隐私说明、数据契约和组件映射；设置页新增仓库根目录配置区，主进程通过受控 IPC 调用系统目录选择器，`SettingsStore` 对仓库根目录执行去空、去重和空列表回退默认发现路径。
- 当前结果：公开项目信息入口、贡献流程、自动化构建和 Windows 打包骨架已经齐备；普通用户可在设置页维护 Git 仓库根目录，保存后立即刷新仓库扫描；README 与实现保持一致，不再把当前被禁用的桌面挂件描述成公开可用能力；仓库路径配置仍只保存在本机 Electron `userData/settings.json`，不改变本项目 local-first 隐私边界。
- 验证方式：执行 `npm run build`，通过 lint、TypeScript 类型检查、renderer build 和 main build；执行 `git diff --check`，通过，仅出现 Windows 换行转换提示；使用 `CODEX_COMPANION_CAPTURE_PAGE=settings` 和 `CODEX_COMPANION_CAPTURE_PATH=local_dev_work\settings-open-source-dev10.png` 启动 Electron 捕获设置页截图，确认新增仓库根目录区加载正常、路径文本不溢出、按钮不重叠。
- 遗留问题：GitHub 仓库公开可见性、正式 Release 资产、代码签名、自动更新和桌面挂件重新开放仍需维护者后续单独确认；collector 层自动化测试和脱敏 sample data 仍待补齐。

## [2026-06-30] v0.3.0-dev.9 fix: 对齐周额度重置确认规则

- 开发原因：用户要求参考 `dev-ledger` 最新实现，完善 Codex 额度重置规则和检测标准；旧实现主要按同 session 高水位下降识别，可能漏掉跨 session 的低用量周重置，也可能把低用量滑动窗口误判为重置。
- 实现方式：将项目版本从 `v0.3.0-dev.8` 提升到 `v0.3.0-dev.9`；`5 小时额度` 保持同 session 普通窗口分段累计；`周额度` 改为同一额度池全局时间线比较，并在 `resets_at` 后移超过 `60s`、`used_percent` 下降至少 `5` 个百分点后，要求具备 `used_percent >= 50` 高水位证据或新窗口起点贴近观测时间 `5min` 内的边界证据；候选必须等待 `30min`，并在 `6h` 确认窗口内看到同一边界稳定观测，若边界漂移超过 `15min` 则排除；确认后的周 reset 会作为新计费周边界，旧周期提前截止，新周期从 `afterWindowResetsAt - windowMinutes` 开始。
- 当前结果：`QuotaResetEvent` 增加 `evidence / confirmation / boundaryAt` 等证据字段；`dashboardCollector` 对周额度启用重置感知分桶，防止把确认重置前后的周额度百分比累加进同一个计费周；`LimitWindow.resetsAt` 跟随当前 `PeriodMetric.endAt`，避免原始滑动窗口漂移导致重置时间和周期范围不一致；`verify:quota` 在快照存在 `resetEvents[]` 时会校验证据、确认状态和至少 `5` 个百分点下降；账本页周额度说明、数据契约、总览 UI Contract、账本 UI Contract、组件映射和开发规划已同步口径。
- 验证方式：执行 `npm run typecheck`；执行 `npm run build`；调用编译后的 `DashboardService.getSnapshot(true, "manual")` 在 `local_dev_work/live-check-dev9` 生成临时 live 快照，确认 `limitWindows[1].resetsAt` 与当前周 `PeriodMetric.endAt` 同为 `2026-07-06T01:01:36.000Z`；执行 `npm run verify:quota -- --snapshot local_dev_work\live-check-dev9\snapshot.json`；执行 `npm run verify:quota`；执行 `npm run verify:ledger`；执行 `git diff --check`，仅有 Windows 换行提示。参考样例来自 `dev-ledger`：`2026-06-29` 的 `10% -> 0%` 低用量跨 session 周重置通过 `stable-window-boundary` 确认；`2026-06-24` 的多次低用量滑动窗口因确认窗口内边界漂移超过 `15min` 被排除。

## [2026-06-30] v0.3.0-dev.8 fix: 美化趋势放大态明细带

- 开发原因：用户反馈 `Token 走势拆解` 放大态虽然已按上下结构落地，但上方明细带与设计图仍有差距，主要是字体大小、日期位置和右侧表格视觉密度不协调。
- 实现方式：将项目版本从 `v0.3.0-dev.7` 提升到 `v0.3.0-dev.8`；仅调整放大态样式，把上方明细带固定为更稳定的信息面板；左侧日期和三项摘要使用等高浅底卡片；右侧明细表放大字号、增加表头和单元格内边距，并保持 `曲线 / 数值 / 占比` 三列。
- 当前结果：放大态明细区的日期、摘要和表格在同一视觉高度内对齐，表格文字不再过小，曲线图区仍位于明细带下方且不被遮挡；非放大态布局和数据口径不变。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-expanded-detail-1360x900-dev8.png`；执行 `git diff --check`。

## [2026-06-30] v0.3.0-dev.7 fix: 落地趋势明细二次设计

- 开发原因：用户确认放大态按新版设计图修改，并要求非放大态按口头方案处理：去掉顶部 `缓存输入占比` 摘要，只把 `会话` 和 `API 等价成本` 放到日期右侧。
- 实现方式：将项目版本从 `v0.3.0-dev.6` 提升到 `v0.3.0-dev.7`；`TrendDetailPanel` 新增 `showCacheSummary` 开关，非放大态隐藏顶部缓存占比摘要；放大态保留三项摘要并收紧右侧明细表列宽与行高，确保 `曲线 / 数值 / 占比` 三列表头和六条曲线行完整可见。
- 当前结果：非放大态右侧明细顶部只保留日期、会话和 API 等价成本，避免日期右侧空白和三指标拥挤；放大态上方明细带按设计保留缓存占比，并修正表格表头和占比列呈现。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-nonexpanded-detail-1360x900-dev7.png` 和 `local_dev_work/ledger-expanded-detail-1360x900-dev7.png`；执行 `git diff --check`。

## [2026-06-30] v0.3.0-dev.6 fix: 调整趋势放大态为上下明细结构

- 开发原因：用户确认不再继续出图，要求放大态改为上方明细、下方曲线的上下结构，默认隐藏上方明细，点击日期后展开；非放大态只需小范围优化右侧明细排版。
- 实现方式：将项目版本从 `v0.3.0-dev.5` 提升到 `v0.3.0-dev.6`；放大态 `TokenTrendExpandedView` 改为先渲染当前粒度明细、再渲染曲线图，`detail-open` 使用两行 grid；移除放大态右上绝对定位浮层；趋势横轴日期改为可点击按钮并复用已有点位选择逻辑；非放大态右侧明细把日期和指标改为上下排列，`会话 / API 等价成本` 两列显示，`缓存输入占比` 独占一行。
- 当前结果：放大态默认仍隐藏明细，用户点击曲线点位或横轴日期后，上方明细展开且不会遮挡曲线；非放大态明细信息不再强行挤在日期右侧，右栏留白利用更均衡。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-nonexpanded-detail-1360x900-dev6.png` 和 `local_dev_work/ledger-expanded-detail-1360x900-dev6.png`；执行 `git diff --check`。

## [2026-06-30] v0.3.0-dev.5 feat: 收起趋势粒度明细并优化布局

- 开发原因：用户反馈 `Token 走势拆解` 未放大模式下右侧细粒度明细占用空间，日期下方范围重复且意义不大；放大模式下右侧明细面板存在大量空白，需要重新设计图表与明细的显示关系。
- 实现方式：将项目版本从 `v0.3.0-dev.4` 提升到 `v0.3.0-dev.5`；新增 `isTrendDetailOpen` 状态，默认隐藏当前粒度明细；点击曲线点位时自动展开明细，卡片和放大层头部提供 `明细 / 隐藏` 切换；未展开时图表区域占满趋势卡或放大层主体；明细面板移除日期下方的重复日期范围，把 `会话 / API 等价成本 / 缓存输入占比` 移到日期右侧；放大模式明细同样可收起，收起后大图占满宽度，展开时以右上浮层展示紧凑明细，避免切出整列空白。
- 当前结果：默认账本页优先展示完整趋势图；用户需要查看具体日期或小时数据时，点击点位或 `明细` 按钮即可展开，展开后也可再次隐藏；放大视图隐藏明细时为全幅曲线，展开明细时曲线仍保持主体宽度。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev5-final.png` 和 `local_dev_work/ledger-expanded-detail-cdp-direct-1360x900-dev5.png`；执行 `git diff --check`。

## [2026-06-30] v0.3.0-dev.4 fix: 修正刷新状态与趋势曲线辨识度

- 开发原因：用户反馈手动刷新后仍一直显示 `数据过期`，并指出 `Token 走势拆解` 多条曲线颜色过于接近，难以区分不同输入输出类型。
- 实现方式：将项目版本从 `v0.3.0-dev.3` 提升到 `v0.3.0-dev.4`；调整 `collectCodexData` 的 `sourceStatus` 判定，有可解析 token 事件时即标记为 `已观测`，不再因最新 token 事件超过 `45` 分钟而降级为 `数据过期`；超过 `45` 分钟的最近活动只写入 `sourceHealth.notes` 和刷新反馈里的 `最新观测` 信息；将挂件中的 `最近刷新` 改为 `最近观测`；把趋势曲线色板改为蓝、紫、橙、青、绿、玫红六个差异更大的颜色；同步更新数据合同、UI Contract、组件映射和页面设计规格。
- 当前结果：刷新成功但最近没有新 Codex token 事件时，顶部状态显示 `已观测`，刷新反馈继续说明最新观测时间；趋势图默认可见曲线之间的色相差异更明显。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；使用编译后的 `DashboardService.getSnapshot(true, "manual")` 验证 `sourceStatus=observed`；执行 `npm run capture:overview`、`npm run verify:quota`、`npm run verify:overview`；生成并人工检查 `local_dev_work/ledger-1360x900-dev4.png`；执行 `git diff --check`。

## [2026-06-29] v0.3.0-dev.3 feat: 实现趋势平滑曲线与放大查看

- 开发原因：用户确认按上一轮规划实施，要求把 `Token 走势拆解` 的直线折线改为更自然的曲线，并增加可全截面看图的放大功能。
- 实现方式：将项目版本从 `v0.3.0-dev.2` 提升到 `v0.3.0-dev.3`；把趋势交互状态上提到 `LedgerPage`，由原卡片和放大层共享 `trendPeriod / visibleTrendSeries / selectedTrendBucketKey`；新增受约束的 Catmull-Rom 到 cubic Bezier 平滑 SVG path，保留真实点位和命中区；新增 `放大查看` 图标按钮、主内容区覆盖层、大尺寸趋势图、右侧当前粒度表、关闭按钮和 `Esc` 关闭；同步更新图标、样式、账本校验脚本、设计计划、UI Contract、组件映射和页面设计规格。
- 当前结果：`Token 走势拆解` 默认卡片已经使用平滑曲线；用户点击 `放大查看` 后可在主内容区覆盖层中查看大图和当前粒度表，切换粒度、显示 / 隐藏曲线、点击点位都会同步回原卡片；统计口径仍只来自 `snapshot.ledger.trend`。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev3.png`、`local_dev_work/ledger-1080x720-dev3.png` 和 `local_dev_work/ledger-expanded-1360x900-dev3.png`；执行 `git diff --check`。

## [2026-06-29] v0.3.0-dev.2 docs: 设计趋势平滑曲线与放大视图

- 开发原因：用户反馈当前 `Token 走势拆解` 折线视觉生硬，并要求先设计放大功能，使曲线图能在更大截面中阅读当前粒度表和多曲线变化。
- 实现方式：将项目版本从 `v0.3.0-dev.1` 提升到 `v0.3.0-dev.2`；更新账本页正式规划、UI Contract、模块合同、组件映射和页面设计规格；明确后续把直线折线改为穿过真实桶点的平滑 SVG 曲线；设计 `放大查看` 图标入口、主内容区覆盖层、大尺寸曲线区、右侧当前粒度表、状态同步和关闭行为；本轮只做设计与口径记录，不改渲染实现。
- 当前结果：下一轮实现已有明确边界：平滑只改变连接形态，不改变 `snapshot.ledger.trend` 桶数据；放大层只复用现有 `日 / 周 / 月`、曲线显隐和选中点位状态，不新增数据源、统计口径或隐私字段。
- 验证方式：执行 `npm run verify:ledger`；执行 `git diff --check`。

## [2026-06-29] v0.3.0-dev.1 feat: 升级账本页趋势为多曲线交互

- 开发原因：用户确认版本应按开发阶段合理提升，并建议 `Token 走势拆解` 改用曲线图，以兼容 `日 / 周 / 月` 粒度、同时展示多种输入输出曲线，并支持点击显示或隐藏曲线。
- 实现方式：将项目版本从 `v0.2.2-dev.79` 提升到 `v0.3.0-dev.1`；重构 `TokenTrendCard` 为本地 SVG 多曲线图，恢复 `日 / 周 / 月` 切换；新增 `总 Token / 输入总量 / 原始输入 / 缓存输入 / 输出 / 推理 Token` 曲线定义和图例显隐状态；点击曲线点位后，右侧显示当前小时或日期的粒度表，列出曲线数值、占比、会话、API 等价成本和缓存输入占比；同步更新账本页 UI Contract、模块合同、组件映射、页面设计规格和账本页校验脚本。
- 当前结果：`Token 走势拆解` 不再局限于周视图和单序列柱图；用户可在日、周、月之间切换，用多曲线比较输入输出变化，并通过图例控制曲线显隐。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查账本页截图；执行 `git diff --check`。

## [2026-06-29] v0.2.2-dev.79 fix: 简化账本页 Token 走势拆解

- 开发原因：用户反馈 `Codex 账本` 中 `Token 走势拆解` 信息过密，在当前窗口大小下横轴 / 纵轴 / 分层比例同时出现导致阅读复杂且比例不明确。
- 实现方式：将 `TokenTrendCard` 从多纵轴堆叠柱改为 `总量走势 + 选中日期拆解`：主图固定展示周视图日期粒度的 `总 Token` 单序列柱图，默认选中窗口内峰值日期；右侧明细用横向构成条展示 `原始输入 / 缓存输入 / 输出`，并把 `推理 Token` 作为输出子集标记，同时列出输入总量、缓存占比、输出、推理 Token、会话和 API 等价成本；移除当前不可有效使用的横轴 / 纵轴选择器；同步调整账本页网格比例、趋势卡高度和明细行高；更新账本页 UI Contract、模块合同、组件映射、页面设计规格和账本页校验脚本。
- 当前结果：趋势卡主图只负责看最近 7 个自然日总量变化，构成拆解集中在选中日期明细中，1360x900 与 1080x720 截图下不再出现趋势明细裁剪或核心文字重叠。
- 验证方式：执行 `npm run verify:ledger`；执行 `npm run typecheck`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev79.png` 与 `local_dev_work/ledger-1080x720-dev79.png`；执行 `git diff --check`。

## [2026-06-29] v0.2.2-dev.78 fix: 临时化刷新反馈并补设置页刷新历史

- 开发原因：用户确认项目继续作为独立应用维护，并指出刷新反馈常驻横条冗余、计费项目概览缺少月周期、总览默认视角应切到计费时间，同时需要确认当前数据是否独立统计。
- 实现方式：将总览默认视角改为 `计费时间`；把刷新反馈条改为仅在刷新中和完成/失败后约 `5s` 临时显示；为 `sourceHealth.refresh` 增加 `trigger`，新增 `sourceHealth.refreshHistory` 记录最近 `30` 次手动、自动、启动和后台刷新；设置页正式接入左下角入口，支持计费月起始日保存并刷新、刷新历史查看和数据边界说明；项目概览计费时间新增 `计费月`，并让 Git 采集器按 `billingMonthStartDay` 采集真实计费月代码活动；同步更新数据契约、组件映射、总览 UI Contract、页面设计规格、README 和隐私说明。
- 当前结果：刷新横条不再常驻；长期刷新记录迁移到设置页；计费时间下项目概览支持 `5H / 周额度 / 计费月`；应用明确独立读取 Codex 与 Git 数据，不使用 DevLedger 运行结果。
- 验证方式：执行 `npm run build`；用编译后的 `DashboardService.getSnapshot(true, "manual")` 与 `"auto"` 验证刷新历史来源；执行 `npm run capture:overview`；生成并目视检查 `local_dev_work/settings-1360x900-dev78.png`；执行 `npm run verify:overview`、`npm run verify:design`、`npm run verify:quota`、`git diff --check`，均通过。

## [2026-06-29] v0.2.2-dev.77 fix: 修正刷新反馈并接入 Codex 增量采集

- 开发原因：用户反馈点击刷新后长时间没有可见变化，需要确认刷新是否生效，并要求刷新时必须有反馈、Codex 会话采集必须增量化，避免每次重复解析大量本地 JSONL。
- 实现方式：为 `DashboardSnapshot.sourceHealth` 增加 `refresh` 反馈字段，记录刷新起止、总耗时、Codex/Git 分段耗时、新解析文件数、缓存复用数和清理数；新增 `CodexSessionCacheStore`，在 `%APPDATA%/codex-companion/codex-session-cache.json` 保存 JSONL 文件签名与解析后的聚合结果，采集器按 `size + mtimeMs` 复用未变化文件；渲染层新增顶部刷新反馈条，手动刷新时按钮显示 `采集中` 并禁用重复点击，完成后展示真实快照来源、耗时和缓存命中摘要；同步更新数据契约、组件映射、总览页 UI Contract、页面设计规格、README 和隐私说明。
- 当前结果：刷新链路仍统一走主进程 `DashboardSnapshot`，但用户可以看到读取缓存、增量采集、后台刷新完成或失败的明确反馈；Codex 会话第二次刷新可复用未变化文件，避免重复解析最近 60 天全部会话。
- 验证方式：执行 `npm run typecheck`；执行 `npm run build:main`；用编译后的 `DashboardService.getSnapshot(true)` 连续刷新两次，第一次解析 `377` 个 Codex JSONL、耗时约 `15.3s`，第二次解析 `0` 个、复用 `377` 个、总耗时约 `5.9s`；执行 `npm run capture:overview` 并目视检查 `1360 x 900` 与 `1080 x 720` 截图；执行 `npm run verify:overview`；执行 `npm run build`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check`。

## [2026-06-05] v0.2.2-dev.76 fix: 收敛账本页走势周期并增强分层可读性

- 开发原因：用户复核第二页左上角 `Token 走势拆解` 后指出两类问题：分层展示肉眼不明显，且 `日 / 月` 视角当前显示异常；需要先按约定的数据口径和页面原则收敛可用状态，而不是继续暴露未确认视角。
- 实现方式：在渲染层保留 `DashboardSnapshot.ledger.trend` 的日/月数据合同，但把 `Token 走势拆解` 的 `日 / 月` 标签置为禁用态，当前只允许 `周`；同时给非零 token 分层设置最小视觉高度，并为堆叠段增加分隔线，tooltip 继续展示真实 token、占比、会话和 API 等价成本；同步更新账本页 UI Contract、模块合同、组件映射和页面设计规格。
- 当前结果：第二页左上角不再能切到当前有问题的 `日 / 月` 视角；周视角下 `原始输入 / 缓存输入 / 输出` 的分层即使比例差距较大也能被识别，统计口径不因视觉最小高度而改变。
- 验证方式：执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev76.png`；执行 `git diff --check`。

## [2026-06-05] v0.2.2-dev.75 fix: 修正账本页密度并降低启动采集卡顿

- 开发原因：提交第二、第三页前复核发现第二页实现与设计图仍有密度偏差，尤其是图表区域过空、表格可见行数不足；同时用户反馈程序打开后非常卡，需按既定“先查数据链路再改实现”的方式定位并修复。
- 实现方式：压缩账本页三段布局比例、卡片内边距、图表柱区和表格行高，让 `周额度账本 / 模型贡献 / 会话归因` 更接近设计图的一屏阅读密度；启动性能方面，主进程改为打开时优先显示缓存快照，实时采集延迟到启动后后台执行，自动刷新从 `60s` 放宽到 `5min`，渲染层不再因缓存快照自动触发强制刷新；同时停用当前 UI 不使用的仓库文件体量扫描，避免每次刷新对全部 tracked files 做 `stat`。
- 当前结果：第二页实现更接近 `v0.3.15` 设计图的层级和密度；程序启动不再立即阻塞在完整 Codex + Git 重采集上，手动刷新和后台更新仍保留；第三页合同状态同步更新为已实现，第二第三页未提交改动准备进入统一提交。
- 验证方式：执行 `npm run typecheck`；执行 `npm run verify:ledger`；执行 `npm run build`；重新生成并人工检查 `local_dev_work/ledger-1360x900-dev75.png` 与 `local_dev_work/repositories-1360x900-dev75.png`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.74 feat: 落地 Codex 账本页新版设计

- 开发原因：用户要求把第二页已确认的 `v0.3.15` 设计图真正落到项目中，并确保实现继续遵守前面约定的数据边界、模块命名、周期语义和排序规则。
- 实现方式：扩展 `DashboardSnapshot.ledger.weeklyPeriods / trend / analysis`，由 `dashboardCollector` 基于真实 `CodexTokenEvent` 生成小时、日期、周段桶以及 `近7天 / 近30天 / 累计` 分析周期；在渲染层把第二页重构为 `Token 走势拆解 / 周期洞察 / 周额度账本 / 模型贡献 / 会话归因`，移除旧的重复额度三卡，并为模型贡献改成表头排序；同步新增 `npm run verify:ledger` 固化设计图、合同、采集器和页面实现的一致性检查。
- 当前结果：第二页已经按设计图落地为真实数据驱动页面；`Token 走势拆解` 支持局部 `日 / 周 / 月`、横轴和纵轴切换，`周期洞察` 与 `模型贡献` 各自支持 `近7天 / 近30天 / 累计`，周额度账本展示日期区间、累计已用、API 等价成本和满额周折算，会话归因仍只展示聚合字段。
- 验证方式：执行 `npm run verify:ledger`；执行 `npm run build`；生成并人工检查 `local_dev_work/ledger-1360x900-dev74.png`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.73 feat: 落地代码仓库页正式实现

- 开发原因：第三页 `代码仓库` 已完成设计收敛，但应用内仍停留在旧的仓库卡片流实现，和合同中的“同步 Git 仓库快照 + 顶部四卡 + 左侧可排序表 + 右侧联动详情”差距较大；需要按前面确认的方法把设计正式落实到项目中，并补齐可验证路径。
- 实现方式：先对齐共享数据合同与采集链路，给 `RepoMetric` 补入 `fullName / lastSyncedAt`，并把仓库汇总中的“近 7 日改动”改成真实滚动 7 天；随后重写渲染层第三页，收回顶栏中部占位文案，改成搜索栏、四张摘要卡、可点击表头排序的仓库详情表、右侧已选仓库详情与专用页脚；同时扩展主进程初始路由能力并新增 `capture:repositories` 截图脚本，用于生成第三页真实 Electron 截图做设计核验。
- 当前结果：第三页现在已经和合同对齐到同一套产品壳层与信息结构，不再展示目录视角、扫描目录、文件体量和本地工作区状态；仓库列表默认按最近提交倒序，可点击表头切换排序，右侧详情改为同步 Git 活动、Codex 投入概览和极简最近提交；数据口径也同步切到“定时同步 Git 快照”视角。
- 验证方式：执行 `npm run build`；执行 `git diff --check`；执行 `npm run capture:repositories` 生成真实 Electron 截图；人工比对实现图与 [docs/assets/design/v0.3.11/repositories-page.png](./docs/assets/design/v0.3.11/repositories-page.png) 的壳层、模块层级和关键信息结构。

## [2026-06-04] v0.2.2-dev.72 docs: 将账本页新命名与周期正式落图

- 开发原因：用户确认第二页的新命名和新周期规则后，要求把这些内容真正落到第二页设计图，而不是继续只停留在合同文字里。
- 实现方式：在保持第一页真实壳层、第二页三段堆叠图和表头排序规则不变的前提下，重出新版账本页状态图；同步让状态图引用切到 `docs/assets/design/v0.3.15/ledger-page.png`，并把 `Token 走势拆解 / 周期洞察 / 模型贡献` 以及 `近7天 / 近30天 / 累计` 写进总页面设计规格与账本页规划文档。
- 当前结果：第二页新的正式图片稿已经不再沿用旧标题，也不再让右侧两个模块继续跟左侧图表共用 `日 / 周 / 月`；当前图上已经能直接看到三处新命名和两个独立周期切换。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.71 docs: 收回第三页为同步 Git 仓库视角

- 开发原因：用户继续审第三页设计后指出三个核心偏差：页面对象不应再写成本地仓库，而应基于定时同步的 Git 信息；`目录视角 / 扫描目录` 没有实际价值；侧栏中还出现了重复的 `设置` 入口。
- 实现方式：回查第一页真实壳层和第三页 `v0.3.10` 状态图，确认偏差集中在数据对象定义、顶栏中部控件和侧栏导航；随后把总页面设计规格升级到 `v0.3.15`，明确第三页改为“定时同步 Git 仓库快照”视角，移除目录相关控件、去掉主导航内重复 `设置`，并同步修订第三页 UI Contract 的字段、页脚数据来源和右侧详情结构；最后按新合同重出 `docs/assets/design/v0.3.11/repositories-page.png`。
- 当前结果：第三页设计现在不再依赖本地目录语义；顶栏中部被收回为空白节奏，内容首行只保留仓库搜索和排序提示；左侧主导航只剩三页主入口，`设置` 只保留左下角一处；右侧详情也不再展示本地工作区状态，而是回到同步 Git 活动、Codex 投入和最近提交这几类更可信的信息。
- 验证方式：执行 `npm run build`；执行 `git diff --check`；人工比对第一页真实截图与第三页新图的侧栏、顶栏和内容首行结构。

## [2026-06-04] v0.2.2-dev.70 docs: 将账本页新命名与周期落到设计图

- 开发原因：用户确认第二页的新命名和周期语义后，要求不再只停留在合同文字里，而要真正落到第二页设计图上。
- 实现方式：延续上一轮已经确认的壳层、图表结构和表头排序规则，继续更新第二页规划文档、总页面设计规格和状态图版本号；随后重出新版账本页状态图，把 `Token 走势拆解 / 周期洞察 / 模型贡献` 三个名称，以及 `近7天 / 近30天 / 累计` 的右侧双模块周期切换直接落到图面。
- 当前结果：第二页最新状态图不再只是布局骨架图；新命名和新周期已经进入正式图片稿，右侧两个模块也不再和左侧走势图共用 `日 / 周 / 月`。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图是否使用新名称与 `近7天 / 近30天 / 累计`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.69 docs: 调整账本页模块命名与周期口径

- 开发原因：用户继续审第二页设计，认为 `Token 构成与强度 / 强度摘要 / 模型构成` 这三组名称都偏硬，且右侧两个模块虽然明显受周期影响，但继续跟左侧图表共用 `日 / 周 / 月` 并不合适；同时用户明确质疑 `全部` 这种周期文案是否边界太模糊。
- 实现方式：更新第二页规划文档、第二页 UI Contract、第二页模块合同与总页面设计规格，把三个模块统一重命名为 `Token 走势拆解 / 周期洞察 / 模型贡献`；同时把周期规则拆成两套：趋势图保留 `日 / 周 / 月`，右侧两个模块统一改为 `近7天 / 近30天 / 累计`，并在文档里明确不使用 `全部`。
- 当前结果：第二页当前合同已经不再把所有模块硬绑在同一套周期语义上；现在图表负责看走势，右侧两个模块负责看滚动周期聚合，页面解释更顺；当前 `v0.3.13` 图片保留为布局骨架图，下一轮重画时再把新名称和新周期文案落进去。
- 验证方式：执行 `npm run build`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.68 fix: 项目概览改为表头排序

- 开发原因：用户指出总览页项目概览右上角排序按钮不够美观和实用，期望默认按最新项目活动展示，并通过点击表头字段完成排序，第一次正序、第二次倒序。
- 实现方式：先更新总览页 UI Contract、组件映射、分区审计、比例测量和目标审计，明确排序入口归入表头；随后在 `OverviewPage` 中把排序状态改为 `key + direction`，默认 `recent / desc`，新增 `ProjectSortHeader`，让所有表头字段可点击排序，并移除右上角 chip 排序栏；同步增强 `verify:overview` 静态断言。
- 当前结果：项目概览默认按最近活动倒序展示；用户可点击 `项目 / Token / API 等价成本 / 代码行数 / 提交 / 会话 / 最近活动` 表头进行正序 / 倒序切换，项目概览标题区更简洁。
- 验证方式：执行 `npm run build`；逐张生成 `dev68` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview` 时被既有 5H 额度快照校验假设阻断，当前快照中 `resetsAt` 表现为最近重置点而非周期终点；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.67 docs: 按模块合同重画账本页设计图

- 开发原因：用户确认第二页应先按细化后的模块合同重画设计图，并进一步明确 `Token 构成与强度`、`强度摘要` 与 `模型构成` 需要严格体现模块级 `日 / 周 / 月`、固定六项摘要和表头排序，而不是继续沿用上一版状态图里的顶栏时间切换和按钮式排序。
- 实现方式：先核对第一页 `dev61` 真实截图与第二页 `v0.3.7` 旧图的冲突点，随后修订第二页规划文档、第二页 UI Contract 与总页面设计规格，把 `模型构成` 排序统一收敛到表头，升级总规格到 `v0.3.13`；最后按这些规则重出新版账本页状态图并保存到 `docs/assets/design/v0.3.13/ledger-page.png`。
- 当前结果：第二页最新状态图已经从“方向图”收紧为“按模块合同出图”的版本；页面顶栏不再承载 `日 / 周 / 月`，强度摘要统一为 `窗口累计 / 窗口均值 / 峰值位置 / 峰值用量 / 单次峰值 / 缓存输入占比` 六项，模型构成也不再保留额外排序按钮。
- 验证方式：执行 `npm run build`；人工核对新版账本页设计图是否移除了顶栏 `日 / 周 / 月` 与模型构成按钮式排序；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.66 fix: 项目概览改为表头排序

- 开发原因：用户指出总览页项目概览右上角排序按钮不够美观和实用，期望默认按最新项目活动展示，并通过点击表头字段完成排序，第一次正序、第二次倒序。
- 实现方式：先更新总览页 UI Contract、组件映射、分区审计、比例测量和目标审计，明确排序入口归入表头；随后在 `OverviewPage` 中把排序状态改为 `key + direction`，默认 `recent / desc`，新增 `ProjectSortHeader`，让所有表头字段可点击排序，并移除右上角 chip 排序栏；同步增强 `verify:overview` 静态断言。
- 当前结果：项目概览默认按最近活动倒序展示；用户可点击 `项目 / Token / API 等价成本 / 代码行数 / 提交 / 会话 / 最近活动` 表头进行正序 / 倒序切换，项目概览标题区更简洁。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev66` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.65 docs: 协调代码仓库页壳层与第一页一致性

- 开发原因：用户指出第三页当前设计图的左侧边栏和顶部工具栏风格与第一页实际落地界面不一致；继续沿用这版壳层会让第三页看起来像另一套产品，而不是同一个桌面应用内的页面。
- 实现方式：先对照 `local_dev_work/overview-1360x900-dev57.png` 与 `docs/assets/design/v0.3.9/repositories-page.png`，确认冲突点主要集中在左侧品牌区、导航激活态、底部设置区，以及顶部工具栏的结构和控件风格；随后把 `docs/page-design-spec-v0.3.md` 升级到 `v0.3.12`，明确第三页必须直接复用第一页真实左栏与三列顶栏，中部只保留目录视角切换，搜索框下移到内容区；同步更新 `docs/ui-contract/repositories-v0.1.md` 的壳层基准与页面结构，并重出新设计图到 `docs/assets/design/v0.3.10/repositories-page.png`。
- 当前结果：第三页新的壳层约束已经收紧为“左栏逐项对齐第一页、顶栏逐项对齐第一页”；第三页顶部不再使用独立的按钮风格筛选条，搜索和目录过滤回到内容区，右上只保留第一页同风格的 `状态 / 刷新 / 快照`；这样第三页在视觉上会回到与第一页同一套产品语言。
- 验证方式：人工比对第一页真实截图与第三页新图的左栏品牌块、导航激活态、底部设置区、顶栏三列结构和右上操作区；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.64 docs: 抽离账本页强度模块独立合同

- 开发原因：第二页 `Token 构成与强度` 与 `强度摘要` 已经从方向讨论进入细节确认阶段，继续只写在页级规格里不利于逐项确认；同时用户补充了“列表不要额外放排序按钮，优先用点表头正序 / 倒序”的交互偏好，需要沉淀成统一规则。
- 实现方式：新增 `docs/ui-contract/ledger-intensity-modules-v0.1.md`，单独收纳第二页强度模块的时间范围、横轴、纵轴、token 关系、图表堆叠方式、tooltip、强度摘要公式和模型构成排序交互；并把这份模块合同回链到第二页规划文档、第二页 UI Contract 与总页面设计规格中，升级总规格到 `v0.3.11`。
- 当前结果：第二页现在不仅有页级合同，还有针对 `Token 构成与强度 / 强度摘要 / 模型构成` 的独立模块合同；后续继续重画第二页设计图时，可以直接按模块合同核对，不需要再从整页规格里翻找散落规则。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.63 docs: 细化账本页强度模块与摘要模块口径

- 开发原因：用户认为第二页新图的 `Token 构成与强度` 与 `强度摘要` 方向正确，但交互和数据口径尚未设计完，例如 `日 / 周 / 月` 影响范围、横轴 / 纵轴可选项、token 关系、tooltip、堆叠方式、左右纵轴和摘要指标计算规则都还不够明确，现阶段直接固化设计图风险较高。
- 实现方式：重新核对 `codexCollector` 的 `TokenBreakdown`、`dashboardCollector` 的事件聚合与 `dev-ledger` 对 `cachedInputTokens / inputTokens / outputTokens / reasoningTokens` 的使用方式，明确 `输入总量` 与 `缓存输入`、`输出` 与 `推理 Token` 的包含关系；随后把这些结论回写到 `docs/ledger-page-design-plan-2026-06-04.md`、`docs/ui-contract/ledger-v0.1.md` 与 `docs/page-design-spec-v0.3.md` 第 3 节，补齐模块级时间范围、横纵轴、堆叠逻辑、tooltip 和强度摘要公式。
- 当前结果：第二页的两个核心模块现在已经从“示意图概念”升级为可执行设计合同；明确了 `日 / 周 / 月` 只作为局部分析状态、`强度摘要` 只跟随时间范围不跟随纵轴漂移、`总 Token` 不再错误地把 `缓存输入` 和 `推理 Token` 当成独立并列段堆叠；当前 `v0.3.7` 账本页图因此应视为阶段图，待这些规则确认后再决定是否重出页面设计图。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.62 docs: 精修代码仓库页排序与右侧详情

- 开发原因：用户继续细化第三页设计，要求左侧仓库详情不要再用一排排序按钮，而要改成点击列表头部排序；同时指出右侧新增的一行投入信息比较生硬，希望重做得更自然；另外质疑“最近提交”是否展示过多，需要重新判断其页面价值。
- 实现方式：更新 `docs/page-design-spec-v0.3.md` 到 `v0.3.9`，把第三页排序交互改成“默认按最近提交倒序，点击表头字段切换排序并支持正序 / 倒序”；将右侧投入摘要明确收敛为独立的 `Codex 投入概览` 小分区或 `2 x 2` 紧凑矩阵；同时弱化 `最近提交`，移出顶部四卡，并把详情中的提交展示压缩为最新 `2-3` 条或“最近一次提交 + 查看全部”；同步更新 `docs/ui-contract/repositories-v0.1.md`，并重出新设计图到 `docs/assets/design/v0.3.9/repositories-page.png`。
- 当前结果：第三页新版设计已经把左表排序交互融入表头本身，默认排序语义更自然；顶部第四卡由 `最近提交` 改为 `关联仓库`；右侧 `Codex 投入概览` 从生硬横排改成独立的视觉分区；`最近提交` 保留为“新鲜度证明”和上下文补充，但不再抢主视觉。
- 验证方式：人工核对新版设计图是否体现表头排序、`关联仓库` 替代顶部最近提交、右侧 `Codex 投入概览` 分区，以及最近提交的降级处理；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.61 fix: 默认计费月与自然月对齐

- 开发原因：用户从套餐信息确认当前月度计费从每月 `1` 日开始；此前计费时间下顶部 `本月 Token` 因未直接观测月额度窗口而显示 `未观测`，但 Token 计费月时间窗口已经可以按套餐起始日明确计算。
- 实现方式：在文档和实现中统一口径：计费月 Token 默认从每月 `1` 日 00:00 起算，月层面默认与自然月一致；为 `AppPreferences` 增加 `billingMonthStartDay`，新增 `startOfBillingMonth`，并让 `dashboardCollector` 产出 `billingMonth / previousBillingMonth` 周期，同时保留 `可观测月额度` 只来自 Codex `rate_limits` 的边界。
- 当前结果：计费时间下顶部 `本月 Token` 默认展示与自然月一致的本月 Token，不再显示 `未观测`；后续设置页可以直接接入 `billingMonthStartDay` 让用户选择每月第几天作为计费月起始日。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev61` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.60 docs: 为代码仓库页补回仓库级投入信息

- 开发原因：用户认可第三页整体结构，但希望再补一些“项目对应的 Token 消耗和对应成本”等信息，并明确要求参考 `dev-ledger` 的 Git 页展示方式。
- 实现方式：先核对 `src/shared/contracts.ts`、`src/renderer/App.tsx` 和 `dev-ledger/src/main.js`，确认当前第三页数据层已有 `repo.tokens.total` 与 `repo.apiCostUsd`，但尚无稳定的仓库级 `30 天成本 / 30 天 Token` 合同；随后把 `docs/page-design-spec-v0.3.md` 升级到 `v0.3.8`，将第三页调整为“顶部四卡仍讲工程活跃，中部左表增加 `Codex 投入` 列，右侧详情补 `累计 Token / 累计 API 成本 / 关联会话 / 最近 Codex 活动`”，并同步更新 `docs/ui-contract/repositories-v0.1.md`；最后按新口径重出设计图并保存到 `docs/assets/design/v0.3.8/repositories-page.png`。
- 当前结果：第三页现在既保留了 `扫描目录 + 活跃度 + 左表右详情` 的主结构，又补回了仓库级 Codex 投入信息；其中 Token / 成本只出现在中部工作台，不抬成首屏主卡，且文档明确当前仍只允许使用累计口径，不伪造 `30 天成本` 等合同外字段。
- 验证方式：人工对照 `dev-ledger` Git 页与新设计图，确认 Token / 成本回到左表和右侧详情而非顶部主卡；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.59 fix: 默认计费月与自然月对齐

- 开发原因：用户从套餐信息确认当前月度计费从每月 `1` 日开始；此前应用因 Codex 原始 `rate_limits` 未暴露月额度窗口，计费时间下顶部 `本月 Token` 显示 `未观测`，但月 Token 时间窗口可以按用户确认的套餐起始日计算。
- 实现方式：先更新数据契约、UI Contract、组件映射、额度审计、分区审计、比例测量和目标审计，明确计费月 Token 默认每月 `1` 日起算且不等同于月额度；随后为 `AppPreferences` 增加 `billingMonthStartDay`，默认值为 `1`，新增 `startOfBillingMonth` 工具，并让 `dashboardCollector` 生成 `billingMonth / previousBillingMonth` 周期；同步增强 `verify:overview` 对计费月起始日和聚合字段的静态检查。
- 当前结果：计费时间下顶部 `本月 Token` 默认与自然月一致，不再显示 `未观测`；`可观测月额度` 仍保持未观测，避免把 Token 时间窗口伪装成真实月额度。后续设置页可直接接入 `billingMonthStartDay`。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev59` 自然/计费四张真实 Electron 截图；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.58 docs: 重构账本页首屏为强度与周期细账

- 开发原因：用户明确指出 `5H / 周额度` 的限额表达已经在第一页稳定落地，第二页不应再用同样的三张大卡重复首屏；同时第二页应补入类似 `dev-ledger` Codex 页 `Token 构成与强度` 的核心模块，并把 `7 日均值`、`峰值时段`、`峰值日`、`单次峰值` 这类真实高价值信号纳入主结构。
- 实现方式：重新核对 `src/main/collectors/codexCollector.ts`、`src/main/collectors/dashboardCollector.ts`、`src/shared/contracts.ts` 与 `dev-ledger` 数据契约，确认当前底层事件已具备 `timestamp + input / cachedInput / output / reasoningOutput / total`，可以合法支持 `日 / 周 / 月`、`横轴` 和 `纵轴` 切换；随后重写第二页规划文档、`docs/ui-contract/ledger-v0.1.md` 与 `docs/page-design-spec-v0.3.md` 第 3 节，把第二页首屏改成 `Token 构成与强度 + 强度摘要`，并把第一页壳层基线同步切到最新 `dev57` 实际截图。
- 当前结果：第二页设计原则已从“额度三卡 + 账本 + 模型 + 会话”更新为“强度主图 + 峰值摘要 + 周额度账本 + 模型构成 + 会话归因”；页面明确支持 `总 Token / 输入 / 缓存输入 / 缓存输入占比 / 输出 / 推理 Token` 的纵轴口径，且不再重复展示固定月额度或 `剩余 Token` 这类无稳定来源字段。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.57 fix: 精修顶部四卡图标和状态标签

- 开发原因：继续按用户对总览页顶部四张指标卡的视觉反馈修正；当前图标、文字和字体方向已正确，但图标与右侧三行文字关系还可更统一，且四卡重复显示正常态 `已观测` 与顶栏全局状态冗余。
- 实现方式：先更新 UI Contract、组件映射、分区审计、比例测量和目标审计，明确正常 `已观测` 不在单卡重复展示、异常态仍显示；随后让 `MetricCard` 仅在 `sourceStatus !== "observed"` 时渲染状态标签，并将图标盒调整为 `64px - 72px`、收紧图标与文字组间距；同步更新 `verify:overview` 静态断言和版本号。
- 当前结果：自然时间四张指标卡不再显示重复 `已观测`，顶部工具栏仍展示全局状态；计费月等异常态仍可在单卡右上角显示；图标高度更接近右侧标题、主数字和说明三行文字总高度，视觉组关系更紧凑。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev57` 自然/计费四张真实 Electron 截图；人工查看 `local_dev_work/overview-1360x900-dev57.png`；执行 `npm run verify:overview`；执行 `git diff --check`。

## [2026-06-04] v0.2.2-dev.56 docs: 重修账本页设计基线与第二页设计图

- 开发原因：第一页已经基本落地，第二页 `Codex 账本` 不应继续沿用第一页旧设计稿做壳层参考；同时旧账本页初稿含有 `剩余 Token`、伪模型名、`上上周` 相对命名、用户/状态/平均响应时长等不符合当前真实数据边界的内容，需要先在设计阶段纠偏。
- 实现方式：先以 `local_dev_work/overview-1360x900-dev53.png` 与计费态实际截图固定统一应用壳层，再对照 `src/shared/contracts.ts`、当前 `%APPDATA%/codex-companion/snapshot.json` 和 `dev-ledger/public/dashboard-data.local.json` 梳理账本页可展示字段；新增 `docs/ledger-page-design-plan-2026-06-04.md` 与 `docs/ui-contract/ledger-v0.1.md`，重写 `docs/page-design-spec-v0.3.md` 第 3 节及 `v0.3.5` 状态图说明，生成新版账本页设计图 `docs/assets/design/v0.3.5/ledger-page.png`，并同步更新路线图与版本号。
- 当前结果：第二页正式设计基线已切换为第一页真实截图；账本页顶部保留 `5 小时额度 / 周额度 / 可观测月额度` 三张卡，但不再展示 `剩余 Token`；中部主表改为按日期区间阅读的 `周额度账本`，允许体现 `117%` 这类累计已用和 `重置 1 次` 等真实周期特征；模型构成改为真实模型标签；会话归因删去无稳定来源的伪字段。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.55 docs: 重构代码仓库页设计稿

- 开发原因：第一页已经完成大体落地，第二页也已按真实数据边界重做设计；第三页 `代码仓库页` 仍停留在旧 `v0.3` 初稿。用户要求先沿用前两页的修正方法，重新讨论第三页的主对象、顶部摘要、左中右结构，以及扫描目录和远端信息的作用。
- 实现方式：先对照第一页实际截图 `local_dev_work/overview-1360x900-dev53.png`、现有仓库采集链路和旧版第三页设计图，更新 `docs/page-design-spec-v0.3.md` 到 `v0.3.6`；新增 `docs/ui-contract/repositories-v0.1.md` 固化第三页的壳层基准、数据边界、页面结构、修正原则和后续实施顺序；随后使用 `imagegen` 重出第三页设计图并落盘到 `docs/assets/design/v0.3.6/repositories-page.png`。
- 当前结果：第三页正式收敛为 `扫描目录筛选 + 四张摘要卡 + 可排序 Git 仓库详情表 + 单仓库详情 + 紧凑页脚说明`；首屏移除了 `归因 Token`、`文件体量` 和独立 `GitHub 远端` 大卡；页面主对象统一为本地 Git 仓库，和当前采集模型一致。
- 验证方式：人工核对新设计图与第一页已落地壳层的一致性；执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.54 fix: 修正主额度池与昨日代码对比口径

- 开发原因：继续按用户对总览页数据的反馈修正两个问题；当前 5H 额度会被更新时间更新的模型额度池 `codex_bengalfox` 覆盖，导致主额度余量显示错误；顶部 `今日代码改动` 的 `较昨日` 没有读取昨日自然日 Git 行数，导致昨日有数据时仍可能显示 `新增`。
- 实现方式：先更新数据契约、UI Contract、组件映射、额度审计、分区审计、比例测量和目标审计，明确可见 `5H / 周额度` 优先主额度池 `limit_id=codex`，且 `quotaEvidence` 只混合同一额度池样本；随后让 `codexCollector` 保留 `limitId / limitName` 并按主池优先选择快照，让 `dashboardCollector` 过滤异池观测点并把昨日 Git 聚合传入 `previous.yesterday`，让 `gitCollector` 与共享契约补充 `activity.yesterday`；同步增强 `verify:overview` 回归检查。
- 当前结果：当前 live 快照显示 5H 额度周期余量 `78%`、周额度周期余量 `88%`，均来自主额度池；顶部 `今日代码改动` 使用今日 `7383` 行与昨日 `5219` 行计算，截图中显示 `较昨日 +41.5%`。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev54` 自然/计费四张真实 Electron 截图；人工查看 `local_dev_work/overview-1360x900-dev54.png`；执行 `npm run verify:quota`；执行 `npm run verify:overview`；执行 `git diff --check`，仅有 Windows 换行提示。

## [2026-06-04] v0.2.2-dev.53 fix: 修正额度剩余量和截图验收口径

- 开发原因：继续按用户对 `dev52` 的反馈修正总览页；周额度圆环仍使用最近原始 `rate_limits` 余量，可能显示 `100%`，但同一周额度周期的累计 `quotaEvidence.usedPercent` 已经消耗到 `6%+`；顶部四卡图标仍偏小，额度圆环内部文案层级也需要按设计调整。
- 实现方式：先对照 `dev-ledger` 已生成的前几周计费周摘要，更新数据契约、UI Contract、组件映射、分区审计、比例测量、设计 token、目标审计和数据审计；随后将 Codex session 扫描窗口扩展到近 `60` 天，`LimitWindow.usedPercent / remainingPercent` 优先使用当前周期 `quotaEvidence` 显示口径，最近原始 `rate_limits` 仅作降级；同步更新 `verify:quota` 断言、顶部四卡图标尺寸、额度圆环内 `剩余量` 与百分比位置，并要求截图前必须强制生成 `live` 快照。
- 当前结果：周额度圆环和 `verify:quota` 已统一到周期累计余量；当前本机快照显示周额度 `周期余量 91% / 周期累计 9%`；顶部四卡图标最小尺寸提升到 `52px`；截图流程不再允许旧缓存生成当前版本验收图。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev53` 自然/计费四张当前版本截图；执行 `npm run verify:quota`；执行 `npm run verify:overview`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.52 fix: 修正总览页实时刷新与顶部细节

- 开发原因：继续按用户对 `dev51` 的反馈修正总览页；当前页面运行后不会实时更新数据，顶部四卡的 `数据过期` 等状态标签单独占一行，四卡内容左对齐且图标比例不够自适应，顶栏时间视角仍有偏左感。
- 实现方式：先更新 UI Contract、组件映射、分区审计、比例测量、设计 token 文档和目标审计，明确实时刷新广播、四卡右上角状态、内容居中、图标自适应和顶栏三列居中的规则；随后在主进程新增 `dashboard:updated` 广播和 `60s` 自动刷新，预加载层与共享契约暴露 `onDashboardUpdated`，渲染端订阅后静默替换快照；样式层将顶栏改为三列布局，四卡状态固定右上角、内容组居中、指标图标使用 `clamp()` 自适应；同步增强 `verify:overview` 对刷新链路和样式关键不变量的检查。
- 当前结果：启动后台采集、手动刷新、托盘刷新和周期刷新都会统一广播最新快照；页面不再只依赖启动读取一次；顶部四卡状态标签不再占底行，文字和图标关系更接近设计稿，时间视角在顶栏中段居中。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev52` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题，仅有 Windows 换行提示。

## [2026-06-04] v0.2.2-dev.51 fix: 精修总览页品牌、额度说明和色阶

- 开发原因：继续按用户对 `dev50` 截图的反馈精修总览页；左侧品牌图标和标题仍有轻微错位，额度卡底部说明占用额外行高，时间视角需要更明确的一行容器，整体字体颜色和状态色阶还需更贴近设计稿。
- 实现方式：先更新 UI Contract、组件映射、设计 token 文档、设计到产品流程、分区审计和视觉测量，明确本轮细节约束；随后将图标资产抽到 `src/renderer/icons.tsx`，调整品牌图标基线、顶栏 `topbar-mode-switch`、额度证据行和颜色 token；同步增强 `verify:overview` 对图标模块与当前结构的检查。
- 当前结果：品牌区图标与标题顶线更接近；额度卡不再渲染独立底部说明行，观测证据并入 `Top 3 模型占比` 标题行；时间视角由单一 inline 容器承载；文字色阶、主蓝、状态色和左侧激活底色进一步收敛。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev51` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.50 test: 补齐总览页自然/计费双状态截图

- 开发原因：继续补强“按设计稿对照”和“额度数据正确”的证据链；此前 `capture:overview` 只生成默认自然时间截图，无法证明计费时间状态在真实 Electron 中可达，也无法覆盖计费月未观测状态、计费项目周期切换等 UI 回归。
- 实现方式：主进程截图入口新增 `CODEX_COMPANION_OVERVIEW_MODE=billing` 支持，渲染层从 hash 查询参数读取初始 `overviewMode`；`capture:overview` 改为生成自然时间与计费时间各 `1360 x 900`、`1080 x 720` 的四张截图；`verify:overview` 要求四张当前版本截图均存在，并检查截图入口相关实现标记；同步更新 UI Contract、设计流程、分区审计、视觉测量和目标审计。
- 当前结果：页面级验收不再只证明自然时间默认态，计费时间真实页面也纳入截图证据；普通用户默认进入自然时间不变。本轮不改变统计口径、额度计算、默认页面状态或用户手动切换行为。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev50` 自然/计费四张当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.49 fix: 修正顶部四卡逐卡状态

- 开发原因：继续复核自然时间 / 计费时间切换的数据状态；计费时间下 `billingMonth` 尚未稳定观测时，`本月 Token` 主值会显示 `未观测`，但顶部四卡状态仍统一沿用全局 `sourceHealth.sourceStatus`，可能错误显示 `已观测`。
- 实现方式：先更新 UI Contract、组件映射、分区审计和视觉测量，明确顶部四卡状态必须跟随单卡数据可观测性；随后为 `OverviewMetricCardData` 增加 `sourceStatus`，让 `MetricCard` 使用 `card.sourceStatus` 渲染；当 `billingMonth` 缺失时将计费时间下 `本月 Token` 状态设为 `unobserved`；同步增强 `verify:overview` 静态检查。
- 当前结果：计费时间下未观测的计费月指标不会再显示全局 `已观测`，避免状态和主值互相矛盾；默认自然时间截图布局不变。本轮不改变 Token、额度、成本、Git 聚合、卡片字段或项目概览。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev49` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.48 fix: 修正总览页顶栏时间视角位置

- 开发原因：继续按设计稿分区对照总览页；`dev47` 中 `时间视角 / 自然时间 / 计费时间` 虽然保持单行，但因顶栏使用 `space-between`，控件被推到右侧操作区附近，不符合设计稿“左侧页面识别 / 中部页面控制 / 右侧数据操作”的壳层结构。
- 实现方式：先更新 UI Contract、组件映射、分区审计和视觉测量，明确时间视角应处于顶栏中部；随后将 `.topbar` 改为左侧标题组固定/可收缩宽度、时间视角紧随标题组、右侧操作区 `margin-left: auto` 贴右；同步提升版本号和目标审计截图引用。
- 当前结果：顶部时间视角从右侧操作区旁边回到顶栏中部，仍保持无边框单行文本切换；右侧状态、刷新和快照继续贴右且快照只出现一次。本轮不改变顶部四卡、额度卡、项目概览、设计 token 或任何数据口径。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev48` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.47 fix: 收敛总览页视觉细节

- 开发原因：继续按设计稿对照总览页；当前页面整体方向已接近，但左侧品牌图标与标题存在轻微基线错位，额度卡底部说明重复具体额度窗口名称，顶栏时间视角需要更强单行保护，颜色和文字色阶仍比设计稿偏重。
- 实现方式：先更新 `docs/ui-contract/overview-v0.1.md`、设计 token 文档、设计流程和分区审计，明确品牌基线、额度短句、时间视角 inline-flex 和新色阶；随后调整 `design-tokens.ts`、`styles.css`、品牌 SVG 色值和 `dashboardCollector` 额度注记；同步更新 token 校验和版本号。
- 当前结果：左侧品牌块更接近设计稿顶线对齐；额度注记统一为 `圆环=最近余量；右侧=当前周期累计。`；时间视角保持单行文本切换；整体配色从偏蓝白浮层收敛为更克制的浅蓝白、石墨文字和轻描边。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev47` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.46 test: 增强总览页目标不变量验收

- 开发原因：继续推进“认真对照并争取全部改完”的目标；现有 `verify:overview` 已检查截图和基础文档，但对挂件隐藏、真实 `rate_limits` 采集、连续 token 增量、额度周期证据和近期 UI 细节仍是间接证据，后续容易回退。
- 实现方式：扩展 `scripts/verify-overview-readiness.mjs`，将 `src/main/index.ts`、`codexCollector.ts`、`dashboardCollector.ts`、`docs/data-contract-v0.2.md` 纳入检查，断言 `WIDGET_DISABLED`、`rate_limits`、`total_token_usage`、`quotaEvidence`、`estimatedValueBasisUsedPercent`、`formatQuotaPeriodRange` 和 `tok` 等关键标记；同时增强主进程截图钩子，在 `capturePage()` 触发 `UnknownVizError` 时通过短延迟进行内部重试；同步更新设计流程、分区审计、比例测量、目标审计和版本号。
- 当前结果：页面级验收从“交付物齐套”增强为“交付物齐套 + 原目标关键不变量未回退”；本轮不修改 UI、采集逻辑、额度算法或图标实现。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev46` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.45 docs: 刷新总览页目标审计运行态证据

- 开发原因：继续推进“额度数据接入真实数据”和“认真对照并争取全部改完”的目标；目标完成度审计中的 5H / 周额度运行态摘要仍停留在旧快照，与当前 `snapshot.json` 和 `npm run verify:quota` 输出不一致。
- 实现方式：只读取当前运行态聚合字段，刷新目标审计中的额度周期、Token、API 等价成本、代码行数、会话数、观测证据、圆环余量、价值折算和 sourceHealth 摘要；同步更新分区审计、比例测量和版本号。
- 当前结果：目标审计证据与当前运行态快照保持一致；本轮不改变 UI、额度计算、Token 增量、Git 聚合或图标资产。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev45` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.44 fix: 优化额度周期范围文案

- 开发原因：继续按区块对照总览页设计稿；当前周额度窗口的周期文案会显示成 `周期 09:02 - 09:02`，真实周期边界正确，但前端文案容易被误解为零长度周期。
- 实现方式：更新 UI Contract、组件映射、分区审计、比例测量和目标审计，明确额度周期范围按跨度自适应显示；新增 `formatQuotaPeriodRange`，同日短周期显示 `HH:mm - HH:mm`，跨日短周期显示 `MM/DD HH:mm - MM/DD HH:mm`，周额度等多日周期显示 `MM/DD - MM/DD`；同步提升版本号。
- 当前结果：额度卡保留重置时间和周期范围同一行展示，周额度不再显示两个相同时间点；不改变额度周期计算、Token、成本、代码行数、会话数、圆环余量、观测证据或模型占比。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev44` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.43 fix: 补齐额度 Token 明细单位

- 开发原因：继续按区块对照总览页设计稿；中部额度卡右侧 `Token 用量` 在设计稿中带 `tok` 后缀，当前实现只显示紧凑数字，扫读时不如设计稿明确。
- 实现方式：先更新 UI Contract 和分区审计，明确 `tok` 后缀只用于额度卡右侧 `Token 用量` 明细；随后调整 `QuotaWindowCard` 的 Token 明细值，保留既有 `万 / 亿` 自动单位；同步修正截图自动化，截图模式下禁用硬件加速，主进程捕获失败时非零退出，`capture:overview` 删除旧截图后重试并验证输出非空；同步更新比例测量、目标审计和版本号。
- 当前结果：额度卡右侧 Token 明细更接近设计稿表达；顶部四卡、项目概览表、模型占比、Token 计算、成本折算、额度周期和 Git 统计均不改变。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev43` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.42 fix: 修正顶部四卡新增说明

- 开发原因：继续按区块对照总览页设计稿；当前截图中 `今日代码改动` 在上一周期为 `0`、当前有代码改动时显示 `数据待补齐`，这不是数据缺失，而是百分比分母为 `0`，会误导用户以为 Git 数据未接入。
- 实现方式：更新 UI Contract、分区审计、比例测量和目标审计，明确上一周期为 `0` 且当前大于 `0` 时显示 `较上一周期 新增`；调整 `describeDelta` 和正向色彩判定，让 `新增` 使用正向变化样式；修正真实 Electron 截图钩子，确保 `capturePage()` 偶发失败时也会退出，并给 `capture:overview` 增加单视口超时；同步提升版本号。
- 当前结果：顶部四卡可以区分真实缺数据与新增场景；不伪造 `+100%` 或无限百分比，不改变 Token、代码改动、额度数据或项目聚合口径。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview` 生成 `dev42` 当前版本截图；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.41 test: 绑定总览页当前版本截图

- 开发原因：继续推进“认真对照设计稿并争取全部改完”的目标；上一轮 `verify:overview` 已提供页面级验收入口，但仍静态依赖 `dev36` 真实截图，不能证明当前开发版本的视觉证据仍然新鲜。
- 实现方式：新增 `scripts/capture-overview-screenshots.mjs` 和 `npm run capture:overview`，按当前 `package.json` 版本生成 `1360 x 900` 与 `1080 x 720` 总览页真实 Electron 截图；更新 `verify:overview`，从当前版本推导截图后缀并要求对应截图、审计文档和目标审计同步引用；同步更新设计流程、分区审计、比例测量、目标审计和版本号。
- 当前结果：总览页页面级验收不再沿用历史截图；后续版本号提升后，如果没有重新生成当前版本截图，`npm run verify:overview` 会失败。本轮不修改 UI、额度数据、项目聚合或设计 token。
- 验证方式：执行 `npm run build`；执行 `npm run capture:overview`；执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.40 test: 增加总览页级验收命令

- 开发原因：继续推进“认真对照并争取全部改完”的目标；现有 `verify:design`、`verify:quota`、真实截图和分区审计证据分散，缺少一条总览页级命令确认设计图、文档、截图、图标组件、token 和额度真实数据证据齐套。
- 实现方式：新增 `scripts/verify-overview-readiness.mjs` 和 `npm run verify:overview`；脚本检查总览页交付文件、关键文档内容、实现标记、最新截图，并串联执行 `verify-design-tokens` 与 `verify-quota-snapshot`；同步更新设计到产品流程、目标完成度审计和版本号。
- 当前结果：总览页具备页面级可执行验收入口；本轮不修改 UI、数据采集、额度计算或项目聚合逻辑。
- 验证方式：执行 `npm run verify:overview`；执行 `npm run verify:design`；执行 `npm run verify:quota`；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.39 test: 增加设计 token 校验

- 开发原因：继续推进“按流程从设计图过渡到实际产品”的目标；虽然运行时已有 `src/renderer/design-tokens.ts`，但缺少正式 token 文档和可执行校验，后续配色、圆角和核心间距容易在页面迭代中漂移。
- 实现方式：新增 `scripts/verify-design-tokens.mjs` 和 `npm run verify:design`，校验 `styles.css` 中全局 token 引用都已在 `design-tokens.ts` 定义，并锁定关键色阶、圆角和间距；新增 `docs/design-tokens-v0.1.md`，同步更新设计流程、组件映射和目标完成度审计。
- 当前结果：总览页设计 token 从“运行时已有”补齐为“文档化 + 可执行校验”的正式交付物；组件局部变量如 `--quota-progress` 明确不纳入全局 token。
- 验证方式：执行 `npm run verify:design`，确认全局 token 引用和关键视觉变量通过；执行 `npm run verify:quota`；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.38 docs: 刷新总览页目标审计证据

- 开发原因：继续推进“认真对照并争取全部改完”的目标；目标完成度审计虽然已引用 `verify:quota`，但截图和部分运行态摘要仍停留在 `dev25/dev28`，与当前实现证据不一致。
- 实现方式：更新 `docs/goal-audit/overview-goal-completion-audit-v0.1.md`，将实现截图改为 `dev36` 最新 UI 截图，并用当前运行态快照刷新 5H / 周额度周期、Token、观测证据和周额度价值折算摘要；同步提升开发版本号。
- 当前结果：目标审计中的设计证据、额度证据和验证记录与当前实现保持一致；本轮不修改 UI、数据采集、额度计算或项目聚合逻辑。
- 验证方式：执行 `npm run verify:quota`，确认额度快照校验通过；执行 `npm run build`；本轮不修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.37 test: 增加额度快照校验命令

- 开发原因：继续推进“额度数据接入真实数据”的目标；现有额度审计已证明当前实现参考 `dev-ledger` 接入了真实 `rate_limits` 和周期 token 增量，但缺少可重复执行的本地校验命令，后续容易只靠人工读快照判断是否回退。
- 实现方式：新增 `scripts/verify-quota-snapshot.mjs`，提供 `npm run verify:quota`；脚本默认读取运行态 `snapshot.json`，只校验聚合字段，不读取或输出原始会话正文；同步更新数据契约、额度审计和目标完成度审计。
- 当前结果：可以自动断言 5H / 周额度窗口来源、窗口长度、圆环余量、周期边界、`quotaEvidence` 观测证据和价值折算分母，防止额度数据回退到静态或错误口径。
- 验证方式：执行 `npm run verify:quota`，确认 5H / 周额度窗口、周期边界、观测证据和价值折算分母通过；执行 `npm run build`；本轮未修改 UI，不生成新截图；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.36 fix: 对齐项目概览默认周期

- 开发原因：继续对照 `v0.3.3` 自然时间总览页设计稿与 `dev35` 截图，设计稿中项目概览二级周期默认高亮 `周`，当前实现首次进入总览页默认高亮 `日`，导致首屏项目概览更偏当天明细而不是周期概览。
- 实现方式：更新 UI Contract、组件映射和区块审计，明确自然时间默认 `周`、计费时间默认 `周额度`；将 `OverviewPage` 的项目概览默认周期状态从 `day / fiveHour` 改为 `week / weekLimit`。
- 当前结果：项目概览首次进入时更接近设计稿默认高亮和概览口径；未改变项目数据聚合、排序、字段、表格结构或项目保留规则。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev36.png` 与 `local_dev_work/overview-1080x720-dev36.png`，确认自然时间下项目概览默认高亮 `周` 且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.35 fix: 顶栏状态胶囊改为文字-only

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev34` 截图，设计稿右上角状态胶囊只显示 `已观测` 文本，当前实现额外显示状态图标，视觉上更像操作按钮且宽度偏大。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确顶栏状态胶囊文字-only；移除顶栏状态胶囊中的图标渲染，但保留 `status` 图标资产供后续其他场景使用。
- 当前结果：顶部工具栏状态胶囊更接近设计稿；未改变状态枚举、状态文案、刷新按钮、快照时间或数据源判断。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev35.png` 与 `local_dev_work/overview-1080x720-dev35.png`，确认顶栏状态胶囊文字化且时间视角仍单行；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.34 fix: 将总览页数据来源归入项目概览卡

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev33` 截图，设计稿中的数据来源说明和 `session / archived / 仓库` chips 归属于项目概览卡底部，当前实现放在项目卡外，视觉归属弱于设计稿。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确总览页页脚数据来源归入项目概览卡底部；抽出 `FooterNote` 组件复用同一份 `snapshot.sourceHealth` 与 `snapshot.pricingMeta`，总览页在项目卡内部渲染，账本页和代码仓库页继续在页面底部复用。
- 当前结果：总览页底部可信度信息更接近设计稿的卡片归属；未改变 session / archived / 仓库数量、定价来源文案、项目表数据或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev34.png` 与 `local_dev_work/overview-1080x720-dev34.png`，确认总览页页脚已归入项目概览卡且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.33 fix: 补齐项目概览表格列线

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev32` 截图，项目概览表格缺少设计稿中的轻量纵向列线，列边界主要依赖空白，账本感和扫读性弱于设计稿。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确项目概览表格保留浅色横向和纵向网格线；仅在 `.project-card` 内为项目概览表格追加弱纵向列线，避免影响会话表或其他页面表格。
- 当前结果：项目概览区更接近设计稿的账本表格结构；未改变项目数据、排序、滚动、项目图标或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev33.png` 与 `local_dev_work/overview-1080x720-dev33.png`，确认项目表格列线生效且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.32 fix: 左侧导航收敛为单行结构

- 开发原因：继续对照 `v0.3.3` 总览页设计稿与 `dev31` 截图，发现左侧导航仍显示二级说明文案，视觉密度高于设计稿，也让导航区承担了不必要的信息摘要职责。
- 实现方式：更新组件映射、UI Contract 和区块审计，明确左侧导航只显示图标和主标签；移除 `NAV_ITEMS.detail` 与设置入口二级说明，并将导航主标签调整为单行居中显示。
- 当前结果：`总览 / Codex 账本 / 代码仓库 / 设置` 更接近设计稿的单行导航结构；未改变路由、页面标题、副标题、图标资产或任何数据口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev32.png` 与 `local_dev_work/overview-1080x720-dev32.png`，确认左侧导航单行化生效且小窗口仍完整显示；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.31 fix: 修正额度价值折算分母

- 开发原因：继续对照 `dev-ledger` 的额度口径时发现，`v0.2.2-dev.30` 快照中周额度最近一次原始 `used_percent` 为 `1%`，但当前周额度周期累计 `quotaEvidence.usedPercent` 为 `28%`；旧的套餐价值折算使用最近一次百分比作为分母，会把 `$897.86` API 等价成本放大为约 `$89786.35`，不符合周期累计口径。
- 实现方式：更新数据契约、UI Contract 和额度审计文档，明确圆环余量继续使用最近一次 `rate_limits`，但价值折算必须使用当前周期累计已用百分比；`PeriodMetric.quotaEvidence` 补充 `resetEvents / usageSegments`，`LimitWindow` 增加 `estimatedValueBasisUsedPercent`，并让 `estimatedFullValueUsd / estimatedRemainingValueUsd` 优先使用周期证据分母。
- 当前结果：额度卡可见 UI 不增加复杂字段，仍保持圆环=最近余量、右侧=当前周期累计；数据层和挂件摘要中的套餐价值折算不再混用最近一次百分比。
- 验证方式：执行 `npm run typecheck` 与 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev31.png` 与 `local_dev_work/overview-1080x720-dev31.png`；读取运行态 `snapshot.json` 聚合摘要，确认周额度 `usedPercent=1%` 继续用于圆环、`estimatedValueBasisUsedPercent=28%` 用于价值折算，`estimatedFullValueUsd` 从错误量级收敛到约 `$3310.09`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.30 fix: 微调顶部四卡内部视觉权重

- 开发原因：`v0.2.2-dev.29` 已确认顶部四卡高度不应继续整体拉高，下一步应进入卡片内部标注；当前图标、标题和主数字视觉权重仍可更接近设计稿。
- 实现方式：更新视觉比例测量、UI Contract、组件映射和分区审计，明确本轮只做四卡内部视觉权重微调；将指标图标块从 `42px` 调到 `44px`，SVG 从 `24px` 调到 `25px`，标题权重提升到 `700`，主数字字号从 `30px` 提升到 `31px`。
- 当前结果：顶部四卡内部视觉锚点更强，仍不改变四卡字段、单位、状态标签、时间视角或任何统计口径。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev30.png` 与 `local_dev_work/overview-1080x720-dev30.png`，确认顶部四卡内部微调未引入换行或页面级溢出；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.29 docs: 复测顶部四卡精修效果

- 开发原因：`v0.2.2-dev.28` 已实现顶部四卡舒展度修正，但视觉比例测量文档仍以 `dev25` 为主要当前实现基线，需要补齐 `dev28` 截图后的实际比例复测，避免后续继续盲目拉高四卡。
- 实现方式：更新 `docs/design-review/overview-visual-measurement-v0.1.md`，补充 `dev28` 的区块比例复测；同步更新分区审计和目标完成度审计，明确顶部四卡已从约 `14.6%` 提升到约 `15.3%`，下一步若继续精修应进入卡片内部标注而不是继续增高区块；提升开发版本号。
- 当前结果：总览页视觉测量闭环更完整，后续精修边界更清晰；本轮不修改运行代码。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.28 fix: 增加顶部四卡舒展度

- 开发原因：根据 `v0.2.2-dev.27` 的视觉比例测量，当前顶部四卡高度约 `14.6%`，低于设计稿约 `16.0%`，状态标签与主数字区域的间隔仍偏紧，需要做局部精修。
- 实现方式：先更新 UI Contract、分区审计、比例测量和组件映射，明确本轮只调整 `MetricCard` 自身，不全局拉大间距；随后将指标卡改为内容区与底部状态区两行布局，增加最小高度、内部行距和状态标签底部对齐。
- 当前结果：顶部四卡更接近设计稿的舒展比例，状态标签与主数字 / 变化说明之间留白更明确；四卡字段、数据口径、图标体系和额度真实数据逻辑均未改变。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev28.png` 与 `local_dev_work/overview-1080x720-dev28.png`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.27 docs: 增加总览页视觉比例测量

- 开发原因：继续推进“按区块对照设计稿”的目标，上一轮完成度审计仍偏结论化，缺少设计稿和当前截图之间的可量化比例依据，后续容易再次回到主观判断。
- 实现方式：新增 `docs/design-review/overview-visual-measurement-v0.1.md`，记录设计稿、`1360 x 900` 和 `1080 x 720` 实现截图的尺寸、主要区块比例、当前达标项和后续可精修项；同步在分区审计和目标完成度审计中引用该测量入口；提升开发版本号。
- 当前结果：总览页从“分区审计”进一步补齐为“分区审计 + 比例测量”，明确当前左侧边栏、顶部工具栏、额度卡和小窗口完整性接近设计稿，后续若继续精修应优先处理顶部四卡高度和内部留白。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.26 docs: 增加总览页目标完成度审计

- 开发原因：继续推进总览页设计稿落地目标，需要按原始目标逐项核对当前证据，避免只凭“已做很多轮修改”判断完成；同时分区审计和数据契约的版本标头仍停留在旧实现，容易误导后续接手。
- 实现方式：新增 `docs/goal-audit/overview-goal-completion-audit-v0.1.md`，按分区设计对照、文档先行流程、图标资产、真实额度数据、`dev-ledger` 参考和可交付状态逐项列出证据；同步更新分区审计实现基准、数据契约版本和审计入口；提升开发版本号。
- 当前结果：总览页当前状态被明确记录为“达到文档化产品设计目标，可进入用户图审确认；不声明像素级完全一致”。本轮不修改运行逻辑。
- 验证方式：执行 `npm run build`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.25 fix: 收敛总览页品牌对齐、额度卡行高和色阶

- 开发原因：继续根据总览页设计稿和用户反馈修正细节，当前左侧品牌图标与标题仍有轻微错位，额度卡周期范围单独占行导致高度偏大，时间视角需要更强单行约束，整体文字色阶与设计稿仍有差距。
- 实现方式：先更新 UI Contract、组件映射和分区审计，明确品牌文字基线补偿、额度周期与重置时间合并展示、顶部时间视角桌面单行和颜色 token 层级；随后调整 `BrandMark` 所在品牌组样式、`QuotaWindowCard` 周期文案结构、顶部工具栏 nowrap 约束、设计 token、卡片阴影、文字色阶和顶部四卡数字字体。
- 当前结果：总览页在不改变真实额度、Token、项目概览和定价口径的前提下，左侧品牌组更接近设计稿，额度卡不再因周期范围额外多占一行，时间视角在桌面宽度保持单行，正文 / 辅助 / 弱辅助文字层级更清晰。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev25.png` 与 `local_dev_work/overview-1080x720-dev25.png`；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.24 docs: 增加总览页 Token 与额度数据审计

- 开发原因：继续复核总览页真实额度数据时，发现顶部自然日 Token 与当前 5H 额度窗口 Token 差距较大，需要确认是否存在“今日首个 `total_token_usage` 累计快照被误计为今日增量”的风险。
- 实现方式：新增 `docs/data-audit/overview-token-quota-audit-v0.1.md`，只读取 `token_count` 数值字段和时间戳进行聚合审计，不输出原始会话正文、用户输入、模型回复或路径明细；对比错误的窗口内差值方法和当前完整 session 连续差值方法；同步更新数据契约和分区审计入口。
- 当前结果：审计确认当前实现没有把今日首个 `total_token_usage` 累计快照直接计为自然日增量；自然日 Token 与 5H Token 的差异主要来自自然时间周期和当前额度周期不同，本轮不修改运行代码。
- 验证方式：执行只读 Node 聚合审计脚本；执行 `npm run build` 验证文档与版本号更新后工程仍可构建；执行 `git diff --check` 检查空白问题。

## [2026-06-04] v0.2.2-dev.23 fix: 展示额度周期起止时间

- 开发原因：继续复核真实额度数据时，发现顶部自然日 Token 与当前 5H 额度窗口 Token 差距较大；代码已按 `total_token_usage` 差值计算增量，差异主要来自自然日统计与当前额度窗口起止不同。如果总览页不展示额度周期范围，用户容易误判为额度数据错误。
- 实现方式：更新 UI Contract、数据契约、组件映射和分区审计，明确额度卡圆环下方展示当前额度周期起止；`QuotaWindowCard` 使用 `period.startAt / period.endAt` 渲染 `周期 HH:mm - HH:mm`，不改变 token 增量、额度余量、重置识别和周期聚合逻辑。
- 当前结果：5H / 周额度卡在重置时间下方展示当前周期范围，能够解释右侧周期累计 Token 与顶部自然时间累计 Token 的口径差异；底部注记仍保持短句化。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev23.png` 与 `local_dev_work/overview-1080x720-dev23.png`；读取运行态 `snapshot.json` 确认 `fiveHour.startAt/endAt` 与 `weekLimit.startAt/endAt` 已用于界面展示。

## [2026-06-04] v0.2.2-dev.22 fix: 调整项目概览标题区层级

- 开发原因：继续按设计稿分区对照总览页，发现底部项目概览区的 `日 / 周 / 月` 二级周期切换被放在右上角并与排序按钮堆叠；设计稿中周期切换应紧跟 `项目概览` 标题，排序按钮才位于右侧操作区。
- 实现方式：更新 UI Contract、组件映射和分区审计，明确项目概览标题组为 `项目概览 + 二级周期切换`，排序切换独立靠右；调整 `OverviewPage` 结构，将周期 `TextTabs` 移入标题组，将排序 `TextTabs` 保留在右侧；补充标题组和右侧工具区样式。
- 当前结果：项目概览区层级更接近设计稿，左侧显示 `项目概览 日/周/月`，右侧只显示排序按钮；不改变项目表数据口径、排序逻辑和滚动容器。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev22.png` 与 `local_dev_work/overview-1080x720-dev22.png`，确认项目概览标题区在两种窗口下均稳定显示且页面无溢出。

## [2026-06-04] v0.2.2-dev.21 fix: 收敛左侧导航图标体系

- 开发原因：继续按设计稿分区对照总览页，`v0.2.2-dev.20` 的左侧导航仍存在图标语义和视觉容器差异：总览使用网格图标，代码仓库使用立方体图标，且导航图标额外套了白色胶囊，和设计稿的简洁左栏不一致。
- 实现方式：更新 UI Contract、组件映射和分区审计，明确左侧导航固定使用 `首页 / 文档账本 / 代码方块 / 齿轮` 四类本项目自定义内联 SVG；将 `overview` 改为首页图标，`ledger` 改为账本文档图标，`repo` 改为代码方块图标；移除导航图标自身的白色胶囊背景，保留整行浅蓝底作为当前页激活态。
- 当前结果：左侧导航图标语义更贴近设计稿，当前页激活态更轻，仍不使用官方或第三方品牌图标；总览页其他数据口径和额度逻辑未改变。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev21.png` 与 `local_dev_work/overview-1080x720-dev21.png`，确认左侧导航图标、设置入口和整体页面在两种窗口下均稳定显示。

## [2026-06-04] v0.2.2-dev.20 fix: 修正额度圆环口径并补充项目图标

- 开发原因：继续按设计稿分区审计总览页，发现额度卡中心显示 `剩余量`，但圆环弧线仍使用已用百分比，导致 `99% / 100% 剩余` 时视觉上只显示极小一段进度；同时项目概览缺少设计稿中的项目小图标，扫读性不足。
- 实现方式：更新 UI Contract、组件映射、数据契约和分区审计，明确额度圆环中心和弧线都表达最近余量；将 `QuotaWindowCard` 的圆环进度改为 `remainingPercent`，并为 5H / 周额度分别使用蓝色 / 绿色强调；将 Token 图标改为数据栈形态，代码指标图标改为绿色强调；项目列新增按项目名稳定映射颜色的自定义小图标。
- 当前结果：额度圆环不再与中心剩余百分比反向表达；周额度窗口与设计稿一样使用绿色区分；项目概览表具备项目图标和项目名组合，且仍保留全部本地项目。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev20.png` 与 `local_dev_work/overview-1080x720-dev20.png`；读取运行态 `snapshot.json` 摘要确认 `fiveHourRemaining=100 / fiveHourUsed=0`、`weekRemaining=99 / weekUsed=1`、`repoCount=5`、`dayRows=5`、`fiveHourRows=5`。

## [2026-06-04] v0.2.2-dev.19 fix: 收敛总览页视觉细节并保留全部项目

- 开发原因：继续按设计稿和用户反馈复核总览页，发现左侧品牌区图标与标题视觉间距仍不够贴近设计稿，额度卡底部证据文案比契约多写 `额度观测`，时间视角需要强制保持单行，项目表表头和文字层级也仍有细节偏差；同时 `v0.2.2-dev.18` 项目概览只显示当前有活动项目，不符合可滚动查看所有项目的口径。
- 实现方式：更新 UI Contract、组件映射、数据契约和分区审计，补充组件级配色、品牌对齐、单行时间切换、额度卡底部单行证据和项目概览保留全部项目规则；移除 `buildProjectOverviewPeriod` 对无活动项目的过滤；调整品牌区间距和字号、浅色 token、卡片阴影、顶部时间切换 nowrap、额度证据文案、项目表表头大小写和表格文字层级。
- 当前结果：总览页品牌组更接近设计稿，`时间视角 / 自然时间 / 计费时间` 保持单行，额度卡底部显示 `观测 N 次 · 重置 N 次` 且未额外占高，项目表头恢复 `Token` 等正常大小写；自然日和 5H 项目概览均保留全部 5 个本地项目，无活动项目显示 0 / `--`。
- 验证方式：执行 `npm run build`；生成并人工查看 `local_dev_work/overview-1360x900-dev19-ui.png` 与 `local_dev_work/overview-1080x720-dev19-ui.png`；读取运行态 `snapshot.json` 聚合摘要确认 `repoCount=5`、`dayRows=5`、`fiveHourRows=5`。

## [2026-06-04] v0.2.2-dev.18 fix: 收敛额度卡底部说明文案

- 开发原因：`v0.2.2-dev.17` 已将额度观测次数和重置次数展示到总览页，但额度卡底部口径说明仍直接暴露 `rate_limits` 字段名，偏技术化且与设计稿中短句注记风格不一致。
- 实现方式：更新 UI Contract、数据契约、组件映射和分区审计文档，明确总览页额度注记只使用短句，不展开原始字段名和计算公式；将 5H / 周额度卡底部说明分别收敛为 `圆环=最近余量；右侧=当前 5H 周期累计。` 与 `圆环=最近余量；右侧=当前周额度周期累计。`，保留 `额度观测 N 次 · 重置 N 次` 证据展示。
- 当前结果：额度卡底部说明更适合总览页快速阅读，同时仍保留真实额度数据的观测依据；额度计算、圆环余量和右侧周期累计口径均未改变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev18.png` 与 `local_dev_work/overview-1080x720-dev18.png`，确认短句注记和观测证据均可见且页面无溢出。

## [2026-06-04] v0.2.2-dev.17 fix: 展示额度周期观测证据

- 开发原因：继续复核额度卡真实数据口径时，确认本项目已经参考 `dev-ledger` 实现了 `rate_limits` 周期边界、重置识别和累计高水位逻辑，但前端额度卡没有展示观测点和重置次数，用户难以判断额度数据为什么可信。
- 实现方式：扩展 `PeriodMetric`，新增 `quotaEvidence` 字段，透出当前额度周期的 `usedPercent / remainingPercent / maxObservedUsedPercent / lastObservedAt / resetCount / observations`；`buildQuotaCyclePeriodMetric` 将已有 `QuotaCycleMetric` 证据写入共享快照；`QuotaWindowCard` 底部注记新增 `额度观测 N 次 · 重置 N 次`；同步更新数据契约、UI Contract、组件映射和分区审计文档。
- 当前结果：5H 与周额度卡继续使用最近 `rate_limits` 余量作为圆环中心，右侧继续使用当前额度周期累计 Token、成本、代码和会话；底部新增观测次数与重置次数，增强额度数据可信度解释。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev17.png` 与 `local_dev_work/overview-1080x720-dev17.png`，确认新增证据不造成溢出；读取运行态 `snapshot.json` 确认 `fiveHour/weekLimit.quotaEvidence` 已写入观测次数和重置次数。

## [2026-06-04] v0.2.2-dev.16 fix: 收敛左侧品牌标识尺寸与形态

- 开发原因：继续按设计稿分区对照总览页，`v0.2.2-dev.15` 的左侧品牌图标仍带圆角容器和较多内部留白，视觉尺寸明显小于设计稿中的蓝色几何标识，导致品牌区和设计稿仍有差距。
- 实现方式：更新分区审计、UI Contract 和组件映射，明确品牌图标必须是本项目非官方自定义资产，不使用 OpenAI / Codex 官方 logo；将 `BrandMark` 改为更大的蓝色几何 C 形内联 SVG；调整品牌区图标占位从 `52px` 到 `64px`，移除图标外层圆角容器视觉。
- 当前结果：左侧品牌区的图标尺寸、标题起点和整体视觉重心更接近设计稿；导航项、设置入口、挂件隐藏策略和额度真实数据逻辑均未改变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev16.png` 与 `local_dev_work/overview-1080x720-dev16.png`，确认品牌区未错位且两种视口均完整显示。

## [2026-06-04] v0.2.2-dev.15 fix: 增加总览页尺寸标注并修正项目区标题

- 开发原因：继续推进总览页与 `v0.3.3` 设计稿的分区对照，`v0.2.2-dev.14` 已解决壳层和顶部工具栏问题，但仍缺少区块尺寸标注基线；同时项目区主标题仍使用“当前周期内的项目消耗与工程活动”，不符合用户确认的“直接项目概览”和设计稿标题。
- 实现方式：在分区审计文档中新增 `dev.15` 尺寸标注基线，按左侧导航、顶部工具栏、顶部四卡、额度卡、项目概览和页脚记录设计稿与实现截图的比例差异；更新 UI Contract 与组件映射，明确项目区主标题只使用 `项目概览`，顶部四卡不得过度压缩；渲染层移除项目区“项目消耗”主标题，样式层轻微增加顶部四卡最小高度和区块间距；同步更新版本号。
- 当前结果：总览页项目区标题与设计稿和用户口径一致；顶部四卡留白更接近设计稿；尺寸对照从主观截图观察升级为可继续迭代的区块比例记录。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev15.png` 与 `local_dev_work/overview-1080x720-dev15.png`，确认两种视口均完整显示且没有页面级溢出。
- 遗留问题：额度卡高度受真实模型名、Token 数量和本地数据状态影响，当前不通过假数据或硬压内容凑齐设计稿；若继续精修，应基于真实数据样本继续标注额度卡内部行高和模型条布局。

## [2026-06-04] v0.2.2-dev.14 fix: 收敛总览页壳层结构与卡片视觉

- 开发原因：继续对照 `v0.3.3` 总览页设计稿，发现 `v0.2.2-dev.13` 仍存在顶部工具栏层级过高、额外 `桌面总控台` 眉标、右侧工作区外层浮层感过强、卡片渐变和阴影偏重等结构性差异。
- 实现方式：更新总览页分区审计、UI Contract 和组件映射，明确顶部标题与副标题横向组合、禁止额外眉标、右侧主工作区外层不做强浮层；渲染层移除顶部眉标；样式层去掉应用外边距和左右间隔，弱化主工作区、顶部四卡、额度卡和项目概览的渐变、圆角与阴影；同步调整设计 token 与版本号。
- 当前结果：总览页顶部工具栏高度更接近设计稿，右侧内容区更像白底工作区而不是独立大卡片，顶部四卡和中部额度卡的底色、描边和阴影更贴近确认设计图；真实额度周期数据逻辑保持不变。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev14.png` 与 `local_dev_work/overview-1080x720-dev14.png`，确认两种视口均完整显示且没有页面级溢出。
- 遗留问题：当前真实数据只命中一个项目时，项目概览表比设计稿更空，这是数据状态差异；若继续追求像素级一致，需要进入区块尺寸标注阶段。

## [2026-06-04] v0.2.2-dev.13 fix: 精修总览页区块布局与数据来源展示

- 开发原因：继续按设计稿分区对照总览页，发现顶部四张指标卡仍偏离设计图的左图标、右内容、底部状态结构；额度卡数据行缺少对应小图标；页脚缺少清晰的数据来源与扫描范围提示，影响后续从设计图稳定过渡到产品实现。
- 实现方式：更新总览页 UI Contract、组件映射和分区审计文档，明确顶部指标卡不得重复周期标签，统一为大图标左置、标题数值右置、状态标签底置；为额度卡右侧 `Token / 成本 / 代码 / 会话` 四项补充小图标；补充页脚数据来源文案和 `session / archived / 仓库` 扫描计数胶囊；同步调整渲染组件、样式 token 使用和版本号。
- 当前结果：总览页顶部四卡、额度卡和页脚更接近确认设计图的区块结构；页面继续保持挂件隐藏、额度周期真实数据和小视口不溢出的既有结果。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；生成并人工查看 `local_dev_work/overview-1360x900-dev13.png` 与 `local_dev_work/overview-1080x720-dev13.png`，确认标准视口与较小视口均未出现页面级溢出。

## [2026-06-04] v0.2.2-dev.12 fix: 分区对照总览页并接入额度周期真实数据

- 开发原因：用户指出总览页与设计稿仍有较多细节差距，要求按页面区块逐块对照设计图，必要时补充图标资产，并修正额度卡中明显不正确的数据口径；额度真实数据参考 `dev-ledger` 项目的 Codex 采集逻辑。
- 实现方式：新增 `docs/design-review/overview-block-audit-v0.1.md`，按左侧导航、顶部工具栏、顶部四卡、额度卡和项目概览拆分设计对照；更新 UI Contract、组件映射、数据契约和设计到实现流程，明确分区审计、指标图标和额度周期口径；渲染层为顶部四卡补充自定义 SVG 指标图标，为额度卡标题补充小图标；数据层将 Codex token 增量改为优先使用同一 session 内 `total_token_usage` 累计快照差值，并保留无 token 增量的 `rate_limits` 观测点；仪表盘聚合层按 `rate_limits.resets_at + window_minutes` 构建当前 5H / 周额度周期，额度卡圆环使用最近剩余百分比，右侧 Token、成本、会话和模型占比使用当前额度周期真实增量。
- 当前结果：总览页对照方式从整页主观观察升级为分区审计；顶部四卡更接近设计稿的信息层级；额度卡不再把普通时间窗口估算误当成额度周期数据；本地快照中 `windowPeriods.fiveHour/weekLimit` 已输出真实周期边界、Token、成本、模型占比和最新剩余百分比。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用真实 Electron 截图钩子生成 `1360 x 900` 与 `1080 x 720` 截图并人工对照；读取本地 `snapshot.json` 摘要核对 5H / 周额度周期 start/end、Token、成本、剩余百分比和 Top 模型输出。

## [2026-06-04] v0.2.2-dev.11 fix: 精修总览页品牌区标题与配色细节

- 开发原因：用户反馈总览页已经接近设计，但左侧品牌区图标和标题错位，额度卡重复显示 `额度窗口` 占用一行，顶部 `时间视角` 不应拆成两行，且配色细节仍需按设计图沉淀为文档后再实现。
- 实现方式：更新 `docs/ui-contract/overview-v0.1.md`，新增总览页视觉细节约束，明确颜色、文字、阴影、品牌区、顶部时间切换和额度卡标题规则；调整 `src/renderer/design-tokens.ts` 的浅蓝白背景、主文字、辅助文字、主蓝、青色、边线和阴影 token；将左侧品牌区改为图标与 `Codex Companion` 顶线对齐，说明文字放在标题下方；移除 `QuotaWindowCard` 中重复的 `额度窗口` 辅助行；将顶部 `时间视角 / 自然时间 / 计费时间` 改为单行 flex 展示；同步更新组件映射与版本号。
- 当前结果：品牌区更接近设计图结构，额度卡标题不再多占一行，时间视角切换在同一行内，整体配色更接近设计图的深墨文字、白色卡片、浅蓝描边和轻阴影风格。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用真实 Electron 截图钩子生成 `1360 x 900` 与 `1080 x 720` 截图并人工对照，两个视口均完整显示且本轮细节点已生效。

## [2026-06-03] v0.2.2-dev.10 fix: 建立真实截图验收并修正总览页溢出

- 开发原因：用户指出挂件应继续隐藏、当前配色和设计稿仍有偏差，且总览页即使全屏也存在内容超出屏幕的问题；同时要求完善页面完善流程，让后续页面能一次性按设计落地。
- 实现方式：保留挂件禁用策略，并在主进程增加仅由环境变量触发的真实 Electron 窗口截图钩子；修正 Vite 生产构建资源路径为相对路径，避免截图和生产启动时出现空白页；将总览页样式按确认设计稿收敛为蓝白浅色、紧凑侧栏和顶部工具栏、三段式视口布局；压缩顶部四卡、中部额度卡和项目表密度；额度卡右侧保留 `Token 用量 / API 等价成本 / 代码行数 / 会话数` 四项核心数据，状态统一放到右上角徽标；项目概览改为占用剩余视口并只在表格内部滚动；同步更新 UI Contract、组件映射和设计到实现工作流，明确 `1360 x 900` 与 `1080 x 720` 真实截图不通过不得提交。
- 当前结果：挂件仍不会创建或显示；总览页在标准窗口和最小窗口下完整显示左侧导航、顶部工具栏、顶部四卡、两张额度卡、项目概览和页脚；配色和卡片密度更接近已确认设计图；后续页面已有可执行的截图验收门禁。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；使用 `CODEX_COMPANION_CAPTURE_PATH`、`CODEX_COMPANION_WINDOW_WIDTH`、`CODEX_COMPANION_WINDOW_HEIGHT` 生成 `1360 x 900` 与 `1080 x 720` 真实 Electron 截图并人工查看，两种视口均未出现页面级溢出。

## [2026-06-03] v0.2.2-dev.9 fix: 优化首屏加载与总览页缩放口径

- 开发原因：用户反馈每次启动都需要等待较久才加载数据，且总览页显示不全不应依赖滚轮解决；同时指出额度剩余百分比可能不对，需要认真核对数据来源。
- 实现方式：新增 `pending` 快照状态，`DashboardService.getSnapshot(false)` 优先返回内存缓存、磁盘缓存或轻量采集中快照，真实 Codex / Git 采集转为后台刷新；主进程启动阶段不再 `await loadSnapshot(true)` 阻塞启动；渲染层首屏完成后静默调用 `refreshDashboard()` 替换为 live 快照；为采集过程增加并发保护，避免重复扫描本机 Codex session 与 Git 仓库；额度解析兼容 `used_percent / usedPercent`、`window_minutes / windowDurationMins`、`resets_at / resetsAt`，并按 `剩余百分比 = 100 - used_percent` 展示；总览页应用壳层改为基于桌面基准尺寸的内部缩放，收紧项目表、额度环和模型条比例；同步更新 `overview` UI Contract 与设计交付流程中的加载、缩放和视口约束。
- 当前结果：首屏不再必须等待完整采集才能显示；后台刷新会在 live 数据准备好后替换快照；额度剩余百分比口径回到原始字段语义；总览页在标准桌面窗口下按比例缩放，而不是依赖整体页面滚动。
- 验证方式：执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；用只输出字段摘要的本地脚本检查最新 rate_limits 字段位置与数值，不输出会话正文。
- 遗留问题：本轮尝试截图时系统前台被其他全屏窗口占用，截图未能捕获 Codex Companion 窗口，因此视觉对齐仍缺少可信截图基线；下一步应优先接入自动窗口截图或 Playwright/Electron 截图验证。

## [2026-06-03] v0.2.2-dev.8 fix: 收敛总览页尺寸与配色并暂时隐藏挂件

- 开发原因：用户指出挂件当前应先隐藏，且总览页配色、整体尺寸和区块间距与确认设计图不符，页面在全屏下仍出现超出屏幕范围的问题；同时要求把页面完善流程补强，减少后续返工。
- 实现方式：在 `src/main/index.ts` 中新增挂件禁用开关，停止创建挂件窗口、隐藏托盘中的挂件入口，并将显示/隐藏挂件 IPC 降级为无操作；同步下调主窗口默认尺寸与最小尺寸；在 `src/renderer/design-tokens.ts`、`src/renderer/styles.css` 和 `src/renderer/App.tsx` 中将配色切回设计图确认过的蓝白系，统一应用图标样式，压缩应用壳层、卡片和额度模块的留白，并引入 `page-viewport` 让滚动只发生在内容区内部；更新 `docs/design-to-product-workflow-v0.1.md` 与 `docs/ui-contract/overview-v0.1.md`，新增设计对照、标准视口和全屏校验规则。
- 当前结果：挂件已从当前产品流中临时隐藏；总览页的配色、图标和密度更接近确认图，主页面改为内容区内部滚动，避免整体壳层被撑出屏幕；后续页面落地必须经过设计对照与视口校验。
- 验证方式：已检查当前仓库状态并同步远端；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；执行 `git diff --check` 检查空白问题。
- 遗留问题：当前环境仍缺少页面级自动截图基线，本轮已把这项检查写进流程，但具体截图用例仍待补充。

## [2026-06-03] v0.2.2-dev.7 feat: 完成总览页首版落地与统一壳层重构

- 开发原因：在总览页设计图、规格文档和 `ui-contract` 确认后，用户要求开始第一个页面的实际落地，并达到可直接测试的水准。
- 实现方式：扩展 `DashboardSnapshot.overview` 数据契约，补充自然时间与额度窗口的对比口径、模型窗口和项目概览聚合；为 Git 采集新增 `fiveHour / weekLimit` 自定义活动窗口；新增 `src/renderer/design-tokens.ts` 统一页面 token；重写 `src/renderer/App.tsx` 与 `src/renderer/styles.css`，落地统一左侧导航、顶部工具栏、顶部四卡、中部 `5H / 周额度窗口`、底部项目概览表，并保留账本页、代码仓库页和挂件的可用状态；新增 `docs/component-map.md` 固化总览页组件映射。
- 当前结果：总览页已按当前确认口径完成首版实现，`自然时间 / 计费时间` 切换、顶部四卡、额度卡和项目概览均可运行；主页面不再暴露挂件按钮，左侧保留固定 `设置` 入口且默认关闭挂件策略继续生效。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `npm start` 启动 Electron 运行态验证；执行 `git diff --check` 检查空白问题。
- 遗留问题：当前环境未直接提供 Electron 视觉截图链路，因此本轮完成了构建与启动验证，但总览页页面级截图基线仍待补充。

## [2026-06-03] v0.2.2-dev.6 docs: 完善交付流程并新增总览页 UI Contract

- 开发原因：用户要求把设计交付流程完善到文档里，并开始最终确认第一个页面，避免继续停留在图片与口头解释阶段。
- 实现方式：扩充 `docs/design-to-product-workflow-v0.1.md`，补充目录约定、每页交付清单、三道确认门和当前项目建议；新增 `docs/ui-contract/overview-v0.1.md`，将总览页沉淀为可直接指导开发的最终确认稿；同步更新 `docs/page-design-spec-v0.3.md` 与 `ROADMAP.md` 的当前生效入口和推进状态。
- 当前结果：项目已有更完整的设计交付流程；总览页已进入 Gate B，也就是规格确认阶段，后续可以基于 `ui-contract` 直接进入 token、组件映射和实际开发。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.5 docs: 修正总览页规格并补充设计交付流程

- 开发原因：用户指出当前文档仍错误描述了 `自然时间 / 计费时间` 与顶部四卡的关系，并要求先把文档改正确，同时补一套能够让设计图稳定过渡到真实产品的流程方案。
- 实现方式：直接修正 `docs/page-design-spec-v0.3.md` 的当前生效范围与总览页第 2 节，明确 `自然时间 / 计费时间` 只改变统计口径，不改变顶部四卡字段；将旧设计图章节明确降为历史归档；新增 `docs/design-to-product-workflow-v0.1.md`，基于 Figma Dev Mode、Variables、Code Connect、W3C Design Tokens、Storybook 与 Playwright 的官方资料整理本项目的设计交付流程。
- 当前结果：总览页当前生效规格已与最新口径对齐；项目已有一份可直接复用的“设计图到产品实现”工作流文档，后续页面可以按同一方法进入实际开发。
- 验证方式：已检查当前仓库状态；执行 `git pull --rebase origin main` 同步远端；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.4 docs: 重出总览页自然时间与计费时间设计图

- 开发原因：用户要求恢复页级 `自然时间 / 计费时间` 视角，并进一步收敛顶部四卡、中部额度卡与底部项目表的展示方式。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，追加 `v0.3.3` 总览页覆盖规格；使用内置 `image_gen` 重出两张总览页设计图，分别对应 `自然时间` 和 `计费时间`；将图片保存到 `docs/assets/design/v0.3.3/`；文档中记录图片索引与人工观察。
- 当前结果：总览页已形成 `v0.3.3` 双状态设计稿，顶部四卡不再重复数字，中部固定为 `5H / 周额度窗口`，底部改为带滚动的 `项目概览`。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.3 docs: 根据反馈生成总览页 v0.3.2 设计图

- 开发原因：用户基于 `S1-S5` 对总览页双状态图提出反馈，要求设置放到最底部、去除快照重复、补充图标体系、时间视角去掉外框、顶部指标卡保持稳定、中部按 5H 和周期用量拆分、底部改为项目周期消耗排行。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，追加 `v0.3.2` 总览页覆盖规格；使用内置 `image_gen` 生成图标体系稿和总览页月视角稿，保存到 `docs/assets/design/v0.3.2/`；文档中记录图像索引、人工观察和图标一致性风险。
- 当前结果：总览页进入 `v0.3.2` 图像确认阶段，已具备图标体系方向稿和新版月视角总览图；日视角与周视角待月视角方向确认后再补图。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.2 docs: 生成总览页双状态设计图

- 开发原因：用户反馈文字确认效率低，建议直接出图确认；本轮按图优先方式为总览页生成可确认设计图。
- 实现方式：使用内置 `image_gen` 基于 `v0.3.1` 总览页规格生成两张状态图，分别对应 `自然时间` 和 `计费窗口`；将图片保存到 `docs/assets/design/v0.3.1/`；更新 `docs/page-design-spec-v0.3.md`，加入图片索引、当前观察和 `S1-S5` 图像确认方式。
- 当前结果：总览页已有两张可供确认的新版设计图；后续根据用户对 `S1-S5` 的反馈决定保留、重出或局部调整。
- 验证方式：已检查当前仓库状态；人工查看两张生成图；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.2-dev.1 docs: 修订应用壳层与总览页设计草案

- 开发原因：用户指出三张设计图的左侧边栏和顶部工具栏不一致，且总览页存在设置入口缺失、时间口径切换、额度余量、数据可信度和仓库活跃口径未明确的问题；本轮先完善第一个页面，不进入实际页面开发。
- 实现方式：更新 `docs/page-design-spec-v0.3.md`，补充全局应用壳层规范，固定左侧导航、顶部工具栏和设置入口；修订总览页结构，加入自然时间 / 计费窗口切换，明确额度只能展示剩余百分比、恢复时间和观测状态；将数据可信度从大面板降级为状态标签与底部说明，并建议右侧大面板改为模型用量分析；将仓库活跃拆分为 Codex 投入与 Git 产出两条口径。
- 当前结果：总览页进入 `v0.3.1` 设计讨论稿状态，旧总览页设计图需要按新规格重出；Codex 账本页和代码仓库页暂未二次修订。
- 验证方式：已检查当前仓库状态；执行 `npm run build` 验证 lint、TypeScript、渲染端打包和主进程编译；执行 `git diff --check` 检查空白问题。

## [2026-06-03] v0.2.1-dev.1 docs: 补充页面设计规格并默认关闭挂件

- 开发原因：用户反馈当前应用视觉还不够成熟，要求先暂停实际页面开发，改为先明确各页面展示内容、布局、尺寸和位置，并生成设计图供确认；同时要求桌面挂件先默认关闭。
- 实现方式：将挂件默认配置 `visible` 改为 `false`；新增 `docs/page-design-spec-v0.3.md`，规划总览页、Codex 账本页、代码仓库页的内容结构、布局尺寸、展示方式和设计图提示词；使用 imagegen 生成三张页面设计图并保存到 `docs/assets/design/v0.3/`；更新 `ROADMAP.md`，将下一阶段调整为先确认设计图再开发页面。
- 当前结果：新用户首次启动时不再默认显示挂件；页面改造进入设计确认阶段，实际页面实现暂不推进。
- 验证方式：已检查当前仓库状态；后续执行 `npm run build` 和 `git diff --check` 验证代码与文档变更。

## [2026-06-02] v0.2.0-dev.1 feat: 完成首版可运行 Codex Companion 桌面实现

- 开发原因：用户要求按照既有规划正式进入实施阶段，从空仓库落地首版桌面应用、数据采集、三页界面和桌面挂件。
- 实现方式：建立 `Electron + React + TypeScript + Vite` 项目骨架；实现主进程窗口管理、挂件预设与本地设置持久化；实现 Codex session / `rate_limits` 解析、Git 仓库扫描与代码活动聚合；实现总览页、账本页、代码仓库页、顶部挂件与极简胶囊；补充 `README`、隐私说明、路线图、贡献指南、Issue 模板和 `docs/data-contract-v0.2.md`；同步回写规划状态。
- 当前结果：仓库已具备可构建、可启动的首版桌面应用，能够基于本机 Codex 与 Git 数据展示额度、Token、成本价值和仓库归因；项目对外文档已明确非官方定位与 local-first 隐私边界。
- 验证方式：执行 `git pull --rebase origin main`、`npm run typecheck`、`npm run lint`、`npm run build` 与 `npm start` 启动验证；运行期曾发现 Electron 入口路径错误，已修正为 `dist-electron/main/index.js` 后重新确认主窗口正常拉起。

## [2026-06-02] v0.1.0-dev.1 docs: 初始化 Codex Companion 项目规划

- 开发原因：用户已创建 `gooderno1/codex-companion` 仓库，并要求在本地 `MyCode` 目录下建立项目文件夹，参考 DevLedger 的协作规范先写项目 `AGENTS.md`，第一步先撰写项目开发规划文件。
- 实现方式：克隆远端仓库到本地 `codex-companion` 目录；新增 `AGENTS.md`，将 DevLedger 的协作规范调整为 Codex 专用桌面应用语境；新增 `docs/project-development-plan-2026-06-02.md`，明确产品定位、页面规划、挂件规划、数据架构、技术路线、隐私边界和阶段实施顺序。
- 当前结果：项目已有初始协作规范、开发记录和第一版正式规划文档，尚未进入桌面应用代码实现。
- 验证方式：已执行 `git status`、`git ls-remote`、仓库克隆、初始文件检查和 `git diff --check`；本轮尚未建立构建脚本，因此未执行构建。

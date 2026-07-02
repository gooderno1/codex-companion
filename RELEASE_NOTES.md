# RELEASE NOTES

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

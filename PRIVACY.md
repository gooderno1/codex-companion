# 隐私说明

`Codex Companion` 采用 local-first 设计，不要求单独注册账号，也不上传原始 Codex session 文件。当前额度查询会复用本机 Codex 登录状态访问 Codex 官方 Usage 接口。

## 本地读取的内容

- `~/.codex/sessions` 与 `~/.codex/archived_sessions` 中的 JSONL 会话记录
- `token_count`、`turn_context.model`、`cwd`、`rate_limits` 等统计相关字段
- `~/.codex/auth.json` 中的访问令牌与账号 ID；仅在主进程内存中用于官方 Usage 请求鉴权
- 本地 Git 仓库的提交历史、增删行统计、远端地址与默认分支

## 本地存储的内容

- 应用配置：Codex 数据目录、仓库根目录、计费月起始日、挂件预设、透明度、点击穿透、隐私模式、挂件位置
- 聚合快照：最近一次成功采集得到的仪表板数据
- 刷新历史：最近若干次手动、自动或启动刷新结果，只包含触发来源、耗时、快照来源和聚合文件数量
- 增量缓存：每个 Codex JSONL 文件的路径、`size`、`mtimeMs` 与解析后的统计结果，用于避免重复解析；不保存原始 JSONL 行、用户输入正文或模型输出正文
- 通知状态：`notification-state.json` 保存提醒 key、标题、正文、类别、级别、触发时间、系统通知时间和已读时间，用于应用内提醒中心展示详情，并避免自动刷新时重复提醒
- 更新设置：`settings.json` 保存是否自动检查、是否自动下载、忽略版本和退出安装选择；不保存 GitHub token、下载请求头或安装包本机路径

默认存储位置为 Electron `userData` 目录，例如 Windows 下通常位于：

`%APPDATA%\\codex-companion`

## 不会做的事情

- 不上传原始 Codex session 文件
- 不上传仓库源码
- 不向本项目或第三方服务器上传仓库名、路径、模型明细或成本数据
- 首版不请求 GitHub token
- 应用内提醒和系统通知不展示账号、邮箱、原始 app-server 响应、原始会话正文、用户输入正文或模型输出正文

## Codex 官方用量网络边界

- 当前额度只读请求固定发往 `https://chatgpt.com/backend-api/wham/usage`，与 Codex 官方桌面端当前用量页面同源。
- 请求携带本机 Codex 访问令牌和账号 ID 进行鉴权；两者只在主进程内存中使用，不写入设置、缓存或快照，不传给 renderer，也不记录到日志。
- 请求不携带原始 session、仓库源码、仓库路径、模型明细或成本数据；响应只规范化保存额度窗口、重置时间、credits 和附加额度池等聚合字段。
- 官方请求失败时回退本地 session `rate_limits`；官方响应缺少 5H 或周窗口时保持“未观测”，不使用过期值补齐。

## 应用更新网络边界

- Windows 安装版只访问公开的 `github.com/gooderno1/codex-companion/releases` 与对应 Release 资产。
- 更新检查会产生普通 HTTPS 请求，但不会附带 GitHub token，也不会上传 Codex session、仓库名、路径、模型、额度、通知历史或本机 Git 身份。
- Release notes 在主进程转换为受限长度纯文本后才发送到 renderer，不直接渲染远端 HTML。
- 可信 Windows 代码签名启用前，生产构建只检查更新并引导手动下载，不后台执行未签名安装包。

## 数据目录配置

- 设置页中的 `Codex 数据目录` 和 `仓库根目录` 只调用本机系统目录选择器。
- 选择结果只写入 Electron `userData/settings.json`。
- Codex 数据目录用于读取本机 `sessions`、`archived_sessions`、`rate_limits` 和官方 Usage 鉴权所需的 `auth.json`。
- 仓库根目录用于扫描本机 Git 仓库、代码仓库页和 Codex 会话归因。
- 不会把 Codex 数据目录、仓库根目录、仓库名、远端地址或扫描结果上传到云端。

## 价格与价值估算

- API 等价成本基于公开 API 定价估算，不代表真实扣费
- Codex credits 估算基于公开 rate card，仅用于价值折算与趋势感知

## 用户可见边界

- 若官方 Usage 与本地 `rate_limits` 都没有对应窗口，额度卡片会显示 `未观测` 或 `待刷新`
- 若最近会话数据已过期，对应状态会显示 `数据过期`

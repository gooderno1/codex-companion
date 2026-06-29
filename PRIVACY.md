# 隐私说明

`Codex Companion` 采用 local-first 设计，首版不要求登录，不上传原始 Codex session 文件。

## 本地读取的内容

- `~/.codex/sessions` 与 `~/.codex/archived_sessions` 中的 JSONL 会话记录
- `token_count`、`turn_context.model`、`cwd`、`rate_limits` 等统计相关字段
- 本地 Git 仓库的提交历史、增删行统计、远端地址与默认分支

## 本地存储的内容

- 应用配置：仓库根目录、挂件预设、透明度、点击穿透、隐私模式、挂件位置
- 聚合快照：最近一次成功采集得到的仪表板数据
- 增量缓存：每个 Codex JSONL 文件的路径、`size`、`mtimeMs` 与解析后的统计结果，用于避免重复解析；不保存原始 JSONL 行、用户输入正文或模型输出正文

默认存储位置为 Electron `userData` 目录，例如 Windows 下通常位于：

`%APPDATA%\\codex-companion`

## 不会做的事情

- 不上传原始 Codex session 文件
- 不上传仓库源码
- 不上传仓库名、路径、模型明细或成本数据到云端
- 首版不请求 GitHub token

## 价格与价值估算

- API 等价成本基于公开 API 定价估算，不代表真实扣费
- Codex credits 估算基于公开 rate card，仅用于价值折算与趋势感知

## 用户可见边界

- 若本地 `rate_limits` 缺失，对应额度卡片会显示 `未观测` 或 `待刷新`
- 若最近会话数据已过期，对应状态会显示 `数据过期`

# Codex Companion 数据契约（v0.2）

- 文档创建时间：2026-06-02
- 对应开发版本：`v0.2.0-dev.1`
- 适用范围：桌面主界面、桌面挂件、本地快照存储

## 1. 原始数据来源

### 1.1 Codex

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/archived_sessions/*.jsonl`
- 重点字段：
  - `session_meta.id`
  - `session_meta.cwd`
  - `turn_context.model`
  - `event_msg.payload.info.last_token_usage`
  - `event_msg.payload.rate_limits`

### 1.2 Git

- 会话 `cwd` 向上查找 `.git`
- 配置的本地仓库根目录递归扫描
- 重点命令：
  - `git rev-list --count --since=... HEAD`
  - `git log --numstat --format=tformat:`
  - `git diff --numstat HEAD`
  - `git remote get-url origin`
  - `git branch --show-current`

## 2. 聚合口径

### 2.1 Token

- 单次增量以 `last_token_usage` 为准
- 会话总量为会话内所有 `last_token_usage` 累加
- 自然日、近 7 日、自然周、自然月均按事件时间戳落桶

### 2.2 额度

- `5 小时额度` 使用 `rate_limits.primary`
- `周额度` 使用 `rate_limits.secondary`
- `可观测月额度` 仅在本地快照存在月级字段时展示；当前版本若无字段则明确标记 `未观测`

### 2.3 成本与价值

- API 等价成本使用公开 API 定价按模型估算
- 周套餐价值折算公式：
  - `当前周 API 等价成本 / 当前周已用百分比`
- 剩余价值空间公式：
  - `折算总价值 - 当前周 API 等价成本`

### 2.4 仓库归因

- 通过会话 `cwd` 向上找到 Git 根目录
- 若无法找到 Git 根目录，则该会话保留 `未归因`

## 3. 状态字段

- `已观测`：最近窗口内有有效 `rate_limits` 和 token 事件
- `待刷新`：发现会话文件，但最近窗口未命中有效额度样本
- `未观测`：根本没有相关额度字段或没有可解析会话
- `数据过期`：最新观测时间距离当前超过 45 分钟

## 4. 首版边界

- 不上传原始 session
- 不读取 GitHub 远端 API
- 不把未定价模型强行折算为虚构成本；未知模型当前记为 0 成本并等待后续补表

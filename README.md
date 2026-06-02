# Codex Companion

`Codex Companion`（中文名：`Codex 伴侣`）是一个面向 Codex 重度用户的非官方开源桌面伴侣，用于在本机查看 Codex 额度、Token、API 等价成本和本地 Git 代码活动。

> 本项目是非官方工具，不隶属于 OpenAI，也不代表 OpenAI 或 Codex 官方产品。

## 当前能力

- 读取本机 `~/.codex/sessions` 与 `~/.codex/archived_sessions`。
- 解析 `token_count`、`turn_context.model`、`rate_limits` 等字段。
- 展示今日、近 7 日、自然周、自然月的 Token、会话数、API 等价成本和代码改动。
- 展示 5 小时额度窗口、周额度窗口和可观测月额度状态。
- 按模型聚合自然月 Token 与 API 等价成本。
- 按 Git 仓库归因 Codex 会话，并展示仓库提交、增删行与近期提交。
- 提供桌面挂件，支持顶部信号条与极简胶囊两种预设。

## 技术栈

- Electron
- React + TypeScript + Vite
- 本地 JSON 快照存储
- 本机 Git 命令与 Codex session JSONL 解析

## 快速开始

```bash
npm install
npm run dev
```

生产构建与本地启动：

```bash
npm run build
npm start
```

Windows 打包：

```bash
npm run package:win
```

## 数据来源

- Codex 本地会话：`%USERPROFILE%\\.codex\\sessions` 与 `archived_sessions`
- Codex 额度快照：JSONL 中的 `rate_limits`
- Git 仓库：会话 `cwd` 反推仓库根目录，以及配置的本地仓库根目录

## 开发说明

- 协作规范见 [AGENTS.md](./AGENTS.md)
- 当前规划见 [docs/project-development-plan-2026-06-02.md](./docs/project-development-plan-2026-06-02.md)
- 数据契约见 [docs/data-contract-v0.2.md](./docs/data-contract-v0.2.md)
- 隐私边界见 [PRIVACY.md](./PRIVACY.md)
- 版本进展见 [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)

## 已知边界

- 可观测月额度依赖 Codex 本地快照是否暴露月级别字段；当前若无字段则明确标记为未观测。
- Git 代码活动首版基于本地 Git 历史和当前工作区 diff，不读取 GitHub 远端元数据。
- API 等价成本与 Codex credits 估算依赖当前公开定价表，后续如官方价格调整需同步更新。

# 贡献指南

## 基本要求

- 全程使用中文沟通、提交说明和用户可见文案
- 先读 [AGENTS.md](./AGENTS.md) 与规划文档，再开始修改
- 只处理当前任务相关文件，不混入无关生成物

## 本地开发

```bash
npm install
npm run dev
```

提交前至少执行：

```bash
npm run build
git diff --check
```

## 提交规范

提交信息格式：

`vX.Y.Z-dev.N type(scope): description`

示例：

`v0.2.0-dev.1 feat(shell): 完成首版桌面壳与数据采集`

## 文档同步

- 涉及数据口径变化时，必须同步更新 `docs/` 下对应说明
- 每次有效修改都要更新 `DEVELOPMENT_LOG.md`
- 正式发布时更新 `RELEASE_NOTES.md`

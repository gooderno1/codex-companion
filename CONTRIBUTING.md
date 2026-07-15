# 贡献指南

感谢关注 `Codex Companion`。本项目是非官方 Codex 本机桌面伴侣，贡献时请优先保证数据口径、隐私边界和用户可见体验清晰可靠。涉及发布或 Windows 签名时还必须遵守 [Code signing policy](./CODE_SIGNING_POLICY.md)。

## 基本要求

- 全程使用中文沟通、提交说明和用户可见文案；英文 issue / PR 可以接受，但产品文案仍以中文优先。
- 先读 [AGENTS.md](./AGENTS.md)、[README.md](./README.md)、[PRIVACY.md](./PRIVACY.md) 和相关规划文档，再开始修改。
- 只处理当前任务相关文件，不混入无关生成物、临时文件或历史脏文件。
- 不扩展多 provider 路线；本项目首版只聚焦 Codex。
- 不使用 OpenAI、Codex 官方 logo 或容易造成官方背书误解的视觉资产。

## 本地开发

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
```

Windows 打包：

```bash
npm run package:win
```

提交前至少执行：

```bash
npm run build
npm run verify:updater
npm run verify:signing-policy
git diff --check
```

## 提交规范

提交信息格式：

`vX.Y.Z-dev.N type(scope): description`

示例：

`v0.3.0-dev.10 feat(settings): 支持配置仓库根目录`

常用类型：

- `feat`：新增能力
- `fix`：缺陷修复
- `docs`：文档更新
- `refactor`：不改变行为的结构调整
- `chore`：工程配置或维护
- `test`：测试补充

## 文档同步

- 涉及数据口径变化时，必须同步更新 `docs/` 下对应说明。
- 涉及页面结构、用户可见字段或交互变化时，必须同步更新 README、组件映射、UI Contract 或相关规划。
- 每次有效修改都要更新 `DEVELOPMENT_LOG.md`，并保持最新记录在最上方。
- 正式发布时更新 `RELEASE_NOTES.md`，写清包含的开发版本、主要变更、验证结果和升级注意事项。

## 隐私要求

提交 issue、PR、截图或日志时，请不要上传：

- 原始 Codex session JSONL 文件
- 仓库源码快照
- 访问令牌、cookie、密钥或账号信息
- 未脱敏的用户名、绝对敏感路径、私有仓库名或远端地址
- 用户输入正文或模型输出正文

如果需要说明问题，请优先提供脱敏后的字段名、时间范围、状态截图或聚合统计。

## PR 检查

PR 至少应说明：

- 变更内容
- 验证方式
- 是否涉及数据口径、隐私边界或用户可见文案
- 是否需要更新 Release notes 或 Roadmap

CI 会执行 `npm ci`、`npm run build` 和 `git diff --check`。如果 CI 失败，请先修复后再请求 review。

涉及应用更新时，还必须执行 `npm run verify:updater`；修改正式发布 workflow 时需确认安装包、`latest.yml`、blockmap 和 SHA256 文件同时生成，且 tag 与 `package.json` 稳定版本完全一致。

## 代码签名敏感文件

- `.github/workflows/`、`package.json`、`package-lock.json`、`CODE_SIGNING_POLICY.md`、签名校验脚本和 `src/main/updateService.ts` 属于代码签名敏感文件，并由 `.github/CODEOWNERS` 指定责任人。
- 外部贡献者修改上述文件时，必须通过 Pull Request 由 Reviewer 审查；源码、构建脚本、依赖锁文件和 CI 配置都属于来源验证范围。
- 任何签名请求都必须基于正式 tag 的 GitHub Actions 自动构建产物，并由 Approver 在 SignPath 人工批准；不得上传本地构建文件替代受信产物，也不得自动批准签名。
- 拥有仓库写权限或 SignPath 项目权限的成员必须启用多因素认证（MFA）。

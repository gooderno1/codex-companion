# Code signing policy

本政策适用于 `Codex Companion` 的 Windows 正式发布产物，并作为 SignPath Foundation 免费开源代码签名申请与后续签名操作的公开约束。

> Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

## 当前状态

- SignPath Foundation 申请已于 2026-07-15 提交，目前等待审核和项目配置。
- 在 SignPath 明确批准、签名工作流接通并完成验收前，公开 Release 仍是未签名产物，应用不会自动下载或执行安装包。
- 本政策不会使既有安装包获得签名，也不代表 SignPath Foundation 已经批准本项目。

## 项目与签名范围

- 源码仓库：[gooderno1/codex-companion](https://github.com/gooderno1/codex-companion)。
- 开源许可：[MIT License](./LICENSE)。本项目不采用商业双重许可。
- 允许签名的自有产物仅包括由本仓库受信 GitHub Actions 工作流从正式版本 tag 构建的：
  - `Codex Companion.exe`
  - `Codex.Companion.Setup.<version>.exe`
- `latest.yml`、`.blockmap` 和 `SHA256SUMS.txt` 是更新与校验元数据，不属于 Authenticode 签名对象。
- 第三方或上游开源二进制可以随安装包分发，但不得使用本项目的 SignPath Foundation 订阅重新签名。项目不会签署专有代码、其他项目的产物或本仓库无法追溯的二进制文件。

## 角色与成员

- Authors / Committers：Jackie Lee（[@gooderno1](https://github.com/gooderno1)）。负责维护源码、构建脚本和正式版本 tag。
- Reviewers：Jackie Lee（[@gooderno1](https://github.com/gooderno1)）。所有非 committer 提交的变更必须通过 Pull Request 审查后才能合并。
- Approvers：Jackie Lee（[@gooderno1](https://github.com/gooderno1)）。每一次签名请求都必须由 Approver 人工核对并批准，不允许自动批准签名。
- 所有拥有 GitHub 仓库写权限或 SignPath 项目权限的成员都必须为相应账号启用多因素认证（MFA）。

## 构建、审查与批准

1. 正式签名只接受与 `package.json` 稳定版本完全一致的 `vX.Y.Z` tag，不签署开发版本、工作区临时构建或来源不明的上传文件。
2. 二进制必须由 [Windows 发布工作流](./.github/workflows/package-windows.yml) 在 GitHub 托管 runner 上从 tag 对应 commit 自动构建；源码、依赖锁文件、构建脚本和 CI 配置都属于审查范围。
3. `.github/workflows/`、`package.json`、`package-lock.json`、签名政策、签名校验脚本和更新器信任配置属于签名敏感文件，由 [CODEOWNERS](./.github/CODEOWNERS) 指定责任人。
4. 工作流必须验证 tag、应用版本、产品名称、文件版本和更新资产完整性。项目通过构建后的纯 JavaScript PE 资源步骤写入 exe 元数据，避免因旧工具包的非 Windows 符号链接而关闭资源处理；签名请求只能引用该自动构建的产物。
5. 每个正式 Release 都必须在 SignPath 中由 Approver 人工批准后才能签名；不得绕过 SignPath 的来源验证、元数据限制或审批步骤。

## 文件元数据限制

- 所有本项目签名的 Windows 可执行文件，`ProductName` 必须为 `Codex Companion`。
- 同一次正式构建内所有本项目签名产物的 `ProductVersion` 和 `FileVersion` 必须与 `package.json` 的 `X.Y.Z` 一致，并对应 Git tag `vX.Y.Z`。
- 发布工作流在提交签名请求前检查上述属性；SignPath 项目配置还应使用 file metadata restrictions 强制相同约束。
- 不满足元数据约束、产物范围或来源验证的请求必须拒绝。

## 隐私与系统行为

- 完整隐私边界见 [PRIVACY.md](./PRIVACY.md)。应用不会上传原始 Codex session、仓库源码、仓库路径、模型明细或成本数据。
- 应用仅在用户启用更新检查或主动操作时访问本项目公开 GitHub Releases；不会为更新请求附带 GitHub token。
- 安装、升级和卸载均使用用户可见的 NSIS 流程。自动安装只有在可信签名校验与连续版本升级验收通过后才会启用，安装前仍保持用户可见和可确认。

## 用户验证

正式签名启用后，可在 PowerShell 中检查安装包：

```powershell
Get-AuthenticodeSignature .\Codex.Companion.Setup.<version>.exe |
  Format-List Status, StatusMessage, SignerCertificate
```

预期 `Status` 为 `Valid`，签名证书主体为 `SignPath Foundation`。文件完整性可另外执行：

```powershell
Get-FileHash .\Codex.Companion.Setup.<version>.exe -Algorithm SHA256
```

并与同一 Release 中的 `SHA256SUMS.txt` 比对。签名与哈希是两项独立检查。

## 事件响应

- 如发现签名产物来源异常、元数据不符、隐私或安全边界被破坏，立即停止发布和自动升级，不批准新的签名请求。
- 按 [SECURITY.md](./SECURITY.md) 私下报告并调查；必要时联系 `support@signpath.io`，配合暂停订阅、撤销证书或撤下 Release 资产。
- 完成根因分析、修复和重新验证前，不恢复签名发布。

## 变更记录

- 2026-07-15：建立首版政策，记录签名范围、角色、MFA、自动构建、人工审批、文件元数据、隐私和事件响应要求。

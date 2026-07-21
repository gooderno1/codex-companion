# 安全策略

`Codex Companion` 是非官方本机桌面工具，首版不上传原始 Codex session 文件、不上传仓库源码，也不请求 GitHub token。

## 支持范围

当前项目处于公开预览阶段。安全反馈优先覆盖：

- 原始 Codex session、用户输入正文或模型输出正文被意外写入公开日志、缓存或导出内容
- 仓库源码、私有路径、远端地址或模型使用明细被意外上传
- Electron 主进程、preload 或 IPC 暴露了超出当前功能需要的系统能力
- 打包产物包含不应发布的本地文件、临时文件或开发数据
- 更新元数据、SHA512、Windows publisher 校验或 Release 资产被绕过、替换或指向非本仓库地址

## 自动升级安全边界

- 更新源固定为公开仓库 `gooderno1/codex-companion`，renderer 不能传入任意 feed URL、下载 URL或本机路径。
- Release notes 由主进程清洗为纯文本，底层错误只输出稳定错误码和脱敏中文摘要。
- GitHub Release workflow 使用最小 `contents: write` 权限；签名凭证不得写入源码、日志、Release notes 或安装包资源。
- 当前安装包 Authenticode 状态为 `NotSigned`。临时未签名模式只允许 Windows NSIS 安装版从本仓库 stable Release 自动下载，并要求用户点击“重启并安装”；退出时安装和静默重启保持关闭，Windows 仍可能拦截未知发布者。
- `latest.yml` 的 SHA512 用于确认下载文件与同一 Release 元数据一致，但不能替代发布者身份签名；SignPath 接入后必须固定可信 publisher，并关闭临时未签名开关。
- Windows 签名范围、角色、人工审批、元数据限制和事件响应以 [Code signing policy](./CODE_SIGNING_POLICY.md) 为准。
- 如果签名产物来源、证书主体或版本元数据不符合政策，应立即停止发布和自动升级，撤下可疑资产并联系 SignPath 配合调查。

## 反馈方式

请优先通过 GitHub Security Advisory 私下反馈安全问题。

如果 Security Advisory 暂不可用，请创建 issue，并只描述影响范围和复现条件，不要上传原始 session、仓库源码、访问令牌或包含敏感路径的截图。

## 报告建议

- 应用版本
- 操作系统
- 触发路径
- 预期隐私边界
- 实际暴露内容类型
- 可脱敏的复现步骤

## 不属于安全漏洞的情况

- API 等价成本估算与真实账单不同
- Codex 原始数据未暴露月额度导致页面显示未观测
- 用户主动配置的本地仓库根目录在设置页可见

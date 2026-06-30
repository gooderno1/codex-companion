# Roadmap

## 已完成

- `v0.1.0-dev.1`：初始化规划文档、协作规范、开发记录和项目方向。
- `v0.2.0-dev.1`：完成 Electron 桌面壳、本地 Codex / Git 采集、总览页、账本页、代码仓库页和挂件原型。
- `v0.2.2-dev.*`：持续完成总览页、设置页、刷新历史、设计 token、UI Contract、增量缓存和仓库页视觉收敛。
- `v0.3.0-dev.1` 至 `v0.3.0-dev.9`：升级账本页趋势图、放大查看、额度重置确认规则和周额度分桶口径。
- `v0.3.0-dev.10`：面向公开开源补齐 README、公开完善规划、仓库根目录设置、CI、Windows 打包 workflow、PR 模板、安全策略和贡献说明。
- `v0.3.0`：private 仓库内部正式版，用于内测验证 Windows 安装包、便携包、设置页仓库根目录配置和主要数据链路。
- `v0.3.1-dev.2`：补齐换电脑后的数据接线方案，设置页支持 Codex 数据目录配置和恢复默认，后续 Windows 打包只保留安装版。

## 发布前优先级

1. 内测 `v0.3.1` Windows 安装包，确认首次启动、Codex 数据目录、仓库根目录、刷新和三页主流程都可用。
2. 切换 GitHub 仓库为公开可见，并补充 description、topics、homepage 和截图。
3. 使用 GitHub Actions 验证后续 `package:win` 产物，并记录 SHA256 校验信息。
4. 补充 README 截图，确认截图不包含真实用户名、私有路径、私有仓库名或 session 内容。
5. 增加 collector 层测试，优先覆盖 JSONL 解析、`rate_limits` 缺失、仓库归因和计费窗口。

## 下一步

1. 增加脱敏 sample data，方便没有真实 Codex 历史的贡献者复现页面状态。
2. 增加应用内诊断能力，例如打开数据目录、复制脱敏诊断摘要、查看当前 `CODEX_HOME`。
3. 评估 Windows 代码签名和 SmartScreen 说明。
4. 单独排期桌面挂件公开化，验证点击穿透、锁定、隐私模式、多屏和全屏行为。
5. 评估 macOS / Linux 打包支持，但不改变 Windows 优先的公开预览节奏。

## 后续方向

- 周报 / 月报摘要。
- Codex Plugin / MCP 摘要接口。
- 可选账号同步与多设备聚合。
- GitHub 远端元数据补充。

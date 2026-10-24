# 2026-10-24 GPT-6 Sol EU Fast 规则维护

- 基线：正式 v0.7.5，主线 ca8d81f 仅增加发布验收记录；目标 v0.7.6，开发版本 v0.7.6-dev.1。
- 本项目为非官方 Codex 桌面伴侣，本次仅修正已支持模型的地区服务档位审计规则。

## 已确认变化

- [GPT-6 Sol 详情](https://developers.openai.com/api/docs/models/gpt-6-sol)、[Fast 指南](https://developers.openai.com/api/docs/guides/fast-mode)和[地区指南](https://developers.openai.com/api/docs/guides/your-data)一致写明：GPT-6 Sol 不支持 EU Fast；EU Standard / Flex / Batch 仍可用。
- GPT-6.1 Sol 与 GPT-6 Luna 的 EU Fast 仍可用；Astra 的 EU Fast 仍不可用。其他地区的 GPT-6 Sol Fast 及 API / Codex 费率不据此取消。
- 新目录从 gpt-6-sol.euDataResidencyServiceTiers 移除 fast，并显式标记 euFastAvailable=false。核对日期为 10-24，准确生效日期未知，euFastEffectiveFrom=null。
- 官方 API Pricing 的 Standard / Batch / Flex / Fast / Ultrafast 数值、30m / 12h 缓存写入及长上下文表均与上一轮一致。22 个已支持模型 API 标准费率、9 个当前 Codex credits 模型、全部已知别名均未变。

## 缓存与历史边界

- 新快照 2026-10-24 随包保存；10-21 及更早快照不改写，仍反映当时核实的 EU Fast 状态。
- 当前估值为 Standard 短上下文快照重估，不从本地累计 Token 猜请求地区、档位或长上下文。地区规则仅用于审计；不补造历史服务档位或生效时间。
- GPT-6 Sol 合成样例：100 万输入含 80 万缓存读取、10 万输出，仍为 USD 1.56 / 39 credits。10-21 与 10-24 快照估值相等，historical 模式仍为 null。
- 会话缓存 6、SQLite 106 与原始额度索引 1 保持。仪表盘按目录版本拒绝旧快照；额度估算切换快照只重算派生值，复用原始索引。
- 未修改共享解析或 reset；已检查远程核心，最新 tag 与当前依赖均为 v0.2.0-dev.4。

## 证据与排除范围

- 已实际打开 Codex Pricing / Speed、API Pricing、两个模型目录、模型及别名详情、Fast / Ultrafast / 缓存 / 地区指南与 Changelog；六个旧 Codex 模型另核对 HTML 价格。
- Discovery、Cyber 长上下文、Sol Ultrafast 既有证据缺口保持，不猜价。Sol 促销至少到 11-21，没有未来替代费率。
- Decisions API 的输出免收费只适用于 /v1/decisions，不覆盖其他请求的 Luna 模型价。当前产品无该端点计量维度，不增加估值功能。

## 验证

- 执行完整构建、价格 / 历史快照 / 旧缓存拒用回归及发布相关验证；准确结果在开发记录与 Release 验收中记录。

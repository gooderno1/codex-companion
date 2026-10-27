# 2026-10-27 GPT-6.1 Terra 定价维护

- 基线：已验收 v0.7.6 与发布文档 1c19f55；目标 v0.7.7，开发版本 v0.7.7-dev.1。
- 本项目为非官方 Codex 桌面伴侣。本轮仅增加已公开的新模型定价、派生缓存迁移与对应回归。

## 官方核查

- [模型详情](https://developers.openai.com/api/docs/models/gpt-6.1-terra)与[模型目录](https://learn.chatgpt.com/docs/models)确认精确 ID / 当前快照 gpt-6.1-terra；没有将 GPT-5.6 Terra 或 GPT-6.1 别名迁移到新型号。
- [API Pricing](https://developers.openai.com/api/docs/pricing)：Standard 短上下文每百万输入 / 缓存读 / 输出 USD 1 / 0.05 / 5；30m / 12h 缓存写 USD 1.25 / 2.5。
- API Fast 为 Standard 的 2 倍，Batch / Flex 为 0.5 倍；>272000 输入 Token 时整请求输入及缓存 2 倍、输出 1.5 倍。正好 272000 属短上下文。
- [Codex Pricing](https://learn.chatgpt.com/docs/pricing)：Standard 输入 / 缓存读 / 输出为 25 / 1.25 / 125 credits；Codex 不另收缓存写入费。
- [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)：Fast 为购买 credits / Enterprise 按量 2 倍，套餐内用量 2.5 倍。Terra 未公布 Ultrafast 费率，保持未知，不套用 Sol。
- [地区指南](https://developers.openai.com/api/docs/guides/your-data)：Terra 支持 US / EU，EU Standard / Flex / Batch / Fast 可用；不支持 UAE inference residency。地区处理溢价为 10%。
- [Changelog](https://developers.openai.com/api/docs/changelog)记录 10-26 发布，CLI 0.159.0 起可选。发布日不等于完整计费历史；API / Codex 精确价格生效时间均未公布，保持 null。
- 已逐页读取 Pricing / Speed、API Pricing、模型目录与对应详情、Fast / Ultrafast / 缓存 / 地区指南。七个旧模型另核对 HTML 价格；其余 22 个模型 Standard API 费率、9 个当前 credits 模型及已有档位、12h 规则未变。
- Sol 促销仍至少至 11-21，未公布未来替代费率。Discovery、Cyber 长上下文、Sol Ultrafast 的既有证据缺口保留，不猜价。

## 实现及历史语义

- 新增 2026-10-27 目录并保留 10-24 及全部旧快照。当前界面仍按 Standard 短上下文快照重估，不从累计 Token 猜请求档位、缓存写入、长上下文或地区。
- 样例：100 万输入含 80 万缓存读、10 万输出，Terra 为 USD 0.74 / 18.5 credits；全缓存 100 万、无输出为 USD 0.05 / 1.25 credits。
- 旧目录中 Terra 仍未知；historical 模式保持 null。目录核对日期不充当历史账单生效时间。
- 会话缓存 6→7，SQLite 106→107，使旧未知价格在源文件不变时重新估值；原始 Token 与额度索引版本 1 不变。仪表盘拒绝旧目录，重估后继续复用缓存。
- 核查远端核心包最新 tag 与当前依赖均为 v0.2.0-dev.4；本轮不改共享解析或 reset，不实施规划中的页面。

## 验证

- 回归覆盖新模型金额、全缓存、精确名称、旧模型不变、旧快照未知、历史模式、JSON 缓存与 SQLite 迁移、原始额度索引复用。
- 完整构建及发布相关验证结果写入 DEVELOPMENT_LOG.md；精确提交与安装包验收写入正式 Release 记录。

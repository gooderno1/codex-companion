# 2026-10-09 Ultrafast 计费规则维护

- 基线：正式版 v0.7.3，main 36d3087；目标 v0.7.4，开发版本 v0.7.4-dev.1。
- 本项目为非官方 Codex 桌面伴侣。本轮仅维护价格目录、来源和契约，不新增档位估算页面或共享解析。
- 已实际打开 Codex Pricing / Speed、API Pricing、API / Codex 模型目录、22 个模型详情（Rosalind 独立详情仍 404）、两个 Daybreak 别名详情、Fast / Ultrafast / 缓存 / 地区指南和 Changelog；旧 Codex 六模型另核对 HTML 价格表。

## 已确认变化

- [API Pricing](https://developers.openai.com/api/docs/pricing)：gpt-6.1-sol Ultrafast 每百万普通输入 / 缓存读取 / 缓存写入 / 输出为 USD 12 / 0.60 / 15 / 60；严格超过 272000 输入 Token 的完整请求为 24 / 1.20 / 30 / 90。
- [模型详情](https://developers.openai.com/api/docs/models/gpt-6.1-sol)确认 API Ultrafast 为 Standard 的 6 倍，长上下文输入和缓存 2 倍、输出 1.5 倍；缓存写入替代对应普通输入收费，不是额外叠加。
- [Codex Pricing](https://learn.chatgpt.com/docs/pricing)与 [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)：Ultrafast 购买 credits / Enterprise pay-as-you-go 为 Standard 的 6 倍，即 300 / 15 / 1500 credits/M 输入 / 缓存读取 / 输出；订阅内额度为 8 倍，Codex 无独立缓存写入费。
- [API Changelog](https://developers.openai.com/api/docs/changelog)记载 2026-10-08 开放；availableFrom 只表示可用日期，未当作完整历史价格生效区间，apiUltrafastEffectiveFrom 保持 null。
- [地区指南](https://developers.openai.com/api/docs/guides/your-data#which-models-and-features-are-eligible-for-data-residency)：GPT-6.1 Sol、GPT-6 Sol、GPT-6 Luna 支持 EU Fast；6.1 Sol Ultrafast 支持 US / EU / global，Astra Ultrafast 仍仅 US / global。适用地区处理费率仍为 1.1 倍。

## 应用与历史边界

- 新目录 2026-10-09 记录规则并移除 6.1 Sol Ultrafast pending。全部 22 个模型的 Standard USD / credits 和既有别名映射与 10-08 完全相等。
- 估值继续使用 Standard 短上下文；本地事件不足以还原请求档位、缓存写入和长上下文，不自动将 Ultrafast 6 倍或订阅 8 倍应用到历史 Token。
- 合成样例：100 万输入含 80 万缓存、10 万输出，Standard 仍为 USD 1.48 / 37 credits；已知 Ultrafast 且无写入、短上下文的情景才是 USD 8.88 / 222 credits，不能用 8 倍推算购买 credits。
- 旧快照 10-08 的 Ultrafast pending 和 EU Fast 状态原样保留；目录级 effectiveFrom 仍为 null，historical 模式仍为未定价。
- 本次金额公式与全部标准费率未变，普通会话缓存 6、SQLite 106 保持不变，避免无意义重解析。仪表盘目录版本更新后重新汇总；额度估算切换新旧快照只重算派生值，原始索引复用且金额相同。

## 证据缺口与排除项

- Daybreak 两个详情现标记 deprecated，未给出新映射；保留已核实别名费率并记录来源状态，不猜测迁移目标。
- gpt-5.5-cyber 在 API 价格表有 12.5 / 1.25 / 75，但模型目录未收录、独立详情 404、Codex 身份与 credits 未确认；本轮不新增或套用 5.6 Cyber，保持未定价。
- Cyber 长上下文仍有模型详情与价格表冲突；5.6 Sol Ultrafast 仍无公开费率，保留 pending。
- GPT-5.5 在 Codex 的 10-14 退役公告不改变 API 单价，不删除历史费率；5.4 / mini credits 保留旧证据。
- 5.6 Sol 促销至少到 11-21，不推断结束后的价格；图片、语音、工具计费仍不在本产品可观测估值范围内。

## 验证

- 核心远端最新与当前依赖均为 v0.2.0-dev.4，不修改共享解析 / reset。
- 执行 npm run build、verify:usage、verify:activity、verify:estimation、verify:updater、verify:notifications、verify:comparisons、verify:startup、verify:signing-policy、git diff --check；结果在开发记录与发布验收补记。

# 2026-10-29 模型计费核查

- 基线：stable v0.7.7 / 9a7158e，主线 b4b825e 仅追加验收文档。发布目标 v0.7.8。
- 任务范围：官方计费规则快照、缓存目录生效与回归；不实施额度估算页面，不改共享解析或 reset。

## 已确认变化

- [Codex pricing](https://learn.chatgpt.com/docs/pricing) 明确 GPT-6.1 Sol 使用套餐内额度时，无长上下文附加费。
- [GPT-6.1 Sol 模型详情](https://developers.openai.com/api/docs/models/gpt-6.1-sol) 同时保留 API 单次输入 >272K 的完整请求加价：输入 / 缓存乘 2，输出乘 1.5。
- [Codex 模型目录](https://learn.chatgpt.com/docs/models) 与模型详情明确 Codex / ChatGPT Work 默认上下文为 500K tokens。这是默认窗口，不替代 API 272K 计费阈值。
- 官方未给该套餐规则的生效时间，effectiveFrom=null；2026-10-29 只是核对日。
- 套餐豁免不扩展到购买 credits、Enterprise 按量协议或其他模型。应用仅保存审计规则，继续标准短上下文快照重估，不能据此声称还原实付账单。

## 其他核对与排除

- 实际读取 [API 定价](https://platform.openai.com/docs/pricing)、[开发者定价](https://developers.openai.com/api/docs/pricing)、[模型目录](https://developers.openai.com/api/docs/models) 及应用支持型号详情。
- 对比 Standard / Batch / Flex / Fast / Ultrafast、输入 / 缓存读 / 30m 与 12h 写入 / 输出、短长上下文；23 个标准 API 型号与 10 个当前 credits 型号无单价变化。
- [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed) 的套餐与购买 credits 倍率保持；Priority / Fast 别名、已登记模型别名、地区范围和促销最早持续日期保持，不提前替换未来费率。
- [ChatGPT API credits](https://developers.openai.com/api/docs/guides/chatgpt-api-credits) 新福利明确排除通过 API key 的 Codex 用量，也不增加已登录 Codex 的额度；不改变本产品单价或额度统计。
- 既有证据缺口保持：未公布价格 / 必要长上下文数据不填零、不套用相似模型；部分模型文档接口被 403 拒绝时，已打开官方 HTML 交叉核验。

## 缓存、历史与验证

- 新增 2026-10-29 快照，保留全部旧快照；来源包含核对时间与证据 SHA256。
- 费率不变，JSON 会话缓存 7、SQLite 107、原始额度索引 1 保持；仪表盘按新目录版本失效，派生估值按所选目录重新生成。
- 回归样例：Sol 100 万输入含 80 万缓存读、10 万输出仍为 USD 1.48 / 37 credits；历史模式在无完整生效证据时仍返回未知。
- 验证旧快照没有新套餐规则、API 长上下文倍率保持、其他模型不被推广豁免、新旧目录切换不重新解析源文件。
- 完整构建与发布验证结果见 DEVELOPMENT_LOG.md、RELEASE_NOTES.md。

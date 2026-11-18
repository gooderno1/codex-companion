# 2026-11-18 模型计费核查

## 核对范围与结论

- 基线：v0.7.13；新增 2026-11-18 快照，旧快照保持原样。现有 23 个型号单价没有变化。
- 两个官方 API 定价站点的 170 行模型价格表一致。逐项复核 Codex credits、模型目录、模型详情、速度、缓存、后台请求和地区处理指南。
- GPT-6.2 Astra / Sol 于 2026-11-17 在 API、Codex 和 Work 发布，首次收入本项目价格快照为 11-18。精确价格生效时刻没有完整证据，保持 null；发布时间不充当计费生效日。

## 新型号现行 Standard 价格

以下均为每百万 Token，依次为普通输入、缓存读、输出。缓存写入另列 USD，不合并为输入消耗。

| 精确模型 ID | API USD | Codex credits | 30 分钟缓存写入 USD | 12 小时缓存写入 USD |
| --- | --- | --- | --- | --- |
| gpt-6.2-astra | 8 / 0.40 / 40 | 200 / 10 / 1000 | 10 | 20 |
| gpt-6.2-sol | 2 / 0.10 / 10 | 50 / 2.5 / 250 | 2.5 | 5 |

- 官方未给新型号列出 Flex 费率，保留未知。API Batch 为 Standard 的 0.5 倍，Fast 为 2 倍；Codex Fast 套餐内和购买 credits 均为 2 倍。
- 单次完整请求输入超过 272000 Token 时，输入、缓存读写为短上下文的 2 倍，输出为 1.5 倍；等于阈值时不加价。不能按会话累计长度判断。
- API Ultrafast 和 Codex 购买 credits 现行促销为 3 倍，至美国太平洋时间 2027-02-28；官方公布 2027-03-01 起为 6 倍，单列 successor / pending，不提前替换。套餐内 Ultrafast 为 6 倍。
- Astra / Sol 的 Codex 默认上下文窗口分别为 272000 / 500000。没有把旧 Sol 的套餐长上下文豁免推广到新型号。
- 两者支持美国、欧盟 Standard / Fast / Batch 区域处理，区域附加费为 10%。Ultrafast 的地区处理仅美国（另可使用全球处理），不推定欧盟可用。
- Responses API 的顶层 instructions 每次按未缓存输入计费；可复用指令放在 input 中的 developer 消息才可按通常缓存条件处理。
- 精确 ID 独立计价，不新增 gpt-6.2 或 law / pro / mini 变体别名。原有日期后缀归一化继续保留，不作为官方新增别名记录。

## 后台完成窗口

- GPT-6.2 Astra、GPT-6.2 Sol、GPT-6.1 Terra 和 GPT-6 Luna 的 Responses API 新增后台完成窗口公测规则。
- 请求须设置 background=true、stream=false 或省略，并使用 Standard（default，或实际落到 Standard 的 auto）。2h / 8h 的模型 Token 费率分别为 Standard 的 0.7 / 0.6 倍。
- 默认 soonest 不打折；不将其他服务档位、托管工具费用或整个多轮工作流自动视为折扣请求。后续请求各自满足条件。
- 普通 Standard 请求不能复用折扣窗口缓存。规则单列审计；应用现有会话 Token 缺少请求配置证据，仍按 Standard 短上下文快照估值，不自动套用折扣。

## 缓存、历史与证据边界

- 会话派生成本缓存版本升至 8，活动 SQLite 索引 user_version 升至 108。未修改的旧会话也会重估新型号之前的未知成本；原始 Token 不改写。
- 原始额度索引保持版本 1。历史快照重估复用原始 Token；11-17 中不存在新型号，返回未定价；11-18 可以按所选快照重估。按当时价格缺生效区间时仍为未知。
- 验证样例：100 万输入（含 80 万缓存）、10 万输出，Astra 为 USD 5.92 / 148 credits，Sol 为 USD 1.48 / 37 credits。该值是标准短上下文估值，不代表单次长请求实际账单。
- 已核对核心包远端，依赖仍为 @lifeinhand/codex-usage-core v0.2.0-dev.4；没有修改共享解析或 reset。
- GPT-5.6 Sol 的 API 促销至 11-30、Codex credits 至少至 11-21 沿用上一快照。Rosalind discovery、Cyber 等既有未完整定价的变体不套价。

## 官方来源

- [模型发布公告](https://learn.chatgpt.com/docs/whats-new/gpt-62-astra-sol) · [Codex 模型目录](https://learn.chatgpt.com/docs/models)
- [Codex credits](https://learn.chatgpt.com/docs/pricing) · [速度档位](https://learn.chatgpt.com/docs/agent-configuration/speed)
- [API 定价](https://developers.openai.com/api/docs/pricing) · [Platform 定价](https://platform.openai.com/docs/pricing) · [API 模型目录](https://developers.openai.com/api/docs/models)
- [Astra 详情](https://developers.openai.com/api/docs/models/gpt-6.2-astra) · [Sol 详情](https://developers.openai.com/api/docs/models/gpt-6.2-sol)
- [后台完成窗口](https://developers.openai.com/api/docs/guides/background) · [提示缓存](https://developers.openai.com/api/docs/guides/prompt-caching) · [区域处理](https://developers.openai.com/api/docs/guides/data-residency)

本轮原始抓取状态留在本机忽略目录；通用规则摘要和证据摘要哈希随价格快照保存。

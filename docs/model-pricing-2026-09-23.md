# 2026-09-23 GPT-6 Sol / Luna 定价维护

- 基线：v0.7.0，main 6142ae9；目标 v0.7.1，开发版本 v0.7.1-dev.1。
- 实际打开官方 API Pricing、Codex Pricing、Speed、模型目录、新旧模型详情及缓存 / Fast 指南；新增两款模型，其余现有模型价格与官方别名不变。
- 本产品为非官方 Codex 桌面伴侣。费用为标准短上下文快照重估，不是订阅实付或历史账单。

## 当前标准价格

每百万 Token；顺序为普通输入 / 缓存读取 / 输出。

| 模型 ID | API USD | Codex credits |
| --- | --- | --- |
| gpt-6-sol | 2 / 0.2 / 10 | 50 / 5 / 250 |
| gpt-6-luna | 0.1 / 0.01 / 0.5 | 2.5 / 0.25 / 12.5 |

- API 来源：[Pricing](https://developers.openai.com/api/docs/pricing)、[Sol](https://developers.openai.com/api/docs/models/gpt-6-sol)、[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)。
- credits 独立来源：[Codex Pricing](https://learn.chatgpt.com/docs/pricing)，不由 USD 推算。
- 新模型只登记明确 ID 及既有已登记基础模型的日期后缀规则；不新增 gpt-6、Sol 或 Luna 等模糊别名。gpt-5.6 和 Daybreak 仍按原官方映射。
- 2026-09-23 是核对日期，不作为历史生效日；effectiveFrom 保持 null。保留 09-17、09-19 快照，旧快照下新模型仍为未定价。
- GPT-5.6 Sol 促销至少至 2026-11-21，不能自动涨价；Rosalind API 2026-10-05 未来费率继续 pending；Cyber 长上下文冲突仍 pending。未公开的旧模型 credits 保留旧证据或 null。

## 规则边界

- [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)：GPT-6 Sol / Luna 的 Codex Fast 为 2.5 倍；API Fast 为 2 倍，Priority 是同一 API 档位的旧名。
- API 缓存写入分别为 2.5 / 0.125 USD/M，替代对应普通输入费用；Codex credits 官方明确无独立缓存写入收费，不把 API 规则套入 credits。
- 单请求输入严格大于 272000 时，完整请求输入 / 缓存按 2 倍、输出按 1.5 倍；不能按累计会话 Token 触发。
- API Batch / Flex 为 Standard 的一半；适用地区处理加价 10%，EU data residency 仅支持 Standard。
- 上述附加维度保留为核查规则。现有事件缺少请求边界、缓存写入量及实际档位 / 地区，继续明确采用标准短上下文估值，不伪装完整结算。
- 新价格目录保留各来源的证据片段、核对日期与 SHA256；旧目录文件不改写。

## 缓存、历史重估和验证

- 普通会话缓存 3 → 4，账本 SQLite user_version 103 → 104；源文件未变时也重估旧派生成本，Token 守恒。仪表盘版本使用新目录日期并拒绝旧快照。
- 额度估算原始索引版本不变；选择新快照重新计算，切回旧快照仍显示新模型未定价，重启后原始索引复用。
- 样例：100 万输入含 80 万缓存、10 万输出，Sol 为 USD 1.56 / 39 credits，Luna 为 USD 0.078 / 1.95 credits。
- SQLite 样例：Sol 累计 180 输入 Token，旧派生成本被重算为 USD 0.00036 / 0.009 credits，Token 仍为 180。
- 核心已核查远程最新 tag v0.2.0-dev.4；本次只改应用价格、缓存版本、回归和文档，不改共享解析 / reset 规则。
- 验证命令：npm run build、verify:usage、verify:activity、verify:estimation、verify:updater、verify:notifications、verify:comparisons、verify:startup、verify:signing-policy、git diff --check。执行结果见开发记录和 Release notes。

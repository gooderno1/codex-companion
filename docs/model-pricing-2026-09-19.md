# 2026-09-19 模型定价核查与快照重估

- 类型：模型价格维护；基线 v0.6.2，远端 main 为 060f8db（其后的改动仅规划和任务迁移文档）。
- 核查日期：2026-09-19；目标版本 v0.6.3，实施记录 v0.6.3-dev.4。
- 本轮补齐应用已遗漏的公开价格，不声称官网在本日才调价。
- 不实施额度估算页面，不改变 token 增量、reset 或套餐余量；共享核心仍为远端最新 v0.2.0-dev.3。

## 已确认的标准价格

所有数字均为每百万 Token，顺序为普通输入 / 缓存读取 / 输出。

| 模型 | API USD | Codex credits |
| --- | --- | --- |
| GPT-6 Astra | 10 / 1 / 50（原值） | 250 / 25 / 1250 |
| GPT-5.6 Sol | 4 / 0.4 / 20 | 100 / 10 / 500 |
| GPT-5.6 Terra | 2 / 0.2 / 12 | 50 / 5 / 300 |
| GPT-5.6 Luna | 0.2 / 0.02 / 1.2 | 5 / 0.5 / 30 |
| GPT-5.6 Cyber / Daybreak Red | 12.5 / 1.25 / 75 | 312.5 / 31.25 / 1875 |
| GPT-5.1 / GPT-5.1 Codex / Max | 1.25 / 0.125 / 10 | 未定价 |
| GPT-5.1 Codex Mini | 0.25 / 0.025 / 2 | 未定价 |
| codex-mini-latest | 1.5 / 0.375 / 6 | 未定价 |

- [API Pricing](https://developers.openai.com/api/docs/pricing) 与 [Codex Pricing](https://learn.chatgpt.com/docs/pricing) 分别读取，不通过美元与 credits 固定倍率推导。
- [Sol 详情](https://developers.openai.com/api/docs/models/gpt-5.6-sol) 明确 gpt-5.6 指向 Sol；[Blue](https://developers.openai.com/api/docs/models/gpt-daybreak-blue-latest) / [Red](https://developers.openai.com/api/docs/models/gpt-daybreak-red-latest) 当前分别指向 Sol / Cyber。别名只按本快照重估，不假定历史一直指向同一模型。
- 原有旧模型费率保留；已从当前 API 表核对的原有价无变化。旧 Codex 5.2 / 5.3 费率保留原 2026-06-02 证据，不伪称本次官网仍列出。
- 目录保存官方 URL、核对日期、公开必要证据片段及其 SHA256（evidenceHash，指片段字节而非完整网页）；完整抓取不是发布产物。

## 已核实但不能从现有记录还原的计费维度

- [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)：Astra / GPT-5.6 / GPT-5.5 的 Codex Fast 为 2.5 倍，GPT-5.4 为 2 倍。
- [API Fast](https://developers.openai.com/api/docs/guides/fast-mode)：Astra / GPT-5.6 为对应 Standard 的 2 倍；API Priority 已于 2026-07-30 改名 Fast，priority / fast 为同一服务档位的参数别名。不得套用 Codex 2.5 倍。
- Astra / Sol / Terra / Luna 缓存写入价分别为 12.5 / 5 / 2.5 / 0.25 USD/M。[Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) 规定写入替代普通输入费，不额外叠加整份写入费。
- 对上述模型，单请求输入严格大于 272000 时，完整请求输入和缓存为 2 倍、输出为 1.5 倍；不能用累计会话 Token 触发。GPT-5.4 / 5.5 详情则写 full session，保留范围差异。
- 现有事件缺少完整请求边界、cache_write_tokens、实际服务档位和地区；应用继续采用标准短上下文快照重估。目录 rules 仅为核查资料，不自动应用这些倍率，也不声称它是完整结算引擎。
- 数值聚合只包含已知价格；未知估值函数返回 null，事件状态 unpriced，模型详情显示未定价。内部累计加数 0 不代表未知价格为零。

## 生效时间和证据缺口

- Sol 促销至少持续到 2026-11-21；这不是确定终止日，expiresAt 为 null，不自动涨价。
- Rosalind API 明确自 2026-10-05 开始计费；本轮只存 pending 条目，不启用其未来费率，也不推断之前免费。Codex 页面 credits 与 API 生效时间不是可互换的证据。
- Cyber 模型详情最大输入 272000，同时提及超过 272K 倍率，而 API 表长上下文为空；该维度保持 pending，已确认的短上下文价可独立使用。
- GPT-5.1 Codex 系列的 Markdown 正文遗漏价格组件；实际打开官方 HTML 详情页后读取标准价，已补齐 Codex / Max / Mini 及 codex-mini-latest。各页来源附在目录中；缺失的 Codex credits 保持 null。
- verifiedAt 不是 effectiveFrom；当前新价格的可靠历史生效时点未知，effectiveFrom=null。保留 2026-09-17 旧快照，当前显示按 2026-09-19 重估，而非“当时实付”。

## 缓存与验证

- 会话缓存 2 → 3；SQLite user_version 102 → 103。旧文件即使 size / mtime 不变也重算派生成本；原始 Token 不改。
- 仪表盘加 pricingCatalogVersion；启动和采集失败时都拒绝旧价格快照，成功刷新后才使用新版估值。
- 样例：输入 100 万（80 万缓存）、输出 10 万：Astra 7.80 USD / 195 credits；Sol 3.12 / 78；Terra 1.76 / 44；Luna 0.176 / 4.4；Cyber 11 / 275。推理输出已在输出内，不重复计费。
- 回归覆盖确认费率、精确别名、未知型号、未来日期、促销语义、证据哈希、会话缓存迁移、SQLite 旧值重算及重启复用、仪表盘旧缓存拒用。
- 验证命令：npm run build、npm run verify:usage、npm run verify:activity、npm run verify:updater、npm run verify:notifications、npm run verify:comparisons、npm run verify:startup、npm run verify:signing-policy、git diff --check。

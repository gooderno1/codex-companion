# 2026-09-30 GPT-6.1 Sol 与速度档位定价维护

- 基线：已验收 v0.7.1，main 053fa9e；目标 v0.7.2，开发版本 v0.7.2-dev.1。
- 实际打开官方 API Pricing、Codex Pricing、Speed、模型目录、全部受支持模型详情及缓存 / Fast / Ultrafast 指南；旧 Codex 模型补查 HTML 价格表。
- 本产品为非官方 Codex 桌面伴侣；金额继续为标准短上下文快照重估，不是历史账单或订阅实付。

## 标准费率与来源

| 模型 ID | API USD/M：输入 / 缓存读取 / 输出 | Codex credits/M：输入 / 缓存读取 / 输出 |
| --- | --- | --- |
| gpt-6.1-sol | 2 / 0.10 / 10 | 50 / 2.5 / 250 |

- API 来源：[Pricing](https://developers.openai.com/api/docs/pricing)、[模型详情](https://developers.openai.com/api/docs/models/gpt-6.1-sol)；credits 独立来源：[Codex Pricing](https://learn.chatgpt.com/docs/pricing)，不从 USD 推算。
- API 缓存读取为普通输入的 5%；写入为 2.50 USD/M，替代对应普通输入费用，不重复叠加。Codex credits 无独立缓存写入收费。
- 单请求输入严格大于 272000 时，完整请求输入 / 缓存乘 2、输出乘 1.5；不能用会话累计 Token 触发。
- API Fast 为 Standard 的 2 倍，Batch / Flex 为 0.5 倍，适用地区处理加价 10%；EU 不支持 Fast。
- 只登记明确 ID；沿用已登记基础模型日期后缀解析，不新增 gpt-6.1、Sol 等模糊别名。gpt-6-sol、gpt-5.6 及 Daybreak 映射保持不变。

## 速度档位规则

来源：[Codex Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)、[API Pricing](https://developers.openai.com/api/docs/pricing)、[Ultrafast](https://developers.openai.com/api/docs/guides/ultrafast-mode)。

- Codex 支持 Fast 的 GPT-6 Astra / 6.1 Sol / 6 Sol / 6 Luna / 5.6 / 5.5：购买 credits 与 Enterprise pay-as-you-go 为 Standard 的 2 倍；订阅内额度消耗为 2.5 倍。
- 新目录 codexFastMultiplier 明确指购买 credits / Enterprise pay-as-you-go；另存 codexFastSubscriptionMultiplier，不把额度消耗、信用点费用或生成速度混为一谈。
- Astra Ultrafast API 为 Standard 的 6 倍。短上下文输入 / 缓存读 / 写 / 输出为 USD 60 / 6 / 75 / 300；长上下文为 120 / 12 / 150 / 450。
- Astra Ultrafast 的 Codex 购买 credits / Enterprise pay-as-you-go 为 6 倍，订阅内额度消耗为 8 倍；Enterprise 按工作区协议执行。
- Codex Ultrafast 限 Pro $500 或符合条件的 Enterprise / Edu；API 支持美国驻留或全球处理，不支持 EU 或其他非美国驻留。资格不由购买 credits 自动获得。
- GPT-6.1 Sol 的 Ultrafast 尚未开放；GPT-5.6 Sol API Ultrafast 仅有 preview access，未公开可核实费率。两者保持 pending，不套 Astra 倍率。
- GPT-6 Sol / Luna 的 EU 支持范围已改为 Standard / Flex / Batch，Fast 仍不可用；来源为对应模型详情。
- 这些规则仅用于来源审计；现有事件缺请求边界、实际档位、缓存写入量与地区，不自动应用附加倍率。

## 历史与证据边界

- 新快照为 2026-09-30；保留 09-17、09-19、09-23 原文件及旧核对日期。旧快照下 6.1 Sol 仍未定价。
- effectiveFrom 保持 null；核对日不能替代历史生效日，historical 模式继续返回未定价。
- 旧模型标准价格不变。GPT-5.4 / mini 已不在当前 Codex 表，保留 09-23 已核实的旧费率及证据；没有新费率时不填零、不删除旧值。
- GPT-5.6 Sol 促销至少到 2026-11-21，不能自动结束。Rosalind 2026-10-05 的未来 API 价不提前启用；Cyber 长上下文冲突继续 pending。
- 本轮新增来源片段保留 URL、核对日期、SHA256；既有证据保留原核对日。

## 缓存与回归

- 会话缓存 4 → 5，账本 SQLite user_version 104 → 105；即使源文件未变，也重估新模型旧未定价结果，Token 守恒。
- 仪表盘使用新目录日期并拒绝启动或采集失败时的旧价格快照。
- 额度估算原始索引不失效；切换新旧快照只重算金额，重启继续复用原始索引。
- 样例：100 万输入含 80 万缓存、10 万输出，6.1 Sol 为 USD 1.48 / 37 credits；全缓存 100 万输入为 USD 0.10 / 2.5 credits。
- SQLite 样例：累计 180 输入 Token，重估为 USD 0.00036 / 0.009 credits，Token 仍为 180。
- 已核查远程核心最新 tag v0.2.0-dev.4；依赖保持该远程 tag，不改共享解析 / reset 或规划功能。
- 验证：npm run build、verify:usage、verify:activity、verify:estimation、verify:updater、verify:notifications、verify:comparisons、verify:startup、verify:signing-policy、git diff --check；实际结果见开发记录和 Release notes。

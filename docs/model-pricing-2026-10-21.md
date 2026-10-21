# 2026-10-21 缓存时长计费规则维护

- 基线：正式版 v0.7.4；main 0469309 仅比发布 tag 多验收文档；目标 v0.7.5，开发版本 v0.7.5-dev.1。
- 本项目为非官方 Codex 桌面伴侣。本轮维护价格快照和审计契约，不新增估算功能，不修改共享解析 / reset。
- 已实际读取 Codex Pricing / Speed、API Pricing、API / Codex 模型目录、现有模型及 Daybreak 详情、缓存 / 速度 / 地区指南和 Changelog。Research、Discovery、5.5 Cyber 独立详情仍 404；旧 Codex 六模型另核对 HTML 货币价格。

## 官方变化与范围

- [API Changelog](https://developers.openai.com/api/docs/changelog)于 2026-10-20 公告 Responses API 可选择 12 小时缓存。
- [缓存指南](https://developers.openai.com/api/docs/guides/prompt-caching#cache-lifetime)说明默认 30m 写入为普通输入 1.25 倍，12h 为 2.5 倍；这些是替代普通输入的总费率，不是附加费。读取费率不随时长变化。
- 请求的 prompt_cache_options.ttl 为默认值；显式断点的 prompt_cache_breakpoint.ttl 可覆盖。缺省仍为 30m；不与早期模型的 prompt_cache_retention 混用。
- [API Pricing](https://developers.openai.com/api/docs/pricing)已增加 30m / 12h 列并调整输出 / 缓存读取顺序。本次按列名核对，不能把列移动识别成费率变化。
- 22 个现有模型的标准输入 / 缓存读取 / 输出价格均未变；9 个当前 Codex credits 模型一致。退役模型保留已核实的历史 rate card。

| 模型 | Standard 30m 写入 USD/M | Standard 12h 写入 USD/M | 12h 长上下文 USD/M |
| --- | ---: | ---: | ---: |
| gpt-6-astra | 12.5 | 25 | 50 |
| gpt-6.1-sol | 2.5 | 5 | 10 |
| gpt-6-sol | 2.5 | 5 | 10 |
| gpt-6-luna | 0.125 | 0.25 | 0.5 |
| gpt-5.6-sol | 5 | 10 | 20 |
| gpt-5.6-terra | 2.5 | 5 | 10 |
| gpt-5.6-luna | 0.25 | 0.5 | 1 |
| gpt-5.6-cyber | 15.625 | 31.25 | 未确认 |

- 前七个模型的长上下文严格为请求输入 >272000；整个请求输入 / 缓存费率 2 倍，输出 1.5 倍。
- 前七个模型的 12h 写入 Batch / Flex 为 Standard 0.5 倍，Fast 为 2 倍；Astra / 6.1 Sol Ultrafast 为 6 倍。新目录保存已公布的各档短 / 长上下文写入价格。
- Cyber 没有可靠长上下文及 Fast / Ultrafast 价格，保持 null / 缺失；不从相近模型推算。
- [Codex Pricing](https://learn.chatgpt.com/docs/pricing)无单独缓存写入收费。[Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)购买 credits Fast / Ultrafast 为 2 / 6 倍，订阅内额度为 2.5 / 8 倍，保持原口径。

## 重叠计费与验证样例

- 同一请求中，重叠写入的每个 Token 只按覆盖它的最长选定时长计费一次。
- 30m 升为 12h 会对升级部分重新收取完整 12h 写入价，不抵扣之前写入；仍有效的 12h 部分维持缓存读取。
- API usage 的 ttl_30m_tokens 与 ttl_12h_tokens 不重叠，两者之和为 cache_write_tokens；cached_tokens 排除写入。不得重复加总总写入和分项。
- 6.1 Sol 短上下文样例：12000 输入中 4000 读取、3000 写 30m、4000 写 12h，剩余 1000 普通输入，输入成本为 (1000×2 + 4000×0.1 + 3000×2.5 + 4000×5)/1000000 = USD 0.0299。
- 12h 断点在 2000、30m 断点在 5000：2000 按 12h、3000 按 30m，USD 0.0175；顺序反过来则 5000 全按 12h，USD 0.025。
- 2000 Token 已有有效 12h 覆盖，30m 写到 5000：2000 按读取、3000 按 30m，USD 0.0077。

## 应用、缓存与历史语义

- 新目录为 2026-10-21，旧目录全部保留；cacheWriteUsdPerMillion 仍代表默认 30m，新增 cacheWrite12hUsdPerMillion 和 cacheWrite12hPricesByTier。
- billingRules.apiCacheWriteLifetimes 保存 API 范围、时长、字段和计费规则。availableFrom 记录 10-20 公告可用日；完整历史价格起止和时区未知，effectiveFrom 仍为 null。
- 当前本地会话数据没有可靠写入时长及分项数量；应用继续按标准短上下文快照重估，不自动叠加写入费、不把累计 Token 当请求级长上下文。
- 100 万输入含 80 万读取、10 万输出的 6.1 Sol 标准估值仍为 USD 1.48 / 37 credits。规则更新不影响已有金额。
- 会话缓存 6、SQLite 106 和原始额度索引 1 保持。仪表盘价格目录版本不匹配时重新汇总；切换新旧价格快照仅重算派生值并复用原始索引。

## 未解决证据与排除项

- Discovery API 5 / 0.5 / 25 已知，但 Codex 身份、credits、写入适用规则及生效日期未完整公布；维持未定价，不套用 Research。
- Research 的 10-05 生效及不适用写入规则不外推给 Discovery。5.5 Cyber 独立身份仍不足，不新增型号映射。
- Daybreak 弃用未指定替代映射，保留旧别名；5.5 退役不删除历史价格。
- 5.6 Sol 促销至少到 11-21，未出现替代费率；Sol Ultrafast 与 Cyber 长上下文保留已有 pending。
- API Changelog 的 Agents API 工具更新不改变本产品现有 token 口径。

## 验证和发布

- 核心远端已检查，最新 tag 与当前依赖均为 v0.2.0-dev.4；不修改共享核心。
- 执行完整构建、价格 / 用量 / 活动 / 额度估算 / 更新器 / 通知 / 对比 / 启动 / 签名政策回归及 git diff --check；结果在开发记录及发布验收中记录。

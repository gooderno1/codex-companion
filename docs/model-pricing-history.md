# 模型发布与计费历史

在本页搜索精确模型 ID 可查官方上线记录和项目首次收录的价格快照。按下方时间线打开任一快照，可查当时保存的单价和规则。索引覆盖 Codex 伴侣收录的模型。

## 模型何时上线

日期按官方公告的日历日记录。默认列 API 发布日；分批开放或受限开放在备注里标明。Codex 客户端和 API 有时分开上线。最后一列是该型号首次出现在本项目快照的 `rates` 中的日期。[OpenAI API 更新日志](https://developers.openai.com/api/docs/changelog) · [ChatGPT 与 Codex 更新日志](https://learn.chatgpt.com/docs/changelog)

| 模型 ID | API 公告日 | 开放范围或另一个已核实的节点 | 首份价格快照 |
| --- | --- | --- | --- |
| `gpt-6.1-terra` | 2026-10-26 | Codex 与 Work 同日开放 | [2026-10-27](../src/main/collectors/pricing-catalogs/2026-10-27.json) |
| `gpt-6.1-sol` | 2026-09-29 | API 发布 | [2026-09-30](../src/main/collectors/pricing-catalogs/2026-09-30.json) |
| `gpt-6-sol` | 2026-09-22 | API 发布 | [2026-09-23](../src/main/collectors/pricing-catalogs/2026-09-23.json) |
| `gpt-6-luna` | 2026-09-22 | API 发布 | [2026-09-23](../src/main/collectors/pricing-catalogs/2026-09-23.json) |
| `gpt-rosalind-research` | 2026-09-08 | 获批组织开放；API 从 10-05 开始计费 | [2026-10-08](../src/main/collectors/pricing-catalogs/2026-10-08.json) |
| `gpt-6-astra` | 2026-09-03 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.6-cyber` | 2026-08-07 | Daybreak Red 单独审批的 API 渠道 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.6-sol` | 2026-07-09 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.6-terra` | 2026-07-09 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.6-luna` | 2026-07-09 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.5` | 2026-04-24 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.4-mini` | 2026-03-17 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.4` | 2026-03-05 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.3-codex` | 2026-02-24 | Codex 于 02-05 开放，02-10 起 API 分批开放，02-24 记入 Responses API 发布日志 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.2-codex` | 2026-01-14 | Codex CLI 与 IDE 扩展于 2025-12-18 开放 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.2` | 2025-12-11 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5.1-codex-max` | 2025-12-04 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.1` | 2025-11-13 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.1-codex` | 2025-11-13 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5.1-codex-mini` | 2025-11-13 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |
| `gpt-5-codex` | 2025-09-23 | Codex 于 09-15 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `gpt-5` | 2025-08-07 | API 发布 | [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) |
| `codex-mini-latest` | 2025-05-15 | API 发布 | [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) |

## 按日期查费用和规则

快照中的 `rates` 按每百万 Token 分别列出普通输入、缓存读取和输出，API 用 USD，Codex 用 credits。后续快照还记录 `rules` 中的模型规则、`billingRules` 中的通用规则、`aliases` 中的别名映射和 `pending` 中的证据缺口。旧快照缺列或价格为 `null` 时按未知处理；历史保留价及其最近核对时间见对应快照的 `retainedCreditRates`。

| 快照（完整数据） | 本次收录或修订 | 查阅依据 |
| --- | --- | --- |
| [2026-11-14](../src/main/collectors/pricing-catalogs/2026-11-14.json) | 修正 Luna 澳大利亚、印度、日本地区准入与图像审批条件 | [v0.7.11 发布记录](../RELEASE_NOTES.md) |
| [2026-11-11](../src/main/collectors/pricing-catalogs/2026-11-11.json) | 补入七个型号的 API Fast 价格及 Luna 地区处理条件（地区条件见 11-14 修订） | [当次核查](model-pricing-2026-11-11.md) |
| [2026-11-05](../src/main/collectors/pricing-catalogs/2026-11-05.json) | 区分 GPT-5.6 Sol 促销期限：API 至 11-30，Codex credits 至少至 11-21 | [当次核查](model-pricing-2026-11-05.md) |
| [2026-10-29](../src/main/collectors/pricing-catalogs/2026-10-29.json) | 区分 GPT-6.1 Sol 套餐内长上下文豁免与 API 加价 | [当次核查](model-pricing-2026-10-29.md) |
| [2026-10-27](../src/main/collectors/pricing-catalogs/2026-10-27.json) | 补入 GPT-6.1 Terra 单价、缓存写入、长上下文及速度规则 | [当次核查](model-pricing-2026-10-27.md) |
| [2026-10-24](../src/main/collectors/pricing-catalogs/2026-10-24.json) | 修正 GPT-6 Sol 的 EU Fast 可用范围 | [当次核查](model-pricing-2026-10-24.md) |
| [2026-10-21](../src/main/collectors/pricing-catalogs/2026-10-21.json) | 区分 Responses API 的 30 分钟与 12 小时缓存写入费率 | [当次核查](model-pricing-2026-10-21.md) |
| [2026-10-09](../src/main/collectors/pricing-catalogs/2026-10-09.json) | 补入 GPT-6.1 Sol 的 Ultrafast 费率，区分套餐与购买 credits | [当次核查](model-pricing-2026-10-09.md) |
| [2026-10-08](../src/main/collectors/pricing-catalogs/2026-10-08.json) | 收录 Rosalind 标准价；API 10-05 起计费，credits 生效日未知 | [当次核查](model-pricing-2026-10-08.md) |
| [2026-09-30](../src/main/collectors/pricing-catalogs/2026-09-30.json) | 补入 GPT-6.1 Sol，区分 API 与 Codex 速度档位 | [当次核查](model-pricing-2026-09-30.md) |
| [2026-09-23](../src/main/collectors/pricing-catalogs/2026-09-23.json) | 补入 GPT-6 Sol、Luna 并重估旧缓存 | [当次核查](model-pricing-2026-09-23.md) |
| [2026-09-19](../src/main/collectors/pricing-catalogs/2026-09-19.json) | 补齐 GPT-5.6、早期 Codex 型号和已核实的 credits | [当次核查](model-pricing-2026-09-19.md) |
| [2026-09-17](../src/main/collectors/pricing-catalogs/2026-09-17.json) | 基线保留的标准价格；精确生效日期未知 | [研究规划](quota-capacity-pricing-research-plan-2026-09-17.md) |

例如，`gpt-6.1-terra` 于 2026-10-26 在 API 和 Codex 发布。打开 10-24 快照还查不到该型号；10-27 快照记录的 Standard 短上下文单价为每百万普通输入／缓存读／输出 USD 1／0.05／5，对应 Codex credits 25／1.25／125。两边完整费率的精确生效时刻仍未知。[当次核查与官方来源](model-pricing-2026-10-27.md)

开发版桌面入口为 **额度估算 → 模型计费历史**。选择型号可查看 API 公告日、开放范围、首次收录价格及历次单价和规则变化。通用规则单独列出，页面可离线查阅。

要用历史快照估算自己的用量，在桌面端打开 **额度估算 → 价格口径 → 固定快照重估**，选择 **价格快照** 后点击 **应用筛选**。保持时间范围相同并切换快照，就能比较两种费率对同一段用量的影响。「按当时价格」依赖有明确生效区间的证据，缺少证据的用量会标为未定价。

## 记录如何延续

确认模型上线时，记录精确 ID、API 或 Codex 等开放渠道、官网公告日期与来源。确认费率或规则变化时，在时间线追加快照、适用范围和核查依据；在来源明确时另记生效日、促销截止日或已承诺的最短期限。更正保留旧快照，在新行指明取代的旧结论。项目安装包的发布日期另见[正式发布记录](../RELEASE_NOTES.md)。

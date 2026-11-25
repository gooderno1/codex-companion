# 2026-11-25 模型计费核查

OpenAI 在 Codex 定价页补列 GPT-6 Rosalind Research 和 GPT-5.5 Rosalind Discovery。复核 API 专用配置表、两份 Work/Codex 价目表和发布公告后，补齐五个精确模型 ID 的标准价。原 25 个型号维持既有费率。

| 模型 ID | API USD | Codex credits |
| --- | --- | --- |
| `gpt-6-rosalind` | 10 / 1 / 50 | 250 / 25 / 1250 |
| `gpt-rosalind-discovery` | 5 / 0.5 / 25 | 125 / 12.5 / 625 |
| `gpt-6-cyber` | 20 / 2 / 100 | 500 / 50 / 2500 |
| `gpt-6-astra-law` | 10 / 1 / 50 | 250 / 25 / 1250 |
| `gpt-6.2-astra-law` | 8 / 0.4 / 40 | 200 / 10 / 1000 |

以上为每百万 Token 的普通输入、缓存读取、输出，按精确 ID 匹配。GPT-5.5 Rosalind Research 对应已收录的 `gpt-rosalind-research`，原 USD 5 / 0.50 / 25 与 credits 125 / 12.5 / 625 维持原值。Daybreak Red 的既有别名仍保留原证据对应关系。专用配置各自独立计价。

- GPT-6 Rosalind 和两种 Law 配置现行促销至少到 2026-12-31。未公布后续费率或确切终止时刻。GPT-6 Rosalind 的独立 FedRAMP 端点适用 API 10% 加价。
- API 表中的 30 分钟、12 小时写入及长上下文费率按实际发布字段记录。Cyber 明确按单请求输入超过 272000 Token 计长上下文，长上下文写入价仍未知。其他专用模型的长上下文条件仅记录已核实部分。企业价目表明确 GPT-6 Cyber 不支持 Codex Fast / Ultrafast，GPT-6.2 Astra Law 上线仅支持 Standard。没有公开费率的档位保持未知。
- 获批组织的费率和技术可用范围由对应服务及合约决定。API USD、Codex credits 及企业 USD 适用口径分别复核。缓存写入、长上下文和端点加价保留为规则资料。账本按标准短上下文快照重估。
- 11-25 是首次收录与核对日，各型号的价格生效日仍未知。旧快照原样保留，按当时费率模式仍返回未定价。GPT-5.6 Sol 现价未变。
- Healthcare 四个精确 ID 本次官方公告仅确认 Responses API，暂无 Codex 适用证据。Sites 托管计划按请求和存储另计，免费期调整至 2027-01-31。二者不计入本机 Codex Token 估值。
- 两处 API 定价表一致，原七个常规档位表和七个旧 Codex 模型价卡复核无数值变化。独立模型页缺失时，以 API 专用价格表、官方发布公告或 Help Center 的精确身份及两份 Work/Codex 价目表交叉核对。
- 会话成本缓存从 8 升至 9，活动 SQLite 从 108 升至 109，额度原始索引仍为 1。以 100 万输入（80 万为缓存读取）和 10 万输出为例，GPT-6 Rosalind 为 USD 7.80 / 195 credits，Discovery 为 USD 3.90 / 97.5 credits。缺历史生效证据时只按所选快照估值。核心包仍为远程 tag v0.2.0-dev.4。

[API 定价](https://developers.openai.com/api/docs/pricing) · [Platform 镜像](https://platform.openai.com/docs/pricing) · [Codex Pricing](https://learn.chatgpt.com/docs/pricing) · [Codex Speed](https://learn.chatgpt.com/docs/agent-configuration/speed) · [企业 credits](https://help.openai.com/en/articles/11481834-chatgpt-rate-card-business-enterpriseedu-credit-based-pricing) · [企业 USD](https://help.openai.com/en/articles/20001415-chatgpt-rate-card-enterprise-token-based-pricing) · [发布日志](https://help.openai.com/en/articles/9624314-model-release-notes) · [Rosalind 型号说明](https://help.openai.com/en/articles/20001193-gpt-rosalind-for-life-sciences-research) · [GPT-6 Cyber 详情](https://developers.openai.com/api/docs/models/gpt-6-cyber) · [API 更新日志](https://developers.openai.com/api/docs/changelog) · [Astra Law 公告](https://openai.com/index/astra-for-law/) · [Astra 6.2 Law 公告](https://openai.com/index/astra-law-6-2/).

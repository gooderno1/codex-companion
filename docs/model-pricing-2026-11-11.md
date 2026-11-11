# GPT-6 Luna 区域处理与 API Fast 费率（2026-11-11）

在澳大利亚、印度和日本，启用零数据保留的组织可以在当地项目中为 GPT-6 Luna 使用 Standard 按量区域处理。Responses 和 Chat Completions 支持文本或图像输入及文本输出，托管工具不可用。区域处理沿用 API 定价页的 10% 附加费。官方未给出精确生效时间。[区域处理指南](https://developers.openai.com/api/docs/guides/your-data) · [API 定价](https://developers.openai.com/api/docs/pricing)

## 已支持模型的 Fast 费率

以下是 11 月 11 日核实并补入快照的既有 API 费率。Fast 与 Priority 指同一档位。表中金额为每百万 token 的美元价格，其中 GPT-5.5 和 GPT-5.4 使用短上下文列。[API 定价](https://platform.openai.com/docs/pricing) · [Fast 指南](https://developers.openai.com/api/docs/guides/fast-mode)

| 模型 ID | 输入 | 缓存读 | 输出 |
| --- | ---: | ---: | ---: |
| gpt-5.5 | 12.5 | 1.25 | 75 |
| gpt-5.4 | 5 | 0.5 | 30 |
| gpt-5.4-mini | 1.5 | 0.15 | 9 |
| gpt-5.2 | 3.5 | 0.35 | 28 |
| gpt-5.1 | 2.5 | 0.25 | 20 |
| gpt-5 | 2.5 | 0.25 | 20 |
| gpt-5.3-codex | 3.5 | 0.35 | 28 |

账本和额度估算的固定快照仍使用标准短上下文价。会话缺少可核实的地区、服务档位和请求边界时，不能据此施加溢价。11-05 及以前的快照可在额度估算中选择。历史模式继续要求可核实的生效时间。

例如，GPT-6 Luna 的标准输入价格为每百万 token 0.10 美元。满足区域按量条件时，对应输入为 0.11 美元；只有模型名与 token 数的账本记录仍按 0.10 美元估值。七项 Fast 价格仅适用于表中精确型号。

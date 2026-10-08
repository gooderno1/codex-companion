# 2026-10-08 Rosalind 定价维护

- 基线：正式版 v0.7.2，main c671b58；目标 v0.7.3，开发版本 v0.7.3-dev.1。
- 非官方 Codex 桌面伴侣；本次仅维护模型定价与派生缓存，不扩展页面或共享解析。
- 已实际打开 Codex Pricing / Speed、API Pricing、API / Codex 模型目录、21 个既有模型与 Daybreak 详情、缓存 / Fast / Ultrafast 指南；旧 Codex 模型补查 HTML 价格表。

## 已生效标准费率

每百万 Token，顺序为普通输入 / 缓存读取 / 输出。

| 模型 ID | API USD | Codex credits |
| --- | --- | --- |
| gpt-rosalind-research | 5 / 0.50 / 25 | 125 / 12.5 / 625 |

- [API Pricing](https://developers.openai.com/api/docs/pricing) 和 [官方 Changelog](https://developers.openai.com/api/docs/changelog) 均明确 API 从 2026-10-05 开始计费；本次核对日 10-08 已过该日期，移出新目录 pending。
- [Codex Pricing](https://learn.chatgpt.com/docs/pricing) 独立确认 credits；不从 API USD 推算，不将 API 生效日套入 credits。
- API 官方明确 cache-write pricing 不适用；用状态 not-applicable 表示，价格字段为 null，不伪填 0。
- Access 限 trusted-access 批准的内部生命科学研究；不据此推断当前账户具备权限。
- 独立模型详情地址返回 404，模型目录也未列出该项；API Pricing 与 Changelog 已共同确认精确 ID、三项必要费率及开始日期。无官方别名证据，不新增 gpt-rosalind 等模糊别名。
- Fast / Priority / Ultrafast、长上下文及地区专属规则未确认；保持未知，不套用其他模型倍率。当前估值仅用已确认 Standard 输入 / 缓存读取 / 输出。

## 历史语义

- 新目录为 2026-10-08，保留全部旧目录；09-30 快照中 Rosalind 仍未定价，其 future 审计记录不改写。
- API 生效日期记录在 Rosalind 模型规则，精度为 date，未公布时区；不得将整个目录 effectiveFrom 设置为 10-05。
- 固定快照模式按所选价重估全部历史，仅表示等价成本。10-05 前的历史记录也可按新快照比较，不能称为当时账单或免费使用。
- 本次不扩展逐模型历史生效区间解析；historical 模式继续要求目录级完整历史证据，没有该证据仍返回未定价。官方日期保留供后续更精细结算使用。
- 21 个既有模型标准价、官方别名和已记录倍率不变。5.4 / mini 保留旧 credits 证据；Cyber 长上下文冲突及未公开的 Ultrafast 价格保持 pending。
- Sol “典型任务 2–15 credits”属经验描述，不能当每百万 Token 单价。促销至少到 11-21，不自动终止；图片工具费率仍在现有产品范围外。

## 缓存与验证

- 普通会话缓存 5→6，SQLite user_version 105→106，源文件未变时也重算旧未定价结果；仪表盘拒用旧目录版本。
- 额度估算原始索引继续复用；切换快照只重算金额，旧目录仍为未定价，Token 守恒。
- 样例：100 万输入含 80 万缓存、10 万输出 → USD 3.90 / 97.5 credits；全缓存 100 万输入 → USD 0.50 / 12.5 credits。
- SQLite 样例：180 输入 Token → USD 0.0009 / 0.0225 credits，旧未定价索引升级后重估，随后恢复复用。
- 已核查远程核心最新 tag v0.2.0-dev.4，保持该远程依赖；不改共享解析 / reset。
- 验证：npm run build、verify:usage、verify:activity、verify:estimation、verify:updater、verify:notifications、verify:comparisons、verify:startup、verify:signing-policy、git diff --check。准确执行和发布结果见开发记录。

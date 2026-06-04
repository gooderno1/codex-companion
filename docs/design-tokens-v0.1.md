# Codex Companion 设计 Token（v0.1）

- 创建时间：2026-06-04
- 对应开发版本：`v0.2.2-dev.52`
- 设计基准：`docs/assets/design/v0.3.3/overview-natural-time.png`
- 代码来源：`src/renderer/design-tokens.ts`
- 应用入口：`src/renderer/main.tsx` 调用 `applyDesignTokens()`
- 校验命令：`npm run verify:design`

## 1. 目标

本文件用于把设计图中的颜色、圆角、间距和字体层级沉淀为可维护 token，避免后续页面继续靠截图目测临摹。

当前阶段不引入复杂 token 构建系统，先采用轻量规则：

- `src/renderer/design-tokens.ts` 是运行时 CSS 变量的唯一入口。
- `src/renderer/styles.css` 通过 `var(--token-name)` 使用 token。
- 新增 CSS token 必须先进入 `design-tokens.ts`。
- 涉及颜色、圆角、字体和核心间距变化时，必须同步更新本文件或 UI Contract。

## 2. 核心 Token

### 2.1 背景与表面

| Token | 当前值 | 用途 |
| --- | --- | --- |
| `--bg-canvas` | `#f8fbff` | 页面浅蓝白背景 |
| `--bg-veil` | `rgba(255, 255, 255, 0.99)` | 壳层白色透底 |
| `--surface-primary` | `rgba(255, 255, 255, 0.99)` | 主卡片表面 |
| `--surface-strong` | `#ffffff` | 强白底 |
| `--surface-muted` | `rgba(248, 251, 255, 0.84)` | 弱卡片表面 |

### 2.2 文字

| Token | 当前值 | 用途 |
| --- | --- | --- |
| `--text-primary` | `#111827` | 主标题、主数字 |
| `--text-secondary` | `#334155` | 正文、表格正文、普通按钮 |
| `--text-tertiary` | `#64748b` | 副标题、表头、页脚 |
| `--text-muted` | `#94a3b8` | 证据、定价来源、低权重说明 |

### 2.3 强调色

| Token | 当前值 | 用途 |
| --- | --- | --- |
| `--accent-blue` | `#0f6fff` | 主蓝、当前态、5H 额度 |
| `--accent-teal` | `#12b8d7` | 蓝色渐变辅助 |
| `--accent-green` | `#16a34a` | 成功、周额度、正向变化 |
| `--accent-amber` | `#d97706` | 警告 |
| `--accent-rose` | `#dc2626` | 风险、负向变化 |

### 2.4 圆角、间距与字体

| Token | 当前值 | 用途 |
| --- | --- | --- |
| `--radius-shell` | `18px` | 应用壳层 |
| `--radius-panel` | `18px` | 大分区卡 |
| `--radius-card` | `18px` | 卡片 |
| `--radius-pill` | `999px` | 胶囊标签 |
| `--space-1` 到 `--space-8` | `4px` 到 `28px` | 组件间距 |
| `--font-sans` | `Segoe UI Variable Display` 等 | 页面主字体 |
| `--font-mono` | `Cascadia Mono` 等 | 数字明细和等宽值 |

## 3. 可执行校验

执行：

```bash
npm run verify:design
```

校验内容：

- `styles.css` 中所有 `var(--*)` 引用必须存在于 `design-tokens.ts`。
- 核心颜色、圆角和间距 token 不得意外偏离当前 UI Contract。
- `design-tokens.ts` 必须导出 `applyDesignTokens()`，确保运行时真正注入 CSS 变量。
- 组件局部变量不纳入全局 token，例如 `--app-scale`、`--quota-accent`、`--quota-accent-end` 和 `--quota-progress`；这些变量只能在对应组件或运行时计算中使用。

## 3.1 `v0.2.2-dev.47` 细节修正

本轮按 `v0.3.3` 总览页设计图对齐细节，重点处理色阶而不是重排页面：

- 主文字从纯黑倾向收敛为 `#101828`，保留强信息层级，但减少截图中的黑色压迫感。
- 正文与表格值统一到 `#344054`，避免所有非主标题文字都显得过浅或偏蓝。
- 页脚、证据、定价来源统一使用更弱的 `#8a97a8`，降低底部辅助信息权重。
- 主描边与强描边降低蓝色透明度，卡片更接近设计图的白底浅线框，而不是偏蓝的浮层块。
- 状态绿、警告橙、风险红轻微降饱和，优先服务工作型仪表盘，不做营销式高亮。

本校验不替代人工视觉对照。它只防止 token 漏定义和关键视觉变量意外漂移；页面密度、分区比例和真实截图仍按 `docs/design-review/overview-visual-measurement-v0.1.md` 验收。

## 3.2 `v0.2.2-dev.51` 色阶细化

基于 `dev50` 截图与 `v0.3.3` 设计稿复核，本轮继续把颜色差异从“整体方向正确”推进到组件级色阶：

- 页面背景从 `#f7faff` 微调为 `#f8fbff`，减少大面积偏蓝感。
- 主文字改为中性深墨 `#111827`，正文改为 `#334155`，辅助说明改为 `#64748b`，证据和定价来源改为 `#94a3b8`。
- 主蓝改为 `#0f6fff`，与设计稿中导航激活、页级切换和指标图标的蓝色更接近。
- 成功、警告、风险色改为更常规的工作台色值，避免状态文字看起来过暗或偏灰。
- 左侧激活导航底色降低蓝色透明度，保持当前页明确但不形成厚重蓝块。

## 3.3 `v0.2.2-dev.52` 顶部组件位置修正

本轮不调整全局颜色 token，重点把已有 token 用到更正确的组件位置上：

- 顶部四卡状态标签继续沿用 `status-*` 色阶，但位置固定到右上角，避免用独立底行增加视觉负担。
- 顶部四卡内容区使用现有文字 token 居中展示，主数字仍使用 `--text-primary`，变化说明按正负沿用状态色。
- 指标图标仍使用 `--accent-blue / --accent-teal / --accent-green` 渐变，但尺寸改为自适应，防止不同窗口下图标与数字比例失衡。
- 顶栏时间视角仍使用无边框文本切换，不新增颜色 token；位置由三列布局保证居中。

## 4. 后续页面规则

Codex 账本页、代码仓库页和设置页开发前必须先复用本 token 集合。若某页面需要新 token，应遵守：

- 先补文档和 `design-tokens.ts`。
- 再改组件样式。
- 执行 `npm run verify:design`。
- 生成该页面的 `1360 x 900` 与 `1080 x 720` 真实 Electron 截图。

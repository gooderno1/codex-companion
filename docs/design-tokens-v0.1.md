# Codex Companion 设计 Token（v0.1）

- 创建时间：2026-06-04
- 对应开发版本：`v0.2.2-dev.39`
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
| `--bg-veil` | `rgba(255, 255, 255, 0.97)` | 壳层白色透底 |
| `--surface-primary` | `rgba(255, 255, 255, 0.97)` | 主卡片表面 |
| `--surface-strong` | `#ffffff` | 强白底 |
| `--surface-muted` | `rgba(248, 251, 255, 0.88)` | 弱卡片表面 |

### 2.2 文字

| Token | 当前值 | 用途 |
| --- | --- | --- |
| `--text-primary` | `#111827` | 主标题、主数字 |
| `--text-secondary` | `#475569` | 正文、表格正文、普通按钮 |
| `--text-tertiary` | `#64748b` | 副标题、表头、页脚 |
| `--text-muted` | `#7c8ca3` | 证据、定价来源、低权重说明 |

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

本校验不替代人工视觉对照。它只防止 token 漏定义和关键视觉变量意外漂移；页面密度、分区比例和真实截图仍按 `docs/design-review/overview-visual-measurement-v0.1.md` 验收。

## 4. 后续页面规则

Codex 账本页、代码仓库页和设置页开发前必须先复用本 token 集合。若某页面需要新 token，应遵守：

- 先补文档和 `design-tokens.ts`。
- 再改组件样式。
- 执行 `npm run verify:design`。
- 生成该页面的 `1360 x 900` 与 `1080 x 720` 真实 Electron 截图。

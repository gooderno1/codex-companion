# DEVELOPMENT LOG

## [2026-06-02] v0.2.0-dev.1 feat: 完成首版可运行 Codex Companion 桌面实现

- 开发原因：用户要求按照既有规划正式进入实施阶段，从空仓库落地首版桌面应用、数据采集、三页界面和桌面挂件。
- 实现方式：建立 `Electron + React + TypeScript + Vite` 项目骨架；实现主进程窗口管理、挂件预设与本地设置持久化；实现 Codex session / `rate_limits` 解析、Git 仓库扫描与代码活动聚合；实现总览页、账本页、代码仓库页、顶部挂件与极简胶囊；补充 `README`、隐私说明、路线图、贡献指南、Issue 模板和 `docs/data-contract-v0.2.md`；同步回写规划状态。
- 当前结果：仓库已具备可构建、可启动的首版桌面应用，能够基于本机 Codex 与 Git 数据展示额度、Token、成本价值和仓库归因；项目对外文档已明确非官方定位与 local-first 隐私边界。
- 验证方式：执行 `git pull --rebase origin main`、`npm run typecheck`、`npm run lint`、`npm run build` 与 `npm start` 启动验证；运行期曾发现 Electron 入口路径错误，已修正为 `dist-electron/main/index.js` 后重新确认主窗口正常拉起。

## [2026-06-02] v0.1.0-dev.1 docs: 初始化 Codex Companion 项目规划

- 开发原因：用户已创建 `gooderno1/codex-companion` 仓库，并要求在本地 `MyCode` 目录下建立项目文件夹，参考 DevLedger 的协作规范先写项目 `AGENTS.md`，第一步先撰写项目开发规划文件。
- 实现方式：克隆远端仓库到本地 `codex-companion` 目录；新增 `AGENTS.md`，将 DevLedger 的协作规范调整为 Codex 专用桌面应用语境；新增 `docs/project-development-plan-2026-06-02.md`，明确产品定位、页面规划、挂件规划、数据架构、技术路线、隐私边界和阶段实施顺序。
- 当前结果：项目已有初始协作规范、开发记录和第一版正式规划文档，尚未进入桌面应用代码实现。
- 验证方式：已执行 `git status`、`git ls-remote`、仓库克隆、初始文件检查和 `git diff --check`；本轮尚未建立构建脚本，因此未执行构建。

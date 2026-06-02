# Changelog

> Brief bilingual highlights. For detailed technical history (in Chinese), see [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md).
>
> 双语精简版。详细技术日志（含 Bug 三段式与设计决策）见 [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md)。

This project follows [Semantic Versioning](https://semver.org/).

---

## v1.14 — Reactive URL Routing · 响应式 URL 路由
*2026-06-02 · v1.14.0*

**EN**
- 🔗 SPA now reacts to `?path=<absPath>` URL changes — paste a new link, file switches instantly
- 🔄 Two-way sync: clicking a file in the tree updates URL via `replaceState` — every URL is shareable
- 🚀 First-load priority: URL `?path=` beats session restore (link wins over last-opened)
- 🐛 **Fix: link sharing & cross-tool preview was broken** — pasting a DocCenter URL into IDE preview / browser tab kept showing the previously opened file instead of the target one

**中文**
- 🔗 SPA 现在响应 URL `?path=<绝对路径>` 变化——粘贴新链接，文件立刻切换
- 🔄 双向同步：点击侧栏文件会通过 `replaceState` 同步到 URL——任何打开的 URL 都可以分享/收藏
- 🚀 首次加载优先级：URL `?path=` 优先于 session restore（链接直达 > 上次打开）
- 🐛 **修复链接分享 / 跨工具预览失效** —— 之前粘贴 DocCenter URL 到 IDE 预览或新标签时一直显示旧文件而非目标文件

**👤 用户故事**
- **场景**：Louis 让 AI 助手生成多份 HTML 报告，AI 每次贴一条 `http://localhost:9901/?path=...` 链接到对话里
- **之前**：CodeBuddy 内置浏览器是单实例，已经开了 9901 标签后再点新链接，URL 变了但 SPA 不响应——视觉上还是旧文件，体感"链接坏的"
- **现在**：粘贴新链接 / 内置浏览器导航 / 浏览器前进后退 都会触发 `tryOpenFromUrl` 重读 `?path=` 并切到对应文件
- **一句话**：链接终于真的是"链接"了，不再是"装饰"

**🐛 Bug 三段式：URL 参数变化无响应**
- **问题**：`http://localhost:9901/?path=A.html` 已打开后，访问 `?path=B.html` 不会切到 B
- **根因**：app.js 完全没有 URL 参数解析逻辑——`init()` 直接走 `tryRestoreLastSession`（恢复上次会话），从未读过 `window.location.search`。原 memory 描述"用 ?path= 能定位文件"是局部正确（首次加载时 server 没传 path 给前端，但前端 SPA 自己也没解析），切换文件场景完全失效
- **解法**：新增 `tryOpenFromUrl()` 函数，三处接入：(1) `init()` 启动时优先调用，失败再 fallback 到 session restore；(2) `popstate` 事件监听器（覆盖浏览器前进/后退）；(3) `openFile()` 内通过 `history.replaceState` 反向同步 URL，让用户点侧栏切文件后 URL 也跟着更新

**📐 改动细节**
- `web/app.js` 三处修改（约 +60 行 -2 行）：
  - L1395-1410：`openFile()` 内新增 URL 同步逻辑（`replaceState` 不触发 popstate，避免循环）
  - L1525-1550：新增 `tryOpenFromUrl()` 函数（HEAD 请求 `/api/file` 探活后才加载，403/404 自动降级）
  - L2648-2656：`init()` 改造 + popstate 监听器
- 自验：HEAD 探活避开了 scan_root 外路径误打开，错误路径直接静默 fallback
- 零侵入：所有现有逻辑（侧栏点击 / 收藏夹 / 最近打开 / session 恢复）行为完全不变

---

## v1.13 — Markdown Three-View · Markdown 三视图
*2026-05-17 → 2026-05-27 · v1.13.0 → v1.13.2*

**EN**
- 📝 Three view modes for `.md` files: **Source / Split / Preview**, one-click switch in header
- ⇔ **Drag-resize splitter** between editor and preview (10%–90%, with `col-resize` cursor & gold hover)
- 🔗 **Open in new tab** option in file context menu (for side-by-side reading)
- 💾 View mode and split ratio persist in `localStorage` per browser
- 🌍 Toolbar fully bilingual (syncs with main app language)
- 🛡 Zero npm dependency, all logic inlined in the md shell
- 🐛 **Fix sidebar double-render bug** (v1.13.2): when a new directory + N files appear together in auto-refresh diff, files no longer show twice (ancestor-pruning in `diffTreeAndPatch`)

**中文**
- 📝 Markdown 文件三种视图：**仅原文 / 分栏 / 仅预览**，顶部一键切换
- ⇔ 编辑器和预览之间可**拖拽分栏条**调整宽度（10%–90%，金色高亮反馈）
- 🔗 文件右键菜单新增「**在新标签页打开**」（方便多文件对比阅读）
- 💾 视图模式和分栏比例记到浏览器 `localStorage`
- 🌍 工具栏支持双语，跟随主侧栏语言切换
- 🛡 零 npm 依赖，所有逻辑内联到 md 壳子页面
- 🐛 **修复侧栏双重渲染 Bug**（v1.13.2）：新建目录+多文件场景下自动刷新不再让文件出现两次（`diffTreeAndPatch` 加祖先剪枝）

---

## v1.12 — Bilingual UI · 双语界面
*2026-05-14 · v1.12.0 → v1.12.1*

**EN**
- 🌍 English UI by default; click `中文` in sidebar to switch to Chinese
- ⌨️ Full coverage: menus, dialogs, toasts, shortcuts panel, time machine, history drawer
- 💾 Language preference persists in `localStorage`
- 🔧 Hand-written ~100-LoC i18n engine, zero npm dependency

**中文**
- 🌍 默认英文界面，侧栏底部一键切换中文
- ⌨️ 全覆盖：菜单 / 弹窗 / Toast / 快捷键面板 / 时光机 / 历史抽屉
- 💾 语言选择记住到 `localStorage`
- 🔧 手写约 100 行 i18n 引擎，零 npm 依赖

---

## v1.11 — Sidebar 3-Tab + Time Machine + Notion Image · 侧栏重构
*2026-05-13 → 2026-05-14 · v1.11.0 → v1.11.11*

**EN**
- 📂 Three-tab sidebar: Tree / Favorites / Recent
- ⏱ Time machine quick bar — jump back N minutes / hours / days
- 🗜 Snapshot gradient thinning (avoid timeline explosion)
- 🎨 Rich-text toolbar upgrade: full color palette, alignment, link insertion
- 🖼 Notion-style image manipulation: 4-corner resize, drag-in-flow
- 🌓 Adaptive UI for narrow screens
- 🍞 Breadcrumb path with one-click copy

**中文**
- 📂 三 Tab 侧栏：目录 / 收藏 / 最近
- ⏱ 时光机快捷条 —「回到 N 分钟前」一键穿越
- 🗜 快照梯度稀释，避免时间线爆炸
- 🎨 富文本工具栏：完整色板 + 对齐 + 链接
- 🖼 Notion 式图片操纵：4 角 resize + 段内拖拽
- 🌓 窄屏自适应
- 🍞 面包屑路径一键复制

---

## v1.10 — Auto-Refresh + History Drawer + Dark Mode · 自动刷新与时间线
*2026-05-10 → 2026-05-13 · v1.10.0 → v1.10.11*

**EN**
- 🔄 Tree auto-refresh (no more manual reload button)
- 🕰 Version timeline (History Drawer) with line-level diff
- ↩ Restore any snapshot with auto pre-restore backup
- 🎯 Snapshot management panel + iframe loading fallback
- ⌨️ Global keyboard shortcuts (H / R / / / ?)
- 🔍 Search upgrade: path snippets, hit highlighting, match counts
- 🌃 Dark theme (auto / light / dark)
- 📋 Breadcrumb file metadata
- 📌 Recent Files

**中文**
- 🔄 目录树自动刷新，告别手动按 🔄
- 🕰 版本时间线（History Drawer）+ 行级 diff
- ↩ 一键恢复任意快照，自动备份当前版本
- 🎯 快照管理面板 + iframe 加载失败兜底
- ⌨️ 全局快捷键（H / R / / / ?）
- 🔍 搜索升级：路径片段 + 命中高亮 + 匹配数
- 🌃 暗色主题（auto / light / dark）
- 📋 面包屑文件元信息
- 📌 最近打开

---

## v1.9 — Block Layout + contenteditable Hardening · 排版能力与稳定性
*2026-05-06 → 2026-05-07 · v1.9.0 → v1.9.5*

**EN**
- 🧱 Block-level layout: gaps & rhythm fixer
- 🛡 Hardened contenteditable to prevent SVG/Enter pollution
- 🔧 Sidebar drag fix + Enter key behavior correction
- 🧹 Batch cleanup script for legacy files

**中文**
- 🧱 块级布局：块间距 + 节奏修复器
- 🛡 contenteditable 污染根治（SVG / Enter 保护）
- 🔧 侧边栏拖拽修复 + 正文 Enter 键行为修正
- 🧹 历史文件批量清理脚本

---

## v1.8 — HTML Editing Boost · 编辑增强
*2026-05-03 · v1.8.0 → v1.8.2*

**EN**
- 🖼 Image insertion / replacement
- 🔠 Font size & color
- 🎯 Selection-preserving annotation (no more lost cursor)

**中文**
- 🖼 图片插入 / 替换
- 🔠 字号 + 字色
- 🎯 选区保留批注（不再丢光标）

---

## v1.7 — Drag-and-Drop + ETag · 拖拽移动与缓存
*2026-05-02 → 2026-05-03 · v1.7.0 → v1.7.4*

**EN**
- 🖱 Drag-and-drop to move files / folders (cross-root supported)
- 📦 CHANGELOG architecture refactor (single source of truth)
- 🔧 ETag-based cache invalidation, eliminating stale tree

**中文**
- 🖱 拖拽移动文件 / 目录（支持跨根）
- 📦 CHANGELOG 架构重构（单一数据源）
- 🔧 ETag 缓存根治，消除陈旧目录树

---

## v1.6 — Sort + Favorites + Disabled Sinking · 信息层级
*2026-05-02 · v1.6.0 → v1.6.1*

**EN**
- ⭐ File favorites (pinned to top)
- 🔢 Tree sorting (name / time / size)
- 📉 Disabled scan roots sink to bottom

**中文**
- ⭐ 文件收藏（顶部置顶）
- 🔢 目录排序（名称 / 时间 / 大小）
- 📉 禁用扫描根沉底

---

## v1.5 — Settings Panel · 设置面板
*2026-05-02 · v1.5.0*

**EN**
- ⚙️ Settings panel: scan roots, snapshot debounce, retention days
- 🔧 Three fixes (add / toggle / remove flow)

**中文**
- ⚙️ 设置面板：扫描根 / 快照节流 / 保留天数
- 🔧 添加 / 启停 / 移除三连修复

---

## v1.4 — Scan Root Toggle · 扫描根开关
*2026-04-20 → 2026-04-27 · v1.4.0 → v1.4.2*

**EN**
- 🎚 Per-root scan enable/disable
- 🔁 Add-directory deduplication & instant feedback
- 💬 Annotation feedback + cache refresh fix

**中文**
- 🎚 单个扫描根可开关
- 🔁 添加目录去重 + 即时反馈
- 💬 批注反馈 + 缓存刷新修复

---

## v1.3 — Markdown Support · Markdown 渲染
*2026-04-19 · v1.3.0*

**EN**
- 📝 Native Markdown rendering inside DocCenter (browse `.md` files like HTML)

**中文**
- 📝 原生 Markdown 渲染（像浏览 HTML 一样浏览 `.md`）

---

## v1.2 — First Public Release · 首次公开发布
*2026-04-18 · v1.2 → v1.2.6*

**EN**
- 🚀 Snapshot system: stop typing 2s → auto snapshot to `_auto-save/`
- 💾 Three-choice save dialog: overwrite / save-as / discard
- 📐 Sidebar tree + iframe content area
- 🎨 Editor toolbar (B / I / U / highlight / red / undo / redo)
- 🛡 Path safety: `_resolve_safe()` guards every I/O
- 🔧 Dirty-state false positive fix (3 guard rails)

**中文**
- 🚀 快照系统：停手 2s → 自动写入 `_auto-save/`
- 💾 三选项保存对话框：覆盖 / 另存 / 丢弃
- 📐 侧栏树 + iframe 内容区
- 🎨 编辑器工具栏（B / I / U / 高亮 / 红字 / undo / redo）
- 🛡 路径安全：所有 I/O 必经 `_resolve_safe()`
- 🔧 脏状态误报修复（3 道护栏）

---

## v1.0 → v1.1 — Genesis · 起点
*2026-04-18*

**EN**
- 📁 First working version: aiohttp backend, port 9901, scan workspace HTML
- 🔌 Inject `saver-runtime.js` into iframe for in-place editing

**中文**
- 📁 首个能跑的版本：aiohttp 后端 / 端口 9901 / 扫描 workspace HTML
- 🔌 向 iframe 注入 `saver-runtime.js` 实现就地编辑

---

[Detailed history with technical notes →](docs/CHANGELOG-detailed.md)

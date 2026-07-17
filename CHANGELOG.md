# Changelog

> Brief bilingual highlights. For detailed technical history (in Chinese), see [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md).
>
> 双语精简版。详细技术日志（含 Bug 三段式与设计决策）见 [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md)。

This project follows [Semantic Versioning](https://semver.org/).

---

## v1.19.0 — Finder-style Modal + Editable Drag-and-Drop

*2026-07-17 · v1.19.0*

**EN**
- 🎯 **New: "Open file" button** — click 📂 in sidebar (or 📄 Open a file on welcome page) to browse and open any HTML/Markdown file on your disk. Selected files are editable (not preview-only) and added to "Recent" list.
- 🖼️ **Finder-style dual-pane modal** — both "Add folder" and "Open file" now use a redesigned dual-pane modal: left sidebar (Shortcuts / Pinned / Recent) + right main area with Today/Earlier time grouping. Replaces the old single-column list.
- ✏️ **Drag-and-drop is now editable** — previously drag-in was preview-only (no saver-runtime.js injection). Now dropped files are uploaded to `_dropbox/` server-side and opened via the full `openFile()` pipeline, with 2-second auto-snapshot and 2-choice close dialog (Save as / Discard).
- 🕐 **"Recent" sidebar tab populated** — was empty since v1.10.7 because no entry button existed. Now shows up to 20 recently opened files (localStorage persisted, bumped from 10 to 20).
- 🔧 **Backend**: `GET /api/browse?mode=file` (returns files array with size/mtime), `POST /api/drag-upload` (multipart, 10MB limit, .html/.htm/.md only), `POST /api/save-as` (with overwrite support), `_dropbox/` 7-day auto-cleanup on startup.
- 🧪 **Test infrastructure**: pytest + aiohttp TestClient, 18 backend tests covering all new endpoints + backward compatibility.

**中文**
- 🎯 **新增"打开文件"按钮** — 侧栏 📂 或 welcome 页 📄 打开文件，可浏览并打开磁盘上任意 HTML/Markdown 文件。选中的文件可编辑（非预览），并加入"最近打开"列表。
- 🖼️ **Finder 风格双栏 modal** — "添加文件夹"和"打开文件"统一升级为双栏 modal：左侧栏（快捷入口/已固定/最近打开）+ 右侧主区按今天/更早时间分组。替换旧的单栏列表。
- ✏️ **拖入文件可编辑** — 之前拖入只能预览（无 saver-runtime.js 注入）。现在拖入文件上传到 `_dropbox/` 服务端，走完整 `openFile()` 流程，含 2 秒自动快照 + 关闭时二选一（另存为/丢弃）。
- 🕐 **"最近打开"侧栏 tab 填充** — 自 v1.10.7 起一直为空（因为没有"打开文件"入口）。现在显示最近 20 个打开的文件（localStorage 持久化，从 10 提升到 20）。
- 🔧 **后端**：`GET /api/browse?mode=file`（返回 files 数组含 size/mtime）、`POST /api/drag-upload`（multipart，10MB 限制，仅 .html/.htm/.md）、`POST /api/save-as`（支持覆盖）、`_dropbox/` 启动时 7 天自动清理。
- 🧪 **测试基础设施**：pytest + aiohttp TestClient，18 个后端测试覆盖所有新 endpoint + 向后兼容性。

**👤 用户故事**
- 场景：想编辑一个不在扫描根目录里的 HTML 文件，之前只能拖入预览（只读），改完没法保存。
- 之前：拖入只读预览，关闭即丢；要点按钮选文件根本没入口。
- 现在：点 📂 按钮选任意文件直接可编辑；拖入也可编辑 + 另存为；最近打开 tab 让跨会话回到文件。

---

## v1.18.4 — i18n Hotfix · 英文翻译加载修复

*2026-07-17 · v1.18.4*

**EN**
- 🐛 **English locale SyntaxError hotfix** — `en.js` line 91 `preview.temporary` had an unescaped apostrophe in `won't`, which closed the outer single-quote string early and threw a JS SyntaxError. As a result `window.LOCALE_EN` was never assigned, the i18n fallback chain (`cur[key] || fb[key] || key`) ended up returning the raw key string, and the whole UI showed literal keys like `header.label.files` / `sidebar.search.placeholder` / `sidebar.tab.tree` instead of translations.
  - **Root cause**: unescaped apostrophe in `won't` inside a single-quoted JS string.
  - **Fix**: escape as `won\'t`; also bump cache-bust query `?v=1.18.2 → ?v=1.18.4` on `index.html` (5 static assets) so browsers bypass stale cache.
  - **Verification**: `node --check en.js` parses cleanly; vm-simulated `window.LOCALE_EN` returns 326 keys, and the 4 keys highlighted in the bug report (`header.label.files` / `sidebar.search.placeholder` / `sidebar.tab.tree` / `sidebar.tab.favorites` / `sidebar.tab.recent`) all resolve to their English values.

**中文**
- 🐛 **英文 locale 语法错误热修** — `en.js` 第 91 行 `preview.temporary` 字符串里的英文撇号 `won't` 没转义，提前关闭了外层单引号字符串并抛 JS SyntaxError。导致 `window.LOCALE_EN` 未赋值，i18n fallback chain (`cur[key] || fb[key] || key`) 最终返回 key 字符串本身，整个界面显示原文 key（如 `header.label.files` / `sidebar.search.placeholder` / `sidebar.tab.tree`），所有英文翻译失效。
  - **根因**：单引号字符串里的 `won't` 撇号未转义。
  - **解法**：转义为 `won\'t`；并把 `index.html` 5 个静态资源的 cache-bust query 从 `?v=1.18.2` bump 到 `?v=1.18.4`，强制浏览器绕过旧缓存。
  - **验证**：`node --check en.js` 通过；vm 模拟 `window.LOCALE_EN` 返回 326 个 key，截图红圈里的 4 个 key 全部能取到正确英文值。

**👤 用户故事**
- 场景：在英文模式下打开 DocCenter，发现顶部、搜索框、侧栏 Tab 全是 `header.label.files` / `sidebar.search.placeholder` 这种原文 key。
- 之前：i18n 整个废掉，UI 完全不可读。
- 现在：英文翻译恢复正常，切换 EN ↔ 中文也都正常工作。

---

## v1.18.3 — Windows Compatibility Hardening · Windows 兼容性加固

*2026-07-16 · v1.18.3*

**EN**
- 🖥️ **OneDrive Desktop redirect** — browse dialog now detects `%OneDrive%` env var and redirects "Desktop"/"Documents" shortcuts to OneDrive paths
- 🔧 **explorer /select path with spaces** — `subprocess.run(f'explorer /select,"{target}"', shell=True)` to handle paths like `C:\Users\My Documents\file.html`
- 🧪 **Windows self-check script** — `hotpage-windows-check.py` runs 10 diagnostic checks (Python/aiohttp/config/port/path-separator/browser)

**中文**
- 🖥️ **OneDrive 桌面重定向** — 目录浏览器检测 `%OneDrive%` 环境变量，自动把"桌面"/"文稿"快捷入口重定向到 OneDrive 路径
- 🔧 **explorer 路径含空格** — `explorer /select,"路径"` 用引号包裹，修复 `C:\Users\My Documents\file.html` 类路径
- 🧪 **Windows 自测脚本** — `hotpage-windows-check.py` 跑 10 项诊断检查

---

## v1.18.2 — Windows Fixes & Markdown Preview · Windows 兼容与 MD 预览修复

*2026-07-15 · v1.18.2*

**EN**
- 🐛 **Fix: static asset version bump v1.12.0 → v1.18.2** — browser was caching pre-v1.16 app.js on Windows, causing "Settings button no response" and "Browse dialog load failed" because the cached JS couldn't find new DOM elements
- 📝 **Markdown drag-preview rendering** — dropped MD files now renders as formatted HTML (headings/bold/code/lists/quotes) instead of plain text
- 🎨 **PDF export preserves color** — injected `print-color-adjust: exact` into print CSS so background colors survive "Save as PDF"
- 🔄 **Scan root auto-enable on re-add** — adding a previously-disabled directory now enables it instead of showing "already exists"

**中文**
- 🐛 **修复：静态资源版本号 v1.12.0 → v1.18.2** — 浏览器缓存了 v1.16 之前的旧 app.js，导致 Windows 上"设置按钮无反应"和"浏览对话框加载失败"（旧 JS 找不到新 DOM 元素）
- 📝 **Markdown 拖拽预览渲染** — 拖入 MD 文件现在渲染为格式化 HTML（标题/粗体/代码/列表/引用），不再是纯文本
- 🎨 **PDF 导出保留彩色** — 打印 CSS 注入 `print-color-adjust: exact`，背景色不再被"另存为 PDF"剥掉
- 🔄 **重新添加已禁用目录时自动启用** — 不再提示"已存在"，而是自动启用并显示

---

## v1.18 — Table Insert · 表格插入

*2026-07-09 · v1.18.0*

**EN**
- 📊 **Table insert button** — new 📊 button in editor toolbar; prompt for rows×cols (e.g. `3×4`), inserts a styled HTML table at cursor via `insertHTML`
- Supports 1-20 rows × 1-20 cols, with bordered cells and auto-width

**中文**
- 📊 **表格插入按钮** — 编辑器工具栏新增 📊 按钮；输入行×列（如 `3×4`），在光标处插入带边框的 HTML 表格
- 支持 1-20 行 × 1-20 列，单元格自动带边框和内边距

**👤 用户故事**
- **场景**：用户在 HTML 报告里想加一个数据表格
- **之前**：只能回 AI 重生成整段 HTML
- **现在**：点 📊 → 输入 3×4 → 表格插入 → 直接在单元格里打字
- **一句话**：从"回 AI 重做"到"工具栏一键插入"

---

## v1.17 — Export & Autostart · 导出与开机自启

*2026-07-09 · v1.17.0*

**EN**
- 📄 **Export PDF / Print** — new 📄 button in toolbar, calls `iframe.contentWindow.print()` with injected `@media print` CSS to hide the editor toolbar; works for both managed files and drag-dropped previews
- 🔧 **Startup autostart prompt** — double-click scripts now ask "Set as startup autostart? (y/n)" on first run; Mac generates launchd plist dynamically, Windows creates Startup folder shortcut

**中文**
- 📄 **导出 PDF / 打印** — 顶栏新增 📄 按钮，调用浏览器原生打印（可另存为 PDF），自动注入 `@media print` 样式隐藏编辑器工具栏；管理的文件和拖拽预览都能导出
- 🔧 **开机自启提示** — 双击脚本首次运行时询问"是否设为开机自启？"，Mac 动态生成 launchd plist，Windows 创建启动文件夹快捷方式

**👤 用户故事**
- **场景**：用户编辑完 HTML 报告，想发给老板
- **之前**：只能发 .html 文件，老板可能打不开
- **现在**：点 📄 按钮 → 浏览器打印对话框 → 另存为 PDF → 发给老板
- **一句话**：从"只能发 HTML"到"一键导出 PDF"

---

## v1.16.1 — Empty State & Drag Preview Closure · 空状态改造与拖拽闭环

*2026-07-08 · v1.16.1*

**EN**
- 🎯 **Empty state redesign** — "Pick a file from sidebar" → "👇 Drag HTML here, or click ＋ to add folders" + a prominent "📂 Add folder" button right in the empty state
- 📋 **Drag preview status bar** — dropped files now show a gold status bar "📋 Temporary preview · Not managed, edits won't be saved" — no more dead-end confusion
- ⚡ **Sidebar ＋ direct-to-browse** — removed the settings panel detour; clicking ＋ now opens the folder browser directly (was: settings → wait → browse)
- 🔧 **Python missing UX** — double-click scripts now auto-open python.org download page instead of just printing a URL

**中文**
- 🎯 **空状态改造** — 从"从侧边栏选文件"变成"👇 拖入 HTML 预览，或点 ＋ 添加文件夹" + 空状态里直接放一个醒目的"📂 添加文件夹"按钮
- 📋 **拖拽预览状态条** — 拖入文件后顶部显示金色条"📋 临时预览 · 此文件未纳入管理，编辑不会保存"——不再是"看了改不了"的死胡同
- ⚡ **侧边栏＋直达浏览** — 去掉设置面板中转，点＋直接打开目录浏览器（原来：设置面板→等200ms→浏览弹窗）
- 🔧 **Python 缺失体验** — 双击脚本检测到没装 Python 时自动打开下载页，不再只打印一行 URL

**📐 UX 框架对照**
- Norman 可视性：空状态从"不可发现"→"自我解释"（Krug 第一定律）
- Nielsen #1 系统状态可见：拖拽预览有明确状态条
- Nielsen #6 识别优于回忆：空状态直接给操作入口
- Cooper #1 不要让用户感觉蠢：拖入后明确告知"临时预览"而非沉默

---

## v1.16 — Usability & Onboarding · 使用方便性优化

*2026-07-07 · v1.16.0*

**EN**
- 🚀 **Double-click launch** — `启动 HotPage.command` (Mac) / `启动 HotPage.bat` (Windows), no terminal needed, auto-installs deps + opens browser
- 📂 **Enlarged "Browse folders" button** — the tiny 30px 📂 icon is now a prominent dashed button with text label
- ➕ **Sidebar quick-add** — "＋" button in sidebar header, one click → settings → folder browser, no more digging
- 📎 **Drag-and-drop preview** — drag HTML/MD files from Finder/Explorer into the main area, preview instantly (no scan_root needed)
- 🔧 **`--open-browser` CLI flag** — `python3 server.py --open-browser` auto-opens browser on startup
- 🔧 **`--port` CLI flag** — override port from command line

**中文**
- 🚀 **双击启动** — Mac 双击 `.command`、Windows 双击 `.bat`，自动检查环境+装依赖+开浏览器，零命令行
- 📂 **放大"浏览文件夹"按钮** — 原来 30px 的 📂 小图标改成醒目虚线大按钮 + "浏览文件夹…"文字
- ➕ **侧边栏快速添加** — 侧边栏 header 加"＋"按钮，一键直达目录浏览器，不用再开设置面板翻找
- 📎 **拖拽预览** — 从 Finder 拖 HTML/MD 文件到主界面，金色虚线提示 → 松开即预览，不走 scan_root
- 🔧 **`--open-browser` 参数** — 启动后 1.5 秒自动打开浏览器
- 🔧 **`--port` 参数** — 命令行指定端口

**👤 用户故事**
- **场景**：非技术用户想用 HotPage 浏览 AI 生成的 HTML 报告
- **之前**：打开终端 → pip install → python3 server.py → 手动开浏览器 → 设置面板里找 30px 小图标加文件夹
- **现在**：双击 `启动 HotPage.command` → 浏览器自动打开 → 拖 HTML 文件进去就能看 → 点侧边栏"＋"加文件夹
- **一句话**：从"需要会命令行"到"双击就能用"

---

## v1.15 — Static Asset Proxy & Image Preview · 静态资源代理与图片预览

### v1.15.2 — Image Preview Timeout Fix · 图片预览超时修复
*2026-06-08 · v1.15.2*

**EN**
- 🐛 **Fix: image preview always showing "File failed to load or timed out"** — PNG/JPG/GIF/WebP/SVG files in the tree triggered the 12s fallback dialog every time

**中文**
- 🐛 **修复：图片预览始终弹出"文件加载失败或超时"** — 树列表中的 PNG/JPG/GIF/WebP/SVG 文件每次打开都触发 12 秒超时兜底弹窗

**🐛 Bug 三段式**
- **问题**：在 DocCenter 中点击任何图片文件，等 12 秒后弹出"文件加载失败或超时"错误弹窗，实际图片内容是能加载的
- **根因**：图片预览壳子（`_render_image_shell()`）不注入 `saver-runtime.js`（设计正确，图片不可编辑），但也因此不会向父窗口发送 `ready` postMessage。而 `app.js` 第 1482 行的 12 秒超时检测依赖收到 `ready` 消息来取消 fallback——图片永远收不到 → 永远超时
- **解法**：在图片壳子 HTML 的 `</body>` 前注入一小段 `<script>`，启动时立即向 `window.parent` 发送 `{ source: "doc-center-saver", type: "ready" }` 消息，满足父窗口的超时取消条件

**📐 改动**
- `server.py`：`_render_image_shell()` 新增 6 行 `<script>` 发送 ready 消息

---

### v1.15.1 — Image File Tree Support · 图片文件树展示
*2026-06-04 · v1.15.1*

**EN**
- 🖼️ Image files (PNG/JPG/JPEG/GIF/WebP/SVG) now appear in the directory tree with 🖼️ icon
- 📷 Click any image to preview in iframe — centered on dark background, no editing injection
- 🔧 `/api/file` extended to accept image extensions, returns a lightweight preview shell HTML

**中文**
- 🖼️ 图片文件（PNG/JPG/JPEG/GIF/WebP/SVG）现在出现在目录树中，带 🖼️ 图标
- 📷 点击图片在 iframe 中预览——深色背景居中展示，不注入编辑能力
- 🔧 `/api/file` 扩展支持图片后缀，返回轻量预览壳子 HTML

**📐 改动**
- `server.py`：`handle_file()` 新增 `IMAGE_EXTS` 支持 + `_render_image_shell()` 函数
- `server.py`：`_walk_dir()` 扫描逻辑扩展识别图片文件

---

### v1.15.0 — Static Asset Proxy · 静态资源代理
*2026-06-04 · v1.15.0*

**EN**
- 🔧 **New `/api/asset/{encoded_dir}/{path}` route** — proxies local static resources (images, CSS, JS, fonts) referenced by HTML files via relative paths
- 🏗️ `inject_saver()` now injects `<base href>` pointing to the asset proxy — all relative URLs in HTML documents resolve correctly
- 🔒 Security: all asset access passes through `_resolve_safe()` whitelist check

**中文**
- 🔧 **新增 `/api/asset/` 静态资源代理路由** — 代理 HTML 文件通过相对路径引用的本地静态资源（图片、CSS、JS、字体）
- 🏗️ `inject_saver()` 注入 `<base href>` 指向资源代理 — HTML 文档中的相对 URL 现在能正确解析
- 🔒 安全：所有资源访问经过 `_resolve_safe()` 白名单校验

**👤 用户故事**
- **场景**：HTML 报告中用 `<img src="./images/chart.png">` 引用同目录图片
- **之前**：DocCenter 通过 `/api/file` 代理 HTML 内容，但相对路径图片指向 `localhost:9901/images/chart.png`——404
- **现在**：注入 `<base href="/api/asset/{encoded_dir}/">` 后，所有相对路径自动走资源代理，图片/CSS/JS 正常加载
- **一句话**：HTML 里的相对路径终于不再 404 了

**📐 改动**
- `server.py`：新增 `handle_asset()` 路由 + `_make_base_href()` 辅助函数
- `server.py`：`inject_saver()` 在 `<head>` 内注入 `<base href>`

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

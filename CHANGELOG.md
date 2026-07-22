# Changelog

> Brief bilingual highlights. For detailed technical history (in Chinese), see [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md).
>
> 双语精简版。详细技术日志（含 Bug 三段式与设计决策）见 [docs/CHANGELOG-detailed.md](docs/CHANGELOG-detailed.md）。

This project follows [Semantic Versioning](https://semver.org/).

---

## v2.8.0 — 工作区范围与发布可靠性

*2026-07-22 · 23:27 · 多工作区聚焦、公众号发布可靠性与桌面运行数据保护*

### 👤 用户故事

**场景**：本地工作台配置了父目录和子项目两个扫描根，用户只想处理一个项目，却在目录与搜索中看到重复结果。
**之前**：只能在全部扫描根里翻找，难以判断当前打开的文件属于哪个工作区；公众号复制与导出按钮也会在无关模式中出现。
**现在**：可从侧栏选择全部或单个工作区；全部视图自动隐藏被父根覆盖的子根，顶栏显示当前文件的工作区，设置页清楚提示父子根重叠。
**一句话**：多个本地目录也能像一个清晰的项目工作台一样聚焦操作。

**🎨 UX**

- 新增工作区选择器、当前文件工作区上下文和扫描根重叠提示；不自动删除或修改用户配置的目录。
- 首次从项目内文件直达时，自动聚焦该文件所属的最深工作区；已保存的用户选择始终优先。
- 路径边界匹配显式支持 POSIX `/` 扫描根，避免根目录配置下的去重与归属判断失效。
- 公众号复制与导出动作只在「公众号排版」模式可见。
- 当浏览器不支持 `ClipboardItem` 时，公众号「复制 HTML」改为复制富文本选区，不再把 HTML 源码直接粘贴给读者。
- 修正 README 的本地启动命令，避免引导用户使用未支持的 `--dev` 参数。

**🐛 Bug 修复 · Markdown 自动快照**

- **问题**：当通过 `--port` 使用非默认端口，或通过 `127.0.0.1` 访问时，Markdown 编辑后的自动快照会显示“快照失败（离线？）”。
- **根因**：Markdown 壳页把 API 地址固定为配置中的 `localhost:9901`，没有使用实际提供编辑器的请求地址。
- **解法**：服务端将当前请求的 scheme 与 host 注入 Markdown 壳页；自动快照、历史记录与恢复接口始终回到同一个运行中的本地服务。

**🐛 Bug 修复 · 大文件加载与桌面运行目录**

- 将复杂 HTML 的加载兜底时间从 12 秒调整为 30 秒，并在 DOM 已完成但运行时未就绪时输出明确诊断信息。
- 补充中英文失败原因，区分复杂文件渲染、运行时脚本错误、扫描根变更与服务异常。
- 增加冻结应用回归测试，确保 Windows/macOS 打包应用把 `_dropbox` 写入用户配置目录，不会写入 App/EXE 工作目录。

**📐 发布状态**

- 已完成自动化测试与真实浏览器回归；通过 `v2.8.0` 标签触发 GitHub Actions，生成 Windows EXE、已签名公证的 macOS arm64 DMG 和 SHA-256 校验文件。


## v2.7.0 — Markdown 公众号排版模式

*2026-07-22 · 在 HTML Studio 内直接生成苹果风格公众号 HTML*

### 👤 用户故事

**场景**：个人开发者已经在 HTML Studio 里维护 Markdown 教程，还要切到其他工具才能做公众号排版。
**之前**：编辑、预览、复制和导出分散在不同页面，图片与样式容易丢失。
**现在**：打开 Markdown 后点击「公众号排版」，左侧编辑、右侧预览，并可直接复制富文本或导出 HTML。
**一句话**：Markdown 写作和公众号发布排版在同一个本地工作台完成。

**🔧 功能**

- 新增本地 `/api/wechat/format` 接口，复用现有 Python formatter 生成自包含 HTML。
- Markdown 编辑器新增公众号排版模式、苹果风格预览、复制 HTML 和导出 HTML。
- 图片继续以内嵌 data URI 处理，不依赖外部 CSS、脚本或图片地址。

**🔒 安全**

- 格式化接口沿用 `_resolve_safe()` 路径白名单，只接受 Markdown 文件，不写入源文件、不联网。

**📐 发布**

- 开源桌面版新增 PR/main 自动检查与仅 Tag 触发的 GitHub Release 流程；正式附件包含已公证 macOS arm64 DMG、Windows EXE 与 SHA-256 校验清单。

## v2.6.0 — 公众号教程排版工具

*2026-07-21 · Markdown 原稿一键生成苹果式公众号 HTML*

### 👤 用户故事

**场景**：个人开发者写完 macOS DMG 分发教程，还要反复调整标题、代码块、提示卡片和截图样式。
**之前**：每次都重新描述排版要求，图片路径和公众号兼容性也容易出错。
**现在**：只维护 Markdown 和 `articles/assets/` 图片，运行一条本地命令即可生成单文件 HTML 并预览。
**一句话**：把一次性的排版沟通，变成以后可复用的本地工作流。

**🔧 功能**

- 新增 Markdown → 公众号 HTML 的本地 Python CLI。
- 内联 Apple 风格样式，支持标题、列表、引用、代码、表格、链接和图片。
- 本地 PNG、JPEG、WebP、GIF、SVG 图片自动内嵌，复制文章时不依赖外部 CSS 或资源。
- 配套首篇“macOS DMG 独立分发完整指南”和两张本地 SVG 流程图。

**🔒 安全**

- 所有正文、链接属性和图片说明均进行 HTML 转义；脚本不联网、不读取 Apple 凭据、不上传文章。

## v1.20.4 — 修复 Windows 下拖入副本（_dropbox）写入权限报错

*2026-07-20 · macOS 行为不变，Windows 打包版不再崩*

**🐛 Bug · 临时 drop 文件跑到 Windows 下报错**

- **问题**：在 Windows 上使用「拖入副本」功能时直接报错，文件写不进 `_dropbox/`
- **根因**：`get_dropbox_dir()` 把 `_dropbox/` 建在 `Path.cwd()`（server 工作目录）。macOS 上工作目录可写正常；但 Windows 打包 exe 常跑在 `C:\Program Files\...` 等受保护路径，`mkdir`/`write_bytes` 抛 `PermissionError`，且无任何异常兜底，直接 500 崩溃
- **解法**：
  1. `get_dropbox_dir()` 改为「候选目录链」——优先 `CWD/_dropbox`（保持 macOS 开发态行为不变），不可写时回退到用户主目录 `~/.html-doc-center/_dropbox`（Windows 即 `%USERPROFILE%\.html-doc-center\_dropbox`，一定可写）
  2. 每次候选先 `mkdir(parents=True)` 再「写探针文件 + 删除」验证真正可写，避免「目录能建但文件写不进」的假成功
  3. `handle_drag_upload` 的 `get_dropbox_dir()` 与 `write_bytes` 均加 `try/except`，失败时返回友好中文错误而非裸 500

## v1.20.3 — 新增 --host 启动参数支持远程/AnyDev 部署

*2026-07-20 · 可绑定 0.0.0.0 对外提供服务*

**🔧 功能 · 部署到 AnyDev 无法被外部访问**

- **问题**：`server.py` 默认只绑 `127.0.0.1`，部署到 AnyDev（21.6.56.139:9901）后用户浏览器通过 IP 访问不通
- **根因**：硬编码 `bind_hosts = ["127.0.0.1"]`，缺少可配置绑定地址；同机 visa 项目绑 `0.0.0.0` 才能外部访问
- **解法**：新增 `--host` CLI 参数（默认 `None` → 保持原 127.0.0.1 本地安全行为）；部署时用 `--host 0.0.0.0` 即可对外。非破坏性改动

## v1.20.2 — iframe 超时从 12s 延长至 30s + 诊断增强

*2026-07-20 · 大文件/复杂文件加载不再误报超时*

**🐛 Bug · 12 秒超时对大文件不够用，architecture.html 等复杂页面触发假失败**
- **问题**：打开较大的 HTML 文件（如架构图、信息图）时，iframe 渲染超过 12 秒就弹出 "File failed to load or timed out" 兜底 UI。实际上文件正在加载中，只是没来得及发 `ready` 消息
- **根因**：v1.10.6 设定的 12s 硬超时对简单 HTML 够用，但对包含大量 SVG/Canvas/内嵌资源的复杂文档明显不足
- **解法**：
  1. 超时从 `12000ms` → `30000ms`（30 秒）
  2. 超时触发前尝试检测 iframe DOM 状态（`contentDocument.readyState === "complete"`），在控制台输出诊断日志
  3. 兜底 UI 提示文案增加 "按 F12 查看控制台" 和 "大文件渲染慢" 两条

## v2.5.7 — Password Field Reverts to Editable Input

*2026-07-18 00:55 · 密码框改回可编辑*

**🐛 Bug · v2.5.0 改"只读展示"过头，用户无法改密码**
- **问题**：用户想自定义密码（比如"test123"），但分享弹窗里的密码框是只读 div，只能点 🎲 重新生成。改不了自己想要的密码，分享后用自定义密码访问就报"密码错误"
- **根因**：v2.5.0 改版时一刀切——`user-select: none` 整个弹窗 + 把密码展示从 `input` 改成 `div` + 配合 pwdEmpty/pwdDisplay 双态切换。`user-select: none` 防"文字可编辑"是合理的，但把 input 改成 div 就过头了——展示卡片是 UI 设计，但用户**就是想自己输密码**也得有入口
- **解法**（v2.5.7）：
  1. 密码区改回 `input type="text"`（`<input id="_pwd_input" class="dc-pwd-display" placeholder="点击 🎲 生成强密码，或自己输入" maxlength="64">`）
  2. `addEventListener("input", ...)` 实时同步 `password = pwdInput.value` 到变量——任何手输的字符都进传到后端的 password
  3. 移除 `pwdEmpty` / `pwdDisplay` 双 div 结构，简化为单一 input
  4. CSS 调整：`user-select: auto`（input 默认） + focus 时高亮（金色边框 + 更深背景 `#0a0f15`）
  5. 首次开启开关：自动生成密码 → 写入 input → 自动 focus + select（用户可直接覆盖）
  6. 🎲 重新生成：写入 input + focus + select（一键覆盖）

**🔧 配套 UX 调整**
- 弹窗整体 `user-select: none` 保持（防标题/描述文字被误选）
- 但密码 input 单独放开 `user-select: auto`（因为这就是要输入/编辑的）
- 复制按钮复制的是 `pwdInput.value`（用户最终输的内容，不是自动生成的）

**👤 用户故事**
- 场景：Louis 想给自己分享的链接设个易记密码（比如 `test123`），但弹窗里的密码框是只读 div，无法手输
- 之前：只能点 🎲 用随机密码，自己想要的密码输不进去，分享后访问报"密码错误"
- 现在：input 可直接手输 + 🎲 快速生成 + 📋 复制三种方式并存，传到后端的 password 实时同步

---

## v2.5.6 — Business Plan Deck (biz-deck-writer Skill)

*2026-07-18 00:35 · 用专业技能重做商业报告*

**📐 架构 · 用 biz-deck-writer 技能重做商业报告**
- 删除 v2.5.5 手写版 `business-plan-v1.html`（用户反馈"太丑"——没用本地技能）
- 新生成 `business-plan-v1-deck.html`，12 页横向滑页 deck（CSS scroll-snap）
- 5 章节叙事线：价值（P1-2）→ 场景（P5）→ 现状（P3-4）→ 需求（P6-9）→ 合作（P10-12）
- 8 种页面版式：Hero 封面 / 价值主张 / 数据对比 / 现状分析 / 需求清单 / BMC 9 宫格 / 时间线 / CTA 收尾

**🎨 UX · 4 主题轮换 + HTML Studio 金色品牌**
- 把技能默认的迁移虾橙 `#ff5a1f` 改成 HTML Studio 金 `#C9A961`（和编辑器统一）
- 4 主题轮换节奏：金 → 深 → 浅 → 米 → 深 → 浅 → 米 → 深 → 浅 → 米 → 深 → 金（无连续 3 页同主题）
- 主题色映射：gold（封面/CTA）/ dark（价值/数据/风险）/ light（市场/模式/架构）/ cream（竞品/画布/里程碑）

**🔒 安全 · R8 对比度规范严格执行**
- 按技能 R8 速查表分主题写实色：gold 用 `#5a2408`，dark 用 `#C9A961/#bbb`，light/cream 用 `#8a6d1f/#2d2d2d`
- 修正模板自带的 `opacity:0.55`（pagenum）和 `color:#555`（lead）违规
- grep 自检：无 `opacity: 0.[0-7]`，无浅底 `#555/#666/#777` 正文
- P8 定价页深底 `#888/#666` 修正为 `#aaa/#888`（对比度 ≥ 4.5:1）

**👤 用户故事**
- 场景：Louis 反馈"先做写报告怎么这么丑，本地不是很多技能吗"——指出我没用 biz-deck-writer
- 之前：v2.5.5 手写普通 HTML 长文，视觉平庸
- 现在：12 页专业横向滑页 deck，4 主题轮换，金色品牌统一，对比度合规，可 DocCenter 批注迭代

---

## v2.5.5 — Business Plan v1.0 Report

*2026-07-18 00:15 · 商业报告 + 架构路线图*

**📐 架构 · 输出完整商业报告**
- 生成 `docs/business-plan-v1.html`，10 个章节覆盖：执行摘要、商业画布（BMC 9 模块）、价值主张画布（VPC）、市场分析（TAM/SAM/SOM）、竞品矩阵、定价策略、技术架构路线图（4 阶段）、里程碑规划、风险评估、待办与进展
- 商业模式定调：**双轨制**——本地版开源全功能（不限制在线分享），云端版 SaaS 按层收费（Free/Pro/Team/Enterprise）
- 核心 monetization：免费版分享页带"Made with HTML Studio"水印，Pro ¥29/月去水印 + 品牌定制 + 1 年有效期 + 数据统计
- 增长飞轮：分享即曝光 → 接收方好奇 → 新用户 → 更多分享

**🎨 UX · 报告视觉设计**
- 和 DocCenter 编辑器同色系：背景 `#0F1419` + 卡片 `#1A1D23` 渐变 `#232830` + 金色 `#C9A961` + 蓝色 `#4A9EFF`
- 商业画布用 CSS Grid 9 宫格布局（价值主张格金色高亮）
- 价值主张画布左右双栏（客户蓝 + 价值金）
- 路线图用时间线组件（已完成绿/进行中金/待启动蓝）
- 定价卡片 Pro 层 `transform: scale(1.03)` 突出推荐
- 风险矩阵用红色边框 + 高/中/低 三色标签
- 待办三栏（已完成/进行中/待启动）

**👤 用户故事**
- 场景：Louis 要求"用商业画布等输出完整商业报告和技术架构路线图"，今晚收工前定方向
- 之前：架构只在对话里讨论，没有沉淀文档，跨会话会丢失
- 现在：一份可编辑的 HTML 报告，明天打开 9901 即可继续迭代

---

## v2.5.4 — CloudBase Password Form Path Fix

*2026-07-17 23:05 · 云函数 hotfix*

**🐛 Bug · 密码 form 提交后 CloudBase 报 INVALID_PATH**
- **问题**：用户访问带密码的分享链接 → 输入密码点"进入" → CloudBase 返回 `INVALID_PATH` 错误页
- **根因**：云函数 `passwordPage()` 生成的 form action 是 `/api/share/${id}/auth`（行 59），重定向 Location 是 `/api/share/${id}`（行 135），**都没带 CloudBase HTTP 触发器前缀 `/test`**。浏览器 POST 到 `https://...tcloudbase.com/api/share/{id}/auth`（缺 `/test`）→ CloudBase 路由不匹配触发器路径 `/test/*` → `INVALID_PATH`
- **解法**：
  1. 把 `const TRIGGER_PREFIX = "/test"` 从 `main` 函数内提到模块顶部（所有 helper 函数都能访问）
  2. 密码页 form action 改成 `${TRIGGER_PREFIX}/api/share/${id}/auth`
  3. 重定向 Location 改成 `${TRIGGER_PREFIX}/api/share/${id}`
- **改动文件**：`html-studio-server/cloudfunctions/html-studio-share/index.js`（私有仓库，配套 html-doc-center 使用）
- **验证**：端到端测试 4 步全过 — ①创建带密码 share ②GET 返回密码页 200 ③POST 密码返回 302 + Location 带 `/test` 前缀 ④带 cookie GET 返回 HTML 内容 200

**👤 用户故事**
- 场景：Louis 测试自己生成的分享链接，输入密码后看到 `INVALID_PATH` 错误页
- 之前：带密码的分享链接完全不可用
- 现在：密码验证 → 302 重定向 → 带 cookie 访问 → 正常显示 HTML 内容

---

## v2.5.3 — Share Modal Multi-Stage Flow + Anti-Text-Select

*2026-07-17 22:55 · 分享流程塞进弹窗 + 防误选*

**🎨 UX · 分享弹窗从"toast 通知"升级为"弹窗内多阶段"**
- 老流程：点确认 → 弹窗关闭 → 后台上传 → toast 弹链接（用户痛点：toast 容易忽略、看不到链接、不知道成功没）
- 新流程：弹窗**不关闭**，在弹窗内切换三个状态
  - **阶段 1：生成中** — 36px 金色 spinner + "正在生成在线链接…" + "通常 1-3 秒，请稍候"
  - **阶段 2：成功** — ✅ 图标 + 完整 URL（金色等宽字体，可一键全选） + "📋 复制链接" + "🔗 浏览器打开" + "完成"按钮
  - **阶段 3：失败** — ⚠️ 图标 + 红色错误框（`FCA5A5` 文字 + 半透明红底） + "重试" + "改用离线文件" + "取消"
- 失败重试：点"重试"会重新走阶段 1，不重新弹出配置弹窗
- 降级：点"改用离线文件"会回到 3.7 离线文件流程（含密码注入）
- SHELL 设计语言统一：背景 `linear-gradient(180deg, #1A1D23 0%, #232830 100%)` + 金色边框 `rgba(201,169,97,0.28)`，主 CTA 用金色 `#C9A961` 背景 + 黑色字（编辑器风格）

**🔧 功能 · 复制失败有兜底**
- `navigator.clipboard.writeText` 失败时（Safari 隐私模式/无 HTTPS）自动降级为"选中文本让用户手动 ⌘/Ctrl+C"
- URL 区域默认 `user-select: all` + 点击自动 selectAllChildren，复制体验一致

**🐛 Bug · 弹窗文字可选中让人误以为"可编辑"**
- 弹窗整体 `user-select: none; -webkit-user-select: none` —— 标题/描述/标签都不能选中
- 显式例外：`dc-pwd-display`（密码展示）和链接 URL 用 `user-select: all` —— 这两处就是要被复制
- 错误信息 `dc-link-err-msg` 用 `user-select: text` —— 报错时允许复制错误文字排查

**🔧 修复 · 清理冗余旧 3.6 段**
- 删除原"在线链接 → toast"流程（行 3589-3616），避免和新流程重复上传
- 补 `else if (shareChoice.mode === "link" && !SHARE_SERVER)` 明确提示配置缺失（不再静默走老逻辑）

**👤 用户故事**
- 场景：Louis 在 9901 点 📦 导出分享 → 选"在线链接" → 点"确认分享"，期望看到链接生成过程
- 之前：弹窗一闪就关，toast 在角落闪一下，链接要靠运气才能复制——**完全不知道成功没**
- 现在：弹窗一直在 → spinner 转动 → 链接出现在弹窗内 → 📋 一键复制 / 🔗 直接打开 → 失败时明确报错 + 重试/降级

---

## v2.5.2 — Toolbar Overflow Fix at High Zoom

*2026-07-17 22:48 · 高缩放下工具栏排版修复*

**🐛 Bug · 150% 缩放下工具栏按钮文字竖排溢出**
- **问题**：浏览器缩放到 150%（或窄屏）时，工具栏右侧的"链接/表格/排版/撤销/重做/块间距/批注/导出分享"等按钮，文字被压成单字宽竖排（"链/接"竖着叠、"表/格"竖着叠），完全不可读
- **根因**：工具栏用 `display: flex; gap: 6px;` + `position: fixed; left: 0; right: 0;`，子元素总和超过视口宽度时，flex 默认把每个按钮压缩到它的 `min-content` 宽度——CJK 字符的 min-content 是 1 个汉字宽度，emoji + CJK 的按钮就被挤成"图标+1 个汉字宽" → 文字自动竖向换行
- **解法**（三件套）：
  1. 工具栏 `overflow-x: auto; overflow-y: hidden` —— 缩放时出现横滚条兜底，**隐藏滚动条样式** `::-webkit-scrollbar { height: 0 }` 保持视觉干净
  2. 所有按钮 `flex-shrink: 0; white-space: nowrap` —— 禁止 flex 压缩，禁止文字换行
  3. `.dc-title` / `.sep` / `select#__dc_fontsize` / `.dc-status` 也加 `flex-shrink: 0; white-space: nowrap`，避免分栏和字号下拉被压扁

**👤 用户故事**
- 场景：Louis 在 150% 缩放看 15-MigraQ Landing 页，工具栏右侧所有 CJK 按钮文字竖排
- 之前：150% 缩放下工具栏基本不可用，文字溢出严重
- 现在：100%/125%/150%/200% 任意缩放下，按钮宽度正常、横滚兜底、滚动条隐藏

---

## v2.5.1 — inject_saver NameError Fix

*2026-07-17 22:41 · 紧急修复*

**🐛 Bug · inject_saver 引用未定义 `app` 触发 NameError**
- **问题**：打开任一 HTML（如 `15-MigraQ价值证明-Landing风格.html`）都报 `{"ok": false, "error": "读取失败: name 'app' is not defined"}`，文件彻底打不开（500 错误 + 加载超时）
- **根因**：`server.py:859` 的 f-string 模板里写了 `app.get("config", {}).get("share_server", "")`，但 `inject_saver()` 是普通函数，作用域里根本没有 `app` 变量（`app` 是 aiohttp 的 web.Application 实例，只有路由 handler 能通过 `request.app` 拿到）。任何没注入过 saver 的 HTML 一打开就立即触发 `NameError`
- **解法**：
  1. `inject_saver()` 签名增加 `cfg: dict` 参数（显式优于隐式）
  2. 函数顶部加 `share_server = (cfg or {}).get("share_server", "")` 局部变量
  3. 模板字符串改成 `f'  shareServer: "{share_server}"\n'`
  4. 调用点（`handle_file` 第 987 行）传入已有的 `cfg = request.app["config"]`
  5. 验证：curl `/api/file?path=15-MigraQ价值证明-Landing风格.html` 返回 HTTP 200 + size 53685，注入的 `shareServer` 字段已正确填上 CloudBase URL

**👤 用户故事**
- 场景：Louis 在 9901 打开养虾系列做好的 Landing 风格页面，弹错误 + 加载超时
- 之前：所有 HTML 文件都打不开，只能看 .md 或者用外置工具
- 现在：HTML 正常加载，分享弹窗的 shareServer 配置正确注入

---

## v2.5.0 — Share Modal Visual Redesign + Password Switch

*2026-07-17 22:30 · 分享弹窗视觉与交互重构*

**🎨 UX · 视觉和编辑器设计统一**
- 卡片背景换 `linear-gradient(180deg, #1A1D23 0%, #232830 100%)` + 金色边框 `rgba(201,169,97,0.28)`，与顶部工具栏同色系
- 字体统一 `12px/1.5 -apple-system,"PingFang SC",sans-serif`，主文字 `#E5E7EB` / 次文字 `#9CA3AF`
- Tab 选中态用金色 `#C9A961`（与工具栏 hover 同色），蓝色 `#4A9EFF` 仅留给"确认分享"主 CTA
- 副标题改为 "选择分享方式，生成可发给任何人的文件或链接"

**🔧 功能 · 密码区从"输入框"改成"开关 + 展示卡片"**
- iOS 风格开关启用密码保护，关闭时整区折叠（不留痕）
- 首次开启自动生成 12 位强密码（`SF Mono` 等宽字体金色显示，可一键全选）
- 🎲 重生成 + 📋 复制 两个图标按钮，hover 金色高亮
- 关闭开关 = 清空密码（不留任何状态）

**👤 用户故事**
- 场景：Louis 反馈分享弹窗"和编辑器设计不统一" + "密码框不该可编辑"
- 之前：弹窗用 `#1a2028` 蓝灰背景，文字 `#e8eef5`，密码是普通 input 可手输
- 现在：弹窗和工具栏同色系，密码改成开关 + 自动生成 + 展示卡片，整体不可手输

---

## v1.19.8 — Finder Modal + Editable Drag + Toolbar UX + Windows Fix

*2026-07-17 · v1.19.0 → v1.19.8 (8 patch iterations)*

**v1.19.0** — Finder-style dual-pane modal + editable drag-and-drop + Recent tab
**v1.19.1** — emoji icon fix + safeFetchJson in browseTo
**v1.19.2** — toolbar: remove brand dup + title hints + full hilite color palette
**v1.19.3** — palette overflow fix + Word-style SVG alignment icons
**v1.19.4** — palette width adapt + hilite button auto-contrast
**v1.19.5** — SVG alignment icons + cross-platform shortcuts (Alt/Option)
**v1.19.6** — UX overhaul: share feedback + spacing mode switch + mode states
**v1.19.7** — spacing toast feedback (select/change/reset)
**v1.19.8** — Windows IPv6 dual bind + manual path input + export-share API
**+ macOS** — ad-hoc codesign in build scripts (Gatekeeper fix)

**Backend**: `/api/browse?mode=file`, `/api/drag-upload`, `/api/save-as`, `/api/export-share`, `_dropbox/` cleanup
**Tests**: 18 pytest (browse/drag-upload/save-as/cleanup)
**Toolbar**: SVG icons, color palettes, mode states, cross-platform shortcuts, per-action toast

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

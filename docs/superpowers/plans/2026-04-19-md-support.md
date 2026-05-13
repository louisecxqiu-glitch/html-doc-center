# HTML Document Center v1.3 Markdown 支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 DocCenter 新增 Markdown 文件支持——扫描 `scan_roots` 下所有 `.md` 文件并与 HTML 统一展示在目录树，通过复用现有 iframe + `saver-runtime.js` + 三选项保存架构，让 MD 文件也能打开、编辑、自动快照、overwrite/new/discard 保存。HTML 原有能力 0 退化。

**Architecture:**
- 后端 `handle_file` 按文件后缀分流：`.html` 走原 `inject_saver`；`.md` 走新增 `render_md_shell`（读取 `web/md-editor.html` 模板 + 注入 MD 原文 + `__DOC_CENTER__.mode = "md"`）
- iframe 内 `saver-runtime.js` 按 `__DOC_CENTER__.mode` 分流：`html` 分支保持原样；`md` 分支监听 textarea `input` 事件，`request_html` 消息返回 `textarea.value`（消息名保留向后兼容）
- 前端 `app.js` 只改 icon 与文件类型判断，`/api/snapshot`、`/api/save`、`last_session`、目录缓存等核心链路 **0 改动**
- MD 预览用 `marked`（本地 vendor，~30KB）

**Tech Stack:** Python 3 + aiohttp（后端复用）；原生 JS + 原生 CSS（前端复用）；marked（单文件 JS，内嵌到壳子页面）；iframe postMessage 协议复用。

---

## File Structure

| 文件 | 改动类型 | 责任 |
|------|---------|------|
| `server.py` | Modify | `_walk_dir` 扩 md；`handle_file` 按 suffix 分流；新增 `render_md_shell()`；`handle_last_session_get` 白名单扩 md；`handle_save` mode=new 按源 suffix 另存；`_clean_auto_save` 按源 suffix 过滤 |
| `web/md-editor.html` | Create | MD 编辑器壳子页面：左 textarea 等宽编辑 + 右 `#preview` 实时渲染。含 `{{MD_CONTENT}}`、`{{FILE_NAME}}`、`{{FILE_PATH}}`、`{{SERVER_ORIGIN}}` 四个占位符 |
| `web/vendor/marked.min.js` | Create | marked v11 UMD 单文件，本地 vendor 避免外网依赖 |
| `saver-runtime.js` | Modify | 按 `__DOC_CENTER__.mode` 分流 md 分支：textarea input 驱动脏状态；`request_html` 返回 textarea.value；`mark_clean` 清标志 |
| `web/app.js` | Modify | `renderNode` 对 `node.type === "md"` 显示 📝；其他小改 |
| `web/index.html` | Modify | 空态提示文案扩到 HTML / Markdown |
| `CHANGELOG.md` | Modify | 新增 v1.3.0 条目 |
| `CHANGELOG.html` | Modify | 新增 v1.3.0 时间轴卡片（手写） |

---

## Task 1: 后端扫描/路由扩展 MD 支持

**Why**：当前 `_walk_dir` 只匹配 `.html`，`handle_file` 硬拒非 html 后缀。MD 入口必须从这两处打开。同时 `handle_save`/`handle_last_session_get`/`_clean_auto_save` 有隐式 `.html` 假设，一起收拾掉。

**Files:**
- Modify: `server.py`

- [x] **Step 1.1:** `_walk_dir` 第 173 行判定扩到 `(".html", ".md")`，节点 `type` 字段按后缀返回 `"html"` 或 `"md"`
- [x] **Step 1.2:** `handle_file` 第 333 行校验改为 `safe.suffix.lower() not in (".html", ".md")`；按 suffix 分流——`.html` 走原 `inject_saver`；`.md` 调用新增 `render_md_shell(safe)`
- [x] **Step 1.3:** 新增 `render_md_shell(md_path: Path) -> str` 函数：读取 `web/md-editor.html` 模板 → 读取 MD 原文 → 用 Python `html.escape` 转义后替换占位符 `{{MD_CONTENT}}` / `{{FILE_NAME}}` / `{{FILE_PATH}}` / `{{SERVER_ORIGIN}}`（后者可从 config 的 port 推出 `http://localhost:{port}`）→ 返回字符串
- [x] **Step 1.4:** `handle_last_session_get` 第 520 行白名单从 `.html` 扩成 `(".html", ".md")`
- [x] **Step 1.5:** `handle_save` mode=new 第 489 行：`new_name = f"{safe.stem}-审阅版-{_timestamp()}{safe.suffix}"` 替代硬编码 `.html`
- [x] **Step 1.6:** `_clean_auto_save` 第 368 行过滤条件从 `f.suffix == ".html"` 改为 `f.suffix == source_file.suffix`，保证 MD 快照也能被清理
- [x] **Step 1.7:** `handle_snapshot` 写入快照文件名 `{safe.stem}-{_timestamp()}.html`（第 403 行）改为 `{safe.stem}-{_timestamp()}{safe.suffix}`——否则 MD 快照写成 .html 会语义错乱
- [x] **Step 1.8:** 启动服务，`curl http://localhost:9901/api/tree | python3 -c "import json,sys;d=json.load(sys.stdin);print([n for r in d['roots'] for n in str(r)][:3])"` 检查是否含 md 节点

---

## Task 2: MD 编辑器壳子页面

**Why**：MD 必须在 iframe 内"自足"——因为复用了 iframe 架构，不能直接访问父页面 DOM。壳子页面要承担"编辑 + 预览 + 通过 saver-runtime.js 接入脏状态/快照"三件事。

**Files:**
- Create: `web/md-editor.html`
- Create: `web/vendor/marked.min.js`

- [x] **Step 2.1:** 下载 marked v11 UMD 版本到 `web/vendor/marked.min.js`（CDN: `https://cdn.jsdelivr.net/npm/marked@11/marked.min.js`）
- [x] **Step 2.2:** 创建 `web/md-editor.html`，结构：
  ```
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>{{FILE_NAME}} · Markdown</title>
    <style>自包含样式：container flex，左 textarea 50% 等宽字体，右 #preview 50%，顶部 40px 薄 header 显示文件名</style>
  </head>
  <body>
    <div class="md-header">📝 {{FILE_NAME}} <span id="md-status">已就绪</span></div>
    <div class="md-container">
      <textarea id="md-input" spellcheck="false">{{MD_CONTENT}}</textarea>
      <div id="md-preview" class="md-preview"></div>
    </div>
    <script>window.__DOC_CENTER__ = { filePath: "{{FILE_PATH}}", serverOrigin: "{{SERVER_ORIGIN}}", inIframe: window.self !== window.top, mode: "md" };</script>
    <script src="/static/vendor/marked.min.js"></script>
    <script>
      // 初次渲染 + debounced 150ms 预览渲染
      const input = document.getElementById("md-input");
      const preview = document.getElementById("md-preview");
      let rt = null;
      function render() { preview.innerHTML = marked.parse(input.value || ""); }
      render();
      input.addEventListener("input", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
    </script>
    <script src="/saver-runtime.js" defer></script>
  </body>
  </html>
  ```
- [x] **Step 2.3:** CSS 关键点：`.md-container { display: flex; height: calc(100vh - 40px); }`；`#md-input { flex: 1; font-family: ui-monospace,Menlo,Consolas,monospace; font-size: 14px; line-height: 1.6; padding: 16px; border: 0; outline: 0; resize: none; }`；`#md-preview { flex: 1; padding: 20px 28px; overflow-y: auto; border-left: 1px solid #e5e7eb; }`；`#md-preview h1/h2/.../pre/code` 的基础排版
- [x] **Step 2.4:** 浏览器手动验证：访问 `http://localhost:9901/static/md-editor.html` 单独打开壳子本身（占位符未替换会显示 `{{MD_CONTENT}}`，证明页面能加载、样式正确）

---

## Task 3: saver-runtime.js 扩展 md 分支

**Why**：HTML 分支用 `serializeHTML()`（clone document 去 saver 元素）、MutationObserver 监听 DOM 变化。MD 必须另走 textarea 通道——input 事件驱动脏状态、`textarea.value` 作为提交内容。两分支共享顶层 postMessage/snapshot/debounce 基础设施。

**Files:**
- Modify: `saver-runtime.js`

- [x] **Step 3.1:** 文件顶部读取 `const MODE = CTX.mode || "html";`
- [x] **Step 3.2:** 用 if/else 分流 `injectMinimalToolbar` 调用：`if (MODE === "md") injectMdStatusPill(); else injectMinimalToolbar();`。MD 模式不需要完整工具栏（marked 不支持富文本编辑，工具栏按钮没意义），但需要一个右上角的"状态胶囊"显示脏/已保存
- [x] **Step 3.3:** 新增 `injectMdStatusPill()` 函数：在 body 右上角贴一个 fixed 的小胶囊（40x 宽、高 28px），含 `#__dc_dot` 和 `#__dc_status_text`，样式和 HTML 工具栏一致。这样 `setStatus()` 能共享
- [x] **Step 3.4:** 改造 `bindListeners()` 按 MODE 分流：
  - `MODE === "html"`：保持原样（用户交互窗口 + MutationObserver + input 事件）
  - `MODE === "md"`：只监听 `textarea#md-input` 的 `input` 事件（150ms debounce 内不重复 markDirty），不挂 MutationObserver
- [x] **Step 3.5:** 改造 `serializeHTML()` → 重命名为 `serializeContent()`，按 MODE 返回不同内容：
  - `MODE === "html"`：原 clone document 逻辑
  - `MODE === "md"`：`return document.getElementById("md-input").value;`
  - `request_html` 消息的 payload 字段保留为 `{ html: serializeContent(), dirty: isDirty }`（字段名不改，向后兼容）
- [x] **Step 3.6:** `doSnapshot` 的 `fetch(SERVER + "/api/snapshot")` body 无需改动（只是 content 字段内容变了）
- [x] **Step 3.7:** 控制台验证：打开一个 MD 文件，F12 查看 iframe console，应看到 `[saver] runtime ready. file= ... existingEditor= false`；在 textarea 里敲字后应看到 `dirty_changed` postMessage

---

## Task 4: 前端 app.js 适配

**Why**：树节点渲染、icon、openFile 路径限制都需要扩 md。目前没有硬编码 `.html` 后缀断言（前面已扫），改动面很小。

**Files:**
- Modify: `web/app.js`
- Modify: `web/index.html`（空态提示）

- [x] **Step 4.1:** `createFileLabel` 第 290 行：`icon.textContent = node.type === "md" ? "📝" : "📄";`
- [x] **Step 4.2:** `countFiles` 第 185 行：扩到 `if (node.type === "html" || node.type === "md") n++;`
- [x] **Step 4.3:** `renderTree` 第 211 行的统计文案：`${roots.length} 个根目录 · ${totalFiles} 个文档`（从 "HTML" 改成"文档"）
- [x] **Step 4.4:** 空态提示：`renderTree` 第 203 行 `没有扫描到 HTML 文件` → `没有扫描到 HTML / Markdown 文件`；`web/index.html` 中类似文案（若有）同步
- [x] **Step 4.5:** 面包屑 `openFile` 第 434 行无需改（`node.abs_path` 对 md 文件直接展示）
- [x] **Step 4.6:** 浏览器验证：启动服务访问主页，能看到目录中 MD 文件 icon 是 📝；点击打开后主区域 iframe 内能正常显示编辑器壳子

---

## Task 5: 端到端回归 + CHANGELOG 双写

**Why**：完成前必须 verify（Superpowers 铁律），并且 CHANGELOG.md + CHANGELOG.html 双写（项目 SOP 铁律 1），漏掉任一份都算未完成。

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CHANGELOG.html`

- [x] **Step 5.1:** 创建一个测试 MD 文件（如 `outputs/test-md-v1.3.md`，含标题/列表/代码块/加粗），确保 scan_roots 能扫到
- [x] **Step 5.2:** `curl -s http://localhost:9901/api/tree | python3 -c "import json,sys; d=json.load(sys.stdin); import re; s=json.dumps(d,ensure_ascii=False); print('has_md:', '\"type\": \"md\"' in s)"` 确认返回 md 节点
- [x] **Step 5.3:** `curl -s "http://localhost:9901/api/file?path=<绝对路径 .md>" | head -20` 确认返回壳子 HTML（含 `md-input` textarea）
- [x] **Step 5.4:** 浏览器打开该 MD 文件 → 编辑几个字 → 等 2 秒 → 检查 `_auto-save/test-md-v1.3-*.md` 快照已生成
- [x] **Step 5.5:** 浏览器点"覆盖源文件" → 确认源 .md 内容已更新 + `_auto-save/` 已清理 + `_auto-save/*-pre-overwrite-*.md` 备份存在
- [x] **Step 5.6:** 回归 HTML：打开任一已有 HTML 文件（如现有 OPPO 报告或养虾封面）→ 确认 ready/dirty/snapshot/save 四流程完全正常、0 退化
- [x] **Step 5.7:** 更新 `CHANGELOG.md`：新增 v1.3.0 条目（2026-04-19，"Markdown 支持"）
- [x] **Step 5.8:** 更新 `CHANGELOG.html`：新增 v1.3.0 时间轴卡片，格式对齐现有（精确到分钟 + 一句话 summary + 分组 🔧 功能 / 📐 架构 / 🐛 Bug 防范）
- [x] **Step 5.9:** 删除测试 MD 文件 `outputs/test-md-v1.3.md`

---

## Success Criteria

所有必须达成：

1. ✅ `/api/tree` 返回含 `type: "md"` 的节点
2. ✅ 点击 MD 文件在 iframe 内打开编辑器壳子，左改右预览实时同步（150ms debounce）
3. ✅ 编辑 MD 后 2 秒自动快照到 `_auto-save/{stem}-{ts}.md`（扩展名为 .md 不是 .html）
4. ✅ 三选项保存：overwrite 覆盖 .md 源文件 + 清理快照 + 留一个 pre-overwrite 备份；new 另存 `{stem}-审阅版-{ts}.md`；discard 清理快照
5. ✅ 上次会话恢复：关闭浏览器再打开，自动回到最后编辑的 .md 文件
6. ✅ HTML 文件原有能力 0 退化（批注、contenteditable、双工具栏检测、20 快照滚动）
7. ✅ `CHANGELOG.md` + `CHANGELOG.html` 双写 v1.3.0 完成

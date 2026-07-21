# Markdown 公众号排版模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Markdown 编辑器中加入独立的苹果风格公众号排版模式，支持实时预览、富文本复制和 HTML 导出。

**Architecture:** 复用 `web/md-editor.html` 的 textarea、自动快照和三视图状态；新增 `wechat` 视图状态与操作栏。公众号 HTML 由现有 Python formatter 统一生成，通过安全的 `POST /api/wechat/format` 返回预览/复制/导出所需内容，避免浏览器端维护第二套 Markdown 解析器。

**Tech Stack:** Python 3 标准库 formatter、aiohttp、原生 JavaScript/CSS、现有 marked、浏览器 Clipboard API 和 Blob 下载。

## Global Constraints

- 所有路径必须经过 `_resolve_safe()`；接口只处理 `.md` 文件。
- 不修改 HTML 文件编辑/批注/保存流程。
- 不引入 npm、外部 CDN、在线 Markdown 服务或第三方资源。
- 公众号 HTML 必须自包含，图片使用 data URI，复制同时提供 `text/html` 与 `text/plain`。
- 公众号模式不能改变现有 Markdown 自动快照和三选项保存语义。
- 每个代码改动同步更新 `CHANGELOG.md`，并提交 git commit。
- 完成前运行全量 pytest、HTML 结构检查和真实浏览器交互验证。

## File Structure

| 文件 | 改动 | 责任 |
|---|---|---|
| `tools/wechat_formatter.py` | Modify | 暴露无文件写入的完整 HTML 渲染函数，供 API 调用 |
| `server.py` | Modify | 新增 `/api/wechat/format` 安全接口和路由 |
| `tests/test_wechat_format_api.py` | Create | API 合法/非法请求与自包含输出测试 |
| `web/md-editor.html` | Modify | 增加公众号入口、工作区、请求/复制/导出逻辑 |
| `tests/test_wechat_mode_static.py` | Create | 前端按钮、wechat 状态、操作动作静态契约测试 |
| `CHANGELOG.md` | Modify | 新增用户可见功能记录 |
| `docs/superpowers/plans/2026-07-22-wechat-mode.md` | Modify | 执行勾选与验收记录 |

---

### Task 1: 提供无副作用的公众号 HTML 渲染 API

**Why:** 前端预览、复制和导出必须复用现有 Python formatter，避免普通 Markdown 预览和公众号输出发生差异。

**Files:**
- Modify: `tools/wechat_formatter.py`
- Modify: `server.py`
- Create: `tests/test_wechat_format_api.py`

**Interfaces:**
- `render_document(source: str, source_dir: Path) -> str`：返回完整自包含 HTML，不写文件。
- `async handle_wechat_format(request) -> web.Response`：接收 `{path, content}`，返回 `{ok, html, text, filename}`。

- [ ] **Step 1: 写 API 和 formatter 的失败测试**

```python
async def test_wechat_format_returns_self_contained_html(client, tmp_workspace):
    article = tmp_workspace / "article.md"
    article.write_text("# 标题\n\n![图](shot.svg)", encoding="utf-8")
    (tmp_workspace / "shot.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding="utf-8")
    response = await client.post("/api/wechat/format", json={
        "path": str(article), "content": article.read_text(encoding="utf-8")
    })
    data = await response.json()
    assert response.status == 200 and data["ok"] is True
    assert "data:image/svg+xml;base64," in data["html"]
    assert "<style>" in data["html"] and data["text"] == article.read_text(encoding="utf-8")
    assert data["filename"] == "article-wechat.html"

async def test_wechat_format_rejects_outside_path_and_non_md(client, tmp_workspace):
    outside = tmp_workspace.parent / "outside.md"
    outside.write_text("# no", encoding="utf-8")
    response = await client.post("/api/wechat/format", json={
        "path": str(outside), "content": "# no"
    })
    assert response.status == 403
    html_file = tmp_workspace / "article.html"
    html_file.write_text("<h1>no</h1>", encoding="utf-8")
    response = await client.post("/api/wechat/format", json={
        "path": str(html_file), "content": "# no"
    })
    assert response.status == 400
```

- [ ] **Step 2: 运行失败测试确认接口尚不存在**

Run:

```bash
python3 -m pytest tests/test_wechat_format_api.py -q
```

Expected: collection or request failure because `render_document` and `/api/wechat/format` are not implemented.

- [ ] **Step 3: 实现 `render_document` 和安全 API**

在 `tools/wechat_formatter.py` 中把 `_document` 通过下面的公开函数复用：

```python
def render_document(source: str, source_dir: Path) -> str:
    return _document(render_markdown(source, source_dir))
```

在 `server.py` 中实现：

```python
async def handle_wechat_format(request):
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as error:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {error}"}, status=400)
    raw_path = (data.get("path") or "").strip()
    content = data.get("content")
    if not raw_path or not isinstance(content, str):
        return web.json_response({"ok": False, "error": "path/content 必填"}, status=400)
    safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.json_response({"ok": False, "error": "非法路径"}, status=403)
    if safe.suffix.lower() != ".md":
        return web.json_response({"ok": False, "error": "只支持 Markdown 文件"}, status=400)
    try:
        from tools.wechat_formatter import render_document
        html = render_document(content, safe.parent)
    except (OSError, UnicodeError, ValueError) as error:
        return web.json_response({"ok": False, "error": str(error)}, status=422)
    return web.json_response({
        "ok": True,
        "html": html,
        "text": content,
        "filename": f"{safe.stem}-wechat.html",
    })
```

将 `app.router.add_post("/api/wechat/format", handle_wechat_format)` 注册在现有 API 路由区；不写文件、不调用快照。

- [ ] **Step 4: 运行 API 测试并提交**

Run:

```bash
python3 -m pytest tests/test_wechat_format_api.py -q
```

Expected: all API tests pass. Commit:

```bash
git add tools/wechat_formatter.py server.py tests/test_wechat_format_api.py
git commit -m "feat: expose local WeChat formatter API"
```

### Task 2: 增加公众号模式 UI 与请求状态

**Why:** 用户需要在现有 Markdown 编辑器中直接进入公众号工作区，保持原文编辑与自动保存连续。

**Files:**
- Modify: `web/md-editor.html`
- Create: `tests/test_wechat_mode_static.py`

**Interfaces:**
- `data-view-mode` 新增 `wechat`；原 `source/split/preview` 保持兼容。
- `window.__MD_WECHAT_CTL__ = { enter, exit, refresh, copyHtml, exportHtml }` 供浏览器验证使用。

- [ ] **Step 1: 写前端静态失败测试**

```python
from pathlib import Path

MD_EDITOR = Path("web/md-editor.html").read_text(encoding="utf-8")

def test_wechat_mode_contract_is_present():
    assert "data-view=\"wechat\"" in MD_EDITOR
    assert "wechat-preview-frame" in MD_EDITOR
    assert "复制 HTML" in MD_EDITOR
    assert "导出 HTML" in MD_EDITOR
    assert "__MD_WECHAT_CTL__" in MD_EDITOR
```

- [ ] **Step 2: 运行失败测试确认 UI 尚不存在**

Run:

```bash
python3 -m pytest tests/test_wechat_mode_static.py -q
```

Expected: FAIL because the `wechat` button and controller are absent.

- [ ] **Step 3: 添加按钮、工作区和客户端控制器**

在 `md-view-toolbar` 增加：

```html
<button class="md-view-btn" data-view="wechat" id="btn-wechat">📰 公众号排版</button>
<span class="md-wechat-actions" id="md-wechat-actions" hidden>
  <button class="md-wechat-action" id="btn-wechat-copy">复制 HTML</button>
  <button class="md-wechat-action" id="btn-wechat-export">导出 HTML</button>
  <span class="md-wechat-status" id="md-wechat-status"></span>
</span>
```

在预览 pane 中添加 `iframe#wechat-preview-frame`，并在现有编辑监听旁新增：

```javascript
var wechatTimer = null;
var wechatAbort = null;
var wechatState = { html: "", text: "", filename: "" };

function requestWechatPreview() {
  clearTimeout(wechatTimer);
  wechatTimer = setTimeout(async function () {
    if (wechatAbort) wechatAbort.abort();
    wechatAbort = new AbortController();
    var response = await fetch("/api/wechat/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.__DOC_CENTER__.filePath, content: input.value }),
      signal: wechatAbort.signal
    });
    var data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "公众号排版失败");
    wechatState = data;
    document.getElementById("wechat-preview-frame").srcdoc = data.html;
  }, 250);
}
```

控制器必须：

- 进入 `wechat` 时显示工作区和操作按钮，立即请求一次预览；
- 输入变化时继续触发原有 150ms 普通预览和 250ms 公众号预览；
- `copyHtml` 使用 `new ClipboardItem({"text/html": Blob(html), "text/plain": Blob(text)})`，失败时调用现有纯文本复制兜底；
- `exportHtml` 创建 `Blob([html], {type: "text/html;charset=utf-8"})`、临时 `<a download>` 并释放 URL；
- 请求错误只更新状态文字，不清空上一次成功的预览；
- 点击 source/split/preview 时退出公众号操作条；
- 不改变 `input` 的 input 事件，因此 saver-runtime 的 MD 快照不受影响。

- [ ] **Step 4: 运行静态测试并提交 UI**

Run:

```bash
python3 -m pytest tests/test_wechat_mode_static.py -q
```

Expected: all static contract tests pass. Commit:

```bash
git add web/md-editor.html tests/test_wechat_mode_static.py
git commit -m "feat: add WeChat publishing mode to Markdown editor"
```

### Task 3: 文档、浏览器验证与回归

**Why:** 该功能涉及 iframe、剪贴板、文件下载和现有 MD 保存链路，必须做真实交互验证并记录用户可见变化。

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-07-22-wechat-mode.md`

- [ ] **Step 1: 更新 CHANGELOG**

新增版本条目，包含用户故事、公众号入口、复制/导出、安全边界和不影响 HTML 编辑的说明。

- [ ] **Step 2: 运行自动化回归**

Run:

```bash
python3 -m pytest tests/ -q
python3 - <<'PY'
from pathlib import Path
from html.parser import HTMLParser
s = Path("articles/macos-dmg-distribution-wechat.html").read_text(encoding="utf-8")
assert "data:image/svg+xml;base64," in s
assert "<script" not in s and "<link" not in s
print("wechat output: OK")
PY
```

Expected: all tests pass and the existing generated article remains self-contained.

- [ ] **Step 3: 真实浏览器验证**

在 localhost 服务中打开 `.md` 文件并执行：

1. 点击「公众号排版」；
2. 修改正文，确认右侧预览更新；
3. 点击「复制 HTML」，检查剪贴板含 `text/html` 与 `text/plain`；
4. 点击「导出 HTML」，确认下载文件可独立打开；
5. 切回普通三视图，确认 Markdown 预览与自动快照仍正常；
6. 打开一个 HTML 文件回归原有编辑功能。

- [ ] **Step 4: 勾选计划并提交文档**

```bash
git add CHANGELOG.md docs/superpowers/plans/2026-07-22-wechat-mode.md
git commit -m "docs: document WeChat publishing mode"
```

## Acceptance Criteria

- `.md` 编辑器顶部有公众号排版入口；
- 公众号模式左侧编辑、右侧苹果风格实时预览；
- 复制同时提供 `text/html` 和 `text/plain`；
- 导出的 HTML 可脱离服务独立打开，图片和样式不依赖外部资源；
- 非法路径和非 MD 请求被拒绝；
- 现有普通 Markdown 预览、自动快照、三选项保存和 HTML 编辑流程无退化；
- 自动化测试、HTML 结构检查和真实浏览器验证全部通过。


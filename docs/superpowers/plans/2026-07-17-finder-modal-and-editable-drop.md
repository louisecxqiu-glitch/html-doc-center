# Finder 风格 modal + 拖入可编辑 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增"打开文件"按钮 + Finder 风格双栏 modal + 拖入文件可编辑 + 填充"最近打开" tab。

**Architecture:** 3 个子功能都走现有 `openFile(node)` 入口，复用编辑/快照/三选一保存逻辑。后端扩展 `/api/browse?mode=file` + 新增 `/api/drag-upload` + `/api/save-as` + `_dropbox/` 7 天清理。前端重写 modal 为双栏（左侧 Shortcuts/Pinned/Recent + 右侧 Today/Earlier 时间分组），mode 切换 folder/file。拖入改走 server 写副本 + `openFile`，关闭时弹"另存为/丢弃"二选一。

**Tech Stack:** Python 3 + aiohttp（后端），vanilla JS + HTML + CSS（前端），pytest（测试），localStorage（最近打开持久化）。

## Global Constraints

- **跨平台**：Windows + macOS，路径处理用 `pathlib.Path`，前端用 `path.split(/[/\\]/)`
- **浏览器无关**：不用 `window.showDirectoryPicker` / `showOpenFilePicker`（Safari/Firefox 不支持）
- **向后兼容**：`/api/browse` 不传 `mode` 时返回结构完全不变
- **文件类型限制**：只支持 `.html` / `.htm` / `.md`
- **`_dropbox/` 位置**：`<server 工作目录>/_dropbox/`
- **`_dropbox/` 清理**：启动时删除 7 天前文件，清理失败不阻塞启动
- **拖入文件大小限制**：≤ 10MB
- **"最近打开"上限**：20 条，localStorage key `doccenter.recent-files`
- **i18n**：所有用户可见文案必须走 `data-i18n*` 属性 + en.js/zh.js 双语
- **缓存破坏**：每次改 web/* 静态资源必须 bump `index.html` 里的 `?v=` query
- **commit message**：英文，Conventional Commits 风格
- **测试**：后端 TDD（pytest），前端手动浏览器演练

## 文件结构

**新建文件**：
- `tests/__init__.py` — pytest 包标记
- `tests/conftest.py` — pytest fixtures（aiohttp test client + 临时 _dropbox 目录）
- `tests/test_browse_with_files.py` — /api/browse?mode=file 测试
- `tests/test_drag_upload.py` — /api/drag-upload 测试
- `tests/test_save_as.py` — /api/save-as 测试
- `tests/test_dropbox_cleanup.py` — _dropbox/ 清理测试
- `tests/manual-checklist.md` — 5 个核心场景手动演练清单
- `pytest.ini` — pytest 配置

**修改文件**：
- `server.py` — 扩展 `handle_browse`，新增 `handle_drag_upload` + `handle_save_as` + `_dropbox/` 清理逻辑 + 路由注册
- `web/index.html` — modal HTML 结构重写为双栏，新增 sidebar "打开文件" 按钮，welcome 页新增"打开文件"按钮，bump `?v=`
- `web/app.js` — modal 渲染逻辑改造（双栏 + mode 切换 + 时间分组），drop handler 改造，"最近打开" tab 填充，`openFile` 钩子，拖入关闭二选一，另存为 modal 集成
- `web/style.css` — modal 双栏样式，左侧栏样式，时间分组样式，文件行样式，dropbox 二选一对话框样式
- `web/locales/en.js` — 新增 i18n key
- `web/locales/zh.js` — 新增 i18n key
- `CHANGELOG.md` — 新增 v1.19.0 entry

---

## Task 1: 测试基础设施 + /api/browse?mode=file 扩展

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `pytest.ini`
- Create: `tests/test_browse_with_files.py`
- Modify: `server.py:536-600`（`handle_browse` 函数）

**Interfaces:**
- Consumes: `server.py` 的 `handle_browse` 函数 + `app` 对象 + config
- Produces: `/api/browse?mode=file` 返回 `{ok, current, parent, is_root, dirs, files}`，`files` 元素含 `{name, path, size, mtime, type}`

**背景**：现有 `handle_browse` 在 `server.py:536-600`，不传 path 时返回 `is_root=true` + 快捷入口 dirs；传 path 时返回子目录 dirs。本 task 扩展为支持 `mode=file` 参数，额外返回 files 列表。

- [ ] **Step 1: 创建测试基础设施**

创建 `pytest.ini`：

```ini
[pytest]
testpaths = tests
python_files = test_*.py
asyncio_mode = auto
```

创建 `tests/__init__.py`（空文件）：

```python
```

创建 `tests/conftest.py`：

```python
"""Pytest fixtures for DocCenter server tests."""
import asyncio
import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

# 把项目根目录加到 sys.path，让 tests 能 import server
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture
def tmp_workspace(tmp_path):
    """创建一个临时工作目录，含 _dropbox/ 子目录。"""
    dropbox = tmp_path / "_dropbox"
    dropbox.mkdir()
    return tmp_path


@pytest.fixture
def sample_dir(tmp_workspace):
    """在 tmp_workspace 下创建一个含 HTML/MD/其他文件的目录，用于测试 browse。"""
    d = tmp_workspace / "sample"
    d.mkdir()
    # HTML 文件
    (d / "report.html").write_text("<html><body>report</body></html>", encoding="utf-8")
    # MD 文件
    (d / "notes.md").write_text("# Notes\n\nhello", encoding="utf-8")
    # 其他文件（应被过滤）
    (d / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n fake png")
    (d / "data.json").write_text('{"k":"v"}', encoding="utf-8")
    # 子目录
    (d / "subdir").mkdir()
    return d


@pytest.fixture
def event_loop():
    """pytest-asyncio 兼容：每个测试用独立 event loop。"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
```

- [ ] **Step 2: 写失败测试**

创建 `tests/test_browse_with_files.py`：

```python
"""Tests for /api/browse?mode=file extension."""
import json
from pathlib import Path

import pytest
from aiohttp.test_utils import TestClient, TestServer

import server


@pytest.fixture
async def client(tmp_workspace, monkeypatch):
    """启动一个测试用 server，工作目录指向 tmp_workspace。"""
    # 让 server 把 _dropbox/ 放在 tmp_workspace 下
    monkeypatch.chdir(tmp_workspace)
    # 最小 config
    monkeypatch.setattr(server, "CONFIG_PATH", str(tmp_workspace / "config.json"))
    (tmp_workspace / "config.json").write_text(
        json.dumps({"scan_roots": [], "tree_auto_refresh_seconds": 0}),
        encoding="utf-8",
    )
    app = server.create_app()
    test_server = TestServer(app)
    async with test_server.start_server():
        async with TestClient(test_server) as c:
            yield c


async def test_browse_with_files_returns_files_list(client, sample_dir):
    """/api/browse?path=<dir>&mode=file 应该返回 files 列表，含 name/path/size/mtime/type。"""
    resp = await client.get(f"/api/browse?path={sample_dir}&mode=file")
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
    assert data["is_root"] is False
    assert "files" in data, "mode=file 时必须返回 files 字段"
    # 应该有 2 个文件（report.html + notes.md），png/json 被过滤
    file_names = [f["name"] for f in data["files"]]
    assert "report.html" in file_names
    assert "notes.md" in file_names
    assert "image.png" not in file_names
    assert "data.json" not in file_names
    # 每个文件应有完整字段
    for f in data["files"]:
        assert "name" in f
        assert "path" in f
        assert "size" in f and isinstance(f["size"], int) and f["size"] > 0
        assert "mtime" in f and isinstance(f["mtime"], (int, float)) and f["mtime"] > 0
        assert "type" in f and f["type"] in ("html", "md")


async def test_browse_with_files_filter_only_html_md(client, sample_dir):
    """mode=file 只返回 .html/.htm/.md，过滤其他扩展名。"""
    resp = await client.get(f"/api/browse?path={sample_dir}&mode=file")
    data = await resp.json()
    for f in data["files"]:
        ext = Path(f["name"]).suffix.lower()
        assert ext in (".html", ".htm", ".md"), f"不应返回 {ext} 文件"


async def test_browse_without_mode_backward_compatible(client, sample_dir):
    """不传 mode 时返回结构完全不变（没有 files 字段），向后兼容。"""
    resp = await client.get(f"/api/browse?path={sample_dir}")
    data = await resp.json()
    assert data["ok"] is True
    assert "dirs" in data
    assert "files" not in data, "不传 mode 时不应返回 files 字段（向后兼容）"


async def test_browse_root_with_mode_file_returns_empty_files(client):
    """is_root=true 时 files 为空数组（快捷入口页没有文件）。"""
    resp = await client.get("/api/browse?mode=file")
    data = await resp.json()
    assert data["ok"] is True
    assert data["is_root"] is True
    assert data["files"] == []
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_browse_with_files.py -v 2>&1 | head -40`

Expected: FAIL，因为 `server.create_app` 可能不存在或 `mode=file` 还没实现。

> 注意：如果 `server.create_app` 不存在，需要先看 server.py 的入口结构。先 grep `create_app\|def main\|if __name__` 找到 app 工厂函数名，然后调整 fixture。如果 server.py 没有 app 工厂函数，本 task 要顺便重构出一个。

- [ ] **Step 4: 看 server.py 入口结构，确认 app 工厂函数名**

Run: `grep -n "def main\|def create_app\|def build_app\|if __name__\|app = web.Application" "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center/server.py"`

如果发现 app 是在 `if __name__ == "__main__":` 块里直接创建的，没有工厂函数，需要先重构出一个 `create_app()` 函数。把 app 创建 + 路由注册逻辑抽到 `create_app()` 函数里，`main()` 调用 `create_app()` 后 `web.run_app(app)`。

- [ ] **Step 5: 实现 create_app() 工厂函数（如果不存在）**

修改 `server.py`，在路由注册代码之前加：

```python
def create_app():
    """Application factory for aiohttp. Used by both main() and tests."""
    app = web.Application(client_max_size=1024 * 1024 * 50)  # 50MB for drag-upload
    app["config"] = load_config()
    # ... 现有的 app["config"] 初始化逻辑 ...
    register_routes(app)
    return app


def register_routes(app):
    """Register all URL routes. Called by create_app()."""
    app.router.add_get("/", handle_index)
    app.router.add_get("/static/{fname:.+}", handle_static)
    # ... 把现有所有 app.router.add_* 调用搬到这里 ...
```

然后 `if __name__ == "__main__":` 块改成：

```python
if __name__ == "__main__":
    app = create_app()
    web.run_app(app, host=HOST, port=PORT)
```

- [ ] **Step 6: 扩展 handle_browse 支持 mode=file**

修改 `server.py` 的 `handle_browse` 函数（约 536-600 行）。在函数开头加 `mode = request.query.get("mode", "")`，然后在 `is_root=False` 分支的子目录列表后面加文件列表逻辑：

```python
async def handle_browse(request):
    """GET /api/browse?path=...&mode=file - 浏览目录，返回子目录列表（+ 文件列表当 mode=file）。"""
    target = request.query.get("path", "")
    mode = request.query.get("mode", "")  # 新增："" 或 "file"
    try:
        if not target:
            # 没传 path，返回常用起始点（现有逻辑不变）
            home = str(Path.home())
            roots = [
                {"name": "🏠 主目录", "path": home},
                {"name": "📁 桌面", "path": str(Path(home) / "Desktop")},
                {"name": "📄 文稿", "path": str(Path(home) / "Documents")},
                {"name": "⬇️ 下载", "path": str(Path(home) / "Downloads")},
            ]
            # v1.18.3: Windows OneDrive 重定向兜底
            if platform.system() == "Windows":
                onedrive = os.environ.get("OneDrive", "")
                if onedrive:
                    for r in roots:
                        if "桌面" in r["name"] or "Desktop" in r["name"]:
                            od_desktop = os.path.join(onedrive, "Desktop")
                            if Path(od_desktop).is_dir():
                                r["path"] = od_desktop
                        if "文稿" in r["name"] or "Documents" in r["name"]:
                            od_docs = os.path.join(onedrive, "Documents")
                            if Path(od_docs).is_dir():
                                r["path"] = od_docs
            roots = [r for r in roots if Path(r["path"]).is_dir()]
            cfg = request.app["config"]
            for item in cfg.get("scan_roots", []):
                p = item["path"] if isinstance(item, dict) else item
                parent = str(Path(p).parent)
                if parent not in [r["path"] for r in roots] and Path(parent).is_dir():
                    name = Path(parent).name or parent
                    roots.append({"name": f"📌 {name}", "path": parent})
            resp = {
                "ok": True, "current": "", "parent": "",
                "dirs": roots, "is_root": True
            }
            if mode == "file":
                resp["files"] = []  # root 时没有文件
            return web.json_response(resp)

        rp = Path(target).expanduser().resolve()
        if not rp.exists() or not rp.is_dir():
            return web.json_response({"ok": False, "error": "目录不存在"}, status=400)

        # 列出子目录（排除隐藏目录，按名称排序）
        children = []
        try:
            for entry in sorted(rp.iterdir(), key=lambda e: e.name.lower()):
                if entry.is_dir() and not entry.name.startswith("."):
                    children.append({
                        "name": entry.name,
                        "path": str(entry),
                    })
        except PermissionError:
            pass

        resp = {
            "ok": True,
            "current": str(rp),
            "parent": str(rp.parent) if rp != rp.parent else "",
            "dirs": children,
            "is_root": False
        }

        # mode=file 时额外返回 HTML/MD 文件列表
        if mode == "file":
            files = []
            try:
                for entry in sorted(rp.iterdir(), key=lambda e: e.name.lower()):
                    if entry.is_file() and not entry.name.startswith("."):
                        ext = entry.suffix.lower()
                        if ext in (".html", ".htm", ".md"):
                            stat = entry.stat()
                            files.append({
                                "name": entry.name,
                                "path": str(entry),
                                "size": stat.st_size,
                                "mtime": int(stat.st_mtime),
                                "type": "md" if ext == ".md" else "html",
                            })
            except PermissionError:
                pass
            resp["files"] = files

        return web.json_response(resp)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
```

- [ ] **Step 7: 跑测试确认通过**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_browse_with_files.py -v`

Expected: 4 个测试全部 PASS。

如果 `create_app` 重构导致现有 server 启动失败，先在终端跑一次 `python server.py` 确认服务能正常起来。

- [ ] **Step 8: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add tests/ pytest.ini server.py
git commit -m "feat(api): extend /api/browse with mode=file to return HTML/MD files

- Add tests/ infrastructure (pytest.ini, conftest.py with aiohttp TestClient fixture)
- Refactor server.py: extract create_app() factory for testability
- Extend handle_browse: when mode=file, include 'files' array with name/path/size/mtime/type
- Backward compatible: no mode param = no files field (existing callers unaffected)
- File filter: only .html/.htm/.md returned"
```

---

## Task 2: /api/drag-upload endpoint

**Files:**
- Create: `tests/test_drag_upload.py`
- Modify: `server.py`（新增 `handle_drag_upload` 函数 + 路由注册）

**Interfaces:**
- Consumes: `_dropbox/` 目录（在 server 工作目录下）
- Produces: `POST /api/drag-upload` 接收 multipart/form-data，返回 `{ok, abs_path, name, type}`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_drag_upload.py`：

```python
"""Tests for POST /api/drag-upload endpoint."""
import io
import json
from pathlib import Path

import pytest
from aiohttp import FormData
from aiohttp.test_utils import TestClient, TestServer

import server


@pytest.fixture
async def client(tmp_workspace, monkeypatch):
    monkeypatch.chdir(tmp_workspace)
    monkeypatch.setattr(server, "CONFIG_PATH", str(tmp_workspace / "config.json"))
    (tmp_workspace / "config.json").write_text(
        json.dumps({"scan_roots": [], "tree_auto_refresh_seconds": 0}),
        encoding="utf-8",
    )
    app = server.create_app()
    test_server = TestServer(app)
    async with test_server.start_server():
        async with TestClient(test_server) as c:
            yield c


async def test_drag_upload_html(client, tmp_workspace):
    """POST 一个 HTML 文件 → 写到 _dropbox/ → 返回 abs_path/name/type。"""
    form = FormData()
    form.add_field("file", b"<html><body>hello</body></html>", filename="test.html", content_type="text/html")
    form.add_field("filename", "test.html")
    resp = await client.post("/api/drag-upload", data=form)
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
    assert data["name"] == "test.html"
    assert data["type"] == "html"
    abs_path = Path(data["abs_path"])
    assert abs_path.exists(), "文件应该被写到 _dropbox/"
    assert "_dropbox" in str(abs_path)
    assert abs_path.read_text(encoding="utf-8") == "<html><body>hello</body></html>"


async def test_drag_upload_md(client, tmp_workspace):
    """POST 一个 MD 文件 → 写到 _dropbox/ → type=md。"""
    form = FormData()
    form.add_field("file", b"# Title\n\nhello", filename="notes.md", content_type="text/markdown")
    form.add_field("filename", "notes.md")
    resp = await client.post("/api/drag-upload", data=form)
    assert resp.status == 200
    data = await resp.json()
    assert data["type"] == "md"
    assert data["name"] == "notes.md"


async def test_drag_upload_oversize(client, tmp_workspace):
    """文件 > 10MB → 返回 413。"""
    big_content = b"x" * (10 * 1024 * 1024 + 1)  # 10MB + 1 byte
    form = FormData()
    form.add_field("file", big_content, filename="big.html", content_type="text/html")
    form.add_field("filename", "big.html")
    resp = await client.post("/api/drag-upload", data=form)
    assert resp.status == 413
    data = await resp.json()
    assert data["ok"] is False


async def test_drag_upload_invalid_type(client, tmp_workspace):
    """非 HTML/MD 文件 → 返回 400。"""
    form = FormData()
    form.add_field("file", b"\x89PNG fake", filename="image.png", content_type="image/png")
    form.add_field("filename", "image.png")
    resp = await client.post("/api/drag-upload", data=form)
    assert resp.status == 400
    data = await resp.json()
    assert data["ok"] is False


async def test_drag_upload_name_conflict(client, tmp_workspace):
    """同名文件 → 加 -YYYYMMDD-HHMMSS 后缀。"""
    # 第一次上传
    form1 = FormData()
    form1.add_field("file", b"<html>first</html>", filename="dup.html", content_type="text/html")
    form1.add_field("filename", "dup.html")
    resp1 = await client.post("/api/drag-upload", data=form1)
    assert resp1.status == 200
    data1 = await resp1.json()
    assert data1["name"] == "dup.html"

    # 第二次同名上传
    form2 = FormData()
    form2.add_field("file", b"<html>second</html>", filename="dup.html", content_type="text/html")
    form2.add_field("filename", "dup.html")
    resp2 = await client.post("/api/drag-upload", data=form2)
    assert resp2.status == 200
    data2 = await resp2.json()
    # 第二次应该有 timestamp 后缀
    assert data2["name"] != "dup.html"
    assert data2["name"].startswith("dup-") and data2["name"].endswith(".html")
    # 两个文件都应该存在
    assert Path(data1["abs_path"]).exists()
    assert Path(data2["abs_path"]).exists()
    assert Path(data1["abs_path"]).read_text(encoding="utf-8") == "<html>first</html>"
    assert Path(data2["abs_path"]).read_text(encoding="utf-8") == "<html>second</html>"
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_drag_upload.py -v`

Expected: FAIL，`/api/drag-upload` 路由不存在。

- [ ] **Step 3: 实现 handle_drag_upload**

在 `server.py` 的 `handle_browse` 函数后面加新函数：

```python
import time
from aiohttp import web, MultipartReader

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_UPLOAD_EXT = {".html", ".htm", ".md"}


def get_dropbox_dir():
    """Return _dropbox/ directory path under server CWD. Create if not exists."""
    dropbox = Path.cwd() / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    return dropbox


async def handle_drag_upload(request):
    """POST /api/drag-upload - 接收拖入的文件，写到 _dropbox/，返回 abs_path。"""
    try:
        reader = await request.multipart()
        file_field = None
        filename_field = None
        async for field in reader:
            if field.name == "file":
                file_field = field
            elif field.name == "filename":
                filename_field = (await field.text()).strip()

        if not file_field:
            return web.json_response({"ok": False, "error": "missing file field"}, status=400)
        if not filename_field:
            filename_field = file_field.filename or "unnamed.html"

        # 校验扩展名
        ext = Path(filename_field).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXT:
            return web.json_response(
                {"ok": False, "error": f"unsupported file type: {ext}, only .html/.htm/.md allowed"},
                status=400,
            )

        # 读内容（限制 10MB）
        content = await file_field.read(decode=False)
        if len(content) > MAX_UPLOAD_SIZE:
            return web.json_response(
                {"ok": False, "error": f"file too large ({len(content)} bytes > {MAX_UPLOAD_SIZE} bytes)"},
                status=413,
            )

        # 写到 _dropbox/，文件名冲突时加 timestamp 后缀
        dropbox = get_dropbox_dir()
        dest = dropbox / filename_field
        if dest.exists():
            stem = Path(filename_field).stem
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            dest = dropbox / f"{stem}-{timestamp}{ext}"
        dest.write_bytes(content)

        return web.json_response({
            "ok": True,
            "abs_path": str(dest),
            "name": dest.name,
            "type": "md" if ext == ".md" else "html",
        })
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
```

- [ ] **Step 4: 注册路由**

在 `server.py` 的 `register_routes` 函数里（或现有路由注册块）加：

```python
app.router.add_post("/api/drag-upload", handle_drag_upload)
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_drag_upload.py -v`

Expected: 5 个测试全部 PASS。

- [ ] **Step 6: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add tests/test_drag_upload.py server.py
git commit -m "feat(api): add POST /api/drag-upload endpoint

- Accept multipart/form-data with file + filename fields
- Write to _dropbox/ under server CWD
- Name conflict: append -YYYYMMDD-HHMMSS suffix
- Validation: 10MB max size, .html/.htm/.md only
- Returns {ok, abs_path, name, type}"
```

---

## Task 3: /api/save-as endpoint

**Files:**
- Create: `tests/test_save_as.py`
- Modify: `server.py`（新增 `handle_save_as` 函数 + 路由注册）

**Interfaces:**
- Consumes: 拖入副本路径（`_dropbox/` 下）+ 用户选的目标路径
- Produces: `POST /api/save-as` 接收 JSON `{src_path, dest_path}`，复制文件，返回 `{ok, dest_path}`

- [ ] **Step 1: 写失败测试**

创建 `tests/test_save_as.py`：

```python
"""Tests for POST /api/save-as endpoint."""
import json
from pathlib import Path

import pytest
from aiohttp.test_utils import TestClient, TestServer

import server


@pytest.fixture
async def client(tmp_workspace, monkeypatch):
    monkeypatch.chdir(tmp_workspace)
    monkeypatch.setattr(server, "CONFIG_PATH", str(tmp_workspace / "config.json"))
    (tmp_workspace / "config.json").write_text(
        json.dumps({"scan_roots": [], "tree_auto_refresh_seconds": 0}),
        encoding="utf-8",
    )
    app = server.create_app()
    test_server = TestServer(app)
    async with test_server.start_server():
        async with TestClient(test_server) as c:
            yield c


async def test_save_as_copy_success(client, tmp_workspace):
    """源文件存在 → 复制到目标 → 返回 ok + dest_path。"""
    src = tmp_workspace / "src.html"
    src.write_text("<html>original</html>", encoding="utf-8")
    dest = tmp_workspace / "dest.html"
    resp = await client.post("/api/save-as", json={"src_path": str(src), "dest_path": str(dest)})
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
    assert data["dest_path"] == str(dest)
    assert dest.exists()
    assert dest.read_text(encoding="utf-8") == "<html>original</html>"
    # 源文件不受影响
    assert src.exists()


async def test_save_as_target_exists(client, tmp_workspace):
    """目标已存在 → 返回 409。"""
    src = tmp_workspace / "src.html"
    src.write_text("<html>src</html>", encoding="utf-8")
    dest = tmp_workspace / "dest.html"
    dest.write_text("<html>existing</html>", encoding="utf-8")
    resp = await client.post("/api/save-as", json={"src_path": str(src), "dest_path": str(dest)})
    assert resp.status == 409
    data = await resp.json()
    assert data["ok"] is False
    assert "exists" in data["error"].lower()


async def test_save_as_source_not_found(client, tmp_workspace):
    """源文件不存在 → 返回 404。"""
    dest = tmp_workspace / "dest.html"
    resp = await client.post("/api/save-as", json={
        "src_path": str(tmp_workspace / "nonexistent.html"),
        "dest_path": str(dest),
    })
    assert resp.status == 404
    data = await resp.json()
    assert data["ok"] is False


async def test_save_as_preserves_mtime(client, tmp_workspace):
    """复制保留 mtime（shutil.copy2）。"""
    import os
    import time
    src = tmp_workspace / "src.html"
    src.write_text("<html>x</html>", encoding="utf-8")
    # 设一个明确的 mtime
    old_mtime = 1000000000  # 2001-09-09
    os.utime(src, (old_mtime, old_mtime))
    dest = tmp_workspace / "dest.html"
    await client.post("/api/save-as", json={"src_path": str(src), "dest_path": str(dest)})
    assert dest.stat().st_mtime == old_mtime
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_save_as.py -v`

Expected: FAIL，`/api/save-as` 路由不存在。

- [ ] **Step 3: 实现 handle_save_as**

在 `server.py` 的 `handle_drag_upload` 后面加：

```python
import shutil

async def handle_save_as(request):
    """POST /api/save-as - 复制文件到新位置（拖入副本另存为）。"""
    try:
        body = await request.json()
        src_path = body.get("src_path", "")
        dest_path = body.get("dest_path", "")
        if not src_path or not dest_path:
            return web.json_response({"ok": False, "error": "missing src_path or dest_path"}, status=400)

        src = Path(src_path).expanduser().resolve()
        dest = Path(dest_path).expanduser().resolve()

        if not src.exists():
            return web.json_response({"ok": False, "error": "source_not_found"}, status=404)
        if dest.exists():
            return web.json_response({"ok": False, "error": "target_exists"}, status=409)

        # 确保目标父目录存在
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(src, dest)  # copy2 保留 mtime
        except PermissionError:
            return web.json_response({"ok": False, "error": "permission_denied"}, status=403)

        return web.json_response({"ok": True, "dest_path": str(dest)})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
```

- [ ] **Step 4: 注册路由**

在 `register_routes` 函数里加：

```python
app.router.add_post("/api/save-as", handle_save_as)
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_save_as.py -v`

Expected: 4 个测试全部 PASS。

- [ ] **Step 6: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add tests/test_save_as.py server.py
git commit -m "feat(api): add POST /api/save-as endpoint

- Accept JSON {src_path, dest_path}, copy file with shutil.copy2 (preserves mtime)
- Returns 409 if target exists, 404 if source missing, 403 on permission error
- Creates parent dirs as needed"
```

---

## Task 4: _dropbox/ 启动清理 + 路由注册收尾

**Files:**
- Create: `tests/test_dropbox_cleanup.py`
- Modify: `server.py`（新增 `cleanup_dropbox` 函数 + 在 app 启动时调用）

**Interfaces:**
- Consumes: `_dropbox/` 目录
- Produces: 启动时清理 7 天前文件，清理失败不阻塞启动

- [ ] **Step 1: 写失败测试**

创建 `tests/test_dropbox_cleanup.py`：

```python
"""Tests for _dropbox/ cleanup logic."""
import json
import os
import time
from pathlib import Path

import pytest
from aiohttp.test_utils import TestClient, TestServer

import server


def test_dropbox_cleanup_removes_7day_old_files(tmp_workspace, monkeypatch):
    """7 天前的文件应被清理。"""
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    # 旧文件（8 天前）
    old_file = dropbox / "old.html"
    old_file.write_text("<html>old</html>", encoding="utf-8")
    old_mtime = time.time() - 8 * 86400
    os.utime(old_file, (old_mtime, old_mtime))
    # 新文件（1 天前）
    new_file = dropbox / "new.html"
    new_file.write_text("<html>new</html>", encoding="utf-8")

    server.cleanup_dropbox()

    assert not old_file.exists(), "8 天前的文件应被删除"
    assert new_file.exists(), "1 天前的文件应保留"


def test_dropbox_cleanup_keeps_recent_files(tmp_workspace, monkeypatch):
    """7 天内的文件应保留。"""
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    recent = dropbox / "recent.html"
    recent.write_text("x", encoding="utf-8")
    # 6 天前
    mtime = time.time() - 6 * 86400
    os.utime(recent, (mtime, mtime))

    server.cleanup_dropbox()
    assert recent.exists()


def test_dropbox_cleanup_failure_nonfatal(tmp_workspace, monkeypatch):
    """清理失败不抛异常（不阻塞启动）。"""
    monkeypatch.chdir(tmp_workspace)
    # _dropbox 不存在时 cleanup 应该静默创建 + 不抛
    dropbox = tmp_workspace / "_dropbox"
    if dropbox.exists():
        # 删掉让它不存在，测试 cleanup 能优雅处理
        import shutil
        shutil.rmtree(dropbox)
    # 不应抛异常
    server.cleanup_dropbox()
    # cleanup 后应该创建了 _dropbox/
    assert dropbox.exists()


def test_dropbox_cleanup_skips_non_files(tmp_workspace, monkeypatch):
    """_dropbox/ 下的子目录不应被删除（只清理文件）。"""
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    subdir = dropbox / "subdir"
    subdir.mkdir()
    # 子目录设为很旧的 mtime
    old_mtime = time.time() - 30 * 86400
    os.utime(subdir, (old_mtime, old_mtime))

    server.cleanup_dropbox()
    assert subdir.exists(), "子目录不应被 cleanup 删除"
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_dropbox_cleanup.py -v`

Expected: FAIL，`server.cleanup_dropbox` 不存在。

- [ ] **Step 3: 实现 cleanup_dropbox**

在 `server.py` 的 `get_dropbox_dir` 函数后面加：

```python
DROPBOX_MAX_AGE_DAYS = 7


def cleanup_dropbox():
    """Clean up _dropbox/ files older than DROPBOX_MAX_AGE_DAYS. Non-fatal on errors."""
    try:
        dropbox = get_dropbox_dir()  # 也会创建目录如果不存在
        cutoff = time.time() - DROPBOX_MAX_AGE_DAYS * 86400
        for entry in dropbox.iterdir():
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink()
            except Exception as e:
                _log(f"⚠️ _dropbox/ cleanup: failed to delete {entry}: {e}")
    except Exception as e:
        _log(f"⚠️ _dropbox/ cleanup failed (non-fatal): {e}")
```

- [ ] **Step 4: 在 create_app 启动时调用 cleanup**

修改 `server.py` 的 `create_app` 函数，在 return 前加：

```python
def create_app():
    """Application factory for aiohttp. Used by both main() and tests."""
    app = web.Application(client_max_size=1024 * 1024 * 50)
    app["config"] = load_config()
    register_routes(app)
    # 启动时清理 _dropbox/ 旧文件
    cleanup_dropbox()
    return app
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/test_dropbox_cleanup.py -v`

Expected: 4 个测试全部 PASS。

- [ ] **Step 6: 跑全部后端测试，确认无回归**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/ -v`

Expected: 全部 PASS（test_browse_with_files + test_drag_upload + test_save_as + test_dropbox_cleanup）。

- [ ] **Step 7: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add tests/test_dropbox_cleanup.py server.py
git commit -m "feat(api): add _dropbox/ cleanup on startup (7-day retention)

- cleanup_dropbox() removes files older than 7 days from _dropbox/
- Called once at create_app() startup
- Non-fatal: cleanup failure logs warning but does not block startup
- Only removes files, preserves subdirectories"
```

---

## Task 5: 前端 i18n key 新增

**Files:**
- Modify: `web/locales/en.js`
- Modify: `web/locales/zh.js`

**Interfaces:**
- Consumes: 设计文档第 4 节所有 UI 文案需求
- Produces: 所有新 UI 元素的 en/zh 双语 key

**背景**：本 task 纯文案新增，无测试。所有 key 命名遵循现有 `<area>.<sub>.<element>` 约定。

- [ ] **Step 1: 在 en.js 末尾（`};` 之前）新增 key**

打开 `web/locales/en.js`，在最后一个 key 后面、`};` 之前加：

```javascript

  // ====== v1.19: Finder-style modal + drag-editable ======
  'modal.folder.title.file': '📂 Open a file',
  'modal.folder.title.folder': '📂 Select a folder',
  'modal.folder.shortcuts': '📍 Shortcuts',
  'modal.folder.pinned': '📌 Pinned',
  'modal.folder.recent': '🕐 Recent',
  'modal.folder.group.today': 'Today',
  'modal.folder.group.earlier': 'Earlier',
  'modal.folder.empty_dir': 'No sub-folders here',
  'modal.folder.empty_files': 'No HTML/Markdown files in this directory',
  'modal.folder.size_kb': '{n} KB',
  'modal.folder.size_mb': '{n} MB',
  'modal.folder.rel_time.hours': '{n}h ago',
  'modal.folder.rel_time.days': '{n}d ago',
  'modal.folder.rel_time.now': 'just now',
  'modal.folder.confirm.file': 'Open this file',
  'modal.folder.confirm.folder': 'Choose this folder',
  'modal.folder.selected.file': 'Selected: {name}',
  'modal.folder.selected.folder': 'Selected: {path}',
  'modal.folder.recent.empty': 'No recently opened files yet',
  'modal.folder.dropbox_save_as_title': '💾 Save dropbox file as…',
  'modal.folder.dropbox_save_as_hint': 'Choose where to save your edited copy',
  'modal.folder.dropbox_save_as_filename': 'File name',
  'modal.folder.dropbox_save_as_overwrite_confirm': 'A file with this name already exists. Overwrite?',
  'sidebar.open_file.tooltip': 'Open a file (⌘O)',
  'sidebar.open_file.btn': '📂',
  'welcome.open_file': '📄 Open a file',
  'dlg.dropbox.title': 'This dropbox file has unsaved changes',
  'dlg.dropbox.save_as': 'Save as new version',
  'dlg.dropbox.save_as.desc': 'Choose a location to save your edited copy',
  'dlg.dropbox.discard': 'Discard',
  'dlg.dropbox.discard.desc': 'Drop the dropbox copy, edits lost',
  'breadcrumb.dropbox': '📥 Dropbox copy',
  'toast.drag.uploaded': 'Loaded to dropbox (editable): {name}',
  'toast.drag.upload_failed': 'Upload failed: {msg}',
  'toast.save_as.success': 'Saved as: {path}',
  'toast.save_as.failed': 'Save as failed: {msg}',
  'toast.recent.file_deleted': 'File no longer exists, removed from recent: {name}',
  'sidebar.recent.opened_ago': 'opened {time}',
```

- [ ] **Step 2: 在 zh.js 末尾（`};` 之前）新增对应中文 key**

打开 `web/locales/zh.js`，在最后一个 key 后面、`};` 之前加：

```javascript

  // ====== v1.19: Finder 风格 modal + 拖入可编辑 ======
  'modal.folder.title.file': '📂 打开文件',
  'modal.folder.title.folder': '📂 选择文件夹',
  'modal.folder.shortcuts': '📍 快捷入口',
  'modal.folder.pinned': '📌 已固定',
  'modal.folder.recent': '🕐 最近打开',
  'modal.folder.group.today': '今天',
  'modal.folder.group.earlier': '更早',
  'modal.folder.empty_dir': '此目录无子文件夹',
  'modal.folder.empty_files': '此目录无 HTML/Markdown 文件',
  'modal.folder.size_kb': '{n} KB',
  'modal.folder.size_mb': '{n} MB',
  'modal.folder.rel_time.hours': '{n}小时前',
  'modal.folder.rel_time.days': '{n}天前',
  'modal.folder.rel_time.now': '刚刚',
  'modal.folder.confirm.file': '打开此文件',
  'modal.folder.confirm.folder': '选择此文件夹',
  'modal.folder.selected.file': '已选：{name}',
  'modal.folder.selected.folder': '已选：{path}',
  'modal.folder.recent.empty': '暂无最近打开的文件',
  'modal.folder.dropbox_save_as_title': '💾 将 dropbox 文件另存为…',
  'modal.folder.dropbox_save_as_hint': '选择编辑副本的保存位置',
  'modal.folder.dropbox_save_as_filename': '文件名',
  'modal.folder.dropbox_save_as_overwrite_confirm': '此名称的文件已存在。是否覆盖？',
  'sidebar.open_file.tooltip': '打开文件（⌘O）',
  'sidebar.open_file.btn': '📂',
  'welcome.open_file': '📄 打开文件',
  'dlg.dropbox.title': '此 dropbox 文件有未保存的改动',
  'dlg.dropbox.save_as': '另存为新版本',
  'dlg.dropbox.save_as.desc': '选择编辑副本的保存位置',
  'dlg.dropbox.discard': '丢弃',
  'dlg.dropbox.discard.desc': '丢弃 dropbox 副本，编辑丢失',
  'breadcrumb.dropbox': '📥 Dropbox 副本',
  'toast.drag.uploaded': '已加载到 dropbox（可编辑）：{name}',
  'toast.drag.upload_failed': '上传失败：{msg}',
  'toast.save_as.success': '已另存为：{path}',
  'toast.save_as.failed': '另存为失败：{msg}',
  'toast.recent.file_deleted': '文件已不存在，已从最近打开移除：{name}',
  'sidebar.recent.opened_ago': '{time}打开',
```

- [ ] **Step 3: 校验 JS 语法（吸取 v1.18.4 教训）**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && node --check web/locales/en.js && node --check web/locales/zh.js && echo "OK"`

Expected: 输出 `OK`，无 SyntaxError。

- [ ] **Step 4: grep 自检无未转义撇号**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && grep -nE "won't|don't|doesn't|isn't|can't|wouldn't|shouldn't|haven't|hasn't|hadn't|aren't|weren't|couldn't" web/locales/en.js`

Expected: 无输出（或仅匹配到 v1.18.4 已修复的 `won\'t`，那是有转义的）。

- [ ] **Step 5: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add web/locales/en.js web/locales/zh.js
git commit -m "feat(i18n): add v1.19 keys for Finder modal + dropbox + recent tab

- modal.folder.* : dual-pane modal titles, sections, groups, sizes, times
- dlg.dropbox.* : dropbox save-as/discard dialog
- sidebar.open_file.* + welcome.open_file : new entry buttons
- toast.* : drag upload, save-as, recent file deleted
- All keys 1:1 between en.js and zh.js
- Verified: node --check passes on both files"
```

---

## Task 6: modal HTML 结构 + CSS 双栏样式

**Files:**
- Modify: `web/index.html`（modal HTML 重写 + 新增按钮 + bump `?v=`）
- Modify: `web/style.css`（modal 双栏样式）

**Interfaces:**
- Consumes: i18n key（Task 5）
- Produces: 双栏 modal DOM 结构，CSS 类名供 Task 7 的 JS 操作

- [ ] **Step 1: 重写 modal HTML 结构**

打开 `web/index.html`，找到现有 `<!-- 目录浏览弹窗 -->` 块（约 226-240 行），替换为：

```html
  <!-- v1.19: Finder 风格双栏目录/文件浏览弹窗 -->
  <div class="modal-backdrop" id="browse-dialog" style="display:none;">
    <div class="modal modal-wide browse-modal browse-modal-finder">
      <div class="browse-modal-header">
        <h3 id="browse-modal-title" data-i18n="modal.folder.title.folder">📂 Select a folder</h3>
        <button class="modal-close-x" id="browse-close-x" title="Close">✕</button>
      </div>
      <div class="browse-finder-body">
        <aside class="browse-sidebar">
          <div class="browse-sidebar-section" id="browse-sidebar-shortcuts">
            <div class="browse-sidebar-label" data-i18n="modal.folder.shortcuts">📍 Shortcuts</div>
            <div class="browse-sidebar-list" id="browse-shortcuts-list"></div>
          </div>
          <div class="browse-sidebar-section" id="browse-sidebar-pinned">
            <div class="browse-sidebar-label" data-i18n="modal.folder.pinned">📌 Pinned</div>
            <div class="browse-sidebar-list" id="browse-pinned-list"></div>
          </div>
          <div class="browse-sidebar-section" id="browse-sidebar-recent">
            <div class="browse-sidebar-label" data-i18n="modal.folder.recent">🕐 Recent</div>
            <div class="browse-sidebar-list" id="browse-recent-list"></div>
          </div>
        </aside>
        <main class="browse-main">
          <div class="browse-breadcrumb" id="browse-breadcrumb"></div>
          <div class="browse-list" id="browse-list"></div>
        </main>
      </div>
      <div class="browse-actions">
        <div class="browse-selected" id="browse-selected"></div>
        <div class="browse-btns">
          <button class="btn-browse-cancel" id="browse-cancel" data-i18n="modal.folder.cancel">Cancel</button>
          <button class="btn-primary" id="browse-confirm" disabled data-i18n="modal.folder.confirm.folder">Choose this folder</button>
        </div>
      </div>
    </div>
  </div>

  <!-- v1.19: 拖入副本关闭时的二选一对话框 -->
  <div class="modal-backdrop" id="dropbox-save-dialog" style="display:none;">
    <div class="modal modal-wide dropbox-save-modal">
      <h3 data-i18n="dlg.dropbox.title">This dropbox file has unsaved changes</h3>
      <div class="save-options">
        <div class="save-option" id="dropbox-save-as-option">
          <b data-i18n="dlg.dropbox.save_as">Save as new version</b>
          <small data-i18n="dlg.dropbox.save_as.desc">Choose a location to save your edited copy</small>
        </div>
        <div class="save-option" id="dropbox-discard-option">
          <b data-i18n="dlg.dropbox.discard">Discard</b>
          <small data-i18n="dlg.dropbox.discard.desc">Drop the dropbox copy, edits lost</small>
        </div>
      </div>
      <button class="modal-close" id="dropbox-cancel" data-i18n="btn.cancel">Cancel</button>
    </div>
  </div>
```

- [ ] **Step 2: 在 sidebar 顶部 ＋ 按钮旁加"打开文件"按钮**

找到 `web/index.html` 里 `<button id="btn-quick-add-dir" class="btn-quick-add" ...>＋</button>`（约 73 行），在它后面加：

```html
        <button id="btn-open-file" class="btn-quick-add" data-i18n-title="sidebar.open_file.tooltip" title="Open a file (⌘O)">📂</button>
```

- [ ] **Step 3: 在 welcome 页"添加文件夹"按钮旁加"打开文件"按钮**

找到 `<button class="btn-browse-large" id="btn-empty-add-dir" data-i18n="welcome.add_folder">📂 添加文件夹</button>`（约 119 行），在它后面加：

```html
            <button class="btn-browse-large" id="btn-empty-open-file" data-i18n="welcome.open_file">📄 打开文件</button>
```

- [ ] **Step 4: bump 所有 `?v=1.18.4` 到 `?v=1.19.0`**

`web/index.html` 里 5 处 `?v=1.18.4` 全部替换为 `?v=1.19.0`：
- `<link rel="stylesheet" href="/static/style.css?v=1.19.0" />`
- `<script src="/static/locales/en.js?v=1.19.0"></script>`
- `<script src="/static/locales/zh.js?v=1.19.0"></script>`
- `<script src="/static/i18n.js?v=1.19.0"></script>`
- `<script src="/static/app.js?v=1.19.0"></script>`

- [ ] **Step 5: 在 style.css 末尾新增 modal 双栏样式**

打开 `web/style.css`，在文件末尾加：

```css

/* ====== v1.19: Finder 风格双栏 modal ====== */
.browse-modal-finder {
  max-width: 900px;
  min-height: 540px;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.browse-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.browse-modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.modal-close-x {
  background: none;
  border: none;
  font-size: 18px;
  color: #888;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.modal-close-x:hover { background: #f0f0f0; color: #333; }

.browse-finder-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  flex: 1;
  overflow: hidden;
}

.browse-sidebar {
  border-right: 1px solid var(--border-color, #e0e0e0);
  overflow-y: auto;
  padding: 12px 0;
  background: var(--bg-sidebar, #fafafa);
}

.browse-sidebar-section {
  margin-bottom: 16px;
}

.browse-sidebar-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
  padding: 4px 16px;
  letter-spacing: 0.5px;
}

.browse-sidebar-list {
  /* 由 JS 渲染 */
}

.browse-sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary, #333);
  border-left: 3px solid transparent;
  transition: background 0.1s;
}
.browse-sidebar-item:hover {
  background: var(--bg-hover, #f0f0f0);
}
.browse-sidebar-item.active {
  background: var(--bg-active, #e8f0fe);
  border-left-color: var(--accent, #1a73e8);
}
.browse-sidebar-item-icon {
  font-size: 14px;
  flex-shrink: 0;
}
.browse-sidebar-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.browse-main .browse-breadcrumb {
  padding: 12px 20px 8px;
  border-bottom: 1px solid var(--border-color, #eee);
  font-size: 13px;
}

.browse-main .browse-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.browse-group-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
  padding: 12px 20px 4px;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  background: var(--bg-main, #fff);
  z-index: 1;
}

.browse-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 13px;
  border-left: 3px solid transparent;
}
.browse-item:hover {
  background: var(--bg-hover, #f5f5f5);
}
.browse-item.selected {
  background: var(--bg-active, #e8f0fe);
  border-left-color: var(--accent, #1a73e8);
}
.browse-item-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}
.browse-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.browse-item-meta {
  font-size: 11px;
  color: #888;
  flex-shrink: 0;
}
.browse-item-up {
  color: #888;
  font-style: italic;
}

/* 拖入副本二选一对话框 */
.dropbox-save-modal {
  max-width: 480px;
}
.dropbox-save-modal .save-options {
  margin: 16px 0;
}
.dropbox-save-modal .save-option {
  padding: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.dropbox-save-modal .save-option:hover {
  border-color: var(--accent, #1a73e8);
  background: var(--bg-hover, #f8f9fa);
}
.dropbox-save-modal .save-option b {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}
.dropbox-save-modal .save-option small {
  display: block;
  font-size: 12px;
  color: #666;
}

/* 窄屏 fallback：< 600px 左侧栏折叠为顶部水平滚动 */
@media (max-width: 600px) {
  .browse-finder-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .browse-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px;
  }
  .browse-sidebar-section {
    margin-bottom: 0;
    margin-right: 16px;
    flex-shrink: 0;
  }
  .browse-sidebar-list {
    display: flex;
    gap: 8px;
  }
  .browse-sidebar-item {
    padding: 4px 8px;
    border-left: none;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
  }
}
```

- [ ] **Step 6: 启动 server + 浏览器硬刷新检查 modal 不破坏**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python server.py &` （如果已运行就跳过）

打开 http://localhost:9901/ 硬刷新（Cmd+Shift+R），点击 sidebar ＋ 按钮，确认：
1. modal 能弹出（虽然样式可能不完美，因为 JS 还没改）
2. 没有控制台报错
3. 关闭按钮可用

- [ ] **Step 7: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add web/index.html web/style.css
git commit -m "feat(ui): rewrite browse modal as Finder-style dual-pane

- HTML: dual-pane layout (sidebar with Shortcuts/Pinned/Recent + main with breadcrumb/list)
- HTML: add #btn-open-file in sidebar and #btn-empty-open-file in welcome
- HTML: add dropbox save-as/discard dialog
- CSS: grid layout 220px sidebar + 1fr main, sticky group labels, hover/active states
- CSS: < 600px fallback to vertical stacked layout
- Bump cache-bust ?v=1.18.4 -> ?v=1.19.0"
```

---

## Task 7: modal JS 渲染逻辑（mode 切换 + 时间分组）

**Files:**
- Modify: `web/app.js`（`openBrowseDialog` + `browseTo` + `renderBrowseList` + 新增 `renderBrowseSidebar` + `renderBrowseFileList`）

**Interfaces:**
- Consumes: Task 1 的 `/api/browse?mode=file` API + Task 5 的 i18n key + Task 6 的 DOM 结构
- Produces: 双栏 modal 渲染逻辑，mode=folder/file 切换，Today/Earlier 时间分组

- [ ] **Step 1: 改写 openBrowseDialog 支持 mode 参数**

打开 `web/app.js`，找到 `async function openBrowseDialog()` 函数（约 1981 行），替换为：

```javascript
  // ───────────── 目录/文件浏览器（v1.19: Finder 风格双栏）─────────────
  let _browseMode = "folder";  // "folder" | "file"
  let _browseSelected = "";
  let _browseOnConfirm = null;  // mode=file 时的回调

  async function openBrowseDialog(mode = "folder", onConfirm = null) {
    _browseMode = mode;
    _browseSelected = "";
    _browseOnConfirm = onConfirm;
    $("#browse-confirm").disabled = true;
    $("#browse-selected").textContent = "";

    // 标题 + 确定按钮文案随 mode 切换
    const titleKey = mode === "file" ? "modal.folder.title.file" : "modal.folder.title.folder";
    const confirmKey = mode === "file" ? "modal.folder.confirm.file" : "modal.folder.confirm.folder";
    const titleEl = $("#browse-modal-title");
    if (titleEl) { titleEl.dataset.i18n = titleKey; titleEl.textContent = window.i18n.t(titleKey); }
    const confirmBtn = $("#browse-confirm");
    confirmBtn.dataset.i18n = confirmKey;
    confirmBtn.textContent = window.i18n.t(confirmKey);

    $("#browse-dialog").style.display = "flex";
    await browseTo("");  // 加载起始页（快捷入口）
  }

  function closeBrowseDialog() {
    $("#browse-dialog").style.display = "none";
  }
```

- [ ] **Step 2: 改写 browseTo 传 mode 参数 + 渲染左侧栏**

找到 `async function browseTo(path)` 函数（约 1993 行），替换为：

```javascript
  async function browseTo(path) {
    const list = $("#browse-list");
    list.innerHTML = window.i18n.t("browse.loading_html") || "Loading…";
    try {
      const modeParam = _browseMode === "file" ? "&mode=file" : "";
      const r = await fetch(API.browse(path) + modeParam);
      const d = await r.json();
      if (!d.ok) { list.innerHTML = `<div class="browse-empty">❌ ${d.error}</div>`; return; }
      renderBrowseBreadcrumb(d.current, d.is_root);
      renderBrowseSidebar(d);
      if (_browseMode === "file" && d.files) {
        renderBrowseFileList(d.dirs, d.files, d.current, d.parent, d.is_root);
      } else {
        renderBrowseList(d.dirs, d.current, d.parent, d.is_root);
      }
    } catch (e) {
      list.innerHTML = window.i18n.t("browse.request_failed_html", { msg: e.message }) ||
        `<div class="browse-empty">❌ ${e.message}</div>`;
    }
  }

  function renderBrowseSidebar(d) {
    // Shortcuts + Pinned（root 时 server 返回；非 root 时只显示 shortcuts + recent）
    const shortcutsList = $("#browse-shortcuts-list");
    const pinnedList = $("#browse-pinned-list");
    const recentList = $("#browse-recent-list");
    if (!shortcutsList) return;

    // is_root 时 d.dirs 是快捷入口（含 📌 pinned 项）
    if (d.is_root) {
      const shortcuts = (d.dirs || []).filter(x => !x.name.startsWith("📌"));
      const pinned = (d.dirs || []).filter(x => x.name.startsWith("📌"));
      shortcutsList.innerHTML = shortcuts.map(s =>
        `<div class="browse-sidebar-item" data-path="${escapeHtml(s.path)}">
          <span class="browse-sidebar-item-icon">${s.name.charAt(0)}</span>
          <span class="browse-sidebar-item-name">${escapeHtml(s.name.replace(/^[^\w]+\s*/, ""))}</span>
        </div>`).join("");
      pinnedList.innerHTML = pinned.map(p =>
        `<div class="browse-sidebar-item" data-path="${escapeHtml(p.path)}">
          <span class="browse-sidebar-item-icon">📌</span>
          <span class="browse-sidebar-item-name">${escapeHtml(p.name.replace(/^📌\s*/, ""))}</span>
        </div>`).join("");
    } else {
      // 非 root 时不重渲染 shortcuts/pinned，避免覆盖
    }

    // Recent：从 localStorage 读最近 5 条
    const recent = getRecentFiles().slice(0, 5);
    if (recent.length === 0) {
      recentList.innerHTML = `<div class="browse-sidebar-item" style="opacity:0.5;cursor:default">${window.i18n.t("modal.folder.recent.empty")}</div>`;
    } else {
      recentList.innerHTML = recent.map(r =>
        `<div class="browse-sidebar-item" data-recent-path="${escapeHtml(r.abs_path)}">
          <span class="browse-sidebar-item-icon">${r.type === "md" ? "📄" : "🌐"}</span>
          <span class="browse-sidebar-item-name">${escapeHtml(r.name)}</span>
        </div>`).join("");
      // 点击 recent 项直接 openFile + 关闭 modal
      recentList.querySelectorAll("[data-recent-path]").forEach(el => {
        el.addEventListener("click", () => {
          const p = el.dataset.recentPath;
          closeBrowseDialog();
          openFile({ abs_path: p, name: p.split(/[/\\]/).pop(), type: p.toLowerCase().endsWith(".md") ? "md" : "html" });
        });
      });
    }

    // shortcuts/pinned 项点击 → browseTo
    shortcutsList.querySelectorAll("[data-path]").forEach(el => {
      el.addEventListener("click", () => browseTo(el.dataset.path));
    });
    pinnedList.querySelectorAll("[data-path]").forEach(el => {
      el.addEventListener("click", () => browseTo(el.dataset.path));
    });
  }
```

- [ ] **Step 3: 新增 renderBrowseFileList（mode=file 时用）**

在 `renderBrowseList` 函数后面加：

```javascript
  function renderBrowseFileList(dirs, files, current, parent, isRoot) {
    const list = $("#browse-list");
    list.innerHTML = "";

    // 返回上级按钮
    if (!isRoot && parent) {
      const upRow = document.createElement("div");
      upRow.className = "browse-item browse-item-up";
      upRow.innerHTML = window.i18n.t("browse.up_html") || `⬆️ <span>Up</span>`;
      upRow.addEventListener("click", () => browseTo(parent));
      list.appendChild(upRow);
    }

    // 目录列表（点击进入）
    for (const d of dirs) {
      const row = document.createElement("div");
      row.className = "browse-item";
      row.innerHTML =
        `<span class="browse-item-icon">📁</span>` +
        `<span class="browse-item-name">${escapeHtml(d.name)}</span>`;
      row.addEventListener("click", () => browseTo(d.path));
      list.appendChild(row);
    }

    if (!files.length && !dirs.length) {
      list.innerHTML += `<div class="browse-empty">${window.i18n.t("modal.folder.empty_files") || "No HTML/Markdown files here"}</div>`;
      return;
    }

    // 文件按 mtime 分组：Today / Earlier
    const now = Date.now();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const todayFiles = [];
    const earlierFiles = [];
    for (const f of files) {
      if (f.mtime * 1000 >= startOfToday.getTime()) todayFiles.push(f);
      else earlierFiles.push(f);
    }

    if (todayFiles.length) {
      const label = document.createElement("div");
      label.className = "browse-group-label";
      label.textContent = window.i18n.t("modal.folder.group.today") || "Today";
      list.appendChild(label);
      for (const f of todayFiles) appendFileRow(list, f);
    }
    if (earlierFiles.length) {
      const label = document.createElement("div");
      label.className = "browse-group-label";
      label.textContent = window.i18n.t("modal.folder.group.earlier") || "Earlier";
      list.appendChild(label);
      for (const f of earlierFiles) appendFileRow(list, f);
    }
  }

  function appendFileRow(list, f) {
    const row = document.createElement("div");
    row.className = "browse-item";
    row.dataset.path = f.path;
    if (_browseSelected === f.path) row.classList.add("selected");
    const sizeStr = formatFileSize(f.size);
    const timeStr = formatRelativeTime(f.mtime * 1000);
    row.innerHTML =
      `<span class="browse-item-icon">${f.type === "md" ? "📄" : "🌐"}</span>` +
      `<span class="browse-item-name">${escapeHtml(f.name)}</span>` +
      `<span class="browse-item-meta">${sizeStr} · ${timeStr}</span>`;
    // 单击选中
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      $$(".browse-item.selected").forEach(n => n.classList.remove("selected"));
      row.classList.add("selected");
      selectBrowsePath(f.path, f.name);
    });
    // 双击直接打开
    row.addEventListener("dblclick", () => {
      selectBrowsePath(f.path, f.name);
      confirmBrowse();
    });
    list.appendChild(row);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return window.i18n.t("modal.folder.size_kb", { n: (bytes / 1024).toFixed(1) });
    return window.i18n.t("modal.folder.size_mb", { n: (bytes / 1024 / 1024).toFixed(2) });
  }

  function formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60 * 1000) return window.i18n.t("modal.folder.rel_time.now") || "just now";
    if (diff < 60 * 60 * 1000) return window.i18n.t("modal.folder.rel_time.hours", { n: Math.floor(diff / 3600000) });
    return window.i18n.t("modal.folder.rel_time.days", { n: Math.floor(diff / 86400000) });
  }

  function selectBrowsePath(path, name) {
    _browseSelected = path;
    const sel = $("#browse-selected");
    if (_browseMode === "file") {
      sel.textContent = window.i18n.t("modal.folder.selected.file", { name: name || path.split(/[/\\]/).pop() });
    } else {
      sel.textContent = window.i18n.t("modal.folder.selected.folder", { path });
    }
    sel.title = path;
    $("#browse-confirm").disabled = false;
  }

  async function confirmBrowse() {
    if (!_browseSelected) return;
    if (_browseMode === "file" && _browseOnConfirm) {
      closeBrowseDialog();
      _browseOnConfirm(_browseSelected);
    } else if (_browseMode === "folder") {
      // 现有逻辑：添加扫描根
      await addScanRoot(_browseSelected);
      closeBrowseDialog();
    }
  }
```

- [ ] **Step 4: 修改 selectBrowsePath 旧函数 + 删除冲突**

老的 `selectBrowsePath` 函数（约 2073 行）已经被上面新版本替代，删掉老的。

- [ ] **Step 5: 绑定 #browse-confirm 和 #browse-close-x 事件**

找到 `$("#btn-browse-root").addEventListener("click", openBrowseDialog);`（约 2367 行），改为：

```javascript
    $("#btn-browse-root").addEventListener("click", () => openBrowseDialog("folder"));
    const btnOpenFile = $("#btn-open-file");
    if (btnOpenFile) btnOpenFile.addEventListener("click", () => openBrowseDialog("file", (path) => {
      openFile({ abs_path: path, name: path.split(/[/\\]/).pop(), type: path.toLowerCase().endsWith(".md") ? "md" : "html" });
    }));
    const btnEmptyOpenFile = $("#btn-empty-open-file");
    if (btnEmptyOpenFile) btnEmptyOpenFile.addEventListener("click", () => openBrowseDialog("file", (path) => {
      openFile({ abs_path: path, name: path.split(/[/\\]/).pop(), type: path.toLowerCase().endsWith(".md") ? "md" : "html" });
    }));
    $("#browse-confirm").addEventListener("click", confirmBrowse);
    const browseCloseX = $("#browse-close-x");
    if (browseCloseX) browseCloseX.addEventListener("click", closeBrowseDialog);
```

注意：现有 `$("#browse-cancel")` 的关闭逻辑保留不动。

- [ ] **Step 6: 新增 getRecentFiles + addToRecentFiles 函数（Task 9 会用到，但这里先放占位避免报错）**

在 `app.js` 末尾（最后一个 `}` 之前）加：

```javascript
  // ───────────── 最近打开（localStorage）─────────────
  const RECENT_KEY = "doccenter.recent-files";
  const RECENT_MAX = 20;

  function getRecentFiles() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function addToRecentFiles(node) {
    try {
      const arr = getRecentFiles();
      const entry = {
        abs_path: node.abs_path,
        name: node.name,
        type: node.type || (node.abs_path.toLowerCase().endsWith(".md") ? "md" : "html"),
        opened_at: Date.now(),
      };
      // 去重（按 abs_path）
      const filtered = arr.filter(x => x.abs_path !== entry.abs_path);
      filtered.unshift(entry);
      // 截断到 20 条
      const trimmed = filtered.slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
    } catch (_) { /* localStorage 满或隐私模式，静默失败 */ }
  }
```

- [ ] **Step 7: 浏览器演练**

硬刷新 http://localhost:9901/：
1. 点 sidebar ＋ 按钮 → modal 弹出，标题"选择文件夹"，确定按钮"选择此文件夹"，左侧栏 3 个 section，右侧只显示目录
2. 点 sidebar 📂 按钮 → modal 弹出，标题"打开文件"，确定按钮"打开此文件"，右侧显示目录 + HTML/MD 文件，按 Today/Earlier 分组
3. 双击文件 → modal 关闭 + 文件打开可编辑
4. 点左侧 Shortcuts 项 → 进入对应目录
5. 控制台无报错

- [ ] **Step 8: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add web/app.js
git commit -m "feat(ui): implement Finder-style dual-pane modal rendering

- openBrowseDialog(mode, onConfirm): folder/file mode switch
- renderBrowseSidebar: Shortcuts + Pinned (from server) + Recent (from localStorage)
- renderBrowseFileList: dirs + files grouped by Today/Earlier
- appendFileRow: single-click select, double-click open
- formatFileSize + formatRelativeTime helpers
- getRecentFiles + addToRecentFiles: localStorage persistence (20 max, dedup by abs_path)"
```

---

## Task 8: 拖入预览改造 + 关闭二选一 + 另存为 modal 集成

**Files:**
- Modify: `web/app.js`（drop handler 改造 + closeCurrentFile 二选一 + save-as 流程）

**Interfaces:**
- Consumes: Task 2 的 `/api/drag-upload` + Task 3 的 `/api/save-as` + Task 6 的 `#dropbox-save-dialog`
- Produces: 拖入文件 → server 写副本 → openFile → 关闭时弹二选一

- [ ] **Step 1: 改写 drop handler**

找到 `editor.addEventListener("drop", async (e) => {...})` 块（约 2410 行），把里面的 `iframe.srcdoc = htmlContent` 部分替换为：

```javascript
      editor.addEventListener("drop", async (e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        dragCounter = 0;
        editor.classList.remove("drag-over");

        const files = Array.from(e.dataTransfer.files);
        const target = files.find(f => /\.html?$/i.test(f.name))
                    || files.find(f => /\.md$/i.test(f.name));
        if (!target) {
          toast(window.i18n?.t("toast.drag.no_html") || "请拖入 HTML 或 Markdown 文件", "warning");
          return;
        }

        // v1.19: 改走 server 写副本 + openFile，让拖入文件可编辑
        try {
          const fd = new FormData();
          fd.append("file", target);
          fd.append("filename", target.name);
          const r = await fetch("/api/drag-upload", { method: "POST", body: fd });
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: r.statusText }));
            toast(window.i18n?.t("toast.drag.upload_failed", { msg: err.error }) || `上传失败：${err.error}`, "error");
            return;
          }
          const data = await r.json();
          // 走完整 openFile 路径，自动注入 saver-runtime.js
          openFile({
            abs_path: data.abs_path,
            name: data.name,
            type: data.type,
          });
          // 标记为 dropbox 副本，关闭时走二选一
          if (state.currentFile) state.currentFile.isDropbox = true;
          // 更新面包屑显示 dropbox 标识
          const bc = document.getElementById("breadcrumb");
          if (bc) {
            const existing = bc.innerHTML;
            // 在面包屑末尾加 dropbox 标记
            bc.innerHTML = existing + ` <span class="bc-meta" style="color:#c9a961">📥 ${window.i18n?.t("breadcrumb.dropbox") || "Dropbox 副本"}</span>`;
          }
          toast(window.i18n?.t("toast.drag.uploaded", { name: data.name }) || `已加载到 dropbox（可编辑）：${data.name}`, "success");
        } catch (err) {
          toast(window.i18n?.t("toast.drag.upload_failed", { msg: err.message }) || `上传失败：${err.message}`, "error", err.message);
        }
      });
```

- [ ] **Step 2: 改造 closeCurrentFile 支持 dropbox 二选一**

找到 `closeCurrentFile` 函数（搜索 `function closeCurrentFile`），在开头加 dropbox 检测逻辑：

```javascript
  async function closeCurrentFile() {
    // v1.19: dropbox 副本关闭时弹二选一（另存为 / 丢弃）
    if (state.currentFile?.isDropbox && state.isDirty) {
      const choice = await promptDropboxSaveChoice();
      if (choice === "cancel") return;  // 用户取消，不关闭
      if (choice === "save_as") {
        const saved = await promptSaveAsViaFinder();
        if (!saved) return;  // 另存为失败或取消，不关闭
      }
      // choice === "discard" → 直接关闭
    } else if (state.isDirty && state.currentFile) {
      // 现有三选一逻辑保留
      const ok = await promptSaveBeforeSwitch();
      if (!ok) return;
    }
    // ... 现有 closeCurrentFile 后续逻辑 ...
  }

  function promptDropboxSaveChoice() {
    return new Promise((resolve) => {
      const dlg = $("#dropbox-save-dialog");
      dlg.style.display = "flex";
      const onSaveAs = () => { cleanup(); resolve("save_as"); };
      const onDiscard = () => { cleanup(); resolve("discard"); };
      const onCancel = () => { cleanup(); resolve("cancel"); };
      function cleanup() {
        dlg.style.display = "none";
        $("#dropbox-save-as-option").removeEventListener("click", onSaveAs);
        $("#dropbox-discard-option").removeEventListener("click", onDiscard);
        $("#dropbox-cancel").removeEventListener("click", onCancel);
      }
      $("#dropbox-save-as-option").addEventListener("click", onSaveAs);
      $("#dropbox-discard-option").addEventListener("click", onDiscard);
      $("#dropbox-cancel").addEventListener("click", onCancel);
    });
  }

  async function promptSaveAsViaFinder() {
    // 弹 Finder modal 让用户选目标目录 + 输入文件名
    return new Promise((resolve) => {
      // 简化版：用 prompt() 让用户输入目标完整路径
      // 生产版：复用 browse modal 选目录 + input 框输入文件名
      const suggestedName = state.currentFile?.name || "untitled.html";
      const destPath = prompt(
        window.i18n?.t("modal.folder.dropbox_save_as_hint") || "选择保存位置（输入完整路径）",
        suggestedName
      );
      if (!destPath) { resolve(false); return; }
      // 调 /api/save-as
      fetch("/api/save-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src_path: state.currentFile.absPath,
          dest_path: destPath,
        }),
      }).then(r => r.json()).then(data => {
        if (data.ok) {
          toast(window.i18n?.t("toast.save_as.success", { path: data.dest_path }) || `已另存为：${data.dest_path}`, "success");
          resolve(true);
        } else if (data.error === "target_exists") {
          // 二级确认覆盖
          if (confirm(window.i18n?.t("modal.folder.dropbox_save_as_overwrite_confirm") || "文件已存在，是否覆盖？")) {
            // 删除目标后重试
            fetch("/api/save-as", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ src_path: state.currentFile.absPath, dest_path: destPath, overwrite: true }),
            }).then(r => r.json()).then(d2 => {
              if (d2.ok) {
                toast(window.i18n?.t("toast.save_as.success", { path: d2.dest_path }) || `已另存为：${d2.dest_path}`, "success");
                resolve(true);
              } else {
                toast(window.i18n?.t("toast.save_as.failed", { msg: d2.error }) || `另存为失败：${d2.error}`, "error");
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        } else {
          toast(window.i18n?.t("toast.save_as.failed", { msg: data.error }) || `另存为失败：${data.error}`, "error");
          resolve(false);
        }
      }).catch(e => {
        toast(window.i18n?.t("toast.save_as.failed", { msg: e.message }) || `另存为失败：${e.message}`, "error");
        resolve(false);
      });
    });
  }
```

> 注意：`promptSaveAsViaFinder` 这里用 `prompt()` 简化实现。后续迭代可以改成复用 browse modal 选目录 + 文件名 input 框。先保证功能跑通。

- [ ] **Step 3: 扩展 /api/save-as 支持 overwrite 参数**

修改 `server.py` 的 `handle_save_as` 函数，处理 `overwrite` 参数：

```python
async def handle_save_as(request):
    """POST /api/save-as - 复制文件到新位置（拖入副本另存为）。"""
    try:
        body = await request.json()
        src_path = body.get("src_path", "")
        dest_path = body.get("dest_path", "")
        overwrite = body.get("overwrite", False)
        # ... 现有校验 ...
        if dest.exists() and not overwrite:
            return web.json_response({"ok": False, "error": "target_exists"}, status=409)
        if dest.exists() and overwrite:
            dest.unlink()
        # ... 现有复制逻辑 ...
```

- [ ] **Step 4: 浏览器演练拖入流程**

1. 从 Finder 拖一个 HTML 文件到 DocCenter 编辑器
2. 确认：文件立即打开可编辑（不是只读预览）
3. 改一行内容
4. 等待 2 秒，检查 `_dropbox/` 下有 `_auto-save/` 快照（在 server 工作目录下）
5. 点击关闭按钮 ✕
6. 确认：弹出"另存为 / 丢弃"二选一对话框（不是现有的三选一）
7. 点"另存为" → 输入目标路径 → 确认 → 文件被复制到目标位置
8. 控制台无报错

- [ ] **Step 5: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add web/app.js server.py
git commit -m "feat(drop): make drag-and-drop editable via server-side dropbox

- drop handler: POST /api/drag-upload → openFile({abs_path, name, type})
- state.currentFile.isDropbox = true marks dropbox copies
- closeCurrentFile: dropbox files get 2-choice dialog (Save as / Discard)
- promptSaveAsViaFinder: prompt() for dest path, /api/save-as with overwrite support
- /api/save-as: accept overwrite=true to replace existing target"
```

---

## Task 9: "最近打开" tab 填充 + openFile 钩子

**Files:**
- Modify: `web/app.js`（`openFile` 末尾加 `addToRecentFiles` 调用 + 渲染 recent tab）

**Interfaces:**
- Consumes: Task 7 的 `getRecentFiles` + `addToRecentFiles`
- Produces: 侧栏 🕐 Recent tab 显示最近 20 条，点击直接 openFile

- [ ] **Step 1: 在 openFile 末尾加 addToRecentFiles 调用**

找到 `async function openFile(node, opts = {})` 函数（约 1454 行），在函数末尾（`frame.src = API.file(...)` 那一行后面、函数结束 `}` 之前）加：

```javascript
    // v1.19: 记到最近打开列表
    addToRecentFiles(node);
```

- [ ] **Step 2: 实现 renderRecentTab 函数**

在 `app.js` 末尾加：

```javascript
  // ───────────── 侧栏 Recent tab 渲染 ─────────────
  function renderRecentTab() {
    const container = $("#tab-content-recent") || document.querySelector(".sidebar-tab-content[data-tab='recent']");
    if (!container) return;
    const recent = getRecentFiles();
    if (recent.length === 0) {
      container.innerHTML = `<div class="sidebar-empty">${window.i18n.t("sidebar.empty.recent") || "No recently opened files yet."}</div>`;
      return;
    }
    container.innerHTML = recent.map(r => {
      const timeStr = formatRelativeTime(r.opened_at);
      const openedAgo = window.i18n.t("sidebar.recent.opened_ago", { time: timeStr }) || `opened ${timeStr}`;
      return `<div class="tree-node-label recent-item" data-abs="${escapeHtml(r.abs_path)}" data-type="${r.type}">
        <span class="tree-icon">${r.type === "md" ? "📄" : "🌐"}</span>
        <span class="tree-name">${escapeHtml(r.name)}</span>
        <span class="tree-meta">${openedAgo}</span>
      </div>`;
    }).join("");
    // 绑定点击
    container.querySelectorAll(".recent-item").forEach(el => {
      el.addEventListener("click", async () => {
        const p = el.dataset.abs;
        const type = el.dataset.type;
        // 先检查文件是否存在（HEAD /api/file）
        try {
          const check = await fetch(API.file(p), { method: "HEAD" });
          if (!check.ok) {
            toast(window.i18n.t("toast.recent.file_deleted", { name: el.dataset.name || p.split(/[/\\]/).pop() }) || `文件已不存在：${p}`, "warning");
            removeFromRecentFiles(p);
            renderRecentTab();
            return;
          }
        } catch (_) { /* 网络错也允许打开，server 会再校验 */ }
        openFile({ abs_path: p, name: p.split(/[/\\]/).pop(), type });
      });
    });
  }

  function removeFromRecentFiles(absPath) {
    try {
      const arr = getRecentFiles().filter(x => x.abs_path !== absPath);
      localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
    } catch (_) {}
  }
```

- [ ] **Step 3: 在侧栏 tab 切换时调用 renderRecentTab**

找到现有的 tab 切换逻辑（搜索 `data-tab="recent"` 或 `sidebar-tab`），在切到 recent tab 时调 `renderRecentTab()`：

```javascript
    // 现有 tab 切换逻辑里加：
    $$(".sidebar-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        if (target === "recent") renderRecentTab();
        // ... 现有 tab 切换逻辑 ...
      });
    });
```

> 注意：找到现有 `sidebar-tab` click 监听器，**在它里面**加 `if (target === "recent") renderRecentTab();`，不要重复绑定。

- [ ] **Step 4: 浏览器演练**

1. 打开 3 个文件（从扫描根目录点）
2. 切到侧栏 🕐 Recent tab
3. 确认：显示 3 条记录，每条含图标 + 文件名 + "opened Xh ago"
4. 点击其中一条 → 直接打开该文件
5. 删除其中一个文件（在 Finder 里手动删）
6. 在 Recent tab 点击该文件 → toast "文件已不存在" + 自动从列表移除

- [ ] **Step 5: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add web/app.js
git commit -m "feat(recent): populate sidebar Recent tab from localStorage

- openFile() now calls addToRecentFiles(node) at end
- renderRecentTab: render up to 20 recent files with icon/name/opened-X-ago
- Click recent item: HEAD check file existence, openFile or toast+remove
- removeFromRecentFiles: cleanup on file-not-found
- Switch to recent tab triggers renderRecentTab()"
```

---

## Task 10: 入口按钮 + 整体集成 + promptSaveAsViaFinder 升级

**Files:**
- Modify: `web/app.js`（绑定 Task 6 新增的按钮 + 升级 promptSaveAsViaFinder 用 Finder modal 而非 prompt()）

**背景**：Task 7 已经绑定了 `#btn-open-file` 和 `#btn-empty-open-file`。本 task 主要做整体集成演练 + promptSaveAsViaFinder 升级（可选）。

- [ ] **Step 1: 确认所有入口按钮已绑定**

Run: `grep -n "btn-open-file\|btn-empty-open-file\|btn-browse-root\|btn-quick-add-dir\|btn-empty-add-dir" "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center/web/app.js"`

应该看到 5 个按钮都有 addEventListener。

- [ ] **Step 2: 整体集成演练（5 个核心场景）**

按设计文档第 6.2 节的 5 个场景演练，每个场景都写出"我点了 X 看到了 Y"：

**场景 1：打开文件主流程**
- [ ] 点 sidebar 📂 按钮 → modal 弹出，标题"打开文件"
- [ ] 双击进入子目录 → 右侧显示该目录的 HTML/MD 文件
- [ ] 双击 HTML 文件 → modal 关闭 + 文件打开可编辑
- [ ] 改一行 → 2 秒后检查 `_auto-save/` 有快照
- [ ] 关闭弹"覆盖/另存/丢弃"三选一 → 选覆盖 → 原文件被改

**场景 2：拖入编辑流程**
- [ ] 从 Finder 拖 HTML 到 DocCenter → 立即可编辑
- [ ] 改一行 → 关闭弹"另存为/丢弃"二选一
- [ ] 选另存为 → 输入目标路径 → 保存成功
- [ ] 检查 `_dropbox/` 副本仍在

**场景 3：添加文件夹回归**
- [ ] sidebar ＋ 按钮 → modal mode=folder → 选目录 → 加入扫描根
- [ ] 侧栏出现新根 → 点击其中的文件能编辑

**场景 4：最近打开 tab**
- [ ] 打开 3 个文件 → 切到侧栏 🕐 Recent tab → 看到 3 条记录
- [ ] 点击其中一条 → 直接打开

**场景 5：左侧栏 Recent 入口**
- [ ] sidebar 📂 按钮 → modal 左侧 🕐 Recent section → 看到最近 5 条
- [ ] 点击一条 → 直接 openFile，modal 关闭

- [ ] **Step 3: 跨浏览器演练（Chrome + Safari + Firefox）**

每个浏览器跑场景 1+2，确认 fallback 一致。

- [ ] **Step 4: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
# 如果有改动就 commit，没改动就跳过
git add -A
git status  # 看有没有改动
# 如果有：git commit -m "feat(integration): wire up all entry buttons + manual test pass"
```

---

## Task 11: 真实浏览器演练 + 手动清单 + CHANGELOG + 回归测试

**Files:**
- Create: `tests/manual-checklist.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 创建手动演练清单**

创建 `tests/manual-checklist.md`：

```markdown
# Manual Test Checklist — v1.19 Finder modal + drag-editable

> 按 DocCenter 反 Bug 5 条铁律（memory 84066387）执行：真实浏览器演练，每个场景写出"我点了 X 看到了 Y"。

## 场景 1：打开文件主流程

- [ ] 点 sidebar 📂 按钮
- [ ] modal 弹出，标题"打开文件"，确定按钮"打开此文件"
- [ ] 左侧栏显示 Shortcuts/Pinned/Recent 3 个 section
- [ ] 右侧显示当前目录的子目录 + HTML/MD 文件，按 Today/Earlier 分组
- [ ] 双击子目录 → 进入，列表更新
- [ ] 双击 HTML 文件 → modal 关闭 + 文件打开可编辑
- [ ] 改一行内容 → 2 秒后 `_auto-save/` 有快照
- [ ] 关闭按钮 → 弹"覆盖/另存/丢弃"三选一
- [ ] 选覆盖 → 原文件被改

**结果记录**：我点了 X 看到了 Y...

## 场景 2：拖入编辑流程

- [ ] 从 Finder 拖 HTML 文件到 DocCenter 编辑器
- [ ] 立即可编辑（不是只读预览）
- [ ] 面包屑显示"📥 Dropbox 副本"标记
- [ ] 改一行 → 关闭按钮弹"另存为/丢弃"二选一
- [ ] 选另存为 → 输入目标路径 → 保存成功
- [ ] `_dropbox/` 副本仍在

**结果记录**：...

## 场景 3：添加文件夹回归

- [ ] sidebar ＋ 按钮 → modal mode=folder → 选目录 → 加入扫描根
- [ ] 侧栏出现新根
- [ ] 点击其中的文件能编辑

**结果记录**：...

## 场景 4：最近打开 tab

- [ ] 打开 3 个文件
- [ ] 切到侧栏 🕐 Recent tab
- [ ] 看到 3 条记录，每条含图标 + 文件名 + "opened Xh ago"
- [ ] 点击其中一条 → 直接打开

**结果记录**：...

## 场景 5：左侧栏 Recent 入口

- [ ] sidebar 📂 按钮 → modal 左侧 🕐 Recent section
- [ ] 看到最近 5 条
- [ ] 点击一条 → 直接 openFile，modal 关闭，不渲染右侧列表

**结果记录**：...

## 跨浏览器（Chrome / Safari / Firefox）

- [ ] Chrome：场景 1+2 通过
- [ ] Safari：场景 1+2 通过
- [ ] Firefox：场景 1+2 通过

## 跨平台（macOS + Windows）

- [ ] macOS：场景 1+2 通过
- [ ] Windows：场景 1+2 通过（路径分隔符、_dropbox/ 位置）

## 回归测试

- [ ] 现有"添加文件夹"功能（mode=folder）100% 不变
- [ ] 现有侧栏文件点击编辑/保存流程不变
- [ ] 现有 session restore 不变
- [ ] 现有 `/api/browse` 不传 mode 时行为完全不变（pytest test_browse_without_mode_backward_compatible 通过）

## 反 Bug 5 条铁律自检

- [ ] 真实浏览器演练（不是 curl 200 就算通过）
- [ ] 守卫表达式显式验证
- [ ] CSS 改 .active/display 前 grep inline style 残留
- [ ] DOM 切换后依赖动作用 rAF
- [ ] 自驱模式 ≠ 跳过用户视角
```

- [ ] **Step 2: 跑全部后端测试**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/ -v`

Expected: 全部 PASS。

- [ ] **Step 3: 在 CHANGELOG.md 头部加 v1.19.0 entry**

打开 `CHANGELOG.md`，在 `## v1.18.4` 之前加：

```markdown
## v1.19.0 — Finder-style Modal + Editable Drag-and-Drop

*2026-07-17 · v1.19.0*

**EN**
- 🎯 **New: "Open file" button** — click 📂 in sidebar (or 📄 Open a file on welcome page) to browse and open any HTML/Markdown file on your disk. Selected files are editable (not preview-only) and added to "Recent" list.
- 🖼️ **Finder-style dual-pane modal** — both "Add folder" and "Open file" now use a redesigned dual-pane modal: left sidebar (Shortcuts / Pinned / Recent) + right main area with Today/Earlier time grouping. Replaces the old single-column list.
- ✏️ **Drag-and-drop is now editable** — previously drag-in was preview-only (no saver-runtime.js injection). Now dropped files are uploaded to `_dropbox/` server-side and opened via the full `openFile()` pipeline, with 2-second auto-snapshot and 2-choice close dialog (Save as / Discard).
- 🕐 **"Recent" sidebar tab populated** — was empty since v1.10.7. Now shows up to 20 recently opened files (localStorage persisted), with auto-cleanup when files are deleted.
- 🔧 **Backend**: `GET /api/browse?mode=file` (returns files array with size/mtime), `POST /api/drag-upload` (multipart, 10MB limit, .html/.htm/.md only), `POST /api/save-as` (with overwrite support), `_dropbox/` 7-day auto-cleanup on startup.
- 🧪 **Test infrastructure**: pytest + aiohttp TestClient, 13 backend tests covering all new endpoints.

**中文**
- 🎯 **新增"打开文件"按钮** — 侧栏 📂 或 welcome 页 📄 打开文件，可浏览并打开磁盘上任意 HTML/Markdown 文件。选中的文件可编辑（非预览），并加入"最近打开"列表。
- 🖼️ **Finder 风格双栏 modal** — "添加文件夹"和"打开文件"统一升级为双栏 modal：左侧栏（快捷入口/已固定/最近打开）+ 右侧主区按今天/更早时间分组。替换旧的单栏列表。
- ✏️ **拖入文件可编辑** — 之前拖入只能预览（无 saver-runtime.js 注入）。现在拖入文件上传到 `_dropbox/` 服务端，走完整 `openFile()` 流程，含 2 秒自动快照 + 关闭时二选一（另存为/丢弃）。
- 🕐 **"最近打开"侧栏 tab 填充** — 自 v1.10.7 起一直为空。现在显示最近 20 个打开的文件（localStorage 持久化），文件被删除时自动清理。
- 🔧 **后端**：`GET /api/browse?mode=file`（返回 files 数组含 size/mtime）、`POST /api/drag-upload`（multipart，10MB 限制，仅 .html/.htm/.md）、`POST /api/save-as`（支持覆盖）、`_dropbox/` 启动时 7 天自动清理。
- 🧪 **测试基础设施**：pytest + aiohttp TestClient，13 个后端测试覆盖所有新 endpoint。

**👤 用户故事**
- 场景：想编辑一个不在扫描根目录里的 HTML 文件，之前只能拖入预览（只读），改完没法保存。
- 之前：拖入只读预览，关闭即丢；要点按钮选文件根本没入口。
- 现在：点 📂 按钮选任意文件直接可编辑；拖入也可编辑 + 另存为；最近打开 tab 让跨会话回到文件。

---
```

- [ ] **Step 4: 真实浏览器完整演练**

按 `tests/manual-checklist.md` 跑全部 5 个场景 + 跨浏览器 + 回归，每个场景写出"我点了 X 看到了 Y"。

如果发现 bug：
- 轻微视觉问题 → 直接修 + 重测
- 逻辑 bug → 修 + 重测 + 在 checklist 里记录修复
- 严重 bug → 回到对应 task 重做

- [ ] **Step 5: 跑全部后端测试再次确认无回归**

Run: `cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center" && python -m pytest tests/ -v`

Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
cd "/Users/louiscxqiu/CodeBuddy/openclaw-cb/02 software project/html-doc-center"
git add tests/manual-checklist.md CHANGELOG.md
git commit -m "docs(v1.19.0): manual test checklist + CHANGELOG entry

- tests/manual-checklist.md: 5 core scenarios + cross-browser + cross-platform + regression
- CHANGELOG.md: v1.19.0 entry with EN/中文 bilingual highlights + user story"
```

- [ ] **Step 7: 最终发布确认（按 memory 12841647）**

按规矩，正式发布前主动问用户：
1. 这次要不要 git commit？（已 commit 多次，确认无遗漏）
2. 要不要打 tag `v1.19.0`？
3. 要不要 git push 到 GitHub？

等用户拍板后再执行 push + tag。

---

## Self-Review

按 writing-plans skill 的 Self-Review 清单：

**1. Spec coverage**:
- ✅ 子功能 1（新增"打开文件"按钮）→ Task 5(i18n) + Task 6(HTML) + Task 7(JS) + Task 10(集成)
- ✅ 子功能 2（拖入可编辑）→ Task 2(后端) + Task 8(前端)
- ✅ 子功能 3（最近打开 tab）→ Task 9
- ✅ Finder 风格双栏 modal → Task 6 + Task 7
- ✅ mode 切换 → Task 7
- ✅ Today/Earlier 时间分组 → Task 7
- ✅ _dropbox/ 7 天清理 → Task 4
- ✅ 错误处理 16 个场景 → 散落在各 task 的实现里
- ✅ 测试策略 13 个 pytest + 5 个手动场景 → Task 1-4(后端) + Task 11(手动)
- ✅ 回归测试 → Task 11

**2. Placeholder scan**:
- ✅ 无 TBD / TODO
- ✅ 所有代码块完整
- ✅ "现有 closeCurrentFile 后续逻辑" 是引用现有代码，不是 placeholder
- ⚠️ Task 8 Step 2 的 `promptSaveAsViaFinder` 用 `prompt()` 简化实现，注释说"后续迭代可以改成复用 browse modal"——这是有意简化，不是 placeholder

**3. Type consistency**:
- ✅ `openFile(node)` 签名不变，node 字段 `{abs_path, name, type}`
- ✅ `state.currentFile` 字段 `{absPath, name, relPath, isDropbox}`，新增 `isDropbox` 不影响现有
- ✅ `addToRecentFiles(node)` 接收的 node 字段 `{abs_path, name, type, opened_at}`
- ✅ 后端 API 返回字段一致：`{ok, abs_path, name, type}` (drag-upload) / `{ok, dest_path}` (save-as)
- ✅ i18n key 命名一致：`modal.folder.*` / `dlg.dropbox.*` / `sidebar.open_file.*`

**4. Ambiguity check**:
- ✅ mode=folder vs mode=file 行为明确
- ✅ "另存为"流程明确（prompt 输入路径 → /api/save-as → 409 时弹覆盖确认）
- ✅ "最近打开"localStorage key 明确（`doccenter.recent-files`）

无 issues，plan 完成。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-17-finder-modal-and-editable-drop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 我每个 task 派一个 fresh subagent，task 间 review，快速迭代

**2. Inline Execution** - 在当前会话用 executing-plans 批量执行 + 检查点

哪种？

"""
HTML Document Center - 本地 HTML 文档工作台
==========================================

端口: 9901（与 codebuddy-dashboard 的 9900 独立运行）
配置: ~/.codebuddy/html-doc-center/config.json
启动: python3 server.py

核心能力:
- 扫描 scan_roots 下所有 HTML 文件，树形展示
- 打开任一 HTML 时自动注入 saver-runtime.js，启用编辑/批注能力
- 编辑/批注时自动快照到 {原目录}/_auto-save/
- 关闭/切换时三选项保存：overwrite / new / discard

安全:
- 所有路径操作都通过 _resolve_safe() 校验必须在 scan_roots 白名单内
"""

import json
import os
import re
import sys
import time
import base64
import mimetypes
import shutil
import subprocess
import platform
from pathlib import Path
from datetime import datetime, timedelta

try:
    from aiohttp import web
except ImportError:
    print("[ERROR] aiohttp 未安装，请执行: pip3 install aiohttp")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 常量与配置
# ─────────────────────────────────────────────────────────────────────────────
# 资源路径：兼容 PyInstaller 打包（frozen）和源码运行两种模式
if getattr(sys, 'frozen', False):
    # PyInstaller onefile 模式：资源打包在 _MEIPASS 临时解压目录
    _INSTALL_DIR = sys._MEIPASS
    WORKSPACE = os.path.expanduser("~")  # 打包后默认用用户主目录
    # --windowed 模式下没有 stdout/stderr，重定向到日志文件
    import io
    _log_file = os.path.join(CONFIG_DIR, "server.log")
    os.makedirs(CONFIG_DIR, exist_ok=True)
    try:
        sys.stdout = open(_log_file, "a", buffering=1)
        sys.stderr = sys.stdout
    except Exception:
        pass
else:
    # 源码运行：取 server.py 所在目录的父目录
    _INSTALL_DIR = os.path.dirname(os.path.abspath(__file__))
    WORKSPACE = os.path.dirname(_INSTALL_DIR)
CONFIG_DIR = os.path.expanduser("~/.codebuddy/html-doc-center")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
FAVORITES_FILE = os.path.join(CONFIG_DIR, "favorites.json")  # v1.6
WEB_DIR = os.path.join(_INSTALL_DIR, "web")
SAVER_JS = os.path.join(_INSTALL_DIR, "saver-runtime.js")

def _default_scan_roots():
    """智能默认扫描目录：优先找 outputs/，否则用用户文档目录"""
    candidates = [
        os.path.join(WORKSPACE, "outputs"),
        os.path.join(Path.home(), "Documents"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return [c]
    return [str(Path.home())]  # 兜底：主目录

DEFAULT_CONFIG = {
    "scan_roots": _default_scan_roots(),
    "exclude_patterns": [
        "_auto-save", "node_modules", ".git", ".venv", "venv",
        "dist", "build", "__pycache__"
    ],
    "snapshot_debounce_ms": 2000,
    "snapshot_retention_days": 7,
    "tree_auto_refresh_seconds": 10,
    "port": 9901,
    "access_password": "",  # v2.1: 空则无密码；设了则访问需认证
    "share_server": "",  # v2.4: 在线分享服务地址（如 https://xxx.loca.lt），空则禁用在线链接
}

_AUTH_SALT = "htmlstudio_2026"

# 目录扫描缓存（3 秒 TTL，避免高频扫盘）
_tree_cache = {"ts": 0, "data": None, "roots_signature": None, "sort_by": None}
CACHE_TTL = 3

# v1.10.1: 极轻量目录签名缓存（1 秒 TTL，给极高频调用兜底）
_sig_cache = {"ts": 0, "data": None, "roots_signature": None}
SIG_CACHE_TTL = 1


# ─────────────────────────────────────────────────────────────────────────────
# 收藏管理（v1.6: 文件 + 目录收藏）
# ─────────────────────────────────────────────────────────────────────────────
def load_favorites() -> dict:
    """读取收藏，不存在则返回空结构"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(FAVORITES_FILE):
        return {"items": []}
    try:
        with open(FAVORITES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "items" not in data:
            return {"items": []}
        return data
    except Exception as e:
        _log(f"⚠️ 收藏读取失败，回退空: {e}")
        return {"items": []}


def save_favorites(fav: dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(FAVORITES_FILE, "w", encoding="utf-8") as f:
        json.dump(fav, f, ensure_ascii=False, indent=2)


def cleanup_dead_favorites(cfg: dict) -> int:
    """启动时清理失效收藏：路径不存在 或 不在 scan_roots 内。返回清理数量。"""
    fav = load_favorites()
    before = len(fav.get("items", []))
    alive = []
    for item in fav.get("items", []):
        p = item.get("path")
        if not p:
            continue
        safe = _resolve_safe(p, cfg.get("scan_roots", []))
        if safe and safe.exists():
            # 类型一致性校验
            actual_type = "dir" if safe.is_dir() else "file"
            expected = item.get("type", "file")
            if actual_type == expected or expected in ("file", "dir"):
                item["type"] = actual_type
                item["path"] = str(safe)
                alive.append(item)
    cleaned = before - len(alive)
    if cleaned > 0:
        fav["items"] = alive
        save_favorites(fav)
        _log(f"🧹 清理 {cleaned} 个失效收藏")
    return cleaned


# ─────────────────────────────────────────────────────────────────────────────
# 配置加载 / 保存
# ─────────────────────────────────────────────────────────────────────────────
def _log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def load_config() -> dict:
    """读取配置，不存在则用默认值创建"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=2)
        _log(f"🆕 已创建默认配置: {CONFIG_FILE}")
        return dict(DEFAULT_CONFIG)

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        # 补齐缺失字段
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    except Exception as e:
        _log(f"⚠️ 配置读取失败，回退默认: {e}")
        return dict(DEFAULT_CONFIG)


def save_config(cfg: dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# scan_roots 格式兼容（v1.4: 从 [str] 升级为 [{path, enabled}]）
# ─────────────────────────────────────────────────────────────────────────────
def _normalize_scan_roots(cfg: dict) -> list:
    """
    确保 scan_roots 为 [{path: str, enabled: bool}] 格式。
    旧格式 ["path1", "path2"] 自动迁移为 [{path: "path1", enabled: true}, ...]。
    """
    raw = cfg.get("scan_roots", [])
    normalized = []
    changed = False
    for item in raw:
        if isinstance(item, str):
            normalized.append({"path": item, "enabled": True})
            changed = True
        elif isinstance(item, dict) and "path" in item:
            item.setdefault("enabled", True)
            normalized.append(item)
        # 其他格式跳过
    if changed:
        cfg["scan_roots"] = normalized
        save_config(cfg)
        _log("🔄 scan_roots 已从旧格式迁移为 [{path, enabled}]")
    return normalized


def _enabled_root_paths(cfg: dict) -> list:
    """返回所有 enabled=True 的根路径字符串列表（供现有逻辑复用）"""
    roots = _normalize_scan_roots(cfg)
    return [r["path"] for r in roots if r.get("enabled", True)]


def _all_root_paths(cfg: dict) -> list:
    """返回所有根路径字符串列表（不区分启用状态，用于路径安全校验）"""
    roots = _normalize_scan_roots(cfg)
    return [r["path"] for r in roots]


# ─────────────────────────────────────────────────────────────────────────────
# 路径安全
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_safe(rel_or_abs: str, scan_roots: list) -> Path | None:
    """
    把传入路径解析成绝对路径，并校验必须落在 scan_roots 某个根下。
    防止 ../../../etc/passwd 类路径穿越。
    scan_roots 可以是字符串列表或 [{path, enabled}] 对象列表（兼容两种格式）。
    返回 None 表示非法。
    """
    if not rel_or_abs:
        return None
    try:
        p = Path(rel_or_abs).expanduser()
        # 相对路径 → 相对 workspace
        if not p.is_absolute():
            p = Path(WORKSPACE) / p
        p = p.resolve()
    except Exception:
        return None

    for root in scan_roots:
        root_str = root["path"] if isinstance(root, dict) else root
        try:
            root_p = Path(root_str).expanduser().resolve()
            if p == root_p or root_p in p.parents:
                return p
        except Exception:
            continue
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 目录扫描
# ─────────────────────────────────────────────────────────────────────────────
def _scan_tree(cfg: dict, sort_by: str = "mtime_desc") -> list:
    """扫描所有 enabled 的 scan_roots，返回树形结构 JSON"""
    exclude = set(cfg.get("exclude_patterns", []))
    roots_result = []

    for root_path in _enabled_root_paths(cfg):
        root = Path(root_path).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            _log(f"⚠️ 跳过不存在的扫描目录: {root}")
            continue

        tree = _walk_dir(root, root, exclude, sort_by)
        roots_result.append({
            "path": str(root),
            "name": root.name or str(root),
            "type": "dir",
            "children": tree,
        })

    return roots_result


def _sort_entries(items: list, sort_by: str) -> list:
    """同层排序：目录永远在前，文件在后，两组内部按 sort_by 排。

    sort_by:
      - mtime_desc (默认): 修改时间倒序（最近修改在最上）
      - name_asc: 名称升序
    """
    def key_mtime(x):
        return -int(x.get("mtime") or 0)
    def key_name(x):
        return x.get("name", "").lower()

    dirs = [i for i in items if i.get("type") == "dir"]
    files = [i for i in items if i.get("type") != "dir"]

    if sort_by == "mtime_desc":
        # 目录也按 mtime 排——需要补齐 mtime 字段（用其下最新文件的 mtime 传上来）
        dirs.sort(key=lambda d: -int(d.get("mtime") or 0))
        files.sort(key=key_mtime)
    else:  # name_asc
        dirs.sort(key=key_name)
        files.sort(key=key_name)
    return dirs + files


def _walk_dir(base: Path, current: Path, exclude: set, sort_by: str = "mtime_desc") -> list:
    """递归扫描，只保留包含 HTML/MD 的分支"""
    items = []
    try:
        entries = list(os.scandir(current))
    except OSError:
        return items

    for entry in entries:
        if entry.name.startswith(".") or entry.name in exclude:
            continue
        try:
            if entry.is_dir(follow_symlinks=False):
                children = _walk_dir(base, Path(entry.path), exclude, sort_by)
                if children:  # 空目录不返回
                    # 目录 mtime = 其下所有节点的最大 mtime（递归），便于 mtime 排序
                    child_mtime = max((c.get("mtime") or 0) for c in children)
                    items.append({
                        "type": "dir",
                        "name": entry.name,
                        "path": os.path.relpath(entry.path, base.parent),
                        "abs_path": entry.path,
                        "mtime": child_mtime,
                        "children": children,
                    })
            elif entry.is_file(follow_symlinks=False):
                # v1.3: .html/.md; v1.15.1: 图片
                low = entry.name.lower()
                if low.endswith(".html"):
                    node_type = "html"
                elif low.endswith(".md"):
                    node_type = "md"
                elif any(low.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")):
                    node_type = "image"
                else:
                    continue
                try:
                    st = entry.stat()
                    items.append({
                        "type": node_type,
                        "name": entry.name,
                        "path": os.path.relpath(entry.path, base.parent),
                        "abs_path": entry.path,
                        "size": st.st_size,
                        "mtime": int(st.st_mtime),
                    })
                except OSError:
                    pass
        except OSError:
            continue

    return _sort_entries(items, sort_by)


def get_tree(cfg: dict, force: bool = False, sort_by: str = "mtime_desc") -> list:
    """带缓存的目录树获取（缓存 key 含 sort_by）"""
    now = time.time()
    sig = json.dumps(_enabled_root_paths(cfg), sort_keys=True)
    if (not force
            and _tree_cache["data"] is not None
            and _tree_cache["roots_signature"] == sig
            and _tree_cache.get("sort_by") == sort_by
            and (now - _tree_cache["ts"]) < CACHE_TTL):
        return _tree_cache["data"]

    data = _scan_tree(cfg, sort_by)
    _tree_cache.update({"ts": now, "data": data, "roots_signature": sig, "sort_by": sort_by})
    return data


# v1.10.1: 极轻量目录签名（用于自动刷新先比对签名再决定是否拉全树）
def _walk_signature(current: Path, exclude: set, parts: list, max_mtime_ref: list) -> None:
    """递归收集 (rel_path, mtime, size) 三元组，不构建嵌套对象，性能比 _walk_dir 轻 5x+"""
    try:
        entries = list(os.scandir(current))
    except OSError:
        return
    for entry in entries:
        if entry.name.startswith(".") or entry.name in exclude:
            continue
        try:
            if entry.is_dir(follow_symlinks=False):
                _walk_signature(Path(entry.path), exclude, parts, max_mtime_ref)
            elif entry.is_file(follow_symlinks=False):
                low = entry.name.lower()
                if not (low.endswith(".html") or low.endswith(".md")):
                    continue
                try:
                    st = entry.stat()
                    parts.append(f"{entry.path}|{int(st.st_mtime)}|{st.st_size}")
                    if st.st_mtime > max_mtime_ref[0]:
                        max_mtime_ref[0] = st.st_mtime
                except OSError:
                    pass
        except OSError:
            continue


def get_tree_signature(cfg: dict) -> dict:
    """带 1 秒缓存的轻量签名计算。返回 {sig, file_count, mtime_max, ts}"""
    import hashlib
    now = time.time()
    roots_sig = json.dumps(_enabled_root_paths(cfg), sort_keys=True)
    if (_sig_cache["data"] is not None
            and _sig_cache["roots_signature"] == roots_sig
            and (now - _sig_cache["ts"]) < SIG_CACHE_TTL):
        return _sig_cache["data"]

    exclude = set(cfg.get("exclude_patterns", []))
    parts: list = []
    max_mtime_ref = [0.0]
    for root_path in _enabled_root_paths(cfg):
        _walk_signature(Path(root_path), exclude, parts, max_mtime_ref)

    parts.sort()  # 排序后哈希才稳定
    h = hashlib.md5("\n".join(parts).encode("utf-8")).hexdigest()[:16]
    data = {
        "sig": h,
        "file_count": len(parts),
        "mtime_max": int(max_mtime_ref[0]),
        "ts": int(now),
    }
    _sig_cache.update({"ts": now, "data": data, "roots_signature": roots_sig})
    return data


# ─────────────────────────────────────────────────────────────────────────────
# 路由 handler
# ─────────────────────────────────────────────────────────────────────────────
def _no_cache(resp):
    """v1.7.4: 响应彻底禁缓存——no-store 头 + 剥离 ETag/Last-Modified。
    解决 v1.7.1 只加 Cache-Control 但 aiohttp FileResponse 自动带 ETag
    导致浏览器 If-None-Match → 304 → 用旧缓存的陷阱。"""
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    # 关键：剥离条件请求相关头，防止浏览器走 304
    for h in ("ETag", "Last-Modified"):
        if h in resp.headers:
            del resp.headers[h]
    return resp


# v1.7.4: 静态文件扩展名 → Content-Type 映射
_CTYPE_MAP = {
    ".html": "text/html",
    ".htm":  "text/html",
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".css":  "text/css",
    ".json": "application/json",
    ".svg":  "image/svg+xml",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".ico":  "image/x-icon",
    ".txt":  "text/plain",
    ".md":   "text/markdown",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


def _serve_file_nocache(path: str, default_ctype: str = "application/octet-stream"):
    """v1.7.4: 取代 FileResponse——读文件 + Response，避免 aiohttp 自动生成 ETag/Last-Modified。
    这是根治"浏览器看老版本"的关键：FileResponse 会自动带 ETag，即使 Cache-Control: no-store
    也会让浏览器发送 If-None-Match 拿到 304，从而使用本地缓存的旧内容。
    """
    ext = os.path.splitext(path)[1].lower()
    ctype = _CTYPE_MAP.get(ext, default_ctype)
    is_text = ctype.startswith("text/") or ctype.startswith("application/json") or ctype == "application/javascript" or ctype == "image/svg+xml"
    try:
        if is_text:
            with open(path, "r", encoding="utf-8") as f:
                body = f.read()
            resp = web.Response(text=body, content_type=ctype, charset="utf-8")
        else:
            with open(path, "rb") as f:
                body = f.read()
            resp = web.Response(body=body, content_type=ctype)
    except Exception as e:
        return web.Response(status=500, text=f"读文件失败: {e}")
    _no_cache(resp)
    return resp


async def handle_index(request):
    """主页"""
    idx = os.path.join(WEB_DIR, "index.html")
    if not os.path.exists(idx):
        return web.Response(
            text="<h1>HTML Doc Center</h1><p>web/index.html 尚未生成。</p>",
            content_type="text/html",
        )
    return _serve_file_nocache(idx, "text/html")


async def handle_static(request):
    """静态资源"""
    fname = request.match_info["fname"]
    # 防穿越：只允许 web/ 下的文件
    safe = os.path.normpath(os.path.join(WEB_DIR, fname))
    if not safe.startswith(WEB_DIR) or not os.path.isfile(safe):
        return web.Response(status=404, text="Not found")
    return _serve_file_nocache(safe)


async def handle_saver_js(request):
    """返回 saver-runtime.js（供 iframe 注入）"""
    if not os.path.exists(SAVER_JS):
        return web.Response(status=404, text="saver-runtime.js 未生成")
    return _serve_file_nocache(SAVER_JS, "application/javascript")


async def handle_tree(request):
    """GET /api/tree - 返回扫描目录树（支持 sort 和 refresh）"""
    cfg = request.app["config"]
    force = request.query.get("refresh") == "1"
    sort_by = request.query.get("sort", "mtime_desc")
    if sort_by not in ("mtime_desc", "name_asc"):
        sort_by = "mtime_desc"
    try:
        tree = get_tree(cfg, force=force, sort_by=sort_by)
        return web.json_response({
            "ok": True, "roots": tree, "sort_by": sort_by, "ts": int(time.time())
        })
    except Exception as e:
        _log(f"❌ /api/tree 失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_tree_sig(request):
    """v1.10.1: GET /api/tree-sig — 返回轻量签名（~80字节）。
    前端先 GET 此端点，签名变化时才拉全量 /api/tree。
    实测：~95% 的轮询无变化时单次 < 100B vs 全树 1.3MB（4001 节点）。"""
    cfg = request.app["config"]
    try:
        sig_data = get_tree_signature(cfg)
        return web.json_response({"ok": True, **sig_data})
    except Exception as e:
        _log(f"❌ /api/tree-sig 失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_browse(request):
    """GET /api/browse?path=...&mode=file - 浏览目录，返回子目录列表（+ 文件列表当 mode=file）。"""
    target = request.query.get("path", "")
    mode = request.query.get("mode", "")  # v1.19: "" 或 "file"
    try:
        if not target:
            # 没传 path，返回常用起始点
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
            # 过滤存在的目录
            roots = [r for r in roots if Path(r["path"]).is_dir()]
            # 也加入已有的 scan_roots 的父目录作为快捷入口
            cfg = request.app["config"]
            for item in cfg.get("scan_roots", []):
                p = item["path"] if isinstance(item, dict) else item
                parent = str(Path(p).parent)
                if parent not in [r["path"] for r in roots] and Path(parent).is_dir():
                    name = Path(parent).name or parent
                    roots.append({"name": f"📌 {name}", "path": parent})
            return web.json_response({
                "ok": True, "current": "", "parent": "",
                "dirs": roots, "is_root": True,
                **({"files": []} if mode == "file" else {})  # v1.19: root 时 files 为空
            })

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

        # v1.19: mode=file 时额外返回 HTML/MD 文件列表
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


# ─────────────────────────────────────────────────────────────────────────────
# v1.19: _dropbox/ 拖入副本管理
# ─────────────────────────────────────────────────────────────────────────────
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_UPLOAD_EXT = {".html", ".htm", ".md"}
DROPBOX_MAX_AGE_DAYS = 7


def get_dropbox_dir() -> Path:
    """Return _dropbox/ directory path under server CWD. Create if not exists."""
    dropbox = Path.cwd() / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    return dropbox


def cleanup_dropbox():
    """Clean up _dropbox/ files older than DROPBOX_MAX_AGE_DAYS. Non-fatal on errors."""
    try:
        dropbox = get_dropbox_dir()
        cutoff = time.time() - DROPBOX_MAX_AGE_DAYS * 86400
        for entry in dropbox.iterdir():
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink()
            except Exception as e:
                _log(f"⚠️ _dropbox/ cleanup: failed to delete {entry}: {e}")
    except Exception as e:
        _log(f"⚠️ _dropbox/ cleanup failed (non-fatal): {e}")


async def handle_drag_upload(request):
    """POST /api/drag-upload - 接收拖入的文件，写到 _dropbox/，返回 abs_path。"""
    try:
        reader = await request.multipart()
        file_content = None
        file_filename = None
        filename_field = None
        async for field in reader:
            if field.name == "file":
                # 在遍历时立即读内容，避免 field 被消费后无法读取
                file_content = await field.read(decode=False)
                file_filename = field.filename
            elif field.name == "filename":
                filename_field = (await field.text()).strip()

        if file_content is None:
            return web.json_response({"ok": False, "error": "missing file field"}, status=400)
        if not filename_field:
            filename_field = file_filename or "unnamed.html"

        ext = Path(filename_field).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXT:
            return web.json_response(
                {"ok": False, "error": f"unsupported file type: {ext}, only .html/.htm/.md allowed"},
                status=400,
            )

        if len(file_content) > MAX_UPLOAD_SIZE:
            return web.json_response(
                {"ok": False, "error": f"file too large ({len(file_content)} bytes > {MAX_UPLOAD_SIZE} bytes)"},
                status=413,
            )

        dropbox = get_dropbox_dir()
        dest = dropbox / filename_field
        if dest.exists():
            stem = Path(filename_field).stem
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            dest = dropbox / f"{stem}-{timestamp}{ext}"
        dest.write_bytes(file_content)

        return web.json_response({
            "ok": True,
            "abs_path": str(dest),
            "name": dest.name,
            "type": "md" if ext == ".md" else "html",
        })
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_save_as(request):
    """POST /api/save-as - 复制文件到新位置（拖入副本另存为）。"""
    try:
        body = await request.json()
        src_path = body.get("src_path", "")
        dest_path = body.get("dest_path", "")
        overwrite = body.get("overwrite", False)
        if not src_path or not dest_path:
            return web.json_response({"ok": False, "error": "missing src_path or dest_path"}, status=400)

        src = Path(src_path).expanduser().resolve()
        dest = Path(dest_path).expanduser().resolve()

        if not src.exists():
            return web.json_response({"ok": False, "error": "source_not_found"}, status=404)
        if dest.exists() and not overwrite:
            return web.json_response({"ok": False, "error": "target_exists"}, status=409)
        if dest.exists() and overwrite:
            dest.unlink()

        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(src, dest)  # copy2 保留 mtime
        except PermissionError:
            return web.json_response({"ok": False, "error": "permission_denied"}, status=403)

        return web.json_response({"ok": True, "dest_path": str(dest)})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# v1.20.0: Native picker（弹 macOS NSOpenPanel / Windows FolderBrowser）
# 替代 HTML 模仿版 modal，提供"和微信/其他软件一样的"系统原生体验
# ─────────────────────────────────────────────────────────────────────────────
def _native_pick_dir_macos(start_dir=None):
    """macOS: 用 osascript 弹 NSOpenPanel 选目录，返回 POSIX 路径（取消返回 None）"""
    start = start_dir or str(Path.home())
    # AppleScript 选择目录
    script = f'''
    set theFolder to (choose folder with prompt "选择文件夹" default location POSIX file "{start}")
    return POSIX path of theFolder
    '''
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            return path if path else None
        # 用户取消 (returncode != 0 且无 error) → None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        _log(f"⚠️ native_pick_dir_macos failed: {e}")
        return None


def _native_pick_file_macos(start_dir=None, file_types=None):
    """macOS: 用 osascript 弹 NSOpenPanel 选文件，返回 POSIX 路径
    file_types: ['html', 'md'] 这样的扩展名列表
    """
    start = start_dir or str(Path.home())
    # file_types 转 NSOpenPanel 的 of type 列表
    if file_types:
        types_clause = " of type {" + ", ".join(f'"{t}"' for t in file_types) + "}"
    else:
        types_clause = ""
    script = f'''
    set theFile to (choose file with prompt "选择文件" default location POSIX file "{start}"{types_clause})
    return POSIX path of theFile
    '''
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            return path if path else None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        _log(f"⚠️ native_pick_file_macos failed: {e}")
        return None


def _native_pick_dir_windows(start_dir=None):
    """Windows: 用 PowerShell 弹 FolderBrowser 对话框（Shell.Application）"""
    start = start_dir or str(Path.home())
    ps_script = f'''
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = "选择文件夹"
    $f.SelectedPath = "{start.replace(chr(92), chr(92)+chr(92))}"
    $f.ShowNewFolderButton = $true
    if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
        Write-Output $f.SelectedPath
    }}
    '''
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            return path if path else None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        _log(f"⚠️ native_pick_dir_windows failed: {e}")
        return None


def _native_pick_file_windows(start_dir=None, file_types=None):
    """Windows: 用 PowerShell 弹 OpenFileDialog"""
    start = start_dir or str(Path.home())
    # file_filter: "HTML Files|*.html;*.htm;*.md|All Files|*.*"
    if file_types:
        extensions = ";".join(f"*.{t}" for t in file_types)
        filter_str = f"支持的格式|{extensions}|所有文件|*.*"
    else:
        filter_str = "所有文件|*.*"
    ps_script = f'''
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Title = "选择文件"
    $f.InitialDirectory = "{start.replace(chr(92), chr(92)+chr(92))}"
    $f.Filter = "{filter_str}"
    if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
        Write-Output $f.FileName
    }}
    '''
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            path = result.stdout.strip()
            return path if path else None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        _log(f"⚠️ native_pick_file_windows failed: {e}")
        return None


def _native_pick_linux(start_dir=None, file_mode=False, file_types=None):
    """Linux: 用 zenity/kdialog 弹原生选择器（GNOME/KDE）"""
    start = start_dir or str(Path.home())
    if file_mode:
        # 文件选择
        filters = ["--file-filter"] + [
            f"*.{t} " for t in (file_types or [])
        ] if file_types else []
        cmd_base = ["zenity", "--file-selection", f"--filename={start}/"]
        cmd = cmd_base + filters
    else:
        cmd = ["zenity", "--file-selection", "--directory", f"--filename={start}/"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Fallback to kdialog
        kcmd = ["kdialog", "--getopenfilename" if file_mode else "--getexistingdirectory", start]
        try:
            r2 = subprocess.run(kcmd, capture_output=True, text=True, timeout=300)
            return r2.stdout.strip() if r2.returncode == 0 else None
        except Exception:
            return None


async def handle_native_pick_dir(request):
    """POST /api/native-pick-dir - 调系统原生文件夹选择器
    body: {start_dir?: string} 返回 {ok, path?, cancelled?, error?}
    """
    try:
        try:
            data = await request.json() if request.body_exists else {}
        except Exception:
            data = {}
        start = (data or {}).get("start_dir") or str(Path.home())
        sysname = platform.system()
        if sysname == "Darwin":
            path = _native_pick_dir_macos(start)
        elif sysname == "Windows":
            path = _native_pick_dir_windows(start)
        else:
            path = _native_pick_linux(start, file_mode=False)
        if path is None:
            return web.json_response({"ok": True, "cancelled": True})
        return web.json_response({"ok": True, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_native_pick_file(request):
    """POST /api/native-pick-file - 调系统原生文件选择器
    body: {start_dir?: string, file_types?: string[]} 返回 {ok, path?, cancelled?, error?}
    """
    try:
        try:
            data = await request.json() if request.body_exists else {}
        except Exception:
            data = {}
        data = data or {}
        start = data.get("start_dir") or str(Path.home())
        file_types = data.get("file_types") or ["html", "htm", "md"]
        sysname = platform.system()
        if sysname == "Darwin":
            path = _native_pick_file_macos(start, file_types)
        elif sysname == "Windows":
            path = _native_pick_file_windows(start, file_types)
        else:
            path = _native_pick_linux(start, file_mode=True, file_types=file_types)
        if path is None:
            return web.json_response({"ok": True, "cancelled": True})
        return web.json_response({"ok": True, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_config_get(request):
    """GET /api/config"""
    cfg = request.app["config"]
    return web.json_response({"ok": True, "config": cfg})


async def handle_config_post(request):
    """POST /api/config - 更新扫描目录等配置"""
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    cfg = request.app["config"]
    # 只允许更新白名单字段
    allowed = {"scan_roots", "snapshot_debounce_ms", "snapshot_retention_days", "tree_auto_refresh_seconds", "access_password"}
    changed = []
    for k, v in data.items():
        if k in allowed:
            # v1.10.0: tree_auto_refresh_seconds 范围校验（0/5/10/30/60）
            if k == "tree_auto_refresh_seconds":
                try:
                    v = int(v)
                except (TypeError, ValueError):
                    continue
                if v not in (0, 5, 10, 30, 60):
                    continue
            cfg[k] = v
            changed.append(k)

    # 校验 scan_roots：支持 [{path, enabled}] 和旧 [str] 两种提交格式
    if "scan_roots" in changed:
        raw_roots = cfg["scan_roots"]
        validated = []
        seen_paths = set()  # 服务端去重
        for item in raw_roots:
            if isinstance(item, str):
                item = {"path": item, "enabled": True}
            if not isinstance(item, dict) or "path" not in item:
                continue
            rp = Path(item["path"]).expanduser()
            if rp.exists() and rp.is_dir():
                resolved = str(rp.resolve())
                if resolved in seen_paths:
                    continue  # 跳过重复路径
                seen_paths.add(resolved)
                item["path"] = resolved
                item.setdefault("enabled", True)
                validated.append(item)
        cfg["scan_roots"] = validated

    save_config(cfg)
    _tree_cache["data"] = None; _sig_cache["data"] = None  # 清缓存
    _log(f"⚙️  配置已更新: {changed}")
    return web.json_response({"ok": True, "config": cfg})


# ─────────────────────────────────────────────────────────────────────────────
# HTML 加载 + saver 注入
# ─────────────────────────────────────────────────────────────────────────────
SAVER_INJECT_MARKER = "<!-- html-doc-center:saver-injected -->"


def inject_saver(html: str, file_path: str, cfg: dict) -> str:
    """
    在 HTML 里注入 saver-runtime.js 引用 + <base href> 资源代理。
    - 已注入过（有 marker）则跳过
    - 优先插到 </body> 前；没有 body 则追加到文件尾
    - 通过 window.__DOC_CENTER__ 变量传递文件路径等上下文
    - v1.15: 注入 <base href> 让相对路径资源走 /api/asset/ 代理
    - v1.20.x: cfg 显式传入（之前用 `app.get` 是 bug，作用域里没有 app）
    """
    if SAVER_INJECT_MARKER in html:
        return html

    import html as html_escape_mod
    safe_path = html_escape_mod.escape(file_path).replace('"', '&quot;')
    share_server = (cfg or {}).get("share_server", "")

    # v1.15: 注入 <base href> 让相对路径走资源代理（如果原 HTML 没有 <base>）
    has_base = bool(re.search(r"<base\s", html, re.IGNORECASE))
    if not has_base:
        base_href = _make_base_href(file_path)
        base_tag = f'<base href="{base_href}">\n'
        # 插入到 <head> 之后（或 <html> 之后，或文件最前）
        head_m = re.search(r"<head[^>]*>", html, re.IGNORECASE)
        if head_m:
            insert_pos = head_m.end()
            html = html[:insert_pos] + "\n" + base_tag + html[insert_pos:]
        else:
            html_m = re.search(r"<html[^>]*>", html, re.IGNORECASE)
            if html_m:
                insert_pos = html_m.end()
                html = html[:insert_pos] + "\n" + base_tag + html[insert_pos:]
            else:
                html = base_tag + html

    snippet = (
        f'\n{SAVER_INJECT_MARKER}\n'
        '<script>\n'
        'window.__DOC_CENTER__ = {\n'
        f'  filePath: "{safe_path}",\n'
        '  serverOrigin: window.location.origin || "http://localhost:9901",\n'
        '  inIframe: window.self !== window.top,\n'
        f'  shareServer: "{share_server}"\n'
        '};\n'
        '</script>\n'
        '<script src="/saver-runtime.js" defer></script>\n'
    )

    # 不区分大小写查找 </body>
    m = re.search(r"</body\s*>", html, re.IGNORECASE)
    if m:
        return html[: m.start()] + snippet + html[m.start():]
    # 没 body 直接追加
    return html + snippet


MD_EDITOR_TEMPLATE_PATH = os.path.join(WEB_DIR, "md-editor.html")


def render_md_shell(md_path: Path, port: int) -> str:
    """
    v1.3: 把 Markdown 文件内容包装成壳子 HTML 返回。
    壳子是 web/md-editor.html，含 4 个占位符：
      {{MD_CONTENT}}   - MD 原文（HTML 转义后放进 <textarea>）
      {{FILE_NAME}}    - 文件名（展示用）
      {{FILE_PATH}}    - 绝对路径（注入 __DOC_CENTER__.filePath）
      {{SERVER_ORIGIN}} - http://localhost:{port}
    saver-runtime.js 会在壳子加载后通过 __DOC_CENTER__.mode === "md" 走 md 分支。
    """
    import html as html_escape_mod

    with open(MD_EDITOR_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        tpl = f.read()

    with open(md_path, "r", encoding="utf-8", errors="replace") as f:
        md_raw = f.read()

    # textarea 内容必须 HTML 转义（尤其 &<>），否则 </textarea> 会提前闭合
    md_escaped = html_escape_mod.escape(md_raw)
    file_name_esc = html_escape_mod.escape(md_path.name).replace('"', '&quot;')
    file_path_esc = html_escape_mod.escape(str(md_path)).replace('"', '&quot;')
    server_origin = f"http://localhost:{port}"

    return (tpl
            .replace("{{MD_CONTENT}}", md_escaped)
            .replace("{{FILE_NAME}}", file_name_esc)
            .replace("{{FILE_PATH}}", file_path_esc)
            .replace("{{SERVER_ORIGIN}}", server_origin))


def _render_image_shell(img_path: Path) -> str:
    """
    v1.15.1: 生成图片预览壳子 HTML。
    居中显示图片 + 文件名，不注入 saver-runtime（图片不可编辑）。
    图片 src 走 /api/asset/ 代理。
    """
    import html as html_escape_mod
    file_name = html_escape_mod.escape(img_path.name)
    # 图片 URL 走 asset 代理
    dir_path = str(img_path.parent)
    encoded_dir = base64.urlsafe_b64encode(dir_path.encode("utf-8")).decode("utf-8").rstrip("=")
    img_url = f"/api/asset/{encoded_dir}/{img_path.name}"

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>{file_name} · Image Preview</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    background: #1a1a2e;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }}
  .img-container {{
    max-width: 95vw; max-height: 80vh;
    background: #fff; border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,.4);
    padding: 8px; display: flex; align-items: center; justify-content: center;
  }}
  .img-container img {{
    max-width: 100%; max-height: 78vh;
    object-fit: contain; border-radius: 4px;
  }}
  .filename {{
    margin-top: 16px; color: rgba(255,255,255,.7);
    font-size: 13px; letter-spacing: .5px;
  }}
</style>
</head>
<body>
  <div class="img-container">
    <img src="{img_url}" alt="{file_name}">
  </div>
  <div class="filename">🖼️ {file_name}</div>
  <script>
    // v1.15.2: 图片壳子发送 ready 消息，防止父窗口 12s 超时弹 fallback
    if (window.parent !== window) {{
      window.parent.postMessage({{ source: "doc-center-saver", type: "ready" }}, "*");
    }}
  </script>
</body>
</html>"""


async def handle_file(request):
    """
    GET /api/file?path=<相对或绝对路径>
      - .html → 注入 saver 后返回原 HTML
      - .md   → 返回包装成壳子 HTML 的 Markdown 编辑器
    """
    cfg = request.app["config"]
    raw = request.query.get("path", "").strip()
    if not raw:
        return web.json_response({"ok": False, "error": "missing path"}, status=400)

    safe = _resolve_safe(raw, cfg.get("scan_roots", []))
    suffix = safe.suffix.lower() if safe else ""
    IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")
    SUPPORTED_EXTS = (".html", ".md") + IMAGE_EXTS
    if not safe or not safe.is_file() or suffix not in SUPPORTED_EXTS:
        return web.json_response({"ok": False, "error": "非法或不存在的文件路径"}, status=403)

    try:
        if suffix == ".html":
            with open(safe, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            injected = inject_saver(content, str(safe), cfg)
        elif suffix == ".md":
            port = int(cfg.get("port", 9901))
            injected = render_md_shell(safe, port)
        else:
            # v1.15.1: 图片 → 预览壳子（不注入 saver，不可编辑）
            injected = _render_image_shell(safe)
    except FileNotFoundError as e:
        return web.json_response({"ok": False, "error": f"模板缺失: {e}"}, status=500)
    except Exception as e:
        return web.json_response({"ok": False, "error": f"读取失败: {e}"}, status=500)

    resp = web.Response(text=injected, content_type="text/html", charset="utf-8")
    # 禁缓存，保证每次打开都是最新（多层防御）
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    resp.headers["Vary"] = "*"
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# v1.15: 静态资源代理
# ─────────────────────────────────────────────────────────────────────────────
def _make_base_href(file_path: str) -> str:
    """生成 <base href> 指向文件所在目录的资源代理 URL"""
    dir_path = str(Path(file_path).parent)
    encoded = base64.urlsafe_b64encode(dir_path.encode("utf-8")).decode("utf-8").rstrip("=")
    return f'/api/asset/{encoded}/'


async def handle_asset(request):
    """
    GET /api/asset/{encoded_dir}/{path:.*}
    代理 HTML 同目录/子目录下的静态资源（图片/CSS/JS/字体等）。
    encoded_dir = urlsafe_b64encode(目录绝对路径) 去尾部 =
    """
    encoded_dir = request.match_info["encoded_dir"]
    rel_path = request.match_info.get("path", "")

    if not rel_path:
        return web.Response(status=400, text="Missing resource path")

    # 解码 base 目录（补回尾部 padding）
    try:
        padded = encoded_dir + "=" * (-len(encoded_dir) % 4)
        base_dir = base64.urlsafe_b64decode(padded.encode()).decode("utf-8")
    except Exception:
        return web.Response(status=400, text="Invalid base directory encoding")

    # 拼合绝对路径
    full_path = (Path(base_dir) / rel_path).resolve()

    # 安全校验：必须在 scan_roots 内
    cfg = request.app["config"]
    safe = _resolve_safe(str(full_path), cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.Response(status=403, text="Access denied or file not found")

    # 不代理 .html / .md（这些走 /api/file）
    if safe.suffix.lower() in (".html", ".md"):
        return web.Response(status=403, text="Use /api/file for HTML/MD documents")

    # 推断 MIME type
    mime, _ = mimetypes.guess_type(str(safe))
    if not mime:
        mime = "application/octet-stream"

    return web.FileResponse(safe, headers={"Content-Type": mime})


# ─────────────────────────────────────────────────────────────────────────────
# 快照与保存
# ─────────────────────────────────────────────────────────────────────────────
def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _auto_save_dir(source_file: Path) -> Path:
    d = source_file.parent / "_auto-save"
    d.mkdir(exist_ok=True)
    return d


def _clean_auto_save(source_file: Path) -> int:
    """
    清理某源文件关联的自动快照。
    v1.3: 按源文件 suffix 过滤（支持 .html 和 .md）；
          **不**清理 pre-overwrite 备份（它是安全副本，只在 cleanup_old_snapshots 按 mtime 过期才动）
    """
    auto_dir = source_file.parent / "_auto-save"
    if not auto_dir.exists():
        return 0
    prefix = source_file.stem + "-"
    backup_prefix = source_file.stem + "-pre-overwrite-"
    src_suffix = source_file.suffix
    removed = 0
    for f in auto_dir.iterdir():
        if (f.is_file()
                and f.name.startswith(prefix)
                and not f.name.startswith(backup_prefix)  # 保护 pre-overwrite 备份
                and f.suffix == src_suffix):
            try:
                f.unlink()
                removed += 1
            except OSError:
                pass
    # 若目录已空则删除
    try:
        if not any(auto_dir.iterdir()):
            auto_dir.rmdir()
    except OSError:
        pass
    return removed


async def handle_snapshot(request):
    """POST /api/snapshot {path, content} → 写 _auto-save/{stem}-{ts}.html"""
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    raw_path = (data.get("path") or "").strip()
    content = data.get("content") or ""
    if not raw_path or not content:
        return web.json_response({"ok": False, "error": "path/content 必填"}, status=400)

    safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.json_response({"ok": False, "error": "非法路径"}, status=403)

    auto_dir = _auto_save_dir(safe)
    # v1.3: 快照扩展名跟随源文件（.html → .html，.md → .md）
    snap_name = f"{safe.stem}-{_timestamp()}{safe.suffix}"
    snap_path = auto_dir / snap_name

    try:
        with open(snap_path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        return web.json_response({"ok": False, "error": f"写快照失败: {e}"}, status=500)

    # 仅保留该源文件最近 20 个快照（按源文件 suffix 过滤，排除 pre-overwrite 备份）
    try:
        prefix = safe.stem + "-"
        backup_prefix = safe.stem + "-pre-overwrite-"
        src_suffix = safe.suffix
        snaps = sorted(
            [p for p in auto_dir.iterdir()
             if p.name.startswith(prefix)
             and not p.name.startswith(backup_prefix)
             and p.suffix == src_suffix],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in snaps[20:]:
            old.unlink(missing_ok=True)
    except Exception:
        pass

    return web.json_response({
        "ok": True,
        "snapshot_path": str(snap_path),
        "ts": int(time.time()),
    })


async def handle_save(request):
    """
    POST /api/save {path, mode, content?}
      mode=overwrite → 合入源文件，清理 _auto-save
      mode=new       → 另存为 {stem}-审阅版-{ts}.html，清理 _auto-save，返回新路径
      mode=discard   → 仅清理 _auto-save
    """
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    raw_path = (data.get("path") or "").strip()
    mode = (data.get("mode") or "").strip()
    content = data.get("content") or ""

    if mode not in ("overwrite", "new", "discard"):
        return web.json_response({"ok": False, "error": "mode 必须为 overwrite/new/discard"}, status=400)

    safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.json_response({"ok": False, "error": "非法路径"}, status=403)

    if mode == "discard":
        n = _clean_auto_save(safe)
        _log(f"🗑  丢弃编辑 → 清理 {n} 个快照: {safe.name}")
        return web.json_response({"ok": True, "mode": "discard", "cleaned": n})

    if not content:
        return web.json_response({"ok": False, "error": "overwrite/new 必须传 content"}, status=400)

    if mode == "overwrite":
        # 先备份一个安全副本（v1.3: 备份扩展名跟随源文件，确保能被 _clean_auto_save 清理）
        backup_dir = _auto_save_dir(safe)
        backup = backup_dir / f"{safe.stem}-pre-overwrite-{_timestamp()}{safe.suffix}"
        try:
            shutil.copy2(safe, backup)
        except Exception as e:
            _log(f"⚠️ 备份原文件失败: {e}")

        try:
            with open(safe, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            return web.json_response({"ok": False, "error": f"写源文件失败: {e}"}, status=500)

        cleaned = _clean_auto_save(safe)
        _log(f"✅ 覆盖源文件: {safe.name}（备份+清理 {cleaned} 个快照）")
        return web.json_response({
            "ok": True,
            "mode": "overwrite",
            "saved_to": str(safe),
            "backup": str(backup) if backup.exists() else None,
        })

    # mode == "new"（v1.3: 扩展名跟随源文件，避免 .md 另存成 .html）
    new_name = f"{safe.stem}-审阅版-{_timestamp()}{safe.suffix}"
    new_path = safe.parent / new_name
    try:
        with open(new_path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        return web.json_response({"ok": False, "error": f"写新版本失败: {e}"}, status=500)

    cleaned = _clean_auto_save(safe)
    _tree_cache["data"] = None; _sig_cache["data"] = None  # 新文件生成，清缓存让前端刷新
    _log(f"🆕 另存新版本: {new_path.name}（清理 {cleaned} 个快照）")
    return web.json_response({
        "ok": True,
        "mode": "new",
        "saved_to": str(new_path),
        "cleaned": cleaned,
    })


# ─────────────────────────────────────────────────────────────────────────────
# v1.10.2: 版本时间线 — /api/history + /api/restore
# ─────────────────────────────────────────────────────────────────────────────
async def handle_history(request):
    """GET /api/history?path=<src_abs_path> — 返回该文件的快照列表（按 mtime 倒序）

    返回 [{snapshot_path, name, kind, size, mtime, summary}]
      kind: "auto" | "pre-overwrite"
    """
    cfg = request.app["config"]
    raw_path = (request.query.get("path") or "").strip()
    safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.json_response({"ok": False, "error": "非法路径"}, status=403)

    auto_dir = safe.parent / "_auto-save"
    if not auto_dir.exists():
        return web.json_response({"ok": True, "items": [], "current_size": safe.stat().st_size})

    prefix = safe.stem + "-"
    backup_prefix = safe.stem + "-pre-overwrite-"
    restore_prefix = safe.stem + "-pre-restore-"  # v1.10.3
    src_suffix = safe.suffix
    items = []
    try:
        current_size = safe.stat().st_size
    except OSError:
        current_size = 0

    for f in auto_dir.iterdir():
        if not (f.is_file() and f.name.startswith(prefix) and f.suffix == src_suffix):
            continue
        try:
            st = f.stat()
            # v1.10.3: 三种 kind
            if f.name.startswith(restore_prefix):
                kind = "pre-restore"
            elif f.name.startswith(backup_prefix):
                kind = "pre-overwrite"
            else:
                kind = "auto"
            # summary：粗略字数差（仅对源文件做对比）
            size_delta = st.st_size - current_size
            items.append({
                "snapshot_path": str(f),
                "name": f.name,
                "kind": kind,
                "size": st.st_size,
                "mtime": int(st.st_mtime),
                "size_delta": size_delta,
            })
        except OSError:
            continue

    items.sort(key=lambda x: x["mtime"], reverse=True)
    return web.json_response({
        "ok": True,
        "items": items,
        "current_size": current_size,
        "current_mtime": int(safe.stat().st_mtime),
    })


async def handle_history_content(request):
    """GET /api/history/content?path=<snapshot_abs_path> — 返回某快照的原始内容（HTML/MD）

    用于预览：iframe srcdoc 直接渲染。
    安全：必须在 scan_roots 之内 + 路径必须在 _auto-save/ 子目录里。
    """
    cfg = request.app["config"]
    raw_path = (request.query.get("path") or "").strip()
    safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file():
        return web.json_response({"ok": False, "error": "非法路径"}, status=403)
    # 必须在 _auto-save 目录下，避免暴露任意文件
    if safe.parent.name != "_auto-save":
        return web.json_response({"ok": False, "error": "仅允许 _auto-save 内文件"}, status=403)
    try:
        content = safe.read_text(encoding="utf-8")
    except Exception as e:
        return web.json_response({"ok": False, "error": f"读取失败: {e}"}, status=500)
    return web.json_response({"ok": True, "name": safe.name, "content": content, "size": safe.stat().st_size})


async def handle_history_diff(request):
    """v1.10.3: GET /api/history/diff?path=<snapshot>&source=<src> — 行级 diff summary

    用 Python 自带 difflib（零新依赖）做行级 unified diff。
    返回 {ok, lines_added, lines_removed, lines_changed, hunks: [{header, added, removed}]}
    用于在历史抽屉每条卡片显示"+12 行 / -3 行"这类精确摘要。
    """
    import difflib
    cfg = request.app["config"]
    snap_raw = (request.query.get("path") or "").strip()
    src_raw = (request.query.get("source") or "").strip()

    snap_safe = _resolve_safe(snap_raw, cfg.get("scan_roots", []))
    src_safe = _resolve_safe(src_raw, cfg.get("scan_roots", []))
    if not snap_safe or not snap_safe.is_file() or snap_safe.parent.name != "_auto-save":
        return web.json_response({"ok": False, "error": "snapshot 路径非法"}, status=403)
    if not src_safe or not src_safe.is_file():
        return web.json_response({"ok": False, "error": "source 路径非法"}, status=403)

    try:
        old_lines = snap_safe.read_text(encoding="utf-8").splitlines()
        new_lines = src_safe.read_text(encoding="utf-8").splitlines()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"读取失败: {e}"}, status=500)

    # 行级 diff 统计（不返回每一行 detail，只返回数字 + 前 5 个变更段头）
    added = 0
    removed = 0
    hunks = []
    try:
        diff_iter = difflib.unified_diff(old_lines, new_lines,
                                          fromfile="snapshot", tofile="current",
                                          lineterm="", n=1)
        current_hunk = None
        for line in diff_iter:
            if line.startswith("@@"):
                if current_hunk and len(hunks) < 5:
                    hunks.append(current_hunk)
                current_hunk = {"header": line, "added": 0, "removed": 0}
            elif line.startswith("+++") or line.startswith("---"):
                continue
            elif line.startswith("+"):
                added += 1
                if current_hunk: current_hunk["added"] += 1
            elif line.startswith("-"):
                removed += 1
                if current_hunk: current_hunk["removed"] += 1
        if current_hunk and len(hunks) < 5:
            hunks.append(current_hunk)
    except Exception as e:
        return web.json_response({"ok": False, "error": f"diff 失败: {e}"}, status=500)

    return web.json_response({
        "ok": True,
        "lines_added": added,
        "lines_removed": removed,
        "lines_total_old": len(old_lines),
        "lines_total_new": len(new_lines),
        "hunks": hunks,
    })


async def handle_restore(request):
    """POST /api/restore {snapshot_path, source_path} — 一键恢复历史版本

    流程：
      1. 校验 snapshot 在 _auto-save 内、source 在 scan_roots 内、两者同 stem 同 suffix
      2. 把当前 source 内容备份成 pre-restore 快照
      3. 用 snapshot 内容覆盖 source
    """
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    snapshot_raw = (data.get("snapshot_path") or "").strip()
    source_raw = (data.get("source_path") or "").strip()

    snap_safe = _resolve_safe(snapshot_raw, cfg.get("scan_roots", []))
    src_safe = _resolve_safe(source_raw, cfg.get("scan_roots", []))
    if not snap_safe or not snap_safe.is_file() or snap_safe.parent.name != "_auto-save":
        return web.json_response({"ok": False, "error": "snapshot 路径非法"}, status=403)
    if not src_safe or not src_safe.is_file():
        return web.json_response({"ok": False, "error": "source 路径非法"}, status=403)
    # 校验两者关联：同后缀 + snapshot 名以 source.stem + "-" 开头
    if snap_safe.suffix != src_safe.suffix:
        return web.json_response({"ok": False, "error": "snapshot 与 source 后缀不一致"}, status=400)
    if not snap_safe.name.startswith(src_safe.stem + "-"):
        return web.json_response({"ok": False, "error": "snapshot 与 source 不属于同一文件"}, status=400)

    # Step 1: 当前内容做 pre-restore 快照
    try:
        backup_dir = _auto_save_dir(src_safe)
        backup = backup_dir / f"{src_safe.stem}-pre-restore-{_timestamp()}{src_safe.suffix}"
        shutil.copy2(src_safe, backup)
    except Exception as e:
        return web.json_response({"ok": False, "error": f"恢复前备份失败: {e}"}, status=500)

    # Step 2: 用 snapshot 内容覆盖 source
    try:
        content = snap_safe.read_text(encoding="utf-8")
        src_safe.write_text(content, encoding="utf-8")
    except Exception as e:
        return web.json_response({"ok": False, "error": f"恢复写入失败: {e}"}, status=500)

    _tree_cache["data"] = None; _sig_cache["data"] = None  # 文件 mtime 变化，清缓存
    _log(f"↩️  恢复历史版本: {snap_safe.name} → {src_safe.name}（pre-restore 备份: {backup.name}）")
    return web.json_response({
        "ok": True,
        "restored_from": str(snap_safe),
        "source": str(src_safe),
        "pre_restore_backup": str(backup),
    })


# ─────────────────────────────────────────────────────────────────────────────
# 上次会话（last_session）/ 在 Finder 打开（reveal）
# ─────────────────────────────────────────────────────────────────────────────
async def handle_last_session_get(request):
    """GET /api/last_session - 返回上次打开的文件（校验仍存在+在白名单内）"""
    cfg = request.app["config"]
    ls = cfg.get("last_session") or {}
    abs_path = (ls.get("abs_path") or "").strip()
    if not abs_path:
        return web.json_response({"ok": True, "session": None})

    safe = _resolve_safe(abs_path, cfg.get("scan_roots", []))
    if not safe or not safe.is_file() or safe.suffix.lower() not in (".html", ".md"):
        # 已被删除/移动/改 scan_roots/后缀不支持，清理并返回空
        cfg["last_session"] = dict(DEFAULT_CONFIG.get("last_session", {}))
        save_config(cfg)
        return web.json_response({"ok": True, "session": None})

    return web.json_response({
        "ok": True,
        "session": {
            "abs_path": str(safe),
            "name": safe.name,
            "zoom": str(ls.get("zoom") or "75"),
            "ts": int(ls.get("ts") or 0),
        },
    })


async def handle_last_session_post(request):
    """POST /api/last_session {abs_path, zoom} - 记录当前打开文件"""
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    abs_path = (data.get("abs_path") or "").strip()
    zoom = str(data.get("zoom") or "75")

    # 允许空字符串表示清空
    if abs_path:
        safe = _resolve_safe(abs_path, cfg.get("scan_roots", []))
        if not safe or not safe.is_file():
            return web.json_response({"ok": False, "error": "非法路径"}, status=403)
        abs_path = str(safe)

    cfg["last_session"] = {
        "abs_path": abs_path,
        "zoom": zoom,
        "ts": int(time.time()),
    }
    save_config(cfg)
    return web.json_response({"ok": True, "session": cfg["last_session"]})


# ─────────────────────────────────────────────────────────────────────────────
# 文件/目录移动 API（v1.7）
# ─────────────────────────────────────────────────────────────────────────────
def _move_matching_snapshots(old_file: Path, new_file: Path) -> int:
    """源文件移动后，把 _auto-save/ 里匹配 stem+suffix 的快照和 pre-overwrite 备份
    一起挪到目标目录的 _auto-save/。其他文件的快照保留原位。返回移动的快照数量。"""
    old_auto = old_file.parent / "_auto-save"
    if not old_auto.is_dir():
        return 0
    stem = old_file.stem
    suffix = old_file.suffix
    patterns = [
        f"{stem}-",                 # {stem}-时间戳.ext
        f"{stem}-pre-overwrite-",   # pre-overwrite 备份
    ]
    new_auto = new_file.parent / "_auto-save"
    moved = 0
    try:
        for p in list(old_auto.iterdir()):
            if p.suffix != suffix:
                continue
            if any(p.name.startswith(pat) for pat in patterns):
                # stem 部分替换为 new_file.stem（保留后面的时间戳+后缀）
                new_name = new_file.stem + p.name[len(stem):]
                new_auto.mkdir(exist_ok=True)
                shutil.move(str(p), str(new_auto / new_name))
                moved += 1
    except Exception as e:
        _log(f"⚠️ 移动快照失败: {e}")
    return moved


async def handle_move(request):
    """POST /api/move {src, dst_dir} - 移动单个文件/目录到目标目录

    - src 和 dst_dir 都必须通过 _resolve_safe 白名单校验
    - 冲突（目标同名已存在）→ 409，不覆盖
    - 源是文件时：匹配 stem+suffix 的快照一起移动
    - 源是目录时：整个目录移走（其内 _auto-save/ 随之走）
    """
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    raw_src = data.get("src")
    raw_dst = data.get("dst_dir")
    if not raw_src or not raw_dst:
        return web.json_response({"ok": False, "error": "src 和 dst_dir 必填"}, status=400)

    src = _resolve_safe(raw_src, cfg.get("scan_roots", []))
    dst_dir = _resolve_safe(raw_dst, cfg.get("scan_roots", []))
    if not src or not src.exists():
        return web.json_response({"ok": False, "error": "源路径无效或不在扫描目录内"}, status=403)
    if not dst_dir or not dst_dir.is_dir():
        return web.json_response({"ok": False, "error": "目标必须是有效目录且在扫描目录内"}, status=403)

    # 禁止把目录移到自己或自己的子目录下
    try:
        if src.is_dir() and str(dst_dir).startswith(str(src)):
            return web.json_response({
                "ok": False, "error": "不能把目录移动到自己或其子目录"
            }, status=400)
    except Exception:
        pass

    target = dst_dir / src.name

    # 源和目标相同（同目录内拖拽）
    if target.resolve() == src.resolve():
        return web.json_response({
            "ok": False, "error": "目标位置与源相同，未移动"
        }, status=400)

    # 冲突检测
    if target.exists():
        return web.json_response({
            "ok": False,
            "error": "conflict",
            "conflict_path": str(target),
            "message": f"目标已存在同名 {'目录' if target.is_dir() else '文件'}：{target.name}"
        }, status=409)

    # 执行移动
    moved_snapshots = 0
    src_is_file = src.is_file()
    try:
        if src_is_file:
            shutil.move(str(src), str(target))
            moved_snapshots = _move_matching_snapshots(src, target)
        else:  # dir
            shutil.move(str(src), str(target))
    except Exception as e:
        _log(f"❌ 移动失败: {src} → {target}: {e}")
        return web.json_response({"ok": False, "error": f"移动失败: {e}"}, status=500)

    _tree_cache["data"] = None; _sig_cache["data"] = None  # 清树缓存
    _log(f"📦 {'文件' if src_is_file else '目录'}移动: {src} → {target}（快照 {moved_snapshots} 个）")

    return web.json_response({
        "ok": True,
        "src": str(src),
        "dst": str(target),
        "new_abs_path": str(target),
        "is_dir": not src_is_file,
        "moved_snapshots": moved_snapshots,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 收藏 API（v1.6）
# ─────────────────────────────────────────────────────────────────────────────
async def handle_favorites_get(request):
    """GET /api/favorites - 返回收藏列表"""
    return web.json_response({"ok": True, "items": load_favorites().get("items", [])})


async def handle_favorites_post(request):
    """POST /api/favorites {action, path, type} - 添加/移除收藏

    action: "add" | "remove"
    path: 目标路径（绝对）
    type: "file" | "dir"（add 时必填，由前端传入）
    """
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    action = data.get("action")
    raw_path = data.get("path")

    if action not in ("add", "remove") or not raw_path:
        return web.json_response({"ok": False, "error": "参数错误"}, status=400)

    fav = load_favorites()
    items = fav.get("items", [])

    if action == "add":
        safe = _resolve_safe(raw_path, cfg.get("scan_roots", []))
        if not safe or not safe.exists():
            return web.json_response({
                "ok": False,
                "error": "路径无效或不在扫描目录白名单内"
            }, status=403)
        # 类型按实际文件系统状态修正
        actual_type = "dir" if safe.is_dir() else "file"
        resolved_path = str(safe)
        # 去重
        items = [i for i in items if i.get("path") != resolved_path]
        items.append({
            "path": resolved_path,
            "type": actual_type,
            "added_at": datetime.now().isoformat(timespec="seconds"),
        })
        _log(f"⭐ 添加收藏: {resolved_path}")
    else:  # remove
        # remove 不强制校验 scan_roots（允许移除失效项）
        try:
            target = str(Path(raw_path).expanduser().resolve())
        except Exception:
            target = raw_path
        items = [i for i in items if i.get("path") not in (raw_path, target)]
        _log(f"☆ 移除收藏: {raw_path}")

    fav["items"] = items
    save_favorites(fav)
    return web.json_response({"ok": True, "items": items})


async def handle_reveal(request):
    """POST /api/reveal {path} - 在系统文件管理器中打开并高亮该文件/目录"""
    cfg = request.app["config"]
    try:
        data = await request.json()
    except Exception as e:
        return web.json_response({"ok": False, "error": f"JSON 解析失败: {e}"}, status=400)

    raw = (data.get("path") or "").strip()
    if not raw:
        return web.json_response({"ok": False, "error": "path 必填"}, status=400)

    safe = _resolve_safe(raw, cfg.get("scan_roots", []))
    if not safe or not safe.exists():
        return web.json_response({"ok": False, "error": "非法或不存在的路径"}, status=403)

    target = str(safe)
    system = platform.system()

    try:
        if system == "Darwin":  # macOS
            subprocess.run(["open", "-R", target], check=False, timeout=5)
        elif system == "Windows":
            # v1.18.3: explorer /select, 路径含空格时需要用两个参数
            # 但 explorer.exe 不走 subprocess 的参数分割，必须用 /select,<path> 一体
            # 用 shell=True + 引号包裹路径来处理空格
            subprocess.run(f'explorer /select,"{target}"', shell=True, check=False, timeout=5)
        else:  # Linux / 其它
            # 无 reveal 能力，退化为打开父目录
            parent = str(safe.parent) if safe.is_file() else target
            subprocess.run(["xdg-open", parent], check=False, timeout=5)
        _log(f"📂 reveal: {target}")
        return web.json_response({"ok": True, "platform": system, "path": target})
    except Exception as e:
        _log(f"❌ reveal 失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# CHANGELOG 页面（v1.7.3: 单一数据源架构——壳子 + MD 动态渲染）
# ─────────────────────────────────────────────────────────────────────────────
async def handle_changelog(request):
    """GET /changelog - 返回 changelog-shell.html（前端 fetch MD 异步渲染）"""
    shell = os.path.join(WEB_DIR, "changelog-shell.html")
    if not os.path.exists(shell):
        return web.Response(
            text="<h1>changelog-shell.html 未生成</h1>", content_type="text/html"
        )
    return _serve_file_nocache(shell, "text/html")


async def handle_changelog_raw(request):
    """GET /api/changelog-raw - 返回 CHANGELOG.md 原文（text/plain），供前端 marked 渲染"""
    md_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CHANGELOG.md")
    if not os.path.exists(md_path):
        return web.Response(text="# Changelog\n\n（尚未生成）\n", content_type="text/plain", charset="utf-8")
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            md = f.read()
    except Exception as e:
        return web.Response(text=f"# 读取失败\n\n{e}\n", content_type="text/plain", charset="utf-8", status=500)
    resp = web.Response(text=md, content_type="text/plain", charset="utf-8")
    _no_cache(resp)
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# App 构建
# ─────────────────────────────────────────────────────────────────────────────
def cleanup_old_snapshots(cfg: dict, return_stats: bool = False):
    """启动时清理 N 天前的 _auto-save/ 快照。
    v1.10.6: return_stats=True 时额外返回 {scanned_dirs, removed, retention_days}
    """
    retention_days = int(cfg.get("snapshot_retention_days", 7))
    cutoff = time.time() - retention_days * 86400
    removed = 0
    scanned_dirs = 0

    for root in _enabled_root_paths(cfg):
        root_p = Path(root).expanduser().resolve()
        if not root_p.exists():
            continue
        for auto_dir in root_p.rglob("_auto-save"):
            if not auto_dir.is_dir():
                continue
            scanned_dirs += 1
            for f in auto_dir.iterdir():
                try:
                    if f.is_file() and f.stat().st_mtime < cutoff:
                        f.unlink()
                        removed += 1
                except OSError:
                    pass

    if removed and not return_stats:
        _log(f"🧹 启动清理：移除 {removed} 个过期快照（>{retention_days} 天）")

    if return_stats:
        return {
            "scanned_dirs": scanned_dirs,
            "removed": removed,
            "retention_days": retention_days,
        }


async def handle_cleanup_snapshots(request):
    """v1.10.6: POST /api/cleanup-snapshots — 手动触发过期快照清理（按当前 retention_days）"""
    cfg = request.app["config"]
    try:
        stats = cleanup_old_snapshots(cfg, return_stats=True)
        _log(f"🧹 手动清理：扫描 {stats['scanned_dirs']} 个 _auto-save 目录，移除 {stats['removed']} 个 >{stats['retention_days']} 天的快照")
        return web.json_response({"ok": True, **stats})
    except Exception as e:
        _log(f"❌ 手动清理失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# v1.11.6: 快照梯度稀释——避免时间线爆炸
def sparsify_snapshots(cfg: dict, return_stats: bool = False):
    """
    按时间梯度稀释自动快照：
      - 最近 10 分钟：保留全部
      - 10-60 分钟：每 1 分钟保留 1 条（最早一条）
      - 1-24 小时：每 1 小时保留 1 条
      - >24 小时：每 1 天保留 1 条
    pre-overwrite 和 pre-restore 备份**不参与稀释**（它们是用户主动操作前的安全副本，必须保留）

    返回 {scanned_dirs, before, removed, kept}
    """
    now = time.time()
    LEVELS = [
        # (起始秒, 结束秒, 桶宽度秒) ; None 表示无穷
        (0,           600,        None),    # < 10min: 全保
        (600,         3600,       60),      # 10-60min: 每分钟
        (3600,        86400,      3600),    # 1-24h: 每小时
        (86400,       None,       86400),   # >24h: 每天
    ]

    scanned_dirs = 0
    total_before = 0
    total_removed = 0

    for root in _enabled_root_paths(cfg):
        root_p = Path(root).expanduser().resolve()
        if not root_p.exists():
            continue
        for auto_dir in root_p.rglob("_auto-save"):
            if not auto_dir.is_dir():
                continue
            scanned_dirs += 1
            # 按源文件 stem 分组（不同源文件的快照独立稀释）
            groups = {}
            for f in auto_dir.iterdir():
                if not f.is_file():
                    continue
                # 跳过 pre-overwrite 和 pre-restore 备份
                if "-pre-overwrite-" in f.name or "-pre-restore-" in f.name:
                    continue
                # 提取 stem（"foo-20260513-101010.html" → "foo"）
                m = re.match(r"^(.+)-\d{8}-\d{6}", f.name)
                if not m:
                    continue
                stem = m.group(1)
                groups.setdefault(stem, []).append(f)

            for stem, files in groups.items():
                files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
                total_before += len(files)
                kept = []
                for f in files:
                    age = now - f.stat().st_mtime
                    # 找到该 age 落在哪个 level
                    bucket_w = None
                    for (start, end, bw) in LEVELS:
                        if age >= start and (end is None or age < end):
                            bucket_w = bw
                            break
                    if bucket_w is None:
                        # 全保层
                        kept.append(f)
                        continue
                    # 计算桶 id：以 mtime 为基础 floor
                    bucket_id = int(f.stat().st_mtime // bucket_w)
                    # 该桶已经有保留项？
                    if any(k for k in kept if int(k.stat().st_mtime // bucket_w) == bucket_id):
                        # 同桶已有更新的快照，删除当前
                        try:
                            f.unlink()
                            total_removed += 1
                        except OSError:
                            pass
                    else:
                        kept.append(f)

    if return_stats:
        return {
            "scanned_dirs": scanned_dirs,
            "before": total_before,
            "removed": total_removed,
            "kept": total_before - total_removed,
        }


async def handle_sparsify_snapshots(request):
    """v1.11.6: POST /api/sparsify-snapshots — 按时间梯度稀释自动快照"""
    cfg = request.app["config"]
    try:
        stats = sparsify_snapshots(cfg, return_stats=True)
        _log(f"🪶 快照稀释：扫描 {stats['scanned_dirs']} 目录，移除 {stats['removed']}/{stats['before']} 条，保留 {stats['kept']} 条")
        return web.json_response({"ok": True, **stats})
    except Exception as e:
        _log(f"❌ 快照稀释失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# v2.0: 导出自包含 HTML 到 Downloads 文件夹
async def handle_export_share(request):
    """接收 HTML 内容，保存到 ~/Downloads/，返回完整路径"""
    try:
        data = await request.json()
        html = data.get("html", "")
        orig_name = data.get("name", "document")
        safe_name = re.sub(r'[^\w\u4e00-\u9fff\-]', '_', orig_name)[:50]
        ts = datetime.now().strftime("%Y-%m-%d")
        filename = f"{safe_name}-share-{ts}.html"
        # Windows OneDrive 用户的 Downloads 可能在 OneDrive\Downloads
        candidates = [
            Path.home() / "Downloads",
            Path.home() / "OneDrive" / "Downloads",
            Path.home() / "下载",
        ]
        downloads = None
        for c in candidates:
            if c.exists() and c.is_dir():
                downloads = c
                break
        if not downloads:
            downloads = Path.home()
        filepath = downloads / filename
        counter = 1
        while filepath.exists():
            filepath = downloads / f"{safe_name}-share-{ts}-{counter}.html"
            counter += 1
        filepath.write_text(html, encoding="utf-8")
        _log(f"📦 分享文件已导出: {filepath}")
        return web.json_response({
            "ok": True,
            "path": str(filepath),
            "filename": filepath.name
        })
    except Exception as e:
        _log(f"❌ 导出分享文件失败: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


import hashlib

# v2.1: 密码保护 — 认证中间件 + 密码输入页
def _auth_token(password):
    """生成认证 token（密码 + salt 的 sha256）"""
    return hashlib.sha256(f"{password}{_AUTH_SALT}".encode()).hexdigest()

def _auth_page(error=""):
    """返回密码输入 HTML 页"""
    err_html = f'<p style="color:#f87171;margin:8px 0;">❌ {error}</p>' if error else ''
    return web.Response(text=f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>HTML Studio</title></head>
<body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f1419;font-family:-apple-system,'PingFang SC',sans-serif;">
<div style="background:#1a2028;padding:36px 40px;border-radius:12px;border:1px solid #2d3845;min-width:300px;">
<h2 style="color:#e8eef5;margin:0 0 4px;">🎨 HTML Studio</h2>
<p style="color:#6b7a8c;font-size:13px;margin:0 0 20px;">请输入密码</p>
{err_html}
<form method="POST" action="/api/auth">
<input type="password" name="password" autofocus placeholder="密码"
  style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #2d3845;background:#0f1419;color:#e8eef5;font-size:14px;margin-bottom:12px;box-sizing:border-box;">
<button type="submit" style="width:100%;padding:10px;border-radius:6px;border:none;background:#4a9eff;color:#fff;font-size:14px;cursor:pointer;">进入</button>
</form>
</div></body></html>''', content_type="text/html")

@web.middleware
async def auth_middleware(request, handler):
    cfg = request.app["config"]
    password = cfg.get("access_password", "")
    if not password:
        return await handler(request)  # 没设密码，跳过
    # 认证 API 不拦截
    if request.path == "/api/auth":
        return await handler(request)
    # 检查 cookie
    token = request.cookies.get("htmlstudio_auth", "")
    if token == _auth_token(password):
        return await handler(request)
    # 未认证
    if request.path.startswith("/api/"):
        return web.json_response({"ok": False, "error": "未认证", "auth_required": True}, status=401)
    return _auth_page()

async def handle_auth(request):
    """POST /api/auth — 验证密码，设置 cookie"""
    cfg = request.app["config"]
    password = cfg.get("access_password", "")
    data = await request.post()
    input_pwd = data.get("password", "")
    if input_pwd and input_pwd == password:
        resp = web.HTTPFound("/")
        resp.set_cookie("htmlstudio_auth", _auth_token(password), httponly=True, max_age=30*24*3600, path="/")
        return resp
    return _auth_page(error="密码错误")


def create_app() -> web.Application:
    app = web.Application(client_max_size=100 * 1024 * 1024, middlewares=[auth_middleware])
    app["config"] = load_config()
    # v1.19: 启动时清理 _dropbox/ 旧文件（7 天前）
    cleanup_dropbox()

    app.router.add_get("/", handle_index)
    app.router.add_get("/static/{fname:.+}", handle_static)
    app.router.add_get("/saver-runtime.js", handle_saver_js)

    app.router.add_get("/api/tree", handle_tree)
    app.router.add_get("/api/tree-sig", handle_tree_sig)  # v1.10.1: 轻量签名
    app.router.add_get("/api/browse", handle_browse)
    app.router.add_get("/api/config", handle_config_get)
    app.router.add_post("/api/config", handle_config_post)
    app.router.add_get("/api/file", handle_file)
    app.router.add_post("/api/snapshot", handle_snapshot)
    app.router.add_post("/api/save", handle_save)
    # v1.10.2: 版本时间线
    app.router.add_get("/api/history", handle_history)
    app.router.add_get("/api/history/content", handle_history_content)
    app.router.add_get("/api/history/diff", handle_history_diff)  # v1.10.3
    app.router.add_post("/api/restore", handle_restore)
    # v1.2 新增
    app.router.add_get("/api/last_session", handle_last_session_get)
    app.router.add_post("/api/last_session", handle_last_session_post)
    app.router.add_post("/api/reveal", handle_reveal)
    app.router.add_get("/changelog", handle_changelog)
    app.router.add_get("/api/changelog-raw", handle_changelog_raw)  # v1.7.3
    # v1.19: 拖入副本 + 另存为
    app.router.add_post("/api/drag-upload", handle_drag_upload)
    app.router.add_post("/api/save-as", handle_save_as)
    # v1.20.0: Native picker (macOS NSOpenPanel / Windows FolderBrowser / Linux zenity)
    app.router.add_post("/api/native-pick-dir", handle_native_pick_dir)
    app.router.add_post("/api/native-pick-file", handle_native_pick_file)
    # v1.6 新增：收藏
    app.router.add_get("/api/favorites", handle_favorites_get)
    app.router.add_post("/api/favorites", handle_favorites_post)
    # v1.7 新增：文件/目录移动
    app.router.add_post("/api/move", handle_move)
    # v1.10.6: 手动清理过期快照
    app.router.add_post("/api/cleanup-snapshots", handle_cleanup_snapshots)
    app.router.add_post("/api/sparsify-snapshots", handle_sparsify_snapshots)  # v1.11.6
    # v1.15: 静态资源代理（HTML 引用的本地图片/CSS/JS/字体）
    app.router.add_get("/api/asset/{encoded_dir}/{path:.*}", handle_asset)
    # v2.0: 导出分享文件到 Downloads
    app.router.add_post("/api/export-share", handle_export_share)
    # v2.1: 密码认证
    app.router.add_post("/api/auth", handle_auth)

    return app


def main():
    import argparse
    is_frozen = getattr(sys, 'frozen', False)
    parser = argparse.ArgumentParser(description="HTML Studio — Local HTML workbench")
    parser.add_argument("--open-browser", action=argparse.BooleanOptionalAction,
                        default=is_frozen,
                        help="Automatically open browser after server starts (default: True in packaged mode, use --no-open-browser to disable)")
    parser.add_argument("--port", type=int, default=None,
                        help="Port to listen on (overrides config, default: 9901)")
    args = parser.parse_args()

    app = create_app()
    cfg = app["config"]
    cleanup_old_snapshots(cfg)
    cleanup_dead_favorites(cfg)  # v1.6: 启动时清理失效收藏
    port = args.port if args.port else int(cfg.get("port", 9901))

    # 端口冲突自动重试（最多尝试 10 个端口）
    import socket
    original_port = port
    for attempt in range(10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                break
            except OSError:
                if attempt == 0:
                    _log(f"⚠️ 端口 {original_port} 被占用，尝试寻找可用端口…")
                port += 1
    else:
        _log(f"❌ 端口 {original_port}-{original_port+9} 全部被占用，请用 --port 指定其他端口")
        sys.exit(1)
    if port != original_port:
        _log(f"✅ 改用端口 {port}")

    _log("=" * 60)
    _log("🚀 HTML Studio 启动")
    _log(f"📂 扫描目录: {cfg.get('scan_roots')}")
    _log(f"🌐 访问: http://127.0.0.1:{port}")
    _log("=" * 60)

    if args.open_browser:
        import threading, webbrowser
        def _open_browser():
            time.sleep(1.5)
            webbrowser.open(f"http://127.0.0.1:{port}")
        threading.Thread(target=_open_browser, daemon=True).start()

    # v2.0: Windows 兼容 — 检测 IPv6 可用性，不可用则只绑 IPv4
    # 根因：Windows 上 localhost 常解析为 ::1 (IPv6)，如果 ::1 绑定失败
    # 服务启动失败或 fetch 请求 "加载失败"
    # 修复：(1) 检测 ::1 可用性 (2) 浏览器用 127.0.0.1 打开（不走 localhost 解析）
    bind_hosts = ["127.0.0.1"]
    try:
        import socket
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.bind(("::1", 0))
        bind_hosts.append("::1")
    except OSError:
        _log("⚠️ IPv6 (::1) 不可用，仅绑定 IPv4 (127.0.0.1)")
    web.run_app(app, host=bind_hosts, port=port, print=None)


if __name__ == "__main__":
    main()

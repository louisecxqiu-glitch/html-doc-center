"""
HTML Studio Share Server — 轻量分享服务
==========================================
接收 HTML 内容 → 存储 → 生成短链 → 公网只读访问
可选密码保护，7 天自动过期

部署: python3 share_server.py (默认 8080 端口)
依赖: aiohttp
"""
import os
import json
import secrets
import hashlib
import time
from pathlib import Path
from aiohttp import web

# 存储
DATA_DIR = Path(os.environ.get("SHARE_DATA_DIR", "./share_data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
EXPIRE_DAYS = 7
MAX_CONTENT_SIZE = 50 * 1024 * 1024  # 50MB 上限

# CORS — 允许 HTML Studio 本地服务上传
CORS_ORIGIN = "*"


@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        resp = web.Response()
    else:
        resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


async def handle_share(request):
    """POST /api/share — 接收 HTML，返回短链"""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    html = data.get("html", "")
    password = data.get("password", "")

    if not html or len(html) > MAX_CONTENT_SIZE:
        return web.json_response({"ok": False, "error": "内容为空或超过 50MB 限制"}, status=400)

    # 生成 6 位短码
    share_id = secrets.token_urlsafe(4)[:6].replace("-", "x").replace("_", "y")
    while (DATA_DIR / f"{share_id}.html").exists():
        share_id = secrets.token_urlsafe(4)[:6].replace("-", "x").replace("_", "y")

    # 存储 HTML
    (DATA_DIR / f"{share_id}.html").write_text(html, encoding="utf-8")

    # 存储 meta
    meta = {
        "created_at": time.time(),
        "expires_at": time.time() + EXPIRE_DAYS * 86400,
        "password_hash": hashlib.sha256(password.encode()).hexdigest() if password else "",
        "size": len(html),
    }
    (DATA_DIR / f"{share_id}.meta.json").write_text(json.dumps(meta), encoding="utf-8")

    base_url = f"http://{request.host}"
    share_url = f"{base_url}/{share_id}"
    print(f"📤 分享已创建: {share_id} ({len(html)} bytes){' [加密]' if password else ''}")

    return web.json_response({
        "ok": True,
        "id": share_id,
        "url": share_url,
        "expires_in": f"{EXPIRE_DAYS} 天",
    })


async def handle_view(request):
    """GET /{id} — 返回 HTML（有密码先显示密码页）"""
    share_id = request.match_info["id"]
    html_file = DATA_DIR / f"{share_id}.html"
    meta_file = DATA_DIR / f"{share_id}.meta.json"

    if not html_file.exists():
        return web.Response(
            text='<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#6b7a8c;background:#0f1419;"><div><h2 style="color:#e8eef5;">404</h2><p>内容不存在或已过期</p></div></div>',
            content_type="text/html", status=404
        )

    # 检查过期
    try:
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
    except Exception:
        meta = {}
    if time.time() > meta.get("expires_at", 0):
        html_file.unlink(missing_ok=True)
        meta_file.unlink(missing_ok=True)
        return web.Response(
            text='<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#6b7a8c;background:#0f1419;"><div><h2 style="color:#e8eef5;">⏰ 已过期</h2><p>分享内容已超过 7 天有效期</p></div></div>',
            content_type="text/html", status=410
        )

    html = html_file.read_text(encoding="utf-8")
    pwd_hash = meta.get("password_hash", "")

    # 无密码 → 直接返回
    if not pwd_hash:
        return web.Response(text=html, content_type="text/html")

    # 有密码 → 检查 cookie
    cookie_token = request.cookies.get("share_auth_" + share_id, "")
    if cookie_token == pwd_hash:
        return web.Response(text=html, content_type="text/html")

    # 显示密码页
    return web.Response(text=f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>受保护内容</title></head>
<body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f1419;font-family:-apple-system,'PingFang SC',sans-serif;">
<div style="background:#1a2028;padding:36px 40px;border-radius:12px;border:1px solid #2d3845;min-width:320px;text-align:center;">
<h2 style="color:#e8eef5;margin:0 0 4px;">🔒 受保护内容</h2>
<p style="color:#6b7a8c;font-size:13px;margin:0 0 20px;">请输入密码查看</p>
<form method="POST" action="/{share_id}/auth">
<input type="password" name="password" autofocus placeholder="密码" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #2d3845;background:#0f1419;color:#e8eef5;font-size:14px;margin-bottom:12px;box-sizing:border-box;">
<button type="submit" style="width:100%;padding:10px;border-radius:6px;border:none;background:#4a9eff;color:#fff;font-size:14px;cursor:pointer;">进入</button>
</form>
</div></body></html>''', content_type="text/html")


async def handle_auth(request):
    """POST /{id}/auth — 验证密码，设 cookie"""
    share_id = request.match_info["id"]
    meta_file = DATA_DIR / f"{share_id}.meta.json"
    if not meta_file.exists():
        return web.Response(text="内容不存在", status=404)

    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    data = await request.post()
    password = data.get("password", "")
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()

    if pwd_hash == meta.get("password_hash", ""):
        resp = web.HTTPFound(f"/{share_id}")
        resp.set_cookie("share_auth_" + share_id, pwd_hash, httponly=True, max_age=86400, path="/")
        return resp

    # 密码错误 — 返回密码页带错误提示
    return web.Response(text=f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>受保护内容</title></head>
<body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f1419;font-family:-apple-system,'PingFang SC',sans-serif;">
<div style="background:#1a2028;padding:36px 40px;border-radius:12px;border:1px solid #2d3845;min-width:320px;text-align:center;">
<h2 style="color:#e8eef5;margin:0 0 4px;">🔒 受保护内容</h2>
<p style="color:#f87171;font-size:13px;margin:0 0 20px;">❌ 密码错误，请重试</p>
<form method="POST" action="/{share_id}/auth">
<input type="password" name="password" autofocus placeholder="密码" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #2d3845;background:#0f1419;color:#e8eef5;font-size:14px;margin-bottom:12px;box-sizing:border-box;">
<button type="submit" style="width:100%;padding:10px;border-radius:6px;border:none;background:#4a9eff;color:#fff;font-size:14px;cursor:pointer;">进入</button>
</form>
</div></body></html>''', content_type="text/html")


async def handle_health(request):
    """GET /api/health — 健康检查"""
    count = len(list(DATA_DIR.glob("*.html")))
    return web.json_response({"ok": True, "shares": count, "data_dir": str(DATA_DIR)})


def cleanup_expired():
    """清理过期文件"""
    now = time.time()
    cleaned = 0
    for meta_file in DATA_DIR.glob("*.meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            if now > meta.get("expires_at", 0):
                share_id = meta_file.stem
                (DATA_DIR / f"{share_id}.html").unlink(missing_ok=True)
                meta_file.unlink(missing_ok=True)
                cleaned += 1
        except Exception:
            pass
    if cleaned:
        print(f"🧹 清理了 {cleaned} 个过期分享")


def create_app():
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_post("/api/share", handle_share)
    app.router.add_get("/api/health", handle_health)
    app.router.add_get("/{id}", handle_view)
    app.router.add_post("/{id}/auth", handle_auth)
    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"📤 HTML Studio Share Server")
    print(f"   数据目录: {DATA_DIR}")
    print(f"   端口: {port}")
    print(f"   过期: {EXPIRE_DAYS} 天")
    print(f"   访问: http://0.0.0.0:{port}")
    cleanup_expired()
    web.run_app(create_app(), host="0.0.0.0", port=port, print=None)

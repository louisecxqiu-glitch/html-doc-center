"""Tests for POST /api/drag-upload endpoint."""
from pathlib import Path

import pytest
from aiohttp import FormData


async def test_drag_upload_html(client, tmp_workspace):
    """POST 一个 HTML 文件 → 写到 _dropbox/ → 返回 abs_path/name/type。"""
    form = FormData()
    form.add_field("file", b"<html><body>hello</body></html>", filename="test.html", content_type="text/html")
    form.add_field("filename", "test.html")
    resp = await client.post("/api/drag-upload", data=form)
    assert resp.status == 200, f"expected 200, got {resp.status}: {await resp.text()}"
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
    big_content = b"x" * (10 * 1024 * 1024 + 1)
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
    form1 = FormData()
    form1.add_field("file", b"<html>first</html>", filename="dup.html", content_type="text/html")
    form1.add_field("filename", "dup.html")
    resp1 = await client.post("/api/drag-upload", data=form1)
    assert resp1.status == 200
    data1 = await resp1.json()
    assert data1["name"] == "dup.html"

    form2 = FormData()
    form2.add_field("file", b"<html>second</html>", filename="dup.html", content_type="text/html")
    form2.add_field("filename", "dup.html")
    resp2 = await client.post("/api/drag-upload", data=form2)
    assert resp2.status == 200
    data2 = await resp2.json()
    assert data2["name"] != "dup.html", "同名应加 timestamp 后缀"
    assert data2["name"].startswith("dup-") and data2["name"].endswith(".html")
    assert Path(data1["abs_path"]).exists()
    assert Path(data2["abs_path"]).exists()
    assert Path(data1["abs_path"]).read_text(encoding="utf-8") == "<html>first</html>"
    assert Path(data2["abs_path"]).read_text(encoding="utf-8") == "<html>second</html>"

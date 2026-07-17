"""Tests for /api/browse?mode=file extension."""
from pathlib import Path

import pytest


async def test_browse_with_files_returns_files_list(client, sample_dir):
    """/api/browse?path=<dir>&mode=file 应该返回 files 列表，含 name/path/size/mtime/type。"""
    resp = await client.get(f"/api/browse?path={sample_dir}&mode=file")
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
    assert data["is_root"] is False
    assert "files" in data, "mode=file 时必须返回 files 字段"
    file_names = [f["name"] for f in data["files"]]
    assert "report.html" in file_names
    assert "notes.md" in file_names
    assert "image.png" not in file_names
    assert "data.json" not in file_names
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

"""Tests for POST /api/save-as endpoint."""
import os
import time
from pathlib import Path


async def test_save_as_copy_success(client, tmp_workspace):
    """源文件存在 → 复制到目标 → 返回 ok + dest_path。"""
    src = tmp_workspace / "src.html"
    src.write_text("<html>original</html>", encoding="utf-8")
    dest = tmp_workspace / "dest.html"
    resp = await client.post("/api/save-as", json={"src_path": str(src), "dest_path": str(dest)})
    assert resp.status == 200, f"expected 200, got {resp.status}: {await resp.text()}"
    data = await resp.json()
    assert data["ok"] is True
    assert data["dest_path"] == str(dest)
    assert dest.exists()
    assert dest.read_text(encoding="utf-8") == "<html>original</html>"
    assert src.exists(), "源文件应保留"


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


async def test_save_as_overwrite(client, tmp_workspace):
    """overwrite=true → 覆盖目标。"""
    src = tmp_workspace / "src.html"
    src.write_text("<html>new</html>", encoding="utf-8")
    dest = tmp_workspace / "dest.html"
    dest.write_text("<html>old</html>", encoding="utf-8")
    resp = await client.post("/api/save-as", json={
        "src_path": str(src), "dest_path": str(dest), "overwrite": True
    })
    assert resp.status == 200
    assert dest.read_text(encoding="utf-8") == "<html>new</html>"


async def test_save_as_preserves_mtime(client, tmp_workspace):
    """复制保留 mtime（shutil.copy2）。"""
    src = tmp_workspace / "src.html"
    src.write_text("<html>x</html>", encoding="utf-8")
    old_mtime = 1000000000  # 2001-09-09
    os.utime(src, (old_mtime, old_mtime))
    dest = tmp_workspace / "dest.html"
    await client.post("/api/save-as", json={"src_path": str(src), "dest_path": str(dest)})
    assert dest.stat().st_mtime == old_mtime

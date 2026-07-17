"""Pytest fixtures for DocCenter server tests."""
import asyncio
import json
import sys
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
    (d / "report.html").write_text("<html><body>report</body></html>", encoding="utf-8")
    (d / "notes.md").write_text("# Notes\n\nhello", encoding="utf-8")
    (d / "image.png").write_bytes(b"\x89PNG\r\n\x1a\n fake png")
    (d / "data.json").write_text('{"k":"v"}', encoding="utf-8")
    (d / "subdir").mkdir()
    return d


@pytest.fixture
async def client(tmp_workspace, monkeypatch):
    """启动一个测试用 server，工作目录指向 tmp_workspace。"""
    import server
    from aiohttp.test_utils import TestClient, TestServer

    monkeypatch.chdir(tmp_workspace)
    # mock config 路径，避免污染真实 ~/.codebuddy/html-doc-center/config.json
    cfg_dir = tmp_workspace / "cfg"
    cfg_dir.mkdir()
    monkeypatch.setattr(server, "CONFIG_DIR", str(cfg_dir))
    monkeypatch.setattr(server, "CONFIG_FILE", str(cfg_dir / "config.json"))
    (cfg_dir / "config.json").write_text(
        json.dumps({"scan_roots": [], "tree_auto_refresh_seconds": 0}),
        encoding="utf-8",
    )
    app = server.create_app()
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    try:
        yield test_client
    finally:
        await test_client.close()

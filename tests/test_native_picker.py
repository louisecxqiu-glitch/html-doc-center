"""Tests for /api/native-pick-dir + /api/native-pick-file endpoints.

Note: These tests verify the API plumbing, NOT the actual native dialogs
(macOS NSOpenPanel / Windows FolderBrowser) — those would block the test
waiting for user input. We test that the endpoint exists, accepts POST,
and returns expected error shape when osascript/powershell are missing.
"""
import json
import platform

import pytest


@pytest.fixture
async def client(tmp_workspace, monkeypatch):
    import server
    from aiohttp.test_utils import TestClient, TestServer

    monkeypatch.chdir(tmp_workspace)
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


async def test_native_pick_dir_endpoint_exists(client, monkeypatch):
    """POST /api/native-pick-dir should respond (200 or 500, not 404).
    Mock the OS-level picker so it returns a path immediately without
    opening a real dialog (which would block in tests).
    """
    import server
    # Mock osascript to return a fake path (simulate user picking ~/Documents)
    def fake_pick(start_dir=None):
        return "/Users/test/Documents"
    monkeypatch.setattr(server, "_native_pick_dir_macos", fake_pick)
    if platform.system() == "Windows":
        monkeypatch.setattr(server, "_native_pick_dir_windows", fake_pick)
    else:
        monkeypatch.setattr(server, "_native_pick_dir_windows", lambda start_dir=None: None)
    monkeypatch.setattr(server, "_native_pick_linux", lambda start_dir=None, file_mode=False: None)

    resp = await client.post("/api/native-pick-dir", json={})
    assert resp.status != 404, "endpoint should exist"
    data = await resp.json()
    assert "ok" in data
    # When macOS picker mocked, should return path
    if platform.system() == "Darwin":
        assert data["ok"] is True
        assert data["path"] == "/Users/test/Documents"


async def test_native_pick_file_endpoint_exists(client, monkeypatch):
    """POST /api/native-pick-file should respond (200 or 500, not 404)."""
    import server
    def fake_pick_file(start_dir=None, file_types=None):
        return "/Users/test/Documents/report.html"
    monkeypatch.setattr(server, "_native_pick_file_macos", fake_pick_file)
    monkeypatch.setattr(server, "_native_pick_file_windows", lambda start_dir=None, file_types=None: None)
    monkeypatch.setattr(server, "_native_pick_linux", lambda start_dir=None, file_mode=True, file_types=None: None)

    resp = await client.post("/api/native-pick-file", json={"file_types": ["html", "md"]})
    assert resp.status != 404
    data = await resp.json()
    if platform.system() == "Darwin":
        assert data["ok"] is True
        assert data["path"] == "/Users/test/Documents/report.html"


async def test_native_pick_cancelled_returns_cancelled_flag(client, monkeypatch):
    """If user cancels the dialog, return ok=true with cancelled=true."""
    import server
    monkeypatch.setattr(server, "_native_pick_dir_macos", lambda start_dir=None: None)
    monkeypatch.setattr(server, "_native_pick_dir_windows", lambda start_dir=None: None)
    monkeypatch.setattr(server, "_native_pick_linux", lambda start_dir=None, file_mode=False: None)

    resp = await client.post("/api/native-pick-dir", json={})
    data = await resp.json()
    assert data["ok"] is True
    assert data.get("cancelled") is True
    assert "path" not in data


async def test_native_pick_dir_accepts_start_dir(client, monkeypatch):
    """start_dir parameter should be passed through (no 500)."""
    import server
    captured = {}
    def fake_pick(start_dir=None):
        captured["start_dir"] = start_dir
        return "/test"
    monkeypatch.setattr(server, "_native_pick_dir_macos", fake_pick)
    monkeypatch.setattr(server, "_native_pick_dir_windows", lambda start_dir=None: None)
    monkeypatch.setattr(server, "_native_pick_linux", lambda start_dir=None, file_mode=False: None)

    resp = await client.post("/api/native-pick-dir", json={"start_dir": "/Users/louiscxqiu/CodeBuddy"})
    assert resp.status == 200
    assert captured.get("start_dir") == "/Users/louiscxqiu/CodeBuddy"


async def test_native_pick_file_accepts_types(client, monkeypatch):
    """file_types array should be passed through."""
    import server
    captured = {}
    def fake_pick_file(start_dir=None, file_types=None):
        captured["file_types"] = file_types
        return "/test.html"
    monkeypatch.setattr(server, "_native_pick_file_macos", fake_pick_file)
    monkeypatch.setattr(server, "_native_pick_file_windows", lambda start_dir=None, file_types=None: None)
    monkeypatch.setattr(server, "_native_pick_linux", lambda start_dir=None, file_mode=True, file_types=None: None)

    resp = await client.post("/api/native-pick-file", json={"file_types": ["html", "md"]})
    assert resp.status == 200
    assert captured.get("file_types") == ["html", "md"]


def test_native_pick_dir_macos_helper_exists():
    """_native_pick_dir_macos helper should exist and be callable."""
    import server
    assert hasattr(server, "_native_pick_dir_macos")
    assert callable(server._native_pick_dir_macos)


def test_native_pick_file_macos_helper_exists():
    """_native_pick_file_macos helper should exist and be callable."""
    import server
    assert hasattr(server, "_native_pick_file_macos")
    assert callable(server._native_pick_file_macos)


def test_native_pick_dir_windows_helper_exists():
    """_native_pick_dir_windows helper should exist and be callable."""
    import server
    assert hasattr(server, "_native_pick_dir_windows")
    assert callable(server._native_pick_dir_windows)


def test_native_pick_linux_helper_exists():
    """_native_pick_linux helper should exist with file_mode parameter."""
    import server
    assert hasattr(server, "_native_pick_linux")
    # Should accept file_mode parameter
    import inspect
    sig = inspect.signature(server._native_pick_linux)
    assert "file_mode" in sig.parameters
    assert "file_types" in sig.parameters

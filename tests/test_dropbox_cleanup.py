"""Tests for _dropbox/ cleanup logic."""
import os
import time
from pathlib import Path


def test_dropbox_cleanup_removes_7day_old_files(tmp_workspace, monkeypatch):
    """7 天前的文件应被清理。"""
    import server
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    old_file = dropbox / "old.html"
    old_file.write_text("<html>old</html>", encoding="utf-8")
    old_mtime = time.time() - 8 * 86400
    os.utime(old_file, (old_mtime, old_mtime))
    new_file = dropbox / "new.html"
    new_file.write_text("<html>new</html>", encoding="utf-8")

    server.cleanup_dropbox()

    assert not old_file.exists(), "8 天前的文件应被删除"
    assert new_file.exists(), "1 天前的文件应保留"


def test_dropbox_cleanup_keeps_recent_files(tmp_workspace, monkeypatch):
    """7 天内的文件应保留。"""
    import server
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    recent = dropbox / "recent.html"
    recent.write_text("x", encoding="utf-8")
    mtime = time.time() - 6 * 86400
    os.utime(recent, (mtime, mtime))

    server.cleanup_dropbox()
    assert recent.exists()


def test_dropbox_cleanup_failure_nonfatal(tmp_workspace, monkeypatch):
    """清理失败不抛异常（不阻塞启动）。"""
    import server
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    if dropbox.exists():
        import shutil
        shutil.rmtree(dropbox)
    # 不应抛异常
    server.cleanup_dropbox()
    # cleanup 后应该创建了 _dropbox/
    assert dropbox.exists()


def test_dropbox_cleanup_skips_subdirs(tmp_workspace, monkeypatch):
    """_dropbox/ 下的子目录不应被删除（只清理文件）。"""
    import server
    monkeypatch.chdir(tmp_workspace)
    dropbox = tmp_workspace / "_dropbox"
    dropbox.mkdir(exist_ok=True)
    subdir = dropbox / "subdir"
    subdir.mkdir()
    old_mtime = time.time() - 30 * 86400
    os.utime(subdir, (old_mtime, old_mtime))

    server.cleanup_dropbox()
    assert subdir.exists(), "子目录不应被 cleanup 删除"


def test_frozen_dropbox_never_writes_to_app_working_directory(tmp_path, monkeypatch):
    """打包后的 App 必须把运行数据写到用户目录，不能写入可能位于 App 包内的 cwd。"""
    import server

    app_working_dir = tmp_path / "HTMLStudio.app" / "Contents" / "MacOS"
    app_working_dir.mkdir(parents=True)
    config_dir = tmp_path / "user-config"

    monkeypatch.chdir(app_working_dir)
    monkeypatch.setattr(server.sys, "frozen", True, raising=False)
    monkeypatch.setattr(server, "CONFIG_DIR", str(config_dir))

    dropbox = server.get_dropbox_dir()

    assert dropbox == Path(config_dir) / "_dropbox"
    assert not (app_working_dir / "_dropbox").exists()

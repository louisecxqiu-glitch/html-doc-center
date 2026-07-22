"""Regression coverage for restoring a document from its local history."""


async def test_restore_replaces_source_and_keeps_pre_restore_backup(client, tmp_workspace):
    client.app["config"]["scan_roots"] = [str(tmp_workspace)]
    source = tmp_workspace / "article.md"
    source.write_text("# v1", encoding="utf-8")
    snapshot_dir = tmp_workspace / "_auto-save"
    snapshot_dir.mkdir()
    snapshot = snapshot_dir / "article-20260722-120000.md"
    snapshot.write_text("# v2", encoding="utf-8")

    response = await client.post(
        "/api/restore",
        json={"snapshot_path": str(snapshot), "source_path": str(source)},
    )
    data = await response.json()

    assert response.status == 200
    assert data["ok"] is True
    assert source.read_text(encoding="utf-8") == "# v2"
    backup = snapshot_dir / data["pre_restore_backup"].split("/")[-1]
    assert backup.name.startswith("article-pre-restore-")
    assert backup.read_text(encoding="utf-8") == "# v1"

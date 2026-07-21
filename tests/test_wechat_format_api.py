"""Tests for the local Markdown-to-WeChat formatter endpoint."""


async def test_wechat_format_returns_self_contained_html(client, tmp_workspace):
    client.app["config"]["scan_roots"] = [str(tmp_workspace)]
    article = tmp_workspace / "article.md"
    source = "# 标题\n\n![图](shot.svg)"
    article.write_text(source, encoding="utf-8")
    (tmp_workspace / "shot.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding="utf-8"
    )

    response = await client.post(
        "/api/wechat/format",
        json={"path": str(article), "content": source},
    )
    data = await response.json()

    assert response.status == 200
    assert data["ok"] is True
    assert "data:image/svg+xml;base64," in data["html"]
    assert "<style>" in data["html"]
    assert data["text"] == source
    assert data["filename"] == "article-wechat.html"


async def test_wechat_format_rejects_outside_path_and_non_md(client, tmp_workspace):
    client.app["config"]["scan_roots"] = [str(tmp_workspace)]
    outside = tmp_workspace.parent / "outside.md"
    outside.write_text("# no", encoding="utf-8")

    response = await client.post(
        "/api/wechat/format",
        json={"path": str(outside), "content": "# no"},
    )
    assert response.status == 403

    html_file = tmp_workspace / "article.html"
    html_file.write_text("<h1>no</h1>", encoding="utf-8")
    response = await client.post(
        "/api/wechat/format",
        json={"path": str(html_file), "content": "# no"},
    )
    assert response.status == 400


async def test_wechat_format_rejects_malformed_payload(client, tmp_workspace):
    client.app["config"]["scan_roots"] = [str(tmp_workspace)]
    response = await client.post(
        "/api/wechat/format", json={"path": str(tmp_workspace / "article.md")}
    )
    assert response.status == 400

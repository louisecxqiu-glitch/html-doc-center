from __future__ import annotations

import base64
from pathlib import Path

import pytest

from tools.wechat_formatter import (
    convert_image_to_data_uri,
    format_file,
    render_markdown,
)


ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "YAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def test_render_markdown_has_safe_typography_and_escaped_text(tmp_path: Path):
    html = render_markdown(
        "# 标题\n\n正文 <script>alert(1)</script> **重点**\n\n> 提醒",
        tmp_path,
    )
    assert '<h1 class="wx-title">标题</h1>' in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert '<strong class="wx-strong">重点</strong>' in html
    assert '<blockquote class="wx-quote">提醒</blockquote>' in html


def test_render_markdown_escapes_link_content_once(tmp_path: Path):
    html = render_markdown(
        '[Apple & Docs](https://example.com?a=1&b=2 "A & B")',
        tmp_path,
    )
    assert '>Apple &amp; Docs</a>' in html
    assert 'href="https://example.com?a=1&amp;b=2"' in html
    assert 'title="A &amp; B"' in html
    assert '&amp;amp;' not in html


def test_render_markdown_embeds_local_image(tmp_path: Path):
    image = tmp_path / "shot.png"
    image.write_bytes(ONE_PIXEL_PNG)
    html = render_markdown("![注册页面](shot.png)", tmp_path)
    assert 'alt="注册页面"' in html
    assert "data:image/png;base64," in html
    assert "wx-figure" in html


def test_render_markdown_styles_inline_code():
    html = render_markdown("运行 `codesign --verify`。", Path("."))
    assert '<code class="wx-inline-code">codesign --verify</code>' in html


def test_convert_image_rejects_missing_or_unsupported_file(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        convert_image_to_data_uri(tmp_path / "missing.png")
    unsupported = tmp_path / "file.txt"
    unsupported.write_text("not an image", encoding="utf-8")
    with pytest.raises(ValueError, match="Unsupported image"):
        convert_image_to_data_uri(unsupported)


def test_format_file_defaults_output_and_protects_existing_file(tmp_path: Path):
    source = tmp_path / "guide.md"
    source.write_text("# Guide", encoding="utf-8")
    output = format_file(source)
    assert output == tmp_path / "guide-wechat.html"
    assert "Guide" in output.read_text(encoding="utf-8")
    with pytest.raises(FileExistsError):
        format_file(source)
    format_file(source, force=True)

# WeChat macOS DMG Guide Formatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a local Python CLI that converts a reusable Markdown tutorial and local assets into a self-contained, Apple-style HTML file that can be copied into the WeChat public-account editor.

**Architecture:** `tools/wechat_formatter.py` owns a small, explicit Markdown subset parser, safe HTML escaping, local-image data-URI embedding, and inline CSS rendering. Markdown articles remain the source of truth; the formatter never uploads content or touches the HTML Studio app. Tests exercise the renderer and CLI using temporary files and a tiny in-memory PNG fixture.

**Tech Stack:** Python 3 standard library (`argparse`, `html`, `mimetypes`, `base64`, `pathlib`, `re`), pytest for tests, Markdown source files, inline CSS, SVG illustrations stored under `articles/assets/`.

## Global Constraints

- Keep all formatter code under `tools/`; do not modify `server.py`, `web/*`, `saver-runtime.js`, or the macOS packaging flow.
- Generated HTML must be UTF-8, self-contained, and use inline styles only.
- Markdown image paths resolve relative to the source Markdown file and are embedded as `data:` URIs.
- Never put Apple passwords, private keys, Team IDs tied to a real account, or notarization submission IDs into the article source.
- The formatter must use only the Python standard library; no Node, Pandoc, network service, or external CSS.
- Existing output is protected unless the caller supplies `--force`.
- Every code change is accompanied by a CHANGELOG entry and a focused git commit.

---

### Task 1: Define the renderer and CLI contract with failing tests

**Why:** Lock down the reusable interface and safety behavior before implementation so formatting changes remain predictable.

**Files:**
- Create: `tests/test_wechat_formatter.py`
- Test: `tools/wechat_formatter.py` (imported by tests before it exists)

**Interfaces:**
- `render_markdown(source: str, source_dir: Path) -> str` returns an HTML fragment with inline styles and a self-contained image representation.
- `convert_image_to_data_uri(image_path: Path) -> str` returns a MIME-typed `data:` URI or raises `ValueError` for unsupported formats.
- `format_file(input_path: Path, output_path: Path | None = None, *, force: bool = False) -> Path` writes the generated HTML and returns its path.

- [x] **Step 1: Write the failing unit tests**

```python
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
    assert "background" in html


def test_render_markdown_embeds_local_image(tmp_path: Path):
    image = tmp_path / "shot.png"
    image.write_bytes(ONE_PIXEL_PNG)
    html = render_markdown("![注册页面](shot.png)", tmp_path)
    assert 'alt="注册页面"' in html
    assert "data:image/png;base64," in html
    assert "wx-figure" in html


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
```

- [x] **Step 2: Run the focused tests and verify the expected import failure**

Run:

```bash
python3 -m pytest tests/test_wechat_formatter.py -q
```

Expected: collection fails because `tools/wechat_formatter.py` does not yet exist.

- [x] **Step 3: Commit the test contract**

```bash
git add tests/test_wechat_formatter.py
git commit -m "test: define WeChat formatter contract"
```

### Task 2: Implement Markdown conversion, image embedding, and Apple-style HTML

**Why:** Provide the smallest complete renderer that satisfies Task 1 without adding a dependency or modifying the app.

**Files:**
- Create: `tools/__init__.py`
- Create: `tools/wechat_formatter.py`
- Test: `tests/test_wechat_formatter.py`

**Interfaces:**
- `render_markdown`, `convert_image_to_data_uri`, and `format_file` use the signatures from Task 1.
- CLI arguments are `input`, optional `--output`, `--open`, and `--force`.

- [x] **Step 1: Implement the renderer**

Implement these concrete behaviors:

```python
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

def convert_image_to_data_uri(image_path: Path) -> str:
    if not image_path.is_file():
        raise FileNotFoundError(image_path)
    suffix = image_path.suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {image_path.suffix}")
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(
        suffix, f"image/{suffix[1:]}"
    )
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"
```

The parser must escape all text with `html.escape`, support fenced code blocks without interpreting their contents, render headings as `h1`/`h2`/`h3`, paragraphs, bold/italic, links with escaped attributes, ordered/unordered lists, blockquotes, horizontal rules, pipe tables, and image figures. Image paths are resolved from `source_dir`, rendered with `wx-figure`, `wx-image`, and `wx-caption`, and embedded through `convert_image_to_data_uri`.

The document wrapper must include a viewport meta tag, system-font stack, black text, Apple blue accents, generous whitespace, rounded notice cards, horizontal-scroll code blocks, responsive images, and no external stylesheet or script. Use `--open` to call `open <output>` on macOS; catch `OSError` and print a warning without failing an otherwise successful conversion.

- [x] **Step 2: Run focused tests until green**

Run:

```bash
python3 -m pytest tests/test_wechat_formatter.py -q
```

Expected: all formatter tests pass.

- [x] **Step 3: Verify CLI behavior manually**

Run:

```bash
python3 tools/wechat_formatter.py tests/fixtures/formatter-smoke.md --output /tmp/html-studio-wechat-smoke.html
test -s /tmp/html-studio-wechat-smoke.html
```

Expected: the command prints the output path and the file is non-empty.

- [x] **Step 4: Commit the renderer**

```bash
git add tools tests/test_wechat_formatter.py
git commit -m "feat: add self-contained WeChat HTML formatter"
```

### Task 3: Add the reusable macOS DMG tutorial and Apple-style illustrations

**Why:** Ship a real article that demonstrates the formatter and preserves the confirmed beginner-friendly content.

**Files:**
- Create: `articles/macos-dmg-distribution.md`
- Create: `articles/assets/macos-release-flow.svg`
- Create: `articles/assets/apple-developer-registration.svg`
- Create: `tests/fixtures/formatter-smoke.md`
- Test: `tests/test_wechat_formatter.py`

**Interfaces:**
- The article references images with paths relative to its own directory, such as `assets/apple-developer-registration.svg`.
- The two SVGs are local, lightweight, Apple-style diagrams with no external fonts, images, scripts, or network resources.

- [x] **Step 1: Write the Markdown article**

Include these sections in Chinese, with placeholders instead of real credentials:

```markdown
# macOS DMG 独立分发完整指南

## 先说结论：直接分发不等于上架 App Store
## 第一步：注册 Apple Developer Program
## 第二步：创建 Developer ID Application 证书
## 第三步：准备公证凭据
## 第四步：构建并签名 App
## 第五步：创建并签名 DMG
## 第六步：使用 notarytool 提交公证
## 第七步：Staple 公证票据
## 第八步：Gatekeeper 最终验证
## 常见问题
## 最终检查清单
```

The registration section must explain the individual $99 annual membership, review confirmation email, and the difference between Developer ID direct distribution and App Store submission. Code examples must use placeholders such as `<APPLE_ID>`, `<TEAM_ID>`, `<SUBMISSION_ID>`, and `<SIGNING_IDENTITY>`; never include real secrets.

- [x] **Step 2: Create two local SVG diagrams**

Create clean diagrams using white backgrounds, black typography, Apple blue connectors, subtle rounded cards, and a 2:1 or 16:9 viewBox:

1. `apple-developer-registration.svg`: Apple Developer registration → review → Developer ID certificate → private key pairing.
2. `macos-release-flow.svg`: build → sign App → sign DMG → submit → Accepted → staple → distribute.

The SVGs must be safe static assets with no scripts or external references.

- [x] **Step 3: Run article conversion**

Run:

```bash
python3 tools/wechat_formatter.py \
  articles/macos-dmg-distribution.md \
  --open
```

Expected: `articles/macos-dmg-distribution-wechat.html` is created, includes both `data:image/svg+xml;base64,` images, and opens locally when `open` is available.

- [x] **Step 4: Commit the article and assets**

```bash
git add articles tests/fixtures/formatter-smoke.md
git commit -m "docs: add macOS DMG WeChat tutorial"
```

### Task 4: Document reuse, update changelog, and perform end-to-end verification

**Why:** Make the workflow discoverable and prove that the output is safe to paste and reusable without repeating context.

**Files:**
- Modify: `README.md` (add a short “WeChat article formatter” section)
- Modify: `CHANGELOG.md` (add the dated formatter entry at the top)
- Test: `tests/test_wechat_formatter.py`

**Interfaces:**
- README documents the exact `python3 tools/wechat_formatter.py <markdown>` command, `--open`, `--output`, `--force`, and the `articles/assets/` convention.
- Changelog entry records the user-facing utility and image support; it does not claim that the macOS app itself was changed.

- [x] **Step 1: Add the reuse instructions**

Document this exact flow:

```bash
cp articles/macos-dmg-distribution.md articles/my-next-guide.md
mkdir -p articles/assets
python3 tools/wechat_formatter.py articles/my-next-guide.md --open
```

Explain that Markdown is the only source of truth and local images are automatically embedded.

- [x] **Step 2: Add the changelog entry**

Add a dated entry with the user story, formatter capability, image embedding, and scope boundary. Use the current project’s bilingual changelog style and do not alter unrelated entries.

- [x] **Step 3: Run the full test suite**

Run:

```bash
python3 -m pytest tests/ -q
```

Expected: all existing tests and formatter tests pass.

- [x] **Step 4: Verify output structure and image self-containment**

Run:

```bash
python3 tools/wechat_formatter.py articles/macos-dmg-distribution.md --force
python3 - <<'PY'
from pathlib import Path
from html.parser import HTMLParser

path = Path('articles/macos-dmg-distribution-wechat.html')
text = path.read_text(encoding='utf-8')
assert '<html' in text and '</html>' in text
assert 'data:image/svg+xml;base64,' in text
assert 'https://' in text or 'http://' in text
print('wechat html: OK')
PY
```

Expected: the command prints `wechat html: OK` and no external CSS or script tags exist.

- [x] **Step 5: Perform real browser copy verification**

Open the generated HTML in a browser, hard-refresh, inspect the article at a narrow mobile-width window, then select all and copy. Paste into a test WeChat draft and confirm title hierarchy, code blocks, notice cards, links, captions, and both images remain visible.

- [x] **Step 6: Commit documentation and verification changes**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document reusable WeChat publishing workflow"
```

## Acceptance Criteria

- A Markdown file plus local assets generates a single, self-contained WeChat-friendly HTML file with one command.
- The sample macOS DMG tutorial covers registration through distribution for a novice individual developer and does not conflate direct distribution with App Store submission.
- The output uses the agreed Apple-style typography, cards, code blocks, and image treatment.
- Images are embedded as data URIs and survive copying from the browser into a WeChat draft.
- No formatter path reads credentials, uploads content, modifies the app, or requires a network connection.
- Focused and full tests pass, and real browser copy verification is recorded before claiming completion.


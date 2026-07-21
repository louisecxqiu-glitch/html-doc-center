#!/usr/bin/env python3
"""Convert Markdown tutorials into self-contained WeChat-friendly HTML."""

from __future__ import annotations

import argparse
import base64
import html
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
_FENCE_RE = re.compile(r"^\s*```\s*([\w+-]*)\s*$")
_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*#*\s*$")
_UNORDERED_RE = re.compile(r"^\s*[-+*]\s+(.+)$")
_ORDERED_RE = re.compile(r"^\s*\d+[.)]\s+(.+)$")
_IMAGE_RE = re.compile(r"^!\[([^\]]*)\]\(([^)\s]+)(?:\s+[\"']([^\"']+)[\"'])?\)$")
_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)(?:\s+[\"']([^\"']+)[\"'])?\)")
_BOLD_RE = re.compile(r"(\*\*|__)(.+?)\1")
_ITALIC_RE = re.compile(r"(?<!\w)(\*|_)([^*_]+?)\1(?!\w)")
_CODE_SPAN_RE = re.compile(r"`([^`]+)`")

_CSS = """
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f5f5f7; color: #1d1d1f;
         font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
         line-height: 1.75; }
  .wx-article { max-width: 760px; margin: 0 auto; padding: 44px 28px 72px;
                background: #fff; box-sizing: border-box; }
  .wx-title { margin: 0 0 26px; color: #111; font-size: 34px; line-height: 1.2;
              letter-spacing: -0.02em; font-weight: 700; }
  .wx-section { margin: 42px 0 14px; color: #111; font-size: 25px; line-height: 1.3;
                letter-spacing: -0.01em; font-weight: 700; }
  .wx-subsection { margin: 30px 0 10px; color: #111; font-size: 20px; line-height: 1.4; font-weight: 650; }
  .wx-paragraph { margin: 0 0 18px; font-size: 16px; }
  .wx-strong { font-weight: 700; color: #111; }
  .wx-em { font-style: italic; }
  .wx-inline-code { padding: 2px 5px; color: #1d1d1f; background: #f5f5f7; border-radius: 5px;
                    font: 0.9em SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .wx-link { color: #06c; text-decoration: none; border-bottom: 1px solid rgba(0,102,204,.25); }
  .wx-list { margin: 8px 0 20px; padding-left: 26px; font-size: 16px; }
  .wx-list li { margin: 5px 0; padding-left: 4px; }
  .wx-quote { margin: 20px 0; padding: 15px 18px; color: #424245; background: #f5f5f7;
              border-left: 4px solid #06c; border-radius: 12px; font-size: 15px; }
  .wx-code { margin: 20px 0; padding: 17px 18px; overflow-x: auto; color: #f5f5f7;
             background: #1d1d1f; border-radius: 14px; font: 13px/1.6 SFMono-Regular, Menlo, Monaco, Consolas, monospace;
             white-space: pre; -webkit-overflow-scrolling: touch; }
  .wx-code code { font: inherit; }
  .wx-rule { border: 0; border-top: 1px solid #d2d2d7; margin: 34px 0; }
  .wx-table-wrap { margin: 20px 0; overflow-x: auto; }
  .wx-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .wx-table th, .wx-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #d2d2d7; }
  .wx-table th { color: #111; background: #f5f5f7; font-weight: 650; }
  .wx-figure { margin: 26px 0 30px; text-align: center; }
  .wx-image { display: block; width: 100%; max-width: 100%; height: auto; margin: 0 auto;
              border-radius: 16px; box-shadow: 0 8px 26px rgba(0,0,0,.10); }
  .wx-caption { display: block; margin-top: 9px; color: #6e6e73; font-size: 13px; line-height: 1.45; }
  @media (max-width: 600px) {
    .wx-article { padding: 30px 18px 52px; }
    .wx-title { font-size: 29px; }
    .wx-section { font-size: 23px; }
    .wx-paragraph, .wx-list { font-size: 16px; }
  }
</style>
""".strip()


def _safe_url(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https", "mailto"}:
        return "#"
    return html.escape(url, quote=True)


def convert_image_to_data_uri(image_path: Path) -> str:
    """Read a supported local image and return a self-contained data URI."""
    if not image_path.is_file():
        raise FileNotFoundError(image_path)
    suffix = image_path.suffix.lower()
    if suffix not in IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {image_path.suffix}")
    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }[suffix]
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _inline_markup(text: str) -> str:
    escaped = html.escape(text, quote=False)
    placeholders: dict[str, str] = {}

    def stash(value: str) -> str:
        key = f"\x00{len(placeholders)}\x00"
        placeholders[key] = value
        return key

    def link(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        title = match.group(3)
        title_attr = f' title="{html.escape(title, quote=True)}"' if title else ""
        return stash(
            f'<a class="wx-link" href="{_safe_url(url)}"{title_attr}>{html.escape(label)}</a>'
        )

    escaped = _LINK_RE.sub(link, escaped)
    escaped = _CODE_SPAN_RE.sub(
        lambda match: stash(f'<code class="wx-inline-code">{match.group(1)}</code>'),
        escaped,
    )
    escaped = _BOLD_RE.sub(
        lambda match: f'<strong class="wx-strong">{match.group(2)}</strong>', escaped
    )
    escaped = _ITALIC_RE.sub(
        lambda match: f'<em class="wx-em">{match.group(2)}</em>', escaped
    )
    for key, value in placeholders.items():
        escaped = escaped.replace(key, value)
    return escaped


def _resolve_image(source_dir: Path, raw_path: str) -> Path:
    candidate = (source_dir / raw_path).resolve()
    root = source_dir.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"Image path escapes article directory: {raw_path}") from error
    return candidate


def _render_image(source_dir: Path, alt: str, raw_path: str, title: str | None) -> str:
    data_uri = convert_image_to_data_uri(_resolve_image(source_dir, raw_path))
    safe_alt = html.escape(alt, quote=True)
    caption_text = title or alt
    caption = (
        f'<figcaption class="wx-caption">{html.escape(caption_text)}</figcaption>'
        if caption_text
        else ""
    )
    return (
        '<figure class="wx-figure">'
        f'<img class="wx-image" src="{data_uri}" alt="{safe_alt}">'
        f"{caption}</figure>"
    )


def _is_table_separator(line: str) -> bool:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def _table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _render_table(lines: list[str]) -> str:
    header = _table_row(lines[0])
    body_rows = [_table_row(line) for line in lines[2:]]
    head_html = "".join(f"<th>{_inline_markup(cell)}</th>" for cell in header)
    body_html = "".join(
        "<tr>" + "".join(f"<td>{_inline_markup(cell)}</td>" for cell in row) + "</tr>"
        for row in body_rows
    )
    return f'<div class="wx-table-wrap"><table class="wx-table"><thead><tr>{head_html}</tr></thead><tbody>{body_html}</tbody></table></div>'


def render_markdown(source: str, source_dir: Path) -> str:
    """Render the supported Markdown subset into a styled HTML fragment."""
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        fence = _FENCE_RE.match(line)
        if fence:
            language = fence.group(1)
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            if index < len(lines):
                index += 1
            language_attr = f' class="language-{html.escape(language)}"' if language else ""
            blocks.append(
                f'<pre class="wx-code"><code{language_attr}>{html.escape(chr(10).join(code_lines))}</code></pre>'
            )
            continue

        heading = _HEADING_RE.match(line)
        if heading:
            level = len(heading.group(1))
            tag = {1: "h1", 2: "h2", 3: "h3"}[level]
            css_class = {1: "wx-title", 2: "wx-section", 3: "wx-subsection"}[level]
            blocks.append(f'<{tag} class="{css_class}">{_inline_markup(heading.group(2))}</{tag}>')
            index += 1
            continue

        image = _IMAGE_RE.match(line.strip())
        if image:
            blocks.append(_render_image(source_dir, image.group(1), image.group(2), image.group(3)))
            index += 1
            continue

        if line.strip() in {"---", "***", "___"}:
            blocks.append('<hr class="wx-rule">')
            index += 1
            continue

        if line.lstrip().startswith(">"):
            quote_lines: list[str] = []
            while index < len(lines) and lines[index].lstrip().startswith(">"):
                quote_lines.append(re.sub(r"^\s*>\s?", "", lines[index]))
                index += 1
            blocks.append(f'<blockquote class="wx-quote">{_inline_markup(" ".join(quote_lines))}</blockquote>')
            continue

        if index + 1 < len(lines) and "|" in line and _is_table_separator(lines[index + 1]):
            table_lines = [line, lines[index + 1]]
            index += 2
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                table_lines.append(lines[index])
                index += 1
            blocks.append(_render_table(table_lines))
            continue

        unordered = _UNORDERED_RE.match(line)
        ordered = _ORDERED_RE.match(line)
        if unordered or ordered:
            matcher = _UNORDERED_RE if unordered else _ORDERED_RE
            tag = "ul" if unordered else "ol"
            items: list[str] = []
            while index < len(lines):
                item = matcher.match(lines[index])
                if not item:
                    break
                items.append(f"<li>{_inline_markup(item.group(1))}</li>")
                index += 1
            blocks.append(f'<{tag} class="wx-list">{"".join(items)}</{tag}>')
            continue

        paragraph_lines = [line.strip()]
        index += 1
        while index < len(lines) and lines[index].strip():
            if (
                _FENCE_RE.match(lines[index])
                or _HEADING_RE.match(lines[index])
                or lines[index].lstrip().startswith(">")
                or _UNORDERED_RE.match(lines[index])
                or _ORDERED_RE.match(lines[index])
            ):
                break
            paragraph_lines.append(lines[index].strip())
            index += 1
        blocks.append(f'<p class="wx-paragraph">{_inline_markup(" ".join(paragraph_lines))}</p>')

    return "\n".join(blocks)


def _document(fragment: str) -> str:
    return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>微信公众号文章预览</title>"
        f'{_CSS}</head><body><main class="wx-article">{fragment}</main></body></html>'
    )


def format_file(input_path: Path, output_path: Path | None = None, *, force: bool = False) -> Path:
    input_path = Path(input_path)
    if not input_path.is_file():
        raise FileNotFoundError(input_path)
    output_path = Path(output_path) if output_path else input_path.with_name(f"{input_path.stem}-wechat.html")
    if output_path.exists() and not force:
        raise FileExistsError(f"Output already exists: {output_path}; use --force to overwrite")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rendered = _document(render_markdown(input_path.read_text(encoding="utf-8"), input_path.parent))
    output_path.write_text(rendered, encoding="utf-8")
    return output_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Markdown source file")
    parser.add_argument("--output", type=Path, help="Output HTML path")
    parser.add_argument("--open", action="store_true", help="Open the generated HTML after writing")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing output file")
    args = parser.parse_args(argv)
    try:
        output = format_file(args.input, args.output, force=args.force)
    except (FileNotFoundError, FileExistsError, UnicodeError, ValueError) as error:
        parser.error(str(error))
    print(output)
    if args.open:
        try:
            subprocess.run(["open", str(output)], check=False)
        except OSError as error:
            print(f"Warning: could not open preview: {error}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

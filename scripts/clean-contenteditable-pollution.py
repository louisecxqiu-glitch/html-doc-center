#!/usr/bin/env python3
"""
DocCenter v1.9.3 清理脚本 · 修复 A 类污染

背景：
  v1.9.3 之前，DocCenter 在"覆盖源文件"时没有剥离自己注入的 contenteditable="true" 和
  outline:none，导致源文件被永久污染。下次打开时 detectExistingEditor 判定 3 误杀，
  顶栏 📐 按钮不出现。

本脚本：
  扫描指定目录（默认所有 scan_roots），找出 body 已 contenteditable 的 HTML，
  自动剥离这两项，并做 *.bak 备份。

运行：
  python3 scripts/clean-contenteditable-pollution.py [DIR ...]
  （不传参 = 读取 ~/.codebuddy/html-doc-center/config.json 的 enabled scan_roots）
"""
import json
import os
import re
import sys
from pathlib import Path

CONTENTEDITABLE_RE = re.compile(
    r'(<body[^>]*?)\s+contenteditable="true"',
    re.IGNORECASE,
)
# 匹配 style="..." 里的 outline: none（多种变体）
BODY_STYLE_RE = re.compile(
    r'(<body[^>]*?\sstyle=")([^"]*)(")',
    re.IGNORECASE,
)
OUTLINE_NONE_RE = re.compile(r'\s*outline\s*:\s*none\s*;?', re.IGNORECASE)


def clean_html(content: str) -> tuple[str, list[str]]:
    """返回 (cleaned_content, fixes_applied)"""
    fixes = []
    new_content = content

    # 1. 剥离 body 的 contenteditable="true"
    if CONTENTEDITABLE_RE.search(new_content):
        new_content = CONTENTEDITABLE_RE.sub(r'\1', new_content)
        fixes.append("removed body contenteditable")

    # 2. 剥离 body style 里的 outline: none
    def clean_body_style(m):
        prefix, style, suffix = m.group(1), m.group(2), m.group(3)
        cleaned_style = OUTLINE_NONE_RE.sub("", style).strip().strip(";").strip()
        if cleaned_style != style.strip():
            if cleaned_style:
                return f"{prefix}{cleaned_style}{suffix}"
            else:
                # 整个 style 空了，删除属性
                return m.group(0).replace(f' style="{style}"', "").replace(
                    f" style=\"{style}\"", ""
                )
        return m.group(0)

    if OUTLINE_NONE_RE.search(new_content):
        new_content2 = BODY_STYLE_RE.sub(clean_body_style, new_content)
        if new_content2 != new_content:
            fixes.append("cleaned body style outline:none")
            new_content = new_content2

    return new_content, fixes


def scan_dir(root: Path) -> list[Path]:
    targets = []
    for p in root.rglob("*.html"):
        # 跳过快照
        if "_auto-save" in p.parts:
            continue
        # 跳过自己生成的备份
        if p.name.endswith(".bak-v1.9.3"):
            continue
        try:
            # 读全文判断（v1.9.3 修：之前只读 8KB 漏掉 <body 在 32KB+ 的大文件）
            content = p.read_text(encoding="utf-8", errors="ignore")
            if "contenteditable" in content and "<body" in content:
                targets.append(p)
        except Exception:
            pass
    return targets


def process_file(p: Path, dry_run: bool) -> tuple[bool, list[str]]:
    try:
        content = p.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ⚠️  读取失败：{e}")
        return False, []

    cleaned, fixes = clean_html(content)
    if not fixes:
        return False, []

    if dry_run:
        return True, fixes

    # 备份
    bak = p.with_suffix(p.suffix + ".bak-v1.9.3")
    if not bak.exists():
        bak.write_text(content, encoding="utf-8")

    # 写入清理后的内容
    p.write_text(cleaned, encoding="utf-8")
    return True, fixes


def load_scan_roots_from_config() -> list[Path]:
    cfg_path = Path.home() / ".codebuddy" / "html-doc-center" / "config.json"
    if not cfg_path.exists():
        return []
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    roots = []
    for r in cfg.get("scan_roots", []):
        if isinstance(r, dict) and r.get("enabled"):
            roots.append(Path(r["path"]))
        elif isinstance(r, str):
            roots.append(Path(r))
    return [p for p in roots if p.exists()]


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if not a.startswith("--")]

    if args:
        roots = [Path(a).expanduser().resolve() for a in args]
    else:
        roots = load_scan_roots_from_config()

    if not roots:
        print("❌ 没找到任何扫描目录。用法：")
        print("   python3 clean-contenteditable-pollution.py <dir1> <dir2> ...")
        print("   python3 clean-contenteditable-pollution.py --dry-run")
        sys.exit(1)

    print(f"🔍 扫描 {len(roots)} 个目录...")
    for r in roots:
        print(f"   · {r}")
    print()

    all_targets = []
    for r in roots:
        all_targets.extend(scan_dir(r))

    if not all_targets:
        print("✨ 没发现被污染的文件，一切干净。")
        return

    print(f"📋 发现 {len(all_targets)} 个候选文件")
    print(f"{'🧪 Dry Run 模式（不写入）' if dry_run else '✏️  将清理并备份为 *.bak-v1.9.3'}")
    print()

    fixed_count = 0
    for p in all_targets:
        rel = p
        try:
            rel = p.relative_to(Path.cwd())
        except ValueError:
            pass
        was_fixed, fixes = process_file(p, dry_run)
        if was_fixed:
            fixed_count += 1
            print(f"✅ {rel}")
            for f in fixes:
                print(f"   · {f}")

    print()
    if dry_run:
        print(f"🧪 Dry Run 完成。共 {fixed_count} 个文件会被清理。")
        print("   加 --dry-run 之外的正式运行即可真正修复。")
    else:
        print(f"✨ 完成。已清理 {fixed_count} 个文件，原文件备份为 *.bak-v1.9.3")


if __name__ == "__main__":
    main()

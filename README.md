# 🎨 HTML Studio

**The HTML Editor & Viewer for the AI era.**

Stop opening HTML files one by one. HTML Studio turns any folder into a browsable, editable, auto-saving document hub — in one command.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-purple.svg)](https://code.claude.com/docs/en/plugins)

---

## Why HTML Studio?

AI coding tools (Claude Code, Cursor, Copilot) generate HTML artifacts constantly — reports, dashboards, cover images, presentations. But then you're stuck:

- Opening each file manually in a browser
- No way to edit without source code
- No auto-save, no version history
- Files scattered across directories

**HTML Studio solves this.** One command, all your HTML in one place, instantly editable.

---

## Quick Start

### Option 1: Download executable (recommended, zero install)

1. Go to [Releases](https://github.com/louisecxqiu-glitch/html-doc-center/releases)
2. Download `HTMLStudio-macOS` (Mac) or `HTMLStudio.exe` (Windows)
3. Double-click to start — browser opens automatically

### Option 2: Double-click launch (from source)

1. Download the project (ZIP or `git clone https://github.com/louisecxqiu-glitch/html-doc-center.git`)
2. Double-click `启动 HTMLStudio.command` (Mac) or `启动 HTMLStudio.bat` (Windows)
3. Browser opens automatically → start using

> First run auto-installs the dependency (`aiohttp`), requires internet.

### Option 2: Command line

```bash
git clone https://github.com/louisecxqiu-glitch/html-doc-center.git
cd html-doc-center
pip install aiohttp
python3 server.py --open-browser
# → http://localhost:9901
```

Or as a **Claude Code Plugin**:
```
/plugin install htmlstudio@claude-plugins-official
```

---

## Features

| Feature | Description |
|---------|-------------|
| 📁 **Directory tree** | Auto-discovers all HTML/MD files, searchable sidebar |
| ✏️ **Click to edit** | Zero-config inline editing with toolbar injection |
| 💾 **Smart auto-save** | 2s idle → snapshot; close → overwrite / save-as / discard |
| 🔍 **Markdown support** | Built-in MD editor with live preview |
| ⭐ **Favorites & sort** | Bookmark files, sort by time or name |
| 🔄 **Live refresh** | 10s polling with ETag signatures (99.99% zero-traffic) |
| 📂 **Multi-root** | Configure multiple scan directories via settings UI |
| 🖱️ **Drag & drop** | Move files between directories |
| 🔒 **Path-safe** | All writes validated against scan_roots whitelist |

---

## Claude Code Integration

HTML Studio works as a Claude Code Plugin with MCP support:

```
/hotpage ./report.html     # Open file in HotPage
/hotpage serve ./outputs   # Serve a directory
```

When Claude Code generates HTML, it automatically opens in HTML Studio for preview and editing.

### MCP Tools

| Tool | Description |
|------|-------------|
| `hotpage_open` | Open a specific file |
| `hotpage_status` | Check if server is running |
| `hotpage_serve` | Start serving a directory |
| `hotpage_list` | List all discovered files |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Python (aiohttp) — single process      │
│  ├─ /api/tree → directory tree JSON     │
│  ├─ /api/file → serve HTML with         │
│  │              saver-runtime.js inject  │
│  ├─ /api/save → overwrite / save-as     │
│  └─ /api/settings → config CRUD         │
├─────────────────────────────────────────┤
│  saver-runtime.js (injected into iframe)│
│  ├─ contentEditable toolbar             │
│  ├─ 2s idle → auto-snapshot             │
│  ├─ postMessage ↔ parent frame          │
│  └─ close → 3-option dialog             │
├─────────────────────────────────────────┤
│  web/app.js — sidebar + iframe viewer   │
└─────────────────────────────────────────┘
```

**Zero dependencies** beyond `aiohttp`. No npm, no webpack, no build step.

---

## Configuration

Config stored at `~/.codebuddy/html-doc-center/config.json`:

```json
{
  "scan_roots": [
    {"path": "/Users/me/reports", "enabled": true},
    {"path": "/Users/me/outputs", "enabled": true}
  ]
}
```

Or configure via the in-app Settings panel (⚙️ button).

---

## Comparison

| | HTML Studio | mcp-html-artifacts-preview | File Browser |
|---|---------|---------------------------|--------------|
| Editing | ✅ Inline edit + toolbar | ❌ View only | ❌ No |
| Auto-save | ✅ 2s snapshot + 3-option | ❌ No | ❌ No |
| Persistence | ✅ Files stay on disk | ❌ Session-only | ✅ Yes |
| Zero-config | ✅ One command | ✅ MCP config | ⚠️ Docker |
| Claude Code | ✅ Plugin + MCP | ✅ MCP only | ❌ No |
| Markdown | ✅ Built-in | ❌ No | ❌ No |

---

## Development

```bash
# Run in dev mode (auto-reload)
python3 server.py --dev

# Run tests
python3 -m pytest tests/
```

### Build distributable apps

```bash
python3 -m pip install -r requirements-build.txt
python3 build.py
```

On Apple Silicon macOS, the signed and notarized release command is:

```bash
python3 scripts/release_macos.py
```

See [docs/macos-release.md](docs/macos-release.md) for the one-time Apple certificate and GitHub Secrets setup.

### WeChat article formatter

将 Markdown 教程转换成带苹果式内联样式、可直接复制到微信公众号编辑器的单文件 HTML：

```bash
python3 tools/wechat_formatter.py articles/macos-dmg-distribution.md --open
```

复制下一篇文章时，只需保留 Markdown 原稿，并把本地图片放入 `articles/assets/` 后引用；脚本会把图片内嵌到 HTML。需要指定输出路径时使用 `--output`，覆盖已有输出时使用 `--force`。

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT © Louis Jobs 2026

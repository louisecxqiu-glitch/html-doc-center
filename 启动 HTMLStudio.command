#!/bin/bash
# ============================================================
#  HTML Studio 启动脚本（macOS）
#  双击此文件即可启动 HTML Studio，无需命令行
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════"
echo "  🔥 HTML Studio 启动中..."
echo "═══════════════════════════════════════════"
echo ""

# ── 1. 找 Python 3 ──
PYTHON=""
for cmd in python3 /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ 未找到 Python 3，正在打开下载页..."
  open "https://www.python.org/downloads/" 2>/dev/null
  echo ""
  echo "安装 Python 后，重新双击此文件即可。"
  echo ""
  echo "按任意键退出..."
  read -n 1
  exit 1
fi

echo "✅ Python: $($PYTHON --version)"

# ── 2. 检查 aiohttp ──
if ! $PYTHON -c "import aiohttp" 2>/dev/null; then
  echo "📦 正在安装依赖 aiohttp..."
  $PYTHON -m pip install aiohttp --quiet
  if ! $PYTHON -c "import aiohttp" 2>/dev/null; then
    echo "❌ aiohttp 安装失败，请手动执行："
    echo "   $PYTHON -m pip install aiohttp"
    echo ""
    echo "按任意键退出..."
    read -n 1
    exit 1
  fi
  echo "✅ aiohttp 已安装"
else
  echo "✅ aiohttp 已就绪"
fi

echo ""

# ── 3. 询问是否设为开机自启 ──
PLIST_PATH="$HOME/Library/LaunchAgents/com.louis.html-doc-center.plist"
if [ ! -f "$PLIST_PATH" ]; then
  echo "🔧 是否设为开机自启？(y/n)"
  read -n 1 answer
  echo ""
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    # 动态生成 plist（用当前 python 路径和项目路径）
    cat > "$PLIST_PATH" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.louis.html-doc-center</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/html-doc-center.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/html-doc-center.err.log</string>
</dict>
</plist>
PLIST_EOF
    launchctl load "$PLIST_PATH" 2>/dev/null
    echo "✅ 已设为开机自启（Mac 开机后自动启动 HTML Studio）"
    sleep 2
    open "http://localhost:9901"
    echo ""
    echo "🌐 浏览器已打开。HTML Studio 将在后台运行，可以关闭此窗口。"
    echo "如需取消开机自启，运行：launchctl unload $PLIST_PATH"
    echo ""
    sleep 3
    exit 0
  else
    echo "⏭️  跳过，如需后续设置可重新双击此文件"
    echo ""
  fi
fi

# ── 4. 检查端口是否已被占用 ──
if lsof -i :9901 -sTCP:LISTEN &>/dev/null; then
  echo "⚠️  HTML Studio 已在运行（端口 9901 被占用）"
  echo "   直接打开浏览器访问：http://localhost:9901"
  open "http://localhost:9901"
  echo ""
  echo "如需重启，先关闭旧进程再双击此文件。"
  echo "按任意键退出..."
  read -n 1
  exit 0
fi

# ── 5. 启动服务 + 打开浏览器 ──
echo "🚀 启动服务中..."
echo "   地址：http://localhost:9901"
echo "   按 Ctrl+C 停止服务"
echo ""

(sleep 2 && open "http://localhost:9901") &

$PYTHON server.py

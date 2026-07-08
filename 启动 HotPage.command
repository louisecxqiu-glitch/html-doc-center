#!/bin/bash
# ============================================================
#  HotPage 启动脚本（macOS）
#  双击此文件即可启动 HotPage，无需命令行
# ============================================================

# 获取此脚本所在目录（即项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════"
echo "  🔥 HotPage 启动中..."
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

# ── 3. 检查端口是否已被占用 ──
if lsof -i :9901 -sTCP:LISTEN &>/dev/null; then
  echo "⚠️  HotPage 已在运行（端口 9901 被占用）"
  echo "   直接打开浏览器访问：http://localhost:9901"
  open "http://localhost:9901"
  echo ""
  echo "如需重启，先关闭旧进程再双击此文件。"
  echo "按任意键退出此窗口..."
  read -n 1
  exit 0
fi

# ── 4. 启动服务 + 打开浏览器 ──
echo "🚀 启动服务中..."
echo "   地址：http://localhost:9901"
echo "   按 Ctrl+C 停止服务"
echo ""

# 2 秒后自动打开浏览器
(sleep 2 && open "http://localhost:9901") &

# 前台运行 server，这样用户能看到日志，Ctrl+C 能停止
$PYTHON server.py

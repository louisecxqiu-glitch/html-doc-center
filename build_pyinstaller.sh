#!/bin/bash
# ============================================================
# build_pyinstaller.sh — 将 HotPage 打包为零依赖单文件可执行程序
# 用法: ./build_pyinstaller.sh
# 输出: dist/HotPage（双击即启动服务+打开浏览器，无需 Python/aiohttp）
# 依赖: pip3 install pyinstaller aiohttp
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="HTMLStudio"

echo "🔨 Building $APP_NAME with PyInstaller..."
echo "   Source: $SCRIPT_DIR"

# ── 检查依赖 ──
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "📦 Installing PyInstaller..."
    pip3 install pyinstaller --quiet
fi
if ! python3 -c "import aiohttp" 2>/dev/null; then
    echo "📦 Installing aiohttp..."
    pip3 install aiohttp --quiet
fi

# ── 清理旧构建 ──
rm -rf build/ dist/

# ── PyInstaller 打包 ──
# --onefile: 单文件可执行程序
# --add-data "web:web": web/ 目录打包进去
# --add-data "saver-runtime.js:.": saver-runtime.js 打包到根目录
# --clean: 清理 PyInstaller 缓存
# --noconfirm: 覆盖输出不询问
pyinstaller --onefile \
  --name "$APP_NAME" \
  --add-data "web:web" \
  --add-data "saver-runtime.js:." \
  --clean \
  --noconfirm \
  server.py

# ── 验证产物 ──
if [ -f "dist/$APP_NAME" ]; then
    SIZE=$(ls -lh "dist/$APP_NAME" | awk '{print $5}')
    ARCH=$(file "dist/$APP_NAME" | grep -o 'arm64\|x86_64' | head -1)
    echo ""
    echo "✅ Build complete!"
    echo "   📦 dist/$APP_NAME ($SIZE, $ARCH)"
    echo "   💡 Double-click to start, or run: ./dist/$APP_NAME"
    echo "   🌐 Browser opens automatically at http://localhost:9901"
    echo ""
    echo "   To test without opening browser:"
    echo "   ./dist/$APP_NAME --no-open-browser --port 9902"
else
    echo "❌ Build failed!"
    exit 1
fi

#!/bin/bash
# ============================================================
# build-app.sh — 将 HTML Document Center 打包为 Mac .app
# 用法: ./build-app.sh [output_path]
# 输出: DocCenter.app（双击即启动服务+打开浏览器）
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="DocCenter"
APP_VERSION="1.5"

# 输出路径：默认当前目录，或指定参数
OUTPUT_DIR="${1:-$SCRIPT_DIR}"
APP_BUNDLE="${OUTPUT_DIR}/${APP_NAME}.app"
CONTENTS="${APP_BUNDLE}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"

echo "🔨 构建 ${APP_NAME}.app v${APP_VERSION} ..."
echo "   源: ${SCRIPT_DIR}"
echo "   目标: ${APP_BUNDLE}"

# ── 清理旧构建 ──
rm -rf "${APP_BUNDLE}"

# ── 创建 .app 目录结构 ──
mkdir -p "${MACOS}"
mkdir -p "${RESOURCES}"

# ── 复制运行时资源 ──
cp -R "${SCRIPT_DIR}/web" "${RESOURCES}/web"
cp    "${SCRIPT_DIR}/saver-runtime.js" "${RESOURCES}/saver-runtime.js"
cp    "${SCRIPT_DIR}/server.py" "${RESOURCES}/server.py"

# ── 写入 Info.plist ──
cat > "${CONTENTS}/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch</string>
    <key>CFBundleIdentifier</key>
    <string>com.doccenter.app</string>
    <key>CFBundleName</key>
    <string>DocCenter</string>
    <key>CFBundleDisplayName</key>
    <string>HTML Document Center</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.5.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.5</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# ── 创建启动脚本 ──
cat > "${MACOS}/launch" << 'LAUNCH'
#!/bin/bash
# =============================================================
# DocCenter Launcher — 启动服务 + 打开浏览器 + 菜单栏图标
# =============================================================

# 找到 .app 内 Resources 目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$(dirname "$SCRIPT_DIR")/Resources"
PYTHON="/usr/bin/python3"

# 配置
PORT=9901
URL="http://localhost:${PORT}"
PIDFILE="$HOME/.doccenter/server.pid"

# 颜色输出
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log() { echo -e "${GREEN}[DocCenter]${NC} $*"; }
warn() { echo -e "${YELLOW}[DocCenter]${NC} $*"; }
err() { echo -e "${RED}[DocCenter]${NC} $*"; }

# ── 检查 Python + aiohttp ──
check_deps() {
    if ! command -v "$PYTHON" &>/dev/null; then
        # 尝试找系统 python3
        PYTHON=$(command -v python3 || true)
        if [ -z "$PYTHON" ]; then
            osascript -e 'display dialog "未找到 Python 3。\n请先安装：https://www.python.org/downloads/" buttons {"OK"} with icon stop'
            exit 1
        fi
    fi
    
    if ! "$PYTHON" -c "import aiohttp" 2>/dev/null; then
        warn "正在安装 aiohttp..."
        pip3 install aiohttp --quiet 2>/dev/null || {
            osascript -e 'display dialog "安装 aiohttp 失败。\n请手动执行: pip3 install aiohttp" buttons {"OK"} with icon caution'
            exit 1
        }
    fi
}

# ── 停止已存在的实例 ──
stop_existing() {
    if [ -f "$PIDFILE" ]; then
        OLD_PID=$(cat "$PIDFILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            warn "停止旧进程 (PID=${OLD_PID})..."
            kill "$OLD_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$OLD_PID" 2>/dev/null || true
        fi
        rm -f "$PIDFILE"
    fi
    
    # 也杀掉占用端口的残留进程
    OLD_PORT_PID=$(lsof -ti:${PORT} -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$OLD_PORT_PID" ]; then
        warn "释放端口 ${PORT} (PID=${OLD_PORT_PID})"
        kill "$OLD_PORT_PID" 2>/dev/null || kill -9 "$OLD_PORT_PID" 2>/dev/null || true
        sleep 0.5
    fi
}

# ── 启动服务 ──
start_server() {
    log "启动 DocCenter 服务 (${PORT})..."
    
    cd "$RESOURCES"
    nohup "$PYTHON" server.py > "$HOME/.doccenter/server.log" 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" > "$PIDFILE"
    
    # 等待就绪（最多等 8 秒）
    for i in $(seq 1 16); do
        if curl -sf "http://localhost:${PORT}" >/dev/null 2>&1; then
            log "✅ 服务就绪 (PID=${SERVER_PID})"
            return 0
        fi
        sleep 0.5
        
        # 进程意外退出？
        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            err "❌ 服务异常退出！日志："
            tail -20 "$HOME/.doccenter/server.log" 2>/dev/null || true
            osascript -e "display alert \"DocCenter 服务启动失败\" message \"查看日志: ~/\.doccenter/server.log\" as critical buttons {\"OK\"}"
            exit 1
        fi
    done
    
    err "⏰ 服务启动超时！日志："
    tail -10 "$HOME/.doccenter/server.log" 2>/dev/null || true
    osascript -e 'display alert "DocCenter 启动超时" message "端口可能被占用，检查终端: lsof -i :9901" as warning buttons {"OK"}'
    exit 1
}

# ── 打开浏览器 ──
open_browser() {
    log "打开浏览器 → ${URL}"
    open "${URL}"
}

# ── 主流程 ──
main() {
    mkdir -p "$HOME/.doccenter"
    
    check_deps
    stop_existing
    start_server
    open_browser
    
    log "━━━━━━━━━━━━━━━━━━━━━━━"
    log "DocCenter 已启动 🚀"
    log "地址: ${URL}"
    log "关闭方式: 关闭终端窗口 / 或执行: \$(kill \$(cat ~/.doccenter/server.pid))"
    log "━━━━━━━━━━━━━━━━━━━━━━━"
}

main
LAUNCH

chmod +x "${MACOS}/launch"

# ── 可选：生成简易 icon ──
# 如果没有现成 icns，创建一个占位图标（后续可替换）
if command -v sips &>/dev/null; then
    ICON_TMP=$(mktemp /tmp/doccenter_icon_XXXX.png)
    # 用 sips 生成一个简单的金色圆角方块作为临时 icon
    python3 -c "
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (512, 512), '#1a1a2e')
draw = ImageDraw.Draw(img)
# 金色圆角矩形
draw.rounded_rectangle([40, 40, 472, 472], radius=60, fill='#C9A961')
# D 文字
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 280)
except:
    font = ImageFont.load_default()
bbox = draw.textbbox((0, 0), 'D', font=font)
tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
draw.text(((512-tw)//2, (512-th)//2), 'D', fill='#1a1a2e', font=font)
img.save('$ICON_TMP')
" 2>/dev/null || true

    if [ -f "$ICON_TMP" ]; then
        sips -s format png "$ICON_TMP" --out "${ICON_TMP}.png" 2>/dev/null || true
        mkdir -p "${RESOURCES}/icon.iconset"
        for size in 16 32 64 128 256 512; do
            sips -z "$size" "$ICON_TMP" --out "${RESOURCES}/icon.iconset/icon_${size}x${size}.png" 2>/dev/null || true
            dbl=$((size * 2))
            sips -z "$dbl" "$ICON_TMP" --out "${RESOURCES}/icon.iconset/icon_${size}x${size}@2x.png" 2>/dev/null || true
        done
        iconutil -c icns "${RESOURCES}/icon.iconset" -o "${RESOURCES}/icon.icns" 2>/dev/null || true
        rm -rf "${RESOURCES}/icon.iconset"
        rm -f "$ICON_TMP" "$ICON_TMP.png"
    fi
fi

# ── 完成 ──
echo ""
echo "✅ 构建完成！"
echo "   📦 ${APP_BUNDLE}"
echo "   💡 双击即可启动，或拖到 /Applications/"
echo ""

# 自动打开 Finder 显示产物
open -R "${APP_BUNDLE}"

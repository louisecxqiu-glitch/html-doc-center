#!/usr/bin/env python3
"""
build.py — 跨平台 HTML Studio 打包脚本（Mac / Windows / Linux）
用法: python3 build.py
依赖: pip install pyinstaller aiohttp
产出: dist/HTMLStudio (Mac/Linux) 或 dist/HTMLStudio.exe (Windows)
"""
import subprocess
import sys
import os
import shutil
from pathlib import Path

# Windows 控制台默认 cp1252 编码无法输出 emoji，强制设为 utf-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = Path(__file__).parent.resolve()
APP_NAME = "HTMLStudio"
IS_WINDOWS = sys.platform == "win32"
# PyInstaller --add-data 分隔符：Windows 用 ; Mac/Linux 用 :
SEP = ";" if IS_WINDOWS else ":"

def main():
    os.chdir(SCRIPT_DIR)
    print(f"🔨 Building {APP_NAME} with PyInstaller...")
    print(f"   Platform: {sys.platform}")
    print(f"   Source: {SCRIPT_DIR}")

    # 检查依赖
    try:
        import PyInstaller
    except ImportError:
        print("📦 Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller", "--quiet"])
    try:
        import aiohttp
    except ImportError:
        print("📦 Installing aiohttp...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp", "--quiet"])

    # 清理旧构建
    for d in ["build", "dist"]:
        p = SCRIPT_DIR / d
        if p.exists():
            shutil.rmtree(p)

    # PyInstaller 打包
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", APP_NAME,
        "--add-data", f"web{SEP}web",
        "--add-data", f"saver-runtime.js{SEP}.",
        "--clean",
        "--noconfirm",
        "server.py",
    ]
    # Mac: --windowed 生成 .app bundle
    if not IS_WINDOWS:
        cmd.append("--windowed")
    print(f"   Command: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    # 验证产物 + Mac 上创建 .dmg
    if IS_WINDOWS:
        output = SCRIPT_DIR / "dist" / f"{APP_NAME}.exe"
    else:
        # --windowed 在 Mac 上生成 .app
        app_path = SCRIPT_DIR / "dist" / f"{APP_NAME}.app"
        # 创建 .dmg
        dmg_path = SCRIPT_DIR / "dist" / f"{APP_NAME}.dmg"
        if app_path.exists():
            print("📦 Creating .dmg...")
            # 先删旧 dmg
            if dmg_path.exists():
                dmg_path.unlink()
            subprocess.check_call([
                "hdiutil", "create",
                "-volname", "HTML Studio",
                "-srcfolder", str(app_path),
                "-ov",
                "-format", "UDZO",
                str(dmg_path)
            ])
            output = dmg_path
        else:
            # 降级：无 --windowed 时可能是裸可执行文件
            output = SCRIPT_DIR / "dist" / APP_NAME

    if output.exists():
        size_mb = output.stat().st_size / (1024 * 1024)

        # macOS: 对 .app 做 ad-hoc 签名（避免 Gatekeeper 拦截）
        if not IS_WINDOWS:
            app_for_sign = SCRIPT_DIR / "dist" / f"{APP_NAME}.app"
            if app_for_sign.exists():
                try:
                    subprocess.check_call([
                        "codesign", "--force", "--deep", "--sign", "-", str(app_for_sign)
                    ])
                    print(f"🔐 Ad-hoc signed: {app_for_sign}")
                except (subprocess.CalledProcessError, FileNotFoundError):
                    print(f"⚠️ codesign failed (non-fatal) — user may need to right-click → Open on first launch")

        print()
        print(f"✅ Build complete!")
        print(f"   📦 {output} ({size_mb:.1f} MB)")
        if IS_WINDOWS:
            print(f"   💡 Double-click HTMLStudio.exe to start")
        else:
            print(f"   💡 Mount .dmg → drag HTMLStudio.app to Applications → double-click to start")
            print(f"   🔐 If Gatekeeper blocks: right-click → Open → Open")
        print(f"   🌐 Browser opens automatically")
        print()
        print(f"   To test without opening browser:")
        print(f"   ./dist/{APP_NAME}.app/Contents/MacOS/{APP_NAME} --no-open-browser --port 9902")
    else:
        print("❌ Build failed! Output not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()

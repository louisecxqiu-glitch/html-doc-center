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
    print(f"   Command: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    # 验证产物
    ext = ".exe" if IS_WINDOWS else ""
    output = SCRIPT_DIR / "dist" / f"{APP_NAME}{ext}"
    if output.exists():
        size_mb = output.stat().st_size / (1024 * 1024)
        print()
        print(f"✅ Build complete!")
        print(f"   📦 {output} ({size_mb:.1f} MB)")
        if IS_WINDOWS:
            print(f"   💡 Double-click HTMLStudio.exe to start")
        else:
            print(f"   💡 Double-click to start, or run: ./dist/{APP_NAME}")
        print(f"   🌐 Browser opens automatically")
        print()
        print(f"   To test without opening browser:")
        print(f"   ./dist/{APP_NAME} --no-open-browser --port 9902")
    else:
        print("❌ Build failed! Output not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()

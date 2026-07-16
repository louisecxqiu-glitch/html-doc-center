#!/usr/bin/env python3
"""
HotPage Windows 兼容性自测脚本
在 Windows 上运行：python hotpage-windows-check.py
"""
import os, sys, platform, json, pathlib

print("=" * 60)
print("  HotPage Windows 兼容性自测")
print("=" * 60)
print()

checks = []

# 1. Python 版本
ver = sys.version_info
ok = ver >= (3, 8)
checks.append(("Python 版本", f"{ver.major}.{ver.minor}.{ver.micro}", "≥ 3.8", ok))

# 2. aiohttp
try:
    import aiohttp
    checks.append(("aiohttp", aiohttp.__version__, "已安装", True))
except ImportError:
    checks.append(("aiohttp", "未安装", "需要安装", False))

# 3. 平台
checks.append(("操作系统", platform.system(), "Windows", platform.system() == "Windows"))

# 4. 主目录
home = str(pathlib.Path.home())
checks.append(("主目录", home, "存在", pathlib.Path(home).is_dir()))

# 5. Desktop
desktop = pathlib.Path(home) / "Desktop"
checks.append(("桌面", str(desktop), "存在" if desktop.is_dir() else "不存在", desktop.is_dir()))

# 6. OneDrive 重定向
onedrive = os.environ.get("OneDrive", "")
if onedrive:
    od_desktop = pathlib.Path(onedrive) / "Desktop"
    checks.append(("OneDrive 桌面", str(od_desktop), "存在" if od_desktop.is_dir() else "不存在", od_desktop.is_dir()))

# 7. config 目录
config_dir = os.path.expanduser("~/.codebuddy/html-doc-center")
checks.append(("配置目录", config_dir, "可创建", True))
try:
    os.makedirs(config_dir, exist_ok=True)
    test_file = os.path.join(config_dir, "test.tmp")
    with open(test_file, "w") as f:
        f.write("test")
    os.remove(test_file)
    checks[-1] = ("配置目录", config_dir, "可读写", True)
except Exception as e:
    checks[-1] = ("配置目录", config_dir, f"不可写: {e}", False)

# 8. 端口 9901
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
result = sock.connect_ex(("127.0.0.1", 9901))
sock.close()
if result == 0:
    checks.append(("端口 9901", "已占用", "服务在运行", True))
else:
    checks.append(("端口 9901", "空闲", "服务未启动", False))

# 9. 路径分隔符测试
test_path = os.path.join(home, "test.html")
checks.append(("路径分隔符", test_path, 
               "含反斜杠" if "\\" in test_path else "正斜杠", 
               True))

# 10. 浏览器默认
import webbrowser
checks.append(("浏览器模块", "webbrowser", "可用", True))

print(f"{'检查项':<20} {'当前值':<40} {'期望':<20} {'结果'}")
print("-" * 90)
all_ok = True
for name, current, expected, ok in checks:
    status = "✅" if ok else "❌"
    if not ok:
        all_ok = False
    print(f"{name:<20} {str(current)[:38]:<40} {str(expected)[:18]:<20} {status}")

print()
print("=" * 60)
if all_ok:
    print("  ✅ 所有检查通过！HotPage 应该能在 Windows 上正常工作。")
else:
    print("  ❌ 有检查项未通过，请按上面的提示修复。")
print("=" * 60)

print()
print("如果服务未启动，请在项目目录运行：")
print("  python server.py --open-browser")
print()
input("按回车键退出...")

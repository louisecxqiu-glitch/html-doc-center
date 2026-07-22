#!/usr/bin/env python3
"""Build HTML Studio for the current platform with PyInstaller.

This command only creates the application bundle/executable. On macOS, use
``python3 scripts/release_macos.py`` for the signed, notarized DMG.
"""

from __future__ import annotations

import argparse
import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
APP_NAME = "HTMLStudio"
DISPLAY_NAME = "HTML Studio"
BUNDLE_ID = "com.louisqiu.htmlstudio"
MINIMUM_MACOS = "12.0"
VERSION_FILE = ROOT / "VERSION"
ICON_FILE = ROOT / "assets" / "HTMLStudio.icns"
IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
DATA_SEPARATOR = ";" if IS_WINDOWS else ":"


def read_version() -> str:
    version = VERSION_FILE.read_text(encoding="utf-8").strip()
    if not version:
        raise RuntimeError(f"Version file is empty: {VERSION_FILE}")
    return version


def require_build_dependencies() -> None:
    missing = []
    for module_name in ("PyInstaller", "aiohttp"):
        try:
            __import__(module_name)
        except ImportError:
            missing.append(module_name)
    if missing:
        raise SystemExit(
            "Missing build dependencies: "
            + ", ".join(missing)
            + ". Run: python3 -m pip install -r requirements-build.txt"
        )


def update_macos_metadata(app_path: Path, version: str) -> None:
    plist_path = app_path / "Contents" / "Info.plist"
    with plist_path.open("rb") as handle:
        info = plistlib.load(handle)
    info.update(
        {
            "CFBundleIdentifier": BUNDLE_ID,
            "CFBundleName": DISPLAY_NAME,
            "CFBundleDisplayName": DISPLAY_NAME,
            "CFBundleShortVersionString": version,
            "CFBundleVersion": version,
            "LSMinimumSystemVersion": MINIMUM_MACOS,
            "NSHighResolutionCapable": True,
        }
    )
    with plist_path.open("wb") as handle:
        plistlib.dump(info, handle, sort_keys=False)


def sign_macos_bundle(app_path: Path, identity: str | None) -> None:
    command = ["codesign", "--force"]
    if identity and identity != "-":
        command.extend(
            [
                "--timestamp",
                "--options",
                "runtime",
                "--entitlements",
                str(ROOT / "packaging" / "macos" / "entitlements.plist"),
            ]
        )
    command.extend(["--sign", identity or "-", str(app_path)])
    subprocess.run(command, check=True)


def build(version: str, codesign_identity: str | None = None) -> Path:
    require_build_dependencies()
    os.chdir(ROOT)

    for directory_name in ("build", "dist"):
        directory = ROOT / directory_name
        if directory.exists():
            shutil.rmtree(directory)

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name",
        APP_NAME,
        "--add-data",
        f"web{DATA_SEPARATOR}web",
        "--add-data",
        f"saver-runtime.js{DATA_SEPARATOR}.",
        "--clean",
        "--noconfirm",
    ]

    if IS_WINDOWS:
        command.append("--onefile")
    elif IS_MACOS:
        if not ICON_FILE.exists():
            raise SystemExit(f"Missing macOS icon: {ICON_FILE}")
        command.extend(
            [
                "--onedir",
                "--windowed",
                "--icon",
                str(ICON_FILE),
                "--osx-bundle-identifier",
                BUNDLE_ID,
                "--target-architecture",
                "arm64",
            ]
        )
        if codesign_identity and codesign_identity != "-":
            command.extend(
                [
                    "--codesign-identity",
                    codesign_identity,
                    "--osx-entitlements-file",
                    str(ROOT / "packaging" / "macos" / "entitlements.plist"),
                ]
            )
    else:
        command.extend(["--onefile", "--windowed"])

    command.append("server.py")
    print(f"Building {DISPLAY_NAME} {version} on {sys.platform}...")
    build_environment = os.environ.copy()
    build_environment["PYINSTALLER_CONFIG_DIR"] = str(ROOT / "build" / "pyinstaller-config")
    subprocess.run(command, check=True, env=build_environment)

    if IS_WINDOWS:
        output = ROOT / "dist" / f"{APP_NAME}.exe"
    elif IS_MACOS:
        output = ROOT / "dist" / f"{APP_NAME}.app"
        update_macos_metadata(output, version)
        sign_macos_bundle(output, codesign_identity)
    else:
        output = ROOT / "dist" / APP_NAME

    if not output.exists():
        raise SystemExit(f"Build output was not created: {output}")

    print(f"Build complete: {output}")
    if IS_MACOS:
        print("For a signed release, run: python3 scripts/release_macos.py")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=read_version(), help="Bundle version")
    parser.add_argument(
        "--codesign-identity",
        default=None,
        help="Developer ID identity passed to PyInstaller for nested macOS code",
    )
    args = parser.parse_args()
    build(args.version, args.codesign_identity)


if __name__ == "__main__":
    main()
